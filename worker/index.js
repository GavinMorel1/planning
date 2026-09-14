/**
 * Paradiem Planning — API proxy (Cloudflare Worker).
 *
 * The app is a static site; anything in the bundle is public. This Worker holds the
 * Anthropic API key and forwards Messages API calls, so the key never reaches the browser.
 *
 * App calls:   <worker>/anthropic/v1/messages   (POST, same body as the Anthropic API)
 * Worker adds: x-api-key + anthropic-version, then forwards to api.anthropic.com.
 *
 * Setup: `npx wrangler secret put ANTHROPIC_KEY`, set ALLOWED_ORIGINS in wrangler.toml, deploy.
 */
export default {
  async fetch(request, env) {
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)
    const origin = request.headers.get('Origin') || ''
    const okOrigin = !origin || allowed.includes(origin)
    const cors = {
      'Access-Control-Allow-Origin': okOrigin && origin ? origin : allowed[0] || '*',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, anthropic-version, anthropic-beta',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (!okOrigin) return json({ error: 'origin not allowed' }, 403, cors)
    const url = new URL(request.url)
    if (!url.pathname.startsWith('/anthropic/')) return json({ error: 'use /anthropic/v1/messages' }, 404, cors)
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405, cors)
    if (!env.ANTHROPIC_KEY) return json({ error: 'ANTHROPIC_KEY secret not set' }, 500, cors)

    const target = 'https://api.anthropic.com' + url.pathname.replace(/^\/anthropic/, '')
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_KEY,
      'anthropic-version': request.headers.get('anthropic-version') || '2023-06-01',
    }
    const beta = request.headers.get('anthropic-beta'); if (beta) headers['anthropic-beta'] = beta
    let res
    try { res = await fetch(target, { method: 'POST', headers, body: request.body }) }
    catch { return json({ error: 'upstream failed' }, 502, cors) }
    return new Response(res.body, { status: res.status, headers: { ...cors, 'Content-Type': res.headers.get('content-type') || 'application/json' } })
  },
}
const json = (o, status, headers) => new Response(JSON.stringify(o), { status, headers: { ...headers, 'Content-Type': 'application/json' } })
