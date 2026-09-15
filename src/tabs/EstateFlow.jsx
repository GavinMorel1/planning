import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, useFamily } from '../lib/store'
import { CANVAS, NODE_TYPES, emptyFlow, newNode, newText, newLine, newEdge, edgePath, wrap, money, nodeColor, toSVG, toPNG, fromDraft, edgeLabelLines } from '../lib/flow'
import { BRAND } from '../lib/brand'
import { buildFlowDeck, describeSteps } from '../lib/flowpptx'
import { draftFlowchart, CLAUDE_ENABLED } from '../lib/claude'
import { familyContext } from '../lib/context'
import { Card, Eyebrow, Title, Btn, Row, Field, Input, Select, TextArea, Note, Check, Pill } from '../components/ui'
import { download } from '../lib/util'

export default function EstateFlow({ C, isDesktop }) {
  const { settings } = useStore()
  const [f, patch] = useFamily()
  const fc = f.flowchart || emptyFlow()
  const svgRef = useRef(null)
  const [sel, setSel] = useState(null) // {kind:'node'|'edge'|'text'|'line', id}
  const [connect, setConnect] = useState(null) // source node id while connecting
  const [drag, setDrag] = useState(null)
  const [history, setHistory] = useState([])
  const [busy, setBusy] = useState(false)
  const [nodeType, setNodeType] = useState('trust')

  const commit = (next) => { setHistory((h) => [...h.slice(-40), fc]); patch({ flowchart: { ...next, version: 1 } }) }
  const live = (next) => patch({ flowchart: { ...next, version: 1 } }) // no history entry (drag)
  const undo = () => { if (!history.length) return; const prev = history[history.length - 1]; setHistory((h) => h.slice(0, -1)); patch({ flowchart: prev }) }

  const toSvgPoint = (evt) => {
    const svg = svgRef.current; const pt = svg.createSVGPoint(); pt.x = evt.clientX; pt.y = evt.clientY
    const p = pt.matrixTransform(svg.getScreenCTM().inverse()); return { x: p.x, y: p.y }
  }
  const snap = (v) => Math.round(v / 10) * 10

  // ── drag handling ──
  const startDrag = (evt, kind, id, extra = {}) => {
    evt.stopPropagation()
    const p = toSvgPoint(evt)
    if (kind === 'node' && connect) {
      if (connect !== id) { const a = fc.nodes.find((n) => n.id === connect), b = fc.nodes.find((n) => n.id === id); const e = newEdge(connect, id, a, b); e.number = fc.edges.length + 1; commit({ ...fc, edges: [...fc.edges, e] }); setSel({ kind: 'edge', id: e.id }) }
      setConnect(null); return
    }
    setSel({ kind, id })
    setDrag({ kind, id, start: p, snapshot: fc, ...extra })
    setHistory((h) => [...h.slice(-40), fc])
  }
  const onMove = (evt) => {
    if (!drag) return
    const p = toSvgPoint(evt); const dx = p.x - drag.start.x, dy = p.y - drag.start.y
    const s = drag.snapshot
    if (drag.kind === 'node') live({ ...fc, nodes: fc.nodes.map((n) => n.id === drag.id ? { ...n, x: snap(s.nodes.find((k) => k.id === n.id).x + dx), y: snap(s.nodes.find((k) => k.id === n.id).y + dy) } : n) })
    else if (drag.kind === 'text') live({ ...fc, texts: fc.texts.map((t) => t.id === drag.id ? { ...t, x: snap(s.texts.find((k) => k.id === t.id).x + dx), y: snap(s.texts.find((k) => k.id === t.id).y + dy) } : t) })
    else if (drag.kind === 'line') live({ ...fc, lines: fc.lines.map((l) => l.id === drag.id ? { ...l, y: snap(s.lines.find((k) => k.id === l.id).y + dy) } : l) })
    else if (drag.kind === 'edgeLabel') live({ ...fc, edges: fc.edges.map((e) => e.id === drag.id ? { ...e, labelDx: (s.edges.find((k) => k.id === e.id).labelDx || 0) + dx, labelDy: (s.edges.find((k) => k.id === e.id).labelDy || 0) + dy } : e) })
    else if (drag.kind === 'elbow') {
      live({ ...fc, edges: fc.edges.map((e) => {
        if (e.id !== drag.id) return e
        const g = edgePath(e, fc.nodes); if (!g || g.points.length < 6) return e
        const a = g.points[1], b = g.points[4]
        const vertical = Math.abs(a.y - b.y) > Math.abs(a.x - b.x) && e.fromSide !== 'left' && e.fromSide !== 'right'
        const t = vertical ? (p.y - a.y) / ((b.y - a.y) || 1) : (p.x - a.x) / ((b.x - a.x) || 1)
        return { ...e, mid: Math.max(0.05, Math.min(0.95, t)) }
      }) })
    }
    else if (drag.kind === 'resize') live({ ...fc, nodes: fc.nodes.map((n) => n.id === drag.id ? { ...n, w: Math.max(80, snap(s.nodes.find((k) => k.id === n.id).w + dx)), h: Math.max(50, snap(s.nodes.find((k) => k.id === n.id).h + dy)) } : n) })
  }
  const endDrag = () => setDrag(null)

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return
      if (e.key === 'Escape') { setConnect(null); setSel(null) }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); del() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo() }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  })

  const del = () => {
    if (!sel) return
    if (sel.kind === 'node') commit({ ...fc, nodes: fc.nodes.filter((n) => n.id !== sel.id), edges: fc.edges.filter((e) => e.from !== sel.id && e.to !== sel.id) })
    if (sel.kind === 'edge') commit({ ...fc, edges: fc.edges.filter((e) => e.id !== sel.id) })
    if (sel.kind === 'text') commit({ ...fc, texts: fc.texts.filter((t) => t.id !== sel.id) })
    if (sel.kind === 'line') commit({ ...fc, lines: fc.lines.filter((l) => l.id !== sel.id) })
    setSel(null)
  }
  const updSel = (p) => {
    if (!sel) return
    const k = sel.kind === 'node' ? 'nodes' : sel.kind === 'edge' ? 'edges' : sel.kind === 'text' ? 'texts' : 'lines'
    commit({ ...fc, [k]: fc[k].map((x) => x.id === sel.id ? { ...x, ...p } : x) })
  }
  const selected = sel ? (fc[sel.kind === 'node' ? 'nodes' : sel.kind === 'edge' ? 'edges' : sel.kind === 'text' ? 'texts' : 'lines'] || []).find((x) => x.id === sel.id) : null
  const renumber = () => commit({ ...fc, edges: fc.edges.map((e, i) => ({ ...e, number: i + 1 })) })
  const exportPng = async () => { const png = await toPNG(fc); patch({ flowchart: { ...fc, png, pngAt: new Date().toISOString() } }); const b = await (await fetch(png)).blob(); download(b, `${f.name.replace(/\s+/g, '-')}-estate-flow.png`) }
  const exportPptx = async () => {
    setBusy(true)
    try { const blob = await buildFlowDeck(fc, f); download(blob, `${f.name.replace(/\s+/g, '-')}-estate-flow.pptx`) } catch (e) { alert(`PowerPoint export failed: ${e.message}`); console.error(e) }
    setBusy(false)
  }
  const anim = fc.animation || { enabled: false, mode: 'click', effect: 'appear', delayMs: 700, order: 'flow', steps: {} }
  const setAnim = (p) => patch({ flowchart: { ...fc, animation: { ...anim, ...p } } })
  const setStep = (key, v) => setAnim({ steps: { ...(anim.steps || {}), [key]: v === '' ? undefined : Number(v) } })
  const stepField = (key) => anim.enabled && anim.order === 'manual' && (
    <Field C={C} label="Animation step" hint="1 = first to appear. Elements sharing a number appear together; blank = never animated (visible from the start)."><Input C={C} value={anim.steps?.[key] ?? ''} onChange={(v) => setStep(key, v.replace(/[^0-9]/g, ''))} placeholder="e.g. 3" /></Field>
  )
  const preview = anim.enabled ? describeSteps(fc) : []
  const exportSvg = () => download(new Blob([toSVG(fc)], { type: 'image/svg+xml' }), `${f.name.replace(/\s+/g, '-')}-estate-flow.svg`)
  const draft = async () => {
    if (fc.nodes.length && !confirm('Replace the current chart with a Claude draft?')) return
    setBusy(true)
    try { const d = await draftFlowchart({ family: f, context: familyContext(f, settings) }); commit(fromDraft(d)); if (d.notes?.length) alert(`Claude notes:\n\n${d.notes.join('\n')}`) } catch (e) { alert(e.message) }
    setBusy(false)
  }
  const starter = () => {
    const p = f.profile || {}
    const couple = newNode('couple', 700, 30); couple.label = [p.spouse1?.name, p.spouse2?.name].filter(Boolean).join(' & ') || 'Husband & Wife'; couple.amount = f.netWorth ? Number(f.netWorth) : null
    const l1 = newLine(230); l1.label = `(${p.spouse1?.name || 'Husband'}'s Passing)`
    const l2 = newLine(560); l2.label = `(${p.spouse2?.name || 'Wife'}'s Passing)`
    const surv = newNode('individual', 700, 330); surv.label = p.spouse2?.name || 'Survivor'
    const kids = newNode('individual', 700, 690); kids.label = `${(f.name || '').replace(/^The /, '').replace(/ Family$/, '')} Children`
    const e1 = newEdge(couple.id, surv.id, couple, surv); e1.label = 'Assets to survivor'; e1.number = 1
    const e2 = newEdge(surv.id, kids.id, surv, kids); e2.label = 'Assets to children'; e2.number = 2
    commit({ ...emptyFlow(), nodes: [couple, surv, kids], edges: [e1, e2], lines: [l1, l2] })
  }

  const tb = (label, fn, opts = {}) => <Btn C={C} small onClick={fn} {...opts}>{label}</Btn>

  return (
    <div>
      <Title C={C} isDesktop={isDesktop} sub="Current estate flow. Drag boxes anywhere, connect any two, label every line, add free text. Solid = asset flow; dashed horizontal = timing." right={<>
        {tb(busy ? 'Drafting…' : 'Draft with Claude', draft, { disabled: !CLAUDE_ENABLED || busy })}
        {tb(busy ? 'Building…' : 'PowerPoint slide (.pptx)', exportPptx, { primary: true, disabled: !fc.nodes.length || busy })}
        {tb('PNG', exportPng, { disabled: !fc.nodes.length })}{tb('SVG', exportSvg, { disabled: !fc.nodes.length })}
      </>}>Estate Flow · {f.name}</Title>

      <Card C={C} style={{ padding: '10px 12px', marginBottom: 10 }}>
        <Row gap={8}>
          <Select C={C} value={nodeType} onChange={setNodeType} options={NODE_TYPES.map((t) => ({ value: t.id, label: t.label }))} style={{ padding: '6px 8px', fontSize: 12 }} />
          {tb('+ Box', () => { const n = newNode(nodeType, 700 + (fc.nodes.length % 4) * 40, 380 + (fc.nodes.length % 3) * 40); commit({ ...fc, nodes: [...fc.nodes, n] }); setSel({ kind: 'node', id: n.id }) })}
          {tb(connect ? 'Click target box…' : 'Connect', () => setConnect(connect ? null : (sel?.kind === 'node' ? sel.id : '__pick')), { primary: !!connect })}
          {tb('+ Text', () => { const t = newText(200, 200 + fc.texts.length * 30); commit({ ...fc, texts: [...fc.texts, t] }); setSel({ kind: 'text', id: t.id }) })}
          {tb('+ Timing line', () => { const l = newLine(250 + fc.lines.length * 300); commit({ ...fc, lines: [...fc.lines, l] }); setSel({ kind: 'line', id: l.id }) })}
          {tb('Renumber flows', renumber, { disabled: !fc.edges.length })}
          {tb('Undo', undo, { ghost: true, disabled: !history.length })}
          {tb('Delete', del, { ghost: true, disabled: !sel })}
          {!fc.nodes.length && tb('Starter layout', starter, { ghost: true })}
          {fc.nodes.length > 0 && tb('Clear', () => { if (confirm('Clear the whole chart?')) commit(emptyFlow()) }, { ghost: true })}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: C.t4 }}>{connect ? 'Connect mode: click the source box, then the target box. Esc cancels.' : 'Click to select · drag to move · Delete key removes · ⌘Z undo'}{fc.nodes.length ? ' · this chart goes into the Gap Analysis deck as editable PowerPoint shapes' : ''}</span>
        </Row>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 300px' : '1fr', gap: 12 }}>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', background: `#${BRAND.cream}` }}>
          <svg ref={svgRef} viewBox={`0 0 ${CANVAS.w} ${CANVAS.h}`} style={{ width: '100%', height: 'auto', display: 'block', cursor: connect ? 'crosshair' : drag ? 'grabbing' : 'default', fontFamily: "Calibri, 'Segoe UI', Helvetica, Arial, sans-serif", userSelect: 'none' }}
            onMouseMove={onMove} onMouseUp={endDrag} onMouseLeave={endDrag} onMouseDown={() => { setSel(null) }}>
            <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill={`#${BRAND.ink}`} /></marker></defs>
            <rect width={CANVAS.w} height={CANVAS.h} fill={`#${BRAND.cream}`} />
            {/* timing lines */}
            {fc.lines.map((l) => (
              <g key={l.id} onMouseDown={(e) => startDrag(e, 'line', l.id)} style={{ cursor: 'ns-resize' }}>
                <line x1={40} y1={l.y} x2={CANVAS.w - 40} y2={l.y} stroke={`#${BRAND.ink}`} strokeWidth={sel?.id === l.id ? 3 : 1.5} strokeDasharray="6 6" />
                <line x1={40} y1={l.y} x2={CANVAS.w - 40} y2={l.y} stroke="transparent" strokeWidth={16} />
                {l.label && <text x={48} y={l.y - 6} fontSize={16} fill={`#${BRAND.taupe}`}>{l.label}</text>}
              </g>
            ))}
            {/* edges */}
            {fc.edges.map((e) => {
              const g = edgePath(e, fc.nodes); if (!g) return null
              const isSel = sel?.id === e.id
              const lab = edgeLabelLines(e)
              const lx = g.labelAt.x + (e.labelDx || 0), ly = g.labelAt.y + (e.labelDy || 0) - (lab.length - 1) * 9
              return (
                <g key={e.id}>
                  <path d={g.d} fill="none" stroke="transparent" strokeWidth={14} onMouseDown={(ev) => { ev.stopPropagation(); setSel({ kind: 'edge', id: e.id }) }} style={{ cursor: 'pointer' }} />
                  <path d={g.d} fill="none" stroke={isSel ? `#${BRAND.gold}` : `#${BRAND.ink}`} strokeWidth={isSel ? 3 : 2} strokeDasharray={e.style === 'dashed' ? '8 6' : undefined} markerEnd="url(#arrow)" pointerEvents="none" />
                  {isSel && g.points.length >= 6 && <circle cx={g.elbow.x} cy={g.elbow.y} r={7} fill={`#${BRAND.gold}`} stroke={`#${BRAND.ink}`} onMouseDown={(ev) => startDrag(ev, 'elbow', e.id)} style={{ cursor: 'move' }} />}
                  {lab.length > 0 && (
                    <g onMouseDown={(ev) => startDrag(ev, 'edgeLabel', e.id)} style={{ cursor: 'move' }}>
                      <rect x={g.labelAt.horizontal ? lx - 80 : lx - 4} y={ly - 16} width={160} height={lab.length * 18 + 6} fill={isSel ? `#${BRAND.gold}22` : 'transparent'} />
                      <text x={lx} y={ly} fontSize={16} textAnchor={g.labelAt.horizontal ? 'middle' : 'start'} fill={`#${BRAND.ink}`}>{lab.map((t, i) => <tspan key={i} x={lx} dy={i ? 18 : 0}>{t}</tspan>)}</text>
                    </g>
                  )}
                </g>
              )
            })}
            {/* nodes */}
            {fc.nodes.map((n) => {
              const isSel = sel?.id === n.id, fs = n.type === 'couple' ? 26 : 22
              const lines = wrap(n.label, Math.max(5, Math.floor((n.w - 16) / (fs * 0.6)))), amt = money(n.amount), total = lines.length + (amt ? 1 : 0)
              let y = n.y + n.h / 2 - ((total - 1) * (fs + 4)) / 2 + fs * 0.35
              const rows = lines.map((t) => { const r = { t, y, fs }; y += fs + 4; return r })
              return (
                <g key={n.id} onMouseDown={(e) => startDrag(e, 'node', n.id)} style={{ cursor: connect ? 'crosshair' : 'grab' }}>
                  <rect x={n.x} y={n.y} width={n.w} height={n.h} fill={nodeColor(n)} stroke={isSel || connect === n.id ? `#${BRAND.gold}` : 'none'} strokeWidth={4} />
                  {rows.map((r, i) => <text key={i} x={n.x + n.w / 2} y={r.y} fontSize={r.fs} fontFamily="Georgia, 'Times New Roman', serif" fontWeight="bold" textAnchor="middle" fill={`#${BRAND.cream}`}>{r.t}</text>)}
                  {amt && <text x={n.x + n.w / 2} y={y} fontSize={fs - 2} fontFamily="Georgia, 'Times New Roman', serif" fontWeight="bold" textAnchor="middle" fill={`#${BRAND.cream}`}>{amt}</text>}
                  {isSel && <rect x={n.x + n.w - 12} y={n.y + n.h - 12} width={12} height={12} fill={`#${BRAND.gold}`} onMouseDown={(e) => startDrag(e, 'resize', n.id)} style={{ cursor: 'nwse-resize' }} />}
                </g>
              )
            })}
            {/* free text */}
            {fc.texts.map((t) => (
              <g key={t.id} onMouseDown={(e) => startDrag(e, 'text', t.id)} style={{ cursor: 'move' }}>
                <text x={t.x} y={t.y} fontSize={t.size || 20} fill={`#${t.color || BRAND.ink}`} fontWeight={t.bold ? 'bold' : 'normal'} fontStyle={t.italic ? 'italic' : 'normal'} style={{ outline: sel?.id === t.id ? `2px dashed #${BRAND.gold}` : 'none' }}>
                  {String(t.text || '').split('\n').map((l, i) => <tspan key={i} x={t.x} dy={i ? (t.size || 20) * 1.2 : 0}>{l || ' '}</tspan>)}
                </text>
              </g>
            ))}
            {!fc.nodes.length && <text x={CANVAS.w / 2} y={CANVAS.h / 2} textAnchor="middle" fontSize={26} fill={`#${BRAND.mist}`} fontFamily="Georgia, serif">Add a box, use the starter layout, or draft with Claude</text>}
          </svg>
        </div>

        <div>
          <Card C={C}>
            <Eyebrow C={C}>{selected ? `Selected ${sel.kind}` : 'Properties'}</Eyebrow>
            {!selected && <div style={{ fontSize: 12.5, color: C.t4, lineHeight: 1.6 }}>Select a box, line, connector or text to edit it. Colours follow the brand: green couple, gold trusts, navy heirs, oxblood IRS.</div>}
            {selected && sel.kind === 'node' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Field C={C} label="Label"><TextArea C={C} rows={2} value={selected.label} onChange={(v) => updSel({ label: v })} /></Field>
                <Field C={C} label="Amount ($)"><Input C={C} value={selected.amount ?? ''} onChange={(v) => updSel({ amount: v === '' ? null : Number(String(v).replace(/[^0-9.\-]/g, '')) })} /></Field>
                <Field C={C} label="Type / colour"><Select C={C} value={selected.type} onChange={(v) => updSel({ type: v, color: undefined })} options={NODE_TYPES.map((t) => ({ value: t.id, label: t.label }))} style={{ width: '100%' }} /></Field>
                <Field C={C} label="Custom colour (hex, optional)"><Input C={C} value={selected.color || ''} onChange={(v) => updSel({ color: v.replace('#', '') || undefined })} placeholder="e.g. 4A7C59" /></Field>
                <Row gap={8}><Field C={C} label="Width"><Input C={C} value={selected.w} onChange={(v) => updSel({ w: Number(v) || selected.w })} /></Field><Field C={C} label="Height"><Input C={C} value={selected.h} onChange={(v) => updSel({ h: Number(v) || selected.h })} /></Field></Row>
                {stepField(`node:${selected.id}`)}
                <Btn C={C} small onClick={() => setConnect(selected.id)}>Connect from this box…</Btn>
              </div>
            )}
            {selected && sel.kind === 'edge' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Row gap={8}><Field C={C} label="Number"><Input C={C} value={selected.number ?? ''} onChange={(v) => updSel({ number: v === '' ? null : Number(v) })} /></Field><Field C={C} label="Style"><Select C={C} value={selected.style} onChange={(v) => updSel({ style: v })} options={[{ value: 'solid', label: 'Solid (asset flow)' }, { value: 'dashed', label: 'Dashed' }]} style={{ width: '100%' }} /></Field></Row>
                <Field C={C} label="Label"><TextArea C={C} rows={2} value={selected.label} onChange={(v) => updSel({ label: v })} placeholder="Assets to Trust" /></Field>
                <Field C={C} label="Amount ($)"><Input C={C} value={selected.amount ?? ''} onChange={(v) => updSel({ amount: v === '' ? null : Number(String(v).replace(/[^0-9.\-]/g, '')) })} /></Field>
                <Row gap={8}>
                  <Field C={C} label="From side"><Select C={C} value={selected.fromSide} onChange={(v) => updSel({ fromSide: v })} options={['top', 'bottom', 'left', 'right']} style={{ width: '100%' }} /></Field>
                  <Field C={C} label="To side"><Select C={C} value={selected.toSide} onChange={(v) => updSel({ toSide: v })} options={['top', 'bottom', 'left', 'right']} style={{ width: '100%' }} /></Field>
                </Row>
                <Row gap={8}>
                  <Field C={C} label="From position (0–1)"><Input C={C} value={selected.fromPos ?? 0.5} onChange={(v) => updSel({ fromPos: Math.max(0, Math.min(1, Number(v) || 0)) })} /></Field>
                  <Field C={C} label="To position (0–1)"><Input C={C} value={selected.toPos ?? 0.5} onChange={(v) => updSel({ toPos: Math.max(0, Math.min(1, Number(v) || 0)) })} /></Field>
                </Row>
                {stepField(`edge:${selected.id}`)}
                <Btn C={C} small ghost onClick={() => updSel({ labelDx: 0, labelDy: 0, mid: 0.5 })}>Reset label & elbow</Btn>
              </div>
            )}
            {selected && sel.kind === 'text' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Field C={C} label="Text"><TextArea C={C} rows={3} value={selected.text} onChange={(v) => updSel({ text: v })} /></Field>
                <Row gap={8}><Field C={C} label="Size"><Input C={C} value={selected.size} onChange={(v) => updSel({ size: Number(v) || 20 })} /></Field><Field C={C} label="Colour hex"><Input C={C} value={selected.color || ''} onChange={(v) => updSel({ color: v.replace('#', '') })} /></Field></Row>
                <Row gap={12}><Check C={C} checked={selected.bold} onChange={(v) => updSel({ bold: v })} label="Bold" /><Check C={C} checked={selected.italic} onChange={(v) => updSel({ italic: v })} label="Italic" /></Row>
                {stepField(`text:${selected.id}`)}
              </div>
            )}
            {selected && sel.kind === 'line' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Field C={C} label="Label"><Input C={C} value={selected.label} onChange={(v) => updSel({ label: v })} /></Field>
                <Field C={C} label="Vertical position"><Input C={C} value={selected.y} onChange={(v) => updSel({ y: Number(v) || selected.y })} /></Field>
                {stepField(`line:${selected.id}`)}
              </div>
            )}
          </Card>
          <Card C={C} style={{ marginTop: 10 }}>
            <Eyebrow C={C}>Legend</Eyebrow>
            {NODE_TYPES.map((t) => <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.t2, padding: '3px 0' }}><span style={{ width: 14, height: 14, background: nodeColor({ type: t.id }) }} />{t.label}</div>)}
            <div style={{ fontSize: 11.5, color: C.t4, marginTop: 8, lineHeight: 1.5 }}>Flows are numbered in the order assets move. Older spouse passes first.</div>
          </Card>
          <Card C={C} style={{ marginTop: 10 }}>
            <Eyebrow C={C}>PowerPoint animation</Eyebrow>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Check C={C} checked={anim.enabled} onChange={(v) => setAnim({ enabled: v })} label="Build the chart step by step in PowerPoint" />
              {anim.enabled && (<>
                <Field C={C} label="Trigger"><Select C={C} value={anim.mode || 'click'} onChange={(v) => setAnim({ mode: v })} options={[{ value: 'click', label: 'On click — one step per click' }, { value: 'auto', label: 'Automatic — first click starts, then timed' }]} style={{ width: '100%' }} /></Field>
                <Row gap={8}>
                  <Field C={C} label="Effect" style={{ flex: 1 }}><Select C={C} value={anim.effect || 'appear'} onChange={(v) => setAnim({ effect: v })} options={[{ value: 'appear', label: 'Appear' }, { value: 'fade', label: 'Fade in' }]} style={{ width: '100%' }} /></Field>
                  {anim.mode === 'auto' && <Field C={C} label="Delay (ms)" style={{ flex: 1 }}><Input C={C} value={anim.delayMs ?? 700} onChange={(v) => setAnim({ delayMs: Number(v.replace(/[^0-9]/g, '')) || 0 })} /></Field>}
                </Row>
                <Field C={C} label="Order"><Select C={C} value={anim.order || 'flow'} onChange={(v) => setAnim({ order: v })} options={[{ value: 'flow', label: 'By flow number (roots first, then (1), (2)…)' }, { value: 'manual', label: 'Manual — set a step on each element' }]} style={{ width: '100%' }} /></Field>
                <div style={{ fontSize: 11.5, color: C.t3, lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 700, color: C.t2, marginBottom: 4 }}>Build order ({preview.length} step{preview.length === 1 ? '' : 's'})</div>
                  {!preview.length && <div style={{ color: C.t4 }}>{anim.order === 'manual' ? 'Select an element and give it an animation step number.' : 'Add boxes and connectors to see the order.'}</div>}
                  {preview.slice(0, 30).map((st, i) => <div key={i} style={{ padding: '2px 0', borderTop: `1px solid ${C.border}` }}><span style={{ color: C.accent, fontWeight: 700 }}>{i + 1}.</span> {st.join(' + ')}</div>)}
                  {preview.length > 30 && <div style={{ color: C.t4 }}>…and {preview.length - 30} more</div>}
                </div>
                <Note C={C}>The animation is written into the .pptx file itself (Appear / Fade entrance effects on the slide's animation pane), so it plays in PowerPoint and Keynote and stays editable there. It is included in the Gap Analysis deck and in the single-slide download above.</Note>
              </>)}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
