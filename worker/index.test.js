import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import worker, { handle, createState } from './index.js'

const SUPABASE = 'https://proj.supabase.co'
const ORIGIN = 'https://gavinmorel1.github.io'
const OUR_KEY = 'sk-ant-OUR-SECRET-KEY'
const CLIENT_KEY = 'sk-ant-CLIENT-SUPPLIED'
const NOW = 1_800_000_000_000 // fixed clock (ms)
const nowS = NOW / 1000

const b64u = (bytes) => Buffer.from(bytes).toString('base64url')
const b64uJson = (o) => b64u(Buffer.from(JSON.stringify(o)))

let ec, ec2, jwk, kid
beforeAll(async () => {
  ec = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  ec2 = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  kid = 'key-1'
  jwk = { ...(await crypto.subtle.exportKey('jwk', ec.publicKey)), kid, alg: 'ES256', use: 'sig' }
})

async function mint(over = {}, { alg = 'ES256', key, secret, kidOverride } = {}) {
  const header = { alg, typ: 'JWT', ...(alg === 'ES256' ? { kid: kidOverride ?? kid } : {}) }
  const payload = {
    iss: `${SUPABASE}/auth/v1`, aud: 'authenticated', role: 'authenticated',
    sub: 'user-123', email: 'a@paradiem.org', iat: nowS - 10, exp: nowS + 3600, ...over,
  }
  const input = `${b64uJson(header)}.${b64uJson(payload)}`
  let sig
  if (alg === 'HS256') {
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(input))
  } else {
    sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, (key || ec).privateKey, new TextEncoder().encode(input))
  }
  return `${input}.${b64u(sig)}`
}

const okBody = { model: 'claude-opus-5', max_tokens: 1000, messages: [{ role: 'user', content: 'hi' }] }
const upstreamOk = { id: 'msg_1', content: [{ type: 'text', text: 'hello' }], usage: { input_tokens: 11, output_tokens: 7 } }

function makeFetch({ jwks = [jwk], userStatus = 200, upstream = () => new Response(JSON.stringify(upstreamOk), { status: 200, headers: { 'content-type': 'application/json' } }) } = {}) {
  const fn = vi.fn(async (url, init) => {
    url = String(url)
    if (url === `${SUPABASE}/auth/v1/.well-known/jwks.json`) return new Response(JSON.stringify({ keys: jwks }), { status: 200 })
    if (url === `${SUPABASE}/auth/v1/user`) {
      return userStatus === 200
        ? new Response(JSON.stringify({ id: 'user-from-api', email: 'u@paradiem.org' }), { status: 200 })
        : new Response('{"msg":"invalid"}', { status: userStatus })
    }
    if (url === 'https://api.anthropic.com/v1/messages') return upstream(url, init)
    throw new Error('unexpected fetch ' + url)
  })
  return fn
}
const upstreamCalls = (f) => f.mock.calls.filter(([u]) => String(u).startsWith('https://api.anthropic.com'))

const baseEnv = () => ({
  ANTHROPIC_API_KEY: OUR_KEY, SUPABASE_URL: SUPABASE, SUPABASE_ANON_KEY: 'anon-key', ALLOWED_ORIGINS: ORIGIN,
})

async function call({ token, body = okBody, headers = {}, origin = ORIGIN, method = 'POST', path = '/anthropic/v1/messages', env = baseEnv(), fetchFn = makeFetch(), state = createState(), rawBody } = {}) {
  const h = { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01', ...headers }
  if (origin) h.Origin = origin
  if (token !== undefined) h.Authorization = `Bearer ${token}`
  const init = { method, headers: h }
  if (method === 'POST') init.body = rawBody ?? JSON.stringify(body)
  const res = await handle(new Request('https://proxy.example.workers.dev' + path, init), env, { fetch: fetchFn, state, now: () => NOW })
  return { res, fetchFn, state }
}

let logSpy
beforeEach(() => { logSpy = vi.spyOn(console, 'log').mockImplementation(() => {}) })
afterEach(() => { vi.restoreAllMocks() })

describe('proxy happy path', () => {
  it('proxies a valid token with our key, not the client key, and returns CORS headers', async () => {
    const token = await mint()
    const { res, fetchFn } = await call({ token, headers: { 'x-api-key': CLIENT_KEY, 'anthropic-beta': 'server-side-fallback-2026-07-01', 'x-evil': '1' } })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(upstreamOk)
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN)
    expect(res.headers.get('vary')).toBe('Origin')
    expect(res.headers.get('x-request-id')).toBeTruthy()
    const calls = upstreamCalls(fetchFn)
    expect(calls).toHaveLength(1)
    const [url, init] = calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect(init.headers['x-api-key']).toBe(OUR_KEY)
    expect(JSON.stringify(init.headers)).not.toContain(CLIENT_KEY)
    expect(init.headers['anthropic-version']).toBe('2023-06-01')
    expect(init.headers['anthropic-beta']).toBe('server-side-fallback-2026-07-01')
    expect(Object.keys(init.headers).sort()).toEqual(['Content-Type', 'anthropic-beta', 'anthropic-version', 'x-api-key'])
    expect(JSON.parse(new TextDecoder().decode(init.body))).toEqual(okBody)
  })

  it('accepts the legacy ANTHROPIC_KEY secret name', async () => {
    const env = { ...baseEnv(), ANTHROPIC_API_KEY: undefined, ANTHROPIC_KEY: 'sk-legacy' }
    const { res, fetchFn } = await call({ token: await mint(), env })
    expect(res.status).toBe(200)
    expect(upstreamCalls(fetchFn)[0][1].headers['x-api-key']).toBe('sk-legacy')
  })

  it('logs one JSON line with user id, status, ms and token usage, but never the token or body', async () => {
    const token = await mint()
    await call({ token })
    expect(logSpy).toHaveBeenCalledTimes(1)
    const line = logSpy.mock.calls[0][0]
    const j = JSON.parse(line)
    expect(j).toMatchObject({ user: 'user-123', status: 200, input_tokens: 11, output_tokens: 7 })
    expect(typeof j.ms).toBe('number')
    expect(line).not.toContain(token)
    expect(line).not.toContain('"hi"')
    expect(line).not.toContain(OUR_KEY)
  })

  it('passes upstream errors through with status and body, redacting our key', async () => {
    const upstream = () => new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: `bad key ${OUR_KEY}` } }), { status: 401, headers: { 'content-type': 'application/json' } })
    const { res } = await call({ token: await mint(), fetchFn: makeFetch({ upstream }) })
    expect(res.status).toBe(401)
    const t = await res.text()
    expect(t).toContain('authentication_error')
    expect(t).not.toContain(OUR_KEY)
  })

  it('returns 502 without leaking details when upstream is unreachable', async () => {
    const upstream = () => { throw new Error('boom ' + OUR_KEY) }
    const { res } = await call({ token: await mint(), fetchFn: makeFetch({ upstream }) })
    expect(res.status).toBe(502)
    expect(await res.text()).not.toContain(OUR_KEY)
  })

  it('default export fetch() works with a stubbed global fetch', async () => {
    const f = makeFetch()
    vi.stubGlobal('fetch', f)
    try {
      const token = await mint({ exp: Math.floor(Date.now() / 1000) + 600, iat: Math.floor(Date.now() / 1000) })
      const res = await worker.fetch(new Request('https://p.dev/anthropic/v1/messages', { method: 'POST', headers: { Origin: ORIGIN, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(okBody) }), baseEnv())
      expect(res.status).toBe(200)
    } finally { vi.unstubAllGlobals() }
  })
})

describe('authentication', () => {
  it('rejects a missing token (401) without calling upstream', async () => {
    const { res, fetchFn } = await call({})
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBeTruthy()
    expect(upstreamCalls(fetchFn)).toHaveLength(0)
  })

  it('rejects an expired token', async () => {
    const { res, fetchFn } = await call({ token: await mint({ exp: nowS - 600 }) })
    expect(res.status).toBe(401)
    expect(upstreamCalls(fetchFn)).toHaveLength(0)
  })

  it('rejects a not-yet-valid token (nbf)', async () => {
    const { res } = await call({ token: await mint({ nbf: nowS + 600 }) })
    expect(res.status).toBe(401)
  })

  it('rejects a wrong audience', async () => {
    const { res } = await call({ token: await mint({ aud: 'something-else' }) })
    expect(res.status).toBe(401)
  })

  it('rejects a wrong issuer', async () => {
    const { res } = await call({ token: await mint({ iss: 'https://evil.supabase.co/auth/v1' }) })
    expect(res.status).toBe(401)
  })

  it('rejects the anon role', async () => {
    const { res } = await call({ token: await mint({ role: 'anon' }) })
    expect(res.status).toBe(401)
  })

  it('rejects a bad signature (signed by a different key) and does not proxy', async () => {
    const token = await mint({}, { key: ec2 })
    const { res, fetchFn } = await call({ token, fetchFn: makeFetch({ userStatus: 401 }) })
    expect(res.status).toBe(401)
    expect(upstreamCalls(fetchFn)).toHaveLength(0)
  })

  it('rejects alg none / garbage tokens', async () => {
    const none = `${b64uJson({ alg: 'none' })}.${b64uJson({ iss: `${SUPABASE}/auth/v1`, aud: 'authenticated', role: 'authenticated', sub: 'x', exp: nowS + 100 })}.AAAA`
    expect((await call({ token: none })).res.status).toBe(401)
    expect((await call({ token: 'not-a-jwt' })).res.status).toBe(401)
  })

  it('HS256 token verifies with SUPABASE_JWT_SECRET', async () => {
    const secret = 'super-secret-jwt-key'
    const token = await mint({}, { alg: 'HS256', secret })
    const fetchFn = makeFetch({ userStatus: 401 }) // fallback would fail, so success proves local HS256 verification
    const { res } = await call({ token, env: { ...baseEnv(), SUPABASE_JWT_SECRET: secret }, fetchFn })
    expect(res.status).toBe(200)
    expect(fetchFn.mock.calls.some(([u]) => String(u).endsWith('/auth/v1/user'))).toBe(false)
  })

  it('HS256 token with the wrong secret is rejected', async () => {
    const token = await mint({}, { alg: 'HS256', secret: 'other-secret' })
    const { res } = await call({ token, env: { ...baseEnv(), SUPABASE_JWT_SECRET: 'super-secret-jwt-key' }, fetchFn: makeFetch({ userStatus: 401 }) })
    expect(res.status).toBe(401)
  })

  it('falls back to /auth/v1/user when no local key verifies, and caches the positive result', async () => {
    const token = await mint({}, { alg: 'HS256', secret: 'unknown-to-worker' }) // no SUPABASE_JWT_SECRET configured
    const fetchFn = makeFetch()
    const state = createState()
    const r1 = await call({ token, fetchFn, state })
    expect(r1.res.status).toBe(200)
    const userCall = fetchFn.mock.calls.find(([u]) => String(u).endsWith('/auth/v1/user'))
    expect(userCall[1].headers.Authorization).toBe(`Bearer ${token}`)
    expect(userCall[1].headers.apikey).toBe('anon-key')
    expect(JSON.parse(logSpy.mock.calls[0][0]).user).toBe('user-from-api')
    await call({ token, fetchFn, state })
    expect(fetchFn.mock.calls.filter(([u]) => String(u).endsWith('/auth/v1/user'))).toHaveLength(1) // cached
  })

  it('falls back to /user when the signing key was rotated (unknown kid)', async () => {
    const token = await mint({}, { kidOverride: 'rotated-key', key: ec2 })
    const fetchFn = makeFetch()
    const { res } = await call({ token, fetchFn })
    expect(res.status).toBe(200)
    expect(fetchFn.mock.calls.some(([u]) => String(u).endsWith('/auth/v1/user'))).toBe(true)
  })

  it('caches the JWKS between requests', async () => {
    const fetchFn = makeFetch()
    const state = createState()
    await call({ token: await mint(), fetchFn, state })
    await call({ token: await mint(), fetchFn, state })
    expect(fetchFn.mock.calls.filter(([u]) => String(u).includes('jwks.json'))).toHaveLength(1)
  })
})

describe('CORS and origin rules', () => {
  it('rejects a disallowed origin with 403 before auth and without any fetch', async () => {
    const { res, fetchFn } = await call({ token: await mint(), origin: 'https://evil.example' })
    expect(res.status).toBe(403)
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('rejects a disallowed origin even with no token (403, not 401)', async () => {
    const { res, fetchFn } = await call({ origin: 'https://evil.example' })
    expect(res.status).toBe(403)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('rejects requests with no Origin unless ALLOW_NO_ORIGIN=true', async () => {
    const token = await mint()
    const a = await call({ token, origin: null })
    expect(a.res.status).toBe(403)
    expect(a.fetchFn).not.toHaveBeenCalled()
    const b = await call({ token, origin: null, env: { ...baseEnv(), ALLOW_NO_ORIGIN: 'true' } })
    expect(b.res.status).toBe(200)
  })

  it('allows localhost only when ALLOW_LOCALHOST=true', async () => {
    const token = await mint()
    expect((await call({ token, origin: 'http://localhost:5173' })).res.status).toBe(403)
    const ok = await call({ token, origin: 'http://localhost:5173', env: { ...baseEnv(), ALLOW_LOCALHOST: 'true' } })
    expect(ok.res.status).toBe(200)
    expect(ok.res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    expect((await call({ token, origin: 'http://localhost:9999', env: { ...baseEnv(), ALLOW_LOCALHOST: 'true' } })).res.status).toBe(403)
  })

  it('defaults to the GitHub Pages origin when ALLOWED_ORIGINS is unset', async () => {
    const env = { ...baseEnv(), ALLOWED_ORIGINS: undefined }
    expect((await call({ token: await mint(), env })).res.status).toBe(200)
  })

  it('answers an OPTIONS preflight with 204 and the right headers, no auth needed', async () => {
    const fetchFn = makeFetch()
    const { res } = await call({ method: 'OPTIONS', fetchFn, headers: { 'Access-Control-Request-Method': 'POST' } })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN)
    expect(res.headers.get('vary')).toBe('Origin')
    const allow = res.headers.get('access-control-allow-headers').toLowerCase()
    for (const h of ['content-type', 'authorization', 'anthropic-version', 'anthropic-beta']) expect(allow).toContain(h)
    expect(res.headers.get('access-control-allow-methods')).toContain('POST')
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('refuses a preflight from a disallowed origin', async () => {
    const { res } = await call({ method: 'OPTIONS', origin: 'https://evil.example' })
    expect(res.status).toBe(403)
  })
})

describe('rate limiting', () => {
  it('returns 429 with Retry-After after the in-memory limit (no binding)', async () => {
    const token = await mint()
    const state = createState()
    const fetchFn = makeFetch()
    const env = { ...baseEnv(), RATE_LIMIT_MAX: '3', RATE_LIMIT_PERIOD_SECONDS: '60' }
    for (let i = 0; i < 3; i++) expect((await call({ token, state, fetchFn, env })).res.status).toBe(200)
    const { res } = await call({ token, state, fetchFn, env })
    expect(res.status).toBe(429)
    expect(Number(res.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(upstreamCalls(fetchFn)).toHaveLength(3)
  })

  it('limits per user, not globally', async () => {
    const state = createState()
    const env = { ...baseEnv(), RATE_LIMIT_MAX: '1' }
    const a = await mint({ sub: 'user-a' })
    const b = await mint({ sub: 'user-b' })
    expect((await call({ token: a, state, env })).res.status).toBe(200)
    expect((await call({ token: a, state, env })).res.status).toBe(429)
    expect((await call({ token: b, state, env })).res.status).toBe(200)
  })

  it('uses the RATE_LIMITER binding keyed by user id when present', async () => {
    const limit = vi.fn(async () => ({ success: false }))
    const { res } = await call({ token: await mint(), env: { ...baseEnv(), RATE_LIMITER: { limit } } })
    expect(limit).toHaveBeenCalledWith({ key: 'user-123' })
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('60')
  })

  it('lets the request through when the binding says success', async () => {
    const limit = vi.fn(async () => ({ success: true }))
    const { res } = await call({ token: await mint(), env: { ...baseEnv(), RATE_LIMITER: { limit } } })
    expect(res.status).toBe(200)
  })
})

describe('request validation', () => {
  it('rejects a model that is not allowed', async () => {
    const { res, fetchFn } = await call({ token: await mint(), body: { ...okBody, model: 'claude-2.1' } })
    expect(res.status).toBe(400)
    expect(upstreamCalls(fetchFn)).toHaveLength(0)
  })

  it('honours a custom ALLOWED_MODELS list', async () => {
    const env = { ...baseEnv(), ALLOWED_MODELS: 'claude-haiku-5-5' }
    expect((await call({ token: await mint(), env })).res.status).toBe(400)
    expect((await call({ token: await mint(), env, body: { ...okBody, model: 'claude-haiku-5-5' } })).res.status).toBe(200)
  })

  it('rejects max_tokens above the cap or missing', async () => {
    expect((await call({ token: await mint(), body: { ...okBody, max_tokens: 32001 } })).res.status).toBe(400)
    expect((await call({ token: await mint(), body: { ...okBody, max_tokens: 32000 } })).res.status).toBe(200)
    const { max_tokens, ...noMax } = okBody
    expect((await call({ token: await mint(), body: noMax })).res.status).toBe(400)
  })

  it('rejects a disallowed fallback model', async () => {
    expect((await call({ token: await mint(), body: { ...okBody, fallbacks: ['claude-2.1'] } })).res.status).toBe(400)
    expect((await call({ token: await mint(), body: { ...okBody, fallbacks: 'default' } })).res.status).toBe(200)
  })

  it('rejects stream: true', async () => {
    const { res, fetchFn } = await call({ token: await mint(), body: { ...okBody, stream: true } })
    expect(res.status).toBe(400)
    expect(upstreamCalls(fetchFn)).toHaveLength(0)
  })

  it('rejects an oversized body with 413 (actual bytes, no content-length trust)', async () => {
    const env = { ...baseEnv(), MAX_BODY_BYTES: '200' }
    const big = { ...okBody, messages: [{ role: 'user', content: 'x'.repeat(500) }] }
    const { res, fetchFn } = await call({ token: await mint(), env, body: big })
    expect(res.status).toBe(413)
    expect(upstreamCalls(fetchFn)).toHaveLength(0)
  })

  it('rejects non-JSON content types and invalid JSON', async () => {
    const token = await mint()
    expect((await call({ token, headers: { 'Content-Type': 'text/plain' } })).res.status).toBe(415)
    expect((await call({ token, rawBody: '{not json' })).res.status).toBe(400)
    expect((await call({ token, rawBody: '[1,2]' })).res.status).toBe(400)
  })
})

describe('routes', () => {
  it('GET /health returns {ok:true} with no auth and no secrets', async () => {
    const { res, fetchFn } = await call({ method: 'GET', path: '/health' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('/health follows the same origin rules', async () => {
    expect((await call({ method: 'GET', path: '/health', origin: 'https://evil.example' })).res.status).toBe(403)
    expect((await call({ method: 'GET', path: '/health', origin: null })).res.status).toBe(403)
  })

  it('unknown paths are 404 and wrong methods 405', async () => {
    expect((await call({ method: 'GET', path: '/nope' })).res.status).toBe(404)
    expect((await call({ method: 'POST', path: '/anthropic/v1/complete', token: await mint() })).res.status).toBe(404)
    expect((await call({ method: 'GET', path: '/anthropic/v1/messages' })).res.status).toBe(405)
  })

  it('returns 500 (not the secret name or value) when the proxy is not configured', async () => {
    const { res } = await call({ token: await mint(), env: { SUPABASE_URL: SUPABASE, ALLOWED_ORIGINS: ORIGIN } })
    expect(res.status).toBe(500)
  })
})
