// Slides specific to the Family Capital Assessment for families under $5M (and shared slides that
// were re-measured on that deck). Every position, size and colour below was measured from the
// reference PDF "Family Capital Assessment – less than $5 million" (inches on a 10 × 5.625 slide).
import { B, H, F, base, footer, INVEST_FOOT, kit, rect, hline, T, eyebrow, georgia, calibri, arrow, numFootnote } from './deckkit'
import { fmtUsd, num } from './util'
import { wrap } from './flow'
import { aumTiers } from './fees'

const N2 = '1B1836', GREY = '8C8C8C', BORD = 'CCC9C1', INK2 = '1C1D32', GOLD2 = 'C0A24C', OLIVE = 'B2A26F'
const st = (c, w = 0.75) => ({ color: c, width: w })
const pct2 = (v) => (v === '' || v == null || isNaN(Number(v)) ? '—' : `${Number(v).toFixed(2).replace(/\.00$/, '') }%`)
const nameOf = (a, f) => (a.familyShort || (f?.name || '').replace(/^The /, '').replace(/ Family$/, '')).trim() || 'NAME'
const whiteBase = (pptx, foot) => { kit.next = { bg: B.white, bar: false, ...(foot || { foot: false }) }; return base(pptx, { bar: false }) }

// ── Think Like an Owner (Matthew 25:14–30) ─────────────────────────────────────────────
export function matthew(pptx, part, icon) {
  const s = whiteBase(pptx)
  eyebrow(s, 'Matthew 25:14–30', { x: 0.55, y: 0.25, w: 5, h: 0.2, fontSize: 11 })
  T(s, 'Think Like an Owner', 0.55, 0.52, 6, { fontFace: H, fontSize: 26, color: B.navy })
  const rows = part === 1
    ? [{ n: 5, x: 2.16, y: 1.84, v: '$5 million', ty: 1.89, vx: 4.68 }, { n: 2, x: 2.15, y: 2.62, v: '$2 million', ty: 2.65, vx: 3.27 }, { n: 1, x: 2.15, y: 3.47, v: '$1 million', ty: 3.57, vx: 2.75 }]
    : [{ n: 10, x: 2.16, y: 1.84, v: '$10 million', ty: 1.94, vx: 6.85 }, { n: 4, x: 2.15, y: 2.62, v: '$4 million', ty: 2.69, vx: 4.10 }, { n: 1, x: 2.15, y: 3.47, v: '$1 million', ty: 3.57, vx: 2.75 }]
  const labelY = [1.94, 2.72, 3.57]
  rows.forEach((r, i) => {
    T(s, `SERVANT ${i + 1}`, 0.55, labelY[i], 1.4, { fontSize: 13.6, bold: true, color: B.navy, charSpacing: 2.2 })
    for (let k = 0; k < r.n; k++) if (icon) s.addImage({ data: icon, x: r.x + k * 0.4635, y: r.y, w: 0.41, h: 0.29 })
    T(s, r.v, r.vx, r.ty, 1.6, { fontFace: H, fontSize: 13.6, color: B.navy })
  })
  if (part === 2) {
    const badge = (x, y, w, fill, txt, tx) => { rect(s, pptx, x, y, w, 0.25, fill); T(s, txt, tx, y + 0.09, w, { fontSize: 10.6, color: B.white }) }
    badge(0.51, 1.58, 0.93, B.navy, 'Well Done!', 0.61)
    badge(0.52, 2.36, 0.93, B.navy, 'Well Done!', 0.62)
    badge(0.53, 3.19, 1.78, B.red, '“Wicked, lazy servant”', 0.64)
    rect(s, pptx, 0.56, 3.98, 8.89, 0.46, B.tile2); rect(s, pptx, 0.56, 3.98, 0.05, 0.46, B.gold)
    T(s, '“After a long time the master returned…”', 0.85, 4.13, 6, { fontFace: H, fontSize: 13.6, italic: true, color: B.navy })
    T(s, '2x Returns', 0.66, 4.62, 3, { fontFace: H, fontSize: 14, color: B.navy })
    T(s, '7-10 years with public business or real estate', 0.66, 4.88, 5, { fontSize: 12, color: B.text })
  }
  const lc = part === 1 ? B.text : 'A6A6A6'
  T(s, 'https://www.cnbc.com/2017/08/24/how-much-americans-earn-at-every-age.html', 0.66, 5.32, 3.1, { fontSize: 5.6, color: lc })
  T(s, 'https://www.biblegateway.com/passage/?search=Matthew+25%3A14-30&version=NIV', 3.79, 5.32, 3.2, { fontSize: 5.6, color: lc })
}

// ── What the Numbers Reveal (4 columns for under-$5M, 5 for $5M+; family-specific dollar amounts) ─────────────
const LABEL_LINES = { generosity: ['Increase in Lifetime', 'Generosity'], estateTax: ['Reduction of', 'Estate Taxes'], lifetime: ['Inheritance Moved', 'into Lifetime'], failure: ['Family Capital Failure', 'After First Generation*'], performance: ['Potential Portfolio', 'Performance**'] }
export function numbers4(pptx, settings, a, f, nw, five = false) {
  const s = base(pptx, { bar: false, foot: false })
  eyebrow(s, 'What the numbers reveal', { x: 0.55, y: 0.22, w: 6, h: 0.2, fontSize: 10 })
  T(s, `${nameOf(a, f)} Family Capital Assessment`, 0.51, 0.33, 9, { fontFace: H, fontSize: 26.1, color: B.navy })
  T(s, 'Average results from serving 100’s of families over 40+ years.', 0.67, 0.75, 8.5, { fontFace: H, fontSize: 16, italic: true, color: B.navy })
  const fa = settings.firmAverages || {}
  const pctNum = (p) => parseFloat(String(p).replace('%', '')) || 0
  const given = (key) => { const v = a[key]; return v !== '' && v != null && !isNaN(Number(String(v).replace(/[$,]/g, ''))) ? num(v) : null }
  const colsDef = [['generosity', 'nGenerosity', true], ...(five ? [['estateTax', 'nEstateTax', false]] : []), ['lifetime', 'nLifetime', true], ['failure', 'nFailure', false], ['performance', 'nPerformance', true]]
  const xs = five ? [0.55, 2.28, 4.04, 5.86, 7.65] : [0.56, 2.92, 5.28, 7.64]
  colsDef.forEach(([k, amtKey, up], i) => {
    const c = fa[k] || {}, x = xs[i], red = k === 'failure'
    const calc = nw && (k === 'lifetime' || k === 'failure') ? Math.round(pctNum(c.pct) / 100 * nw) : null
    const amt = given(amtKey) ?? calc
    rect(s, pptx, x, 1.04, 1.58, 3.55, B.tile, st(B.tileBorder, 0.5))
    rect(s, pptx, x - 0.05, 1.04, 0.05, 3.55, red ? B.red : B.navy, kit.outlines ? st('000000', 1) : undefined)
    T(s, c.pct || '', x + 0.08, 1.46, 1.5, { fontFace: H, fontSize: 28, color: red ? B.red : B.navy })
    LABEL_LINES[k].forEach((ln, q) => T(s, ln, x + 0.08, 2.15 + q * 0.21, 1.5, { fontFace: H, fontSize: 10, color: B.navy }))
    if (c.footnote) T(s, c.footnote, x + 0.08, 2.72, 1.5, { fontSize: 10, color: B.text })
    const ax = x + 1.33
    arrow(s, pptx, ax, 4.25, up, 0.19, '3A4070')
    T(s, amt == null ? '$—' : fmtUsd(amt), x + 0.17, 4.25, 1.15, { fontSize: 16, bold: true, color: red ? B.red : B.navy2, align: five ? 'left' : 'right' })
  })
  numFootnote(s, ['(*“Most rich families will lose it all”, Catey', 'Hill, New York Post, April 24, 2017) [**Past Performance is no guarantee of future results.]'])
}

// ── Owner's Lens ────────────────────────────────────────────────────────────────────────
const LENS = [
  { t: 'Innovation', q: ['Creating products and services that benefit', 'consumers?'], note: ['Holdings broadly serve growing, real-world demand.'] },
  { t: 'Inspiration', q: ['Driven by legacy purpose contributing to', 'human flourishing?'], note: ['A meaningful share carry exposure to activities', 'facing long-term structural headwinds.'] },
  { t: 'Infrastructure', q: ['Built on a solid foundation of sound business', 'practices and structure?'], note: ['Most holdings rest on durable balance sheets and', 'disciplined governance.'] },
]
// The updated $5M+ Assessment words the Inspiration question differently from the under-$5M deck.
const lensQ = (i, over5, compare) => (i === 1 && over5 ? (compare ? ['Driven by long-term vision, not distracted by', 'activities that face long-term structural', 'headwinds?'] : ['Driven by long-term vision, not distracted by', 'the issue of the day?']) : LENS[i].q)
const scoreW = (str, pt) => (String(str).replace(/[^0-9]/g, '').length * 0.235 + String(str).replace(/[^.]/g, '').length * 0.17) * (pt / 28.6)
const lensHead = (s, pptx, sub = true) => {
  eyebrow(s, 'Think like an owner', { x: 0.52, y: 0.42, w: 5, h: 0.2, fontSize: 11, bold: true, color: GOLD2 })
  T(s, "An Owner's Lens", 0.52, 0.73, 6, { fontFace: H, fontSize: 24.7, bold: true, color: '1A2340' })
  rect(s, pptx, 0.52, 1.24, 1.05, 0.03, GOLD2)
  if (sub) T(s, 'Every business you own, evaluated on the three questions a true owner asks.', 0.52, 1.47, 6, { fontSize: 10.9, italic: true, color: '6A6A6A' })
  T(s, 'Illustrative scorecard for discussion. Each holding is scored across the three ownership criteria; figures shown are representative.', 0.52, 4.91, 7, { fontSize: 6.7, italic: true, color: '8A8A82' })
}
const lensCard = (s, pptx, x, y, h) => { rect(s, pptx, x, y, 2.78, h, 'FBFAF6', st('E7E3D8', 1)); rect(s, pptx, x, y, 2.78, 0.05, '1A2340') }
export function lensSingle(pptx, sc = {}, over5 = false) {
  const s = whiteBase(pptx, { foot: true, footSize: 'md', footLeft: INVEST_FOOT })
  lensHead(s, pptx)
  ;['innovation', 'inspiration', 'infrastructure'].forEach((k, i) => {
    const x = [0.52, 3.60, 6.68][i], L = LENS[i], v = num(sc[k]), txt = sc[k] ? String(sc[k]) : '—'
    lensCard(s, pptx, x, 2.08, 2.51)
    T(s, L.t, x + 0.21, 2.31, 2.4, { fontFace: H, fontSize: 15.7, bold: true, color: '1A2340' })
    lensQ(i, over5, false).forEach((ln, k2) => T(s, ln, x + 0.21, 2.65 + k2 * 0.15, 2.5, { fontSize: 9, italic: true, color: '6A6A6A' }))
    T(s, txt, x + 0.21, 3.18, 1.2, { fontFace: H, fontSize: 28.6, bold: true, color: '1A2340' })
    T(s, '/ 10', x + 0.21 + scoreW(txt, 28.6), 3.43, 0.4, { fontSize: 10.6, bold: true, color: GOLD2 })
    rect(s, pptx, x + 0.21, 3.72, 2.35, 0.12, 'EFE7E2'); if (v > 0) rect(s, pptx, x + 0.21, 3.72, 2.35 * Math.min(1, v / 10), 0.12, GOLD2)
    L.note.forEach((ln, k2) => T(s, ln, x + 0.21, 3.95 + k2 * 0.13, 2.5, { fontSize: 7.9, color: '6A6A6A' }))
  })
}
export function lensCompare(pptx, cur = {}, prop = {}, over5 = false) {
  const s = whiteBase(pptx, { foot: true, footSize: 'md', footLeft: INVEST_FOOT })
  lensHead(s, pptx)
  const block = (label, y0, sc, withDesc) => {
    T(s, label.toUpperCase(), 0.52, y0 - 0.14, 3, { fontSize: 7.6, bold: true, color: '1A2340', charSpacing: 1.9 })
    ;['innovation', 'inspiration', 'infrastructure'].forEach((k, i) => {
      const x = [0.52, 3.60, 6.68][i], L = LENS[i], v = num(sc[k]), txt = sc[k] ? String(sc[k]) : '—'
      lensCard(s, pptx, x, y0, 1.27)
      T(s, L.t, x + 0.22, y0 + 0.24, 1.8, { fontFace: H, fontSize: 13.6, bold: true, color: '1A2340' })
      T(s, txt, x + 2.29 - scoreW(txt, 21), y0 + 0.19, 0.8, { fontFace: H, fontSize: 21, bold: true, color: '1A2340' })
      T(s, '/ 10', x + 2.29, y0 + 0.35, 0.4, { fontSize: 10.6, bold: true, color: GOLD2 })
      rect(s, pptx, x + 0.22, y0 + 0.64, 2.35, 0.12, 'EFE7E2'); if (v > 0) rect(s, pptx, x + 0.22, y0 + 0.64, 2.35 * Math.min(1, v / 10), 0.12, GOLD2)
      if (withDesc) lensQ(i, over5, true).forEach((ln, k2) => T(s, ln, x + 0.22, y0 + 0.85 + k2 * 0.15 - (over5 && i === 1 ? 0.03 : 0), 2.5, { fontSize: 9, italic: true, color: '6A6A6A' }))
    })
  }
  block('Current portfolio', 1.94, cur, true)
  block('Proposed holdings', 3.48, prop, false)
}

// ── Inspiration partners (static images) ───────────────────────────────────────────────
export function inspiration(pptx, imgs) {
  const s = whiteBase(pptx, { foot: true, footSize: 'md', footLeft: INVEST_FOOT })
  eyebrow(s, 'Think like an owner', { x: 0.52, y: 0.42, w: 5, h: 0.2, fontSize: 11, bold: true, color: GOLD2 })
  T(s, 'Inspiration', 0.61, 0.75, 6, { fontFace: H, fontSize: 24.7, bold: true, color: '1A2340' })
  rect(s, pptx, 0.52, 1.24, 1.05, 0.03, GOLD2)
  T(s, 'Driven by legacy purpose contributing to human flourishing?', 0.52, 1.38, 6, { fontSize: 10.9, italic: true, color: '1A2340' })
  ;[0.53, 5.36].forEach((x) => { rect(s, pptx, x, 2.01, 3.67, 2.85, B.white, st('E3DFD3', 0.75)); rect(s, pptx, x, 2.01, 3.67, 0.05, B.gold) })
  if (imgs?.[0]) s.addImage({ data: imgs[0], x: 0.83, y: 2.88, w: 3.06, h: 1.16 })
  if (imgs?.[1]) s.addImage({ data: imgs[1], x: 5.61, y: 2.88, w: 3.16, h: 1.58 })
}

// ── Values screening ───────────────────────────────────────────────────────────────────
export function valuesScreen(pptx, v = {}) {
  const s = whiteBase(pptx, { foot: true, footSize: 'md', footLeft: INVEST_FOOT })
  const funds = num(v.funds) || 10, cats = (v.categories || []).filter((c) => c.name)
  eyebrow(s, 'Think like an owner', { x: 0.52, y: 0.42, w: 5, h: 0.2, fontSize: 11, bold: true, color: GOLD2 })
  T(s, 'Aligning Your Capital With Your Convictions', 0.52, 0.73, 9, { fontFace: H, fontSize: 24.7, bold: true, color: '1A2340' })
  rect(s, pptx, 0.52, 1.24, 1.05, 0.03, GOLD2)
  T(s, `Values screening of the ${funds === 10 ? 'ten' : funds} funds under review — where holdings diverge from your family’s convictions.`, 0.52, 1.47, 8, { fontSize: 10.9, italic: true, color: '6A6A6A' })
  const flagged = num(v.flagged) || Math.max(0, ...cats.map((c) => num(c.count)))
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight']
  T(s, `${flagged} of ${funds}`, 0.53, 1.90, 1.0, { fontFace: H, fontSize: 16.6, bold: true, color: GOLD2 })
  T(s, `screened funds carry exposure across ${words[cats.length] || cats.length} values categories`, 1.38 + (flagged >= 10 ? 0.12 : 0), 1.99, 6, { fontSize: 12, color: '1A2340' })
  const pitch = cats.length > 4 ? 0.5 : 0.555
  cats.forEach((c, i) => {
    const y = 2.72 + i * pitch, cnt = Math.min(funds, num(c.count))
    rect(s, pptx, 2.69, y, 5.25, 0.19, 'EFE7E2'); if (cnt > 0) rect(s, pptx, 2.69, y, 5.25 * cnt / funds, 0.19, 'B3261E')
    T(s, c.name, 0.5, y + 0.03, 2.05, { fontSize: 12, bold: true, color: '1A2340', align: 'right' })
    T(s, `${cnt} / ${funds}`, 8.10, y + 0.04, 0.8, { fontSize: 11, color: '6A6A6A' })
  })
  T(s, `Source: Paradiem Values Screening Report. Exposure shown as the number of the ${funds === 10 ? 'ten' : funds} screened funds flagged in each category.`, 0.53, 4.97, 7, { fontSize: 6.7, italic: true, color: '8A8A82' })
}

// ── Conviction-based decisions ─────────────────────────────────────────────────────────
export function convictions(pptx, list) {
  const s = whiteBase(pptx, { foot: true, footSize: 'md', footLeft: INVEST_FOOT })
  eyebrow(s, 'Research reveals opportunities', { x: 0.52, y: 0.42, w: 6, h: 0.2, fontSize: 11, bold: true, color: GOLD2 })
  T(s, 'CONVICTION-BASED DECISIONS', 0.61, 0.75, 9, { fontFace: H, fontSize: 24.7, bold: true, color: '1A2340' })
  rect(s, pptx, 0.52, 1.24, 1.05, 0.03, GOLD2)
  T(s, 'Un-Common Sense:', 0.52, 1.47, 2, { fontSize: 10.9, bold: true, italic: true, color: '1A2340' })
  T(s, 'current economic environments guide our decisions and allocations.', 1.78, 1.47, 6, { fontSize: 10.9, italic: true, color: '6A6A6A' })
  ;(list || []).slice(0, 4).forEach((c, i) => {
    const x = [0.53, 2.84, 5.15, 7.46][i]
    rect(s, pptx, x, 2.01, 2.01, 2.85, B.white, st('E3DFD3', 0.75)); rect(s, pptx, x, 2.01, 2.01, 0.06, c.action === 'sell' ? B.red : B.green)
    if (c.logo && c.w && c.h) {
      const k = Math.min(1 / 199, 1.74 / c.w, 1.3 / c.h) , w = c.w * k, h = c.h * k
      s.addImage({ data: c.logo, x: x + (2.01 - w) / 2, y: 3.465 - h / 2, w, h })
    } else T(s, c.name || '', x + 0.1, 3.3, 1.81, { fontFace: H, fontSize: 15, bold: true, color: B.navy, align: 'center' })
  })
}

// ── 25 Stock Dividend Strategy: returns and risk statistics ───────────────────────────────
export function dividendStats(pptx, perf) {
  const p = perf?.dividend; if (!p) return
  const s = whiteBase(pptx, { foot: true, footSize: 'sm' })
  eyebrow(s, 'Simplicity over complexity', { x: 0.19, y: 0.11, w: 5, h: 0.2, fontSize: 11, bold: true, color: GOLD2, charSpacing: 2.5 })
  if (kit.logoSmall) s.addImage({ data: kit.logoSmall, x: 8.50, y: 0.29, w: 1.16, h: 0.34 })
  T(s, `${p.name} Returns & Statistics`, kit.logoSmall ? 0.91 : 0.30, 0.32, 8, { fontFace: H, fontSize: 18, color: B.navy })
  hline(s, pptx, 0, 0.65, 10, B.tileBorder, 0.5); hline(s, pptx, 0.35, 0.68, 0.85, B.gold, 1.5)
  const asOf = perf.asOf ? new Date(`${perf.asOf}T00:00:00`).toLocaleDateString('en-US') : ''
  T(s, `ANNUALISED RETURNS (AS OF ${asOf})`, 0.30, 0.75, 6, { fontSize: 10, color: B.text, charSpacing: 3 })
  const cx = [2.40, 3.84, 5.28, 6.70, 8.16]
  const head = (cols, centers, y) => cols.forEach((c, i) => T(s, String(c), centers[i] - 0.45, y, 0.9, { fontSize: 9, color: B.text, align: 'center', charSpacing: 3 }))
  const a = p.annualized
  head(a.columns, cx, 0.95); hline(s, pptx, 0.30, 1.14, 9.10, B.tileBorder, 0.4)
  const row = (label, vals, y, kind, lab2) => {
    if (kind === 'net') rect(s, pptx, 0.30, y + 0.01, 9.10, 0.28, B.tile, st('000000', 1))
    const col = kind === 'net' ? B.gold : kind === 'gross' ? B.navy : B.text
    ;(Array.isArray(label) ? label : [label]).forEach((ln, i) => T(s, ln, kind === 'bm' ? 0.30 : 0.35, y + (kind === 'bm' ? 0.07 : 0.14) + i * 0.13, 1.8, { fontSize: 7.6, color: kind === 'net' ? B.gold : B.text, charSpacing: 2 }))
    vals.forEach((v, i) => T(s, v == null ? '—' : `${Number(v).toFixed(2)}%`, cx[i] - 0.5, y + 0.1, 1.0, { fontFace: H, fontSize: 10.6, color: Number(v) < 0 ? B.red : col, align: 'center' }))
    hline(s, pptx, 0.30, y + (kind === 'net' ? 0.31 : 0.34), 9.10, B.rule, 0.3)
  }
  row('GROSS', a.gross, 1.15, 'gross'); row('NET', a.net, 1.47, 'net')
  p.benchmarks.forEach((bm, i) => row(bm.label.includes(' ETF') ? [bm.label.slice(0, bm.label.indexOf(' ETF')), bm.label.slice(bm.label.indexOf(' ETF') + 1)] : [bm.label], a[bm.key] || [], 1.79 + i * 0.32, 'bm'))
  hline(s, pptx, 0.30, 2.54, 9.10, B.gold, 1)
  T(s, 'STATISTICS', 0.30, 2.62, 2, { fontSize: 10, color: B.text, charSpacing: 2.4 })
  T(s, `vs. ${p.statistics?.vs || ''}`, 1.32, 2.65, 4, { fontSize: 7.6, color: 'A6A6B0', charSpacing: 1.2 })
  const stt = p.statistics || { columns: [], up: [], down: [] }, sx = [3.84, 5.28, 6.70, 8.16]
  head(stt.columns, sx, 2.83); hline(s, pptx, 0.30, 3.00, 9.10, B.tileBorder, 0.4)
  T(s, 'UP-MARKET CAPTURE', 0.35, 3.15, 3, { fontSize: 7.6, color: B.text, charSpacing: 2 })
  stt.up.forEach((v, i) => T(s, `${Number(v).toFixed(2)}%`, sx[i] - 0.5, 3.12, 1.0, { fontFace: H, fontSize: 10.6, color: B.navy, align: 'center' }))
  hline(s, pptx, 0.30, 3.34, 9.10, B.rule, 0.3)
  rect(s, pptx, 0.30, 3.35, 9.10, 0.28, B.tile, st('000000', 1))
  T(s, 'DOWN-MARKET CAPTURE', 0.35, 3.48, 3, { fontSize: 7.6, color: B.gold, charSpacing: 2 })
  stt.down.forEach((v, i) => T(s, `${Number(v).toFixed(2)}%`, sx[i] - 0.5, 3.41, 1.0, { fontFace: H, fontSize: 10.6, color: B.gold, align: 'center' }))
  hline(s, pptx, 0.30, 3.66, 9.10, B.rule, 0.3)
  s.addText(p.disclosureStats || p.disclosure || '', { x: 0.30, y: 3.84, w: 9.10, h: 0.85, margin: 0, valign: 'top', fontFace: F, fontSize: 5.5, color: B.text, lineSpacing: 7.9 })
}

// ── Proposed ownership (3 or 4 rows) and ownership pies ─────────────────────────────────
export function ownership(pptx, a, f, { under } = {}) {
  kit.next = { footLeft: under ? undefined : INVEST_FOOT }
  const s = base(pptx, { bar: false })
  const nm = nameOf(a, f)
  eyebrow(s, `${nm} Family Ownership`, { x: 0.55, y: 0.25, w: 6, h: 0.2, fontSize: 10.6 })
  T(s, `${nm} Family Proposed Ownership`, 0.55, 0.51, 9, { fontFace: H, fontSize: 26, color: B.navy })
  hline(s, pptx, 0.55, 1.28, 1.2, B.gold, 1.5)
  const total = num(a.portfolioTotal)
  const rows = [['Dividends', 'Paradiem Dividend Strategy', num(a.dividendPct), B.navy], ['Growth', 'Paradiem Growth Strategy', num(a.growthPct), B.sage], ['Bonds', 'Laddered Bond ETF’s', num(a.bondsPct), B.gold], ['Cash', 'Cash', num(a.cashPct), B.text]].filter((r) => r[2] > 0 || r[0] !== 'Bonds')
  eyebrow(s, 'Portfolio composition', { x: 0.55, y: 1.67, w: 4, h: 0.2, fontSize: 10.6 })
  const sum = rows.reduce((t, r) => t + r[2], 0) || 100
  let bx = 0.55; rows.forEach((r) => { const w = 3.8 * r[2] / sum; if (w > 0) rect(s, pptx, bx, 1.90, w, 0.55, r[3], st('000000', 1)); bx += w })
  rows.forEach(([n, , pct, col], i) => {
    const y = 2.60 + i * 0.525
    rect(s, pptx, 0.55, y + 0.01, 0.18, 0.18, col, st('000000', 1))
    T(s, n, 0.82, y, 2, { fontFace: H, fontSize: 12, color: B.navy })
    T(s, `${pct.toFixed(1)}%`, 0.82, y + 0.30, 0.8, { fontSize: 9, color: B.text })
    T(s, total ? fmtUsd(total * pct / 100) : '', 1.60, y + 0.30, 1.2, { fontSize: 9, color: B.navy })
    hline(s, pptx, 0.55, y + 0.44, 3.80, B.rule, 0.3)
  })
  hline(s, pptx, 0.55, 4.62, 3.80, B.navy, 1)
  T(s, 'TOTAL', 0.55, 4.81, 1, { fontSize: 9, bold: true, color: B.navy, charSpacing: 1 })
  T(s, total ? fmtUsd(total) : '', 3.20, 4.76, 1.10, { fontFace: H, fontSize: 13, color: B.navy, align: 'right' })
  eyebrow(s, 'Proposed ownership breakdown', { x: 4.90, y: 1.67, w: 4.7, h: 0.2, fontSize: 10 })
  hline(s, pptx, 4.90, 1.90, 4.65, B.navy, 1.5)
  ;[['Strategy', 4.95, 'left'], ['Manager', 6.05, 'left'], ['Alloc', 8.55, 'right'], ['Amount', 9.53, 'right']].forEach(([t, x, al]) => T(s, t.toUpperCase(), al === 'right' ? x - 1 : x, 2.11, 1, { fontSize: 9, bold: true, color: B.gold, charSpacing: 2, align: al }))
  rows.forEach(([n, m, pct], i) => {
    const y = 2.46 + i * 0.5
    rect(s, pptx, 4.90, y, 4.65, 0.46, i % 2 ? B.tile2 : B.bg, st('000000', 1))
    T(s, n, 4.95, y + 0.15, 1.2, { fontSize: 10, color: B.navy }); T(s, m, 6.05, y + 0.15, 2, { fontSize: 10, color: B.text })
    T(s, `${pct.toFixed(1)}%`, 7.55, y + 0.15, 1.0, { fontSize: 10, color: B.text, align: 'right' }); T(s, total ? fmtUsd(total * pct / 100) : '', 8.53, y + 0.15, 1.0, { fontSize: 10, color: B.text, align: 'right' })
    hline(s, pptx, 4.90, y + 0.48, 4.65, B.rule, 0.3)
  })
  const ty = 2.46 + rows.length * 0.5
  hline(s, pptx, 4.90, ty + 0.02, 4.65, B.navy, 0.8)
  T(s, 'TOTAL', 4.95, ty + 0.16, 1, { fontFace: H, fontSize: 11.1, bold: true, color: B.navy })
  T(s, '100%', 7.55, ty + 0.16, 1.0, { fontFace: H, fontSize: 11.1, bold: true, color: B.navy, align: 'right' }); T(s, total ? fmtUsd(total) : '', 8.45, ty + 0.16, 1.1, { fontFace: H, fontSize: 11.1, bold: true, color: B.navy, align: 'right' })
}
export function pies(pptx, a) {
  const s = whiteBase(pptx, { foot: true, footSize: 'x7', footLeft: INVEST_FOOT })
  eyebrow(s, 'Portfolio composition', { x: 0.60, y: 0.27, w: 6, h: 0.2, fontSize: 11 })
  T(s, 'Ownership Allocation', 0.60, 0.83, 8, { fontFace: H, fontSize: 28, color: N2 })
  rect(s, pptx, 0.50, 1.28, 1.40, 0.03, B.gold)
  T(s, 'Current Portfolio', 0.80, 1.56, 3, { fontSize: 12, bold: true, color: GREY }); T(s, 'Potential Portfolio', 5.40, 1.56, 3, { fontSize: 12, bold: true, color: INK2 })
  const cur = a.currentAlloc || {}
  const pot = { stocks: Math.max(0, num(a.dividendPct) + num(a.growthPct) - num(a.otherPct)), bonds: num(a.bondsPct), cash: num(a.cashPct), other: num(a.otherPct) }
  const labels = ['Stocks', 'Bonds', 'Cash', 'Other'], keys = ['stocks', 'bonds', 'cash', 'other'], colors = [N2, B.gold, 'A8A496', 'D5D2C6']
  ;[[0.40, cur], [5.20, pot]].forEach(([x, d]) => {
    s.addShape(pptx.ShapeType.roundRect, { x, y: 1.82, w: 4.10, h: 3.10, fill: { color: B.bg }, line: { color: B.bg, width: 0 }, rectRadius: 0.12 })
    const showOther = num(cur.other) > 0 || num(pot.other) > 0
    const idx = keys.map((k, i) => i).filter((i) => i < 3 || showOther)
    if (!idx.some((i) => num(d[keys[i]]) > 0)) return
    s.addChart(pptx.ChartType.pie, [{ name: 'Allocation', labels: idx.map((i) => labels[i]), values: idx.map((i) => num(d[keys[i]])) }], {
      x: x + 0.05, y: 1.84, w: 4.0, h: 3.06, layout: { x: 0.25, y: 0.10, w: 0.50, h: 0.64 }, chartColors: idx.map((i) => colors[i]), showLegend: true, legendPos: 'b', legendFontFace: F, legendFontSize: 10, legendColor: INK2,
      showPercent: true, showValue: false, showLabel: false, showTitle: false, dataLabelPosition: 'outEnd', dataLabelFontFace: H, dataLabelFontSize: 14, dataLabelFontBold: true, dataLabelColor: '000000', dataLabelFormatCode: '0%;-0%;', dataBorder: { pt: 0, color: 'FFFFFF' },
    })
  })
}

// ── Performance Audit, Proposed Portfolio Performance, Our Fees ───────────────────────────
export function audit(pptx, a) {
  const s = whiteBase(pptx, { foot: true, footSize: 'x7', footLeft: INVEST_FOOT })
  eyebrow(s, 'Performance analysis', { x: 0.60, y: 0.27, w: 6, h: 0.2, fontSize: 11 })
  T(s, 'Performance Audit', 0.60, 0.83, 8, { fontFace: H, fontSize: 28, color: N2 })
  rect(s, pptx, 0.50, 1.28, 1.40, 0.03, B.gold)
  T(s, 'Current Portfolio', 0.60, 1.53, 3, { fontSize: 12, color: GREY }); T(s, 'Potential Portfolio', 5.30, 1.53, 3, { fontSize: 12, bold: true, color: INK2 })
  const cols = [[0.50, [a.curAnnualReturn, a.curDividendYield, a.curTotalReturn]], [5.20, [a.annualReturn, a.dividendYield, a.potentialReturn]]]
  const labels = ['Potential Annual Return', 'Annual Dividend Yield', 'Total Potential Return']
  cols.forEach(([x, vals]) => vals.forEach((v, i) => {
    const y = 1.82 + i * 0.95, navy = i === 2
    rect(s, pptx, x, y, 4.40, 0.82, navy ? N2 : B.tile, st(navy ? '1C1E33' : BORD, 0.5))
    T(s, v === '' || v == null ? '—' : `${String(v).replace('%', '')}%`, x + 0.25, y + 0.19, 1.9, { fontFace: H, fontSize: 24, bold: true, color: navy ? B.gold : N2 })
    T(s, labels[i], x + 1.90, y + 0.34, 2.4, { fontSize: 12, color: navy ? B.white : GREY })
  }))
  T(s, 'Projections are hypothetical and do not reflect actual results. Past performance is no guarantee of future results. Calculated using Riskalyze methodology.', 0.60, 4.93, 8, { fontSize: 5.6, color: B.text })
}
export function proposedPerf5(pptx, a, f, disclosure) {
  const s = whiteBase(pptx, { foot: true, footSize: 'x7', footLeft: INVEST_FOOT })
  eyebrow(s, `${nameOf(a, f)} Family`, { x: 0.60, y: 0.27, w: 6, h: 0.2, fontSize: 11 })
  T(s, 'Proposed Portfolio Performance', 0.60, 0.84, 9, { fontFace: H, fontSize: 28, color: N2 })
  rect(s, pptx, 0.50, 1.28, 1.40, 0.03, B.gold)
  ;[[a.potentialReturn, 'Total Potential Return'], [a.annualReturn, 'Potential Annual Return'], [a.dividendYield, 'Annual Dividend Yield']].forEach(([v, l], i) => {
    const x = [0.50, 3.60, 6.70][i], navy = i === 0
    rect(s, pptx, x, 1.45, 2.90, 2.25, navy ? N2 : B.tile, st(navy ? '1C1E33' : BORD, 0.5))
    T(s, v === '' || v == null ? '—' : `${String(v).replace('%', '')}%`, x + 0.20, 2.12, 2.5, { fontFace: H, fontSize: 32.1, bold: true, color: navy ? B.gold : N2 })
    T(s, l, x + 0.20, 2.93, 2.5, { fontSize: 12, color: navy ? B.white : GREY })
  })
  const paras = String(disclosure).replace(/ (The underlying data is updated)/, '\n$1').replace(/ (IMPORTANT:)/, '\n$1').split('\n')
  s.addText(paras.map((t, i) => ({ text: t, options: { breakLine: i < paras.length - 1, paraSpaceAfter: 2 } })), { x: 0.60, y: 3.95 - 0.03, w: 8.75, h: 1.2, margin: 0, valign: 'top', fontFace: F, fontSize: 5.6, color: B.text, lineSpacing: 7.9 })
}
export function fees(pptx, a, fsch, aum, blended) {
  const tiers = aumTiers(fsch)
  const s = whiteBase(pptx, { foot: true, footSize: 'x7', footLeft: INVEST_FOOT })
  eyebrow(s, 'Advisory fees', { x: 0.60, y: 0.27, w: 6, h: 0.2, fontSize: 11 })
  T(s, 'Our Fees', 0.58, 0.84, 6, { fontFace: H, fontSize: 28, color: N2 })
  rect(s, pptx, 0.50, 1.28, 1.40, 0.03, B.gold)
  const exp = fsch.expenseRatio ?? 0.05
  rect(s, pptx, 0.50, 1.82, 3.67, 1.25, B.tile, st(BORD, 0.5))
  T(s, `${exp.toFixed(2)}%`, 0.72, 2.27, 1.4, { fontFace: H, fontSize: 24, bold: true, color: N2 })
  T(s, 'Expense Ratio', 2.16, 2.29, 2, { fontSize: 12, color: N2 }); T(s, '(in addition to advisory fee)', 2.16, 2.49, 2, { fontSize: 10.6, color: '6E6A63' })
  rect(s, pptx, 0.50, 3.22, 3.67, 1.25, N2, st('1C1E33', 0.5))
  T(s, aum > 0 ? `${(blended + exp).toFixed(2)}%` : '—', 0.72, 3.66, 1.4, { fontFace: H, fontSize: 24, bold: true, color: B.gold })
  T(s, 'Your Total Fee', 2.16, 3.69, 2, { fontSize: 12, color: B.white }); T(s, `(based on ${fmtUsd(aum)} AUM)`, 2.16, 3.88, 2, { fontSize: 10.6, color: B.mist })
  T(s, 'ASSETS', 4.58, 1.94, 2, { fontSize: 10.6, bold: true, color: N2, charSpacing: 2 }); T(s, 'FEE SCHEDULE*', 7.5, 1.94, 2.0, { fontSize: 10.6, bold: true, color: N2, charSpacing: 2, align: 'right' })
  hline(s, pptx, 4.58, 2.18, 4.92, N2, 1)
  let prev = 0
  tiers.forEach((t, i) => {
    const y = 2.34 + i * 0.4635
    const lab = i === 0 ? `First $${t.upTo / 1e6} million` : t.upTo === Infinity ? 'All Additional Funds' : `Next $${(t.upTo - prev) / 1e6} million`
    T(s, lab, 4.58, y, 3, { fontSize: 12, color: N2 }); T(s, `${t.rate.toFixed(2)}%`, 8.0, y, 1.51, { fontSize: 12, color: N2, align: 'right' })
    hline(s, pptx, 4.58, y + 0.30, 4.92, BORD, 0.5); prev = t.upTo
  })
}
