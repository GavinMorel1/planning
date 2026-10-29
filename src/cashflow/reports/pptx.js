// Cash-flow report as a PowerPoint deck in the Paradiem client style (Georgia + Calibri, flat square shapes, the standard footer).
import PptxGenJS from 'pptxgenjs'
import { B, F, LM, base, header, rect, georgia, calibri, chunk, kit, logoData, cover, ordinalDate } from '../../lib/deckkit'
import { buildSections } from './content'

const ROW_H = 0.235, SLIDE_BOTTOM = 4.95, TOP_Y = 1.85
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
  s.addTable([head, ...body], { x: LM, y, w: total, colW, rowH: ROW_H, margin: [0.02, 0.06, 0.02, 0.06] })
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

/** Adds the report's slides to an existing deck (used by the Gap Analysis deck) and returns the next page number. Content that does not fit continues on a new slide. */
export function addReportSlides(pptx, inp, { startPage = 1, eyebrow = 'Cash flow planning', pageNumbers = true } = {}) {
  let pageNo = startPage
  const note = (s) => { pageNo++; if (pageNumbers) calibri(s, String(pageNo), { x: 9.1, y: 5.05, w: 0.5, h: 0.2, fontSize: 7.5, color: B.caption, align: 'right' }) }
  for (const sec of buildSections(inp)) {
    let s = null, y = TOP_Y, n = 0
    const fresh = () => { if (s) note(s); s = base(pptx, { bar: false }); header(s, pptx, eyebrow, n ? `${sec.title} (continued)` : sec.title, { rule: 'gold', sub: n ? undefined : sec.subtitle }); y = TOP_Y; n++ }
    const ensure = (need) => { if (!s || y + need > SLIDE_BOTTOM) fresh() }
    fresh()
    for (const blk of sec.blocks) {
      if (blk.type === 'kpis') { ensure(1.15); addKpis(pptx, s, blk, y); y += 1.15 }
      else if (blk.type === 'chart') { const h = sec.blocks.some((b) => b.type === 'table') ? 1.9 : Math.max(2, SLIDE_BOTTOM - y - 0.1); ensure(Math.min(h, 1.9)); addChart(pptx, s, blk, y, h); y += h + 0.1 }
      else if (blk.type === 'table') {
        let offset = 0
        while (offset < blk.rows.length) {
          const remaining = blk.rows.length - offset
          let avail = Math.floor((SLIDE_BOTTOM - y - 0.3) / ROW_H)
          if (avail < Math.min(4, remaining)) { fresh(); avail = Math.floor((SLIDE_BOTTOM - y - 0.3) / ROW_H) }
          const take = Math.min(remaining, avail)
          addTable(pptx, s, { ...blk, rows: blk.rows.slice(offset, offset + take), flagRows: (blk.flagRows || []).filter((r) => r >= offset && r < offset + take).map((r) => r - offset) }, y, 0)
          y += 0.3 + take * ROW_H + 0.12; offset += take
          if (offset < blk.rows.length) fresh()
        }
      }
      else if (blk.type === 'text') { const size = sec.id === 'assumptions' ? 7.5 : 10.5; const h = Math.max(0.5, Math.ceil(blk.text.length / (sec.id === 'assumptions' ? 190 : 125)) * (size * 1.5) / 72 + 0.1); ensure(Math.min(h, 1.2)); s.addText(blk.text, { x: LM, y, w: 9.0, h: Math.min(h, SLIDE_BOTTOM - y), fontFace: F, fontSize: size, color: B.ink, margin: 0, valign: 'top', lineSpacingMultiple: 1.15 }); y += Math.min(h, SLIDE_BOTTOM - y) + 0.1 }
      else if (blk.type === 'bullets') { ensure(1); s.addText(blk.items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < blk.items.length - 1 } })), { x: LM, y, w: 9.0, h: Math.min(3.0, SLIDE_BOTTOM - y), fontFace: F, fontSize: 12, color: B.ink, margin: 0, valign: 'top', paraSpaceAfter: 8 }); y += 3.0 }
    }
    if (s) note(s)
  }
  return pageNo
}

export async function buildReportPptx(inp) {
  kit.logoSmall = null; kit.outlines = true
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_16x9'; pptx.author = inp.preparedBy || 'Paradiem'; pptx.company = 'Paradiem, LLC'; pptx.title = `${inp.title}: ${inp.familyName}`
  const logo = await logoData()
  cover(pptx, logo, inp.title, inp.familyName, inp.date)
  addReportSlides(pptx, inp, { startPage: 1 })
  return pptx.write({ outputType: 'blob' })
}
export { ordinalDate }
