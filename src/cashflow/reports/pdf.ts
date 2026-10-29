// Cash-flow report as a branded PDF (landscape letter). Headings use a serif face (Georgia's role), body a sans (Calibri's role),
// gold rules, flat square shapes, a cover page, page numbers and the Paradiem footer. Charts are drawn as vectors.
import { buildSections, type ReportInput, type Section, type Block } from './content'

const NAVY = '#1A1E3A', GOLD = '#C9A84C', INK = '#1C1D32', TEXT = '#6A6A7A', CAPTION = '#9A9A8A', TILE = '#EDECE7', TILE3 = '#F7F6F2', RULE = '#E8E7E2', RED = '#993333', REDSOFT = '#F5EDED', TAUPE = '#8B7355', STRIP = '#F1EEE6'
const W = 792, H = 612, ML = 48, MR = 48, TOP = 96, BOTTOM = 560

type Doc = import('jspdf').jsPDF
const wrapText = (d: Doc, text: string, w: number) => d.splitTextToSize(text, w) as string[]

export async function buildReportPdf(inp: ReportInput, opts: { logo?: string | null } = {}): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const d = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' })
  const footerLeft = 'PARADIEM  |  FAMILY CAPITAL ARCHITECTURE', footerMid = 'Paradiem, LLC is a Registered Investment Advisor.', footerRight = 'CONFIDENTIAL — NOT FOR DISTRIBUTION'
  let page = 1
  // Standard PDF fonts only cover Latin-1: swap characters they cannot draw.
  const safe = (t: string) => String(t).replace(/\u2212/g, '-').replace(/\u203A/g, '>').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
  const rawText = d.text.bind(d) as (...a: unknown[]) => unknown
  ;(d as unknown as { text: (...a: unknown[]) => unknown }).text = (t: unknown, ...rest: unknown[]) => rawText(Array.isArray(t) ? t.map((x) => safe(String(x))) : safe(String(t)), ...rest)

  const footer = () => {
    d.setFillColor(STRIP); d.rect(0, H - 26, W, 26, 'F')
    d.setFont('helvetica', 'normal'); d.setFontSize(6.5); d.setTextColor(TAUPE)
    d.text(footerLeft, 24, H - 10)
    d.text(footerMid, W / 2, H - 10, { align: 'center' })
    d.text(`${footerRight}   |   ${page}`, W - 24, H - 10, { align: 'right' })
  }
  const heading = (title: string, sub?: string) => {
    d.setFont('times', 'normal'); d.setFontSize(24); d.setTextColor(NAVY); d.text(title, ML, 62)
    d.setDrawColor(GOLD); d.setLineWidth(1.6); d.line(ML, 72, ML + 70, 72)
    if (sub) { d.setFont('helvetica', 'italic'); d.setFontSize(9.5); d.setTextColor(TEXT); d.text(sub, ML, 88) }
  }
  const newPage = (title: string, sub?: string) => { d.addPage(); page++; footer(); heading(title, sub); return TOP + (sub ? 8 : 0) }

  // cover
  d.setFillColor('#FFFFFF'); d.rect(0, 0, W, H, 'F')
  d.setFillColor(NAVY); d.rect(24, 52, 4, 330, 'F')
  if (opts.logo) { try { d.addImage(opts.logo, 'PNG', W - 48 - 160, 32, 160, 46) } catch { /* logo is optional */ } } else { d.setFont('times', 'bold'); d.setFontSize(22); d.setTextColor(NAVY); d.text('Paradiem', W - 48, 62, { align: 'right' }) }
  d.setFont('times', 'normal'); d.setFontSize(30); d.setTextColor(NAVY); d.text(inp.title, 54, 150)
  d.setFontSize(30); d.text(inp.familyName, 54, 240)
  d.setFillColor(GOLD); d.rect(54, 262, 58, 2, 'F')
  d.setFont('helvetica', 'normal'); d.setFontSize(12); d.setTextColor(TAUPE); d.text('Aligning Family & Capital With a 100-Year Vision', 54, 290)
  d.setFont('times', 'normal'); d.setFontSize(14); d.setTextColor(NAVY)
  const when = inp.date ? new Date(`${inp.date}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''
  d.text(`Prepared ${when}${inp.preparedBy ? ` by ${inp.preparedBy}` : ''}`, 54, 355)
  footer()

  const kpis = (blk: Extract<Block, { type: 'kpis' }>, y: number) => {
    const n = blk.items.length, gap = 10, w = (W - ML - MR - gap * (n - 1)) / n
    blk.items.forEach((it, i) => {
      const x = ML + i * (w + gap)
      d.setFillColor(TILE); d.rect(x, y, w, 62, 'F'); d.setFillColor(NAVY); d.rect(x, y, w, 3, 'F')
      d.setFont('helvetica', 'bold'); d.setFontSize(6.5); d.setTextColor(CAPTION); d.text(it.label.toUpperCase(), x + 8, y + 15)
      it.values.forEach((v, k) => { d.setFont('times', 'normal'); d.setFontSize(it.values.length > 1 ? 12 : 17); d.setTextColor(k ? '#3A4070' : NAVY); d.text(v, x + 8, y + 34 + k * 14) })
    })
    return y + 76
  }

  const table = (blk: Extract<Block, { type: 'table' }>, y: number, title: string, sub?: string) => {
    const total = W - ML - MR, weights = blk.columns.map((c) => (c.align === 'right' ? 1.15 : 1.1)), sum = weights.reduce((a, b) => a + b, 0)
    const widths = weights.map((w) => (w / sum) * total)
    const rowH = 16
    const head = () => {
      d.setFont('helvetica', 'bold'); d.setFontSize(6.8); d.setTextColor(CAPTION)
      let x = ML; blk.columns.forEach((c, i) => { d.text(c.label.toUpperCase(), c.align === 'right' ? x + widths[i] - 4 : x + 4, y + 10, { align: c.align === 'right' ? 'right' : 'left' }); x += widths[i] })
      d.setDrawColor(GOLD); d.setLineWidth(1); d.line(ML, y + 14, ML + total, y + 14); y += rowH + 2
    }
    head()
    blk.rows.forEach((r, ri) => {
      if (y + rowH > BOTTOM) { y = newPage(`${title} (continued)`, sub); head() }
      const flag = blk.flagRows?.includes(ri)
      d.setFillColor(flag ? REDSOFT : ri % 2 ? '#FFFFFF' : TILE3); d.rect(ML, y, total, rowH, 'F')
      d.setFont('helvetica', flag ? 'bold' : 'normal'); d.setFontSize(8); d.setTextColor(flag ? RED : INK)
      let x = ML; blk.columns.forEach((c, i) => { d.text(String(r[c.key] ?? ''), c.align === 'right' ? x + widths[i] - 4 : x + 4, y + 11, { align: c.align === 'right' ? 'right' : 'left', maxWidth: widths[i] - 6 }); x += widths[i] })
      y += rowH
    })
    return y + 12
  }

  const axes = (x0: number, y0: number, w: number, h: number, max: number, years: number[]) => {
    d.setDrawColor(RULE); d.setLineWidth(0.5); d.setFont('helvetica', 'normal'); d.setFontSize(6.5); d.setTextColor(CAPTION)
    for (let i = 0; i <= 4; i++) { const yy = y0 + h - (h * i) / 4; d.line(x0, yy, x0 + w, yy); const v = (max * i) / 4; d.text(v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1e3)}K`, x0 - 4, yy + 2, { align: 'right' }) }
    const step = Math.max(1, Math.ceil(years.length / 14)); years.forEach((yr, i) => { if (i % step === 0) d.text(String(yr), x0 + (w * (i + 0.5)) / years.length, y0 + h + 10, { align: 'center' }) })
  }
  const niceMax = (v: number) => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p }
  const chart = (blk: Extract<Block, { type: 'chart' }>, y: number, h: number) => {
    const x0 = ML + 40, w = W - ML - MR - 44, y0 = y + 6, ch = h - 36
    const hex = (c: string) => (c.startsWith('#') ? c : `#${c}`)
    if (blk.kind === 'band' && blk.band) {
      const max = niceMax(Math.max(1, ...blk.band.map((b) => b.p90))); axes(x0, y0, w, ch, max, blk.years)
      const px = (i: number) => x0 + (w * (i + 0.5)) / blk.years.length, py = (v: number) => y0 + ch - (ch * v) / max
      const poly = (lo: keyof typeof blk.band[0], hi: keyof typeof blk.band[0], fill: string) => { const pts = [...blk.band!.map((b, i) => [px(i), py(b[hi] as number)]), ...blk.band!.map((_, i, a) => [px(a.length - 1 - i), py(a[a.length - 1 - i][lo] as number)])]; d.setFillColor(fill); d.lines(pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]), pts[0][0], pts[0][1], [1, 1], 'F', true) }
      poly('p10', 'p90', '#F1ECDC'); poly('p25', 'p75', '#E4D9B4')
      d.setDrawColor(NAVY); d.setLineWidth(1.6); blk.band.forEach((b, i) => { if (i) d.line(px(i - 1), py(blk.band![i - 1].p50), px(i), py(b.p50)) })
    } else if (blk.kind === 'stacked') {
      const bars = blk.series.slice(0, -1), line = blk.series[blk.series.length - 1]
      const totals = blk.years.map((_, i) => bars.reduce((t, s) => t + Math.max(0, s.values[i] || 0), 0))
      const max = niceMax(Math.max(1, ...totals, ...line.values)); axes(x0, y0, w, ch, max, blk.years)
      const bw = w / blk.years.length
      blk.years.forEach((_, i) => { let acc = 0; bars.forEach((s) => { const v = Math.max(0, s.values[i] || 0); if (v > 0) { d.setFillColor(hex(s.color)); d.rect(x0 + bw * i + bw * 0.12, y0 + ch - (ch * (acc + v)) / max, bw * 0.76, (ch * v) / max, 'F') } acc += v }) })
      d.setDrawColor(hex(line.color)); d.setLineWidth(1.8); line.values.forEach((v, i) => { if (i) d.line(x0 + bw * (i - 0.5), y0 + ch - (ch * line.values[i - 1]) / max, x0 + bw * (i + 0.5), y0 + ch - (ch * v) / max) })
    } else {
      const all = blk.series.flatMap((s) => s.values); const max = niceMax(Math.max(1, ...all)); axes(x0, y0, w, ch, max, blk.years)
      blk.series.forEach((s) => { d.setDrawColor(hex(s.color)); d.setLineWidth(1.8); s.values.forEach((v, i) => { if (i) d.line(x0 + (w * (i - 0.5)) / blk.years.length, y0 + ch - (ch * s.values[i - 1]) / max, x0 + (w * (i + 0.5)) / blk.years.length, y0 + ch - (ch * v) / max) }) })
    }
    // legend
    let lx = ML + 40; const ly = y + h - 6
    d.setFont('helvetica', 'normal'); d.setFontSize(7); d.setTextColor(TEXT)
    const items = blk.kind === 'band' ? [{ name: 'Median', color: NAVY }, { name: '25th–75th percentile', color: '#E4D9B4' }, { name: '10th–90th percentile', color: '#F1ECDC' }] : blk.series
    items.forEach((s) => { d.setFillColor(hex(s.color)); d.rect(lx, ly - 6, 8, 8, 'F'); d.text(s.name, lx + 12, ly); lx += 22 + d.getTextWidth(s.name) + 10 })
  }

  const render = (sec: Section) => {
    let y = newPage(sec.title, sec.subtitle)
    for (const blk of sec.blocks) {
      if (blk.type === 'kpis') y = kpis(blk, y)
      else if (blk.type === 'chart') { const h = Math.min(260, BOTTOM - y - 8); chart(blk, y, h); y += h + 8 }
      else if (blk.type === 'table') y = table(blk, y, sec.title, sec.subtitle)
      else if (blk.type === 'text') {
        const small = sec.id === 'assumptions'
        d.setFont('helvetica', 'normal'); d.setFontSize(small ? 7.5 : 10.5); d.setTextColor(small ? TEXT : INK)
        const lines = wrapText(d, blk.text, W - ML - MR), lh = small ? 10 : 14
        for (const ln of lines) { if (y + lh > BOTTOM) { y = newPage(`${sec.title} (continued)`, sec.subtitle); d.setFont('helvetica', 'normal'); d.setFontSize(small ? 7.5 : 10.5); d.setTextColor(small ? TEXT : INK) } d.text(ln, ML, y + 10); y += lh }
        y += 8
      } else if (blk.type === 'bullets') {
        d.setFont('helvetica', 'normal'); d.setFontSize(12); d.setTextColor(INK)
        for (const it of blk.items) { const lines = wrapText(d, it, W - ML - MR - 18); lines.forEach((ln, i) => { if (y + 16 > BOTTOM) { y = newPage(`${sec.title} (continued)`, sec.subtitle); d.setFont('helvetica', 'normal'); d.setFontSize(12); d.setTextColor(INK) } if (!i) { d.setFillColor(GOLD); d.rect(ML, y + 4, 4, 4, 'F') } d.text(ln, ML + 16, y + 11); y += 16 }); y += 6 }
      }
    }
  }
  buildSections(inp).forEach(render)
  d.setProperties({ title: `${inp.title}: ${inp.familyName}`, author: inp.preparedBy || 'Paradiem', creator: 'Paradiem Planning' })
  return d.output('blob')
}
