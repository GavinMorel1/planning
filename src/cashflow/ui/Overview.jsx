import { Card, Eyebrow, Grid, Stat, Row, Btn, Note, Field, Input, Empty } from '../../components/ui'
import { StackedBars } from '../../components/charts'
import { fmtUsd, num } from '../../lib/util'

const KINDS = [['salary', 'Salary', '#C9A84C'], ['business', 'Business', '#8B7355'], ['socialSecurity', 'Social Security', '#34D399'], ['pension', 'Pension', '#8FA3D9'], ['rental', 'Rental', '#A06CD5'], ['rmd', 'RMDs', '#3FB6C9'], ['other', 'Other', '#B8B4AC']]
const pctOf = (v) => `${Math.round(v * 100)}%`

export default function Overview({ C, isDesktop, f, model, run, mc, mcBusy, runMc, patchAssessment, setSub }) {
  if (!run) return <Card C={C}><Empty C={C} icon="◇" title="Enter the household first" action={<Btn C={C} primary onClick={() => setSub('inputs')}>Go to Inputs</Btn>}>Add each person with a date of birth, then income, spending and accounts. The projection appears here as soon as there is enough to calculate.</Empty></Card>
  const P = run.projection
  const rows = P.rows.map((r) => ({ year: r.year, ...Object.fromEntries(KINDS.map(([k]) => [k, r.income[k] || 0])), withdrawals: r.withdrawals.total, spend: r.expenses.total + r.taxes.total }))
  const flagYears = P.rows.filter((r) => r.shortfall > 0).map((r) => r.year)
  const a = f.assessment || {}
  // 5-year cash needs: what the plan draws from savings in each of the first five years, so the deck panel comes from the engine.
  const startYear = Math.max(model.assumptions.baseYear, ...Object.values(P.retirementYear).slice(0, 1))
  const five = Array.from({ length: 5 }, (_, i) => { const r = P.rows.find((x) => x.year === startYear + i); return { year: startYear + i, need: r ? Math.round(r.withdrawals.total + r.shortfall) : null } })
  const push = () => patchAssessment({ retirementCashNeed: String(five[0].need ?? ''), cashYear2: String(five[1].need ?? ''), cashYear3: String(five[2].need ?? ''), cashYear4: String(five[3].need ?? ''), cashYear5: String(five[4].need ?? '') })
  const spendNow = model.expenses.filter((e) => e.kind === 'lifestyle').reduce((t, e) => t + e.annual, 0) || num(a.lifestyleSpend)
  const incomeNow = P.rows[0] ? P.rows[0].income.total : num(f.profile?.householdIncome)
  const sr = incomeNow > 0 && spendNow > 0 ? Math.round((1 - spendNow / incomeNow) * 100) : null
  return (
    <div>
      <Grid cols={isDesktop ? 4 : 2} gap={10} style={{ marginBottom: 14 }}>
        <Stat C={C} label="Probability of success" value={mc ? pctOf(mc.successProbability) : mcBusy ? '…' : '—'} color={mc ? (mc.successProbability >= 0.85 ? C.up : mc.successProbability >= 0.7 ? C.warn : C.dn) : undefined} sub={mc ? `${mc.runs.toLocaleString()} simulations` : mcBusy ? 'Calculating' : ''} />
        <Stat C={C} label="Net worth at retirement" value={fmtUsd(P.netWorthAtRetirement, { compact: true })} />
        <Stat C={C} label="Net worth at life expectancy" value={fmtUsd(P.netWorthAtEnd, { compact: true })} sub={`${P.endYear}`} />
        <Stat C={C} label="Lifetime taxes" value={fmtUsd(P.lifetimeTaxes, { compact: true })} />
      </Grid>
      {P.depletionYear && <Note C={C} tone="danger" style={{ marginBottom: 12 }}>Spending is not fully funded from {P.depletionYear}. Shortfall years are marked in red on the chart and table.</Note>}
      {P.warnings.length > 0 && <Note C={C} tone="warn" style={{ marginBottom: 12 }}>{P.warnings.join(' ')}</Note>}
      <Card C={C} style={{ marginBottom: 14 }}>
        <Eyebrow C={C}>Income sources vs expenses by year</Eyebrow>
        <StackedBars C={C} rows={rows} flagYears={flagYears} segments={[...KINDS.filter(([k]) => rows.some((r) => r[k] > 0)).map(([key, label, color]) => ({ key, label, color })), { key: 'withdrawals', label: 'Withdrawals from savings', color: '#E8794A' }]} line={{ key: 'spend', label: 'Expenses and taxes', color: C.dn }} />
      </Card>
      <Grid cols={isDesktop ? 2 : 1} gap={14}>
        <Card C={C}>
          <Eyebrow C={C}>5-year cash needs (deck slide)</Eyebrow>
          <Row gap={8} style={{ marginTop: 6 }}>
            {five.map((y, i) => (
              <div key={y.year} style={{ flex: 1, minWidth: 90, padding: '12px 10px', borderRadius: 10, background: i === 0 ? C.accentSoft : C.surface, border: `1px solid ${i === 0 ? C.borderActive : C.border}`, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: C.t4, textTransform: 'uppercase', letterSpacing: 1 }}>Year {i + 1}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.t1 }}>{y.need != null ? fmtUsd(y.need, { compact: true }) : '—'}</div>
                <div style={{ fontSize: 10.5, color: C.t3 }}>{y.year}</div>
              </div>
            ))}
          </Row>
          <div style={{ fontSize: 11.5, color: C.t4, margin: '10px 0' }}>From the engine: what the plan draws from savings (spending and taxes not covered by income) in the five years from {startYear}.</div>
          <Row><Btn C={C} small primary onClick={push}>Use these in the decks</Btn><span style={{ fontSize: 11.5, color: C.t4 }}>Writes year 1 to “Retirement cash need” and years 2 to 5 to the Assessment cash-need fields.</span></Row>
        </Card>
        <Card C={C}>
          <Eyebrow C={C}>Deck figures</Eyebrow>
          <Grid cols={2} gap={10}>
            <Field C={C} label="Cash on hand (year 1)"><Input C={C} value={a.cashOnHand} onChange={(v) => patchAssessment({ cashOnHand: v })} /></Field>
            <Field C={C} label="Emergency reserve target"><Input C={C} value={a.reserveTarget} onChange={(v) => patchAssessment({ reserveTarget: v })} /></Field>
            <Field C={C} label="Monthly income (under-$5M tile)"><Input C={C} value={a.incomeMonthly} onChange={(v) => patchAssessment({ incomeMonthly: v })} placeholder="e.g. 1750" /></Field>
            <Field C={C} label="Savings rate" hint="Needs income and lifestyle spending"><div style={{ padding: '9px 12px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, fontSize: 13.5, fontWeight: 800, color: sr == null ? C.t3 : sr < 10 ? C.dn : C.up }}>{sr == null ? '--' : `${sr}%`}</div></Field>
          </Grid>
          {!mc && !mcBusy && <Row style={{ marginTop: 10 }}><Btn C={C} small onClick={() => runMc()}>Run Monte Carlo</Btn></Row>}
        </Card>
      </Grid>
    </div>
  )
}
