// Small dependency-free SVG charts in the app's navy/gold style.
import { useMemo, useState } from 'react'

export const SERIES_COLORS = ['#C9A84C', '#8FA3D9', '#34D399', '#A06CD5', '#E8794A', '#3FB6C9', '#D9558B', '#B8B4AC']
const compact = (v) => { const a = Math.abs(v); const s = a >= 1e9 ? `${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M` : a >= 1e3 ? `${Math.round(a / 1e3)}K` : String(Math.round(a)); return `${v < 0 ? '−' : ''}$${s}` }
export { compact as fmtCompact }
const niceMax = (v) => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p }

function Axes({ C, w, h, pad, ymax, ymin = 0, ticks = 4, xs, xLabel }) {
  const ys = Array.from({ length: ticks + 1 }, (_, i) => ymin + ((ymax - ymin) * i) / ticks)
  const y = (v) => pad.t + (h - pad.t - pad.b) * (1 - (v - ymin) / (ymax - ymin || 1))
  return (
    <g>
      {ys.map((v, i) => <g key={i}><line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} stroke={C.border} strokeWidth="1" /><text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10.5" fill={C.t4}>{compact(v)}</text></g>)}
      {xs.map((x) => <text key={x.label} x={x.x} y={h - pad.b + 15} textAnchor="middle" fontSize="10.5" fill={C.t4}>{x.label}</text>)}
      {xLabel && <text x={(pad.l + w - pad.r) / 2} y={h - 2} textAnchor="middle" fontSize="10" fill={C.t4}>{xLabel}</text>}
    </g>
  )
}

/** Stacked bars per year, optional line (e.g. expenses) drawn over them; `flag` years get a red marker. */
export function StackedBars({ C, rows, segments, line, flagYears = [], height = 300, onHover }) {
  const w = 900, h = height, pad = { l: 56, r: 10, t: 12, b: 28 }
  const [hover, setHover] = useState(null)
  const max = useMemo(() => niceMax(Math.max(1, ...rows.map((r) => Math.max(segments.reduce((s, g) => s + Math.max(0, r[g.key] || 0), 0), line ? r[line.key] || 0 : 0)))), [rows, segments, line])
  const bw = (w - pad.l - pad.r) / Math.max(1, rows.length)
  const y = (v) => pad.t + (h - pad.t - pad.b) * (1 - v / max)
  const step = Math.max(1, Math.ceil(rows.length / 14))
  const xs = rows.map((r, i) => ({ x: pad.l + bw * i + bw / 2, label: i % step === 0 ? String(r.year) : '' })).filter((x) => x.label)
  const linePts = line ? rows.map((r, i) => `${pad.l + bw * i + bw / 2},${y(r[line.key] || 0)}`).join(' ') : ''
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Income sources compared with expenses by year" style={{ width: '100%', height: 'auto', display: 'block' }} onMouseLeave={() => { setHover(null); onHover && onHover(null) }}>
        <Axes C={C} w={w} h={h} pad={pad} ymax={max} xs={xs} />
        {rows.map((r, i) => {
          let acc = 0
          return (
            <g key={r.year} onMouseEnter={() => { setHover(i); onHover && onHover(r) }}>
              <rect x={pad.l + bw * i} y={pad.t} width={bw} height={h - pad.t - pad.b} fill={hover === i ? C.accentSoft : 'transparent'} />
              {segments.map((g) => { const v = Math.max(0, r[g.key] || 0); const y0 = y(acc + v), y1 = y(acc); acc += v; return v > 0 ? <rect key={g.key} x={pad.l + bw * i + bw * 0.12} y={y0} width={bw * 0.76} height={Math.max(0, y1 - y0)} fill={g.color} /> : null })}
              {flagYears.includes(r.year) && <rect x={pad.l + bw * i} y={h - pad.b - 4} width={bw} height="4" fill={C.dn} />}
            </g>
          )
        })}
        {line && <polyline points={linePts} fill="none" stroke={line.color} strokeWidth="2.5" strokeLinejoin="round" />}
      </svg>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11.5, color: C.t3, marginTop: 4 }}>
        {segments.map((g) => <span key={g.key}><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: g.color, marginRight: 5 }} />{g.label}</span>)}
        {line && <span><i style={{ display: 'inline-block', width: 14, height: 3, background: line.color, marginRight: 5, verticalAlign: 'middle' }} />{line.label}</span>}
        {flagYears.length > 0 && <span><i style={{ display: 'inline-block', width: 10, height: 4, background: C.dn, marginRight: 5, verticalAlign: 'middle' }} />Shortfall year</span>}
      </div>
    </div>
  )
}

/** Lines over years. series: [{name, color, values: number[] }], years: number[] */
export function LineChart({ C, years, series, height = 280, dashed = [] }) {
  const w = 900, h = height, pad = { l: 56, r: 10, t: 12, b: 28 }
  const all = series.flatMap((s) => s.values)
  const max = niceMax(Math.max(1, ...all)), min = Math.min(0, ...all)
  const x = (i) => pad.l + ((w - pad.l - pad.r) * i) / Math.max(1, years.length - 1)
  const y = (v) => pad.t + (h - pad.t - pad.b) * (1 - (v - min) / (max - min || 1))
  const step = Math.max(1, Math.ceil(years.length / 14))
  const xs = years.map((yr, i) => ({ x: x(i), label: i % step === 0 ? String(yr) : '' })).filter((q) => q.label)
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" style={{ width: '100%', height: 'auto', display: 'block' }}>
        <Axes C={C} w={w} h={h} pad={pad} ymax={max} ymin={min} xs={xs} />
        {series.map((s, k) => <polyline key={s.name} points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')} fill="none" stroke={s.color || SERIES_COLORS[k % SERIES_COLORS.length]} strokeWidth="2.5" strokeLinejoin="round" strokeDasharray={dashed.includes(s.name) ? '6 5' : undefined} />)}
      </svg>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11.5, color: C.t3, marginTop: 4 }}>{series.map((s, k) => <span key={s.name}><i style={{ display: 'inline-block', width: 14, height: 3, background: s.color || SERIES_COLORS[k % SERIES_COLORS.length], marginRight: 5, verticalAlign: 'middle' }} />{s.name}</span>)}</div>
    </div>
  )
}

/** Stacked areas of account types over time. */
export function StackedAreas({ C, years, layers, height = 280 }) {
  const w = 900, h = height, pad = { l: 56, r: 10, t: 12, b: 28 }
  const totals = years.map((_, i) => layers.reduce((s, l) => s + Math.max(0, l.values[i] || 0), 0))
  const max = niceMax(Math.max(1, ...totals))
  const x = (i) => pad.l + ((w - pad.l - pad.r) * i) / Math.max(1, years.length - 1)
  const y = (v) => pad.t + (h - pad.t - pad.b) * (1 - v / max)
  const step = Math.max(1, Math.ceil(years.length / 14))
  const xs = years.map((yr, i) => ({ x: x(i), label: i % step === 0 ? String(yr) : '' })).filter((q) => q.label)
  const base = years.map(() => 0)
  const paths = layers.map((l) => {
    const top = years.map((_, i) => base[i] + Math.max(0, l.values[i] || 0))
    const d = `M ${years.map((_, i) => `${x(i)} ${y(top[i])}`).join(' L ')} L ${years.map((_, i) => `${x(years.length - 1 - i)} ${y(base[years.length - 1 - i])}`).join(' L ')} Z`
    top.forEach((v, i) => { base[i] = v })
    return { d, color: l.color, name: l.name }
  })
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" style={{ width: '100%', height: 'auto', display: 'block' }}>
        <Axes C={C} w={w} h={h} pad={pad} ymax={max} xs={xs} />
        {paths.map((p) => <path key={p.name} d={p.d} fill={p.color} fillOpacity="0.85" stroke={C.bg} strokeWidth="0.6" />)}
      </svg>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11.5, color: C.t3, marginTop: 4 }}>{layers.map((l) => <span key={l.name}><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: l.color, marginRight: 5 }} />{l.name}</span>)}</div>
    </div>
  )
}

/** Monte Carlo fan: p10-p90 and p25-p75 bands with the median line. */
export function BandChart({ C, bands, height = 300 }) {
  const w = 900, h = height, pad = { l: 56, r: 10, t: 12, b: 28 }
  const max = niceMax(Math.max(1, ...bands.map((b) => b.p90)))
  const x = (i) => pad.l + ((w - pad.l - pad.r) * i) / Math.max(1, bands.length - 1)
  const y = (v) => pad.t + (h - pad.t - pad.b) * (1 - v / max)
  const step = Math.max(1, Math.ceil(bands.length / 14))
  const xs = bands.map((b, i) => ({ x: x(i), label: i % step === 0 ? String(b.year) : '' })).filter((q) => q.label)
  const area = (lo, hi) => `M ${bands.map((b, i) => `${x(i)} ${y(b[hi])}`).join(' L ')} L ${bands.map((b, i) => `${x(bands.length - 1 - i)} ${y(bands[bands.length - 1 - i][lo])}`).join(' L ')} Z`
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Monte Carlo percentile bands" style={{ width: '100%', height: 'auto', display: 'block' }}>
        <Axes C={C} w={w} h={h} pad={pad} ymax={max} xs={xs} />
        <path d={area('p10', 'p90')} fill={C.accent} fillOpacity="0.16" />
        <path d={area('p25', 'p75')} fill={C.accent} fillOpacity="0.30" />
        <polyline points={bands.map((b, i) => `${x(i)},${y(b.p50)}`).join(' ')} fill="none" stroke={C.accent} strokeWidth="2.5" />
      </svg>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11.5, color: C.t3, marginTop: 4 }}>
        <span><i style={{ display: 'inline-block', width: 14, height: 3, background: C.accent, marginRight: 5, verticalAlign: 'middle' }} />Median</span>
        <span><i style={{ display: 'inline-block', width: 10, height: 10, background: C.accent, opacity: 0.3, marginRight: 5 }} />25th to 75th percentile</span>
        <span><i style={{ display: 'inline-block', width: 10, height: 10, background: C.accent, opacity: 0.16, marginRight: 5 }} />10th to 90th percentile</span>
      </div>
    </div>
  )
}
