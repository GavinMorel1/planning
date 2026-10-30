// Slides specific to the "Family Capital Gap Analysis+" deck (under-$5M clients moving their investments), drawn from the
// reference deck. The reference is 13.33 x 7.5 in; every position below is its measurement x 0.75 on our 10 x 5.625 slide.
import { B, H, F, base, rect, hline, T, eyebrow, georgia, calibri, kit, footer, addLogo, linesFor, chunk, shortName } from './deckkit'
import { fmtUsd, num } from './util'

const CREAM = 'FAF7F2', EDGE = 'E4DFD3', INK = '171738'

/** Gap+ header: small gold eyebrow, Georgia 19.5 title, short gold rule (the reference's own proportions). */
export function plusHeader(s, pptx, eb, title, { size = 19.5, h = 0.465 } = {}) {
  if (eb) eyebrow(s, kit.eyebrow || eb, { x: 0.45, y: 0.315, w: 7.5, h: 0.21, fontSize: 6.75, charSpacing: 3.5 })
  georgia(s, title, { x: 0.45, y: 0.54, w: 7.9, h, fontSize: size, valign: 'middle' })
  rect(s, pptx, 0.45, 1.065, 0.675, 0.0225, B.gold)
}
const squareBullets = (items, o = {}) => items.map((t, i) => ({ text: t, options: { bullet: { characterCode: '25A0', indent: 13 }, breakLine: i < items.length - 1, paraSpaceAfter: 7, ...o } }))
const fitSize = (items, w, h, start = 12, min = 8.5) => { let size = start; while (size > min) { const lines = items.reduce((t, it) => t + linesFor(it, size, w), 0); if (lines * size * 1.32 / 72 + items.length * 0.1 <= h) break; size -= 0.5 } return size }

export function processPlus(pptx) {
  const s = base(pptx, { bar: false })
  eyebrow(s, 'Our Process', { x: 0.45, y: 0.265, w: 6, h: 0.2, fontSize: 7, charSpacing: 3.5 })
  georgia(s, 'Family Capital Architecture', { x: 0.45, y: 0.40, w: 8, h: 0.55, fontSize: 21, valign: 'middle' })
  s.addShape(pptx.ShapeType.line, { x: 0.45, y: 1.355, w: 9.10, h: 0, line: { color: B.gold, width: 2.5, endArrowType: 'triangle' } })
  s.addShape(pptx.ShapeType.line, { x: 3.45, y: 1.10, w: 0, h: 0.48, line: { color: B.gold, width: 2 } })
  s.addShape(pptx.ShapeType.line, { x: 6.63, y: 1.13, w: 0, h: 0.48, line: { color: B.gold, width: 2 } })
  const steps = [['01', ['Family Capital', 'Assessment'], 'First session — mapping the current state of your family and capital.', ''], ['02', ['Family Capital', 'Gap Analysis + Blueprint'], 'Deep diagnostic identifying gaps between where you are and where you should be.', ''], ['03', ['Family Capital', 'Blueprint'], 'Today - Your comprehensive multi-generational wealth and legacy roadmap.', 'Today']]
  steps.forEach(([n, t, d, tag], i) => {
    const x = [0.45, 3.60, 6.75][i], y = 1.58, w = 2.90, h = 3.28, tx = x + 0.20, first = i === 0
    rect(s, pptx, x, y, w, h, first ? B.bg : B.tile2, { color: first ? B.navy : B.tileBorder, width: first ? 0.75 : 0.5 })
    rect(s, pptx, x, y, w, 0.06, B.navy)
    T(s, n, tx, 1.78, 1, { fontFace: H, fontSize: 24, color: B.navy })
    T(s, t[0], tx, 2.36, 2.6, { fontFace: H, fontSize: 13, color: B.navy }); T(s, t[1], tx, 2.63, 2.6, { fontFace: H, fontSize: 13, color: B.navy })
    hline(s, pptx, tx, 2.98, 2.5, B.rule, 0.4)
    s.addText(d, { x: tx, y: 3.01, w: 2.5, h: 1.1, margin: 0, valign: 'middle', fontFace: F, fontSize: 10, color: B.text, lineSpacing: 16 })
    if (tag) T(s, tag.toUpperCase(), tx, 4.41, 2.6, { fontSize: 9, color: B.gold, charSpacing: 2.6 })
  })
}

export function goalsListPlus(pptx, goals) {
  const groups = chunk((goals || []).filter((g) => g.text), 10)
  ;(groups.length ? groups : [[]]).forEach((group, gi) => {
    const s = base(pptx, { bar: true })
    plusHeader(s, pptx, 'Your current goals and objectives', gi ? 'Goals and Intentions (continued)' : 'Goals and Intentions')
    const w = 8.6, size = group.some((g) => g.text.length > 110) ? 10 : 11
    s.addText(squareBullets(group.map((g) => g.text), { paraSpaceAfter: 9 }), { x: 0.45, y: 1.4, w, h: 3.6, margin: 0, valign: 'top', fontFace: F, fontSize: size, color: B.ink })
  })
}

/** "Observations | Solutions" analysis page: one per goal or topic. */
export function obsSolutions(pptx, { title, observations = [], solutions = [], eyebrow: eb = 'Goals and Intentions Analysis' }) {
  const s = base(pptx, { bar: true })
  const long = title.length > 52
  plusHeader(s, pptx, eb, title, long ? { size: 14, h: 0.5 } : {})
  const boxY = 1.35, boxH = 3.71, boxW = 4.425
  rect(s, pptx, 0.45, boxY, boxW, boxH, CREAM, { color: EDGE, width: 0.75 })
  rect(s, pptx, 5.1375, boxY, boxW, boxH, B.white, { color: EDGE, width: 0.75 })
  rect(s, pptx, 5.1375, boxY, boxW, 0.0525, INK)
  eyebrow(s, 'Observations', { x: 0.675, y: 1.5, w: 3.7, h: 0.22, fontSize: 6.75, charSpacing: 3.5 })
  eyebrow(s, 'Solutions', { x: 5.3625, y: 1.5, w: 3.7, h: 0.22, fontSize: 6.75, charSpacing: 3.5 })
  const draw = (items, x) => {
    if (!items.length) return
    const size = fitSize(items, 3.9, 3.05)
    s.addText(squareBullets(items), { x, y: 1.84, w: 4.0, h: 3.1, margin: 0, valign: 'top', fontFace: F, fontSize: size, color: B.ink, lineSpacingMultiple: 1.08 })
  }
  draw(observations, 0.675); draw(solutions, 5.3625)
}

export function assumptionsSlide(pptx, { cash, invest }) {
  const s = base(pptx, { bar: true })
  plusHeader(s, pptx, 'Current plan analysis', 'Assumptions in Plan')
  const pct = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? '—' : `${Number(v)}%`)
  ;[['Cash growth', cash, 0.45], ['Investment growth', invest, 3.6]].forEach(([label, v, x]) => {
    rect(s, pptx, x, 1.5, 2.925, 1.65, CREAM, { color: EDGE, width: 0.75 })
    eyebrow(s, label, { x: x + 0.225, y: 1.69, w: 2.5, h: 0.22, fontSize: 6.75, charSpacing: 3.5 })
    georgia(s, pct(v), { x: x + 0.225, y: 2.06, w: 2.5, h: 0.75, fontSize: 33, valign: 'middle' })
  })
}

export function bulletSlide(pptx, eb, title, items) {
  const s = base(pptx, { bar: true })
  plusHeader(s, pptx, eb, title)
  const list = (items || []).filter(Boolean)
  if (!list.length) { calibri(s, 'Add the points for this slide in the deck editor.', { x: 0.45, y: 1.45, w: 8, h: 0.3, fontSize: 10, italic: true }); return }
  s.addText(squareBullets(list, { paraSpaceAfter: 9 }), { x: 0.45, y: 1.4, w: 8.9, h: 3.6, margin: 0, valign: 'top', fontFace: F, fontSize: fitSize(list, 8.7, 3.5, 11, 8.5), color: B.ink })
}

/** Cash needs, the first of the reference's two layouts: navy "upcoming need / cash on hand" tiles over four year cards. */
export function cashNeedsOverview(pptx, a, { eyebrow: eb = 'Base plan' } = {}) {
  const s = base(pptx, { bar: true })
  plusHeader(s, pptx, eb, '5 Year Cash Needs')
  const k = (v) => (!num(v) ? '—' : Math.abs(num(v)) >= 1000 ? `$${Math.round(num(v) / 1000)}K` : `$${Math.round(num(v))}`)
  const retire = num(a.retirementCashNeed), g = a.cashGrowthPct === '' || a.cashGrowthPct == null ? 0 : num(a.cashGrowthPct)
  ;[['Upcoming cash need', retire ? k(retire) : 'N/A', 0.45], ['Year 1 cash on hand', k(a.cashOnHand), 2.925]].forEach(([l, v, x]) => {
    rect(s, pptx, x, 1.39, 2.29, 1.125, INK)
    eyebrow(s, l, { x: x + 0.19, y: 1.5, w: 2, h: 0.2, fontSize: 6.4, charSpacing: 3.5 })
    georgia(s, v, { x: x + 0.19, y: 1.8, w: 2, h: 0.56, fontSize: 25.5, color: B.white, valign: 'middle' })
  })
  const yr = (a.date ? new Date(`${a.date}T00:00:00`).getFullYear() : new Date().getFullYear())
  for (let i = 0; i < 4; i++) {
    const x = 0.45 + i * 2.31, manual = num(a[`cashYear${i + 2}`]), amt = manual || (retire ? retire * Math.pow(1 + g / 100, i + 1) : 0)
    rect(s, pptx, x, 2.85, 2.14, 1.95, CREAM, { color: EDGE, width: 0.75 })
    rect(s, pptx, x, 2.85, 2.14, 0.045, B.gold)
    eyebrow(s, `Year ${i + 2}`, { x: x + 0.19, y: 3.04, w: 1.8, h: 0.22, fontSize: 6.75, charSpacing: 3.5 })
    calibri(s, String(yr + i + 1), { x: x + 0.19, y: 3.26, w: 1.8, h: 0.26, fontSize: 9, color: B.text })
    georgia(s, k(amt), { x: x + 0.19, y: 3.71, w: 1.8, h: 0.68, fontSize: 27, valign: 'middle' })
  }
}

// ── statement tables (engine-fed) or a pasted picture ─────────────────────────────────────
function picture(s, data, x, y, w, h) {
  // keep the aspect ratio: pptxgenjs "contain" sizing needs the natural size, so fit by the stored dims when we have them
  s.addImage({ data, x, y, w, h, sizing: { type: 'contain', w, h } })
}

export function statementSlide(pptx, { eyebrow: eb, title, statement, image, note }) {
  const s = base(pptx, { bar: true })
  plusHeader(s, pptx, eb, title)
  if (image) { picture(s, image, 0.45, 1.25, 9.1, 3.85); return }
  if (!statement) { calibri(s, note || 'Fill the Cashflow tab (household, accounts, income and spending) and this table builds itself, or upload a picture of the table in the deck editor.', { x: 0.45, y: 1.5, w: 8.5, h: 0.6, fontSize: 10.5, italic: true }); return }
  const n = statement.heads.length, labelW = 2.9, colW = (9.1 - labelW) / n
  const rows = [[{ text: 'Years (ages)', options: { bold: true, fontFace: F, fontSize: 7.5, color: B.navy, border: [{ type: 'none' }, { type: 'none' }, { type: 'solid', pt: 1, color: B.navy }, { type: 'none' }] } }, ...statement.heads.map((h) => ({ text: h, options: { bold: true, fontFace: F, fontSize: 7.5, color: B.navy, align: 'right', border: [{ type: 'none' }, { type: 'none' }, { type: 'solid', pt: 1, color: B.navy }, { type: 'none' }] } }))]]
  statement.sections.forEach((sec) => {
    if (sec.title) rows.push([{ text: sec.title, options: { bold: true, italic: true, fontFace: F, fontSize: 7, color: '2F5597', colspan: n + 1 } }])
    sec.lines.forEach((l) => {
      const line = l.bold ? [{ type: 'none' }, { type: 'none' }, { type: 'solid', pt: 0.75, color: B.navy }, { type: 'none' }] : [{ type: 'none' }, { type: 'none' }, { type: 'none' }, { type: 'none' }]
      rows.push([{ text: l.label, options: { bold: l.bold, fontFace: F, fontSize: 7, color: B.ink, border: line } }, ...l.values.map((v) => ({ text: v, options: { bold: l.bold, fontFace: F, fontSize: 7, color: B.ink, align: 'right', border: line } }))])
    })
  })
  const rowH = Math.min(0.17, 3.7 / rows.length)
  s.addTable(rows, { x: 0.45, y: 1.28, w: 9.1, colW: [labelW, ...Array(n).fill(colW)], rowH, margin: [0, 0.04, 0, 0.04], valign: 'middle' })
}

export function lifetimeSlides(pptx, { eyebrow: eb, title, table, image, note }) {
  if (image || !table) { statementSlide(pptx, { eyebrow: eb, title, statement: null, image, note }); return }
  const per = 24
  chunk(table.body, per).forEach((rows, gi) => {
    const s = base(pptx, { bar: true })
    plusHeader(s, pptx, eb, gi ? `${title} (continued)` : title)
    const head = table.cols.map((c, i) => ({ text: c, options: { bold: true, fontFace: F, fontSize: 7, color: B.navy, align: i < 2 ? 'left' : 'right', border: [{ type: 'none' }, { type: 'none' }, { type: 'solid', pt: 1, color: B.navy }, { type: 'none' }] } }))
    const body = rows.map((r, ri) => r.map((v, i) => ({ text: v, options: { fontFace: F, fontSize: 7, color: B.ink, align: i < 2 ? 'left' : 'right', fill: { color: ri % 2 ? B.white : B.tile3 }, border: [{ type: 'none' }, { type: 'none' }, { type: 'solid', pt: 0.25, color: B.rule }, { type: 'none' }] } })))
    s.addTable([head, ...body], { x: 0.45, y: 1.28, w: 9.1, colW: [0.7, 0.8, 1.2, 1.2, 1.0, 1.2, 1.2, 1.8], rowH: 0.145, margin: [0, 0.05, 0, 0.05], valign: 'middle' })
  })
}

/** Base plan vs. LTC annuity: ending portfolio for each, with the final-year cash-flow summary of both side by side. */
export function planVsAnnuity(pptx, { base: b, ltc, eyebrow: eb = 'Base plan vs. annuity', note }) {
  const s = base(pptx, { bar: true })
  plusHeader(s, pptx, eb, 'Lifetime Cash Flow')
  if (!b || !ltc) { calibri(s, note || 'Choose the annuity scenario in the deck editor to compare it with the base plan.', { x: 0.45, y: 1.5, w: 8.5, h: 0.5, fontSize: 10.5, italic: true }); return }
  s.addText([{ text: 'Base Plan: ', options: { fontFace: H, fontSize: 11, color: B.text } }, { text: fmtUsd(b.total), options: { fontFace: H, fontSize: 13, bold: true, color: B.navy } }, { text: '    LTC Annuity: ', options: { fontFace: H, fontSize: 11, color: B.text } }, { text: fmtUsd(ltc.total), options: { fontFace: H, fontSize: 13, bold: true, color: B.navy } }], { x: 0.45, y: 1.28, w: 9, h: 0.35, margin: 0, valign: 'middle' })
  ;[[b, 'Base plan', 0.45], [ltc, 'LTC annuity', 5.1]].forEach(([d, label, x]) => {
    rect(s, pptx, x, 1.85, 4.45, 0.28, B.navy)
    calibri(s, `${label}: cash flow summary, ${d.endYear}`, { x: x + 0.1, y: 1.85, w: 4.2, h: 0.28, fontSize: 8.5, bold: true, color: B.white, valign: 'middle' })
    const rows = d.lines.map(([l, v], i) => [{ text: l, options: { fontFace: F, fontSize: 8, color: B.ink, bold: /^Total|^Net/.test(l), fill: { color: i % 2 ? B.white : B.tile3 } } }, { text: v, options: { fontFace: F, fontSize: 8, color: B.ink, align: 'right', bold: /^Total|^Net/.test(l), fill: { color: i % 2 ? B.white : B.tile3 } } }])
    s.addTable(rows, { x, y: 2.15, w: 4.45, colW: [2.7, 1.75], rowH: 0.27, margin: [0, 0.08, 0, 0.08], valign: 'middle', border: { type: 'solid', pt: 0.25, color: B.rule } })
  })
}

export { shortName }
