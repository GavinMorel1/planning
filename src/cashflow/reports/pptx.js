// Cash-flow report as a PowerPoint deck in the Paradiem client style (Georgia + Calibri, flat square shapes, the standard footer).
import PptxGenJS from 'pptxgenjs'
import { B, H, F, LM, base, header, footer, rect, hline, georgia, calibri, T, chunk, kit, asDataUrl, logoData, cover, ordinalDate } from '../../lib/deckkit'
import { buildSections } from './content'

const ROWS_PER_SLIDE = 13
const NAVY = B.navy, GOLD = B.gold

function addTable(pptx, s, blk, y, h) {
  const colW = []
  const total = 9.0
  const cols = blk.columns
  const weights = cols.map((c) => (c.align === 'right' ? 1 : 1.4))
  const sum = weights.reduce((a, b) => a + b, 0)
  weights.forEach((w) => colW.push((w / sum) * total))
  const head = cols.map((c) => ({ text: c.label.toUpperCase(), options: { bold: true, fontFace: F, fontSize: 7.5, color: B.caption, align: c.align === 'right' ? 'right' : 'left', border: [{ type: 'none' }, { type: 'none' }, { type: 'solid', pt: 1, color: GOLD }, { type: 'none' }], fill: { color: 'FFFFFF' } } }))
  const body = blk.rows.map((r, ri) => cols.map((c) => ({ text: String(r[c.key] ?? ''), options: { fontFace: c.align === 'right' ? F : F, fontSize: 8.5, color: blk.flagRows?.includes(ri) ? B.red : B.ink, bold: blk.flagRows?.includes(ri), align: c.align === 'right' ? 'right' : 'left', fill: { color: blk.flagRows?.includes(ri) ? B.redSoft : ri % 2 ? 'FFFFFF' : B.tile3 }, border: [{ type: 'none' }, { type: 'none' }, { type: 'solid', pt: 0.5, color: B.rule }, { type: 'none' }] } })))
  s.addTable([head, ...body], { x: LM, y, w: total, colW, rowH: Math.min(0.3, h / (body.length + 1)), margin: [0.02, 0.06, 0.02, 0.06] })
}

function addKpis(pptx, s, blk, y) {
  const n = blk.items.length, w = (9.0 - 0.15 * (n - 1)) / n
  blk.items.forEach((it, i) => {
    const x = LM + i * (w + 0.15)
    rect(s, pptx, x, y, w, 1.0, B.tile, { color: B.tileBorder, width: 0.5 }); rect(s, pptx, x, y, w, 0.04, NAVY)
    calibri(s, it.label.toUpperCase(), { x: x + 0.1, y: y + 0.1, w: w - 0.2, h: 0.22, fontSize: 7.5, color: B.caption, charSpacing: 1.5 })
    const vs = it.values
    vs.forEach((v, k) => georgia(s, v, { x: x + 0.1, y: y + 0.32 + k * 0.3, w: w - 0.2, h: 0.3, fontSize: vs.length > 1 ? 13 : 18, color: k === 0 ? NAVY : B.navy2, valign: 'middle' }))
  })
}

function addChart(pptx, s, blk, y, h) {
  const common = { x: LM, y, w: 9.0, h, showLegend: true, legendPos: 'b', legendFontFace: F, legendFontSize: 8, catAxisLabelFontFace: F, catAxisLabelFontSize: 8, valAxisLabelFontFace: F, valAxisLabelFontSize: 8, valAxisLabelFormatCode: '$#,##0,"K"', valGridLine: { color: 'E8E7E2', size: 0.5 }, catGridLine: { style: 'none' } }
  const labels = blk.years.map(String)
  if (blk.kind === 'band') {
    const data = [['p90', 'p75', 'p50', 'p25', 'p10'].map(() => 0)].length ? [
      { name: '90th percentile', labels, values: blk.band.map((b) => b.p90) }, { name: '75th', labels, values: blk.band.map((b) => b.p75) }, { name: 'Median', labels, values: blk.band.map((b) => b.p50) }, { name: '25th', labels, values: blk.band.map((b) => b.p25) }, { name: '10th percentile', labels, values: blk.band.map((b) => b.p10) }] : []
    s.addChart(pptx.ChartType.line, data, { ...common, chartColors: ['B8B4AC', 'C0A24C', NAVY, 'C0A24C', 'B8B4AC'], lineSize: 2, lineDataSymbol: 'none' })
    return
  }
  if (blk.kind === 'stacked') {
    const bars = blk.series.slice(0, -1), line = blk.series[blk.series.length - 1]
    s.addChart([{ type: pptx.ChartType.bar, data: bars.map((x) => ({ name: x.name, labels, values: x.values })), options: { barGrouping: 'stacked', chartColors: bars.map((x) => x.color.replace('#', '')) } }, { type: pptx.ChartType.line, data: [{ name: line.name, labels, values: line.values }], options: { chartColors: [line.color.replace('#', '')], lineSize: 3, lineDataSymbol: 'none' } }], { ...common })
    return
  }
  s.addChart(pptx.ChartType.line, blk.series.map((x) => ({ name: x.name, labels, values: x.values })), { ...common, chartColors: blk.series.map((x) => x.color.replace('#', '')), lineSize: 2.5, lineDataSymbol: 'none' })
}

export async function buildReportPptx(inp, { preparedLine } = {}) {
  kit.logoSmall = null; kit.outlines = true
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_16x9'; pptx.author = inp.preparedBy || 'Paradiem'; pptx.company = 'Paradiem, LLC'; pptx.title = `${inp.title}: ${inp.familyName}`
  const logo = await logoData()
  cover(pptx, logo, inp.title, inp.familyName, inp.date)
  const sections = buildSections(inp)
  let pageNo = 1
  const note = (s) => { pageNo++; calibri(s, String(pageNo), { x: 9.1, y: 5.05, w: 0.5, h: 0.2, fontSize: 7.5, color: B.caption, align: 'right' }) }
  for (const sec of sections) {
    const tables = sec.blocks.filter((b) => b.type === 'table' && b.rows.length > ROWS_PER_SLIDE)
    if (tables.length === 1 && sec.blocks.length === 1) {
      // a long table spreads over several slides, repeating the header
      const t = tables[0]
      chunk(t.rows, ROWS_PER_SLIDE).forEach((rows, i, all) => {
        const s = base(pptx, { bar: false })
        header(s, pptx, 'Cash flow planning', `${sec.title}${all.length > 1 ? ` (${i + 1} of ${all.length})` : ''}`, { rule: 'gold', sub: sec.subtitle })
        const offset = i * ROWS_PER_SLIDE
        addTable(pptx, s, { ...t, rows, flagRows: (t.flagRows || []).filter((r) => r >= offset && r < offset + ROWS_PER_SLIDE).map((r) => r - offset) }, 1.85, 3.2)
        note(s)
      })
      continue
    }
    const s = base(pptx, { bar: false })
    header(s, pptx, 'Cash flow planning', sec.title, { rule: 'gold', sub: sec.subtitle })
    let y = 1.85
    for (const blk of sec.blocks) {
      if (blk.type === 'kpis') { addKpis(pptx, s, blk, y); y += 1.15 }
      else if (blk.type === 'chart') { const h = Math.max(1.8, 5.0 - y - 0.1 - (sec.blocks.some((b) => b.type === 'table') ? 1.6 : 0)); addChart(pptx, s, blk, y, h); y += h + 0.05 }
      else if (blk.type === 'table') { const rows = blk.rows.slice(0, ROWS_PER_SLIDE); addTable(pptx, s, { ...blk, rows }, y, Math.max(1.2, 5.0 - y)); y += Math.min(blk.rows.length, ROWS_PER_SLIDE) * 0.27 + 0.4 }
      else if (blk.type === 'text') { s.addText(blk.text, { x: LM, y, w: 9.0, h: Math.min(2.6, Math.max(0.6, blk.text.length / 130 * 0.3)), fontFace: sec.id === 'assumptions' ? F : F, fontSize: sec.id === 'assumptions' ? 7.5 : 10.5, color: B.ink, margin: 0, valign: 'top', lineSpacingMultiple: 1.15 }); y += Math.min(2.6, Math.max(0.6, blk.text.length / 130 * 0.3)) + 0.1 }
      else if (blk.type === 'bullets') { s.addText(blk.items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < blk.items.length - 1 } })), { x: LM, y, w: 9.0, h: 3.0, fontFace: F, fontSize: 12, color: B.ink, margin: 0, valign: 'top', paraSpaceAfter: 8 }) }
    }
    note(s)
  }
  return pptx.write({ outputType: 'blob' })
}
export { ordinalDate }
