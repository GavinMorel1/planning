// Client-facing palette. Values are the ones actually used in the reference decks
// (extracted from the PDF vector data), not the nominal brand-guide swatches.
export const BRAND = {
  // slide surfaces
  bg: 'FAFAF8', white: 'FFFFFF', tile: 'EDECE7', tile2: 'F2F0EB', tile3: 'F7F6F2', tileBorder: 'DDDCD8', rule: 'E8E7E2',
  // ink
  navy: '1A1E3A', navy2: '3A4070', ink: '1C1D32', text: '6A6A7A', caption: '9A9A8A', disc: '7A7A7A', creamText: 'EEE8D8',
  gold: 'C9A84C',
  // status (numbers and tags only)
  green: '2A6B3A', red: '993333', redBox: '8B3A3A', greenSoft: 'EBF2EC', redSoft: 'F5EDED', greenSoft2: 'F5FAF5', redSoft2: 'FFF5F5',
  greenBorder: '5A9B5A', redBorder: 'CC6666', greenBar: 'D0EDD0', redBar: 'EDD0D0', sage: '7A9B6E',
  // flow chart
  flowGreen: '4A7C59', flowNavy: '1A1E3A', flowGold: 'C9A84C', flowRed: '993333', black: '000000',
  // legacy names still referenced elsewhere
  parchment: 'F4EFE4', cream: 'FAF7F2', taupe: '8B7355', mist: 'B8B4AC', forest: '2A6B3A', oxblood: '993333',
  fontHead: 'Georgia', fontBody: 'Calibri',
}
export const hex = (k) => `#${BRAND[k]}`
export const FLOW_COLORS = { couple: '4A7C59', individual: '1A1E3A', trust: 'C9A84C', irs: '993333', charity: '8B7355', other: 'B8B4AC' }
