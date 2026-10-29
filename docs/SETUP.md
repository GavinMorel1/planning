# Setting up Paradiem Planning

## Status (14 Sep 2026)

- **Supabase: DONE.** Project `khpddtxiyacrivlliwdw` holds the tables, security rules, activity log and the private `documents` bucket (applied as three migrations; `supabase/schema.sql` is the reference copy). The URL and publishable key are baked into the GitHub Pages workflow.
- **Passcode: DONE.** The site asks for the team passcode before anything loads, then for an email + password login (any email address). New accounts are confirmed automatically by a database trigger, so no confirmation email is needed even if the Supabase "Confirm email" toggle is on. Settings → System → Lock app forgets the passcode on a device. To change the passcode, replace the SHA-256 in `src/lib/passcode.jsx` (`printf 'newcode' | sha256sum`).
- **Keep-alive: DONE.** `.github/workflows/keep-supabase-awake.yml` touches the database daily so the free-tier project is never paused for inactivity (a paused project shows "Failed to fetch" at login; restore it from the Supabase dashboard if it ever happens). Upgrading Supabase to Pro removes the pausing entirely.
- **Hosting: GitHub Pages** via `.github/workflows/deploy-github-pages.yml` — see section 3b. Cloudflare Pages remains an option (section 3).
- **Claude Worker: CODE DONE, NOT YET DEPLOYED.** `worker/` is ready: it checks the Supabase login token, only answers `https://gavinmorel1.github.io`, rate-limits each user, and holds the Anthropic key. Document reading and drafting stay off until you do section 2 (create the Anthropic key, `npx wrangler deploy`, then add the GitHub secret `VITE_PROXY_URL` and re-run the Pages deploy).

Three services, all with free tiers. You need: a paradiem.org email, a credit card only for Anthropic (pay-as-you-go).

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

The Worker is a small program on Cloudflare that sits between the app and Anthropic. The Anthropic key lives only there. For every call it checks that the person is signed in to the app (it verifies their Supabase login token), that the call comes from our site, and that they are not sending too many requests. Details are in `worker/README.md`.

1. Go to https://console.anthropic.com, create an account, add a payment method, then **API Keys → Create Key**. Name it `planning-worker`. Copy it once; it is not shown again. (Optional but wise: under **Limits** set a monthly spend limit.)
2. Go to https://dash.cloudflare.com and create a free account with your paradiem.org email.
3. On your computer, with Node.js installed, open a terminal in this repository and log in to Cloudflare:
   ```bash
   cd worker
   npx wrangler login              # opens a browser, approve
   ```
4. Check the settings in `worker/wrangler.toml`. For the current setup nothing needs changing: `ALLOWED_ORIGINS` is `https://gavinmorel1.github.io` and `SUPABASE_URL` / `SUPABASE_ANON_KEY` point at the `khpddtxiyacrivlliwdw` project. Change them only if the site address or the Supabase project changes (no trailing slash or path in `ALLOWED_ORIGINS`; if you add a custom domain later, list both separated by a comma).
5. Store the Anthropic key as a secret. The command asks you to paste it; nothing is shown on screen:
   ```bash
   npx wrangler secret put ANTHROPIC_API_KEY     # paste the key from step 1, press Enter
   ```
   If wrangler asks whether to create the Worker first, answer yes.
6. Only if Supabase **Project Settings → JWT Keys** still shows the legacy "JWT secret" in use: also run `npx wrangler secret put SUPABASE_JWT_SECRET` and paste that secret. With Supabase's newer signing keys (the default for new projects) skip this; the Worker reads the public keys itself.
7. Deploy:
   ```bash
   npx wrangler deploy
   ```
   The last lines print a URL like `https://planning-api-proxy.<name>.workers.dev`. Copy it. That is `VITE_PROXY_URL`. (If wrangler complains about `[[ratelimits]]`, run `npm install -g wrangler@latest` or follow the comment in `wrangler.toml` to use the older `unsafe.bindings` form.)
8. Connect the app. On github.com open the repository → **Settings → Secrets and variables → Actions → New repository secret**. Name `VITE_PROXY_URL`, value the workers.dev URL with no trailing slash. Then open the **Actions** tab, choose **Deploy to GitHub Pages**, and click **Re-run all jobs** (the URL is baked in at build time, so a rebuild is required).
9. Test the Worker with curl. curl sends no `Origin`, and the Worker refuses that, so we pretend to be the site:
   ```bash
   URL=https://planning-api-proxy.<name>.workers.dev
   curl -s -H "Origin: https://gavinmorel1.github.io" $URL/health    # prints {"ok":true}
   curl -s -i -H "Origin: https://example.com" $URL/health | head -1  # HTTP/2 403 (other sites are refused)
   ```
   The real test is in the app: sign in, open a family, upload a document and use **Read with Claude**. If it fails, run `npx wrangler tail` (below) and retry; the log line shows `401` (login/token), `403` (origin), `429` (too many requests) or the status Anthropic returned.

Day to day:

- **Rotate the Anthropic key** (every few months, or immediately if it may have leaked): create a new key in the Anthropic console, run `npx wrangler secret put ANTHROPIC_API_KEY` from the `worker` folder and paste it (live at once, no redeploy), then delete the old key in the console.
- **See what is happening:** `npx wrangler tail` in the `worker` folder streams one line per request (who, status, milliseconds, tokens used). It never shows documents, prompts, tokens or the key.
- **Limits:** each signed-in user gets about 20 Claude calls per minute, requests over 25 MB are refused, and only the Claude models listed in `ALLOWED_MODELS` are accepted. Change them in `wrangler.toml`, then `npx wrangler deploy`.
- **Who can use it:** only people who can sign in to the app. Since anyone with an email can create an account behind the team passcode, treat the passcode as the gate and keep the Anthropic spend limit from step 1 in place.

## 3. Cloudflare Pages — hosting (10 min)

1. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**. Authorise GitHub and choose the `GavinMorel1/planning` repository. Private repositories are fine on the free plan.
2. Build settings: Framework preset **Vite**, build command `npm run build`, output directory `dist`, production branch `main`.
3. **Environment variables** (Production): add
   - `VITE_SUPABASE_URL` — from section 1
   - `VITE_SUPABASE_ANON_KEY` — from section 1
   - `VITE_PROXY_URL` — from section 2 (no trailing slash)
4. Click **Save and Deploy**. Your app lives at `https://<project>.pages.dev`. Add a custom domain later under the project's **Custom domains** tab (for example `planning.paradiem.org`).
5. Go back and finish section 1 step 5, and add this address to `ALLOWED_ORIGINS` in `worker/wrangler.toml` (section 2 step 4), then run `npx wrangler deploy` again.

Every push to `main` redeploys automatically.

## 3b. GitHub Pages — hosting (current setup, 5 min)

1. On github.com open the repository → **Settings → Pages**. Under *Build and deployment* set **Source: GitHub Actions**. (A private repository needs GitHub Pro or Team for Pages; if GitHub asks you to upgrade, either upgrade or use Cloudflare Pages in section 3.)
2. Open the **Actions** tab. The "Deploy to GitHub Pages" workflow runs on every push to `main` or `claude/upbeat-babbage-stmr4v`. If the first run failed because Pages was not enabled yet, open it and click **Re-run all jobs**.
3. The site is at **https://gavinmorel1.github.io/planning/**.
4. In Supabase: **Authentication → URL Configuration** → Site URL `https://gavinmorel1.github.io/planning/` and add the same to Redirect URLs, so password-reset emails come back to the app.
5. Optional repository secrets (Settings → Secrets and variables → Actions): `VITE_PROXY_URL` once the Worker from section 2 exists (re-run the deploy workflow after adding it; Settings → System then shows "Connected via Worker"). `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` only if you ever move to a different Supabase project.

## 4. First sign-in

Open the app, enter the team passcode, click **Create account** with any email address and a password, sign in. Everyone on the team does the same; everyone has the same access.

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
For document reading during local development set `ALLOW_LOCALHOST = "true"` in `worker/wrangler.toml` temporarily (it allows `http://localhost:5173` and `http://localhost:4173`) and run `npx wrangler deploy`; set it back to `"false"` afterwards. You must also be signed in to the app, because the Worker requires your login token.

## Backups

Settings → System → **Export JSON** downloads every family and setting. Documents themselves stay in Supabase Storage, which keeps daily backups on paid plans; on the free plan, download important files periodically.

## Costs

- Supabase free tier: 500 MB database, 1 GB storage. Enough for hundreds of families; documents are the thing that grows. Pro is $25/month when needed.
- Cloudflare Pages and Workers: free at this usage.
- Anthropic: pay per use. Reading a 40-page tax return costs roughly $0.50–1.00; drafting one goal page a few cents. Budget under $50/month for normal use.
