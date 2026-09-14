// Shared UI primitives styled with the theme tokens (C). Inline styles, same idiom as the invest app.
import { useState } from 'react'

export const Card = ({ C, children, style, accent, onClick, hover }) => (
  <div onClick={onClick} style={{ background: C.card, border: `1px solid ${C.border}`, borderTop: accent ? `2px solid ${C.accent}` : undefined, borderRadius: 14, padding: '16px 18px', cursor: onClick ? 'pointer' : undefined, transition: 'border-color 0.2s', ...style }}
    onMouseEnter={hover ? (e) => { e.currentTarget.style.borderColor = C.borderHover } : undefined}
    onMouseLeave={hover ? (e) => { e.currentTarget.style.borderColor = C.border } : undefined}>
    {children}
  </div>
)
export const Eyebrow = ({ C, children, color, style }) => <div style={{ fontSize: 10, fontWeight: 700, color: color || C.accent, textTransform: 'uppercase', letterSpacing: 1.6, marginBottom: 6, ...style }}>{children}</div>
export const Title = ({ C, children, sub, isDesktop, right }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
    <div>
      <div style={{ fontSize: isDesktop ? 22 : 24, fontWeight: 800, color: C.t1 }}>{children}</div>
      {sub && <div style={{ fontSize: 12.5, color: C.t3, marginTop: 3 }}>{sub}</div>}
    </div>
    {right && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{right}</div>}
  </div>
)
export const SectionLabel = ({ C, children, style }) => <div style={{ fontSize: 11, fontWeight: 800, color: C.accent, textTransform: 'uppercase', letterSpacing: 1.2, margin: '18px 0 8px', ...style }}>{children}</div>
export const Pill = ({ C, children, color, soft, style, onClick }) => (
  <span onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: soft || (color ? color + '22' : C.accentSoft), color: color || C.accent, whiteSpace: 'nowrap', cursor: onClick ? 'pointer' : undefined, ...style }}>{children}</span>
)
export const Btn = ({ C, children, onClick, primary, danger, ghost, small, disabled, style, title, type = 'button' }) => (
  <button type={type} title={title} onClick={onClick} disabled={disabled} style={{
    padding: small ? '6px 12px' : '9px 16px', borderRadius: 10, fontSize: small ? 12 : 13, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap',
    border: `1px solid ${primary ? C.accent : danger ? C.dn + '66' : C.border}`,
    background: primary ? C.accent : danger ? C.dnSoft : ghost ? 'transparent' : C.accentSoft,
    color: primary ? '#171738' : danger ? C.dn : C.t1, ...style,
  }}>{children}</button>
)
export const Input = ({ C, value, onChange, placeholder, type = 'text', style, ...rest }) => (
  <input type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} {...rest}
    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.t1, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', ...style }} />
)
export const TextArea = ({ C, value, onChange, placeholder, rows = 3, style }) => (
  <textarea value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows}
    style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.t1, fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5, ...style }} />
)
export const Select = ({ C, value, onChange, options, style }) => (
  <select value={value ?? ''} onChange={(e) => onChange(e.target.value)} style={{ padding: '9px 10px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.t1, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', outline: 'none', appearance: 'auto', ...style }}>
    {options.map((o) => (typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
  </select>
)
export const Field = ({ C, label, children, hint, style }) => (
  <label style={{ display: 'block', ...style }}>
    <div style={{ fontSize: 11, fontWeight: 700, color: C.t3, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</div>
    {children}
    {hint && <div style={{ fontSize: 11, color: C.t4, marginTop: 4 }}>{hint}</div>}
  </label>
)
export const Toggle = ({ C, checked, onChange, label }) => (
  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.t2, cursor: 'pointer' }}>
    <span onClick={(e) => { e.preventDefault(); onChange(!checked) }} style={{ width: 36, height: 20, borderRadius: 10, background: checked ? C.accent : C.border, position: 'relative', transition: 'background 0.15s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 2, left: checked ? 18 : 2, width: 16, height: 16, borderRadius: 8, background: checked ? '#171738' : C.t1, transition: 'left 0.15s' }} />
    </span>
    {label}
  </label>
)
export const SubTabs = ({ C, value, onChange, tabs }) => (
  <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 2 }}>
    {tabs.map((t) => (
      <button key={t.id} onClick={() => onChange(t.id)} style={{ flex: '0 0 auto', padding: '8px 15px', borderRadius: 10, border: `1px solid ${value === t.id ? C.borderActive : C.border}`, background: value === t.id ? C.accentSoft : 'transparent', color: value === t.id ? C.t1 : C.t3, fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
        {t.label}{t.count != null ? ` (${t.count})` : ''}
      </button>
    ))}
  </div>
)
export const Empty = ({ C, icon = '◇', title, children, action }) => (
  <div style={{ textAlign: 'center', padding: '48px 20px', color: C.t4 }}>
    <div style={{ fontSize: 36, marginBottom: 12, color: C.accent }}>{icon}</div>
    <div style={{ fontSize: 15, fontWeight: 700, color: C.t3, marginBottom: 6 }}>{title}</div>
    <div style={{ fontSize: 12.5, maxWidth: 440, margin: '0 auto', lineHeight: 1.6 }}>{children}</div>
    {action && <div style={{ marginTop: 16 }}>{action}</div>}
  </div>
)
export const Spinner = ({ C, label }) => (
  <div style={{ textAlign: 'center', padding: 32 }}>
    <div style={{ width: 26, height: 26, border: `3px solid ${C.border}`, borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 10px' }} />
    {label && <div style={{ fontSize: 12.5, color: C.t4 }}>{label}</div>}
  </div>
)
export const Stat = ({ C, label, value, color, sub }) => (
  <div style={{ padding: '12px 14px', borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, minWidth: 120 }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 800, color: color || C.t1, fontVariantNumeric: 'tabular-nums', marginTop: 3 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: C.t3, marginTop: 2 }}>{sub}</div>}
  </div>
)
export const Row = ({ children, gap = 10, style, wrap = true, align = 'center' }) => <div style={{ display: 'flex', gap, flexWrap: wrap ? 'wrap' : 'nowrap', alignItems: align, ...style }}>{children}</div>
export const Grid = ({ children, cols = 2, gap = 12, style }) => <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap, ...style }}>{children}</div>
export const Note = ({ C, children, tone = 'info', style }) => {
  const col = tone === 'warn' ? C.warn : tone === 'danger' ? C.dn : tone === 'success' ? C.up : C.accent
  return <div style={{ padding: '10px 14px', borderRadius: 10, background: col + '14', border: `1px solid ${col}44`, fontSize: 12.5, color: C.t2, lineHeight: 1.5, ...style }}>{children}</div>
}
export function Confirm({ C, label, onConfirm, small = true, danger = true, children }) {
  const [arm, setArm] = useState(false)
  if (!arm) return <Btn C={C} small={small} ghost onClick={() => setArm(true)}>{children || label}</Btn>
  return (
    <span style={{ display: 'inline-flex', gap: 6 }}>
      <Btn C={C} small={small} danger={danger} onClick={() => { setArm(false); onConfirm() }}>Confirm</Btn>
      <Btn C={C} small={small} ghost onClick={() => setArm(false)}>Cancel</Btn>
    </span>
  )
}
export const Check = ({ C, checked, onChange, label }) => (
  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.t2, cursor: 'pointer' }}>
    <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: C.accent, width: 15, height: 15 }} />{label}
  </label>
)
