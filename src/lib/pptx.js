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
import { addFlowToSlide, animationSteps, injectAnimation } from './flowpptx'

const B = BRAND
const H = 'Georgia', F = 'Calibri'
const W = 10, HT = 5.625
const LM = 0.55 // content left margin on header slides

// ───────────────────────── primitives ─────────────────────────
async function asDataUrl(src) {
  if (!src) return null
  if (src.startsWith('data:')) return src
  try {
    const r = await fetch(/^https?:/.test(src) ? src : `${import.meta.env.BASE_URL || '/'}${src.replace(/^\//, '')}`)
    if (!r.ok) return null
    const b = await r.blob()
    return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b) })
  } catch { return null }
}
const logoData = () => asDataUrl('paradiem-logo.png')
async function imageDims(dataUrl) {
  try { const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl }); return { w: img.naturalWidth, h: img.naturalHeight } } catch { return null }
}
// Headshot: the person's own photo, else the shipped one for that name.
async function loadHeadshots(roster) {
  return Promise.all((roster || []).map(async (p) => {
    const src = p.photo || DEFAULT_ROSTER.find((d) => d.name === p.name)?.photo
    const data = await asDataUrl(src); if (!data) return null
    const dims = await imageDims(data); return dims ? { data, ...dims } : null
  }))
}
const rect = (s, pptx, x, y, w, h, fill, line) => s.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: fill ? { color: fill } : { type: 'none' }, line: line ? { color: line.color, width: line.width ?? 0.75 } : { color: fill || B.bg, width: 0 } })
const hline = (s, pptx, x, y, w, color, width = 1) => s.addShape(pptx.ShapeType.line, { x, y, w, h: 0, line: { color, width } })
const vline = (s, pptx, x, y, h, color, width = 1) => s.addShape(pptx.ShapeType.line, { x, y, w: 0, h, line: { color, width } })
const text = (s, t, o) => s.addText(t, { margin: 0, valign: 'top', ...o })
const georgia = (s, t, o) => text(s, t, { fontFace: H, color: B.navy, ...o })
const calibri = (s, t, o) => text(s, t, { fontFace: F, color: B.text, ...o })
const eyebrow = (s, t, o) => text(s, String(t || '').toUpperCase(), { fontFace: F, fontSize: 11, color: B.gold, charSpacing: 3, ...o })
const arrow = (s, pptx, x, y, up, size = 0.19) => s.addShape(up ? pptx.ShapeType.upArrow : pptx.ShapeType.downArrow, { x, y, w: size, h: size, fill: { color: up ? B.green : B.red }, line: { color: up ? B.green : B.red, width: 0 } })

function footer(s, pptx, { fill = B.tile, topLine } = {}) {
  rect(s, pptx, 0, HT - 0.38, W, 0.38, fill)
  if (topLine) hline(s, pptx, 0, HT - 0.38, W, topLine, 1)
  calibri(s, COPY.footerLeft, { x: 0.45, y: HT - 0.38, w: 5, h: 0.38, fontSize: 6.5, color: B.caption, charSpacing: 4, valign: 'middle' })
  calibri(s, COPY.footerRight, { x: 4.55, y: HT - 0.38, w: 5, h: 0.38, fontSize: 6.5, color: B.caption, charSpacing: 4, valign: 'middle', align: 'right' })
}
function base(pptx, { bg = B.bg, bar = true, foot = true, navy = false } = {}) {
  const s = pptx.addSlide()
  s.background = { color: navy ? B.navy : bg }
  if (bar && !navy) rect(s, pptx, 0, 0.41, 0.06, 4.27, B.navy)
  if (foot) footer(s, pptx)
  return s
}
// Standard content header: gold eyebrow, Georgia 26 title, rule (short gold or full-width light)
function header(s, pptx, eb, title, { rule = 'gold', x = LM, sub, titleSize = 26 } = {}) {
  if (eb) eyebrow(s, eb, { x, y: 0.25, w: 9, h: 0.24 })
  georgia(s, title, { x, y: 0.51, w: 9.2, h: 0.65, fontSize: titleSize, valign: 'middle' })
  if (rule === 'gold') hline(s, pptx, x, 1.28, 1.2, B.gold, 1.5)
  else if (rule === 'full') hline(s, pptx, x, 1.28, 9.0, B.rule, 1)
  if (sub) calibri(s, sub, { x, y: 1.42, w: 9, h: 0.3, fontSize: 10.5, italic: true })
}
function chunk(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out }
const fmtPctCell = (v) => (v == null || v === '' ? '—' : `${Number(v).toFixed(2)}%`)
const shortName = (f) => (f?.name || '').replace(/^The /, '').replace(/ Family$/, '')
const paras = (arr, o = {}) => (arr || []).map((t, i) => ({ text: t, options: { breakLine: i < arr.length - 1, ...o } }))
// Rough line count for a bullet paragraph at a given Calibri size inside a given width (inches)
const linesFor = (t, size, w) => Math.max(1, Math.ceil(String(t || '').length / Math.max(20, Math.floor((w * 72) / (size * 0.47)))))

// ───────────────────────── shared slides ─────────────────────────
function cover(pptx, logo, title, coupleLabel, date) {
  const s = base(pptx, { bar: true })
  if (logo) s.addImage({ data: logo, x: 7.05, y: 0.22, w: 2.55, h: 0.62 })
  georgia(s, title, { x: 0.45, y: 0.89, w: 8, h: 0.7, fontSize: 36.7, valign: 'middle' })
  georgia(s, coupleLabel || 'Mr. and Mrs. ________', { x: 0.45, y: 2.29, w: 8.5, h: 0.7, fontSize: 36.7, valign: 'middle' })
  hline(s, pptx, 0.45, 3.07, 1.16, B.gold, 2.5)
  calibri(s, COPY.tagline, { x: 0.45, y: 3.18, w: 8, h: 0.4, fontSize: 18, valign: 'middle' })
  georgia(s, date || '', { x: 0.45, y: 4.19, w: 6, h: 0.5, fontSize: 24, valign: 'middle' })
}
function disclosures(pptx) {
  const s = base(pptx)
  header(s, pptx, 'Disclosures', 'Legal Disclosures & Important Information')
  calibri(s, paras(COPY.disclosures, { paraSpaceAfter: 6 }), { x: LM, y: 1.48, w: 9.0, h: 3.7, fontSize: 8.6, color: B.text, lineSpacingMultiple: 1.05 })
}
function framework(pptx, { tiles = true } = {}) {
  const s = base(pptx)
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
function twoKinds(pptx) {
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
function processSlide(pptx, current) {
  const s = base(pptx, { bar: false })
  header(s, pptx, 'Our Process', 'Family Capital Architecture', { rule: 'none', x: 0.45 })
  s.addShape(pptx.ShapeType.line, { x: 0.45, y: 1.38, w: 9.20, h: 0, line: { color: B.gold, width: 2.5, endArrowType: 'triangle' } })
  ;[3.45, 6.60].forEach((x) => vline(s, pptx, x, 1.20, 0.36, B.gold, 1.5))
  const steps = [['01', 'Family Capital\nAssessment', current === 1 ? "Today's session — mapping the current state of your family and capital." : 'Mapping the current state of your family and capital.'], ['02', 'Family Capital\nGap Analysis', current === 2 ? "Today's session — the deep diagnostic identifying gaps between where you are and where you should be." : 'Deep diagnostic identifying gaps between where you are and where you should be.'], ['03', 'Family Capital\nBlueprint', 'Your comprehensive multi-generational wealth and legacy roadmap.']]
  steps.forEach(([n, t, d], i) => {
    const x = [0.45, 3.60, 6.75][i], y = 1.58, w = 2.90, h = 3.28, active = current === i + 1
    rect(s, pptx, x, y, w, h, active ? B.bg : B.tile2, { color: active ? B.navy : B.tileBorder, width: active ? 1 : 0.75 })
    rect(s, pptx, x, y, w, 0.06, B.navy)
    georgia(s, n, { x: x + 0.2, y: y + 0.25, w: 1, h: 0.45, fontSize: 24 })
    georgia(s, t, { x: x + 0.2, y: y + 0.75, w: w - 0.4, h: 0.62, fontSize: 13, lineSpacingMultiple: 1.15 })
    hline(s, pptx, x + 0.2, 2.98, w - 0.4, B.rule, 1)
    calibri(s, d, { x: x + 0.2, y: 3.12, w: w - 0.4, h: 1.1, fontSize: 11, lineSpacingMultiple: 1.25 })
    const tag = active ? 'Today' : i + 1 < current ? 'Previous' : i === 1 ? 'Potential next step' : 'The outcome'
    eyebrow(s, tag, { x: x + 0.2, y: 4.41, w: w - 0.4, h: 0.22, fontSize: 10.6 })
  })
}
function numbersHeader(s, familyName) {
  eyebrow(s, 'What the numbers reveal', { x: 0.55, y: 0.16, w: 6, h: 0.22 })
  georgia(s, `${shortName({ name: familyName }) ? shortName({ name: familyName }) + ' ' : ''}Family Capital Assessment`, { x: 0.55, y: 0.35, w: 9, h: 0.5, fontSize: 26, valign: 'middle' })
}
function numbersReveal(pptx, settings, familyName) {
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
    georgia(s, c.label, { x: x + 0.15, y: y + 1.1, w: w - 0.25, h: 0.6, fontSize: 10, lineSpacingMultiple: 1.25 })
    if (c.footnote) calibri(s, c.footnote, { x: x + 0.15, y: y + 1.62, w: w - 0.25, h: 0.25, fontSize: 8 })
    const amt = fmtUsd(c.amount)
    calibri(s, amt, { x: x + 0.1, y: 4.22, w: w - 0.42, h: 0.3, fontSize: 15, bold: true, color: B.navy2, valign: 'middle' })
    arrow(s, pptx, x + w - 0.3, 4.28, c.dir !== 'down')
  })
  calibri(s, `${COPY.hypothetical} ${COPY.firmAveragesFootnote}`, { x: 0.1, y: 4.72, w: 9.8, h: 0.85, fontSize: 6.5, color: B.caption, charSpacing: 2, lineSpacingMultiple: 1.15 })
}
function incomeClarity(pptx, a, familyName) {
  const s = base(pptx, { bar: false, foot: false })
  numbersHeader(s, familyName)
  const cols = [['Income', a.incomeMonthly ? fmtUsd(a.incomeMonthly) : '$—', '/ mo', 'Income, paid monthly and rising with inflation'], ['Clarity', a.clarityNetWorth ? fmtUsd(a.clarityNetWorth) : '$—', 'net worth', 'Cash Flow, Assets, & Growth Projections all coordinated into one clear picture'], ['Protection', a.protectionPct || '100%', 'of your wishes', "Your wishes documented, your family cared for – and someone in your corner for the things you'd never think to ask."]]
  cols.forEach(([t, big, unit, d], i) => {
    const x = [0.55, 3.48, 6.40][i], y = 1.09, w = 2.77, h = 3.19
    rect(s, pptx, x, y, w, h, B.tile)
    rect(s, pptx, x, y, 0.07, h, B.navy)
    georgia(s, t, { x: x + 0.2, y: y + 0.3, w: w - 0.3, h: 0.55, fontSize: 26, align: 'center', valign: 'middle' })
    georgia(s, [{ text: big, options: { fontSize: 24 } }, { text: ` ${unit}`, options: { fontSize: 12 } }], { x: x + 0.25, y: y + 1.2, w: w - 0.4, h: 0.5, valign: 'middle' })
    calibri(s, d, { x: x + 0.25, y: y + 1.95, w: w - 0.45, h: 1.1, fontSize: 10, color: B.ink, lineSpacingMultiple: 1.25 })
  })
  calibri(s, COPY.hypothetical, { x: 0.1, y: 4.78, w: 9.8, h: 0.75, fontSize: 6.5, color: B.caption, charSpacing: 2, lineSpacingMultiple: 1.15 })
}
function philosophy(pptx) {
  const s = base(pptx, { bar: false })
  header(s, pptx, 'Investment philosophy', 'Family Capital Investment')
  ;["We don't INVEST.", 'We INTENTIONALLY OWN', 'EXCELLENT COMPANIES.'].forEach((t, i) => georgia(s, t, { x: LM, y: [1.83, 2.24, 2.66][i], w: 8, h: 0.4, fontSize: 17, valign: 'middle' }))
  hline(s, pptx, LM, 3.60, 1.2, B.gold, 1.5)
  calibri(s, 'The distinction matters. Investors react to markets. Owners build enduring value with conviction.', { x: LM, y: 3.90, w: 4.8, h: 0.6, fontSize: 12, lineSpacingMultiple: 1.3 })
}
function principles(pptx) {
  const s = base(pptx, { bar: false })
  header(s, pptx, 'The three principles', '3 Principles of Family Capital Investment')
  const cols = [['01', 'Think Like\nan Owner', 'Excellence evaluation', [['Innovation', 'Creating products/services that benefit consumers?'], ['Inspiration', 'Driven by legacy purpose contributing to human flourishing?'], ['Infrastructure', 'Solid foundation of sound business practices and structure?']]],
    ['02', 'Simplicity Over\nComplexity', 'Our ownership strategies', [['25 Stock Dividend Strategy', 'Income-focused ownership of 25 high-quality companies.'], ['25 Stock Growth Strategy', 'Growth-focused ownership of 25 high-conviction companies.'], ['Research-backed', 'Quality over quantity — conviction over diversification.']]],
    ['03', 'Research Reveals\nOpportunities', 'Conviction-based decisions', [['Deep Analysis', 'Fundamental research uncovers businesses others may overlook.'], ['Un-Common Sense', 'Current economic environments guide decisions and allocations.'], ['Clear Entry/Exit', 'Defined criteria for when to act — and when to hold.']]]]
  cols.forEach(([n, t, e, items], i) => {
    const x = [0.45, 3.63, 6.81][i], y = 1.58, w = 2.95, h = 3.28
    rect(s, pptx, x, y, w, h, i === 0 ? B.bg : B.tile2, { color: i === 0 ? B.navy : B.tileBorder, width: 0.75 })
    rect(s, pptx, x, y, w, 0.06, B.navy)
    georgia(s, n, { x: x + 0.2, y: y + 0.25, w: 1, h: 0.4, fontSize: 20 })
    georgia(s, t, { x: x + 0.2, y: y + 0.7, w: w - 0.4, h: 0.62, fontSize: 14, lineSpacingMultiple: 1.15 })
    hline(s, pptx, x + 0.2, 2.90, w - 0.4, B.rule, 1)
    eyebrow(s, e, { x: x + 0.2, y: 3.03, w: w - 0.4, h: 0.2, fontSize: 10, charSpacing: 2.5 })
    const runs = []
    items.forEach(([a, b], k) => { runs.push({ text: a, options: { bold: true, color: B.navy, fontSize: 10, breakLine: true } }); runs.push({ text: b, options: { color: B.text, fontSize: 9, breakLine: k < items.length - 1 } }) })
    calibri(s, runs, { x: x + 0.2, y: 3.27, w: w - 0.4, h: 1.5, lineSpacingMultiple: 1.2 })
  })
}
function ownersLens(pptx, sc = {}) {
  const s = pptx.addSlide(); s.background = { color: B.white }
  footer(s, pptx, { fill: 'ECEAE3', topLine: B.gold })
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
function perfTable(pptx, sleeve, perf) {
  const p = perf?.[sleeve]; if (!p) return
  const s = pptx.addSlide(); s.background = { color: B.white }
  footer(s, pptx)
  georgia(s, p.name + (p.calendar ? ' & Calendar Year Returns' : ''), { x: 0.35, y: 0.14, w: 9, h: 0.45, fontSize: 18, valign: 'middle' })
  hline(s, pptx, 0.35, 0.66, 0.9, B.gold, 1.5)
  const asOf = perf.asOf ? new Date(`${perf.asOf}T00:00:00`).toLocaleDateString('en-US') : ''
  const rowH = 0.32
  const block = (b, title, y) => {
    if (!b) return y
    const cols = b.columns, n = cols.length
    const x0 = 2.75, cw = (9.65 - x0) / n
    eyebrow(s, `${title}${asOf ? ` (as of ${asOf})` : ''}`, { x: 0.35, y, w: 9, h: 0.22, fontSize: 9, color: B.text, charSpacing: 3 })
    y += 0.24
    cols.forEach((c, k) => calibri(s, String(c).toUpperCase(), { x: x0 + k * cw, y, w: cw, h: 0.22, fontSize: 8, charSpacing: 2, align: 'center', valign: 'middle' }))
    y += 0.24
    hline(s, pptx, 0.35, y, 9.3, B.rule, 0.75)
    const rowsDef = [['Gross', b.gross, 'gross'], ['Net', b.net, 'net'], ...p.benchmarks.map((bm) => [bm.label, b[bm.key], 'bm'])]
    rowsDef.forEach(([lab, vals, kind]) => {
      const h = kind === 'bm' ? rowH + 0.06 : rowH
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
  let y = 0.82
  y = block(p.annualized, 'Annualised returns', y)
  y = block(p.calendar, `Calendar year returns — past ${p.calendar?.columns?.length || 5} years`, y)
  const dy = Math.min(Math.max(y + 0.05, 3.6), 4.5)
  calibri(s, p.disclosure, { x: 0.35, y: dy, w: 9.3, h: HT - 0.42 - dy, fontSize: 6.3, lineSpacingMultiple: 1.1 })
}
function proposedOwnership(pptx, a, familyName) {
  const s = base(pptx, { bar: false })
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
  ;['Strategy', 'Manager', 'Alloc', 'Amount'].forEach((t, k) => calibri(s, t.toUpperCase(), { x: cx[k], y: 2.05, w: cw[k], h: 0.22, fontSize: 9, bold: true, color: B.gold, charSpacing: 2, align: k >= 2 ? 'right' : 'left', valign: 'middle' }))
  rows.forEach(([n, m, pct], i) => {
    const y = 2.42 + i * 0.46
    rect(s, pptx, 4.90, y, 4.70, 0.46, i % 2 ? B.tile2 : B.bg, { color: B.tileBorder, width: 0.75 })
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
function cashNeeds(pptx, a) {
  const s = pptx.addSlide(); s.background = { color: B.white }
  footer(s, pptx)
  georgia(s, '5 Year Cash Needs', { x: 0.55, y: 0.78, w: 5, h: 0.6, fontSize: 28, valign: 'middle' })
  hline(s, pptx, 0.55, 1.45, 1.35, B.gold, 2)
  const need = num(a.retirementCashNeed), g = num(a.cashGrowthPct) || 3
  s.addText([{ text: 'Retirement Cash Need: ', options: { color: B.text } }, { text: need ? fmtUsd(need, { compact: true }) : '$—', options: { bold: true, color: B.navy } }], { x: 5.3, y: 0.55, w: 4.3, h: 0.3, fontFace: F, fontSize: 12, margin: 0, valign: 'middle' })
  s.addText([{ text: 'Year 1 Cash on Hand: ', options: { color: B.text } }, { text: a.cashOnHand ? fmtUsd(a.cashOnHand, { compact: true }) : '$—', options: { bold: true, color: B.navy } }], { x: 5.3, y: 0.95, w: 4.3, h: 0.3, fontFace: F, fontSize: 12, margin: 0, valign: 'middle' })
  const yr = new Date().getFullYear()
  for (let i = 0; i < 4; i++) {
    const x = [0.50, 2.88, 5.26, 7.64][i], y = [1.75, 1.67, 1.62, 1.54][i], w = 2.20, h = 5.00 - y
    rect(s, pptx, x, y, w, h, B.tile, { color: 'CCCAC4', width: 0.75 })
    rect(s, pptx, x, y, w, 0.06, B.navy)
    georgia(s, need ? fmtUsd(Math.round(need * Math.pow(1 + g / 100, i + 1)), { compact: true }) : '—', { x: x + 0.1, y: y + 0.28, w: w - 0.2, h: 0.55, fontSize: 24, bold: true, align: 'center', valign: 'middle' })
    hline(s, pptx, x + 0.6, y + 0.92, 1.0, B.gold, 1.5)
    calibri(s, `Year ${i + 2}`, { x: x + 0.1, y: y + 1.05, w: w - 0.2, h: 0.3, fontSize: 12, align: 'center', valign: 'middle' })
    calibri(s, String(yr + i + 1), { x: x + 0.1, y: y + 1.42, w: w - 0.2, h: 0.3, fontSize: 14, bold: true, color: B.gold, align: 'center', valign: 'middle' })
  }
}
function buyOption(pptx) {
  const s = base(pptx, { bar: false })
  header(s, pptx, 'Research reveals opportunity', 'Buy Option Cash Strategy in Down Markets')
  calibri(s, 'Down Market Deployment Logic', { x: 5.15, y: 1.18, w: 4, h: 0.28, fontSize: 11, valign: 'middle' })
  s.addShape(pptx.ShapeType.line, { x: 5.15, y: 1.50, w: 2.05, h: 2.35, line: { color: 'D62728', width: 1.5 } })
  s.addShape(pptx.ShapeType.line, { x: 7.20, y: 1.50, w: 2.20, h: 2.35, flipV: true, line: { color: '2A6B3A', width: 1.5 } })
  ;[[6.55, 3.10], [7.20, 3.85], [9.40, 1.50]].forEach(([cx, cy]) => s.addShape(pptx.ShapeType.ellipse, { x: cx - 0.1, y: cy - 0.1, w: 0.2, h: 0.2, fill: { color: '1F77B4' }, line: { color: '1F77B4', width: 0 } }))
  calibri(s, '(Average duration: 40 months*)', { x: 5.6, y: 4.05, w: 3.4, h: 0.3, fontSize: 10, bold: true, color: B.ink, align: 'center', valign: 'middle' })
  const box = (y, fill, n, t, d, light) => {
    rect(s, pptx, 0.66, y, 4.20, 0.66, fill)
    georgia(s, t, { x: 0.85, y: y + 0.08, w: 3.4, h: 0.26, fontSize: 12, color: light ? B.white : B.navy, valign: 'middle' })
    calibri(s, d, { x: 0.85, y: y + 0.36, w: 3.6, h: 0.24, fontSize: 9, color: light ? B.creamText : B.text, valign: 'middle' })
    calibri(s, n, { x: 4.4, y, w: 0.35, h: 0.66, fontSize: 10, color: light ? B.white : B.navy, align: 'right', valign: 'middle' })
  }
  box(2.76, B.navy, '1', '25% Drop', 'Invest 70% of the last year bond', true)
  box(3.56, B.tile, '2', '40% Drop', 'Invest the remaining 30% of last year bond', false)
  calibri(s, '*40 Months to recovery – "Bear markets may not be as ferocious as they appear", Mark Hulbert, Wall Street Journal, March 8-9, 2014.', { x: 3.0, y: 5.0, w: 6.65, h: 0.22, fontSize: 7, italic: true, color: B.caption, align: 'right', valign: 'middle' })
}
function proposedPerf(pptx, a, familyName) {
  const s = base(pptx, { bar: false })
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
  calibri(s, COPY.riskDisclosure, { x: 2.1, y: 3.95, w: 5.8, h: 1.2, fontSize: 5.6, align: 'center', lineSpacingMultiple: 1.1 })
}
function lifeboat(pptx, a, familyName) {
  const s = base(pptx, { bar: false })
  header(s, pptx, 'Risk assessment', `${shortName({ name: familyName }) || 'The'} Family — Lifeboat Drill`)
  calibri(s, '95% Probability Range  —  6-Month Horizon', { x: LM, y: 1.55, w: 6, h: 0.25, fontSize: 10, valign: 'middle' })
  const total = num(a.portfolioTotal)
  const lossPct = a.lossPct ? `-${String(a.lossPct).replace(/[-%]/g, '')}%` : '—', gainPct = a.gainPct ? `+${String(a.gainPct).replace(/[+%]/g, '')}%` : '—'
  rect(s, pptx, 0.55, 1.91, 2.70, 1.05, B.tile, { color: B.tileBorder, width: 0.75 })
  georgia(s, lossPct, { x: 0.7, y: 2.0, w: 2.4, h: 0.5, fontSize: 26, color: B.red, valign: 'middle' })
  calibri(s, `${a.lossAmt ? '-' + fmtUsd(Math.abs(num(a.lossAmt))) : ''}  Potential Loss`, { x: 0.7, y: 2.58, w: 2.4, h: 0.25, fontSize: 10, color: B.red, valign: 'middle' })
  rect(s, pptx, 3.55, 1.89, 3.00, 1.05, B.bg, { color: B.navy, width: 1 })
  georgia(s, total ? fmtUsd(total) : '$—', { x: 3.6, y: 1.98, w: 2.9, h: 0.5, fontSize: 26, align: 'center', valign: 'middle' })
  eyebrow(s, 'Current portfolio', { x: 3.6, y: 2.56, w: 2.9, h: 0.25, fontSize: 10, align: 'center', valign: 'middle' })
  rect(s, pptx, 6.75, 1.91, 2.70, 1.05, B.tile, { color: B.tileBorder, width: 0.75 })
  georgia(s, gainPct, { x: 6.9, y: 2.0, w: 2.4, h: 0.5, fontSize: 26, color: B.green, valign: 'middle' })
  calibri(s, `${a.gainAmt ? '+' + fmtUsd(Math.abs(num(a.gainAmt))) : ''}  Potential Gain`, { x: 6.9, y: 2.58, w: 2.4, h: 0.25, fontSize: 10, color: B.green, valign: 'middle' })
  rect(s, pptx, 0.55, 3.10, 9.00, 0.30, B.tile, { color: 'CCCAC4', width: 0.5 })
  rect(s, pptx, 0.55, 3.10, 2.60, 0.30, B.redBar, { color: B.redBorder, width: 0.5 })
  rect(s, pptx, 5.38, 3.10, 4.17, 0.30, B.greenBar, { color: B.greenBorder, width: 0.5 })
  rect(s, pptx, 4.28, 3.06, 0.08, 0.38, B.navy)
  calibri(s, 'Current', { x: 3.82, y: 3.50, w: 1.0, h: 0.22, fontSize: 10, color: B.gold, align: 'center', valign: 'middle' })
  calibri(s, COPY.riskDisclosure, { x: LM, y: 4.0, w: 9.0, h: 1.15, fontSize: 5.6, lineSpacingMultiple: 1.1 })
}
function nextStep(pptx, variant, fee, title) {
  const v = COPY[variant]
  const s = base(pptx, { bar: false })
  header(s, pptx, 'Next step', title, { rule: 'full' })
  georgia(s, v.question, { x: LM, y: 1.48, w: 4.4, h: 0.72, fontSize: 12.5, italic: true, color: B.navy2, lineSpacingMultiple: 1.2 })
  v.bullets.forEach(([t, d], i) => {
    const y = 2.38 + i * 0.44
    rect(s, pptx, LM, y, 0.05, 0.26, B.navy)
    calibri(s, t, { x: LM + 0.17, y: y - 0.05, w: 4.3, h: 0.22, fontSize: 10.6, bold: true, color: B.navy, valign: 'middle' })
    calibri(s, d, { x: LM + 0.17, y: y + 0.17, w: 4.3, h: 0.2, fontSize: 9, valign: 'middle' })
    hline(s, pptx, LM + 0.17, y + 0.40, 4.3, B.rule, 0.75)
  })
  v.phases.forEach(([t, d], i) => {
    const x = 5.20, y = [1.40, 2.48, 3.56][i], w = 4.50, h = 0.95
    rect(s, pptx, x, y, w, h, B.tile)
    eyebrow(s, `Phase ${i + 1}`, { x: x + 0.18, y: y + 0.1, w: 2, h: 0.2, fontSize: 10 })
    georgia(s, t, { x: x + 0.18, y: y + 0.3, w: w - 0.36, h: 0.26, fontSize: 11, valign: 'middle' })
    calibri(s, d, { x: x + 0.18, y: y + 0.55, w: w - 0.36, h: 0.4, fontSize: 9, lineSpacingMultiple: 1.15 })
  })
  rect(s, pptx, 5.21, 4.59, 4.50, 0.65, B.navy)
  calibri(s, 'Engagement Investment', { x: 5.38, y: 4.63, w: 3, h: 0.22, fontSize: 10.6, color: B.white, valign: 'middle' })
  georgia(s, fmtUsd(fee), { x: 5.38, y: 4.85, w: 2, h: 0.32, fontSize: 15, color: B.white, valign: 'middle' })
  if (v.delivery) calibri(s, v.delivery, { x: 7.0, y: 4.85, w: 2.6, h: 0.32, fontSize: 9, color: B.white, align: 'right', valign: 'middle' })
}
function gapSummary(pptx, goals, { panel = false } = {}) {
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
function blueprint(pptx, monthly) {
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
function caseStudy(pptx, cs) {
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
async function teamSlides(pptx, roster) {
  const photos = await loadHeadshots(roster)
  ;(roster || []).forEach((p, i) => { p._photo = photos[i] })
  for (const group of chunk(roster || [], 4)) {
    const s = pptx.addSlide(); s.background = { color: B.white }
    footer(s, pptx); rect(s, pptx, 0, 0.41, 0.06, 4.27, B.navy)
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
function pathForward(pptx, steps) {
  const s = base(pptx, { bar: false })
  rect(s, pptx, 0.42, 0.65, 0.06, 4.45, B.navy)
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
function divider(pptx, lines) {
  const s = base(pptx, { navy: true, bar: false })
  const arr = Array.isArray(lines) ? lines : String(lines).split('\n')
  const top = arr.length > 1 ? 1.93 : 2.25
  arr.forEach((t, i) => georgia(s, t, { x: 1.13, y: top + i * 0.72, w: 8.5, h: 0.72, fontSize: 39, color: B.white, valign: 'middle' }))
  hline(s, pptx, 1.12, top + arr.length * 0.72 + 0.28, 1.35, B.gold, 2.5)
}
function simpleTitle(s, pptx, eb, title, { size = 21 } = {}) {
  if (eb) eyebrow(s, eb, { x: 0.45, y: 0.25, w: 8, h: 0.22, fontSize: 10.2 })
  georgia(s, title, { x: 0.45, y: eb ? 0.45 : 0.28, w: 8.5, h: title.includes('\n') ? 0.85 : 0.5, fontSize: size, valign: 'middle', lineSpacingMultiple: 1.1 })
  hline(s, pptx, 0.45, 1.16, 0.98, B.gold, 2.5)
}
function goalsList(pptx, goals) {
  for (const group of chunk(goals, 9)) {
    const s = base(pptx); simpleTitle(s, pptx, '', 'Goals and Intentions')
    group.forEach((g, i) => {
      const y = 1.25 + i * 0.35
      calibri(s, '•', { x: 0.45, y, w: 0.25, h: 0.35, fontSize: 13.5, valign: 'middle' })
      calibri(s, g.text, { x: 0.68, y, w: 8.9, h: 0.35, fontSize: 13.5, valign: 'middle' })
    })
  }
}
function planAnalysisList(pptx, goals) {
  for (const group of chunk(goals, 9)) {
    const s = base(pptx); simpleTitle(s, pptx, 'Current plan analysis', 'Goals and Intentions')
    group.forEach((g, i) => {
      const y = 1.29 + i * 0.345, ok = g.status === 'met'
      text(s, ok ? '✓' : '×', { x: 0.45, y, w: 0.25, h: 0.345, fontFace: F, fontSize: 15.8, bold: true, color: ok ? B.flowGreen : B.redBox, valign: 'middle' })
      calibri(s, g.text, { x: 0.68, y, w: 8.9, h: 0.345, fontSize: 13.1, valign: 'middle' })
    })
  }
}
function goalAnalysis(pptx, g) {
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
function estateTaxSlide(pptx, f, tax) {
  const s = base(pptx); header(s, pptx, 'Financial overview', 'Estate Tax Information', { x: 0.45 })
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
function balanceSheetSlide(pptx, f) {
  const s = base(pptx); header(s, pptx, 'Financial overview', 'Your Current Balance Sheet', { x: 0.45 })
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
async function flowSlide(pptx, fc) {
  const s = pptx.addSlide(); s.background = { color: B.white }
  rect(s, pptx, 0, 0.41, 0.06, 4.27, B.navy)
  return addFlowToSlide(pptx, s, fc, { x: 0.3, y: 0.12, w: 9.4 })
}
function toolPages(pptx, recs) {
  divider(pptx, ['How we close', 'the gaps.'])
  for (const group of chunk(recs, 5)) {
    const s = base(pptx); header(s, pptx, 'Recommended planning tools', 'Priorities, most urgent first', { x: 0.45 })
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
function timelineSlide(pptx, f) {
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
function nextStepsSlide(pptx, steps) {
  const s = base(pptx); header(s, pptx, 'Action plan', 'Next Steps', { x: 0.45 })
  steps.slice(0, 6).forEach((t, i) => {
    const y = 1.36 + i * 0.66
    rect(s, pptx, 0.45, y, 9.10, 0.58, B.tile)
    rect(s, pptx, 0.45, y, 0.05, 0.58, B.gold)
    georgia(s, String(i + 1).padStart(2, '0'), { x: 0.62, y, w: 0.5, h: 0.58, fontSize: 16, bold: true, color: B.gold, valign: 'middle' })
    calibri(s, t, { x: 1.15, y, w: 8.2, h: 0.58, fontSize: 14, color: B.navy, valign: 'middle' })
  })
}
const DEFAULT_NEXT_STEPS = ['Cash Flow and Financial Analysis', 'Generational Impact Retreat', 'Finalize Goals and Intentions', 'Introduction to Advisors', 'Paradiem Planning Day']

function coupleName(f) {
  const p = f.profile || {}
  const a = p.spouse1?.name, b = p.spouse2?.name
  if (a && b) return `${a} & ${b}`
  return a || b || f.name
}
const longDate = (d) => d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''

// ───────────────────────── Assessment deck ─────────────────────────
export async function buildAssessment(f, settings) {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_16x9'
  pptx.author = 'Paradiem'; pptx.company = 'Paradiem, LLC'; pptx.title = `Family Capital Assessment — ${f.name}`
  const logo = await logoData()
  const a = f.assessment || {}
  const fs = settings.feeSchedule || DEFAULT_FEE_SCHEDULE
  const under = f.tier === 'under5'
  const nw = netWorthOf(f)
  cover(pptx, logo, 'Family Capital Assessment', coupleName(f), longDate(a.date))
  disclosures(pptx)
  framework(pptx, { tiles: true })
  if (under) framework(pptx, { tiles: false })
  twoKinds(pptx)
  processSlide(pptx, 1)
  numbersReveal(pptx, settings, f.name)
  if (under && a.numbersSlide !== 'firm') incomeClarity(pptx, a, f.name)
  philosophy(pptx)
  principles(pptx)
  ownersLens(pptx, a.scorecard)
  perfTable(pptx, 'dividend', settings.performance)
  perfTable(pptx, 'growth', settings.performance)
  proposedOwnership(pptx, a, f.name)
  cashNeeds(pptx, a)
  buyOption(pptx)
  proposedPerf(pptx, a, f.name)
  lifeboat(pptx, a, f.name)
  numbersReveal(pptx, settings, f.name)
  const fee = gapFee(nw, fs)
  if (under) nextStep(pptx, a.nextStepVariant === 'B' ? 'nextStepUnder5B' : 'nextStepUnder5A', fee, 'Family Capital Gap Analysis & Blueprint')
  else { nextStep(pptx, 'nextStepOver5', fee, 'Family Capital Gap Analysis'); gapSummary(pptx, f.goals || []); blueprint(pptx) }
  for (const id of (a.caseStudies || [])) { const cs = CASE_STUDIES.find((c) => c.id === id); if (cs) caseStudy(pptx, cs) }
  await teamSlides(pptx, settings.roster)
  if (under) pathForward(pptx, [['Begin the Family Capital Gap Analysis & Blueprint', `${fmtUsd(fee)} engagement`], ['Implement Family Capital Investment', 'Ongoing advisory relationship'], ['Receive Family Capital Gap Analysis & Blueprint', 'Comprehensive Multi-Generational Wealth Roadmap']])
  else pathForward(pptx, [['Schedule Kick-Off call for your Family Capital Gap Analysis', `${fmtUsd(fee)} Investment`], ['Provide Documents, Complete Surveys, Participate in 90-minute Initial Retreat', 'Data Gathering'], ['Receive Your Family Capital Gap Analysis', 'Estimated 2 weeks after step 2 complete']])
  return pptx.write({ outputType: 'blob' })
}

// ───────────────────────── Gap Analysis deck ─────────────────────────
export async function buildGap(f, settings) {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_16x9'
  pptx.author = 'Paradiem'; pptx.company = 'Paradiem, LLC'; pptx.title = `Family Capital Gap Analysis — ${f.name}`
  const logo = await logoData()
  const fs = settings.feeSchedule || DEFAULT_FEE_SCHEDULE
  const gm = f.gapMeta || {}
  const goals = f.goals || []
  const tax = settings.tax?.[new Date().getFullYear()] || Object.values(settings.tax || {})[0] || {}
  cover(pptx, logo, 'Family Capital Gap Analysis', coupleName(f), longDate(gm.date))
  disclosures(pptx)
  twoKinds(pptx)
  processSlide(pptx, 2)
  divider(pptx, ['What you said', 'you want.'])
  goalsList(pptx, goals)
  gapSummary(pptx, goals, { panel: true })
  for (const g of goals) goalAnalysis(pptx, g)
  const recs = (f.recommendations || []).filter((r) => r.status === 'accepted').sort((a, b) => tierRank(a.tier) - tierRank(b.tier))
  if (gm.includeToolPages !== false && recs.length) toolPages(pptx, recs)
  if (gm.includeInvestmentSlides !== false) { perfTable(pptx, 'dividend', settings.performance); perfTable(pptx, 'growth', settings.performance) }
  balanceSheetSlide(pptx, f)
  estateTaxSlide(pptx, f, tax)
  divider(pptx, ['Your Current', 'Estate Flow Chart'])
  let flowNames = null
  const fc = f.flowchart
  if (fc?.nodes?.length) flowNames = await flowSlide(pptx, fc)
  else if (fc?.png) { const s = pptx.addSlide(); s.background = { color: B.white }; s.addImage({ data: fc.png, x: 0.3, y: 0.15, w: 9.4, h: 5.05 }) }
  planAnalysisList(pptx, goals)
  gapSummary(pptx, goals, { panel: true })
  divider(pptx, ["What's top of mind?"])
  await teamSlides(pptx, settings.roster)
  blueprint(pptx, blueprintMonthly(netWorthOf(f), 1, fs))
  divider(pptx, ['Timeline and', 'Next Steps'])
  timelineSlide(pptx, f)
  nextStepsSlide(pptx, (gm.nextSteps || []).filter(Boolean).length ? gm.nextSteps.filter(Boolean) : DEFAULT_NEXT_STEPS)
  const blob = await pptx.write({ outputType: 'blob' })
  const anim = fc?.animation
  if (flowNames && anim?.enabled) return injectAnimation(blob, animationSteps(fc, flowNames), { mode: anim.mode || 'click', effect: anim.effect || 'appear', delayMs: Number(anim.delayMs) || 700 })
  return blob
}
