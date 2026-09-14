// Estate flow-chart model + geometry. Canvas is 1600 x 900 units (16:9), brand colours.
import { FLOW_COLORS, BRAND } from './brand'
import { uid } from './util'

export const CANVAS = { w: 1600, h: 900 }
export const NODE_TYPES = [
  { id: 'couple', label: 'Couple / estate' }, { id: 'individual', label: 'Individual / heirs' }, { id: 'trust', label: 'Trust' },
  { id: 'irs', label: 'IRS / taxes' }, { id: 'charity', label: 'Charity' }, { id: 'other', label: 'Other' },
]
export const nodeColor = (n) => `#${n.color || FLOW_COLORS[n.type] || FLOW_COLORS.other}`

export function emptyFlow() { return { nodes: [], edges: [], texts: [], lines: [], version: 1 } }

export function newNode(type = 'trust', x = 700, y = 380) {
  const big = type === 'couple'
  return { id: uid(), type, label: type === 'couple' ? 'Husband & Wife' : type === 'irs' ? 'IRS' : type === 'trust' ? 'Trust' : 'Name', amount: null, x, y, w: big ? 200 : 170, h: big ? 130 : 100 }
}
export function newText(x = 200, y = 200) { return { id: uid(), text: 'Text', x, y, size: 20, bold: false, italic: false, color: BRAND.ink } }
export function newLine(y = 300) { return { id: uid(), y, label: "(Husband's Passing)" } }

// Side anchors. pos = 0..1 along the side.
export function anchor(n, side, pos = 0.5) {
  switch (side) {
    case 'top': return { x: n.x + n.w * pos, y: n.y, nx: 0, ny: -1 }
    case 'bottom': return { x: n.x + n.w * pos, y: n.y + n.h, nx: 0, ny: 1 }
    case 'left': return { x: n.x, y: n.y + n.h * pos, nx: -1, ny: 0 }
    default: return { x: n.x + n.w, y: n.y + n.h * pos, nx: 1, ny: 0 }
  }
}
export function autoSides(a, b) {
  const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 }, bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 }
  const dx = bc.x - ac.x, dy = bc.y - ac.y
  if (Math.abs(dy) >= Math.abs(dx)) return dy > 0 ? ['bottom', 'top'] : ['top', 'bottom']
  return dx > 0 ? ['right', 'left'] : ['left', 'right']
}
export function newEdge(from, to, a, b) {
  const [fs, ts] = autoSides(a, b)
  return { id: uid(), from, to, fromSide: fs, toSide: ts, fromPos: 0.5, toPos: 0.5, label: '', amount: null, style: 'solid', mid: 0.5, labelDx: 0, labelDy: 0, number: null }
}

// Orthogonal path. Returns { d, points, labelAt }
export function edgePath(e, nodes) {
  const a = nodes.find((n) => n.id === e.from), b = nodes.find((n) => n.id === e.to)
  if (!a || !b) return null
  const s = anchor(a, e.fromSide, e.fromPos ?? 0.5), t = anchor(b, e.toSide, e.toPos ?? 0.5)
  const off = 18
  const p1 = { x: s.x + s.nx * off, y: s.y + s.ny * off }
  const p4 = { x: t.x + t.nx * off, y: t.y + t.ny * off }
  const mid = e.mid ?? 0.5
  let pts
  const sv = s.ny !== 0, tv = t.ny !== 0
  if (sv && tv) { const my = p1.y + (p4.y - p1.y) * mid; pts = [s, p1, { x: p1.x, y: my }, { x: p4.x, y: my }, p4, t] }
  else if (!sv && !tv) { const mx = p1.x + (p4.x - p1.x) * mid; pts = [s, p1, { x: mx, y: p1.y }, { x: mx, y: p4.y }, p4, t] }
  else if (sv) { pts = [s, p1, { x: p1.x, y: p4.y }, p4, t] }
  else { pts = [s, p1, { x: p4.x, y: p1.y }, p4, t] }
  // drop duplicate consecutive points
  pts = pts.filter((p, i) => i === 0 || Math.abs(p.x - pts[i - 1].x) > 0.01 || Math.abs(p.y - pts[i - 1].y) > 0.01)
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  // label anchor: middle of the longest segment
  let best = 0, bi = 0
  for (let i = 1; i < pts.length; i++) { const L = Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y); if (L > best) { best = L; bi = i } }
  const labelAt = { x: (pts[bi].x + pts[bi - 1].x) / 2, y: (pts[bi].y + pts[bi - 1].y) / 2, horizontal: Math.abs(pts[bi].x - pts[bi - 1].x) > Math.abs(pts[bi].y - pts[bi - 1].y) }
  const elbow = pts.length >= 4 ? pts[Math.floor(pts.length / 2)] : labelAt
  return { d, points: pts, labelAt, elbow }
}

export function wrap(text, maxChars) {
  const out = []
  for (const para of String(text || '').split('\n')) {
    let line = ''
    for (const w of para.split(' ')) {
      if ((line + ' ' + w).trim().length > maxChars && line) { out.push(line); line = w } else line = (line + ' ' + w).trim()
    }
    out.push(line)
  }
  return out
}
export const money = (v) => (v == null || v === '' || isNaN(Number(v))) ? '' : `$${Math.round(Number(v)).toLocaleString()}`

// Convert a Claude draft ({nodes with col,row}) into positioned chart
export function fromDraft(draft) {
  const fc = emptyFlow()
  const colX = (c) => 110 + c * 300, rowY = (r) => 40 + r * 215
  for (const n of draft.nodes || []) {
    const nn = newNode(n.type, colX(n.col), rowY(n.row)); nn.id = n.id || nn.id; nn.label = n.label; nn.amount = n.amount ?? null; fc.nodes.push(nn)
  }
  for (const e of draft.edges || []) {
    const a = fc.nodes.find((n) => n.id === e.from), b = fc.nodes.find((n) => n.id === e.to); if (!a || !b) continue
    const ne = newEdge(a.id, b.id, a, b); ne.label = e.label; ne.amount = e.amount ?? null; fc.edges.push(ne)
  }
  for (const l of draft.lines || []) fc.lines.push({ id: uid(), y: rowY(l.row) - 20, label: l.label })
  fc.edges.forEach((e, i) => { e.number = i + 1 })
  return fc
}

// Serialize to a standalone SVG string (fonts: Georgia / Calibri with fallbacks)
export function toSVG(fc, { background = `#${BRAND.cream}` } = {}) {
  const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const parts = []
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS.w} ${CANVAS.h}" width="${CANVAS.w}" height="${CANVAS.h}" font-family="Calibri, 'Segoe UI', Helvetica, Arial, sans-serif">`)
  parts.push(`<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#${BRAND.ink}"/></marker></defs>`)
  parts.push(`<rect width="${CANVAS.w}" height="${CANVAS.h}" fill="${background}"/>`)
  for (const l of fc.lines) {
    parts.push(`<line x1="40" y1="${l.y}" x2="${CANVAS.w - 40}" y2="${l.y}" stroke="#${BRAND.ink}" stroke-width="1.5" stroke-dasharray="6 6"/>`)
    if (l.label) parts.push(`<text x="48" y="${l.y - 6}" font-size="16" fill="#${BRAND.taupe}">${esc(l.label)}</text>`)
  }
  for (const e of fc.edges) {
    const g = edgePath(e, fc.nodes); if (!g) continue
    parts.push(`<path d="${g.d}" fill="none" stroke="#${BRAND.ink}" stroke-width="2" ${e.style === 'dashed' ? 'stroke-dasharray="8 6"' : ''} marker-end="url(#arr)"/>`)
    const lab = edgeLabelLines(e); if (lab.length) {
      const x = g.labelAt.x + (e.labelDx || 0), y = g.labelAt.y + (e.labelDy || 0) - (lab.length - 1) * 9
      parts.push(`<text x="${x}" y="${y}" font-size="16" text-anchor="middle" fill="#${BRAND.ink}">${lab.map((t, i) => `<tspan x="${x}" dy="${i ? 18 : 0}">${esc(t)}</tspan>`).join('')}</text>`)
    }
  }
  for (const n of fc.nodes) {
    parts.push(`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" fill="${nodeColor(n)}"/>`)
    const fs = n.type === 'couple' ? 26 : 22
    const lines = wrap(n.label, Math.max(5, Math.floor((n.w - 16) / (fs * 0.6))))
    const amt = money(n.amount)
    const total = lines.length + (amt ? 1 : 0)
    let y = n.y + n.h / 2 - ((total - 1) * (fs + 4)) / 2 + fs * 0.35
    for (const t of lines) { parts.push(`<text x="${n.x + n.w / 2}" y="${y}" font-size="${fs}" font-family="Georgia, 'Times New Roman', serif" font-weight="bold" text-anchor="middle" fill="#${BRAND.cream}">${esc(t)}</text>`); y += fs + 4 }
    if (amt) parts.push(`<text x="${n.x + n.w / 2}" y="${y}" font-size="${fs - 2}" font-family="Georgia, 'Times New Roman', serif" font-weight="bold" text-anchor="middle" fill="#${BRAND.cream}">${esc(amt)}</text>`)
  }
  for (const t of fc.texts) {
    const lines = String(t.text || '').split('\n')
    parts.push(`<text x="${t.x}" y="${t.y}" font-size="${t.size || 20}" fill="#${t.color || BRAND.ink}" ${t.bold ? 'font-weight="bold"' : ''} ${t.italic ? 'font-style="italic"' : ''}>${lines.map((l, i) => `<tspan x="${t.x}" dy="${i ? (t.size || 20) * 1.2 : 0}">${esc(l)}</tspan>`).join('')}</text>`)
  }
  parts.push('</svg>')
  return parts.join('')
}
export function edgeLabelLines(e) {
  const head = [e.number != null ? `(${e.number})` : '', e.label || ''].filter(Boolean).join(' ')
  const lines = head ? wrap(head, 22) : []
  const amt = money(e.amount); if (amt) lines.push(amt)
  return lines
}
export async function toPNG(fc, scale = 2) {
  const svg = toSVG(fc)
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
    const c = document.createElement('canvas'); c.width = CANVAS.w * scale; c.height = CANVAS.h * scale
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/png')
  } finally { URL.revokeObjectURL(url) }
}
