// Estate flow chart → native PowerPoint shapes (editable boxes, connectors, labels), plus
// PowerPoint build animations injected into the slide XML after pptxgenjs writes the file.
import PptxGenJS from 'pptxgenjs'
import JSZip from 'jszip'
import { BRAND } from './brand'
import { CANVAS, edgePath, wrap, money, nodeColor, edgeLabelLines } from './flow'

const PREFIX = 'flow:'
// Fit the 1600×900 canvas into a slide region (inches)
const REGION = { x: 0.3, y: 0.15, w: 9.4 }
const sx = REGION.w / CANVAS.w
const pt = (units) => units * sx * 72 // canvas font size → points

/** Draw the chart onto a slide. Returns element → shape-name map for animation. */
export function addFlowToSlide(pptx, slide, fc, region = REGION) {
  const s = region.w / CANVAS.w
  const X = (v) => region.x + v * s, Y = (v) => region.y + v * s
  const names = { nodes: {}, edges: {}, texts: {}, lines: {} }
  const seg = (a, b, opts, name) => {
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(a.x - b.x), h = Math.abs(a.y - b.y)
    slide.addShape(pptx.ShapeType.line, { x: X(x), y: Y(y), w: w * s, h: h * s, flipH: b.x < a.x, flipV: b.y < a.y, line: { color: BRAND.black, width: opts.width || 1, dashType: opts.dashed ? 'dash' : 'solid', endArrowType: opts.arrow ? 'triangle' : 'none' }, objectName: name })
  }
  // timing lines
  fc.lines.forEach((l) => {
    const n = `${PREFIX}line:${l.id}`; names.lines[l.id] = [n, `${n}:label`]
    slide.addShape(pptx.ShapeType.line, { x: X(40), y: Y(l.y), w: (CANVAS.w - 80) * s, h: 0, line: { color: BRAND.black, width: 0.5, dashType: 'dash' }, objectName: n })
    if (l.label) slide.addText(l.label, { x: X(48), y: Y(l.y) - 0.22, w: 2.2, h: 0.22, fontFace: 'Georgia', fontSize: 7.5, color: BRAND.black, valign: 'bottom', margin: 0, objectName: `${n}:label` })
  })
  // edges
  fc.edges.forEach((e) => {
    const g = edgePath(e, fc.nodes); if (!g) return
    const base = `${PREFIX}edge:${e.id}`; const list = []
    for (let i = 1; i < g.points.length; i++) { const n = `${base}:s${i}`; list.push(n); seg(g.points[i - 1], g.points[i], { dashed: e.style === 'dashed', arrow: i === g.points.length - 1, width: 1 }, n) }
    const lab = edgeLabelLines(e)
    if (lab.length) {
      const lx = g.labelAt.x + (e.labelDx || 0), ly = g.labelAt.y + (e.labelDy || 0)
      const n = `${base}:label`; list.push(n)
      slide.addText(lab.map((t, i) => ({ text: t, options: { breakLine: i < lab.length - 1 } })), { x: g.labelAt.horizontal ? X(lx) - 0.9 : X(lx), y: Y(ly) - 0.1 - (lab.length - 1) * 0.08, w: 1.8, h: 0.16 * lab.length + 0.06, fontFace: 'Georgia', fontSize: 9, color: BRAND.black, align: g.labelAt.horizontal ? 'center' : 'left', valign: 'middle', margin: 0, objectName: n })
    }
    names.edges[e.id] = list
  })
  // nodes
  fc.nodes.forEach((n) => {
    const fs = n.type === 'couple' ? 26 : 22
    const lines = wrap(n.label, Math.max(5, Math.floor((n.w - 16) / (fs * 0.6))))
    const amt = money(n.amount)
    const runs = [...lines.map((t, i) => ({ text: t, options: { breakLine: i < lines.length - 1 || !!amt } })), ...(amt ? [{ text: amt, options: { fontSize: pt(fs - 2) * 1.1 } }] : [])]
    const name = `${PREFIX}node:${n.id}`; names.nodes[n.id] = [name]
    slide.addText(runs, { x: X(n.x), y: Y(n.y), w: n.w * s, h: n.h * s, fill: { color: nodeColor(n).replace('#', '') }, line: { color: nodeColor(n).replace('#', ''), width: 0 }, fontFace: 'Georgia', fontSize: pt(fs) * 1.1, bold: true, color: BRAND.white, align: 'center', valign: 'middle', margin: 2, objectName: name })
  })
  // free text
  fc.texts.forEach((t) => {
    const name = `${PREFIX}text:${t.id}`; names.texts[t.id] = [name]
    const lines = String(t.text || '').split('\n')
    slide.addText(lines.map((l, i) => ({ text: l, options: { breakLine: i < lines.length - 1 } })), { x: X(t.x), y: Y(t.y) - (t.size || 20) * s, w: 4, h: (t.size || 20) * s * 1.3 * lines.length + 0.05, fontFace: 'Georgia', fontSize: pt(t.size || 20) * 1.1, bold: !!t.bold, italic: !!t.italic, color: (t.color || BRAND.black).replace('#', ''), valign: 'top', margin: 0, objectName: name })
  })
  return names
}

/** Human-readable preview of the build order (for the dashboard panel). */
export function describeSteps(fc) {
  const names = { nodes: {}, edges: {}, texts: {}, lines: {} }
  fc.nodes.forEach((n) => { names.nodes[n.id] = [`node:${n.id}`] })
  fc.edges.forEach((e) => { names.edges[e.id] = [`edge:${e.id}`] })
  fc.texts.forEach((t) => { names.texts[t.id] = [`text:${t.id}`] })
  fc.lines.forEach((l) => { names.lines[l.id] = [`line:${l.id}`] })
  const label = (key) => {
    const [kind, id] = key.split(':')
    if (kind === 'node') return fc.nodes.find((n) => n.id === id)?.label || 'Box'
    if (kind === 'edge') { const e = fc.edges.find((x) => x.id === id); return e ? `${e.number != null ? `(${e.number}) ` : ''}${e.label || 'connector'}` : 'Connector' }
    if (kind === 'text') return `"${(fc.texts.find((t) => t.id === id)?.text || 'Text').split('\n')[0]}"`
    return fc.lines.find((l) => l.id === id)?.label || 'Timing line'
  }
  return animationSteps(fc, names).map((st) => st.map(label))
}

/** Build the animation steps: arrays of shape names, in order. */
export function animationSteps(fc, names) {
  const a = fc.animation || {}
  const steps = []
  if (a.order === 'manual') {
    const byStep = {}
    const put = (k, list) => { const st = Number(a.steps?.[k]); if (!st || st < 1) return; (byStep[st] = byStep[st] || []).push(...list) }
    fc.nodes.forEach((n) => put(`node:${n.id}`, names.nodes[n.id] || []))
    fc.edges.forEach((e) => put(`edge:${e.id}`, names.edges[e.id] || []))
    fc.texts.forEach((t) => put(`text:${t.id}`, names.texts[t.id] || []))
    fc.lines.forEach((l) => put(`line:${l.id}`, names.lines[l.id] || []))
    Object.keys(byStep).map(Number).sort((x, y) => x - y).forEach((k) => steps.push(byStep[k]))
    return steps
  }
  // by flow number: roots first, then each edge (with its target box) in numeric order
  const incoming = new Set(fc.edges.map((e) => e.to))
  const shown = new Set()
  const first = []
  fc.nodes.filter((n) => !incoming.has(n.id)).forEach((n) => { first.push(...(names.nodes[n.id] || [])); shown.add(n.id) })
  if (first.length) steps.push(first)
  const ordered = [...fc.edges].sort((x, y) => (x.number ?? 999) - (y.number ?? 999))
  for (const e of ordered) {
    const st = [...(names.edges[e.id] || [])]
    if (!shown.has(e.to)) { st.push(...(names.nodes[e.to] || [])); shown.add(e.to) }
    if (st.length) steps.push(st)
  }
  fc.nodes.forEach((n) => { if (!shown.has(n.id)) steps.push(names.nodes[n.id] || []) })
  return steps.filter((s) => s.length)
}

/** Inject a PowerPoint build sequence into the slide that contains the flow shapes. */
export async function injectAnimation(blob, steps, { mode = 'click', effect = 'appear', delayMs = 700 } = {}) {
  if (!steps.length) return blob
  const zip = await JSZip.loadAsync(blob)
  const slideFiles = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
  for (const file of slideFiles) {
    let xml = await zip.file(file).async('string')
    if (!xml.includes(`name="${PREFIX}`)) continue
    const idOf = {}
    for (const m of xml.matchAll(/<p:cNvPr id="(\d+)" name="([^"]+)"/g)) idOf[m[2]] = m[1]
    let cid = 1000
    const eff = (spid, nodeType, delay) => {
      const c1 = cid++, c2 = cid++, c3 = cid++
      const set = `<p:set><p:cBhvr><p:cTn id="${c2}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>`
      const fade = effect === 'fade' ? `<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="${c3}" dur="500"/><p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cBhvr></p:animEffect>` : ''
      const preset = effect === 'fade' ? 'presetID="10" presetClass="entr" presetSubtype="0"' : 'presetID="1" presetClass="entr" presetSubtype="0"'
      return `<p:par><p:cTn id="${c1}" ${preset} fill="hold" grpId="0" nodeType="${nodeType}"><p:stCondLst><p:cond delay="${delay}"/></p:stCondLst><p:childTnLst>${set}${fade}</p:childTnLst></p:cTn></p:par>`
    }
    const spids = []
    const groups = []
    if (mode === 'click') {
      steps.forEach((st) => {
        const ids = st.map((n) => idOf[n]).filter(Boolean); if (!ids.length) return
        spids.push(...ids)
        const inner = ids.map((id, i) => eff(id, i === 0 ? 'clickEffect' : 'withEffect', 0)).join('')
        groups.push(`<p:par><p:cTn id="${cid++}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="${cid++}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${inner}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>`)
      })
    } else {
      // one click starts it; every step follows automatically after `delayMs`
      const inner = []
      steps.forEach((st, si) => {
        const ids = st.map((n) => idOf[n]).filter(Boolean); if (!ids.length) return
        spids.push(...ids)
        const d = si * delayMs
        ids.forEach((id, i) => inner.push(eff(id, si === 0 && i === 0 ? 'clickEffect' : i === 0 ? 'afterEffect' : 'withEffect', d)))
      })
      groups.push(`<p:par><p:cTn id="${cid++}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst><p:par><p:cTn id="${cid++}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${inner.join('')}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>`)
    }
    if (!spids.length) continue
    const timing = `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>${groups.join('')}</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst><p:bldLst>${[...new Set(spids)].map((id) => `<p:bldP spid="${id}" grpId="0"/>`).join('')}</p:bldLst></p:timing>`
    xml = xml.replace(/<p:timing>[\s\S]*?<\/p:timing>/, '')
    xml = xml.replace('</p:sld>', `${timing}</p:sld>`)
    zip.file(file, xml)
  }
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })
}

/** Standalone one-slide deck with the chart as native shapes (and optional animation). */
export async function buildFlowDeck(fc, family) {
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_16x9'
  pptx.title = `Estate Flow Chart — ${family?.name || ''}`
  const s = pptx.addSlide()
  s.background = { color: BRAND.white }
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0.41, w: 0.06, h: 4.27, fill: { color: BRAND.navy }, line: { color: BRAND.navy, width: 0 } })
  const names = addFlowToSlide(pptx, s, fc)
  const blob = await pptx.write({ outputType: 'blob' })
  const a = fc.animation || {}
  if (!a.enabled) return blob
  return injectAnimation(blob, animationSteps(fc, names), { mode: a.mode || 'click', effect: a.effect || 'appear', delayMs: Number(a.delayMs) || 700 })
}
