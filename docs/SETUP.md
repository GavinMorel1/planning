# Setting up Paradiem Planning

Three services, all with free tiers. Do them in this order. Total time about 45 minutes.
You need: a paradiem.org email, a credit card only for Anthropic (pay-as-you-go).

The app works with **none** of this configured: run it locally and it stores data in the
browser ("Local mode"). Configure Supabase to share data across the team, Claude to read
documents and draft analyses, Cloudflare Pages to host it.

---

## 1. Supabase — logins, shared data, private document storage (15 min)

1. Go to https://supabase.com and create an account with your paradiem.org email. Create an organisation named **Paradiem** and a project named **planning** (pick the US East region, save the database password somewhere safe).
2. In the left sidebar open **SQL Editor → New query**. Paste the whole contents of `supabase/schema.sql` from this repository and click **Run**. It creates the two tables, the security rules that restrict everything to @paradiem.org accounts, and the private `documents` bucket.
3. Open **Authentication → Providers → Email**. Leave Email enabled. Turn **Confirm email** on (recommended) so only real inboxes can sign up.
4. Open **Project Settings → API**. Copy two values:
   - **Project URL** → this is `VITE_SUPABASE_URL`
   - **anon public** key → this is `VITE_SUPABASE_ANON_KEY` (safe to publish; the rules from step 2 do the protecting)
5. Later, under **Authentication → URL Configuration**, set **Site URL** to your Cloudflare Pages address from section 3 so password-reset links come back to the app.

## 2. Anthropic + Cloudflare Worker — document reading and drafting (15 min)

1. Go to https://console.anthropic.com, create an account, add a payment method, then **API Keys → Create Key**. Name it `planning-worker`. Copy it once; it is not shown again.
2. Go to https://dash.cloudflare.com and create a free account with your paradiem.org email.
3. On your computer, with Node.js installed, open a terminal in this repository:
   ```bash
   cd worker
   npx wrangler login              # opens a browser, approve
   npx wrangler secret put ANTHROPIC_KEY   # paste the key from step 1
   npx wrangler deploy
   ```
   The last command prints a URL like `https://planning-api-proxy.<name>.workers.dev`. That is `VITE_PROXY_URL`.
4. After section 3 gives you the app's address, edit `worker/wrangler.toml`, set `ALLOWED_ORIGINS` to that address, and run `npx wrangler deploy` again. Until then the Worker refuses calls from other sites.

## 3. Cloudflare Pages — hosting (10 min)

1. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**. Authorise GitHub and choose the `GavinMorel1/planning` repository. Private repositories are fine on the free plan.
2. Build settings: Framework preset **Vite**, build command `npm run build`, output directory `dist`, production branch `main`.
3. **Environment variables** (Production): add
   - `VITE_SUPABASE_URL` — from section 1
   - `VITE_SUPABASE_ANON_KEY` — from section 1
   - `VITE_PROXY_URL` — from section 2 (no trailing slash)
4. Click **Save and Deploy**. Your app lives at `https://<project>.pages.dev`. Add a custom domain later under the project's **Custom domains** tab (for example `planning.paradiem.org`).
5. Go back and finish section 1 step 5 and section 2 step 4 with this address.

Every push to `main` redeploys automatically.

## 4. First sign-in

Open the app, click **Create account** with your paradiem.org email, confirm the email, sign in. Everyone on the team does the same; everyone has the same access.

Then in **Settings** check the quarterly performance numbers, the tax constants, the fee schedule, and the team roster. They ship with the values from the September 2026 decks.

---

## Running locally

```bash
npm install
npm run dev          # http://localhost:5173 — Local mode unless .env exists
```
Create a `.env` file (never commit it) to point a local build at the real services:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_PROXY_URL=https://planning-api-proxy.<name>.workers.dev
```
For document reading during local development add `http://localhost:5173` to `ALLOWED_ORIGINS` in `wrangler.toml` temporarily.

## Backups

Settings → System → **Export JSON** downloads every family and setting. Documents themselves stay in Supabase Storage, which keeps daily backups on paid plans; on the free plan, download important files periodically.

## Costs

- Supabase free tier: 500 MB database, 1 GB storage. Enough for hundreds of families; documents are the thing that grows. Pro is $25/month when needed.
- Cloudflare Pages and Workers: free at this usage.
- Anthropic: pay per use. Reading a 40-page tax return costs roughly $0.50–1.00; drafting one goal page a few cents. Budget under $50/month for normal use.
