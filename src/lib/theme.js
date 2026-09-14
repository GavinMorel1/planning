// Theme tokens — identical to the invest dashboard so both apps look like one product.
export const DARK = {
  bg: '#171738', surface: '#1F1F45', card: '#252551', cardHover: '#2F2F5F', elevated: '#38386B',
  border: 'rgba(201,168,76,0.12)', borderHover: 'rgba(201,168,76,0.24)', borderActive: 'rgba(201,168,76,0.40)',
  t1: '#FAF7F2', t2: '#F4EFE4', t3: '#B8B4AC', t4: '#8B7355',
  up: '#34D399', upSoft: '#34D39920', upGlow: '#34D39940',
  dn: '#F87171', dnSoft: '#F8717120', dnGlow: '#F8717140',
  accent: '#C9A84C', accentSoft: 'rgba(201,168,76,0.12)', accentGlow: 'rgba(201,168,76,0.30)',
  warn: '#D9A441', info: '#8FA3D9',
  nav: '#171738', navText: '#FAF7F2', navTextDim: '#B8B4AC', navTextMuted: '#8B7355',
  navBorder: 'rgba(201,168,76,0.12)', navAccentSoft: 'rgba(201,168,76,0.14)',
  shadow: '0 2px 8px rgba(23,23,56,0.35)',
}
export const LIGHT = {
  bg: '#F4EFE4', surface: '#FAF7F2', card: '#FAF7F2', cardHover: '#EBE6DA', elevated: '#FAF7F2',
  border: 'rgba(139,115,85,0.18)', borderHover: 'rgba(139,115,85,0.30)', borderActive: 'rgba(139,115,85,0.50)',
  t1: '#171738', t2: '#1C1713', t3: '#8B7355', t4: '#B8B4AC',
  up: '#16A34A', upSoft: '#16A34A18', upGlow: '#16A34A30',
  dn: '#DC2626', dnSoft: '#DC262618', dnGlow: '#DC262630',
  accent: '#C9A84C', accentSoft: 'rgba(201,168,76,0.12)', accentGlow: 'rgba(201,168,76,0.24)',
  warn: '#B45309', info: '#2563EB',
  nav: '#171738', navText: '#FAF7F2', navTextDim: '#B8B4AC', navTextMuted: '#8B7355',
  navBorder: 'rgba(250,247,242,0.10)', navAccentSoft: 'rgba(201,168,76,0.18)',
  shadow: '0 1px 3px rgba(23,23,56,0.08), 0 1px 2px rgba(23,23,56,0.04)',
}
export const themeFor = (name) => (name === 'light' ? LIGHT : DARK)
