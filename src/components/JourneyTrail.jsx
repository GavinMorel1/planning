// "Where you are in the Journey": an animated winding trail with one node per stage. The marker slides along the path to the
// current stage; when the family advances, it moves with a short confetti burst and the next milestone lights up gold.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

const W = 1000, H = 200, X0 = 56, DX = 88
const nodeXY = (i) => ({ x: X0 + i * DX, y: i % 2 === 0 ? 62 : 138 })
const pad2 = (n) => String(n + 1).padStart(2, '0')
const wrap = (s) => { const w = String(s).split(' '); const out = []; let cur = ''; for (const x of w) { if ((cur + ' ' + x).trim().length > 13 && cur) { out.push(cur); cur = x } else cur = (cur + ' ' + x).trim() } if (cur) out.push(cur); return out.slice(0, 3) }

function Confetti({ C, burst }) {
  const parts = useMemo(() => Array.from({ length: 56 }, (_, i) => ({ i, x: Math.random() * 100, d: Math.random() * 0.35, t: 1.1 + Math.random() * 0.9, r: Math.random() * 720 - 360, dx: Math.random() * 120 - 60, s: 6 + Math.random() * 6, c: [C.accent, '#FAF7F2', '#34D399', '#8FA3D9', '#F87171'][i % 5] })), [burst, C])
  if (!burst) return null
  return (
    <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 5 }}>
      {parts.map((p) => <span key={p.i} style={{ position: 'absolute', top: -10, left: `${p.x}%`, width: p.s, height: p.s * 0.6, background: p.c, borderRadius: 1, animation: `jt-fall ${p.t}s ease-in ${p.d}s forwards`, '--dx': `${p.dx}px`, '--rot': `${p.r}deg`, opacity: 0 }} />)}
    </div>
  )
}

export default function JourneyTrail({ C, journey, isDesktop, familyName, burstKey }) {
  const { stages, currentIndex, complete } = journey
  const pathRef = useRef(null)
  const [geo, setGeo] = useState(null) // { total, lens: number[] }
  const [pos, setPos] = useState(null)
  const fromRef = useRef(null)
  const d = useMemo(() => {
    let s = `M ${nodeXY(0).x} ${nodeXY(0).y}`
    for (let i = 1; i < stages.length; i++) { const a = nodeXY(i - 1), b = nodeXY(i); s += ` C ${a.x + DX / 2} ${a.y}, ${b.x - DX / 2} ${b.y}, ${b.x} ${b.y}` }
    return s
  }, [stages.length])

  useLayoutEffect(() => {
    const el = pathRef.current
    if (!el || !isDesktop) return
    const total = el.getTotalLength()
    const lens = stages.map((_, i) => { const t = nodeXY(i); let best = 0, bd = Infinity; for (let l = 0; l <= total; l += 2) { const p = el.getPointAtLength(l); const dd = (p.x - t.x) ** 2 + (p.y - t.y) ** 2; if (dd < bd) { bd = dd; best = l } } return best })
    setGeo({ total, lens })
  }, [d, isDesktop, stages.length])

  const targetLen = geo ? geo.lens[Math.min(currentIndex, stages.length - 1)] : 0
  useEffect(() => {
    const el = pathRef.current
    if (!geo || !el) return undefined
    const from = fromRef.current == null ? targetLen : fromRef.current
    const t0 = performance.now(), dur = from === targetLen ? 0 : 1300
    let raf
    const step = (now) => {
      const k = dur ? Math.min(1, (now - t0) / dur) : 1
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      const p = el.getPointAtLength(from + (targetLen - from) * e)
      setPos({ x: p.x, y: p.y })
      if (k < 1) raf = requestAnimationFrame(step); else fromRef.current = targetLen
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [geo, targetLen])

  const css = `
    @keyframes jt-fall { 0% { transform: translate(0,0) rotate(0); opacity: 1 } 100% { transform: translate(var(--dx), 260px) rotate(var(--rot)); opacity: 0 } }
    @keyframes jt-pulse { 0% { r: 17; opacity: .55 } 100% { r: 30; opacity: 0 } }
    @keyframes jt-dash { to { stroke-dashoffset: -24 } }
    @keyframes jt-rot { to { transform: rotate(360deg) } }
    .jt-spin { animation: jt-rot 9s linear infinite; transform-box: fill-box; transform-origin: center }
    .jt-ants { animation: jt-dash 1.6s linear infinite }
    .jt-pulse { animation: jt-pulse 1.8s ease-out infinite }
    @media (prefers-reduced-motion: reduce) { .jt-ants, .jt-pulse, .jt-spin { animation: none } }
  `
  const doneLen = geo ? (complete ? geo.total : targetLen) : 0

  if (!isDesktop) {
    return (
      <div style={{ position: 'relative' }}>
        <style>{css}</style>
        <Confetti C={C} burst={burstKey} />
        {stages.map((s, i) => {
          const done = s.status === 'done', cur = s.status === 'current'
          return (
            <div key={s.def.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0', position: 'relative' }}>
              <div style={{ width: 28, height: 28, borderRadius: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, background: cur ? C.accent : done ? C.upSoft : 'transparent', color: cur ? '#171738' : done ? C.up : C.t4, border: `2px solid ${cur ? C.accent : done ? C.up : C.border}`, boxShadow: cur ? `0 0 12px ${C.accentGlow}` : 'none' }}>{done ? '✓' : pad2(i)}</div>
              <div style={{ fontSize: 13.5, fontWeight: cur ? 800 : 600, color: cur ? C.accent : done ? C.t2 : C.t4 }}>{s.def.name}{cur && <span style={{ marginLeft: 8, fontSize: 11, color: C.t3 }}>{s.taskTotal ? `${s.taskDone}/${s.taskTotal} tasks` : 'you are here'}</span>}</div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ position: 'relative' }}>
      <style>{css}</style>
      <Confetti C={C} burst={burstKey} />
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Journey for ${familyName}: stage ${Math.min(currentIndex + 1, stages.length)} of ${stages.length}, ${stages[Math.min(currentIndex, stages.length - 1)].def.name}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <defs><filter id="jt-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
        <path ref={pathRef} d={d} fill="none" stroke={C.border} strokeWidth="5" strokeLinecap="round" />
        <path d={d} fill="none" stroke={C.t4} strokeOpacity=".55" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 10" className="jt-ants" />
        {geo && <path d={d} fill="none" stroke={C.accent} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${doneLen} ${geo.total + 20}`} style={{ transition: 'stroke-dasharray 1.3s ease-in-out' }} />}
        {stages.map((s, i) => {
          const { x, y } = nodeXY(i), done = s.status === 'done', cur = s.status === 'current'
          const above = i % 2 === 0
          const lines = wrap(s.def.name)
          return (
            <g key={s.def.id}>
              {cur && <circle cx={x} cy={y} r="17" fill={C.accent} className="jt-pulse" />}
              <circle cx={x} cy={y} r="16" fill={cur ? C.accent : done ? C.bg : C.surface} stroke={cur ? C.accent : done ? C.up : C.border} strokeWidth="2.5" filter={cur ? 'url(#jt-glow)' : undefined} />
              <text x={x} y={y + 4.5} textAnchor="middle" fontSize="12" fontWeight="800" fill={cur ? '#171738' : done ? C.up : C.t4} fontFamily="inherit">{done ? '✓' : pad2(i)}</text>
              <text textAnchor="middle" fontSize="12" fontWeight={cur ? 800 : 600} fill={cur ? C.accent : done ? C.t2 : C.t4} fontFamily="inherit">
                {lines.map((ln, k) => <tspan key={k} x={x} y={above ? y - 26 - (lines.length - 1 - k) * 13 : y + 33 + k * 13}>{ln}</tspan>)}
              </text>
            </g>
          )
        })}
        {pos && !complete && (
          <g transform={`translate(${pos.x}, ${pos.y})`} style={{ pointerEvents: 'none' }}>
            <circle r="24" fill="none" stroke={C.accent} strokeWidth="2.5" strokeDasharray="7 6" className="jt-spin" />
            <circle r="3.5" cy="-24" fill={C.accent} />
          </g>
        )}
      </svg>
    </div>
  )
}
