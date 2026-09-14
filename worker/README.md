# Planning API proxy (Cloudflare Worker)

Holds the Anthropic API key so the browser never sees it. See `docs/SETUP.md` for the full walkthrough.

```bash
cd worker
npx wrangler login
npx wrangler secret put ANTHROPIC_KEY     # paste the key from console.anthropic.com
npx wrangler deploy                       # prints https://planning-api-proxy.<you>.workers.dev
```

Then set `VITE_PROXY_URL` to that URL (no trailing slash) in the Pages build environment and redeploy the app.
