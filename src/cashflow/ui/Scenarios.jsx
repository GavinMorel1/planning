// Base Facts plus unlimited what-if scenarios, with Decision Center-style sliders that re-run the projection live and a
// side-by-side comparison. A scenario is a list of overrides on top of the base facts (see ScenarioOverrides in ../types.ts).
import { useMemo, useState } from 'react'
import { Card, Eyebrow, Grid, Row, Btn, Field, Input, Select, Note, Stat, Pill, Confirm } from '../../components/ui'
import { LineChart } from '../../components/charts'
import { fmtUsd } from '../../lib/util'
import { newScenario } from '../types'
import { compareRuns } from '../run'
import { usePlan } from './useResults'

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
function Slider({ C, label, value, min, max, step = 1, onChange, fmt = (v) => v, base, disabled }) {
  const changed = base !== undefined && value !== base
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.t3, marginBottom: 2 }}><span>{label}</span><b style={{ color: changed ? C.accent : C.t1 }}>{fmt(value)}{changed ? <span style={{ color: C.t4, fontWeight: 500 }}> (base {fmt(base)})</span> : null}</b></div>
      <input type="range" aria-label={label} disabled={disabled} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: '100%', accentColor: C.accent }} />
    </div>
  )
}

export default function Scenarios({ C, isDesktop, model, save, baseRun, baseMc, settings }) {
  const [sel, setSel] = useState('base')
  const [cmp, setCmp] = useState('')
  const [draft, setDraft] = useState({}) // unsaved overrides while Base Facts is selected
  const scenarios = model.scenarios
  const current = sel === 'base' ? null : scenarios.find((s) => s.id === sel) || null
  const overrides = current ? current.overrides : draft
  const scenario = useMemo(() => ({ overrides }), [overrides])
  const live = usePlan(model, settings, Object.keys(overrides).length ? scenario : null, { auto: false })
  const otherSc = cmp && cmp !== 'base' ? scenarios.find((s) => s.id === cmp) : null
  const other = usePlan(model, settings, otherSc ? { overrides: otherSc.overrides } : null, { auto: false })
  const run = live.run || baseRun, runB = cmp ? (cmp === 'base' ? baseRun : other.run) : null

  const setOv = (patch) => {
    const next = { ...overrides, ...patch }
    Object.keys(next).forEach((k) => next[k] === undefined && delete next[k])
    if (current) save((m) => ({ ...m, scenarios: m.scenarios.map((s) => (s.id === current.id ? { ...s, overrides: next } : s)) }), { source: 'manual', note: `Scenario “${current.name}” changed` })
    else setDraft(next)
  }
  const addScenario = (name, ov = {}) => { const s = { ...newScenario(name), overrides: ov }; save((m) => ({ ...m, scenarios: [...m.scenarios, s] }), { source: 'manual', note: `Added scenario “${name}”` }, { immediate: true }); setSel(s.id); setDraft({}) }
  const business = model.accounts.find((a) => a.type === 'business')
  const baseYear = model.assumptions.baseYear
  const PRESETS = [
    ['Retire 3 years earlier', () => ({ retirementAge: Object.fromEntries(model.members.map((m) => [m.id, Math.max(45, m.retirementAge - 3)])) })],
    ['Spend 15% more', () => ({ spendingMultiplier: 1.15 })],
    ['Roth conversions $100K × 5 yrs', () => ({ rothConversions: Array.from({ length: 5 }, (_, i) => ({ year: baseYear + 1 + i, amount: 100000 })) })],
    ['Gift $50K a year', () => ({ giftingAnnual: 50000 })],
    ...(business ? [[`Sell ${business.name || 'the business'}`, () => ({ sellBusiness: { accountId: business.id, year: baseYear + 3 } })]] : []),
  ]
  const retAge = (m) => overrides.retirementAge?.[m.id] ?? m.retirementAge
  const claimAge = (m) => overrides.ssClaimAge?.[m.id] ?? m.ssClaimAge
  const rothYears = overrides.rothConversions || []
  const P = run.projection

  return (
    <div>
      <Grid cols={isDesktop ? '240px 1fr' : 1} gap={14} style={isDesktop ? { gridTemplateColumns: '240px minmax(0, 1fr)' } : undefined}>
        <Card C={C} style={{ alignSelf: 'start' }}>
          <Eyebrow C={C}>Plans</Eyebrow>
          {[{ id: 'base', name: 'Base Facts', sub: 'Inputs as entered' }, ...scenarios.map((s) => ({ id: s.id, name: s.name, sub: `${Object.keys(s.overrides).length} change${Object.keys(s.overrides).length === 1 ? '' : 's'}` }))].map((p) => (
            <button key={p.id} onClick={() => { setSel(p.id); setDraft({}) }} aria-pressed={sel === p.id} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', marginBottom: 4, borderRadius: 10, border: `1px solid ${sel === p.id ? C.accent : C.border}`, background: sel === p.id ? C.accentSoft : 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.t1 }}>{p.name}</div><div style={{ fontSize: 11, color: C.t4 }}>{p.sub}</div>
            </button>
          ))}
          <Btn C={C} small style={{ marginTop: 6 }} onClick={() => addScenario(`Scenario ${scenarios.length + 1}`)}>+ New scenario</Btn>
          <div style={{ fontSize: 10, fontWeight: 800, color: C.t4, textTransform: 'uppercase', letterSpacing: 1, margin: '14px 0 6px' }}>Quick start</div>
          {PRESETS.map(([name, mk]) => <Btn key={name} C={C} small ghost style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 4 }} onClick={() => addScenario(name, mk())}>{name}</Btn>)}
        </Card>

        <div>
          <Card C={C} style={{ marginBottom: 14 }}>
            <Row style={{ marginBottom: 8 }}>
              {current ? <Input C={C} value={current.name} onChange={(v) => save((m) => ({ ...m, scenarios: m.scenarios.map((s) => (s.id === current.id ? { ...s, name: v } : s)) }), { source: 'manual', note: 'Renamed scenario' })} style={{ fontWeight: 800, maxWidth: 280 }} aria-label="Scenario name" /> : <Eyebrow C={C} style={{ marginBottom: 0 }}>Decision Center · Base Facts</Eyebrow>}
              <span style={{ flex: 1 }} />
              {!current && Object.keys(draft).length > 0 && <><Pill C={C} color={C.warn}>Unsaved</Pill><Btn C={C} small primary onClick={() => addScenario('What-if', draft)}>Save as scenario</Btn><Btn C={C} small ghost onClick={() => setDraft({})}>Reset</Btn></>}
              {current && <><Btn C={C} small ghost onClick={() => addScenario(`${current.name} (copy)`, JSON.parse(JSON.stringify(current.overrides)))}>Duplicate</Btn><Confirm C={C} onConfirm={() => { save((m) => ({ ...m, scenarios: m.scenarios.filter((s) => s.id !== current.id) }), { source: 'manual', note: `Deleted scenario “${current.name}”` }, { immediate: true }); setSel('base') }}>Delete</Confirm></>}
            </Row>
            <Grid cols={isDesktop ? 2 : 1} gap={20}>
              <div>
                {model.members.filter((m) => m.role !== 'dependent').map((m) => <Slider key={`r${m.id}`} C={C} label={`${m.name || 'Member'} retires at`} value={retAge(m)} min={45} max={80} base={m.retirementAge} onChange={(v) => setOv({ retirementAge: { ...(overrides.retirementAge || {}), [m.id]: v } })} fmt={(v) => `age ${v}`} />)}
                {model.members.filter((m) => m.role !== 'dependent' && m.ssPiaMonthly > 0).map((m) => <Slider key={`s${m.id}`} C={C} label={`${m.name || 'Member'} claims Social Security at`} value={claimAge(m)} min={62} max={70} base={m.ssClaimAge} onChange={(v) => setOv({ ssClaimAge: { ...(overrides.ssClaimAge || {}), [m.id]: v } })} fmt={(v) => `age ${v}`} />)}
                <Slider C={C} label="Lifestyle spending" value={Math.round((overrides.spendingMultiplier ?? 1) * 100)} min={50} max={150} base={100} onChange={(v) => setOv({ spendingMultiplier: v === 100 ? undefined : v / 100 })} fmt={(v) => `${v}%`} />
              </div>
              <div>
                <Slider C={C} label="Investment return" value={overrides.returnPct ?? model.assumptions.returnPct} min={0} max={12} step={0.25} base={model.assumptions.returnPct} onChange={(v) => setOv({ returnPct: v === model.assumptions.returnPct ? undefined : v })} fmt={(v) => `${v}%`} />
                <Slider C={C} label="Inflation" value={overrides.inflationPct ?? model.assumptions.inflationPct} min={0} max={8} step={0.25} base={model.assumptions.inflationPct} onChange={(v) => setOv({ inflationPct: v === model.assumptions.inflationPct ? undefined : v })} fmt={(v) => `${v}%`} />
                <Slider C={C} label="Annual gifting" value={overrides.giftingAnnual ?? model.assumptions.giftingAnnual} min={0} max={250000} step={5000} base={model.assumptions.giftingAnnual} onChange={(v) => setOv({ giftingAnnual: v === model.assumptions.giftingAnnual ? undefined : v })} fmt={(v) => fmtUsd(v)} />
                <div style={{ fontSize: 12, color: C.t3, marginBottom: 4 }}>Roth conversions</div>
                <Row gap={8} style={{ marginBottom: 8 }}>
                  <Field C={C} label="Per year $"><Input C={C} value={rothYears[0]?.amount ?? ''} onChange={(v) => { const amt = Number(String(v).replace(/[$,]/g, '')) || 0; const n = rothYears.length || 5; setOv({ rothConversions: amt ? Array.from({ length: n }, (_, i) => ({ year: rothYears[0]?.year ? rothYears[0].year + i : baseYear + 1 + i, amount: amt })) : undefined }) }} style={{ width: 110 }} /></Field>
                  <Field C={C} label="First year"><Input C={C} value={rothYears[0]?.year ?? ''} onChange={(v) => { const y0 = Number(v) || 0; const amt = rothYears[0]?.amount || 0; const n = rothYears.length || 5; if (y0 && amt) setOv({ rothConversions: Array.from({ length: n }, (_, i) => ({ year: y0 + i, amount: amt })) }) }} style={{ width: 80 }} /></Field>
                  <Field C={C} label="Years"><Input C={C} value={rothYears.length || ''} onChange={(v) => { const n = clamp(Number(v) || 0, 0, 30); const amt = rothYears[0]?.amount || 0; setOv({ rothConversions: n && amt ? Array.from({ length: n }, (_, i) => ({ year: (rothYears[0]?.year || baseYear + 1) + i, amount: amt })) : undefined }) }} style={{ width: 60 }} /></Field>
                </Row>
                {business && (
                  <Row gap={8}>
                    <Field C={C} label={`Sell ${business.name || 'business'} in`}><Input C={C} value={overrides.sellBusiness?.year ?? ''} placeholder="year" onChange={(v) => { const y = Number(v) || 0; setOv({ sellBusiness: y ? { accountId: business.id, year: y, price: overrides.sellBusiness?.price } : undefined }) }} style={{ width: 90 }} /></Field>
                    <Field C={C} label="Price $ (optional)"><Input C={C} value={overrides.sellBusiness?.price ?? ''} onChange={(v) => { const p = Number(String(v).replace(/[$,]/g, '')) || undefined; if (overrides.sellBusiness) setOv({ sellBusiness: { ...overrides.sellBusiness, price: p } }) }} style={{ width: 130 }} /></Field>
                  </Row>
                )}
              </div>
            </Grid>
          </Card>

          <Grid cols={isDesktop ? 4 : 2} gap={10} style={{ marginBottom: 14 }}>
            <Stat C={C} label="Net worth at retirement" value={fmtUsd(P.netWorthAtRetirement, { compact: true })} sub={run !== baseRun ? `base ${fmtUsd(baseRun.projection.netWorthAtRetirement, { compact: true })}` : ''} />
            <Stat C={C} label="Net worth at end of plan" value={fmtUsd(P.netWorthAtEnd, { compact: true })} sub={run !== baseRun ? `base ${fmtUsd(baseRun.projection.netWorthAtEnd, { compact: true })}` : ''} />
            <Stat C={C} label="Lifetime taxes" value={fmtUsd(P.lifetimeTaxes, { compact: true })} sub={run !== baseRun ? `base ${fmtUsd(baseRun.projection.lifetimeTaxes, { compact: true })}` : ''} />
            <Stat C={C} label="Funded through" value={P.depletionYear ? `Short ${P.depletionYear}` : String(P.endYear)} color={P.depletionYear ? C.dn : C.up} />
          </Grid>
          <Card C={C} style={{ marginBottom: 14 }}>
            <Eyebrow C={C}>Net worth by year, live</Eyebrow>
            <LineChart C={C} years={P.rows.map((r) => r.year)} height={240} series={[...(run !== baseRun ? [{ name: 'Base Facts', color: '#8FA3D9', values: baseRun.projection.rows.map((r) => r.netWorth) }] : []), { name: current ? current.name : run !== baseRun ? 'Unsaved what-if' : 'Base Facts', color: C.accent, values: P.rows.map((r) => r.netWorth) }, ...(runB ? [{ name: cmp === 'base' ? 'Base Facts' : otherSc?.name || 'Compare', color: '#34D399', values: runB.projection.rows.map((r) => r.netWorth) }] : [])]} />
          </Card>

          <Card C={C}>
            <Row style={{ marginBottom: 8 }}>
              <Eyebrow C={C} style={{ marginBottom: 0 }}>Compare side by side</Eyebrow>
              <Select C={C} value={cmp} onChange={setCmp} options={[{ value: '', label: 'Compare with…' }, ...(sel !== 'base' ? [{ value: 'base', label: 'Base Facts' }] : []), ...scenarios.filter((s) => s.id !== sel).map((s) => ({ value: s.id, label: s.name }))]} style={{ padding: '6px 8px', fontSize: 12 }} />
              <span style={{ flex: 1 }} />
              <Btn C={C} small disabled={!runB && !live.run} onClick={() => { live.runMc(); if (cmp && cmp !== 'base') other.runMc() }}>{live.mcBusy || other.mcBusy ? 'Running…' : 'Run Monte Carlo for both'}</Btn>
            </Row>
            {!runB ? <Note C={C}>Pick a second plan to see the two side by side. Each column is a full re-run of the projection.</Note> : (
              <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead><tr style={{ color: C.t4, fontSize: 10.5, textTransform: 'uppercase', textAlign: 'right' }}><th style={{ textAlign: 'left', padding: 6 }}>Measure</th><th>{current ? current.name : sel === 'base' ? 'Base Facts' : 'Selected'}</th><th>{cmp === 'base' ? 'Base Facts' : otherSc?.name}</th></tr></thead>
                <tbody>{compareRuns({ projection: runB.projection }, { projection: run.projection }, cmp === 'base' ? baseMc : other.mc, live.mc).map((m) => <tr key={m.label} style={{ borderTop: `1px solid ${C.border}`, textAlign: 'right', color: C.t1 }}><td style={{ textAlign: 'left', padding: 6, fontWeight: 700 }}>{m.label}</td><td style={{ fontWeight: 800, color: m.better === true ? C.up : m.better === false ? C.dn : C.t1 }}>{m.after}</td><td>{m.before}</td></tr>)}</tbody>
              </table></div>
            )}
          </Card>
        </div>
      </Grid>
    </div>
  )
}
