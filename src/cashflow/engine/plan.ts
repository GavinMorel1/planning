// Static plan: everything in a projection that does NOT depend on investment returns or on withdrawals (income streams,
// expenses, debt service, premiums, Social Security, RMD rates, payroll tax, contributions, sale schedule). It is built once per
// (model, config) and reused by project() and by every Monte Carlo run; only account balances change from run to run.
import type { Account, AccountType, CashflowModel, FilingStatus, Id, Liability, Member } from '../types'
import type { AgeMap, EngineConfig, ExpenseBreakdown, IncomeBreakdown } from './types'
import { liabilitySchedule, type LiabilitySchedule } from './liabilities'
import { rmdAmount } from './rmd'
import { annualBenefit, ssBenefitsForYear, type SsPerson } from './socialSecurity'
import { indexFactor, payroll, type PayrollTax } from './tax'
import { STATE_TAX_RATES } from './taxTables'

export type WithdrawalType = 'cash' | 'taxable' | 'traditional' | 'roth' | 'hsa'
export const MAX_PLAN_YEARS = 121

export interface PlanMember { id: Id; name: string; role: Member['role']; birthYear: number; deathYear: number; retirementYear: number; isAdult: boolean; ssClaimAge: number }

export interface PlanAccount {
  id: Id; name: string; type: AccountType; ownerId: Id | 'joint'
  balance: number
  basis: number // starting cost basis (taxable, real estate, business)
  saleYear: number | null; saleCostPct: number
  illiquid: boolean // never drawn on
  risky: boolean // market-exposed: varies in Monte Carlo
  mean: number; sd: number // annual return mean and standard deviation, as fractions
  meanExplicit: boolean; sdExplicit: boolean // set on the account itself (Monte Carlo overrides only fill the gaps)
  synthetic: boolean // created by the engine (cash / taxable / roth landing account), not in the model
}

export interface PlanYear {
  year: number; t: number
  factor: number // tax-table inflation index
  filing: FilingStatus
  ages: AgeMap
  n65: number // taxpayers aged 65+ for the additional standard deduction
  anyAge65: boolean
  incomeBase: Omit<IncomeBreakdown, 'rmd' | 'total'>
  incomeTotal: number // excludes RMDs
  ordTaxable: number // taxable salary + business + pension + rental + other (no Social Security, RMD, conversions or withdrawals)
  rentalTaxable: number
  ssGross: number
  payroll: PayrollTax
  preTaxDeduction: number // deductible contributions to traditional / HSA accounts
  expenses: ExpenseBreakdown
  contrib: Float64Array // per account
  contribTotal: number
  rmdRate: Float64Array // per account: RMD as a fraction of the start-of-year balance
  rothConversion: number // requested
  sales: number[] // account indices sold at the start of this year
  salePayoff: Float64Array // per account: secured debt repaid out of the sale
  liabilityEnd: number
  reserve: number // cash reserve target, inflated
}

export interface PlanContext {
  model: CashflowModel
  cfg: EngineConfig
  baseYear: number; endYear: number
  members: PlanMember[]
  adults: PlanMember[]
  firstDeathYear: number | null
  retirementYear: Record<Id, number>
  accounts: PlanAccount[]
  cashIdx: number; taxableIdx: number; rothIdx: number
  order: WithdrawalType[]
  liabilities: Array<{ liability: Liability; schedule: LiabilitySchedule }>
  years: PlanYear[]
  warnings: string[]
  taxYear: number
  /** The primary member's retirement year (first member with role 'primary', else the first member). */
  primaryRetirementYear: number | null
}

const grow = (pct: number, t: number) => Math.pow(1 + pct / 100, Math.max(0, t))
const MARKET: AccountType[] = ['taxable', 'traditional', 'roth', 'hsa']

export function birthYearOf(m: Pick<Member, 'dob'>): number | null {
  const y = parseInt((m.dob || '').slice(0, 4), 10)
  return Number.isFinite(y) && y > 1850 && y < 2200 ? y : null
}

function synthetic(id: string, name: string, type: AccountType, a: CashflowModel['assumptions']): PlanAccount {
  const isCash = type === 'cash'
  return {
    id, name, type, ownerId: 'joint', balance: 0, basis: 0, saleYear: null, saleCostPct: 0, illiquid: false, risky: !isCash,
    mean: (isCash ? Math.min(a.returnPct, 2) : a.returnPct) / 100, sd: isCash ? 0 : a.stdDevPct / 100, meanExplicit: false, sdExplicit: false, synthetic: true,
  }
}

function planAccount(x: Account, a: CashflowModel['assumptions'], warn: (s: string) => void): PlanAccount {
  const risky = MARKET.includes(x.type)
  const defaultMean = x.type === 'cash' ? Math.min(a.returnPct, 2) : risky ? a.returnPct : a.inflationPct
  let basis = 0
  if (x.type === 'taxable' || x.type === 'realEstate' || x.type === 'business') {
    if (x.costBasis === null || x.costBasis === undefined) {
      basis = x.balance
      if (x.balance > 0 && (x.type === 'taxable' || x.saleYear !== null)) warn(`Cost basis missing for ${x.name || x.type}; assumed equal to current value (no embedded gain).`)
    } else basis = x.costBasis
  }
  return {
    id: x.id, name: x.name, type: x.type, ownerId: x.ownerId, balance: x.balance, basis, saleYear: x.saleYear, saleCostPct: x.saleCostPct,
    illiquid: x.illiquid, risky, mean: (x.returnPct ?? defaultMean) / 100, sd: risky ? (x.stdDevPct ?? a.stdDevPct) / 100 : 0,
    meanExplicit: x.returnPct !== null && x.returnPct !== undefined, sdExplicit: x.stdDevPct !== null && x.stdDevPct !== undefined, synthetic: false,
  }
}

export function buildPlan(model: CashflowModel, cfg: EngineConfig): PlanContext {
  const a = model.assumptions
  const baseYear = a.baseYear
  const taxYear = cfg.taxYear ?? baseYear
  const warnings: string[] = []
  const warn = (s: string) => { if (!warnings.includes(s)) warnings.push(s) }

  // ---- members -----------------------------------------------------------------------------------------------------
  if (!model.members.length) warn('No household members: add at least one member with a date of birth.')
  const members: PlanMember[] = model.members.map((m) => {
    let by = birthYearOf(m)
    if (by === null) { by = baseYear - 60; warn(`Date of birth missing for ${m.name || 'a household member'}; assumed age 60 in ${baseYear}.`) }
    return { id: m.id, name: m.name, role: m.role, birthYear: by, deathYear: Math.round(by + m.lifeExpectancy), retirementYear: Math.round(by + m.retirementAge), isAdult: m.role !== 'dependent', ssClaimAge: m.ssClaimAge }
  })
  let adults = members.filter((m) => m.isAdult)
  if (!adults.length) adults = members
  const byId = new Map(members.map((m) => [m.id, m]))
  members.forEach((m) => { if (m.deathYear < baseYear) warn(`${m.name || 'A household member'} is already past life expectancy in ${baseYear}.`) })
  const lastDeath = adults.length ? Math.max(...adults.map((m) => m.deathYear)) : baseYear + 29
  const endYear = Math.min(baseYear + MAX_PLAN_YEARS - 1, Math.max(baseYear, lastDeath))
  const firstDeathYear = adults.length >= 2 ? Math.min(...adults.map((m) => m.deathYear)) : null
  const latestRetire = adults.length ? Math.max(...adults.map((m) => m.retirementYear)) : baseYear
  const retirementYear: Record<Id, number> = {}
  members.forEach((m) => { retirementYear[m.id] = m.retirementYear })
  const primary = members.find((m) => m.role === 'primary') ?? members[0]
  const count = endYear - baseYear + 1

  // ---- accounts ----------------------------------------------------------------------------------------------------
  const accounts = model.accounts.map((x) => planAccount(x, a, warn))
  const convRequested = a.rothConversions.some((c) => c.amount > 0)
  let cashIdx = accounts.findIndex((x) => x.type === 'cash')
  if (cashIdx < 0) { accounts.push(synthetic('__cash', 'Cash (engine)', 'cash', a)); cashIdx = accounts.length - 1 }
  let taxableIdx = accounts.findIndex((x) => x.type === 'taxable' && !x.illiquid)
  if (taxableIdx < 0) { accounts.push(synthetic('__taxable', 'Taxable (reinvested surplus)', 'taxable', a)); taxableIdx = accounts.length - 1 }
  let rothIdx = accounts.findIndex((x) => x.type === 'roth')
  if (rothIdx < 0 && convRequested) { accounts.push(synthetic('__roth', 'Roth (converted)', 'roth', a)); rothIdx = accounts.length - 1 }
  const nA = accounts.length
  const acctIndex = new Map(accounts.map((x, i) => [x.id, i]))
  accounts.forEach((x) => { if (x.saleYear !== null && x.type !== 'realEstate' && x.type !== 'business') warn(`Sale year on ${x.name || x.type} ignored: only real estate and business accounts can be sold.`) })

  const order: WithdrawalType[] = []
  for (const t of [...a.withdrawalOrder, 'cash', 'taxable', 'traditional', 'roth', 'hsa'] as WithdrawalType[]) if (!order.includes(t)) order.push(t)

  // ---- liabilities -------------------------------------------------------------------------------------------------
  const saleOf = (i: number | undefined): number | null => {
    if (i === undefined) return null
    const x = accounts[i]
    return (x.type === 'realEstate' || x.type === 'business') && x.saleYear !== null && x.saleYear >= baseYear && x.saleYear <= endYear ? x.saleYear : null
  }
  const liabilities = model.liabilities.map((l) => {
    const sec = l.securedById ? acctIndex.get(l.securedById) : undefined
    if (l.balance > 0 && l.paymentMonthly <= 0 && l.termMonths <= 0) warn(`${l.name || 'A liability'} has no payment or term: no debt service is projected.`)
    return { liability: l, schedule: liabilitySchedule(l, baseYear, count, saleOf(sec)), sec }
  })

  // ---- Social Security ---------------------------------------------------------------------------------------------
  const manualSs = model.income.filter((s) => s.kind === 'socialSecurity' && s.annual > 0)
  const manualOwners = new Set<Id>(manualSs.map((s) => s.ownerId))
  const manualAll = manualOwners.has('joint')
  const ssPeople: SsPerson[] = []
  for (const m of model.members) {
    const pm = byId.get(m.id)!
    if (pm.isAdult || !adults.some((x) => x.isAdult)) {
      const annualBase = annualBenefit(m)
      ssPeople.push({ id: m.id, birthYear: pm.birthYear, deathYear: pm.deathYear, annualBase, claimAge: m.ssClaimAge, eligibleForSurvivor: pm.isAdult })
      if (annualBase <= 0 && pm.isAdult && !manualAll && !manualOwners.has(m.id)) warn(`No Social Security PIA entered for ${m.name || 'a household member'}; no benefit projected.`)
    }
  }
  const penWarned = new Set<Id>()

  // ---- income, expenses, contributions, RMD ------------------------------------------------------------------------
  const sched = liabilities
  const years: PlanYear[] = []
  const expInflation = (e: CashflowModel['expenses'][number]) => e.inflationPct ?? (e.kind === 'healthcare' ? a.healthcareInflationPct : a.inflationPct)
  const conv = new Map<number, number>()
  a.rothConversions.forEach((c) => { if (c.amount > 0) conv.set(c.year, (conv.get(c.year) || 0) + c.amount) })
  if (!model.expenses.some((e) => e.kind === 'lifestyle' && e.annual > 0)) warn('No lifestyle spending entered.')
  if (!model.income.length && !model.accounts.length) warn('No income streams or accounts entered.')

  for (let t = 0; t < count; t++) {
    const year = baseYear + t
    const survivorMode = firstDeathYear !== null && year > firstDeathYear
    const filing: FilingStatus = survivorMode && (a.filingStatus === 'mfj' || a.filingStatus === 'mfs') ? 'single' : a.filingStatus
    const factor = indexFactor(year, a.inflationPct, taxYear, cfg.indexTables !== false)
    const ages: AgeMap = {}
    members.forEach((m) => { ages[m.id] = year <= m.deathYear ? year - m.birthYear : null })
    let n65 = 0
    adults.forEach((m) => { if (year <= m.deathYear && year - m.birthYear >= 65) n65++ })
    n65 = Math.min(n65, filing === 'mfj' || filing === 'mfs' ? 2 : 1)

    // income
    const inc = { salary: 0, business: 0, socialSecurity: 0, pension: 0, rental: 0, other: 0 }
    let ordTaxable = 0, rentalTaxable = 0
    const wages: Record<string, number> = {}, se: Record<string, number> = {}
    for (const s of model.income) {
      if (s.kind === 'socialSecurity') continue
      const owner = byId.get(s.ownerId)
      const earned = s.kind === 'salary' || s.kind === 'business'
      const end = s.endYear ?? (earned ? (owner ? owner.retirementYear : latestRetire) - 1 : Infinity)
      if (year < (s.startYear ?? baseYear) || year > end) continue
      if (owner && year > owner.deathYear && (earned || s.kind === 'pension' || s.kind === 'rental' || s.kind === 'other')) {
        if (s.kind === 'pension' && !penWarned.has(s.id) && owner.deathYear < endYear) { penWarned.add(s.id); warn(`Pension "${s.name || s.id}" stops at the owner's death in ${owner.deathYear}; set no end year only if there is no survivor benefit.`) }
        if (s.kind !== 'rental' && s.kind !== 'other') continue
        // rental and other income continue to the surviving spouse (passes with the asset); fall through
      }
      const amt = s.annual * grow(s.growthPct ?? (earned ? a.salaryGrowthPct : a.inflationPct), year - baseYear)
      inc[s.kind] += amt
      if (!s.taxable) continue
      ordTaxable += amt
      if (s.kind === 'rental') rentalTaxable += amt
      const key = owner ? owner.id : 'joint'
      if (s.kind === 'salary') wages[key] = (wages[key] || 0) + amt
      if (s.kind === 'business') se[key] = (se[key] || 0) + amt
    }
    // Social Security: automatic from PIA/claim age unless a manual stream (annual > 0) exists for that owner.
    const auto = ssBenefitsForYear(ssPeople, year, baseYear, a.ssColaPct)
    for (const p of ssPeople) if (!manualAll && !manualOwners.has(p.id)) inc.socialSecurity += auto[p.id] || 0
    for (const s of manualSs) {
      const owner = byId.get(s.ownerId)
      const start = s.startYear ?? (owner ? owner.birthYear + owner.ssClaimAge : baseYear)
      if (year < start || year > (s.endYear ?? Infinity) || (owner && year > owner.deathYear)) continue
      inc.socialSecurity += s.annual * grow(s.growthPct ?? a.ssColaPct, year - baseYear)
    }
    const incomeTotal = inc.salary + inc.business + inc.socialSecurity + inc.pension + inc.rental + inc.other
    const earnedTaxable = Object.values(wages).reduce((x, y) => x + y, 0) + Object.values(se).reduce((x, y) => x + y, 0)
    const earners = Array.from(new Set([...Object.keys(wages), ...Object.keys(se)]))
    const pay = payroll(earners.map((k) => wages[k] || 0), earners.map((k) => se[k] || 0), filing, factor)

    // expenses
    const ex: ExpenseBreakdown = { lifestyle: 0, goal: 0, education: 0, healthcare: 0, housing: 0, other: 0, debtService: 0, insurance: 0, gifting: 0, total: 0 }
    for (const e of model.expenses) {
      const active = e.oneTimeYear !== null ? year === e.oneTimeYear : year >= (e.startYear ?? baseYear) && year <= (e.endYear ?? Infinity)
      if (!active) continue
      let amt = e.annual * grow(expInflation(e), year - baseYear)
      if (survivorMode) {
        if (e.kind === 'lifestyle') amt *= (e.survivorPct ?? a.survivorExpensePct) / 100
        else if (e.survivorPct !== null) amt *= e.survivorPct / 100
      }
      ex[e.kind] += amt
    }
    let liabEnd = 0
    sched.forEach((s) => { const y = s.schedule.years[t]; ex.debtService += y.payment; liabEnd += y.endBalance })
    for (const p of model.insurance) {
      const insured = p.insuredId ? byId.get(p.insuredId) : undefined
      if (year <= Math.min(p.premiumEndYear ?? Infinity, insured ? insured.deathYear : endYear)) ex.insurance += p.premiumAnnual
    }
    if (a.giftingAnnual > 0) ex.gifting = a.giftingAnnual * grow(a.inflationPct, year - baseYear)
    ex.total = ex.lifestyle + ex.goal + ex.education + ex.healthcare + ex.housing + ex.other + ex.debtService + ex.insurance + ex.gifting

    // contributions (flat nominal amounts while working or until contributionEndYear) and RMD rates
    const contrib = new Float64Array(nA), rmdRate = new Float64Array(nA), salePayoff = new Float64Array(nA)
    let contribTotal = 0, preTax = 0
    const sales: number[] = []
    for (let i = 0; i < nA; i++) {
      const x = accounts[i], src = x.synthetic ? null : model.accounts[i]
      if (src && src.contributionAnnual > 0) {
        const owner = byId.get(src.ownerId)
        const end = src.contributionEndYear ?? (owner ? owner.retirementYear : latestRetire) - 1
        if (year >= baseYear && year <= end && !(owner && year > owner.deathYear)) {
          contrib[i] = src.contributionAnnual; contribTotal += contrib[i]
          if (x.type === 'traditional' || x.type === 'hsa') preTax += contrib[i]
        }
      }
      if (x.type === 'traditional') {
        const owner = byId.get(x.ownerId)
        const holder = owner && year <= owner.deathYear ? owner : adults.filter((m) => year <= m.deathYear).sort((p, q) => p.birthYear - q.birthYear)[0]
        if (holder) rmdRate[i] = rmdAmount(year - holder.birthYear, holder.birthYear, 1)
      }
      if (x.saleYear === year && saleOf(i) === year) sales.push(i)
    }
    sched.forEach((s) => { if (s.sec !== undefined && sales.includes(s.sec) && s.schedule.payoffAtStop > 0 && saleOf(s.sec) === year) salePayoff[s.sec] += s.schedule.payoffAtStop })

    years.push({
      year, t, factor, filing, ages, n65, anyAge65: n65 > 0, incomeBase: inc, incomeTotal, ordTaxable, rentalTaxable, ssGross: inc.socialSecurity, payroll: pay,
      preTaxDeduction: Math.min(preTax, earnedTaxable), expenses: ex, contrib, contribTotal, rmdRate, rothConversion: conv.get(year) || 0, sales, salePayoff,
      liabilityEnd: liabEnd, reserve: a.cashReserveTarget * grow(a.inflationPct, year - baseYear),
    })
  }
  if (a.state && !(a.state.toUpperCase() in STATE_TAX_RATES) && a.stateTaxRatePct === null) warn(`Unknown state "${a.state}": state tax assumed 0.`)

  return {
    model, cfg, baseYear, endYear, members, adults, firstDeathYear, retirementYear, accounts, cashIdx, taxableIdx, rothIdx, order,
    liabilities: liabilities.map(({ liability, schedule }) => ({ liability, schedule })), years, warnings, taxYear,
    primaryRetirementYear: primary ? primary.retirementYear : null,
  }
}
