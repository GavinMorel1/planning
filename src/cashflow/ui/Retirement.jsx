import { useMemo } from 'react'
import { Card, Eyebrow, Grid, Stat, Row, Btn, Note, Field, Input } from '../../components/ui'
import { BandChart, LineChart } from '../../components/charts'
import { fmtUsd } from '../../lib/util'
import { runPlan } from '../run'
import { claimingTable } from '../engine'

const primary = (m) => m.members.find((x) => x.role === 'primary') || m.members[0]

export function RetirementTab({ C, isDesktop, model, run, cfg, save }) {
  const P = run.projection
  const retire = Object.values(P.retirementYear)[0]
  const first = P.rows.find((r) => r.year >= (retire ?? 0)) || P.rows[0]
  // What retiring a few years earlier or later does (projection only, no randomness).
  const options = useMemo(() => [-3, -2, -1, 0, 1, 2, 3].map((d) => {
    const overrides = { retirementAge: Object.fromEntries(model.members.map((m) => [m.id, Math.max(45, Math.min(80, m.retirementAge + d))])) }
    const r = runPlan(model, cfg, { overrides }).projection
    return { d, age: primary(model) ? Math.max(45, Math.min(80, primary(model).retirementAge + d)) : 0, end: r.netWorthAtEnd, short: r.depletionYear, retireNw: r.netWorthAtRetirement }
  }), [model, cfg])
  const setMember = (id, patch) => save((m) => ({ ...m, members: m.members.map((x) => (x.id === id ? { ...x, ...patch } : x)) }), { source: 'manual', note: 'Edited retirement / Social Security' })
  return (
    <div>
      <Grid cols={isDesktop ? 4 : 2} gap={10} style={{ marginBottom: 14 }}>
        <Stat C={C} label="Retirement year" value={retire ? String(retire) : '—'} />
        <Stat C={C} label="Spending + taxes in year 1" value={first ? fmtUsd(first.expenses.total + first.taxes.total, { compact: true }) : '—'} />
        <Stat C={C} label="Guaranteed income in year 1" value={first ? fmtUsd(first.income.socialSecurity + first.income.pension, { compact: true }) : '—'} sub="Social Security and pension" />
        <Stat C={C} label="Funded through" value={P.depletionYear ? `Short in ${P.depletionYear}` : String(P.endYear)} color={P.depletionYear ? C.dn : C.up} />
      </Grid>
      <Card C={C} style={{ marginBottom: 14 }}>
        <Eyebrow C={C}>When to retire</Eyebrow>
        <div style={{ fontSize: 11.5, color: C.t4, marginBottom: 8 }}>The same plan with everyone retiring earlier or later. The row in gold is the current plan.</div>
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead><tr style={{ color: C.t4, textAlign: 'right', fontSize: 10.5, textTransform: 'uppercase' }}><th style={{ textAlign: 'left', padding: 6 }}>Change</th><th>{primary(model)?.name || 'Primary'} retires at</th><th>Net worth at retirement</th><th>Net worth at end</th><th>First shortfall</th></tr></thead>
          <tbody>{options.map((o) => <tr key={o.d} style={{ borderTop: `1px solid ${C.border}`, textAlign: 'right', color: o.short ? C.dn : C.t1, background: o.d === 0 ? C.accentSoft : 'transparent' }}><td style={{ textAlign: 'left', padding: 6, fontWeight: 800 }}>{o.d === 0 ? 'Current plan' : `${o.d > 0 ? '+' : ''}${o.d} yr`}</td><td>{o.age}</td><td>{fmtUsd(o.retireNw, { compact: true })}</td><td>{fmtUsd(o.end, { compact: true })}</td><td>{o.short || 'None'}</td></tr>)}</tbody>
        </table></div>
      </Card>
      <Card C={C}>
        <Eyebrow C={C}>Social Security claiming age</Eyebrow>
        <Note C={C} style={{ marginBottom: 10 }}>Annual benefit in today's dollars at each claiming age, from the monthly benefit at full retirement age entered under Inputs › Household.</Note>
        {model.members.filter((m) => m.role !== 'dependent').map((m) => {
          const table = m.ssPiaMonthly > 0 ? claimingTable(m) : []
          return (
            <div key={m.id} style={{ padding: '10px 0', borderTop: `1px solid ${C.border}` }}>
              <Row gap={10} style={{ marginBottom: 6 }}>
                <b style={{ color: C.t1, minWidth: 120 }}>{m.name || 'Member'}</b>
                <Field C={C} label="Benefit / mo at full retirement age"><Input C={C} value={m.ssPiaMonthly || ''} onChange={(v) => setMember(m.id, { ssPiaMonthly: Number(String(v).replace(/[$,]/g, '')) || 0 })} style={{ width: 150 }} /></Field>
                <Field C={C} label="Claims at"><Input C={C} value={m.ssClaimAge} onChange={(v) => setMember(m.id, { ssClaimAge: Math.max(62, Math.min(70, Number(v) || 67)) })} style={{ width: 70 }} /></Field>
              </Row>
              {!table.length ? <div style={{ fontSize: 12, color: C.t4 }}>No Social Security benefit entered.</div> : (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {table.map((t) => (
                    <div key={t.age} onClick={() => setMember(m.id, { ssClaimAge: t.age })} style={{ cursor: 'pointer', minWidth: 74, padding: '8px 10px', borderRadius: 10, textAlign: 'center', background: t.age === m.ssClaimAge ? C.accentSoft : C.surface, border: `1px solid ${t.age === m.ssClaimAge ? C.accent : C.border}` }}>
                      <div style={{ fontSize: 10.5, color: C.t4 }}>Age {t.age}</div><div style={{ fontSize: 13.5, fontWeight: 800, color: C.t1 }}>{fmtUsd(t.annual ?? t.annualBenefit ?? 0, { compact: true })}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </Card>
    </div>
  )
}

export function MonteCarloTab({ C, isDesktop, model, run, mc, mcBusy, runMc, mcOpts, setMcOpts }) {
  const set = (k, v) => setMcOpts({ ...mcOpts, [k]: v })
  const a = model.assumptions
  const step = mc ? Math.max(1, Math.round(mc.bands.length / 10)) : 1
  return (
    <div>
      <Card C={C} style={{ marginBottom: 14 }}>
        <Eyebrow C={C}>Simulation settings</Eyebrow>
        <Grid cols={isDesktop ? 4 : 2} gap={10}>
          <Field C={C} label="Simulations"><Input C={C} value={mcOpts.runs ?? 1000} onChange={(v) => set('runs', Math.max(100, Math.min(10000, Number(v) || 1000)))} /></Field>
          <Field C={C} label="Mean return %" hint={`Blank = ${a.returnPct}% from assumptions`}><Input C={C} value={mcOpts.meanReturnPct ?? ''} onChange={(v) => set('meanReturnPct', v === '' ? undefined : Number(v))} /></Field>
          <Field C={C} label="Standard deviation %" hint={`Blank = ${a.stdDevPct}%`}><Input C={C} value={mcOpts.stdDevPct ?? ''} onChange={(v) => set('stdDevPct', v === '' ? undefined : Number(v))} /></Field>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}><Btn C={C} primary disabled={mcBusy} onClick={() => runMc(mcOpts)}>{mcBusy ? 'Running…' : 'Run simulation'}</Btn></div>
        </Grid>
      </Card>
      {!mc ? <Note C={C}>{mcBusy ? 'Running the simulation…' : 'Press Run simulation.'}</Note> : (
        <>
          <Grid cols={isDesktop ? 4 : 2} gap={10} style={{ marginBottom: 14 }}>
            <Stat C={C} label="Probability of success" value={`${Math.round(mc.successProbability * 100)}%`} color={mc.successProbability >= 0.85 ? C.up : mc.successProbability >= 0.7 ? C.warn : C.dn} sub={`${mc.runs.toLocaleString()} simulations`} />
            <Stat C={C} label="Median ending assets" value={fmtUsd(mc.medianEndingLiquid, { compact: true })} />
            <Stat C={C} label="Poor markets (10th pct)" value={fmtUsd(mc.p10EndingLiquid, { compact: true })} />
            <Stat C={C} label="Typical failure year" value={mc.failureYearMedian ? String(mc.failureYearMedian) : 'None'} />
          </Grid>
          <Card C={C} style={{ marginBottom: 14 }}><Eyebrow C={C}>Liquid assets: percentile bands</Eyebrow><BandChart C={C} bands={mc.bands} /></Card>
          <Card C={C}>
            <Eyebrow C={C}>Percentiles by year</Eyebrow>
            <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead><tr style={{ color: C.t4, textAlign: 'right', fontSize: 10.5, textTransform: 'uppercase' }}><th style={{ textAlign: 'left', padding: 6 }}>Year</th><th>10th</th><th>25th</th><th>Median</th><th>75th</th><th>90th</th></tr></thead>
              <tbody>{mc.bands.filter((_, i) => i % step === 0 || i === mc.bands.length - 1).map((b) => <tr key={b.year} style={{ borderTop: `1px solid ${C.border}`, textAlign: 'right', color: C.t1 }}><td style={{ textAlign: 'left', padding: 6, fontWeight: 800 }}>{b.year}</td><td>{fmtUsd(b.p10, { compact: true })}</td><td>{fmtUsd(b.p25, { compact: true })}</td><td style={{ fontWeight: 800 }}>{fmtUsd(b.p50, { compact: true })}</td><td>{fmtUsd(b.p75, { compact: true })}</td><td>{fmtUsd(b.p90, { compact: true })}</td></tr>)}</tbody>
            </table></div>
          </Card>
        </>
      )}
    </div>
  )
}
