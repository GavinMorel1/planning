# Paradiem Planning

Workspace for the Paradiem planning team: Family Capital Assessments, Family Capital Gap
Analyses, estate flow charts, document reading, planning-tool selection and priorities, all
done per family and exported as editable PowerPoint decks.

Same look and feel as the invest team's dashboard; client-facing output follows the Paradiem
Print & Presentation Guidelines (Georgia, Calibri, parchment, flat shapes).

- **Requirements and decisions:** `REQUIREMENTS.md`
- **Setup (Supabase, Cloudflare, Anthropic):** `docs/SETUP.md`
- **Reference decks and brand guide:** `reference/`

## Run

```bash
npm install
npm run dev
```

Without configuration the app runs in Local mode (data in your browser). See `docs/SETUP.md` to share data across the team and enable Claude.

## Layout

```
src/App.jsx            shell: sidebar, family selector, theme
src/tabs/*.jsx         one file per tab
src/lib/store.jsx      data layer (local or Supabase, same API)
src/lib/claude.js      document extraction, goal drafting, flow-chart drafting
src/lib/pptx.js        deck generator (Assessment + Gap Analysis)
src/lib/flow.js        estate flow-chart model, geometry, SVG/PNG export
src/lib/flowpptx.js    flow chart → native PowerPoint shapes + build animation
src/lib/flags.js       family situation flags → tool suggestions
src/data/tools.js      planning-tool library with fit rules and disqualifiers
src/data/defaults.js   roster, quarterly performance, tax constants, static slide copy
worker/                Cloudflare Worker that holds the Anthropic key
supabase/schema.sql    tables, policies, storage bucket
```
