// Report content for the Cashflow > Reports builder. This module turns engine results into a neutral list of blocks (KPIs,
// tables, charts, text) that the PDF and PowerPoint exporters both render, so the two formats always agree.
import type { CashflowModel } from '../types'
import type { EstateSnapshot, MonteCarloResult, Projection, ProjectionRow } from '../engine/types'

export type ReportSectionId = 'netWorth' | 'cashFlowTable' | 'incomeVsExpenses' | 'retirement' | 'monteCarlo' | 'tax' | 'estate' | 'assumptions' | 'actions'
export const REPORT_SECTIONS: Array<{ id: ReportSectionId; label: string }> = [
  { id: 'netWorth', label: 'Net Worth Summary' }, { id: 'cashFlowTable', label: 'Cash Flow Table' }, { id: 'incomeVsExpenses', label: 'Income vs Expenses chart' },
  { id: 'retirement', label: 'Retirement Projection' }, { id: 'monteCarlo', label: 'Monte Carlo' }, { id: 'tax', label: 'Tax Projection' },
  { id: 'estate', label: 'Estate Snapshot' }, { id: 'assumptions', label: 'Assumptions & Disclosures' }, { id: 'actions', label: 'Action Items' },
]
export const DEFAULT_SECTIONS: ReportSectionId[] = REPORT_SECTIONS.map((s) => s.id)

export interface ReportScenario { id: string; name: string; projection: Projection; monteCarlo?: MonteCarloResult | null; estate: EstateSnapshot[] }
export interface ReportInput {
  familyName: string
  title: string
  preparedBy: string
  date: string // ISO
  model: CashflowModel
  scenarios: ReportScenario[] // 1, or 2 to compare
  sections: ReportSectionId[]
  narrative: string
  actionItems: string[]
  disclosure: string
}

export type Block =
  | { type: 'kpis'; items: Array<{ label: string; values: string[] }> } // one value per scenario
  | { type: 'table'; columns: Array<{ key: string; label: string; align?: 'left' | 'right' }>; rows: Array<Record<string, string>>; flagRows?: number[] }
  | { type: 'chart'; kind: 'stacked' | 'lines' | 'band'; title: string; years: number[]; series: Array<{ name: string; values: number[]; color: string }>; stacked?: boolean; band?: Array<{ year: number; p10: number; p25: number; p50: number; p75: number; p90: number }> }
  | { type: 'text'; text: string }
  | { type: 'bullets'; items: string[] }
export interface Section { id: ReportSectionId | 'summary' | 'comparison'; title: string; subtitle?: string; blocks: Block[] }

export const usd = (v: number | null | undefined): string => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v < 0 ? '−' : ''}$${Math.round(Math.abs(v)).toLocaleString('en-US')}`)
export const usdK = (v: number): string => { const a = Math.abs(v); const s = a >= 1e6 ? `$${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `$${Math.round(a / 1e3)}K` : `$${Math.round(a)}`; return v < 0 ? `−${s}` : s }
export const pct = (v: number | null | undefined, d = 1): string => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v.toFixed(d)}%`)
const COLORS = ['#C9A84C', '#1A1E3A', '#4A7C59', '#993333', '#8B7355']
const primaryAge = (m: CashflowModel, r: ProjectionRow) => { const p = m.members.find((x) => x.role === 'primary') || m.members[0]; return p ? r.ages[p.id] : null }
const shortfallRows = (p: Projection) => p.rows.map((r, i) => (r.shortfall > 0 ? i : -1)).filter((i) => i >= 0)
const sumIncome = (r: ProjectionRow) => r.income.total
const tableYears = (rows: ProjectionRow[], step: number) => rows.filter((_, i) => i % step === 0 || i === rows.length - 1)

export function successText(s: ReportScenario): string { return s.monteCarlo ? `${Math.round(s.monteCarlo.successProbability * 100)}%` : '—' }

export function buildSections(inp: ReportInput): Section[] {
  const out: Section[] = []
  const sc = inp.scenarios
  const one = sc[0]
  const names = sc.map((s) => s.name)
  const m = inp.model
  const has = (id: ReportSectionId) => inp.sections.includes(id)

  // Summary page: narrative + headline KPIs for every scenario.
  const kpis: Block = { type: 'kpis', items: [
    { label: 'Probability of success', values: sc.map(successText) },
    { label: 'Net worth at retirement', values: sc.map((s) => usdK(s.projection.netWorthAtRetirement)) },
    { label: 'Net worth at end of plan', values: sc.map((s) => usdK(s.projection.netWorthAtEnd)) },
    { label: 'Lifetime taxes', values: sc.map((s) => usdK(s.projection.lifetimeTaxes)) },
    { label: 'Funded through', values: sc.map((s) => (s.projection.depletionYear ? `Short in ${s.projection.depletionYear}` : `${s.projection.endYear}`)) },
  ] }
  out.push({ id: 'summary', title: inp.title, subtitle: `${inp.familyName} · ${names.join(' vs ')}`, blocks: [kpis, ...(inp.narrative.trim() ? [{ type: 'text', text: inp.narrative.trim() } as Block] : [])] })

  if (sc.length > 1) {
    const rows: Array<Record<string, string>> = [
      ['Probability of success', ...sc.map(successText)], ['Retirement year (primary)', ...sc.map((s) => String(Object.values(s.projection.retirementYear)[0] ?? '—'))],
      ['Net worth at retirement', ...sc.map((s) => usd(s.projection.netWorthAtRetirement))], ['Net worth at end of plan', ...sc.map((s) => usd(s.projection.netWorthAtEnd))],
      ['Lifetime taxes', ...sc.map((s) => usd(s.projection.lifetimeTaxes))], ['First shortfall year', ...sc.map((s) => (s.projection.depletionYear ? String(s.projection.depletionYear) : 'None'))],
      ['Federal estate tax (all deaths)', ...sc.map((s) => usd(s.estate.reduce((t, e) => t + e.federalEstateTax, 0)))],
    ].map((r) => Object.fromEntries(r.map((v, i) => [i === 0 ? 'metric' : `s${i - 1}`, v])))
    out.push({ id: 'comparison', title: 'Scenario comparison', subtitle: names.join(' vs '), blocks: [{ type: 'table', columns: [{ key: 'metric', label: 'Measure' }, ...sc.map((s, i) => ({ key: `s${i}`, label: s.name, align: 'right' as const }))], rows }] })
  }

  if (has('netWorth')) {
    const years = one.projection.rows.map((r) => r.year)
    const first = one.projection.rows[0]
    out.push({ id: 'netWorth', title: 'Net worth summary', subtitle: names.join(' vs '), blocks: [
      { type: 'kpis', items: [{ label: 'Net worth today', values: sc.map((s) => usdK(s.projection.rows[0]?.netWorth ?? 0)) }, { label: 'At retirement', values: sc.map((s) => usdK(s.projection.netWorthAtRetirement)) }, { label: 'At end of plan', values: sc.map((s) => usdK(s.projection.netWorthAtEnd)) }] },
      { type: 'chart', kind: 'lines', title: 'Net worth by year', years, series: sc.map((s, i) => ({ name: s.name, values: s.projection.rows.map((r) => r.netWorth), color: COLORS[i % COLORS.length] })) },
      { type: 'table', columns: [{ key: 'year', label: 'Year' }, { key: 'age', label: 'Age' }, { key: 'liquid', label: 'Liquid assets', align: 'right' }, { key: 'liab', label: 'Liabilities', align: 'right' }, { key: 'nw', label: 'Net worth', align: 'right' }],
        rows: tableYears(one.projection.rows, 5).map((r) => ({ year: String(r.year), age: String(primaryAge(m, r) ?? '—'), liquid: usd(r.liquidAssets), liab: usd(r.liabilityBalance), nw: usd(r.netWorth) })) },
    ] })
    void first
  }

  if (has('cashFlowTable')) {
    const rows = one.projection.rows
    out.push({ id: 'cashFlowTable', title: 'Cash flow table', subtitle: `${one.name}. Shortfall years are highlighted.`, blocks: [{ type: 'table',
      columns: [{ key: 'year', label: 'Year' }, { key: 'age', label: 'Age' }, { key: 'income', label: 'Income', align: 'right' }, { key: 'exp', label: 'Expenses', align: 'right' }, { key: 'tax', label: 'Taxes', align: 'right' }, { key: 'wd', label: 'Withdrawals', align: 'right' }, { key: 'net', label: 'Surplus / shortfall', align: 'right' }, { key: 'nw', label: 'Net worth', align: 'right' }],
      rows: rows.map((r) => ({ year: String(r.year), age: String(primaryAge(m, r) ?? '—'), income: usd(sumIncome(r)), exp: usd(r.expenses.total), tax: usd(r.taxes.total), wd: usd(r.withdrawals.total), net: r.shortfall > 0 ? usd(-r.shortfall) : usd(r.surplus), nw: usd(r.netWorth) })), flagRows: shortfallRows(one.projection) }] })
  }

  if (has('incomeVsExpenses')) {
    const rows = one.projection.rows
    const kinds: Array<[keyof ProjectionRow['income'], string, string]> = [['salary', 'Salary', COLORS[0]], ['business', 'Business', COLORS[4]], ['socialSecurity', 'Social Security', COLORS[2]], ['pension', 'Pension', '#8FA3D9'], ['rental', 'Rental', '#A06CD5'], ['rmd', 'RMDs', '#3FB6C9'], ['other', 'Other', '#B8B4AC']]
    const series = kinds.map(([k, label, color]) => ({ name: label, color, values: rows.map((r) => Number(r.income[k]) || 0) })).filter((s) => s.values.some((v) => v > 0))
    series.push({ name: 'Withdrawals from savings', color: '#E8794A', values: rows.map((r) => r.withdrawals.total) })
    out.push({ id: 'incomeVsExpenses', title: 'Income sources vs expenses', subtitle: `${one.name}. Bars are income by source; the line is total spending plus taxes.`, blocks: [
      { type: 'chart', kind: 'stacked', title: 'Income vs expenses', years: rows.map((r) => r.year), stacked: true, series: [...series, { name: 'Expenses and taxes', color: '#993333', values: rows.map((r) => r.expenses.total + r.taxes.total) }] },
    ] })
  }

  if (has('retirement')) {
    const p = one.projection
    const rows = m.members.map((mem) => ({ who: mem.name || 'Member', retire: `Age ${mem.retirementAge} (${p.retirementYear[mem.id] ?? '—'})`, ss: mem.ssPiaMonthly ? `${usd(mem.ssPiaMonthly * 12)}/yr at full retirement age, claiming at ${mem.ssClaimAge}` : 'None entered', life: `Plan to age ${mem.lifeExpectancy}` }))
    const firstRet = p.rows.find((r) => r.year >= (Object.values(p.retirementYear)[0] ?? 0)) || p.rows[0]
    out.push({ id: 'retirement', title: 'Retirement projection', subtitle: names.join(' vs '), blocks: [
      { type: 'kpis', items: [{ label: 'Funded through', values: sc.map((s) => (s.projection.depletionYear ? `Short in ${s.projection.depletionYear}` : `${s.projection.endYear} (end of plan)`)) }, { label: 'Spending in first retirement year', values: sc.map((s) => { const r = s.projection.rows.find((x) => x.year >= (Object.values(s.projection.retirementYear)[0] ?? 0)) || s.projection.rows[0]; return usdK(r ? r.expenses.total + r.taxes.total : 0) }) }, { label: 'Guaranteed income in first retirement year', values: sc.map((s) => { const r = s.projection.rows.find((x) => x.year >= (Object.values(s.projection.retirementYear)[0] ?? 0)) || s.projection.rows[0]; return usdK(r ? r.income.socialSecurity + r.income.pension : 0) }) }] },
      { type: 'table', columns: [{ key: 'who', label: 'Member' }, { key: 'retire', label: 'Retires' }, { key: 'ss', label: 'Social Security' }, { key: 'life', label: 'Plan horizon' }], rows },
      { type: 'text', text: `In the first retirement year (${firstRet?.year ?? '—'}) the plan funds ${usd(firstRet ? firstRet.expenses.total + firstRet.taxes.total : 0)} of spending and taxes, with ${usd(firstRet ? firstRet.withdrawals.total : 0)} drawn from savings.` },
    ] })
  }

  if (has('monteCarlo')) {
    const withMc = sc.filter((s) => s.monteCarlo)
    if (withMc.length) {
      const band = withMc[0].monteCarlo!.bands
      out.push({ id: 'monteCarlo', title: 'Monte Carlo analysis', subtitle: `${withMc[0].monteCarlo!.runs.toLocaleString('en-US')} simulated market paths`, blocks: [
        { type: 'kpis', items: [{ label: 'Probability of success', values: sc.map(successText) }, { label: 'Median ending liquid assets', values: sc.map((s) => (s.monteCarlo ? usdK(s.monteCarlo.medianEndingLiquid) : '—')) }, { label: 'Poor markets (10th percentile) ending', values: sc.map((s) => (s.monteCarlo ? usdK(s.monteCarlo.p10EndingLiquid) : '—')) }] },
        { type: 'chart', kind: 'band', title: `Liquid assets, ${withMc[0].name}`, years: band.map((b) => b.year), series: [], band },
        { type: 'text', text: 'Each simulation applies a different random sequence of annual returns around the assumed average and volatility. The probability of success is the share of simulations in which spending is funded through the end of the plan. It is a hypothetical statistical estimate, not a prediction.' },
      ] })
    }
  }

  if (has('tax')) {
    const rows = tableYears(one.projection.rows, 3)
    out.push({ id: 'tax', title: 'Tax projection', subtitle: `${one.name}. Estimates using current-law federal brackets and an approximate state rate.`, blocks: [
      { type: 'kpis', items: [{ label: 'Lifetime taxes', values: sc.map((s) => usdK(s.projection.lifetimeTaxes)) }, { label: 'Peak marginal bracket', values: sc.map((s) => pct(Math.max(0, ...s.projection.rows.map((r) => r.taxes.marginalRate)), 0)) }, { label: 'Years above the IRMAA threshold', values: sc.map((s) => String(s.projection.rows.filter((r) => r.taxes.irmaaFlag).length)) }] },
      { type: 'table', columns: [{ key: 'year', label: 'Year' }, { key: 'fed', label: 'Federal', align: 'right' }, { key: 'state', label: 'State', align: 'right' }, { key: 'niit', label: 'NIIT', align: 'right' }, { key: 'pay', label: 'Payroll', align: 'right' }, { key: 'eff', label: 'Effective', align: 'right' }, { key: 'marg', label: 'Marginal', align: 'right' }, { key: 'irmaa', label: 'IRMAA' }],
        rows: rows.map((r) => ({ year: String(r.year), fed: usd(r.taxes.federalIncome + r.taxes.federalLtcg), state: usd(r.taxes.state), niit: usd(r.taxes.niit), pay: usd(r.taxes.payroll), eff: pct(r.taxes.effectiveRate), marg: pct(r.taxes.marginalRate, 0), irmaa: r.taxes.irmaaFlag ? 'Yes' : '' })) },
    ] })
  }

  if (has('estate')) {
    out.push({ id: 'estate', title: 'Estate snapshot', subtitle: 'At each projected death, using the federal exemption in Settings', blocks: sc.flatMap((s) => [
      ...(sc.length > 1 ? [{ type: 'text', text: s.name } as Block] : []),
      { type: 'table', columns: [{ key: 'who', label: 'At the death of' }, { key: 'year', label: 'Year' }, { key: 'gross', label: 'Gross estate', align: 'right' }, { key: 'mar', label: 'Marital deduction', align: 'right' }, { key: 'taxable', label: 'Taxable estate', align: 'right' }, { key: 'ex', label: 'Exemption', align: 'right' }, { key: 'tax', label: 'Federal estate tax', align: 'right' }, { key: 'net', label: 'Net to heirs', align: 'right' }],
        rows: s.estate.map((e) => ({ who: e.deceasedName, year: String(e.year), gross: usd(e.grossEstate), mar: usd(e.maritalDeduction), taxable: usd(e.taxableEstate), ex: usd(e.exemptionAvailable), tax: usd(e.federalEstateTax), net: usd(e.netToHeirs) })) } as Block,
    ]) })
  }

  if (has('assumptions')) {
    const a = m.assumptions
    out.push({ id: 'assumptions', title: 'Assumptions & disclosures', blocks: [
      { type: 'table', columns: [{ key: 'k', label: 'Assumption' }, { key: 'v', label: 'Value', align: 'right' }], rows: [
        ['First projection year', String(a.baseYear)], ['Inflation', pct(a.inflationPct)], ['Healthcare inflation', pct(a.healthcareInflationPct)], ['Salary growth', pct(a.salaryGrowthPct)], ['Default investment return', pct(a.returnPct)], ['Volatility (Monte Carlo)', pct(a.stdDevPct)],
        ['Social Security COLA', pct(a.ssColaPct)], ['Filing status', a.filingStatus.toUpperCase()], ['State', a.state || 'None'], ['Spending kept after first death', pct(a.survivorExpensePct, 0)], ['Withdrawal order', a.withdrawalOrder.join(' › ')],
      ].map(([k, v]) => ({ k, v })) },
      { type: 'text', text: inp.disclosure },
    ] })
  }

  if (has('actions') && inp.actionItems.filter((x) => x.trim()).length) out.push({ id: 'actions', title: 'Action items', blocks: [{ type: 'bullets', items: inp.actionItems.filter((x) => x.trim()) }] })
  return out
}

/** Every number the Narrative button hands to Claude: nothing else is sent. */
export function narrativeFacts(inp: ReportInput) {
  return {
    scenarios: inp.scenarios.map((s) => ({
      name: s.name, probabilityOfSuccessPct: s.monteCarlo ? Math.round(s.monteCarlo.successProbability * 100) : null, netWorthToday: Math.round(s.projection.rows[0]?.netWorth ?? 0),
      netWorthAtRetirement: Math.round(s.projection.netWorthAtRetirement), netWorthAtEndOfPlan: Math.round(s.projection.netWorthAtEnd), lifetimeTaxes: Math.round(s.projection.lifetimeTaxes),
      firstShortfallYear: s.projection.depletionYear, planEndsYear: s.projection.endYear, retirementYears: s.projection.retirementYear,
      federalEstateTaxAtDeaths: s.estate.map((e) => ({ year: e.year, tax: Math.round(e.federalEstateTax) })),
    })),
    household: inp.model.members.map((x) => ({ name: x.name, retirementAge: x.retirementAge, lifeExpectancy: x.lifeExpectancy })),
    assumptions: { inflationPct: inp.model.assumptions.inflationPct, returnPct: inp.model.assumptions.returnPct, filingStatus: inp.model.assumptions.filingStatus },
  }
}
