import { useState } from 'react'
import { Card, Eyebrow, Grid, Stat, Row, Btn, Note } from '../../components/ui'
import { StackedAreas, LineChart } from '../../components/charts'
import { fmtUsd } from '../../lib/util'

const usd = (v) => (v ? Math.round(v).toLocaleString('en-US') : '–')
const primary = (m) => m.members.find((x) => x.role === 'primary') || m.members[0]

/* ───────────── Cash Flow Table: year rows, expandable column groups ───────────── */
const GROUPS = [
  { id: 'income', label: 'Income', total: (r) => r.income.total, parts: [['salary', 'Salary'], ['business', 'Business'], ['socialSecurity', 'Soc. Sec.'], ['pension', 'Pension'], ['rental', 'Rental'], ['rmd', 'RMD'], ['other', 'Other']], get: (r, k) => r.income[k] },
  { id: 'expenses', label: 'Expenses', total: (r) => r.expenses.total, parts: [['lifestyle', 'Lifestyle'], ['housing', 'Housing'], ['healthcare', 'Healthcare'], ['education', 'Education'], ['goal', 'Goals'], ['other', 'Other'], ['debtService', 'Debt'], ['insurance', 'Insurance'], ['gifting', 'Gifting']], get: (r, k) => r.expenses[k] },
  { id: 'taxes', label: 'Taxes', total: (r) => r.taxes.total, parts: [['federalIncome', 'Federal'], ['federalLtcg', 'Cap gains'], ['niit', 'NIIT'], ['state', 'State'], ['payroll', 'Payroll']], get: (r, k) => r.taxes[k] },
  { id: 'withdrawals', label: 'Withdrawals', total: (r) => r.withdrawals.total, parts: [['cash', 'Cash'], ['taxable', 'Taxable'], ['traditional', 'Trad. IRA'], ['roth', 'Roth'], ['hsa', 'HSA']], get: (r, k) => r.withdrawals[k] },
]

export function CashFlowTable({ C, model, run }) {
  const [open, setOpen] = useState({})
  const P = run.projection, p = primary(model)
  const th = { padding: '7px 8px', fontSize: 10.5, fontWeight: 800, color: C.t4, textTransform: 'uppercase', letterSpacing: 0.6, textAlign: 'right', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: C.card, borderBottom: `1px solid ${C.borderActive}` }
  const td = { padding: '6px 8px', fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
  return (
    <Card C={C}>
      <Row style={{ marginBottom: 8 }}>
        <Eyebrow C={C} style={{ marginBottom: 0 }}>Cash flow by year</Eyebrow>
        <span style={{ fontSize: 11.5, color: C.t4 }}>Click a group heading to expand its columns. Shortfall years are red.</span>
        <span style={{ flex: 1 }} />
        {GROUPS.map((g) => <Btn key={g.id} C={C} small ghost={!open[g.id]} onClick={() => setOpen({ ...open, [g.id]: !open[g.id] })}>{open[g.id] ? '▾' : '▸'} {g.label}</Btn>)}
      </Row>
      <div style={{ overflow: 'auto', maxHeight: '68dvh', border: `1px solid ${C.border}`, borderRadius: 10 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900 }}>
          <thead><tr>
            <th style={{ ...th, textAlign: 'left' }}>Year</th><th style={th}>Age</th>
            {GROUPS.map((g) => open[g.id] ? [<th key={g.id} style={{ ...th, color: C.accent }}>{g.label}</th>, ...g.parts.map(([k, l]) => <th key={g.id + k} style={{ ...th, fontWeight: 600 }}>{l}</th>)] : <th key={g.id} style={{ ...th, color: C.accent, cursor: 'pointer' }} onClick={() => setOpen({ ...open, [g.id]: true })}>{g.label} ▸</th>)}
            <th style={th}>Surplus / shortfall</th><th style={th}>Liquid assets</th><th style={th}>Net worth</th>
          </tr></thead>
          <tbody>
            {P.rows.map((r) => {
              const short = r.shortfall > 0
              return (
                <tr key={r.year} style={{ background: short ? C.dnSoft : 'transparent', color: short ? C.dn : C.t1, borderTop: `1px solid ${C.border}` }}>
                  <td style={{ ...td, textAlign: 'left', fontWeight: 800 }}>{r.year}</td><td style={td}>{p ? r.ages[p.id] ?? '—' : '—'}</td>
                  {GROUPS.map((g) => open[g.id] ? [<td key={g.id} style={{ ...td, fontWeight: 800 }}>{usd(g.total(r))}</td>, ...g.parts.map(([k]) => <td key={g.id + k} style={{ ...td, color: short ? C.dn : C.t3 }}>{usd(g.get(r, k))}</td>)] : <td key={g.id} style={td}>{usd(g.total(r))}</td>)}
                  <td style={{ ...td, fontWeight: 800 }}>{short ? `(${usd(r.shortfall)})` : usd(r.surplus)}</td><td style={td}>{usd(r.liquidAssets)}</td><td style={{ ...td, fontWeight: 800 }}>{usd(r.netWorth)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/* ───────────── Net worth ───────────── */
const LAYERS = [['cash', 'Cash', '#B8B4AC'], ['taxable', 'Taxable', '#8FA3D9'], ['traditional', 'Traditional IRA / 401(k)', '#C9A84C'], ['roth', 'Roth', '#34D399'], ['hsa', 'HSA', '#3FB6C9'], ['realEstate', 'Real estate', '#A06CD5'], ['business', 'Business', '#E8794A']]
export function NetWorthTab({ C, isDesktop, model, run }) {
  const P = run.projection, years = P.rows.map((r) => r.year), p = primary(model)
  const layers = LAYERS.map(([k, name, color]) => ({ name, color, values: P.rows.map((r) => r.balances[k] || 0) })).filter((l) => l.values.some((v) => v > 0))
  const step = Math.max(1, Math.round(P.rows.length / 10))
  return (
    <div>
      <Grid cols={isDesktop ? 3 : 1} gap={10} style={{ marginBottom: 14 }}>
        <Stat C={C} label="Net worth today" value={fmtUsd(P.rows[0]?.netWorth ?? 0, { compact: true })} />
        <Stat C={C} label="At retirement" value={fmtUsd(P.netWorthAtRetirement, { compact: true })} />
        <Stat C={C} label={`At end of plan (${P.endYear})`} value={fmtUsd(P.netWorthAtEnd, { compact: true })} />
      </Grid>
      <Card C={C} style={{ marginBottom: 14 }}><Eyebrow C={C}>Assets by account type</Eyebrow><StackedAreas C={C} years={years} layers={layers} /></Card>
      <Card C={C} style={{ marginBottom: 14 }}><Eyebrow C={C}>Net worth and liabilities</Eyebrow><LineChart C={C} years={years} series={[{ name: 'Net worth', color: C.accent, values: P.rows.map((r) => r.netWorth) }, { name: 'Liabilities', color: C.dn, values: P.rows.map((r) => r.liabilityBalance) }]} height={220} /></Card>
      <Card C={C}>
        <Eyebrow C={C}>Milestones</Eyebrow>
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead><tr style={{ color: C.t4, textAlign: 'right', fontSize: 10.5, textTransform: 'uppercase' }}><th style={{ textAlign: 'left', padding: 6 }}>Year</th><th>Age</th><th>Liquid</th><th>Real estate and business</th><th>Liabilities</th><th>Net worth</th></tr></thead>
          <tbody>{P.rows.filter((_, i) => i % step === 0 || i === P.rows.length - 1).map((r) => <tr key={r.year} style={{ borderTop: `1px solid ${C.border}`, textAlign: 'right', color: C.t1 }}><td style={{ textAlign: 'left', padding: 6, fontWeight: 800 }}>{r.year}</td><td>{p ? r.ages[p.id] ?? '—' : '—'}</td><td>{usd(r.liquidAssets)}</td><td>{usd((r.balances.realEstate || 0) + (r.balances.business || 0))}</td><td>{usd(r.liabilityBalance)}</td><td style={{ fontWeight: 800 }}>{usd(r.netWorth)}</td></tr>)}</tbody>
        </table></div>
      </Card>
    </div>
  )
}

/* ───────────── Taxes ───────────── */
export function TaxesTab({ C, isDesktop, model, run }) {
  const P = run.projection, years = P.rows.map((r) => r.year), p = primary(model)
  const irmaa = P.rows.filter((r) => r.taxes.irmaaFlag).map((r) => r.year)
  const rmdYears = P.rows.filter((r) => r.income.rmd > 0)
  const th = { padding: '7px 8px', fontSize: 10.5, fontWeight: 800, color: C.t4, textTransform: 'uppercase', textAlign: 'right', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: C.card, borderBottom: `1px solid ${C.borderActive}` }
  const td = { padding: '6px 8px', fontSize: 12, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }
  return (
    <div>
      <Grid cols={isDesktop ? 4 : 2} gap={10} style={{ marginBottom: 14 }}>
        <Stat C={C} label="Lifetime taxes" value={fmtUsd(P.lifetimeTaxes, { compact: true })} />
        <Stat C={C} label="Peak marginal bracket" value={`${Math.max(0, ...P.rows.map((r) => r.taxes.marginalRate))}%`} />
        <Stat C={C} label="RMDs begin" value={rmdYears[0] ? String(rmdYears[0].year) : 'None'} sub={rmdYears[0] ? fmtUsd(rmdYears[0].income.rmd, { compact: true }) : ''} />
        <Stat C={C} label="Years over IRMAA" value={String(irmaa.length)} color={irmaa.length ? C.warn : undefined} sub={irmaa.length ? `${irmaa[0]} to ${irmaa[irmaa.length - 1]}` : ''} />
      </Grid>
      <Card C={C} style={{ marginBottom: 14 }}><Eyebrow C={C}>Taxes by year</Eyebrow>
        <LineChart C={C} years={years} height={240} series={[{ name: 'Federal', color: '#C9A84C', values: P.rows.map((r) => r.taxes.federalIncome + r.taxes.federalLtcg) }, { name: 'State', color: '#8FA3D9', values: P.rows.map((r) => r.taxes.state) }, { name: 'Total', color: C.t1, values: P.rows.map((r) => r.taxes.total) }]} />
      </Card>
      <Card C={C}>
        <Eyebrow C={C}>Tax detail</Eyebrow>
        <Note C={C} style={{ marginBottom: 8 }}>Estimates from current-law federal brackets, standard deduction, capital-gains rates, NIIT and Social Security taxation, with an approximate state rate. Not a tax return.</Note>
        <div style={{ overflow: 'auto', maxHeight: '60dvh', border: `1px solid ${C.border}`, borderRadius: 10 }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 980 }}>
            <thead><tr><th style={{ ...th, textAlign: 'left' }}>Year</th><th style={th}>Age</th><th style={th}>AGI</th><th style={th}>Taxable income</th><th style={th}>Federal</th><th style={th}>Cap gains</th><th style={th}>NIIT</th><th style={th}>State</th><th style={th}>Payroll</th><th style={th}>Effective</th><th style={th}>Marginal</th><th style={th}>SS taxable</th><th style={th}>RMD</th><th style={th}>Roth conv.</th><th style={th}>IRMAA</th></tr></thead>
            <tbody>{P.rows.map((r) => (
              <tr key={r.year} style={{ borderTop: `1px solid ${C.border}`, color: C.t1 }}>
                <td style={{ ...td, textAlign: 'left', fontWeight: 800 }}>{r.year}</td><td style={td}>{p ? r.ages[p.id] ?? '—' : '—'}</td><td style={td}>{usd(r.taxes.agi)}</td><td style={td}>{usd(r.taxes.taxableIncome)}</td><td style={td}>{usd(r.taxes.federalIncome)}</td><td style={td}>{usd(r.taxes.federalLtcg)}</td><td style={td}>{usd(r.taxes.niit)}</td><td style={td}>{usd(r.taxes.state)}</td><td style={td}>{usd(r.taxes.payroll)}</td>
                <td style={td}>{r.taxes.effectiveRate.toFixed(1)}%</td><td style={td}>{r.taxes.marginalRate}%</td><td style={td}>{usd(r.taxes.ssTaxable)}</td><td style={td}>{usd(r.income.rmd)}</td><td style={td}>{usd(r.taxes.rothConversion)}</td><td style={{ ...td, color: r.taxes.irmaaFlag ? C.warn : C.t4, fontWeight: 800 }}>{r.taxes.irmaaFlag ? 'Yes' : ''}</td>
              </tr>))}</tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
