// Client-facing brand (Paradiem Print & Presentation Guidelines, Edition 01 · 2026).
// Used for exported decks and flow-chart images — NOT for the app UI.
export const BRAND = {
  navy: '171738', parchment: 'F4EFE4', cream: 'FAF7F2', gold: 'C9A84C',
  taupe: '8B7355', mist: 'B8B4AC', ink: '1C1713', forest: '4A7C59', oxblood: 'A8332F',
  white: 'FFFFFF',
  fontHead: 'Georgia', fontBody: 'Calibri',
}
export const hex = (k) => `#${BRAND[k]}`
// Flow-chart node colours by type (from the sample chart)
export const FLOW_COLORS = {
  couple: '4A7C59', individual: '171738', trust: 'C9A84C', irs: 'A8332F', charity: '8B7355', other: 'B8B4AC',
}
