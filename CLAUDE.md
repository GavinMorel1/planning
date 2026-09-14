# Paradiem Planning — notes for Claude Code

- React 18 + Vite, inline styles with theme tokens `C` (src/lib/theme.js). Keep the invest dashboard look: navy/gold/parchment, DM Sans, 240px sidebar, cards with gold-tinted borders.
- Client-facing output (PPTX, flow-chart PNG) uses `src/lib/brand.js`: Georgia + Calibri, flat square-edged shapes, Forest/Oxblood only on status figures. Never rounded corners or gradients there.
- Data model lives in `src/lib/store.jsx` (`newFamily`). Add fields there first; every tab reads the active family via `useFamily()`.
- New planning tools go in `src/data/tools.js` with `triggers` (flags from `src/lib/flags.js`) and `goalKeys`.
- Claude calls go through `src/lib/claude.js` only, model `claude-opus-5`, structured outputs via `output_config.format`. Never put an API key in the bundle; the Worker in `worker/` holds it.
- Build: `npm run build`. Quick check: `npx vite preview` then open http://localhost:4173.
- REQUIREMENTS.md is the source of truth for scope and decisions; update it when the team changes a decision.
