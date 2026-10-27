// Deck generator. Rebuilds the Family Capital Assessment and Family Capital Gap Analysis decks
// slide-for-slide from the reference presentations: every colour, font size and position below
// was measured from the reference PDFs (see REQUIREMENTS.md → deck inventory).
// Georgia headings, Calibri body, flat square-edged shapes, Forest/Oxblood only on status figures.
import PptxGenJS from 'pptxgenjs'
import { BRAND } from './brand'
import { COPY, DEFAULT_ROSTER } from '../data/defaults'
import { CASE_STUDIES } from '../data/caseStudies'
import { gapFee, blueprintMonthly, DEFAULT_FEE_SCHEDULE } from './fees'
import { fmtUsd, num } from './util'
import { TIERS, toolById, tierRank } from '../data/tools'
import { netWorthOf, totalAssets, ASSET_TYPES } from '../tabs/Families'
import { addFlowToSlide } from './flowpptx'

export const B = BRAND
export const H = 'Georgia', F = 'Calibri'
export const W = 10, HT = 5.625
export const LM = 0.55 // content left margin on header slides

// ───────────────────────── primitives ─────────────────────────
export async function asDataUrl(src) {
  if (!src) return null
  if (src.startsWith('data:')) return src
  try {
    const r = await fetch(/^https?:/.test(src) ? src : `${import.meta.env.BASE_URL || '/'}${src.replace(/^\//, '')}`)
    if (!r.ok) return null
    const b = await r.blob()
    return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b) })
  } catch { return null }
}
export const logoData = () => asDataUrl('deck/paradiem-logo-cover.png')
export async function imageDims(dataUrl) {
  try { const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl }); return { w: img.naturalWidth, h: img.naturalHeight } } catch { return null }
}
// Headshot: the person's own photo, else the shipped one for that name.
export async function loadHeadshots(roster) {
  return Promise.all((roster || []).map(async (p) => {
    const src = p.photo || DEFAULT_ROSTER.find((d) => d.name === p.name)?.photo
    const data = await asDataUrl(src); if (!data) return null
    const dims = await imageDims(data); return dims ? { data, ...dims } : null
  }))
}
export const rect = (s, pptx, x, y, w, h, fill, line) => s.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: fill ? { color: fill } : { type: 'none' }, line: line ? { color: line.color, width: line.width ?? 0.75 } : { color: fill || B.bg, width: 0 } })
export const hline = (s, pptx, x, y, w, color, width = 1) => s.addShape(pptx.ShapeType.line, { x, y, w, h: 0, line: { color, width } })
export const vline = (s, pptx, x, y, h, color, width = 1) => s.addShape(pptx.ShapeType.line, { x, y, w: 0, h, line: { color, width } })
export const text = (s, t, o) => s.addText(t, { margin: 0, valign: 'top', ...o })
export const georgia = (s, t, o) => text(s, t, { fontFace: H, color: B.navy, ...o })
export const calibri = (s, t, o) => text(s, t, { fontFace: F, color: B.text, ...o })
// T: single line placed by the top of its text box, exactly as measured in the reference decks (inches, pt).
export const T = (s, str, x, y, w, o = {}) => s.addText(str, { x, y: y - 0.03, w, h: ((o.fontSize || 12) * 1.25) / 72, margin: 0, valign: 'top', wrap: false, fontFace: F, color: B.text, ...o })
export const eyebrow = (s, t, o) => text(s, String(t || '').toUpperCase(), { fontFace: F, fontSize: 11, color: B.gold, charSpacing: 3, ...o })
export const arrow = (s, pptx, x, y, up, size = 0.19, outline) => s.addShape(up ? pptx.ShapeType.upArrow : pptx.ShapeType.downArrow, { x, y, w: size, h: size, fill: { color: up ? B.green : B.red }, line: outline ? { color: outline, width: 1 } : { color: up ? B.green : B.red, width: 0 } })

// Footer strip. The reference decks use four footer styles depending on the page:
//   lg  9pt on Assessment content pages          sm  5.3pt on cover, team and Gap pages
//   md  6.7pt with a gold top rule (Owner's Lens) x7  7pt on the later investment pages
// `kit.outlines` reproduces the thin black outline the source decks carry on the lg / x7 strip.
export const kit = { footer: 'lg', outlines: true }
const FOOT = {
  lg: { y: 5.20, h: 0.43, fill: B.tile, size: 9, color: B.caption, cs: 2.1, x: 0.40, xr: 9.60, outline: true },
  sm: { y: 5.25, h: 0.38, fill: B.tile, size: 5.3, color: B.caption, cs: 1.1, x: 0.34, xr: 9.66 },
  md: { y: 5.21, h: 0.41, fill: 'ECEAE3', size: 6.7, color: '8A8A82', cs: 1.7, x: 0.52, xr: 9.46, line: 'C0A24C' },
  x7: { y: 5.20, h: 0.43, fill: B.tile, size: 7, color: '888880', cs: 2.2, x: 0.40, xr: 9.62, outline: true },
}
export function footer(s, pptx, { size = kit.footer, left, color } = {}) {
  const v = FOOT[size] || FOOT.lg
  if (v.outline && kit.outlines) rect(s, pptx, 0, v.y, W, v.h, v.fill, { color: '000000', width: 1 })
  else rect(s, pptx, 0, v.y, W, v.h, v.fill)
  if (v.line) hline(s, pptx, 0, v.y, W, v.line, 0.75)
  const col = color || v.color
  const t = (str, o) => s.addText(str, { y: v.y, h: v.h, fontFace: F, fontSize: v.size, color: col, charSpacing: v.cs, margin: 0, valign: 'middle', wrap: false, ...o })
  t(left || COPY.footerLeft, { x: v.x, w: 5 })
  t(COPY.footerRight, { x: 4.6, w: v.xr - 4.6, align: 'right' })
}
export const INVEST_FOOT = 'PARADIEM  |  FAMILY CAPITAL INVESTMENT'
// `kit.next` lets a caller override the next slide's background / footer without changing every slide function.
export function base(pptx, { bg = B.bg, bar = true, foot = true, navy = false, footSize, footLeft } = {}) {
  const ov = kit.next || {}; kit.next = null
  const s = pptx.addSlide()
  const bgc = ov.bg || bg
  s.background = { color: navy ? B.navy : bgc }
  if ((ov.bar ?? bar) && !navy) rect(s, pptx, 0, 0.41, 0.06, 4.27, B.navy)
  if (ov.foot === false) foot = false
  if (foot) footer(s, pptx, { size: ov.footSize || footSize || kit.footer, left: ov.footLeft || footLeft })
  return s
}
// Standard content header: gold eyebrow, Georgia 26 title, rule (short gold or full-width light)
export function header(s, pptx, eb, title, { rule = 'gold', x = LM, sub, titleSize = 26, ebSize = 11.5 } = {}) {
  if (eb) eyebrow(s, eb, { x, y: 0.24, w: 9, h: 0.24, fontSize: ebSize })
  georgia(s, title, { x, y: 0.40, w: 9.2, h: 0.55, fontSize: titleSize, valign: 'middle' })
  if (rule === 'gold') hline(s, pptx, x, 1.28, 1.2, B.gold, 1.5)
  else if (rule === 'full') hline(s, pptx, x, 1.28, 9.0, B.rule, 1)
  if (sub) calibri(s, sub, { x, y: 1.42, w: 9, h: 0.3, fontSize: 10.5, italic: true })
}
export function chunk(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out }
export const fmtPctCell = (v) => (v == null || v === '' ? '—' : `${Number(v).toFixed(2)}%`)
export const shortName = (f) => (f?.name || '').replace(/^The /, '').replace(/ Family$/, '')
export const paras = (arr, o = {}) => (arr || []).map((t, i) => ({ text: t, options: { breakLine: i < arr.length - 1, ...o } }))
// Rough line count for a bullet paragraph at a given Calibri size inside a given width (inches)
export const linesFor = (t, size, w) => Math.max(1, Math.ceil(String(t || '').length / Math.max(20, Math.floor((w * 72) / (size * 0.47)))))

// ───────────────────────── shared slides ─────────────────────────
export function cover(pptx, logo, title, coupleLabel, date) {
  const s = base(pptx, { bar: false, foot: false })
  rect(s, pptx, 0, 0.41, 0.06, 4.27, B.navy)
  footer(s, pptx, { size: 'sm' })
  if (logo) s.addImage({ data: logo, x: 7.07, y: 0.14, w: 2.73, h: 0.75 })
  T(s, title, 0.45, 0.89, 8, { fontFace: H, fontSize: 36.7, color: B.navy })
  T(s, coupleLabel || 'Mr. and Mrs. ________', 0.45, 2.29, 8.5, { fontFace: H, fontSize: 36.7, color: B.navy })
  hline(s, pptx, 0.45, 3.07, 1.16, B.gold, 2.5)
  T(s, COPY.tagline, 0.45, 3.23, 8, { fontSize: 18, color: B.text })
  T(s, date || '', 0.45, 4.24, 6, { fontFace: H, fontSize: 24, color: B.navy })
}
export function disclosures(pptx) {
  const s = base(pptx, { bar: false })
  header(s, pptx, 'Disclosures', 'Legal Disclosures & Important Information', { rule: 'none' })
  hline(s, pptx, LM, 1.04, 1.0, B.gold, 1.5)
  s.addText(paras(COPY.disclosures, { paraSpaceAfter: 9 }), { x: LM, y: 1.23, w: 9.0, h: 3.9, margin: 0, valign: 'top', fontFace: F, fontSize: 9.5, color: B.text, lineSpacing: 12.4 })
}
export function framework(pptx, { tiles = true } = {}) {
  const s = base(pptx, { bar: false })
  header(s, pptx, 'The Framework', 'Family Capital Architecture')
  calibri(s, 'We identify the gap between:', { x: LM, y: 1.62, w: 4.4, h: 0.28, fontSize: 11, italic: true, color: B.navy })
  const rows = [['What your wealth is doing today', 'Present state'], ['What it was designed to accomplish', 'Intent'], ['How it will impact your family across generations', 'Legacy horizon']]
  rows.forEach(([a, b], i) => {
    const y = 2.02 + i * 0.68
    rect(s, pptx, LM, y, 0.05, 0.38, B.navy)
    georgia(s, a, { x: LM + 0.17, y: y - 0.05, w: 4.45, h: 0.3, fontSize: 14, valign: 'middle' })
    eyebrow(s, b, { x: LM + 0.17, y: y + 0.22, w: 4.4, h: 0.2, fontSize: 11 })
  })
  if (tiles) {
    const items = [['Hidden Tax Exposure', 'Unrealized tax liabilities that erode generational value'], ['Structural Inefficiencies', 'Disconnected advisors, misaligned strategies'], ['Misaligned Capital', 'Assets not deployed toward your actual intentions'], ['Cost of Inaction', 'What does staying where you are actually cost you?']]
    items.forEach(([t, d], i) => {
      const x = [5.20, 7.55][i % 2], y = [1.50, 3.02][Math.floor(i / 2)]
      rect(s, pptx, x, y, 2.20, 1.35, B.tile, { color: B.tileBorder, width: 0.75 })
      rect(s, pptx, x, y, 2.20, 0.05, B.navy)
      georgia(s, t, { x: x + 0.15, y: y + 0.15, w: 1.95, h: 0.3, fontSize: 12.5, valign: 'middle' })
      calibri(s, d, { x: x + 0.15, y: y + 0.55, w: 1.95, h: 0.7, fontSize: 9.5, lineSpacingMultiple: 1.2 })
    })
  }
}
export function twoKinds(pptx) {
  const s = base(pptx, { bar: false })
  rect(s, pptx, 0, 0, 4.60, 5.18, B.tile2, { color: B.navy, width: 0.75 })
  eyebrow(s, 'Investment philosophy', { x: 0.28, y: 0.2, w: 4, h: 0.24, fontSize: 10 })
  georgia(s, 'Two Kinds\nof Return', { x: 0.28, y: 0.48, w: 4, h: 1.15, fontSize: 28, lineSpacingMultiple: 1.1 })
  rect(s, pptx, 0.28, 1.72, 3.90, 1.00, B.tile, { color: B.tileBorder, width: 0.75 })
  eyebrow(s, 'Return on investment', { x: 0.42, y: 1.80, w: 3.6, h: 0.2, fontSize: 9 })
  georgia(s, 'Preparing the Money for the Family', { x: 0.42, y: 2.05, w: 3.6, h: 0.28, fontSize: 13 })
  calibri(s, 'Most advisors stop here.', { x: 0.42, y: 2.37, w: 3.6, h: 0.25, fontSize: 10 })
  rect(s, pptx, 0.28, 2.88, 3.90, 1.12, B.navy)
  eyebrow(s, 'Return on intention', { x: 0.42, y: 2.98, w: 3.6, h: 0.2, fontSize: 9 })
  georgia(s, 'Preparing the Family for the Money', { x: 0.42, y: 3.25, w: 3.6, h: 0.28, fontSize: 13, color: B.white })
  calibri(s, 'Where we go further.', { x: 0.42, y: 3.57, w: 3.6, h: 0.25, fontSize: 10, color: B.creamText })
  georgia(s, 'You can have strong returns...', { x: 5.00, y: 1.53, w: 4.8, h: 0.4, fontSize: 20 })
  georgia(s, 'and still fail your family long-term.', { x: 5.00, y: 1.96, w: 4.8, h: 0.4, fontSize: 20 })
  hline(s, pptx, 5.00, 2.72, 3.5, B.navy, 1)
}
export function processSlide(pptx, current) {
  const s = base(pptx, { bar: false })
  header(s, pptx, 'Our Process', 'Family Capital Architecture', { rule: 'none' })
  s.addShape(pptx.ShapeType.line, { x: 0.45, y: 1.355, w: 9.10, h: 0, line: { color: B.gold, width: 2.5, endArrowType: 'triangle' } })
  vline(s, pptx, 3.45, 1.10, 0.48, B.gold, 2); vline(s, pptx, 6.63, 1.13, 0.48, B.gold, 2)
  const steps = [['01', ['Family Capital', 'Assessment'], current === 1 ? "Today's session — mapping the current state of your family and capital." : 'Mapping the current state of your family and capital.'], ['02', ['Family Capital', 'Gap Analysis'], current === 2 ? "Today's session — the deep diagnostic identifying gaps between where you are and where you should be." : 'Deep diagnostic identifying gaps between where you are and where you should be.'], ['03', ['Family Capital', 'Blueprint'], 'Your comprehensive multi-generational wealth and legacy roadmap.']]
  steps.forEach(([n, t, d], i) => {
    const x = [0.45, 3.60, 6.75][i], y = 1.58, w = 2.90, h = 3.28, active = current === i + 1, tx = x + 0.20
    rect(s, pptx, x, y, w, h, active ? B.bg : B.tile2, { color: active ? B.navy : B.tileBorder, width: 0.5 })
    rect(s, pptx, x, y, w, 0.06, B.navy)
    T(s, n, tx, 1.78, 1, { fontFace: H, fontSize: 24, color: B.navy })
    T(s, t[0], tx, 2.36, 2.6, { fontFace: H, fontSize: 13, color: B.navy }); T(s, t[1], tx, 2.63, 2.6, { fontFace: H, fontSize: 13, color: B.navy })
    hline(s, pptx, tx, 2.98, 2.5, B.rule, 0.4)
    s.addText(d, { x: tx, y: 3.01, w: 2.5, h: 1.1, margin: 0, valign: 'middle', fontFace: F, fontSize: 11, color: B.text, lineSpacing: 18.4 })
    const tag = active ? 'Today' : i + 1 < current ? 'Previous' : i === 1 ? 'Potential next step' : 'The outcome'
    T(s, tag.toUpperCase(), tx, 4.41, 2.6, { fontSize: 10.6, color: B.gold, charSpacing: 2.6 })
  })
}
export function numbersHeader(s, familyName) {
  eyebrow(s, 'What the numbers reveal', { x: 0.55, y: 0.16, w: 6, h: 0.22 })
  georgia(s, `${shortName({ name: familyName }) ? shortName({ name: familyName }) + ' ' : ''}Family Capital Assessment`, { x: 0.55, y: 0.35, w: 9, h: 0.5, fontSize: 26, valign: 'middle' })
}
export function numbersReveal(pptx, settings, familyName, a = {}, nw = 0) {
  const s = base(pptx, { bar: false, foot: false })
  numbersHeader(s, familyName)
  georgia(s, "Average results from serving 100's of families over 40+ years.", { x: 0.65, y: 0.78, w: 8, h: 0.3, fontSize: 15, italic: true })
  const fa = settings.firmAverages
  const cols = [fa.generosity, fa.estateTax, fa.lifetime, fa.failure, fa.performance]
  cols.forEach((c, i) => {
    const x = [0.55, 2.28, 4.04, 5.86, 7.65][i], y = 1.04, w = 1.58, h = 3.55
    const bad = i === 3
    rect(s, pptx, x, y, w, h, B.tile)
    rect(s, pptx, x, y, 0.05, h, bad ? B.red : B.navy)
    georgia(s, c.pct, { x: x + 0.15, y: y + 0.45, w: w - 0.2, h: 0.55, fontSize: 28, color: bad ? B.red : B.navy, valign: 'middle' })
    georgia(s, c.label, { x: x + 0.15, y: y + 1.1, w: w - 0.18, h: 0.65, fontSize: 10, lineSpacingMultiple: 1.25 })
    if (c.footnote) calibri(s, c.footnote, { x: x + 0.15, y: y + 1.78, w: w - 0.18, h: 0.25, fontSize: 8 })
    const key = ['nGenerosity', 'nEstateTax', 'nLifetime', 'nFailure', 'nPerformance'][i], pc = parseFloat(String(c.pct).replace('%', '')) || 0
    const given = a[key] !== '' && a[key] != null && !isNaN(Number(String(a[key]).replace(/[$,]/g, ''))) ? num(a[key]) : null
    const calc = nw && (key === 'nLifetime' || key === 'nFailure') ? Math.round(pc / 100 * nw) : null
    const amt = given != null ? fmtUsd(given) : calc != null ? fmtUsd(calc) : '$—'
    calibri(s, amt, { x: x + 0.1, y: 4.22, w: w - 0.42, h: 0.3, fontSize: 15, bold: true, color: B.navy2, valign: 'middle' })
    arrow(s, pptx, x + w - 0.3, 4.28, c.dir !== 'down')
  })
  calibri(s, `${COPY.hypothetical} ${COPY.firmAveragesFootnote}`, { x: 0.1, y: 4.72, w: 9.8, h: 0.85, fontSize: 6.5, color: B.caption, charSpacing: 2, lineSpacingMultiple: 1.15 })
}
export const NUM_LINES = ['The information presented is hypothetical and for illustrative purposes only. It is based on assumptions, estimates, and inputs provided or derived', 'from current information, all of which are subject to change. These projections do not reflect actual investment results and are not guarantees of', 'future performance or outcomes. Actual results will vary and may differ materially based on market conditions, investment decisions, tax law', 'changes, and other factors. This analysis is intended to support discussion and planning and should not', 'be relied upon as a prediction of future results or as a recommendation to take any specific action.']
export function numFootnote(s, extra) {
  const lines = extra ? [...NUM_LINES.slice(0, 4), NUM_LINES[4].replace(/action\.$/, 'action. ') + extra[0], extra[1]] : NUM_LINES
  s.addText(lines.map((t, i) => ({ text: t, options: { breakLine: i < lines.length - 1 } })), { x: 0.08, y: 4.76 - 0.03, w: 9.85, h: 0.75, margin: 0, valign: 'top', wrap: false, fontFace: F, fontSize: 7, color: B.caption, charSpacing: 2.05, lineSpacing: 8.4 })
}
export function incomeClarity(pptx, a, familyName) {
  const s = base(pptx, { bar: false, foot: false })
  numbersHeader(s, familyName)
  const incAmt = a.incomeAmount || a.incomeMonthly, incUnit = a.incomeAmount ? (a.incomeUnit === '/ mo' ? 'per month' : 'per year') : 'per month'
  const cols = [
    ['Income', incAmt ? fmtUsd(incAmt) : '$—', incUnit, ['Income, paid monthly and rising with', 'inflation'], 1.33, 3.07],
    ['Clarity', a.clarityNetWorth ? fmtUsd(a.clarityNetWorth) : '$—', 'net worth', ['Cash Flow, Assets, & Growth Projections', 'all coordinated into one clear picture'], 1.38, 3.12],
    ['Protection', a.protectionPct || '100%', 'of your wishes', ['Your wishes documented, your family', 'cared for – and someone in your corner', 'for the things you’d never think to ask.'], 1.44, 3.15]]
  cols.forEach(([t, big, unit, d, ty, dy], i) => {
    const x = [0.55, 3.48, 6.40][i], y = 1.09, w = 2.77, h = 3.19
    rect(s, pptx, x, y, w, h, B.tile); rect(s, pptx, x, y, 0.07, h, '1B2A4A')
    const tw = t.length * 0.2 * (28 / 28)
    T(s, t, x + w / 2 - tw / 2 + 0.03, ty, 2.4, { fontFace: H, fontSize: 28, color: '1A1E3A' })
    const full = String(big).length * 0.21 + unit.length * 0.09 + 0.1, bx = x + (full > 2.45 ? 0.1 : 0.24)
    s.addText([{ text: String(big), options: { fontSize: 24.7 } }, { text: ` ${unit}`, options: { fontSize: i === 0 ? 14 : 12 } }], { x: bx, y: 2.33 - 0.03, w: 2.75, h: 0.5, margin: 0, valign: 'top', wrap: false, fontFace: H, color: '1B2A4A' })
    s.addText(d.map((ln, k) => ({ text: ln, options: { breakLine: k < d.length - 1 } })), { x: x + 0.25, y: dy - 0.03, w: 2.45, h: 0.8, margin: 0, valign: 'top', wrap: false, fontFace: F, fontSize: 10.6, color: '3A3A38', lineSpacing: 14 })
  })
  numFootnote(s)
}
export function philosophy(pptx) {
  const s = base(pptx, { bar: false, footLeft: INVEST_FOOT })
  header(s, pptx, 'Investment philosophy', 'Family Capital Investment')
  ;["We don't INVEST.", 'We INTENTIONALLY OWN', 'EXCELLENT COMPANIES.'].forEach((t, i) => T(s, t, LM, [1.83, 2.24, 2.66][i], 8, { fontFace: H, fontSize: 17, color: B.navy }))
  hline(s, pptx, LM, 3.60, 1.2, B.gold, 1.5)
  s.addText([{ text: 'The distinction matters. Investors react to markets. Owners build', options: { breakLine: true } }, { text: 'enduring value with conviction.' }], { x: LM, y: 3.90 - 0.03, w: 5, h: 0.6, margin: 0, valign: 'top', wrap: false, fontFace: F, fontSize: 12, color: B.text, lineSpacing: 20.9 })
}
export function principles(pptx, order = 'over5') {
  const s = base(pptx, { bar: false, footLeft: INVEST_FOOT })
  header(s, pptx, 'The three principles', '3 Principles of Family Capital Investment')
  const cols = [['01', ['Think Like', 'an Owner'], 'Excellence evaluation', [['Innovation', ['Creating products/services that benefit', 'consumers?']], ['Inspiration', ['Driven by legacy purpose contributing to human', 'flourishing?']], ['Infrastructure', ['Solid foundation of sound business practices and', 'structure?']]]],
    ['02', ['Simplicity Over', 'Complexity'], 'Our ownership strategies', [['25 Stock Dividend Strategy', ['Income-focused ownership of 25 high-quality', 'companies.']], ['25 Stock Growth Strategy', ['Growth-focused ownership of 25 high-conviction', 'companies.']], ['Research-backed', ['Quality over quantity — conviction over', 'diversification.']]]],
    ['03', ['Research Reveals', 'Opportunities'], 'Conviction-based decisions', [['Deep Analysis', ['Fundamental research uncovers businesses', 'others may overlook.']], ['Un-Common Sense', ['Current economic environments guide decisions', 'and allocations.']], ['Clear Entry/Exit', ['Defined criteria for when to act — and when to', 'hold.']]]]]
  if (order === 'under5') { const r = [cols[0], cols[2], cols[1]]; r.forEach((c, i) => { c[0] = `0${i + 1}` }); cols.splice(0, 3, ...r) }
  cols.forEach(([n, t, e, items], i) => {
    const x = [0.45, 3.63, 6.81][i], y = 1.58, w = 2.95, h = 3.28, tx = x + 0.18
    rect(s, pptx, x, y, w, h, i === 0 ? B.bg : B.tile2, { color: B.tileBorder, width: 0.5 })
    rect(s, pptx, x, y, w, 0.06, B.navy)
    T(s, n, tx, 1.79, 1, { fontFace: H, fontSize: 20, color: B.navy })
    T(s, t[0], tx, 2.29, 2.6, { fontFace: H, fontSize: 14.1, color: B.navy }); T(s, t[1], tx, 2.59, 2.6, { fontFace: H, fontSize: 14, color: B.navy })
    hline(s, pptx, tx, 2.90, 2.55, B.rule, 0.4)
    T(s, e.toUpperCase(), tx, 3.03, 2.6, { fontSize: 10, color: B.gold, charSpacing: 2.2 })
    items.forEach(([a1, b1], k) => {
      const yy = 3.25 + k * 0.54, quirk = a1 === 'Research-backed'
      T(s, a1, tx, yy + (quirk ? 0.01 : 0), 2.6, { fontSize: quirk ? 8.5 : 10, bold: true, color: B.navy })
      s.addText(b1.map((ln, q) => ({ text: ln, options: { breakLine: q < b1.length - 1 } })), { x: tx, y: yy + 0.14, w: 2.7, h: 0.4, margin: 0, valign: 'top', wrap: false, fontFace: F, fontSize: 9, color: B.text, lineSpacing: 13 })
    })
  })
}
export function ownersLens(pptx, sc = {}) {
  const s = pptx.addSlide(); s.background = { color: B.white }
  footer(s, pptx, { size: 'md', left: INVEST_FOOT })
  eyebrow(s, 'Think like an owner', { x: LM, y: 0.38, w: 6, h: 0.22, fontSize: 10, bold: true })
  georgia(s, "An Owner's Lens", { x: LM, y: 0.62, w: 8, h: 0.6, fontSize: 28.6, bold: true, valign: 'middle' })
  hline(s, pptx, LM, 1.28, 1.0, B.gold, 1.5)
  calibri(s, 'Every business you own, evaluated on the three questions a true owner asks.', { x: LM, y: 1.42, w: 8, h: 0.28, fontSize: 11, italic: true })
  const items = [['Innovation', 'Creating products and services that benefit consumers?', sc.innovation, sc.innovationNote || 'Holdings broadly serve growing, real-world demand.'], ['Inspiration', 'Driven by long-term vision, not distracted by the issue of the day?', sc.inspiration, sc.inspirationNote || 'A meaningful share carry exposure to activities facing long-term structural headwinds.'], ['Infrastructure', 'Built on a solid foundation of sound business practices and structure?', sc.infrastructure, sc.infrastructureNote || 'Most holdings rest on durable balance sheets and disciplined governance.']]
  items.forEach(([t, q, score, note], i) => {
    const x = [0.55, 3.63, 6.71][i], y = 2.05, w = 2.75, h = 2.55
    rect(s, pptx, x, y, w, h, 'FBFAF6', { color: 'E7E3D8', width: 0.75 })
    rect(s, pptx, x, y, w, 0.06, '1A2340')
    georgia(s, t, { x: x + 0.2, y: y + 0.18, w: w - 0.4, h: 0.35, fontSize: 15.7, bold: true, valign: 'middle' })
    calibri(s, q, { x: x + 0.2, y: y + 0.55, w: w - 0.4, h: 0.5, fontSize: 8.5, italic: true, lineSpacingMultiple: 1.2 })
    const v = num(score)
    s.addText([{ text: score ? String(score) : '—', options: { fontFace: H, fontSize: 28.6, bold: true, color: B.navy } }, { text: ' / 10', options: { fontFace: F, fontSize: 10, color: B.gold, bold: true } }], { x: x + 0.2, y: y + 1.12, w: w - 0.4, h: 0.5, margin: 0, valign: 'middle' })
    rect(s, pptx, x + 0.2, y + 1.68, w - 0.4, 0.1, 'EFE7E2')
    if (v > 0) rect(s, pptx, x + 0.2, y + 1.68, (w - 0.4) * Math.min(1, v / 10), 0.1, 'C0A24C')
    calibri(s, note, { x: x + 0.2, y: y + 1.9, w: w - 0.4, h: 0.55, fontSize: 8.5, lineSpacingMultiple: 1.2 })
  })
  calibri(s, 'Illustrative scorecard for discussion. Each holding is scored across the three ownership criteria; figures shown are representative.', { x: LM, y: 4.88, w: 9, h: 0.25, fontSize: 7, italic: true })
}
export function perfTable(pptx, sleeve, perf) {
  const p = perf?.[sleeve]; if (!p) return
  if (!p.calendar) return perfSingle(pptx, p, perf)
  const s = pptx.addSlide(); s.background = { color: B.white }
  if (p.calendar) footer(s, pptx, { size: 'sm' })
  georgia(s, p.name + (p.calendar ? ' & Calendar Year Returns' : ''), { x: 0.35, y: 0.14, w: 9, h: 0.45, fontSize: 18, valign: 'middle' })
  hline(s, pptx, 0.35, 0.66, 0.9, B.gold, 1.5)
  const asOf = perf.asOf ? new Date(`${perf.asOf}T00:00:00`).toLocaleDateString('en-US') : ''
  const single = !p.calendar
  const rowH = single ? 0.46 : 0.30
  const block = (b, title, y, withAsOf) => {
    if (!b) return y
    const cols = b.columns, n = cols.length
    const x0 = 2.75, cw = (9.65 - x0) / n
    eyebrow(s, `${title}${withAsOf && asOf ? ` (as of ${asOf})` : ''}`, { x: 0.35, y, w: 9, h: 0.2, fontSize: 9, color: B.text, charSpacing: 3 })
    y += single ? 0.34 : 0.2
    cols.forEach((c, k) => calibri(s, String(c).toUpperCase(), { x: x0 + k * cw, y, w: cw, h: 0.2, fontSize: 8, charSpacing: 2, align: 'center', valign: 'middle' }))
    y += single ? 0.32 : 0.22
    hline(s, pptx, 0.35, y, 9.3, B.rule, 0.75)
    const rowsDef = [['Gross', b.gross, 'gross'], ['Net', b.net, 'net'], ...p.benchmarks.map((bm) => [bm.label, b[bm.key], 'bm'])]
    rowsDef.forEach(([lab, vals, kind]) => {
      const h = kind === 'bm' ? rowH + 0.05 : rowH
      if (kind === 'net') rect(s, pptx, 0.35, y + 0.02, 9.3, h - 0.04, B.tile, { color: B.navy, width: 1 })
      calibri(s, kind === 'bm' ? lab : lab.toUpperCase(), { x: 0.45, y, w: 2.2, h, fontSize: kind === 'bm' ? 8 : 7.5, charSpacing: kind === 'bm' ? 1 : 2, color: kind === 'net' ? B.gold : B.text, valign: 'middle', lineSpacingMultiple: 1.1 })
      cols.forEach((_, k) => {
        const v = vals?.[k]
        georgia(s, fmtPctCell(v), { x: x0 + k * cw, y, w: cw, h, fontSize: 10.6, align: 'center', valign: 'middle', color: v != null && Number(v) < 0 ? B.red : kind === 'gross' ? B.navy : kind === 'net' ? B.gold : B.text })
      })
      y += h
      if (kind !== 'net') hline(s, pptx, 0.35, y, 9.3, B.rule, 0.75)
    })
    hline(s, pptx, 0.35, y + 0.02, 9.3, B.gold, 1.5)
    return y + 0.16
  }
  let y = single ? 1.05 : 0.80
  y = block(p.annualized, single ? 'Returns' : 'Annualised returns', y, true)
  y = block(p.calendar, `Calendar year returns — past ${p.calendar?.columns?.length || 5} years`, y, false)
  const dy = Math.max(y + 0.12, single ? 4.55 : 4.35)
  calibri(s, p.disclosure, { x: 0.35, y: dy, w: 9.3, h: Math.max(0.4, HT - 0.42 - dy), fontSize: 6.3, lineSpacingMultiple: 1.05 })
}
export function proposedOwnership(pptx, a, familyName) {
  const s = base(pptx, { bar: false, footLeft: INVEST_FOOT })
  const short = shortName({ name: familyName })
  header(s, pptx, `${short} Family Ownership`, `${short} Family Proposed Ownership`, { x: 0.45 })
  const total = num(a.portfolioTotal)
  const rows = [['Dividends', 'Paradiem Dividend Strategy', num(a.dividendPct), B.navy], ['Growth', 'Paradiem Growth Strategy', num(a.growthPct), B.sage], ['Cash', 'Cash', num(a.cashPct), B.text]]
  eyebrow(s, 'Portfolio composition', { x: 0.45, y: 1.62, w: 4, h: 0.22, fontSize: 10 })
  const sum = rows.reduce((t, r) => t + r[2], 0) || 100
  let bx = 0.45
  rows.forEach(([, , pct, col]) => { const w = 3.85 * (pct / sum); if (w > 0) rect(s, pptx, bx, 1.90, w, 0.55, col); bx += w })
  rows.forEach(([n, , pct, col], i) => {
    const y = 2.62 + i * 0.6
    rect(s, pptx, 0.45, y + 0.04, 0.18, 0.18, col)
    georgia(s, n, { x: 0.75, y, w: 2, h: 0.28, fontSize: 12, valign: 'middle' })
    calibri(s, `${pct.toFixed(1)}%`, { x: 0.75, y: y + 0.3, w: 0.8, h: 0.2, fontSize: 9 })
    calibri(s, total ? fmtUsd(total * pct / 100) : '', { x: 1.55, y: y + 0.3, w: 1.5, h: 0.2, fontSize: 9 })
    hline(s, pptx, 0.45, y + 0.56, 3.85, B.rule, 0.75)
  })
  hline(s, pptx, 0.45, 4.48, 3.85, B.navy, 1)
  calibri(s, 'TOTAL', { x: 0.45, y: 4.55, w: 1.5, h: 0.3, fontSize: 8, bold: true, color: B.navy, charSpacing: 2, valign: 'middle' })
  georgia(s, total ? fmtUsd(total) : '', { x: 2.3, y: 4.52, w: 2.0, h: 0.32, fontSize: 12, align: 'right', valign: 'middle' })
  eyebrow(s, 'Proposed ownership breakdown', { x: 4.90, y: 1.62, w: 4.7, h: 0.22, fontSize: 10 })
  const cx = [4.90, 6.05, 7.75, 8.70], cw = [1.15, 1.7, 0.85, 0.90]
  hline(s, pptx, 4.90, 1.98, 4.70, B.navy, 1)
  ;['Strategy', 'Manager', 'Alloc', 'Amount'].forEach((t, k) => calibri(s, t.toUpperCase(), { x: cx[k], y: 2.05, w: cw[k], h: 0.22, fontSize: 9, bold: true, color: B.gold, charSpacing: 2, align: k >= 2 ? 'right' : 'left', valign: 'middle' }))
  rows.forEach(([n, m, pct], i) => {
    const y = 2.42 + i * 0.46
    rect(s, pptx, 4.90, y, 4.70, 0.46, i % 2 ? B.tile : B.white, { color: B.navy, width: 1 })
    calibri(s, n, { x: cx[0] + 0.08, y, w: cw[0], h: 0.46, fontSize: 9.5, color: B.navy, valign: 'middle' })
    calibri(s, m, { x: cx[1], y, w: cw[1], h: 0.46, fontSize: 9.5, valign: 'middle' })
    calibri(s, `${pct.toFixed(1)}%`, { x: cx[2], y, w: cw[2], h: 0.46, fontSize: 9.5, align: 'right', valign: 'middle' })
    calibri(s, total ? fmtUsd(total * pct / 100) : '', { x: cx[3], y, w: cw[3], h: 0.46, fontSize: 9.5, align: 'right', valign: 'middle' })
  })
  const ty = 2.42 + rows.length * 0.46 + 0.1
  georgia(s, 'TOTAL', { x: cx[0] + 0.08, y: ty, w: 2, h: 0.35, fontSize: 12, bold: true, valign: 'middle' })
  georgia(s, '100%', { x: cx[2], y: ty, w: cw[2], h: 0.35, fontSize: 12, bold: true, align: 'right', valign: 'middle' })
  georgia(s, total ? fmtUsd(total) : '', { x: cx[3] - 0.2, y: ty, w: cw[3] + 0.2, h: 0.35, fontSize: 12, bold: true, align: 'right', valign: 'middle' })
}
export function cashNeeds(pptx, a) {
  const s = pptx.addSlide(); s.background = { color: B.white }
  footer(s, pptx, { size: 'x7', left: INVEST_FOOT })
  T(s, '5 Year Cash Needs', 0.60, 0.83, 6, { fontFace: H, fontSize: 28, color: '1C1D32' })
  rect(s, pptx, 0.50, 1.45, 1.40, 0.03, 'B2A26F')
  const retire = num(a.retirementCashNeed), need = retire || num(a.incomeAmount) * (a.incomeUnit === '/ mo' ? 12 : 1), g = a.cashGrowthPct === '' || a.cashGrowthPct == null ? 0 : num(a.cashGrowthPct)
  const k = (v) => `$${Math.floor(v / 1000)}K`
  const lab = (txt, val, y) => s.addText([{ text: `${txt} `, options: { color: '8C8C8C' } }, { text: val, options: { bold: true, color: '1C1D32' } }], { x: 5.30, y: y - 0.03, w: 4.3, h: 0.25, margin: 0, valign: 'top', wrap: false, fontFace: F, fontSize: 13 })
  lab('Retirement Cash Need:', retire ? k(retire) : 'N/A', 0.63); lab('Year 1 Cash on Hand:', num(a.cashOnHand) ? k(num(a.cashOnHand)) : '$—', 1.03)
  const yr = new Date().getFullYear()
  for (let i = 0; i < 4; i++) {
    const x = [0.50, 2.88, 5.26, 7.64][i], y = [1.75, 1.67, 1.62, 1.54][i], w = 2.20, h = 5.00 - y
    rect(s, pptx, x, y, w, h, B.tile, { color: 'CCCAC4', width: 0.75 })
    rect(s, pptx, x, y + 0.01, w, 0.04, '1C1E33', { color: '1C1E33', width: 1 })
    T(s, need ? k(Math.round(need * Math.pow(1 + g / 100, i + 1))) : '—', x, 2.04, w, { fontFace: H, fontSize: 24, bold: true, color: '1B1836', align: 'center' })
    rect(s, pptx, x + 0.62, 2.62, 0.96, 0.03, 'C9A84C', { color: 'B2A26F', width: 1 })
    T(s, `Year ${i + 2}`, x, 2.84, w, { fontSize: 12, color: '8C8C8C', align: 'center' })
    T(s, String(yr + i + 1), x, 3.21, w, { fontSize: 14, bold: true, color: B.gold, align: 'center' })
  }
}
export function buyOption(pptx) {
  const s = base(pptx, { bar: false, footLeft: INVEST_FOOT })
  header(s, pptx, 'Research reveals opportunity', 'Buy Option Cash Strategy in Down Markets')
  T(s, 'Down Market Deployment Logic', 5.15, 1.22, 4, { fontSize: 12, color: B.text })
  s.addShape(pptx.ShapeType.line, { x: 5.16, y: 1.47, w: 2.06, h: 2.42, line: { color: 'C00000', width: 1.25 } })
  s.addShape(pptx.ShapeType.line, { x: 7.21, y: 1.47, w: 2.16, h: 2.42, flipV: true, line: { color: '2A6B3A', width: 1.25 } })
  ;[[6.46, 3.00], [7.13, 3.75], [9.27, 1.40]].forEach(([x, y]) => s.addShape(pptx.ShapeType.ellipse, { x, y, w: 0.2, h: 0.2, fill: { color: '0070C0' }, line: { color: B.bg, width: 1 } }))
  T(s, '(Average duration: 40 months*)', 6.15, 4.12, 3, { fontSize: 12, bold: true, color: B.text })
  const box = (y, fill, n, t, d, light) => {
    rect(s, pptx, 0.66, y, 4.20, 0.66, fill, { color: B.tileBorder, width: 0.5 })
    T(s, t, 0.86, y + 0.10, 3.4, { fontFace: H, fontSize: 12, color: light ? B.white : B.navy })
    T(s, d, 0.86, y + 0.42, 3.6, { fontSize: 10.6, color: light ? B.creamText : B.text })
    T(s, n, 4.72, y + 0.18, 0.2, { fontFace: H, fontSize: 13, color: light ? B.white : B.navy })
  }
  box(2.76, B.navy, '1', '25% Drop', 'Invest 70% of the last year bond', true)
  box(3.56, B.tile, '2', '40% Drop', 'Invest the remaining 30% of last year bond', false)
  T(s, '*40 Months to recovery – “Bear markets may not be as ferocious as they appear”, Mark Hulbert, Wall Street Journal, March 8-9, 2014.', 4.05, 5.08, 5.96, { fontSize: 8, italic: true, color: 'A6A6A6', align: 'right' })
}
export function proposedPerf(pptx, a, familyName) {
  const s = base(pptx, { bar: false, footLeft: INVEST_FOOT })
  header(s, pptx, `${shortName({ name: familyName }) || 'The'} Family`, 'Proposed Portfolio Performance', { rule: 'full', x: 0.50 })
  const stats = [[a.potentialReturn, 'Total Potential Return'], [a.annualReturn, 'Potential Annual Return'], [a.dividendYield, 'Annual Dividend Yield']]
  stats.forEach(([v, l], i) => {
    const x = [0.50, 3.65, 6.80][i], y = 1.42, w = 2.95, h = 2.35
    rect(s, pptx, x, y, w, h, i === 0 ? B.tile3 : B.tile, { color: B.tileBorder, width: 0.75 })
    rect(s, pptx, x, y, w, 0.06, B.navy)
    georgia(s, v ? `${String(v).replace('%', '')}%` : '—', { x: x + 0.2, y: y + 0.3, w: w - 0.4, h: 0.7, fontSize: 30, color: i === 0 ? B.navy2 : B.navy, valign: 'middle' })
    hline(s, pptx, x + 0.2, y + 1.2, w - 0.4, B.rule, 1)
    georgia(s, l, { x: x + 0.2, y: y + 1.3, w: w - 0.4, h: 0.4, fontSize: 11.1, valign: 'middle' })
  })
  calibri(s, COPY.riskDisclosure, { x: 1.9, y: 3.9, w: 6.2, h: 1.25, fontSize: 5.2, align: 'center', lineSpacingMultiple: 1.05 })
}
export function lifeboat(pptx, a, familyName) {
  const s = base(pptx, { bar: false, footLeft: INVEST_FOOT })
  header(s, pptx, 'Risk assessment', `${shortName({ name: familyName }) || 'The'} Family — Lifeboat Drill`)
  calibri(s, '95% Probability Range  —  6-Month Horizon', { x: LM, y: 1.55, w: 6, h: 0.25, fontSize: 10, valign: 'middle' })
  const total = num(a.portfolioTotal)
  const lossPct = a.lossPct ? `-${String(a.lossPct).replace(/[-%]/g, '')}%` : '—', gainPct = a.gainPct ? `+${String(a.gainPct).replace(/[+%]/g, '')}%` : '—'
  rect(s, pptx, 0.55, 1.91, 2.70, 1.05, B.tile, { color: B.tileBorder, width: 0.75 })
  georgia(s, lossPct, { x: 0.7, y: 2.0, w: 2.4, h: 0.5, fontSize: 26, color: B.red, valign: 'middle' })
  calibri(s, `${a.lossAmt ? '-' + fmtUsd(Math.abs(num(a.lossAmt))) : ''}  Potential Loss`, { x: 0.7, y: 2.58, w: 2.4, h: 0.25, fontSize: 10, color: B.red, valign: 'middle' })
  rect(s, pptx, 3.55, 1.89, 3.00, 1.05, B.bg, { color: B.navy, width: 1 })
  georgia(s, total ? fmtUsd(total) : '$—', { x: 3.67, y: 1.98, w: 2.8, h: 0.5, fontSize: 26, valign: 'middle' })
  eyebrow(s, 'Current portfolio', { x: 3.67, y: 2.56, w: 2.8, h: 0.25, fontSize: 10, valign: 'middle' })
  rect(s, pptx, 6.75, 1.91, 2.70, 1.05, B.tile, { color: B.tileBorder, width: 0.75 })
  georgia(s, gainPct, { x: 6.9, y: 2.0, w: 2.4, h: 0.5, fontSize: 26, color: B.green, valign: 'middle' })
  calibri(s, `${a.gainAmt ? '+' + fmtUsd(Math.abs(num(a.gainAmt))) : ''}  Potential Gain`, { x: 6.9, y: 2.58, w: 2.4, h: 0.25, fontSize: 10, color: B.green, valign: 'middle' })
  rect(s, pptx, 0.55, 3.10, 9.00, 0.30, B.tile, { color: B.navy, width: 0.75 })
  rect(s, pptx, 0.55, 3.10, 2.60, 0.30, B.redBar, { color: B.navy, width: 0.75 })
  rect(s, pptx, 5.38, 3.10, 4.17, 0.30, B.greenBar, { color: B.navy, width: 0.75 })
  rect(s, pptx, 4.28, 3.06, 0.08, 0.38, B.navy)
  calibri(s, 'Current', { x: 3.82, y: 3.50, w: 1.0, h: 0.22, fontSize: 10, color: B.gold, align: 'center', valign: 'middle' })
  const lp = String(COPY.lifeboatDisclosure || COPY.riskDisclosure).replace(/ (The underlying data is updated)/, '\n$1').replace(/ (IMPORTANT:)/, '\n$1').split('\n')
  s.addText(lp.map((t, i) => ({ text: t, options: { breakLine: i < lp.length - 1 } })), { x: 0.55, y: 4.0, w: 7.15, h: 1.15, margin: 0, valign: 'top', fontFace: F, fontSize: 4.6, color: B.text, lineSpacing: 7.2 })
}
export function nextStep(pptx, variant, fee, title) {
  const v = COPY[variant], c = /Under5/.test(variant) // the under-$5M deck uses smaller type on this slide
  const s = base(pptx, { bar: false })
  header(s, pptx, 'Next step', title, { rule: 'full', ebSize: c ? 7.6 : 11.5 })
  s.addText(v.question, { x: LM, y: 1.55 - 0.03, w: c ? 4.15 : 4.4, h: 0.72, margin: 0, valign: 'top', fontFace: H, fontSize: 12.5, italic: true, color: c ? '1B2A4A' : B.navy2, lineSpacing: c ? 16.5 : 18 })
  v.bullets.forEach(([t, d], i) => {
    const y = 2.38 + i * 0.44
    rect(s, pptx, LM, y, 0.05, 0.26, B.navy)
    if (c) { T(s, t, LM + 0.2, y - 0.01, 4.3, { fontSize: 9.5, bold: true, color: B.navy }); T(s, d, LM + 0.2, y + 0.21, 4.3, { fontSize: 8, color: B.text }); hline(s, pptx, LM, y + 0.36, 4.0, B.rule, 0.3) }
    else { calibri(s, t, { x: LM + 0.17, y: y - 0.05, w: 4.3, h: 0.22, fontSize: 10.6, bold: true, color: B.navy, valign: 'middle' }); calibri(s, d, { x: LM + 0.17, y: y + 0.17, w: 4.3, h: 0.2, fontSize: 9, valign: 'middle' }); hline(s, pptx, LM + 0.17, y + 0.40, 4.3, B.rule, 0.75) }
  })
  v.phases.forEach(([t, d], i) => {
    const x = 5.20, y = [1.40, 2.48, 3.56][i], w = 4.50, h = 0.95
    rect(s, pptx, x, y, w, h, B.tile, c ? st1(B.tileBorder) : undefined)
    if (c) {
      T(s, `PHASE ${i + 1}`, x + 0.18, y + 0.17, 2, { fontSize: 7, color: B.gold, charSpacing: 2.2 })
      T(s, t, x + 0.18, y + 0.35, w - 0.3, { fontFace: H, fontSize: 10.6, color: B.navy })
      s.addText(d, { x: x + 0.18, y: y + 0.61 - 0.03, w: w - 0.36, h: 0.32, margin: 0, valign: 'top', fontFace: F, fontSize: 8, color: i === 0 ? B.text : '8A887F', lineSpacing: 10.4 })
    } else {
      eyebrow(s, `Phase ${i + 1}`, { x: x + 0.18, y: y + 0.1, w: 2, h: 0.2, fontSize: 10 })
      georgia(s, t, { x: x + 0.18, y: y + 0.3, w: w - 0.36, h: 0.26, fontSize: 11, valign: 'middle' })
      calibri(s, d, { x: x + 0.18, y: y + 0.55, w: w - 0.36, h: 0.4, fontSize: 9, lineSpacingMultiple: 1.15 })
    }
  })
  rect(s, pptx, 5.21, 4.59, 4.50, 0.65, B.navy, c && kit.outlines ? { color: '000000', width: 1 } : undefined)
  if (c) { T(s, 'Engagement Investment', 5.39, 4.71, 3, { fontSize: 8, color: B.white }); T(s, fmtUsd(fee), 5.39, 4.86, 2, { fontFace: H, fontSize: 15, color: B.white }) }
  else {
    calibri(s, 'Engagement Investment', { x: 5.38, y: 4.63, w: 3, h: 0.22, fontSize: 10.6, color: B.white, valign: 'middle' })
    georgia(s, fmtUsd(fee), { x: 5.38, y: 4.85, w: 2, h: 0.32, fontSize: 15, color: B.white, valign: 'middle' })
    if (v.delivery) calibri(s, v.delivery, { x: 7.0, y: 4.85, w: 2.6, h: 0.32, fontSize: 9, color: B.white, align: 'right', valign: 'middle' })
  }
}
const st1 = (c) => ({ color: c, width: 0.5 })
export function gapSummary(pptx, goals, { panel = false } = {}) {
  const total = goals.length, met = goals.filter((g) => g.status === 'met').length, missed = goals.filter((g) => g.status === 'missed').length
  const cost = goals.reduce((sum, g) => sum + (g.status === 'missed' ? num(g.cost?.amount) : 0), 0)
  const s = base(pptx, { bar: false })
  header(s, pptx, 'Family Capital Gap Analysis', 'Gap Analysis of Your Current Goals', { x: 0.45, sub: "Based on today's assessment, here is where your current plan stands:" })
  if (panel) rect(s, pptx, 0.42, 1.68, 4.18, 3.05, B.tile3)
  if (total) s.addChart(pptx.ChartType.doughnut, [{ name: 'Goals', labels: ['Met', 'Missed', 'Open'], values: [met, missed, Math.max(0, total - met - missed)] }], { x: 0.89, y: 1.72, w: 3.1, h: 3.0, holeSize: 55, chartColors: [B.green, B.redBox, B.mist], showLegend: false, showPercent: false, showValue: false, showTitle: false, showLabel: false })
  s.addText([{ text: String(total), options: { fontSize: 28, fontFace: H, bold: true, color: B.navy, breakLine: true } }, { text: 'Total Goals', options: { fontSize: 9, fontFace: F, color: B.text } }], { x: 0.89, y: 2.72, w: 3.1, h: 1.0, align: 'center', valign: 'middle', margin: 0 })
  const box = (y, n, label, cap, color, fill) => {
    rect(s, pptx, 5.00, y, 4.60, 1.35, fill, { color, width: 1.5 })
    rect(s, pptx, 5.00, y, 4.60, 0.06, color)
    georgia(s, String(n), { x: 5.15, y: y + 0.12, w: 1.2, h: 0.85, fontSize: 48, color, valign: 'middle' })
    calibri(s, label, { x: 6.4, y: y + 0.25, w: 3.0, h: 0.4, fontSize: 16, color, valign: 'middle' })
    eyebrow(s, cap, { x: 5.25, y: y + 1.0, w: 4.2, h: 0.22, fontSize: 8.1, color })
  }
  box(1.68, met, 'Goals Met', 'Current plan status', B.green, B.greenSoft)
  box(3.22, missed, 'Goals Missed', 'Opportunity to improve', B.redBox, B.redSoft)
  rect(s, pptx, 0.50, 4.72, 9.15, 0.42, B.bg, { color: '1C1E33', width: 1.5 })
  eyebrow(s, 'Total cost of inaction:', { x: 0.70, y: 4.72, w: 4, h: 0.42, fontSize: 9.5, color: B.navy, valign: 'middle' })
  georgia(s, fmtUsd(cost), { x: 5.5, y: 4.72, w: 3.95, h: 0.42, fontSize: 20, bold: true, color: B.redBox, align: 'right', valign: 'middle' })
}
export function blueprint(pptx, monthly) {
  const s = base(pptx, { bar: false })
  header(s, pptx, 'The full scope of engagement', 'Family Capital Blueprint', { rule: 'full' })
  COPY.blueprint.columns.forEach((c, i) => {
    const x = [0.55, 3.73, 6.91][i]
    georgia(s, c.title, { x, y: 1.45, w: 2.65, h: 0.55, fontSize: 12, color: B.navy2, align: 'center', valign: 'middle', lineSpacingMultiple: 1.2 })
    hline(s, pptx, x, 2.10, 2.65, B.navy, 1)
    c.items.forEach((it, k) => {
      const y = 2.22 + k * 0.46
      rect(s, pptx, x, y, 2.65, 0.36, B.tile)
      rect(s, pptx, x, y, 0.04, 0.36, B.navy)
      calibri(s, it, { x: x + 0.14, y, w: 2.45, h: 0.36, fontSize: 10.6, color: B.navy, valign: 'middle' })
    })
  })
  if (monthly != null) {
    rect(s, pptx, 0.45, 4.55, 4.50, 0.65, B.navy)
    calibri(s, 'Engagement Investment', { x: 0.62, y: 4.59, w: 3, h: 0.22, fontSize: 10.6, color: B.white, valign: 'middle' })
    georgia(s, `${fmtUsd(monthly)} / mo. – (1st 12 Months)`, { x: 0.62, y: 4.81, w: 4.2, h: 0.32, fontSize: 15, color: B.white, valign: 'middle' })
  }
}
export function caseStudy(pptx, cs) {
  const s = base(pptx, { bar: false })
  eyebrow(s, 'Case study', { x: LM, y: 0.25, w: 6, h: 0.24 })
  georgia(s, cs.family, { x: LM, y: 0.51, w: 6, h: 0.5, fontSize: 26, valign: 'middle' })
  eyebrow(s, cs.archetype, { x: LM, y: 0.98, w: 6, h: 0.2, fontSize: 9.5 })
  hline(s, pptx, LM, 1.28, 1.2, B.gold, 1.5)
  eyebrow(s, 'Original situation', { x: LM, y: 1.60, w: 4, h: 0.2, fontSize: 9.5 })
  const n = cs.situation.length, step = Math.min(0.54, 2.9 / n)
  cs.situation.forEach((t, i) => {
    const y = 1.9 + i * step
    rect(s, pptx, LM, y, 0.05, 0.35, B.navy, { color: B.rule, width: 0.75 })
    calibri(s, t, { x: LM + 0.2, y: y - 0.06, w: 4.0, h: step, fontSize: 10, color: B.navy, valign: 'middle', lineSpacingMultiple: 1.1 })
  })
  eyebrow(s, 'Results with Paradiem', { x: 5.10, y: 1.60, w: 4, h: 0.2, fontSize: 9.5 })
  cs.results.forEach((r, i) => {
    const x = [5.10, 7.45][i % 2], y = [1.86, 2.86, 3.86][Math.floor(i / 2)], up = r.dir === 'up'
    rect(s, pptx, x, y, 2.20, 0.88, up ? B.greenSoft2 : B.redSoft2, { color: up ? B.greenBorder : B.redBorder, width: 0.75 })
    calibri(s, r.label, { x: x + 0.15, y: y + 0.08, w: 1.9, h: 0.2, fontSize: 8.5 })
    georgia(s, r.value, { x: x + 0.15, y: y + 0.38, w: 1.5, h: 0.4, fontSize: 16, color: up ? B.green : B.red, valign: 'middle' })
    const tw = r.value.length * 0.115 + 0.1
    arrow(s, pptx, x + 0.15 + tw, y + 0.49, up, 0.18)
  })
  calibri(s, COPY.caseStudyFootnote, { x: LM, y: 4.86, w: 9, h: 0.2, fontSize: 7 })
}
export async function teamSlides(pptx, roster) {
  const photos = await loadHeadshots(roster)
  ;(roster || []).forEach((p, i) => { p._photo = photos[i] })
  for (const group of chunk(roster || [], 4)) {
    const s = pptx.addSlide(); s.background = { color: B.white }
    footer(s, pptx, { size: 'sm' }); rect(s, pptx, 0, 0.41, 0.06, 4.27, B.navy)
    georgia(s, 'Your Team & Advocates', { x: 0.45, y: 0.28, w: 8, h: 0.5, fontSize: 21, valign: 'middle' })
    hline(s, pptx, 0.45, 1.10, 1.0, B.gold, 2)
    group.forEach((p, i) => {
      const x = [0.45, 2.83, 5.22, 7.60][i], y = 1.39, w = 2.14, h = 3.00
      rect(s, pptx, x, y, w, h, B.tile)
      rect(s, pptx, x, y, w, 0.06, B.navy)
      const ph = p._photo
      if (ph) { const h = 1.36, w = Math.min(1.9, h * ph.w / ph.h); s.addImage({ data: ph.data, x: x + (2.14 - w) / 2, y: y + 0.13, w, h }) }
      else s.addShape(pptx.ShapeType.ellipse, { x: x + 0.52, y: y + 0.25, w: 1.1, h: 1.1, fill: { color: B.white }, line: { color: B.white, width: 0 } })
      hline(s, pptx, x + 0.35, y + 1.50, 1.45, B.gold, 1)
      georgia(s, p.name, { x: x + 0.04, y: y + 1.58, w: w - 0.08, h: 0.35, fontSize: 14.3, bold: true, align: 'center', valign: 'middle' })
      calibri(s, p.title, { x: x + 0.15, y: y + 1.95, w: w - 0.3, h: 0.7, fontSize: 12.4, align: 'center', lineSpacingMultiple: 1.2 })
    })
  }
}
export function pathForward(pptx, steps, variant = 'over5') {
  const s = base(pptx, { bar: false, footSize: 'lg' })
  rect(s, pptx, 0.42, 0.65, 0.06, 4.45, B.navy)
  if (variant === 'under5') {
    T(s, 'PARADIEM  ×  NEXT STEPS', 0.65, 0.76, 6, { fontSize: 11, color: B.gold, charSpacing: 3 })
    T(s, 'Your', 0.65, 1.02, 5, { fontFace: H, fontSize: 32, color: B.navy }); T(s, 'Path Forward', 0.65, 1.63, 5, { fontFace: H, fontSize: 32.1, color: B.navy })
    steps.forEach(([t, d], i) => {
      const y = 2.34 + i * 0.84
      T(s, String(i + 1), 0.65, y, 0.5, { fontFace: H, fontSize: 26, color: B.navy })
      T(s, t, 1.25, y, 8, { fontFace: H, fontSize: 11.5, color: B.navy }); T(s, d, 1.25, y + 0.32, 8, { fontSize: 8.5, color: B.text })
      if (i < steps.length - 1) hline(s, pptx, 0.65, y + 0.63, 8.0, B.rule, 0.4)
    })
    return
  }
  eyebrow(s, 'Paradiem  ×  Next steps', { x: 0.65, y: 0.70, w: 6, h: 0.22, fontSize: 10 })
  georgia(s, 'Your\nPath Forward', { x: 0.65, y: 0.98, w: 5, h: 1.3, fontSize: 32, lineSpacingMultiple: 1.05 })
  steps.forEach(([t, d], i) => {
    const y = 2.35 + i * 0.82
    georgia(s, String(i + 1), { x: 0.65, y, w: 0.5, h: 0.5, fontSize: 26, valign: 'middle' })
    calibri(s, t, { x: 1.25, y: y - 0.02, w: 8.2, h: 0.3, fontSize: 12, color: B.navy, valign: 'middle' })
    calibri(s, d, { x: 1.25, y: y + 0.30, w: 8.2, h: 0.25, fontSize: 10, valign: 'middle' })
    if (i < steps.length - 1) hline(s, pptx, 1.25, y + 0.68, 7.4, B.rule, 0.75)
  })
}
export function divider(pptx, lines) {
  const s = base(pptx, { navy: true, bar: false })
  const arr = Array.isArray(lines) ? lines : String(lines).split('\n')
  const top = arr.length > 1 ? 1.93 : 2.25
  arr.forEach((t, i) => georgia(s, t, { x: 1.13, y: top + i * 0.72, w: 8.5, h: 0.72, fontSize: 39, color: B.white, valign: 'middle' }))
  hline(s, pptx, 1.12, top + arr.length * 0.72 + 0.28, 1.35, B.gold, 2.5)
}
export function simpleTitle(s, pptx, eb, title, { size = 21 } = {}) {
  if (eb) eyebrow(s, eb, { x: 0.45, y: 0.25, w: 8, h: 0.22, fontSize: 10.2 })
  georgia(s, title, { x: 0.45, y: eb ? 0.38 : 0.28, w: 8.5, h: title.includes('\n') ? 0.85 : 0.45, fontSize: size, valign: 'middle', lineSpacingMultiple: 1.1 })
  hline(s, pptx, 0.45, 1.16, 0.98, B.gold, 2.5)
}
export function goalsList(pptx, goals) {
  for (const group of chunk(goals, 9)) {
    const s = base(pptx); simpleTitle(s, pptx, '', 'Goals and Intentions')
    group.forEach((g, i) => {
      const y = 1.25 + i * 0.35
      calibri(s, '•', { x: 0.45, y, w: 0.25, h: 0.35, fontSize: 13.5, valign: 'middle' })
      calibri(s, g.text, { x: 0.68, y, w: 8.9, h: 0.35, fontSize: 13.5, valign: 'middle' })
    })
  }
}
export function planAnalysisList(pptx, goals) {
  for (const group of chunk(goals, 9)) {
    const s = base(pptx); simpleTitle(s, pptx, 'Current plan analysis', 'Goals and Intentions')
    group.forEach((g, i) => {
      const y = 1.29 + i * 0.345, ok = g.status === 'met'
      text(s, ok ? '✓' : '×', { x: 0.45, y, w: 0.25, h: 0.345, fontFace: F, fontSize: 15.8, bold: true, color: ok ? B.flowGreen : B.redBox, valign: 'middle' })
      calibri(s, g.text, { x: 0.68, y, w: 8.9, h: 0.345, fontSize: 13.1, valign: 'middle' })
    })
  }
}
export function goalAnalysis(pptx, g) {
  const s = base(pptx)
  simpleTitle(s, pptx, '', 'Goals and Intentions\nAnalysis', { size: 19.5 })
  const goalLines = linesFor(g.text, 13.5, 8.8)
  const bandH = Math.max(0.56, 0.2 + goalLines * 0.26)
  rect(s, pptx, 0.45, 1.20, 9.10, bandH, B.tile)
  georgia(s, g.text, { x: 0.65, y: 1.20, w: 8.7, h: bandH, fontSize: 13.5, valign: 'middle', lineSpacingMultiple: 1.15 })
  let y = 1.20 + bandH + 0.12
  const section = (label, color, items) => {
    if (!items?.length) return
    calibri(s, label, { x: 0.45, y, w: 4, h: 0.28, fontSize: 13.1, bold: true, color, valign: 'middle' }); y += 0.28
    const lines = items.reduce((t, it) => t + linesFor(it, 12.8, 8.6), 0)
    const h = lines * 0.235 + items.length * 0.05
    calibri(s, items.map((t, i) => ({ text: t, options: { bullet: { indent: 18, characterCode: '2022' }, breakLine: i < items.length - 1, paraSpaceAfter: 3 } })), { x: 0.45, y, w: 9.1, h, fontSize: 12.8, lineSpacingMultiple: 1.1 }); y += h + 0.14
  }
  section('Observations', B.navy, g.observations)
  section('Potential Challenges', B.red, g.challenges)
  if (num(g.cost?.amount) > 0) {
    const yy = Math.min(Math.max(y, 3.0), 4.45)
    const h = g.cost.basis ? 0.72 : 0.5
    rect(s, pptx, 0.45, yy, 9.10, h, B.redSoft2, { color: B.redBorder, width: 0.75 })
    s.addText([{ text: 'Potential Cost of Inaction', options: { fontFace: H, fontSize: 13.5, color: B.red } }, { text: `   ${fmtUsd(g.cost.amount)}`, options: { fontFace: H, fontSize: 13.5, color: B.red } }], { x: 0.65, y: yy + 0.05, w: 8.7, h: 0.35, margin: 0, valign: 'middle' })
    if (g.cost.basis) calibri(s, g.cost.basis, { x: 0.65, y: yy + 0.38, w: 8.7, h: h - 0.4, fontSize: 9.5, lineSpacingMultiple: 1.1 })
  }
}
export function estateTaxSlide(pptx, f, tax) {
  const s = base(pptx); simpleTitle(s, pptx, 'Financial overview', 'Estate Tax Information')
  ;['s1', 's2'].forEach((k, i) => {
    const e = f.estateTax?.[k] || {}, name = f.profile?.[`spouse${i + 1}`]?.name || (i ? 'Wife' : 'Husband')
    const x = [0.45, 5.17][i], y = 1.30, w = 4.39
    rect(s, pptx, x, y, w, 0.31, B.navy)
    georgia(s, `${name}'s`, { x: x + 0.12, y, w: w - 0.2, h: 0.31, fontSize: 15, color: B.white, valign: 'middle' })
    const rows = [['Applicable Credit Amount Used', fmtUsd(num(e.creditUsed))], ['GST Exemption Used', fmtUsd(num(e.gstUsed))], ['Applicable Credit Available', fmtUsd((tax.estateExemption || 0) - num(e.creditUsed))], ['GST Exemption Available', fmtUsd((tax.gstExemption || 0) - num(e.gstUsed))]]
    rows.forEach(([l, v], r) => {
      const yy = y + 0.31 + r * 0.35
      rect(s, pptx, x, yy, w, 0.35, r % 2 ? B.tile : B.bg, { color: B.tileBorder, width: 0.75 })
      calibri(s, l, { x: x + 0.12, y: yy, w: 3.0, h: 0.35, fontSize: 12.8, valign: 'middle' })
      calibri(s, v, { x: x + 2.6, y: yy, w: w - 2.72, h: 0.35, fontSize: 12.8, bold: true, color: B.navy, align: 'right', valign: 'middle' })
    })
  })
}
export function balanceSheetSlide(pptx, f) {
  const s = base(pptx); simpleTitle(s, pptx, 'Financial overview', 'Your Current Balance Sheet')
  const assets = f.balanceSheet?.assets || [], liab = f.balanceSheet?.liabilities || []
  if (!assets.length && !liab.length) { calibri(s, 'Balance sheet not yet entered.', { x: 0.45, y: 1.5, w: 6, h: 0.4, fontSize: 12 }); return }
  const hdr = (t, align) => ({ text: t.toUpperCase(), options: { fontFace: F, fontSize: 9, bold: true, color: B.white, fill: { color: B.navy }, align: align || 'left', charSpacing: 1.5 } })
  const cell = (t, i, o = {}) => ({ text: t, options: { fontFace: F, fontSize: 9.5, color: B.text, fill: { color: i % 2 ? B.tile : B.bg }, ...o } })
  const rows = [[hdr('Asset'), hdr('Type'), hdr('Owner'), hdr('Value', 'right')]]
  assets.forEach((a, i) => rows.push([cell(a.name || '', i, { color: B.navy }), cell(ASSET_TYPES.find((t) => t.value === a.type)?.label || a.type || '', i), cell(a.owner || '', i), cell(fmtUsd(a.value), i, { align: 'right', bold: true, color: B.navy })]))
  rows.push([cell('Total assets', 0, { bold: true, color: B.navy, fill: { color: B.tile2 } }), cell('', 0, { fill: { color: B.tile2 } }), cell('', 0, { fill: { color: B.tile2 } }), cell(fmtUsd(totalAssets(f)), 0, { bold: true, align: 'right', color: B.navy, fill: { color: B.tile2 } })])
  liab.forEach((l, i) => rows.push([cell(l.name || '', i, { color: B.navy }), cell('Liability', i), cell('', i), cell(`(${fmtUsd(l.value)})`, i, { align: 'right', bold: true, color: B.red })]))
  rows.push([cell('Net worth', 0, { bold: true, color: B.navy, fill: { color: B.tile2 } }), cell('', 0, { fill: { color: B.tile2 } }), cell('', 0, { fill: { color: B.tile2 } }), cell(fmtUsd(netWorthOf(f)), 0, { bold: true, align: 'right', color: B.navy, fill: { color: B.tile2 } })])
  s.addTable(rows, { x: 0.45, y: 1.42, w: 9.1, colW: [3.6, 2.2, 1.5, 1.8], border: { type: 'solid', color: B.tileBorder, pt: 0.5 }, rowH: 0.27, margin: 0.05, valign: 'middle', autoPage: true, autoPageRepeatHeader: true, autoPageLineWeight: 0.2 })
}
export async function flowSlide(pptx, fc) {
  const s = pptx.addSlide(); s.background = { color: B.white }
  rect(s, pptx, 0, 0.41, 0.06, 4.27, B.navy)
  return addFlowToSlide(pptx, s, fc, { x: 0.3, y: 0.12, w: 9.4 })
}
export function toolPages(pptx, recs) {
  divider(pptx, ['How we close', 'the gaps.'])
  for (const group of chunk(recs, 5)) {
    const s = base(pptx); simpleTitle(s, pptx, 'Recommended planning tools', 'Priorities, most urgent first')
    group.forEach((r, i) => {
      const y = 1.45 + i * 0.72
      const tier = TIERS.find((t) => t.id === r.tier)
      const col = r.tier === 'Protect' ? B.red : r.tier === 'Deadline' ? B.gold : B.navy
      rect(s, pptx, 0.45, y, 9.10, 0.64, i % 2 ? B.bg : B.tile, { color: B.tileBorder, width: 0.75 })
      rect(s, pptx, 0.45, y, 0.05, 0.64, col)
      georgia(s, r.name, { x: 0.62, y: y + 0.04, w: 6.5, h: 0.26, fontSize: 11.5, valign: 'middle' })
      eyebrow(s, tier?.label || r.tier, { x: 7.3, y: y + 0.07, w: 2.15, h: 0.2, fontSize: 8, color: col, align: 'right' })
      calibri(s, r.rationale || toolById(r.toolId)?.summary || '', { x: 0.62, y: y + 0.3, w: 8.8, h: 0.34, fontSize: 8.5, lineSpacingMultiple: 1.1 })
    })
  }
}
export function timelineSlide(pptx, f) {
  const s = base(pptx); simpleTitle(s, pptx, 'Timeline', 'Timeline\nFirst Year', { size: 19.5 })
  const items = (f.deadlines || []).filter((d) => !d.done && d.date).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 10)
  if (!items.length) { calibri(s, 'First-year timeline (from the planning calendar).', { x: 0.45, y: 1.5, w: 8, h: 0.3, fontSize: 10.5, italic: true }); return }
  items.forEach((d, i) => {
    const y = 1.40 + i * 0.36
    calibri(s, new Date(`${d.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), { x: 0.45, y, w: 1.6, h: 0.3, fontSize: 10, bold: true, color: B.gold, valign: 'middle' })
    calibri(s, d.title, { x: 2.1, y, w: 7.4, h: 0.3, fontSize: 11.5, color: B.navy, valign: 'middle' })
    hline(s, pptx, 0.45, y + 0.33, 9.1, B.rule, 0.75)
  })
}
export function nextStepsSlide(pptx, steps) {
  const s = base(pptx); simpleTitle(s, pptx, 'Action plan', 'Next Steps')
  steps.slice(0, 6).forEach((t, i) => {
    const y = 1.36 + i * 0.66
    rect(s, pptx, 0.45, y, 9.10, 0.58, B.tile)
    rect(s, pptx, 0.45, y, 0.05, 0.58, B.gold)
    georgia(s, String(i + 1).padStart(2, '0'), { x: 0.62, y, w: 0.5, h: 0.58, fontSize: 16, bold: true, color: B.gold, valign: 'middle' })
    calibri(s, t, { x: 1.15, y, w: 8.2, h: 0.58, fontSize: 14, color: B.navy, valign: 'middle' })
  })
}
export const DEFAULT_NEXT_STEPS = ['Cash Flow and Financial Analysis', 'Generational Impact Retreat', 'Finalize Goals and Intentions', 'Introduction to Advisors', 'Paradiem Planning Day']

export function coupleName(f) {
  const p = f.profile || {}
  const a = p.spouse1?.name, b = p.spouse2?.name
  if (a && b) return `${a} & ${b}`
  return a || b || f.name
}
export const longDate = (d) => d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''


// Single-table performance page (25 Stock Growth Strategy). Colours and positions measured from the reference decks.
function perfSingle(pptx, p, perf) {
  const s = pptx.addSlide(); s.background = { color: B.white }
  const GOLD = 'BE9430', RULE = 'D0D0D0', LAB = '5C5C5C', HEAD = '808080', VAL = '1A1A1A', NEG = '9E2B2B'
  T(s, p.name, 0.41, 0.35, 8, { fontFace: H, fontSize: 18, color: '1B2A4E' })
  rect(s, pptx, 0.45, 0.84, 0.86, 0.03, GOLD)
  const asOf = perf.asOf ? new Date(`${perf.asOf}T00:00:00`).toLocaleDateString('en-US') : ''
  T(s, `RETURNS (AS OF ${asOf})`, 0.41, 1.11, 6, { fontSize: 10, color: HEAD, charSpacing: 3.3 })
  const b = p.annualized, n = b.columns.length, cx = n === 3 ? [4.045, 6.295, 8.545] : b.columns.map((_, i) => 3.2 + i * (6.2 / n))
  b.columns.forEach((c, i) => T(s, String(c), cx[i] - 0.5, 1.46, 1, { fontSize: 9, color: HEAD, align: 'center', charSpacing: 3 }))
  hline(s, pptx, 0.45, 1.75, 8.96, RULE, 1)
  const row = (lab, vals, y0, kind) => {
    const col = kind === 'net' ? GOLD : VAL
    if (kind === 'net') rect(s, pptx, 0.40, y0 + 0.02, 9.05, 0.45, 'EEEBE2', { color: '2B2B2B', width: 1.5 })
    const lines = kind === 'bm' ? wrapLabel(lab) : [lab.toUpperCase()]
    lines.forEach((ln, i) => T(s, ln, 0.45, y0 + (kind === 'bm' ? 0.15 : 0.21) + i * 0.115, 3, { fontSize: 7.6, color: kind === 'net' ? GOLD : LAB, charSpacing: 2 }))
    vals.forEach((v, i) => T(s, v == null ? '—' : `${Number(v).toFixed(2)}%`, cx[i] - 0.6, y0 + 0.18, 1.2, { fontFace: H, fontSize: 10.6, color: Number(v) < 0 ? NEG : col, align: 'center' }))
    hline(s, pptx, 0.45, y0 + 0.50, 8.96, RULE, 1)
  }
  row('Gross', b.gross, 1.75, 'gross'); row('Net', b.net, 2.25, 'net')
  p.benchmarks.forEach((bm, i) => row(bm.label, b[bm.key] || [], 2.75 + i * 0.50, 'bm'))
  rect(s, pptx, 0.45, 3.82, 8.96, 0.02, GOLD)
  const txt = p.disclosure || ''
  s.addText(txt, { x: 0.41, y: 4.74, w: 9.15, h: 0.75, margin: 0, valign: 'top', fontFace: 'Arial', fontSize: 5.6, color: '7A7A7A', lineSpacing: 7 })
}
const wrapLabel = (t) => { const w = String(t).split(' '); const out = []; let cur = ''; for (const x of w) { if ((cur + ' ' + x).trim().length > 22 && cur) { out.push(cur); cur = x } else cur = (cur + ' ' + x).trim() } if (cur) out.push(cur); return out }
