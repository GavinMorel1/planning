/**
 * Paradiem Planning — API proxy (Cloudflare Worker).
 *
 * The app is a static site; anything in the bundle is public. This Worker holds the
 * Anthropic API key and forwards Messages API calls, so the key never reaches the browser.
 *
 * Routes
 *   POST /anthropic/v1/messages   proxy to https://api.anthropic.com/v1/messages
 *   GET  /health                  {ok:true}, no auth
 *
 * Request pipeline (order matters; each step runs before the next, more expensive one):
 *   1. CORS / origin allow-list      -> 403 before anything else (no auth, no upstream call)
 *   2. OPTIONS preflight             -> 204
 *   3. route + method                -> 404 / 405
 *   4. Supabase JWT verification     -> 401
 *   5. per-user rate limit           -> 429 + Retry-After
 *   6. body size / JSON / model / max_tokens / stream checks -> 413 / 415 / 400
 *   7. forward with OUR key; client-supplied x-api-key is never forwarded
 *
 * Secrets:  ANTHROPIC_API_KEY (legacy name ANTHROPIC_KEY also accepted), SUPABASE_JWT_SECRET (optional)
 * Vars/bindings: see worker/wrangler.toml and worker/README.md.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
const JWKS_TTL_MS = 10 * 60 * 1000
const JWKS_MIN_REFETCH_MS = 60 * 1000
const USER_CACHE_TTL_MS = 60 * 1000
const CLOCK_SKEW_S = 5
const DEFAULT_ORIGINS = ['https://gavinmorel1.github.io']
const LOCALHOST_ORIGINS = ['http://localhost:5173', 'http://localhost:4173']
const DEFAULT_MODELS = ['claude-opus-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']
const ALLOW_HEADERS = 'Content-Type, Authorization, anthropic-version, anthropic-beta'

/** Per-isolate mutable state (caches + fallback rate limiter). Tests pass their own via deps.state. */
export function createState() {
  return { jwks: null, jwksAt: 0, jwksTriedAt: 0, users: new Map(), buckets: new Map() }
}
const sharedState = createState()

// ───────────────────────── helpers ─────────────────────────
const csv = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean)
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d }
const enc = new TextEncoder()
const dec = new TextDecoder()

function b64urlToBytes(s) {
  const b = atob(String(s).replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(String(s).length / 4) * 4, '='))
  const out = new Uint8Array(b.length)
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i)
  return out
}
function b64urlJson(s) { return JSON.parse(dec.decode(b64urlToBytes(s))) }
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

function config(env) {
  const supabase = String(env.SUPABASE_URL || '').trim().replace(/\/+$/, '')
  const origins = csv(env.ALLOWED_ORIGINS)
  return {
    apiKey: String(env.ANTHROPIC_API_KEY || env.ANTHROPIC_KEY || '').trim(),
    supabase,
    issuer: supabase + '/auth/v1',
    anonKey: String(env.SUPABASE_ANON_KEY || '').trim(),
    jwtSecret: String(env.SUPABASE_JWT_SECRET || '').trim(),
    origins: new Set([...(origins.length ? origins : DEFAULT_ORIGINS), ...(env.ALLOW_LOCALHOST === 'true' ? LOCALHOST_ORIGINS : [])]),
    allowNoOrigin: env.ALLOW_NO_ORIGIN === 'true',
    models: new Set(env.ALLOWED_MODELS ? csv(env.ALLOWED_MODELS) : DEFAULT_MODELS),
    maxTokens: num(env.MAX_OUTPUT_TOKENS, 32000),
    maxBody: num(env.MAX_BODY_BYTES, 25 * 1024 * 1024),
    rlMax: num(env.RATE_LIMIT_MAX, 20),
    rlPeriod: num(env.RATE_LIMIT_PERIOD_SECONDS, 60),
  }
}

function respond(body, status, extra = {}) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  })
}

// ───────────────────────── JWT verification ─────────────────────────
class AuthError extends Error {}

function checkClaims(c, cfg, nowS) {
  if (!c || typeof c !== 'object') throw new AuthError('invalid token')
  if (typeof c.exp !== 'number' || c.exp + CLOCK_SKEW_S < nowS) throw new AuthError('token expired')
  if (c.nbf !== undefined && (typeof c.nbf !== 'number' || c.nbf - CLOCK_SKEW_S > nowS)) throw new AuthError('token not yet valid')
  if (c.iss !== cfg.issuer) throw new AuthError('wrong issuer')
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud]
  if (!aud.includes('authenticated')) throw new AuthError('wrong audience')
  if (c.role !== 'authenticated') throw new AuthError('wrong role')
  if (typeof c.sub !== 'string' || !c.sub) throw new AuthError('missing subject')
}

async function getJwks(cfg, state, fetchFn, now, force) {
  const fresh = state.jwks && now - state.jwksAt < JWKS_TTL_MS
  if (fresh && !force) return state.jwks
  if (force && now - state.jwksTriedAt < JWKS_MIN_REFETCH_MS) return state.jwks || []
  state.jwksTriedAt = now
  try {
    const r = await fetchFn(`${cfg.supabase}/auth/v1/.well-known/jwks.json`, { headers: { Accept: 'application/json' } })
    if (!r.ok) throw new Error('jwks ' + r.status)
    const d = await r.json()
    state.jwks = Array.isArray(d.keys) ? d.keys : []
    state.jwksAt = now
  } catch {
    // keep whatever we had (even if stale); the /user fallback covers the gap
  }
  return state.jwks || []
}

const ALGS = {
  ES256: { import: { name: 'ECDSA', namedCurve: 'P-256' }, verify: { name: 'ECDSA', hash: 'SHA-256' }, kty: 'EC' },
  RS256: { import: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, verify: { name: 'RSASSA-PKCS1-v1_5' }, kty: 'RSA' },
}

async function verifyAsymmetric(alg, header, signingInput, sig, cfg, state, fetchFn, now) {
  const spec = ALGS[alg]
  const match = (keys) => keys.filter((k) => k && k.kty === spec.kty && (!k.alg || k.alg === alg) && (!k.use || k.use === 'sig') && (!header.kid || k.kid === header.kid))
  let candidates = match(await getJwks(cfg, state, fetchFn, now, false))
  if (!candidates.length && header.kid) candidates = match(await getJwks(cfg, state, fetchFn, now, true)) // rotated key?
  for (const jwk of candidates) {
    try {
      const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y, n: jwk.n, e: jwk.e, ext: true }, spec.import, false, ['verify'])
      if (await crypto.subtle.verify(spec.verify, key, sig, signingInput)) return true
    } catch { /* try next key */ }
  }
  return false
}

async function verifyHs256(secret, signingInput, sig) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
  return crypto.subtle.verify('HMAC', key, sig, signingInput)
}

async function verifyViaUserEndpoint(token, cfg, state, fetchFn, now) {
  if (!cfg.anonKey) throw new AuthError('invalid token')
  const h = hex(await crypto.subtle.digest('SHA-256', enc.encode(token)))
  const hit = state.users.get(h)
  if (hit && hit.until > now) return hit.user
  let r
  try { r = await fetchFn(`${cfg.supabase}/auth/v1/user`, { headers: { Authorization: `Bearer ${token}`, apikey: cfg.anonKey, Accept: 'application/json' } }) }
  catch { throw new AuthError('could not verify token') }
  if (!r.ok) throw new AuthError('invalid token')
  const u = await r.json().catch(() => null)
  if (!u || typeof u.id !== 'string' || !u.id) throw new AuthError('invalid token')
  const user = { id: u.id, email: u.email || null }
  if (state.users.size > 500) for (const [k, v] of state.users) if (v.until <= now) state.users.delete(k)
  if (state.users.size > 2000) state.users.clear()
  state.users.set(h, { user, until: now + USER_CACHE_TTL_MS })
  return user
}

/** Returns {id, email} or throws AuthError. */
export async function authenticate(request, cfg, state, fetchFn, now) {
  const m = /^Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec((request.headers.get('Authorization') || '').trim())
  if (!m) throw new AuthError('missing or malformed Authorization bearer token')
  const token = m[1]
  const [h, p, s] = token.split('.')
  let header, claims
  try { header = b64urlJson(h); claims = b64urlJson(p) } catch { throw new AuthError('invalid token') }
  const alg = header && header.alg
  if (alg !== 'ES256' && alg !== 'RS256' && alg !== 'HS256') throw new AuthError('unsupported token algorithm')
  // Claims are cheap to check and a token failing them can never become valid: reject before any crypto / network.
  checkClaims(claims, cfg, Math.floor(now / 1000))
  const signingInput = enc.encode(`${h}.${p}`)
  let sig
  try { sig = b64urlToBytes(s) } catch { throw new AuthError('invalid token') }
  let ok = false
  try {
    if (alg === 'HS256') ok = cfg.jwtSecret ? await verifyHs256(cfg.jwtSecret, signingInput, sig) : false
    else ok = await verifyAsymmetric(alg, header, signingInput, sig, cfg, state, fetchFn, now)
  } catch { ok = false }
  if (ok) return { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : null }
  // Neither key type verified (rotation, secret not configured, JWKS unreachable): ask Supabase itself.
  return verifyViaUserEndpoint(token, cfg, state, fetchFn, now)
}

// ───────────────────────── rate limiting ─────────────────────────
async function rateLimit(env, cfg, state, userId, now) {
  if (env.RATE_LIMITER && typeof env.RATE_LIMITER.limit === 'function') {
    try {
      const { success } = await env.RATE_LIMITER.limit({ key: userId })
      return success ? 0 : cfg.rlPeriod
    } catch { /* binding failed: fall through to the in-memory bucket */ }
  }
  // Coarse per-isolate token bucket: capacity rlMax, refills rlMax per rlPeriod.
  const rate = cfg.rlMax / (cfg.rlPeriod * 1000)
  let b = state.buckets.get(userId)
  if (!b) b = { tokens: cfg.rlMax, at: now }
  b.tokens = Math.min(cfg.rlMax, b.tokens + (now - b.at) * rate)
  b.at = now
  let wait = 0
  if (b.tokens >= 1) b.tokens -= 1
  else wait = Math.ceil((1 - b.tokens) / rate / 1000)
  state.buckets.set(userId, b)
  if (state.buckets.size > 5000) for (const [k, v] of state.buckets) if (now - v.at > cfg.rlPeriod * 1000) state.buckets.delete(k)
  return wait
}

// ───────────────────────── body handling ─────────────────────────
class BodyTooLarge extends Error {}
async function readCapped(request, max) {
  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > max) throw new BodyTooLarge()
  if (!request.body) return new Uint8Array(0)
  const reader = request.body.getReader()
  const chunks = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > max) { try { await reader.cancel() } catch { /* ignore */ } throw new BodyTooLarge() }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let o = 0
  for (const c of chunks) { out.set(c, o); o += c.byteLength }
  return out
}

function validateBody(body, cfg) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'body must be a JSON object'
  if (body.stream === true) return 'streaming is not supported by this proxy'
  if (typeof body.model !== 'string' || !cfg.models.has(body.model)) return 'model not allowed'
  if (!Number.isInteger(body.max_tokens) || body.max_tokens < 1) return 'max_tokens must be a positive integer'
  if (body.max_tokens > cfg.maxTokens) return `max_tokens exceeds the limit of ${cfg.maxTokens}`
  if (Array.isArray(body.fallbacks)) {
    for (const f of body.fallbacks) {
      const m = typeof f === 'string' ? f : f && f.model
      if (m !== undefined && !cfg.models.has(m)) return 'fallback model not allowed'
    }
  }
  return null
}

// ───────────────────────── main handler ─────────────────────────
export async function handle(request, env = {}, deps = {}) {
  const fetchFn = deps.fetch || globalThis.fetch.bind(globalThis)
  const now = typeof deps.now === 'function' ? deps.now() : Date.now()
  const state = deps.state || sharedState
  const started = Date.now()
  const id = crypto.randomUUID()
  const cfg = config(env)
  const url = new URL(request.url)
  const origin = request.headers.get('Origin')
  const log = { id, method: request.method, path: url.pathname, user: null, status: 0, ms: 0 }

  const base = { Vary: 'Origin', 'x-request-id': id }
  let headers = base
  const done = (res, reason) => {
    log.status = res.status
    log.ms = Date.now() - started
    if (reason) log.reason = reason
    console.log(JSON.stringify(log))
    return res
  }
  const fail = (status, error, extra, reason) => done(respond({ error }, status, { ...headers, ...extra }), reason || error)

  // 1. origin allow-list — before auth, before any upstream call
  const originOk = origin ? cfg.origins.has(origin) : cfg.allowNoOrigin
  if (!originOk) return fail(403, origin ? 'origin not allowed' : 'requests without an Origin header are not allowed')
  if (origin) {
    headers = {
      ...base,
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Expose-Headers': 'x-request-id, Retry-After',
    }
  }

  // 2. preflight
  if (request.method === 'OPTIONS') {
    return done(new Response(null, {
      status: 204,
      headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': ALLOW_HEADERS, 'Access-Control-Max-Age': '86400' },
    }))
  }

  // 3. routing
  if (url.pathname === '/health') {
    if (request.method !== 'GET' && request.method !== 'HEAD') return fail(405, 'method not allowed', { Allow: 'GET, HEAD, OPTIONS' })
    return done(respond({ ok: true }, 200, headers))
  }
  if (url.pathname !== '/anthropic/v1/messages') return fail(404, 'not found')
  if (request.method !== 'POST') return fail(405, 'POST only', { Allow: 'POST, OPTIONS' })

  if (!cfg.apiKey || !cfg.supabase) {
    console.log(JSON.stringify({ id, level: 'error', msg: 'worker not configured', missing: [!cfg.apiKey && 'ANTHROPIC_API_KEY', !cfg.supabase && 'SUPABASE_URL'].filter(Boolean) }))
    return fail(500, 'proxy is not configured')
  }

  // 4. authentication
  let user
  try { user = await authenticate(request, cfg, state, fetchFn, now) }
  catch (e) { return fail(401, e instanceof AuthError ? e.message : 'invalid token', { 'WWW-Authenticate': 'Bearer' }, 'auth') }
  log.user = user.id

  // 5. rate limit
  const wait = await rateLimit(env, cfg, state, user.id, now)
  if (wait) return fail(429, 'rate limit exceeded, try again shortly', { 'Retry-After': String(wait) }, 'rate_limited')

  // 6. body
  const ct = (request.headers.get('content-type') || '').toLowerCase()
  if (!ct.includes('json')) return fail(415, 'Content-Type must be application/json')
  let raw
  try { raw = await readCapped(request, cfg.maxBody) }
  catch (e) { if (e instanceof BodyTooLarge) return fail(413, 'request body too large'); return fail(400, 'could not read request body') }
  let body
  try { body = JSON.parse(dec.decode(raw)) } catch { return fail(400, 'body is not valid JSON') }
  const bad = validateBody(body, cfg)
  if (bad) return fail(400, bad)

  // 7. forward: only our key + whitelisted headers
  const up = { 'Content-Type': 'application/json', 'x-api-key': cfg.apiKey }
  const ver = request.headers.get('anthropic-version')
  up['anthropic-version'] = ver && /^[\w.-]{1,32}$/.test(ver) ? ver : '2023-06-01'
  const beta = request.headers.get('anthropic-beta')
  if (beta && /^[\w.,\s-]{1,300}$/.test(beta)) up['anthropic-beta'] = beta
  let res, text
  try {
    res = await fetchFn(ANTHROPIC_URL, { method: 'POST', headers: up, body: raw })
    text = await res.text()
  } catch {
    return fail(502, 'upstream request failed', undefined, 'upstream_unreachable')
  }
  if (cfg.apiKey && text.includes(cfg.apiKey)) text = text.split(cfg.apiKey).join('[redacted]')
  try {
    const u = JSON.parse(text).usage
    if (u && typeof u === 'object') { log.input_tokens = u.input_tokens ?? null; log.output_tokens = u.output_tokens ?? null }
  } catch { /* not JSON */ }
  return done(new Response(text, {
    status: res.status,
    headers: { ...headers, 'Content-Type': res.headers.get('content-type') || 'application/json' },
  }))
}

export default {
  fetch(request, env) { return handle(request, env) },
}
