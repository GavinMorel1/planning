# Planning API proxy (Cloudflare Worker)

Holds the Anthropic API key so the browser never sees it. The web app sends the Claude request here together with the signed-in user's Supabase login token; the Worker checks the token, rate-limits per user, and forwards the request to Anthropic with the key attached. See `docs/SETUP.md` section 2 for the same walkthrough in the context of the whole setup.

```
Browser (GitHub Pages)  --POST /anthropic/v1/messages + Authorization: Bearer <Supabase token>-->  Worker  --x-api-key-->  api.anthropic.com
```

## What it enforces

| Check | Result when it fails |
|---|---|
| Origin must be in `ALLOWED_ORIGINS` (checked first, before login and before any call to Anthropic) | 403 |
| No `Origin` header (curl, scripts) refused unless `ALLOW_NO_ORIGIN = "true"` | 403 |
| `Authorization: Bearer <Supabase JWT>`: signature, `exp`, `nbf`, issuer, audience `authenticated`, role `authenticated` | 401 |
| Per-user rate limit (default 20 calls per 60 s) | 429 + `Retry-After` |
| Body is JSON, at most `MAX_BODY_BYTES` (25 MB) | 415 / 400 / 413 |
| `model` in `ALLOWED_MODELS`, `max_tokens` at most `MAX_OUTPUT_TOKENS` (32000), no `stream: true` | 400 |

Only `anthropic-version` and `anthropic-beta` are forwarded from the browser; any `x-api-key` the client sends is dropped. Errors from Anthropic are passed through with their status. Every response carries `x-request-id`. One JSON log line per request (user id, status, milliseconds, token counts); the body and the token are never logged.

Routes: `POST /anthropic/v1/messages`, `GET /health` (returns `{"ok":true}`, no login needed). Everything else is 404.

## Configuration

Secrets (`npx wrangler secret put NAME`):

| Name | Required | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | From console.anthropic.com. The old name `ANTHROPIC_KEY` still works. |
| `SUPABASE_JWT_SECRET` | no | Only if the Supabase project still signs tokens with the legacy HS256 "JWT secret" (Project Settings -> JWT). Not needed with the newer signing keys. |

Variables (in `wrangler.toml`, not secret): `ALLOWED_ORIGINS`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ALLOWED_MODELS`, `MAX_OUTPUT_TOKENS`, `MAX_BODY_BYTES`, `RATE_LIMIT_MAX`, `RATE_LIMIT_PERIOD_SECONDS`, `ALLOW_LOCALHOST`, `ALLOW_NO_ORIGIN`. Each is explained in the file.

Binding: `RATE_LIMITER`, a Cloudflare Rate Limiting binding declared in `wrangler.toml` with the current `[[ratelimits]]` syntax (Wrangler 4.x). Older Wrangler versions need the `[[unsafe.bindings]]` form shown in a comment in that file. Cloudflare counts per data centre, so the limit is approximate and not a hard global cap. When the binding is absent (for example `wrangler dev`) the Worker falls back to a per-instance in-memory limiter using `RATE_LIMIT_MAX` / `RATE_LIMIT_PERIOD_SECONDS`.

How login tokens are checked: first against the project's public signing keys (`SUPABASE_URL/auth/v1/.well-known/jwks.json`, cached 10 minutes, ES256 and RS256), or against `SUPABASE_JWT_SECRET` for HS256 tokens. If neither verifies (for example just after a key rotation) the Worker asks Supabase `/auth/v1/user` using `SUPABASE_ANON_KEY` and remembers a positive answer for 60 seconds.

## Deploy

```bash
cd worker
npx wrangler login                          # opens a browser, approve
npx wrangler secret put ANTHROPIC_API_KEY   # paste the key from console.anthropic.com, press Enter
# optional, only for the legacy HS256 secret:
# npx wrangler secret put SUPABASE_JWT_SECRET
# edit wrangler.toml: ALLOWED_ORIGINS and SUPABASE_URL must match your site and project
npx wrangler deploy                         # prints https://planning-api-proxy.<you>.workers.dev
```

Then add that URL (no trailing slash) as the GitHub repository secret `VITE_PROXY_URL` and re-run the **Deploy to GitHub Pages** workflow.

## Test it

```bash
URL=https://planning-api-proxy.<you>.workers.dev
# 1. alive? (curl sends no Origin, so pretend to be the site)
curl -s -H "Origin: https://gavinmorel1.github.io" $URL/health          # {"ok":true}
# 2. wrong site is refused
curl -s -i -H "Origin: https://example.com" $URL/health | head -1       # HTTP/2 403
# 3. no login is refused
curl -s -H "Origin: https://gavinmorel1.github.io" -H "Content-Type: application/json" \
  -d '{"model":"claude-opus-5","max_tokens":16,"messages":[{"role":"user","content":"hi"}]}' \
  $URL/anthropic/v1/messages                                             # {"error":"missing or malformed Authorization bearer token"}
```

For a full end-to-end check, sign in to the app and use Claude (for example upload a document). Or copy a token from the browser (DevTools -> Application -> Local Storage -> the `sb-...-auth-token` entry, field `access_token`) and add `-H "Authorization: Bearer <token>"` to the third command. Tokens expire after an hour.

## Operations

- **Live logs:** `cd worker && npx wrangler tail` (add `--format json` for raw lines). Look for `"status":401` (login problems), `403` (wrong origin), `429` (rate limit).
- **Rotate the Anthropic key:** create a new key in the Anthropic console, run `npx wrangler secret put ANTHROPIC_API_KEY` and paste it (takes effect immediately, no redeploy), then delete the old key in the console.
- **Change limits / models / origins:** edit `wrangler.toml` and run `npx wrangler deploy`.
- **Local development:** set `ALLOW_LOCALHOST = "true"` temporarily, run `npx wrangler dev`, put `VITE_PROXY_URL=http://localhost:8787` in `.env`. For local runs put the secret in `worker/.dev.vars` (never commit it): `ANTHROPIC_API_KEY=...`.

## Tests

No network or Cloudflare account needed:

```bash
npx vitest run --config worker/vitest.config.js
```
