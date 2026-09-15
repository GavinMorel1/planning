# Paradiem Planning Dashboard — Requirements

Gathered from the planning team (Gavin Morel) in September 2026. This file is the
source of truth for what the tool must do. Update it when decisions change.

## Purpose

Reduce the time the planning team spends building Family Capital Assessment and
Family Capital Gap Analysis presentations, estate flow charts, and cash-flow
summaries, and help the team pick, prioritise and justify planning tools for
each family. The system is **advocate-based**: every recommendation is written
against the family's own goals, intentions and 100-Year Vision.

## Design

- Same look as the invest team's dashboard (`richacarson/Dashboard`): navy/gold/
  parchment palette, DM Sans UI font, 240px left sidebar on desktop, drawer on
  mobile, dark/light themes, card-based layout. Built modular (not one file).
- **Client-facing output** (PPTX / PNG) follows the Paradiem Print & Presentation
  Guidelines: Georgia for headings, Calibri for body, parchment background, flat
  square-edged shapes, gold rules and eyebrows, Forest green / Oxblood red only on
  status figures. See `reference/brand/`.
- All users have the same access. Login is any `@paradiem.org` email.

## Tabs

1. **Desk** — cross-family queue: deadlines, missing documents, pending items.
2. **Families** — roster and family profile: household, tier, state, vision,
   goals & intentions, balance sheet, estate tax exemption used/available.
3. **Documents** — per-family checklist mirroring the Pipefile categories with
   status received / not applicable / missing, file upload, Claude reading of
   each document (parties, fiduciaries, key terms, dates, tax facts, flags).
4. **Assessment** — intake form for what comes out of the assessment
   conversation, then deck generation (under-$5M or over-$5M variant).
5. **Gap Analysis** — goals list, met/missed, observations, potential
   challenges, cost of inaction, recommended tools per goal, deck generation.
6. **Strategies** — the planning-tool library (six categories) with fit rules,
   disqualifiers, sequencing, prerequisites, experts. First draft written by
   Claude; the team corrects it over time.
7. **Priorities** — ranked plan for the active family. Tiers: Protect,
   Deadline-driven, Structural, Optimize, Legacy.
8. **Estate Flow** — free-form flow-chart editor: boxes anywhere, connectors
   between any anchor points, labels on connectors, free text anywhere, solid
   asset-flow lines, horizontal dashed timing separators (life / first death /
   second death). Goes into the Gap Analysis deck as **editable PowerPoint
   shapes** (and downloads as a single .pptx slide), with optional PowerPoint
   build animation configured in the tab. PNG/SVG exports remain. Current chart
   only. Numbering follows the **older spouse passing first**.
9. **Cashflow** — eMoney is the cash-flow engine; the tool reads exported eMoney
   reports and summarises them. (Sample export still to be provided.)
10. **Presentations** — generated decks per family, version history, PPTX.
11. **Calendar** — family-specific deadlines (QOF 180-day, 1031 windows, Roth
    conversion, annual exclusion gifts, QCDs, document review cadence).
12. **Research** — markdown memo library (same pattern as invest dashboard).
13. **Settings** — team roster, quarterly performance numbers, yearly tax
    constants, fee schedule, integration status, theme.

## Decisions log

| # | Topic | Decision |
|---|-------|----------|
| 1 | Under-$5M headline numbers | Manually entered from the assessment conversation via an intake page. Under-5M p7 = Over-5M p6 and is a fixed slide (firm-wide averages). |
| 2 | Income / Clarity / Protection tiles | From the assessment conversation (intake page). |
| 3 | Goals met vs missed | Planner judgement per goal, based on the client's stated goals and current plan. |
| 4 | Cost of inaction | No spreadsheet; planner enters the figure and note. Claude may suggest. |
| 5 | Dividend / Growth / Cash split | Planner judgement. |
| 6 | Riskalyze-style figures | Planner-entered fields (no Riskalyze licence). |
| 7 | Tax constants | Yearly editable table in Settings. |
| 8 | eMoney | Used for every function it offers; builds estate numbers but not the chart. Tool reads eMoney exports. |
| 9 | Documents | Uploaded directly into the tool. |
| 10 | Surveys | Planning team reviews and types the Goals & Intentions document; tool does not need survey answers. |
| 11 | Performance slides | Do NOT pull from invest dashboard. Quarterly form in Settings after audited results. Growth table gains year columns over time. |
| 12 | Flow-chart lines | Solid = asset flow. Horizontal dashed = timing separator (life, first death, second death). Rare semi-dashed when a flow must cross other lines. |
| 13 | Flow numbering | Older spouse passes first. |
| 14 | Proposed chart | Not needed; current chart only. |
| 15/16 | Tool rules | No written rules exist; Claude drafts fit rules and disqualifiers, team refines. |
| 17 | States | Families all over the US; state of residence is a profile field. |
| 18 | Fees | Per fee schedule (see below). Computed from net worth, planner may override, show "confirm with Compliance". |
| 19 | Team roster | Unchanged except Chris Callahan = Director of Relationship Management. Matthew Sullivan = Associate Advisor I. Domnic Davenport = Investment Planning Associate. |
| 21 | Case studies | Tool suggests by archetype; planner picks. |
| 22 | Deployment | Supabase project `khpddtxiyacrivlliwdw` (schema applied 14 Sep 2026). Hosting on GitHub Pages from the repo workflow. Cloudflare Worker still needed for Claude. |
| 27 | Access | Shared team passcode gate before login (SHA-256 in `src/lib/passcode.jsx`), then paradiem.org email login. |
| 23 | Claude API | Paradiem will add an Anthropic API key (held in the Cloudflare Worker). |
| 24 | Fonts | App uses the invest dashboard fonts (DM Sans). Exported decks use Georgia + Calibri. |
| 25 | Duplicate slides | Under-5M p7 vs p8 and p20 vs p21 are alternatives; planner picks one of each per deck. |
| 28 | Deck fidelity | Both decks are generated slide-for-slide from geometry and colours measured in the reference PDFs (`src/lib/brand.js` holds the measured palette; `src/lib/pptx.js` the per-slide layout). Light Two Kinds / Philosophy pages, navy Gap dividers, #EDECE7 footer strip. |
| 29 | Flow chart in PowerPoint | Native shapes (boxes, connectors with arrowheads, labels, dashed timing lines) via `src/lib/flowpptx.js`; entrance animation (Appear / Fade, on click or timed, by flow number or manual step numbers) written into the slide XML. |
| — | Tier | Planner chooses under/over $5M at family setup (known from the first conversation). |
| — | Estate tax exemption used | Read from uploaded Form 709 when present, otherwise planner entry. |

## Fee schedule (Aug 2026)

- Gap Analysis: 5 bps of net worth, one time, min $500, max $6,500.
- Blueprint year one: 20 bps of net worth per year billed monthly, min $500/mo, max $6,500/mo.
- Blueprint year two+: 10 bps, min $350/mo, max $4,500/mo.
- AUM: 1.50% to $1M; 1.25% to $5M; 1.00% to $10M; 0.75% to $30M; 0.50% above.
- Always show "Confirm current rates with Compliance before quoting."

## Document checklist (from Pipefile; not all required)

Wills · Revocable Trust and Amendments · Power of Attorney (General and
Healthcare) · Family Foundation · Pre-Nuptial and Post-Nuptial Agreements ·
Personal Financial Statement · Investment Account Statements · Social Security
Statements · Personal Tax Returns (previous two years) · Most Recent Gift Tax
Returns · Business Tax Returns (previous two years) · Financial Assessment
Survey · Family Assessment Survey · Family Information & Assumptions Survey ·
Family Constitution Documents · Conflict Resolution Guidelines · Insurance
Policies · Operating Agreements · Buy-Sell Agreements · Deeds.

## Deck inventory

### Family Capital Assessment (two variants)
Static: disclosures, framework, two kinds of return, process, philosophy, three
principles, owner's lens, buy-option cash strategy, blueprint scope, case
studies, team pages, path forward. Firm averages slide ("What the Numbers
Reveal", five columns) is fixed.
Family-specific (intake): names, date, Income/Clarity/Protection tiles
(under-5M), proposed ownership split, 5-year cash need, potential return and
yield, 6-month gain/loss range, fee, next-step variant.
Quarterly: dividend and growth performance tables.

### Family Capital Gap Analysis
Cover, disclosures, two kinds of return, process, "What you said you want",
Goals & Intentions list, gap summary (donut: total / met / missed, total cost of
inaction), one analysis page per goal (goal text, Observations, Potential
Challenges, optional Potential Cost of Inaction with amount + note), current
investment slides, balance sheet, estate tax information (per spouse: credit
used/available, GST used/available), estate flow chart, current plan analysis
(check / x list), gap summary again, "What's top of mind?", team, Blueprint
scope with fee, "Timeline and Next Steps" divider, first-year timeline (from the
family's calendar deadlines), Next Steps action plan (five standard steps,
editable per family in Presentations). New: recommended tools per goal with
priority tier and rationale.

## Estate flow chart conventions
Couple box green, trusts gold, individuals/heirs navy, IRS oxblood. Numbered
flows (1)…(n) in sequence. Dollar amounts on connectors and inside boxes. Two
horizontal dashed lines labelled with each spouse's passing.

## Pending inputs
- One eMoney export set for a test family.
- Balance-sheet Excel template.
- Blank copies of the three surveys and a sample Goals & Intentions document.
- Anthropic API key, Supabase project, Cloudflare account (Gavin, self-setup).
