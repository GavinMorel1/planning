// Deck generator. Rebuilds the Family Capital Assessment and Gap Analysis decks from the
// Paradiem Print & Presentation Guidelines: Georgia headings, Calibri body, parchment
// background, flat square-edged shapes, gold rules, Forest/Oxblood only on status figures.
import PptxGenJS from 'pptxgenjs'
import { BRAND } from './brand'
import { COPY } from '../data/defaults'
import { CASE_STUDIES } from '../data/caseStudies'
import { gapFee, blueprintMonthly, DEFAULT_FEE_SCHEDULE } from './fees'
import { fmtUsd, num } from './util'
import { TIERS, toolById, tierRank } from '../data/tools'
import { netWorthOf, totalAssets, totalLiab, ASSET_TYPES } from '../tabs/Families'

const B = BRAND
const H = B.fontHead, F = B.fontBody
const W = 10, HT = 5.625
const LM = 0.45 // left margin

// ───────────────────────── helpers ─────────────────────────
async function logoData() {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL || '/'}paradiem-logo.png`)
    const b = await r.blob()
    return await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b) })
  } catch { return null }
}
function base(pptx, { dark = false, bar = true, footer = true } = {}) {
  const s = pptx.addSlide()
  s.background = { color: dark ? B.navy : B.parchment }
  if (bar && !dark) s.addShape(pptx.ShapeType.rect, { x: 0, y: 0.32, w: 0.06, h: 4.55, fill: { color: B.navy }, line: { color: B.navy, width: 0 } })
  if (footer) {
    s.addShape(pptx.ShapeType.rect, { x: 0, y: HT - 0.36, w: W, h: 0.36, fill: { color: dark ? B.ink : 'EBE6DA' }, line: { color: dark ? B.ink : 'EBE6DA', width: 0 } })
    s.addText(COPY.footerLeft, { x: 0.3, y: HT - 0.36, w: 5, h: 0.36, fontFace: F, fontSize: 7, color: dark ? B.mist : B.taupe, charSpacing: 3, valign: 'middle' })
    s.addText(COPY.footerRight, { x: 5, y: HT - 0.36, w: 4.7, h: 0.36, fontFace: F, fontSize: 7, color: dark ? B.mist : B.taupe, charSpacing: 3, valign: 'middle', align: 'right' })
  }
  return s
}
function header(s, pptx, eyebrow, title, { dark = false, sub } = {}) {
  if (eyebrow) s.addText(eyebrow.toUpperCase(), { x: LM, y: 0.22, w: 8.5, h: 0.28, fontFace: F, fontSize: 9, bold: true, color: B.gold, charSpacing: 3, valign: 'middle' })
  s.addText(title, { x: LM, y: 0.46, w: 9, h: 0.62, fontFace: H, fontSize: 24, color: dark ? B.parchment : B.navy, valign: 'middle' })
  s.addShape(pptx.ShapeType.line, { x: LM, y: 1.16, w: 1.0, h: 0, line: { color: B.gold, width: 2 } })
  if (sub) s.addText(sub, { x: LM, y: 1.2, w: 9, h: 0.3, fontFace: H, fontSize: 11, italic: true, color: B.taupe, valign: 'middle' })
}
const body = (s, text, o = {}) => s.addText(text, { fontFace: F, fontSize: 12, color: B.ink, valign: 'top', margin: 0, ...o })
const tile = (s, pptx, x, y, w, h, { fill = 'EBE6DA', top = B.navy, topW = 0.05 } = {}) => {
  s.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color: fill }, line: { color: fill, width: 0 } })
  if (top) s.addShape(pptx.ShapeType.rect, { x, y, w: topW ? topW : w, h: topW ? h : 0.04, fill: { color: top }, line: { color: top, width: 0 } })
}
const bullets = (arr) => (arr || []).map((t) => ({ text: t, options: { bullet: { indent: 14 }, breakLine: true } }))
function chunk(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out }
const fmtPctCell = (v) => (v == null || v === '' ? '' : `${Number(v).toFixed(2)}%`)

// ───────────────────────── shared slides ─────────────────────────
function cover(pptx, logo, title, familyName, date) {
  const s = base(pptx, { bar: false })
  if (logo) s.addImage({ data: logo, x: 7.1, y: 0.25, w: 2.55, h: 0.62 })
  s.addText(title, { x: LM, y: 0.75, w: 8, h: 0.7, fontFace: H, fontSize: 32, color: B.navy, valign: 'middle' })
  s.addText(familyName || 'Mr. and Mrs. ________', { x: LM, y: 2.05, w: 8, h: 0.75, fontFace: H, fontSize: 32, color: B.navy, valign: 'middle' })
  s.addShape(pptx.ShapeType.line, { x: LM, y: 2.98, w: 1.15, h: 0, line: { color: B.gold, width: 2 } })
  s.addText(COPY.tagline, { x: LM, y: 3.05, w: 8, h: 0.4, fontFace: F, fontSize: 13, color: B.taupe, valign: 'middle' })
  s.addText(date || '', { x: LM, y: 4.2, w: 6, h: 0.5, fontFace: H, fontSize: 20, color: B.navy, valign: 'middle' })
}
function disclosures(pptx) {
  const s = base(pptx)
  header(s, pptx, 'Disclosures', 'Legal Disclosures & Important Information')
  body(s, COPY.disclosures.map((t) => ({ text: t, options: { breakLine: true, paraSpaceAfter: 5 } })), { x: LM, y: 1.35, w: 9.1, h: 3.8, fontSize: 8.5, color: B.ink, lineSpacingMultiple: 1.08 })
}
function framework(pptx, { tiles = true } = {}) {
  const s = base(pptx)
  header(s, pptx, 'The Framework', 'Family Capital Architecture')
  body(s, 'We identify the gap between:', { x: LM, y: 1.5, w: 4.4, h: 0.3, italic: true, fontSize: 11, color: B.ink })
  const rows = [['What your wealth is doing today', 'PRESENT STATE'], ['What it was designed to accomplish', 'INTENT'], ['How it will impact your family across generations', 'LEGACY HORIZON']]
  rows.forEach(([a, b], i) => {
    const y = 1.95 + i * 0.72
    s.addShape(pptx.ShapeType.rect, { x: LM, y, w: 0.05, h: 0.5, fill: { color: B.navy }, line: { color: B.navy, width: 0 } })
    s.addText(a, { x: LM + 0.18, y, w: 4.4, h: 0.3, fontFace: H, fontSize: 14, color: B.navy, valign: 'middle' })
    s.addText(b, { x: LM + 0.18, y: y + 0.28, w: 4.4, h: 0.22, fontFace: F, fontSize: 8.5, bold: true, color: B.gold, charSpacing: 3, valign: 'middle' })
  })
  if (tiles) {
    const items = [['Hidden Tax Exposure', 'Unrealized tax liabilities that erode generational value'], ['Structural Inefficiencies', 'Disconnected advisors, misaligned strategies'], ['Misaligned Capital', 'Assets not deployed toward your actual intentions'], ['Cost of Inaction', 'What does staying where you are actually cost you?']]
    items.forEach(([t, d], i) => {
      const x = 5.2 + (i % 2) * 2.3, y = 1.5 + Math.floor(i / 2) * 1.5
      tile(s, pptx, x, y, 2.15, 1.3, { topW: 0, top: B.navy })
      s.addText(t, { x: x + 0.12, y: y + 0.12, w: 1.95, h: 0.35, fontFace: H, fontSize: 12, color: B.navy, valign: 'middle' })
      s.addText(d, { x: x + 0.12, y: y + 0.5, w: 1.95, h: 0.7, fontFace: F, fontSize: 9.5, color: B.taupe, valign: 'top' })
    })
  }
}
function twoKinds(pptx) {
  const s = base(pptx, { dark: true, bar: false })
  s.addText('INVESTMENT PHILOSOPHY', { x: LM, y: 0.3, w: 6, h: 0.3, fontFace: F, fontSize: 9, bold: true, color: B.gold, charSpacing: 3 })
  s.addText([{ text: 'Two Kinds', options: { breakLine: true } }, { text: 'of Return', options: { italic: true, color: B.gold } }], { x: LM, y: 0.7, w: 4.5, h: 1.6, fontFace: H, fontSize: 36, color: B.parchment, valign: 'top' })
  const col = (x, eyebrow, title, sub) => {
    s.addText(eyebrow, { x, y: 2.7, w: 4.2, h: 0.28, fontFace: F, fontSize: 8.5, bold: true, color: B.gold, charSpacing: 3 })
    s.addText(title, { x, y: 3.0, w: 4.2, h: 0.5, fontFace: H, fontSize: 18, color: B.parchment, valign: 'middle' })
    s.addText(sub, { x, y: 3.5, w: 4.2, h: 0.35, fontFace: F, fontSize: 11, italic: true, color: B.mist })
  }
  col(LM, 'RETURN ON INVESTMENT', 'Preparing the Money for the Family', 'Most advisors stop here.')
  col(5.1, 'RETURN ON INTENTION', 'Preparing the Family for the Money', 'Where we go further.')
  s.addText([{ text: 'You can have strong returns... ', options: {} }, { text: 'and still fail your family long-term.', options: { italic: true, color: B.gold } }], { x: LM, y: 4.25, w: 9, h: 0.5, fontFace: H, fontSize: 15, color: B.parchment })
}
function process(pptx, current) {
  const s = base(pptx)
  header(s, pptx, 'Our Process', 'Family Capital Architecture')
  const steps = [['01', 'Family Capital Assessment', current === 1 ? "Today's session — mapping the current state of your family and capital." : 'Mapping the current state of your family and capital.'], ['02', 'Family Capital Gap Analysis', 'Deep diagnostic identifying gaps between where you are and where you should be.'], ['03', 'Family Capital Blueprint', 'Your comprehensive multi-generational wealth and legacy roadmap.']]
  steps.forEach(([n, t, d], i) => {
    const x = LM + i * 3.1, y = 1.6
    const active = current === i + 1
    tile(s, pptx, x, y, 2.85, 2.7, { fill: active ? B.cream : 'EBE6DA', top: active ? B.gold : B.navy })
    s.addText(n, { x: x + 0.2, y: y + 0.15, w: 1, h: 0.5, fontFace: H, fontSize: 26, color: B.gold })
    s.addText(t, { x: x + 0.2, y: y + 0.7, w: 2.5, h: 0.7, fontFace: H, fontSize: 15, color: B.navy, valign: 'top' })
    s.addText(d, { x: x + 0.2, y: y + 1.4, w: 2.5, h: 0.9, fontFace: F, fontSize: 10, color: B.taupe, valign: 'top' })
    const tag = active ? 'TODAY' : i + 1 < current ? 'PREVIOUS' : i === 1 ? 'POTENTIAL NEXT STEP' : 'THE OUTCOME'
    s.addText(tag, { x: x + 0.2, y: y + 2.3, w: 2.5, h: 0.25, fontFace: F, fontSize: 8, bold: true, color: active ? B.gold : B.taupe, charSpacing: 3 })
  })
}
function numbersReveal(pptx, settings, familyName) {
  const s = base(pptx, { bar: false, footer: false })
  header(s, pptx, 'What the Numbers Reveal', `${familyName ? familyName.replace(/^The /, '').replace(/ Family$/, '') + ' ' : ''}Family Capital Assessment`)
  s.addText("Average results from serving 100's of families over 40+ years.", { x: LM, y: 1.15, w: 8, h: 0.3, fontFace: H, fontSize: 12, italic: true, color: B.navy })
  const fa = settings.firmAverages
  const cols = [fa.generosity, fa.estateTax, fa.lifetime, fa.failure, fa.performance]
  cols.forEach((c, i) => {
    const x = LM + i * 1.86, y = 1.55, w = 1.72, h = 3.15
    const bad = c.dir === 'down' && i === 3
    s.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color: 'EBE6DA' }, line: { color: 'EBE6DA', width: 0 } })
    s.addShape(pptx.ShapeType.rect, { x, y, w: 0.05, h, fill: { color: bad ? B.oxblood : B.navy }, line: { color: bad ? B.oxblood : B.navy, width: 0 } })
    s.addText(c.pct, { x: x + 0.15, y: y + 0.35, w: w - 0.2, h: 0.6, fontFace: H, fontSize: 26, color: bad ? B.oxblood : B.navy })
    s.addText(c.label, { x: x + 0.15, y: y + 1.0, w: w - 0.2, h: 0.7, fontFace: H, fontSize: 10, color: B.navy, valign: 'top' })
    if (c.footnote) s.addText(c.footnote, { x: x + 0.15, y: y + 1.65, w: w - 0.2, h: 0.3, fontFace: F, fontSize: 7.5, color: B.taupe })
    s.addText(`${fmtUsd(c.amount)} ${c.dir === 'down' ? '▼' : '▲'}`, { x: x + 0.15, y: y + h - 0.5, w: w - 0.2, h: 0.35, fontFace: F, fontSize: 11, bold: true, color: c.dir === 'down' ? B.oxblood : B.forest })
  })
  body(s, `${COPY.hypothetical} ${COPY.firmAveragesFootnote}`, { x: LM, y: 4.78, w: 9.1, h: 0.8, fontSize: 6.5, color: B.taupe, charSpacing: 1 })
}
function incomeClarity(pptx, a, familyName) {
  const s = base(pptx, { bar: false, footer: false })
  header(s, pptx, 'What the Numbers Reveal', `${familyName ? familyName.replace(/^The /, '').replace(/ Family$/, '') + ' ' : ''}Family Capital Assessment`)
  const cols = [['Income', `${a.incomeMonthly ? fmtUsd(a.incomeMonthly) : '$—'}`, '/ mo', 'Income, paid monthly and rising with inflation'], ['Clarity', a.clarityNetWorth ? fmtUsd(a.clarityNetWorth) : '$—', 'net worth', 'Cash Flow, Assets, & Growth Projections all coordinated into one clear picture'], ['Protection', a.protectionPct || '100%', 'of your wishes', "Your wishes documented, your family cared for – and someone in your corner for the things you'd never think to ask."]]
  cols.forEach(([t, big, unit, d], i) => {
    const x = LM + i * 3.05, y = 1.4, w = 2.85, h = 3.2
    s.addShape(pptx.ShapeType.rect, { x, y, w, h, fill: { color: 'EBE6DA' }, line: { color: 'EBE6DA', width: 0 } })
    s.addShape(pptx.ShapeType.rect, { x, y, w: 0.05, h, fill: { color: B.navy }, line: { color: B.navy, width: 0 } })
    s.addText(t, { x: x + 0.2, y: y + 0.25, w: w - 0.3, h: 0.6, fontFace: H, fontSize: 24, color: B.navy })
    s.addText([{ text: big, options: { fontSize: 22 } }, { text: ` ${unit}`, options: { fontSize: 12 } }], { x: x + 0.2, y: y + 1.05, w: w - 0.3, h: 0.6, fontFace: H, color: B.navy })
    s.addText(d, { x: x + 0.2, y: y + 1.8, w: w - 0.35, h: 1.2, fontFace: F, fontSize: 10, color: B.ink, valign: 'top' })
  })
  body(s, COPY.hypothetical, { x: LM, y: 4.78, w: 9.1, h: 0.7, fontSize: 6.5, color: B.taupe, charSpacing: 1 })
}
function philosophy(pptx) {
  const s = base(pptx, { dark: true, bar: false })
  s.addText('INVESTMENT PHILOSOPHY', { x: LM, y: 0.3, w: 6, h: 0.3, fontFace: F, fontSize: 9, bold: true, color: B.gold, charSpacing: 3 })
  s.addText('Family Capital Investment', { x: LM, y: 0.6, w: 8, h: 0.6, fontFace: H, fontSize: 22, color: B.parchment })
  s.addText("We don't INVEST.", { x: LM, y: 1.6, w: 9, h: 0.8, fontFace: H, fontSize: 34, color: B.parchment })
  s.addText('We INTENTIONALLY OWN EXCELLENT COMPANIES.', { x: LM, y: 2.4, w: 9, h: 0.8, fontFace: H, fontSize: 30, italic: true, color: B.gold })
  s.addText('The distinction matters. Investors react to markets. Owners build enduring value with conviction.', { x: LM, y: 3.5, w: 8, h: 0.6, fontFace: F, fontSize: 13, color: B.mist })
}
function principles(pptx) {
  const s = base(pptx)
  header(s, pptx, 'The Three Principles', '3 Principles of Family Capital Investment')
  const cols = [['01', 'Think Like an Owner', 'EXCELLENCE EVALUATION', [['Innovation', 'Creating products/services that benefit consumers?'], ['Inspiration', 'Driven by legacy purpose contributing to human flourishing?'], ['Infrastructure', 'Solid foundation of sound business practices and structure?']]],
    ['02', 'Simplicity Over Complexity', 'OUR OWNERSHIP STRATEGIES', [['25 Stock Dividend Strategy', 'Income-focused ownership of 25 high-quality companies.'], ['25 Stock Growth Strategy', 'Growth-focused ownership of 25 high-conviction companies.'], ['Research-backed', 'Quality over quantity — conviction over diversification.']]],
    ['03', 'Research Reveals Opportunities', 'CONVICTION-BASED DECISIONS', [['Deep Analysis', 'Fundamental research uncovers businesses others may overlook.'], ['Un-Common Sense', 'Current economic environments guide decisions and allocations.'], ['Clear Entry/Exit', 'Defined criteria for when to act — and when to hold.']]]]
  cols.forEach(([n, t, e, items], i) => {
    const x = LM + i * 3.1
    s.addText(n, { x, y: 1.35, w: 0.8, h: 0.45, fontFace: H, fontSize: 22, color: B.gold })
    s.addText(t, { x: x + 0.6, y: 1.35, w: 2.3, h: 0.5, fontFace: H, fontSize: 14, color: B.navy, valign: 'middle' })
    s.addText(e, { x, y: 1.9, w: 2.9, h: 0.25, fontFace: F, fontSize: 8, bold: true, color: B.gold, charSpacing: 2.5 })
    items.forEach(([a, b], k) => {
      const y = 2.25 + k * 0.85
      s.addShape(pptx.ShapeType.rect, { x, y, w: 0.04, h: 0.7, fill: { color: B.navy }, line: { color: B.navy, width: 0 } })
      s.addText(a, { x: x + 0.15, y, w: 2.7, h: 0.28, fontFace: F, fontSize: 11, bold: true, color: B.navy })
      s.addText(b, { x: x + 0.15, y: y + 0.27, w: 2.7, h: 0.45, fontFace: F, fontSize: 9, color: B.taupe, valign: 'top' })
    })
  })
}
function ownersLens(pptx, sc = {}) {
  const s = base(pptx)
  header(s, pptx, 'Think Like an Owner', "An Owner's Lens", { sub: 'Every business you own, evaluated on the three questions a true owner asks.' })
  const items = [['Innovation', 'Creating products and services that benefit consumers?', sc.innovation, 'Holdings broadly serve growing, real-world demand.'], ['Inspiration', 'Driven by long-term vision, not distracted by the issue of the day?', sc.inspiration, 'Driven by legacy purpose and long-term structural tailwinds.'], ['Infrastructure', 'Built on a solid foundation of sound business practices and structure?', sc.infrastructure, 'Most holdings rest on durable balance sheets and disciplined governance.']]
  items.forEach(([t, q, score, note], i) => {
    const x = LM + i * 3.1, y = 1.7
    tile(s, pptx, x, y, 2.85, 2.7, { top: B.navy })
    s.addText(t, { x: x + 0.2, y: y + 0.15, w: 2.5, h: 0.4, fontFace: H, fontSize: 16, color: B.navy })
    s.addText(q, { x: x + 0.2, y: y + 0.55, w: 2.5, h: 0.6, fontFace: F, fontSize: 9.5, color: B.taupe, valign: 'top' })
    s.addText(score ? `${score} / 10` : '— / 10', { x: x + 0.2, y: y + 1.25, w: 2.5, h: 0.55, fontFace: H, fontSize: 24, color: B.navy })
    s.addText(note, { x: x + 0.2, y: y + 1.85, w: 2.5, h: 0.7, fontFace: F, fontSize: 9.5, color: B.ink, valign: 'top' })
  })
  body(s, 'Illustrative scorecard for discussion. Each holding is scored across the three ownership criteria; figures shown are representative.', { x: LM, y: 4.6, w: 9, h: 0.4, fontSize: 8, color: B.taupe })
}
function perfTable(pptx, sleeve, perf) {
  const p = perf[sleeve]; if (!p) return
  const s = base(pptx)
  header(s, pptx, 'Family Capital Investment', p.name + (p.calendar ? ' & Calendar Year Returns' : ''))
  const asOf = perf.asOf ? new Date(`${perf.asOf}T00:00:00`).toLocaleDateString('en-US') : ''
  const block = (b, title, y) => {
    if (!b) return y
    s.addText(`${title.toUpperCase()}${asOf && title === 'Annualised returns' ? ` (AS OF ${asOf})` : ''}`, { x: LM, y, w: 9, h: 0.25, fontFace: F, fontSize: 8, bold: true, color: B.gold, charSpacing: 2.5 })
    const rowsDef = [['Gross', b.gross], ['Net', b.net], ...p.benchmarks.map((bm) => [bm.label, b[bm.key]])]
    const rows = [[{ text: '', options: { fill: { color: B.navy } } }, ...b.columns.map((c) => ({ text: c, options: { bold: true, color: B.parchment, fill: { color: B.navy }, align: 'center' } }))]]
    rowsDef.forEach(([lab, vals], i) => rows.push([{ text: lab, options: { bold: i < 2, color: B.navy, fill: { color: i % 2 ? 'EBE6DA' : B.cream } } }, ...b.columns.map((_, k) => ({ text: fmtPctCell(vals?.[k]), options: { align: 'center', color: (vals?.[k] ?? 0) < 0 ? B.oxblood : B.ink, bold: i < 2, fill: { color: i % 2 ? 'EBE6DA' : B.cream } } }))]))
    const h = 0.26 * rows.length
    s.addTable(rows, { x: LM, y: y + 0.28, w: 9.1, colW: [2.6, ...b.columns.map(() => 6.5 / b.columns.length)], fontFace: F, fontSize: 9, border: { type: 'solid', color: 'D8D0BD', pt: 0.5 }, rowH: 0.26, margin: 0.04, valign: 'middle' })
    return y + 0.28 + h + 0.2
  }
  let y = 1.35
  y = block(p.annualized, 'Annualised returns', y)
  y = block(p.calendar, `Calendar year returns — past ${p.calendar?.columns?.length || 5} years`, y)
  const dy = Math.min(Math.max(y, 4.15), 4.5)
  body(s, p.disclosure, { x: LM, y: dy, w: 9.1, h: 5.22 - dy, fontSize: 6.3, color: B.taupe })
}
function proposedOwnership(pptx, a, familyName) {
  const s = base(pptx)
  const short = (familyName || '').replace(/^The /, '').replace(/ Family$/, '')
  header(s, pptx, `${short} Family Ownership`, `${short} Family Proposed Ownership`)
  const total = num(a.portfolioTotal)
  const rows = [['Dividends', 'Paradiem Dividend Strategy', num(a.dividendPct)], ['Growth', 'Paradiem Growth Strategy', num(a.growthPct)], ['Cash', 'Cash', num(a.cashPct)]]
  s.addText('PORTFOLIO COMPOSITION', { x: LM, y: 1.35, w: 4, h: 0.25, fontFace: F, fontSize: 8, bold: true, color: B.gold, charSpacing: 2.5 })
  if (total > 0) {
    s.addChart(pptx.ChartType.doughnut, [{ name: 'Allocation', labels: rows.map((r) => r[0]), values: rows.map((r) => r[2]) }], { x: LM, y: 1.6, w: 2.6, h: 2.6, holeSize: 55, chartColors: [B.navy, B.gold, B.mist], showLegend: false, showPercent: false, showValue: false, showTitle: false, dataLabelPosition: 'ctr', showLabel: false })
  }
  rows.forEach(([n, , pct], i) => {
    const y = 1.7 + i * 0.75
    s.addShape(pptx.ShapeType.rect, { x: 3.3, y: y + 0.05, w: 0.18, h: 0.18, fill: { color: [B.navy, B.gold, B.mist][i] }, line: { color: [B.navy, B.gold, B.mist][i], width: 0 } })
    s.addText(n, { x: 3.6, y, w: 1.5, h: 0.3, fontFace: F, fontSize: 12, bold: true, color: B.navy })
    s.addText(`${pct.toFixed(1)}%  ${total ? fmtUsd(total * pct / 100) : ''}`, { x: 3.6, y: y + 0.28, w: 2, h: 0.3, fontFace: F, fontSize: 11, color: B.taupe })
  })
  s.addText(`TOTAL  ${total ? fmtUsd(total) : ''}`, { x: 3.6, y: 4.0, w: 2.4, h: 0.3, fontFace: F, fontSize: 12, bold: true, color: B.navy })
  s.addText('PROPOSED OWNERSHIP BREAKDOWN', { x: 6.0, y: 1.35, w: 3.5, h: 0.25, fontFace: F, fontSize: 8, bold: true, color: B.gold, charSpacing: 2.5 })
  const table = [[...['STRATEGY', 'MANAGER', 'ALLOC', 'AMOUNT'].map((t) => ({ text: t, options: { bold: true, color: B.parchment, fill: { color: B.navy }, fontSize: 7 } }))]]
  rows.forEach(([n, m, pct], i) => table.push([{ text: n, options: { bold: true } }, { text: m }, { text: `${pct.toFixed(1)}%`, options: { align: 'right' } }, { text: total ? fmtUsd(total * pct / 100) : '', options: { align: 'right' } }].map((c) => ({ ...c, options: { ...c.options, fill: { color: i % 2 ? 'EBE6DA' : B.cream } } }))))
  table.push([{ text: 'TOTAL', options: { bold: true } }, { text: '' }, { text: '100%', options: { align: 'right', bold: true } }, { text: total ? fmtUsd(total) : '', options: { align: 'right', bold: true } }])
  s.addTable(table, { x: 6.0, y: 1.65, w: 3.6, colW: [0.85, 1.35, 0.6, 0.8], fontFace: F, fontSize: 8.5, border: { type: 'solid', color: 'D8D0BD', pt: 0.5 }, rowH: 0.32, margin: 0.04, valign: 'middle', color: B.ink })
}
function cashNeeds(pptx, a) {
  const s = base(pptx)
  header(s, pptx, 'Family Capital Investment', '5 Year Cash Needs')
  const need = num(a.retirementCashNeed), g = num(a.cashGrowthPct) || 3
  s.addText(`Retirement Cash Need: ${need ? fmtUsd(need, { compact: true }) : '$—'}`, { x: LM, y: 1.4, w: 4.5, h: 0.35, fontFace: H, fontSize: 14, color: B.navy })
  s.addText(`Year 1 Cash on Hand: ${a.cashOnHand ? fmtUsd(a.cashOnHand, { compact: true }) : '$—'}`, { x: 5, y: 1.4, w: 4.5, h: 0.35, fontFace: H, fontSize: 14, color: B.navy })
  const yr = new Date().getFullYear()
  for (let i = 0; i < 5; i++) {
    const x = LM + i * 1.86, y = 2.2, w = 1.7, h = 2.1
    tile(s, pptx, x, y, w, h, { fill: i === 0 ? B.navy : 'EBE6DA', top: i === 0 ? B.gold : B.navy })
    s.addText(need ? fmtUsd(Math.round(need * Math.pow(1 + g / 100, i)), { compact: true }) : '—', { x: x + 0.15, y: y + 0.4, w: w - 0.3, h: 0.6, fontFace: H, fontSize: 24, color: i === 0 ? B.parchment : B.navy, align: 'center' })
    s.addText(`Year ${i + 1}`, { x: x + 0.15, y: y + 1.1, w: w - 0.3, h: 0.3, fontFace: F, fontSize: 11, bold: true, color: i === 0 ? B.gold : B.navy, align: 'center' })
    s.addText(String(yr + i), { x: x + 0.15, y: y + 1.4, w: w - 0.3, h: 0.3, fontFace: F, fontSize: 10, color: i === 0 ? B.mist : B.taupe, align: 'center' })
  }
}
function buyOption(pptx) {
  const s = base(pptx)
  header(s, pptx, 'Research Reveals Opportunity', 'Buy Option Cash Strategy in Down Markets')
  s.addText('Down Market Deployment Logic', { x: LM, y: 1.4, w: 6, h: 0.35, fontFace: H, fontSize: 14, italic: true, color: B.taupe })
  const steps = [['1', '25% Drop', 'Invest 70% of the last year bond'], ['2', '40% Drop', 'Invest the remaining 30% of last year bond']]
  steps.forEach(([n, t, d], i) => {
    const x = LM + i * 4.6, y = 2.0
    tile(s, pptx, x, y, 4.3, 1.9, { top: B.gold })
    s.addText(n, { x: x + 0.25, y: y + 0.2, w: 0.7, h: 0.7, fontFace: H, fontSize: 30, color: B.gold })
    s.addText(t, { x: x + 1.0, y: y + 0.25, w: 3, h: 0.5, fontFace: H, fontSize: 20, color: B.navy })
    s.addText(d, { x: x + 1.0, y: y + 0.85, w: 3.1, h: 0.8, fontFace: F, fontSize: 12, color: B.ink, valign: 'top' })
  })
  body(s, '(Average duration: 40 months*)  *40 Months to recovery – "Bear markets may not be as ferocious as they appear", Mark Hulbert, Wall Street Journal, March 8-9, 2014.', { x: LM, y: 4.3, w: 9, h: 0.5, fontSize: 8.5, color: B.taupe })
}
function proposedPerf(pptx, a, familyName) {
  const s = base(pptx)
  header(s, pptx, (familyName || '').replace(/^The /, '') || 'Family', 'Proposed Portfolio Performance')
  const stats = [[a.potentialReturn, 'Total Potential Return'], [a.annualReturn, 'Potential Annual Return'], [a.dividendYield, 'Annual Dividend Yield']]
  stats.forEach(([v, l], i) => {
    const x = LM + i * 3.1, y = 1.5
    tile(s, pptx, x, y, 2.85, 1.6, { top: B.navy })
    s.addText(v ? `${String(v).replace('%', '')}%` : '—', { x: x + 0.2, y: y + 0.2, w: 2.5, h: 0.7, fontFace: H, fontSize: 30, color: B.navy })
    s.addText(l, { x: x + 0.2, y: y + 0.95, w: 2.5, h: 0.4, fontFace: F, fontSize: 11, color: B.taupe })
  })
  body(s, COPY.riskDisclosure, { x: LM, y: 3.3, w: 9.1, h: 1.8, fontSize: 6.8, color: B.taupe })
}
function lifeboat(pptx, a, familyName) {
  const s = base(pptx)
  header(s, pptx, 'Risk Assessment', `${(familyName || 'Family').replace(/^The /, '')} — Lifeboat Drill`, { sub: '95% Probability Range — 6-Month Horizon' })
  const total = num(a.portfolioTotal)
  s.addText(total ? fmtUsd(total) : '$—', { x: LM, y: 1.7, w: 3.2, h: 0.6, fontFace: H, fontSize: 26, color: B.navy })
  s.addText('CURRENT PORTFOLIO', { x: LM, y: 2.3, w: 3, h: 0.25, fontFace: F, fontSize: 8, bold: true, color: B.gold, charSpacing: 2.5 })
  const box = (x, pct, amt, label, color) => {
    tile(s, pptx, x, 1.7, 2.7, 1.5, { top: color })
    s.addText(pct ? `${pct > 0 || String(pct).startsWith('+') ? '+' : ''}${String(pct).replace('%', '').replace('+', '')}%` : '—', { x: x + 0.2, y: 1.85, w: 2.4, h: 0.6, fontFace: H, fontSize: 26, color })
    s.addText(`${amt ? (color === B.forest ? '+' : '-') + fmtUsd(Math.abs(num(amt))) : ''}  ${label}`, { x: x + 0.2, y: 2.5, w: 2.4, h: 0.4, fontFace: F, fontSize: 11, color: B.ink })
  }
  box(4.0, a.gainPct, a.gainAmt, 'Potential Gain', B.forest)
  box(6.9, a.lossPct ? `-${String(a.lossPct).replace('-', '')}` : '', a.lossAmt, 'Potential Loss', B.oxblood)
  body(s, COPY.riskDisclosure, { x: LM, y: 3.45, w: 9.1, h: 1.7, fontSize: 6.8, color: B.taupe })
}
function nextStep(pptx, variant, fee, title) {
  const v = COPY[variant]
  const s = base(pptx)
  header(s, pptx, 'Next Step', title)
  s.addText(v.question, { x: LM, y: 1.35, w: 4.2, h: 0.75, fontFace: H, fontSize: 13, italic: true, color: B.navy, valign: 'top' })
  v.bullets.forEach(([t, d], i) => {
    const y = 2.2 + i * 0.55
    s.addShape(pptx.ShapeType.rect, { x: LM, y, w: 0.04, h: 0.42, fill: { color: B.navy }, line: { color: B.navy, width: 0 } })
    s.addText(t, { x: LM + 0.15, y, w: 4.1, h: 0.22, fontFace: F, fontSize: 10, bold: true, color: B.navy })
    s.addText(d, { x: LM + 0.15, y: y + 0.2, w: 4.1, h: 0.25, fontFace: F, fontSize: 8, color: B.taupe })
  })
  v.phases.forEach(([t, d], i) => {
    const x = 5.15, y = 1.35 + i * 0.95, w = 4.4, h = 0.85
    tile(s, pptx, x, y, w, h, { top: B.gold })
    s.addText(`PHASE ${i + 1}`, { x: x + 0.15, y: y + 0.05, w: 2, h: 0.2, fontFace: F, fontSize: 7.5, bold: true, color: B.gold, charSpacing: 2.5 })
    s.addText(t, { x: x + 0.15, y: y + 0.22, w: w - 0.3, h: 0.25, fontFace: H, fontSize: 11, color: B.navy })
    s.addText(d, { x: x + 0.15, y: y + 0.46, w: w - 0.3, h: 0.4, fontFace: F, fontSize: 7.5, color: B.taupe, valign: 'top' })
  })
  s.addShape(pptx.ShapeType.rect, { x: 5.15, y: 4.25, w: 4.4, h: 0.65, fill: { color: B.navy }, line: { color: B.navy, width: 0 } })
  s.addText('Engagement Investment', { x: 5.3, y: 4.27, w: 2.5, h: 0.25, fontFace: F, fontSize: 9, color: B.parchment })
  s.addText(fmtUsd(fee), { x: 5.3, y: 4.5, w: 2, h: 0.35, fontFace: H, fontSize: 16, color: B.parchment })
  if (v.delivery) s.addText(v.delivery, { x: 7.2, y: 4.5, w: 2.3, h: 0.35, fontFace: F, fontSize: 8, color: B.mist, align: 'right', valign: 'middle' })
}
function gapSummary(pptx, goals) {
  const total = goals.length, met = goals.filter((g) => g.status === 'met').length, missed = goals.filter((g) => g.status === 'missed').length
  const cost = goals.reduce((sum, g) => sum + (g.status === 'missed' ? num(g.cost?.amount) : 0), 0)
  const s = base(pptx)
  header(s, pptx, 'Family Capital Gap Analysis', 'Gap Analysis of Your Current Goals', { sub: "Based on today's assessment, here is where your current plan stands:" })
  if (total) s.addChart(pptx.ChartType.doughnut, [{ name: 'Goals', labels: ['Met', 'Missed', 'Open'], values: [met, missed, Math.max(0, total - met - missed)] }], { x: LM + 0.2, y: 1.55, w: 3.0, h: 3.0, holeSize: 62, chartColors: [B.forest, B.oxblood, B.mist], showLegend: false, showPercent: false, showValue: false, showTitle: false, showLabel: false })
  s.addText([{ text: String(total), options: { fontSize: 26, fontFace: H, color: B.navy, breakLine: true } }, { text: 'Total Goals', options: { fontSize: 9, fontFace: F, color: B.taupe } }], { x: LM + 0.2, y: 2.55, w: 3.0, h: 1.0, align: 'center', valign: 'middle' })
  const box = (y, n, label, cap, color) => {
    s.addShape(pptx.ShapeType.rect, { x: 4.6, y, w: 4.95, h: 1.35, fill: { color: color === B.forest ? 'EAF1EC' : 'F5E9E8' }, line: { color, width: 1 } })
    s.addShape(pptx.ShapeType.rect, { x: 4.6, y, w: 4.95, h: 0.05, fill: { color }, line: { color, width: 0 } })
    s.addText(String(n), { x: 4.8, y: y + 0.15, w: 1.2, h: 0.8, fontFace: H, fontSize: 40, color })
    s.addText(label, { x: 6.1, y: y + 0.25, w: 3.2, h: 0.4, fontFace: F, fontSize: 15, color })
    s.addText(cap, { x: 4.8, y: y + 1.0, w: 4.5, h: 0.25, fontFace: F, fontSize: 7.5, bold: true, color, charSpacing: 2.5 })
  }
  box(1.5, met, 'Goals Met', 'CURRENT PLAN STATUS', B.forest)
  box(3.05, missed, 'Goals Missed', 'OPPORTUNITY TO IMPROVE', B.oxblood)
  s.addShape(pptx.ShapeType.rect, { x: LM, y: 4.6, w: 9.1, h: 0.45, fill: { color: B.cream }, line: { color: B.navy, width: 1 } })
  s.addText('TOTAL COST OF INACTION:', { x: LM + 0.2, y: 4.6, w: 4, h: 0.45, fontFace: F, fontSize: 9, bold: true, color: B.navy, charSpacing: 2.5, valign: 'middle' })
  s.addText(fmtUsd(cost), { x: 5.5, y: 4.6, w: 3.9, h: 0.45, fontFace: H, fontSize: 18, bold: true, color: B.oxblood, align: 'right', valign: 'middle' })
}
function blueprint(pptx, monthly, feeNote) {
  const s = base(pptx)
  header(s, pptx, 'The Full Scope of Engagement', 'Family Capital Blueprint')
  COPY.blueprint.columns.forEach((c, i) => {
    const x = LM + i * 3.1
    s.addText(c.title, { x, y: 1.35, w: 2.85, h: 0.55, fontFace: H, fontSize: 13, color: B.navy, align: 'center', valign: 'middle' })
    s.addShape(pptx.ShapeType.line, { x: x + 0.1, y: 1.95, w: 2.65, h: 0, line: { color: B.navy, width: 1 } })
    c.items.forEach((it, k) => {
      const y = 2.1 + k * 0.42
      s.addShape(pptx.ShapeType.rect, { x, y, w: 2.85, h: 0.34, fill: { color: 'EBE6DA' }, line: { color: 'EBE6DA', width: 0 } })
      s.addShape(pptx.ShapeType.rect, { x, y, w: 0.04, h: 0.34, fill: { color: B.navy }, line: { color: B.navy, width: 0 } })
      s.addText(it, { x: x + 0.15, y, w: 2.6, h: 0.34, fontFace: F, fontSize: 9, color: B.ink, valign: 'middle' })
    })
  })
  s.addShape(pptx.ShapeType.rect, { x: LM, y: 4.45, w: 4.6, h: 0.65, fill: { color: B.navy }, line: { color: B.navy, width: 0 } })
  s.addText('Engagement Investment', { x: LM + 0.15, y: 4.47, w: 3, h: 0.25, fontFace: F, fontSize: 9, color: B.parchment })
  s.addText(`${fmtUsd(monthly)} / mo. – (1st 12 Months)`, { x: LM + 0.15, y: 4.7, w: 4.3, h: 0.35, fontFace: H, fontSize: 15, color: B.parchment })
  if (feeNote) s.addText(feeNote, { x: 5.3, y: 4.75, w: 4.2, h: 0.3, fontFace: F, fontSize: 7, italic: true, color: B.taupe, align: 'right' })
}
function caseStudy(pptx, cs) {
  const s = base(pptx)
  header(s, pptx, 'Case Study', cs.family, { sub: cs.archetype.toUpperCase() })
  s.addText('ORIGINAL SITUATION', { x: LM, y: 1.55, w: 4, h: 0.25, fontFace: F, fontSize: 8, bold: true, color: B.gold, charSpacing: 2.5 })
  cs.situation.forEach((t, i) => {
    const y = 1.85 + i * 0.5
    s.addShape(pptx.ShapeType.rect, { x: LM, y: y + 0.05, w: 0.04, h: 0.35, fill: { color: B.navy }, line: { color: B.navy, width: 0 } })
    s.addText(t, { x: LM + 0.15, y, w: 4.1, h: 0.48, fontFace: F, fontSize: 8.5, color: B.ink, valign: 'middle' })
  })
  s.addText('RESULTS WITH PARADIEM', { x: 5.05, y: 1.55, w: 4, h: 0.25, fontFace: F, fontSize: 8, bold: true, color: B.gold, charSpacing: 2.5 })
  cs.results.forEach((r, i) => {
    const x = 5.05 + (i % 2) * 2.3, y = 1.85 + Math.floor(i / 2) * 0.98, good = r.dir === 'up' || /Eliminated|-100/.test(r.value) || /Tax/.test(r.label) && r.dir === 'down'
    const col = good ? B.forest : B.oxblood
    s.addShape(pptx.ShapeType.rect, { x, y, w: 2.15, h: 0.85, fill: { color: good ? 'EAF1EC' : 'F5E9E8' }, line: { color: col, width: 0.75 } })
    s.addText(r.label, { x: x + 0.12, y: y + 0.05, w: 1.95, h: 0.25, fontFace: F, fontSize: 8, color: B.taupe })
    s.addText(`${r.value} ${r.dir === 'up' ? '▲' : '▼'}`, { x: x + 0.12, y: y + 0.32, w: 1.95, h: 0.45, fontFace: H, fontSize: 16, color: col })
  })
  body(s, COPY.caseStudyFootnote, { x: LM, y: 4.85, w: 9, h: 0.3, fontSize: 7, color: B.taupe })
}
function teamSlides(pptx, roster) {
  for (const group of chunk(roster || [], 4)) {
    const s = base(pptx)
    header(s, pptx, '', 'Your Team & Advocates')
    group.forEach((p, i) => {
      const x = LM + i * 2.3, y = 1.5, w = 2.1, h = 3.3
      tile(s, pptx, x, y, w, h, { fill: 'EBE6DA', top: B.navy, topW: 0 })
      s.addShape(pptx.ShapeType.ellipse, { x: x + 0.55, y: y + 0.35, w: 1.0, h: 1.0, fill: { color: 'D8D0BD' }, line: { color: 'D8D0BD', width: 0 } })
      s.addShape(pptx.ShapeType.line, { x: x + 0.4, y: y + 1.6, w: 1.3, h: 0, line: { color: B.gold, width: 1.5 } })
      s.addText(p.name, { x: x + 0.1, y: y + 1.7, w: w - 0.2, h: 0.5, fontFace: H, fontSize: 13, bold: true, color: B.navy, align: 'center', valign: 'middle' })
      s.addText(p.title, { x: x + 0.1, y: y + 2.2, w: w - 0.2, h: 0.8, fontFace: F, fontSize: 9.5, color: B.taupe, align: 'center', valign: 'top' })
    })
    body(s, 'Headshots: replace the grey circles with team photos in PowerPoint.', { x: LM, y: 4.9, w: 6, h: 0.25, fontSize: 6.5, color: B.mist })
  }
}
function pathForward(pptx, steps) {
  const s = base(pptx)
  s.addText('PARADIEM  ×  NEXT STEPS', { x: LM, y: 0.3, w: 6, h: 0.3, fontFace: F, fontSize: 9, bold: true, color: B.gold, charSpacing: 3 })
  s.addText([{ text: 'Your', options: { breakLine: true } }, { text: 'Path Forward', options: { italic: true, color: B.gold } }], { x: LM, y: 0.65, w: 4, h: 1.5, fontFace: H, fontSize: 30, color: B.navy })
  steps.forEach(([t, d], i) => {
    const y = 1.5 + i * 1.05
    s.addText(String(i + 1), { x: 4.6, y, w: 0.6, h: 0.6, fontFace: H, fontSize: 26, color: B.gold })
    s.addText(t, { x: 5.3, y, w: 4.2, h: 0.4, fontFace: H, fontSize: 14, color: B.navy, valign: 'middle' })
    s.addText(d, { x: 5.3, y: y + 0.4, w: 4.2, h: 0.5, fontFace: F, fontSize: 10, color: B.taupe, valign: 'top' })
  })
}
function divider(pptx, text, note) {
  const s = base(pptx, { bar: true })
  s.addText(text, { x: LM, y: 1.6, w: 9, h: 1.4, fontFace: H, fontSize: 36, color: B.navy, valign: 'middle' })
  if (note) s.addText(note, { x: LM, y: 3.1, w: 9, h: 1.5, fontFace: F, fontSize: 12, color: B.ink, valign: 'top' })
}

// ───────────────────────── Assessment deck ─────────────────────────
export async function buildAssessment(f, settings) {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_16x9'
  pptx.author = 'Paradiem'; pptx.company = 'Paradiem, LLC'; pptx.title = `Family Capital Assessment — ${f.name}`
  const logo = await logoData()
  const a = f.assessment || {}
  const fs = settings.feeSchedule || DEFAULT_FEE_SCHEDULE
  const under = f.tier === 'under5'
  const dateStr = a.date ? new Date(`${a.date}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''
  const nw = netWorthOf(f)
  cover(pptx, logo, 'Family Capital Assessment', coupleName(f), dateStr)
  disclosures(pptx)
  framework(pptx, { tiles: true })
  if (under) framework(pptx, { tiles: false })
  twoKinds(pptx)
  process(pptx, 1)
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
  if (under) numbersReveal(pptx, settings, f.name)
  const fee = gapFee(nw, fs)
  if (under) nextStep(pptx, a.nextStepVariant === 'B' ? 'nextStepUnder5B' : 'nextStepUnder5A', fee, 'Family Capital Gap Analysis & Blueprint')
  else { nextStep(pptx, 'nextStepOver5', fee, 'Family Capital Gap Analysis'); if ((f.goals || []).some((g) => g.status !== 'open')) gapSummary(pptx, f.goals); blueprint(pptx, blueprintMonthly(nw, 1, fs), fs.note) }
  for (const id of (a.caseStudies || [])) { const cs = CASE_STUDIES.find((c) => c.id === id); if (cs) caseStudy(pptx, cs) }
  teamSlides(pptx, settings.roster)
  if (under) pathForward(pptx, [['Begin the Family Capital Gap Analysis & Blueprint', `${fmtUsd(fee)} engagement`], ['Implement Family Capital Investment', 'Ongoing advisory relationship'], ['Receive Family Capital Gap Analysis & Blueprint', 'Comprehensive Multi-Generational Wealth Roadmap']])
  else pathForward(pptx, [['Schedule Kick-Off call for your Family Capital Gap Analysis', `${fmtUsd(fee)} Investment`], ['Data Gathering', 'Provide Documents, Complete Surveys, Participate in 90-minute Initial Retreat'], ['Receive Your Family Capital Gap Analysis', 'Estimated 2 weeks after step 2 complete']])
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
  const dateStr = gm.date ? new Date(`${gm.date}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''
  const tax = settings.tax?.[new Date().getFullYear()] || Object.values(settings.tax || {})[0] || {}
  cover(pptx, logo, 'Family Capital Gap Analysis', coupleName(f), dateStr)
  disclosures(pptx)
  twoKinds(pptx)
  process(pptx, 2)
  divider(pptx, 'What you said\nyou want.')
  for (const group of chunk(goals, 9)) {
    const s = base(pptx); header(s, pptx, '', 'Goals and Intentions')
    body(s, bullets(group.map((g) => g.text)), { x: LM, y: 1.4, w: 9.1, h: 3.7, fontSize: 12, color: B.ink, paraSpaceAfter: 6 })
  }
  gapSummary(pptx, goals)
  for (const g of goals) {
    const s = base(pptx)
    s.addText('Goals and Intentions\nAnalysis', { x: LM, y: 0.3, w: 6, h: 0.85, fontFace: H, fontSize: 20, color: B.navy, valign: 'top' })
    s.addShape(pptx.ShapeType.line, { x: LM, y: 1.2, w: 1.0, h: 0, line: { color: B.gold, width: 2 } })
    s.addShape(pptx.ShapeType.rect, { x: LM, y: 1.3, w: 9.1, h: 0.6, fill: { color: 'EBE6DA' }, line: { color: 'EBE6DA', width: 0 } })
    s.addText(g.text, { x: LM + 0.15, y: 1.3, w: 8.8, h: 0.6, fontFace: H, fontSize: 13, color: B.navy, valign: 'middle' })
    let y = 2.05
    if (g.observations?.length) {
      s.addText('Observations', { x: LM, y, w: 4, h: 0.28, fontFace: F, fontSize: 12, bold: true, color: B.navy }); y += 0.28
      const h = Math.min(1.6, 0.26 * g.observations.length + 0.1)
      body(s, bullets(g.observations), { x: LM, y, w: 9.1, h, fontSize: 10.5, color: B.ink }); y += h + 0.1
    }
    if (g.challenges?.length) {
      s.addText('Potential Challenges', { x: LM, y, w: 4, h: 0.28, fontFace: F, fontSize: 12, bold: true, color: B.oxblood }); y += 0.28
      const h = Math.min(1.0, 0.26 * g.challenges.length + 0.1)
      body(s, bullets(g.challenges), { x: LM, y, w: 9.1, h, fontSize: 10.5, color: B.ink }); y += h + 0.1
    }
    if (num(g.cost?.amount) > 0) {
      const yy = Math.min(y, 4.25)
      s.addShape(pptx.ShapeType.rect, { x: LM, y: yy, w: 9.1, h: 0.75, fill: { color: 'F5E9E8' }, line: { color: B.oxblood, width: 0.75 } })
      s.addText(`Potential Cost of Inaction   ${fmtUsd(g.cost.amount)}`, { x: LM + 0.15, y: yy + 0.05, w: 8.8, h: 0.32, fontFace: H, fontSize: 13, color: B.oxblood })
      if (g.cost.basis) s.addText(g.cost.basis, { x: LM + 0.15, y: yy + 0.36, w: 8.8, h: 0.36, fontFace: F, fontSize: 9, color: B.ink, valign: 'top' })
    }
  }
  // Recommended tools
  const recs = (f.recommendations || []).filter((r) => r.status === 'accepted').sort((a, b) => tierRank(a.tier) - tierRank(b.tier))
  if (gm.includeToolPages !== false && recs.length) {
    divider(pptx, 'How we close\nthe gaps.', 'The planning tools we recommend for your family, in the order we would start.')
    for (const group of chunk(recs, 5)) {
      const s = base(pptx); header(s, pptx, 'Recommended Planning Tools', 'Priorities, most urgent first')
      group.forEach((r, i) => {
        const y = 1.35 + i * 0.74
        const tier = TIERS.find((t) => t.id === r.tier)
        const col = r.tier === 'Protect' ? B.oxblood : r.tier === 'Deadline' ? B.gold : B.navy
        s.addShape(pptx.ShapeType.rect, { x: LM, y, w: 9.1, h: 0.66, fill: { color: i % 2 ? B.cream : 'EBE6DA' }, line: { color: 'EBE6DA', width: 0 } })
        s.addShape(pptx.ShapeType.rect, { x: LM, y, w: 0.05, h: 0.66, fill: { color: col }, line: { color: col, width: 0 } })
        s.addText(r.name, { x: LM + 0.15, y: y + 0.03, w: 6.5, h: 0.28, fontFace: H, fontSize: 11.5, color: B.navy, valign: 'middle' })
        s.addText((tier?.label || r.tier).toUpperCase(), { x: 7.3, y: y + 0.06, w: 2.2, h: 0.22, fontFace: F, fontSize: 7.5, bold: true, color: col, charSpacing: 2, align: 'right' })
        s.addText(r.rationale || toolById(r.toolId)?.summary || '', { x: LM + 0.15, y: y + 0.3, w: 8.8, h: 0.36, fontFace: F, fontSize: 8.5, color: B.ink, valign: 'top' })
      })
    }
  }
  if (gm.includeInvestmentSlides !== false) { perfTable(pptx, 'dividend', settings.performance); perfTable(pptx, 'growth', settings.performance) }
  // Balance sheet
  {
    const s = base(pptx); header(s, pptx, 'Financial Overview', 'Your Current Balance Sheet')
    const assets = f.balanceSheet?.assets || [], liab = f.balanceSheet?.liabilities || []
    const hdr = (t) => ({ text: t, options: { bold: true, color: B.parchment, fill: { color: B.navy }, fontSize: 8 } })
    const rows = [[hdr('ASSET'), hdr('TYPE'), hdr('OWNER'), hdr('VALUE')]]
    assets.forEach((a, i) => rows.push([{ text: a.name || '' }, { text: ASSET_TYPES.find((t) => t.value === a.type)?.label || a.type }, { text: a.owner || '' }, { text: fmtUsd(a.value), options: { align: 'right' } }].map((c) => ({ ...c, options: { ...c.options, fill: { color: i % 2 ? 'EBE6DA' : B.cream } } }))))
    rows.push([{ text: 'Total assets', options: { bold: true } }, { text: '' }, { text: '' }, { text: fmtUsd(totalAssets(f)), options: { bold: true, align: 'right' } }])
    liab.forEach((l, i) => rows.push([{ text: l.name || '' }, { text: 'Liability' }, { text: '' }, { text: `(${fmtUsd(l.value)})`, options: { align: 'right', color: B.oxblood } }].map((c) => ({ ...c, options: { ...c.options, fill: { color: i % 2 ? 'EBE6DA' : B.cream } } }))))
    rows.push([{ text: 'Net worth', options: { bold: true, color: B.navy } }, { text: '' }, { text: '' }, { text: fmtUsd(netWorthOf(f)), options: { bold: true, align: 'right', color: B.navy } }])
    if (rows.length > 1) s.addTable(rows, { x: LM, y: 1.35, w: 9.1, colW: [3.6, 2.2, 1.5, 1.8], fontFace: F, fontSize: 8.5, border: { type: 'solid', color: 'D8D0BD', pt: 0.5 }, rowH: 0.24, margin: 0.03, valign: 'middle', color: B.ink, autoPage: true, autoPageRepeatHeader: true })
    else body(s, 'Balance sheet not yet entered.', { x: LM, y: 1.5, w: 6, h: 0.4, color: B.taupe })
  }
  // Estate tax info
  {
    const s = base(pptx); header(s, pptx, 'Financial Overview', 'Estate Tax Information')
    ;['s1', 's2'].forEach((k, i) => {
      const e = f.estateTax?.[k] || {}, name = f.profile?.[`spouse${i + 1}`]?.name || (i ? "Wife's" : "Husband's")
      const x = LM + i * 4.7, y = 1.4
      s.addShape(pptx.ShapeType.rect, { x, y, w: 4.4, h: 0.35, fill: { color: B.navy }, line: { color: B.navy, width: 0 } })
      s.addText(name.endsWith('s') ? name : `${name}'s`, { x: x + 0.12, y, w: 4.2, h: 0.35, fontFace: H, fontSize: 13, color: B.parchment, valign: 'middle' })
      const rows = [['Applicable Credit Amount Used', fmtUsd(num(e.creditUsed))], ['GST Exemption Used', fmtUsd(num(e.gstUsed))], ['Applicable Credit Available', fmtUsd((tax.estateExemption || 0) - num(e.creditUsed))], ['GST Exemption Available', fmtUsd((tax.gstExemption || 0) - num(e.gstUsed))]]
      rows.forEach(([l, v], r) => {
        const yy = y + 0.35 + r * 0.38
        s.addShape(pptx.ShapeType.rect, { x, y: yy, w: 4.4, h: 0.38, fill: { color: r % 2 ? 'EBE6DA' : B.cream }, line: { color: 'D8D0BD', width: 0.5 } })
        s.addText(l, { x: x + 0.12, y: yy, w: 2.8, h: 0.38, fontFace: F, fontSize: 10, color: B.ink, valign: 'middle' })
        s.addText(v, { x: x + 2.8, y: yy, w: 1.5, h: 0.38, fontFace: F, fontSize: 10, bold: true, color: B.navy, align: 'right', valign: 'middle' })
      })
    })
  }
  divider(pptx, 'Your Current\nEstate Flow Chart')
  if (f.flowchart?.png) {
    const s = base(pptx, { bar: false })
    s.addImage({ data: f.flowchart.png, x: 0.3, y: 0.15, w: 9.4, h: 5.05 })
  }
  // Current plan analysis check / x
  for (const group of chunk(goals, 9)) {
    const s = base(pptx); header(s, pptx, 'Current Plan Analysis', 'Goals and Intentions')
    body(s, group.map((g) => ({ text: `${g.status === 'met' ? '✓' : '×'}  ${g.text}`, options: { breakLine: true, color: g.status === 'met' ? B.forest : B.oxblood } })), { x: LM, y: 1.4, w: 9.1, h: 3.7, fontSize: 12, paraSpaceAfter: 6 })
  }
  gapSummary(pptx, goals)
  divider(pptx, "What's top of mind?", gm.topOfMind || '')
  teamSlides(pptx, settings.roster)
  blueprint(pptx, blueprintMonthly(netWorthOf(f), 1, fs), fs.note)
  return pptx.write({ outputType: 'blob' })
}

function coupleName(f) {
  const p = f.profile || {}
  const a = p.spouse1?.name, b = p.spouse2?.name
  if (a && b) return `${a} & ${b}`
  return a || b || f.name
}
