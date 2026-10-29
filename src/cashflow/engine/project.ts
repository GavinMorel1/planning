// Annual cash-flow projection. project() runs the deterministic (expected-return) path; monteCarlo.ts reuses stepYear() with
// random returns. All money is nominal US dollars; years are calendar years.
//
// RULES (read before changing anything)
// Timeline  Starts at assumptions.baseYear; a member dies in the year they reach lifeExpectancy (alive and counted for that whole
//           year, null in `ages` afterwards). The plan ends when the last non-dependent member dies. Effects of the first death
//           (filing status single, survivor spending step-down, Social Security survivor rule) begin the year AFTER it.
//           Age in a year = year - birth year (calendar-year age). Work stops in the year a member reaches retirementAge.
// Income    salary/business: grow at growthPct ?? salaryGrowthPct, stop the year before the owner's retirement year (joint: the
//           later spouse) unless endYear is set, and stop at the owner's death. pension/rental/other grow at growthPct ?? inflation;
//           pensions stop at the owner's death (no survivor benefit modelled), rental/other continue.
//           Social Security: ONE rule. A member with ssPiaMonthly > 0 receives benefits automatically from the year they reach
//           their claim age (socialSecurity.ts, COLA from the base year, survivor gets the larger benefit). A 'socialSecurity'
//           income stream with annual > 0 is a MANUAL OVERRIDE for its owner (joint = everyone): the stream's annual amount (base-year
//           dollars, growth ssColaPct unless growthPct is set, starting at startYear or the owner's claim-age year) replaces the
//           automatic benefit. Streams with annual 0 are ignored.
//           RMDs from traditional accounts at SECURE 2.0 ages are added as income kind 'rmd' (balance at the start of the year).
// Expenses  today's dollars inflated from the base year; one-time items once; debt service from liabilities; insurance premiums
//           (flat); gifting (inflated). Lifestyle spending is multiplied by survivorPct ?? survivorExpensePct after the first death
//           (other kinds only when their own survivorPct is set).
// Taxes     federal ordinary + LTCG (stacked), NIIT, approximate flat state tax, payroll/self-employment. Standard deduction only.
//           Traditional and HSA contributions are deductible (capped at earned income). Investment returns are NOT taxed as they
//           accrue (no dividend/interest drag); tax arises on RMDs, conversions, withdrawals, sales and income streams. Taxes depend
//           on withdrawals, so each year iterates tax -> withdrawals up to 8 times.
// Cash flow income + RMDs - expenses - taxes - contributions < 0 is drawn from accounts in assumptions.withdrawalOrder (cash above
//           the inflated cashReserveTarget first; the reserve itself only when nothing else is left). A surplus goes to cash up to six
//           months of expenses, the rest to taxable. Real estate / business are never drawn unless sold (saleYear: start of the year,
//           net of saleCostPct and secured debt, to cash, gain over basis taxed as LTCG).
// Timing    withdrawals, RMDs, conversions and sales happen at the start of the year; growth applies to what remains; contributions
//           and surplus are added at year end (no growth until next year). Cash grows at its own returnPct or min(returnPct, 2%).
// Shortfall spending not fundable from liquid accounts is recorded in `shortfall`; the first such year is depletionYear.
import type { AccountType, CashflowModel, Id } from '../types'
import type { EngineConfig, Projection, ProjectionRow, TaxBreakdown } from './types'
import { buildPlan, type PlanContext, type PlanYear } from './plan'
import { initialState, newStepResult, stepYear, type StepResult, type StepState } from './step'

export { buildPlan }
export type { PlanContext }

const ZERO_TYPES: Record<AccountType, number> = { cash: 0, taxable: 0, traditional: 0, roth: 0, hsa: 0, realEstate: 0, business: 0 }

/** Expected-return vector (one entry per plan account) for the deterministic path. */
export function expectedReturns(ctx: PlanContext): Float64Array {
  return Float64Array.from(ctx.accounts, (x) => x.mean)
}

function buildRow(ctx: PlanContext, py: PlanYear, st: StepState, r: StepResult): ProjectionRow {
  const balances: Record<AccountType, number> = { ...ZERO_TYPES }
  const accountBalances: Record<Id, number> = {}
  ctx.accounts.forEach((x, i) => {
    balances[x.type] += st.bal[i]
    if (!x.synthetic || Math.abs(st.bal[i]) > 0.005) accountBalances[x.id] = st.bal[i]
  })
  const inc = py.incomeBase
  const income = { ...inc, rmd: r.rmd, total: py.incomeTotal + r.rmd }
  const gross = income.total + r.conversion + r.traditional + r.realizedGains
  const taxes: TaxBreakdown = {
    federalIncome: r.federalIncome, federalLtcg: r.federalLtcg, niit: r.niit, state: r.state, payroll: r.payroll, total: r.totalTax,
    agi: r.agi, taxableIncome: r.taxableIncome, marginalRate: r.marginalRate, effectiveRate: gross > 0 ? (r.totalTax / gross) * 100 : 0,
    ssTaxable: r.ssTaxable, irmaaFlag: r.irmaa, rothConversion: r.conversion,
  }
  return {
    year: py.year, ages: py.ages, income, expenses: { ...py.expenses }, taxes, contributions: py.contribTotal,
    withdrawals: { cash: r.cash, taxable: r.taxable, traditional: r.traditional, roth: r.roth, hsa: r.hsa, total: r.withdrawn },
    surplus: r.surplus, shortfall: r.shortfall, balances, accountBalances, liabilityBalance: py.liabilityEnd, netWorth: r.netWorth, liquidAssets: r.liquid,
    saleProceeds: r.saleProceeds,
  }
}

export function project(model: CashflowModel, cfg: EngineConfig): Projection {
  const ctx = buildPlan(model, cfg)
  const st = initialState(ctx)
  const ret = expectedReturns(ctx)
  const r = newStepResult(ctx.accounts.length)
  const rows: ProjectionRow[] = []
  const warnings = [...ctx.warnings]
  for (const py of ctx.years) {
    stepYear(ctx, py, st, ret, r)
    if (py.rothConversion - r.conversion > 1) warnings.push(`Roth conversion in ${py.year} limited to ${Math.round(r.conversion)} (requested ${Math.round(py.rothConversion)}): not enough in traditional accounts.`)
    rows.push(buildRow(ctx, py, st, r))
  }
  const dep = rows.find((x) => x.shortfall > 0)
  if (dep) warnings.push(`Spending cannot be fully funded from ${dep.year}: liquid assets are exhausted.`)
  const retYear = ctx.primaryRetirementYear
  const retRow = retYear === null ? rows[0] : rows.find((x) => x.year === retYear) ?? (retYear < ctx.baseYear ? rows[0] : rows[rows.length - 1])
  return {
    rows, startYear: ctx.baseYear, endYear: ctx.endYear, firstDeathYear: ctx.firstDeathYear, retirementYear: { ...ctx.retirementYear },
    depletionYear: dep ? dep.year : null, lifetimeTaxes: rows.reduce((s, x) => s + x.taxes.total, 0),
    netWorthAtRetirement: retRow ? retRow.netWorth : 0, netWorthAtEnd: rows.length ? rows[rows.length - 1].netWorth : 0, warnings,
  }
}
