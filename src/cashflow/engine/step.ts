// One projection year: the only place where balances, taxes and withdrawals interact. project() calls it once per year with
// the expected returns; monteCarlo() calls it with a random returns vector. All flows are explained in project.ts.
import { federalIncomeTax, niit, stateTax, standardDeduction, taxableSocialSecurity, irmaaFlag } from './tax'
import type { PlanContext, PlanYear } from './plan'

export interface StepState { bal: Float64Array; basis: Float64Array }
export interface StepResult {
  rmd: number
  conversion: number
  saleProceeds: number
  saleGain: number
  realizedGains: number
  cash: number; taxable: number; traditional: number; roth: number; hsa: number; withdrawn: number // drawn this year by account type
  federalIncome: number; federalLtcg: number; niit: number; state: number; payroll: number; totalTax: number
  agi: number; taxableIncome: number; marginalRate: number; ssTaxable: number; irmaa: boolean
  surplus: number
  shortfall: number
  liquid: number
  netWorth: number
  take: Float64Array // per-account withdrawal this year
}

export function newStepResult(nAccounts: number): StepResult {
  return {
    rmd: 0, conversion: 0, saleProceeds: 0, saleGain: 0, realizedGains: 0, cash: 0, taxable: 0, traditional: 0, roth: 0, hsa: 0, withdrawn: 0,
    federalIncome: 0, federalLtcg: 0, niit: 0, state: 0, payroll: 0, totalTax: 0, agi: 0, taxableIncome: 0, marginalRate: 0, ssTaxable: 0, irmaa: false,
    surplus: 0, shortfall: 0, liquid: 0, netWorth: 0, take: new Float64Array(nAccounts),
  }
}

export function initialState(ctx: PlanContext): StepState {
  const n = ctx.accounts.length
  const bal = new Float64Array(n), basis = new Float64Array(n)
  ctx.accounts.forEach((x, i) => { bal[i] = x.balance; basis[i] = x.basis })
  return { bal, basis }
}

const MAX_ITERATIONS = 8
const FUNDED_TOLERANCE = 0.5 // dollars of unfunded spending treated as funded
const CONVERGED = 0.01 // dollars: the tax/withdrawal loop stops when withdrawals move less than this

interface TaxScratch { fed: number; ltcg: number; niit: number; state: number; total: number; agi: number; taxable: number; marginal: number; ssTaxable: number }
function computeTax(ctx: PlanContext, py: PlanYear, ordBase: number, tradW: number, ltcg: number, o: TaxScratch): void {
  const a = ctx.model.assumptions
  const ordNoSs = Math.max(0, ordBase + tradW)
  // Gains and other income count toward provisional income; the taxable part of benefits is then stacked into ordinary income.
  const ssTaxable = taxableSocialSecurity(py.ssGross, ordNoSs + ltcg, py.filing)
  const ordIncome = ordNoSs + ssTaxable
  const agi = ordIncome + ltcg
  const ded = standardDeduction(py.filing, py.n65, py.factor)
  const ordTaxable = Math.max(0, ordIncome - ded)
  const ltcgTaxable = Math.max(0, ltcg - Math.max(0, ded - ordIncome)) // unused deduction shelters gains
  const f = federalIncomeTax(ordTaxable, ltcgTaxable, py.filing, py.factor)
  o.fed = f.ordinary; o.ltcg = f.ltcg
  o.niit = niit(ltcg + py.rentalTaxable, agi, py.filing)
  o.state = stateTax(agi - ssTaxable, a.state, a.stateTaxRatePct)
  o.total = o.fed + o.ltcg + o.niit + o.state + py.payroll.total
  o.agi = agi; o.taxable = ordTaxable + ltcgTaxable; o.marginal = ordTaxable > 0 ? f.marginalRate : 0; o.ssTaxable = ssTaxable
}

/** Draw `remaining` from accounts of one type pro rata to what is left in them, up to `cap`. Returns the amount drawn. */
function drawType(ctx: PlanContext, bal: Float64Array, take: Float64Array, type: string, remaining: number, cap: number): number {
  const A = ctx.accounts
  let avail = 0
  for (let i = 0; i < A.length; i++) if (A[i].type === type && !A[i].illiquid) avail += bal[i] - take[i]
  const amt = Math.min(remaining, avail, cap)
  if (amt <= 0) return 0
  const f = amt / avail
  for (let i = 0; i < A.length; i++) if (A[i].type === type && !A[i].illiquid) take[i] += (bal[i] - take[i]) * f
  return amt
}

/** Fill `take` with the withdrawals that cover `gap` in the configured order (cash above the reserve first, reserve last). Returns the unfunded amount. */
function planWithdrawals(ctx: PlanContext, st: StepState, gap: number, reserve: number, take: Float64Array, sums: { trad: number; gain: number }): number {
  take.fill(0)
  sums.trad = 0; sums.gain = 0
  if (gap <= 0) return 0
  const A = ctx.accounts, { bal, basis } = st
  let remaining = gap
  let cash = 0
  for (let i = 0; i < A.length; i++) if (A[i].type === 'cash' && !A[i].illiquid) cash += bal[i]
  for (const type of ctx.order) {
    if (remaining <= 0) break
    remaining -= drawType(ctx, bal, take, type, remaining, type === 'cash' ? Math.max(0, cash - reserve) : Infinity)
  }
  if (remaining > 0) remaining -= drawType(ctx, bal, take, 'cash', remaining, Infinity) // nothing else left: dip into the reserve
  for (let i = 0; i < A.length; i++) {
    if (take[i] <= 0) continue
    if (A[i].type === 'traditional') sums.trad += take[i]
    else if (A[i].type === 'taxable' && bal[i] > 0) sums.gain += take[i] * Math.max(0, 1 - basis[i] / bal[i])
  }
  return remaining
}

export function stepYear(ctx: PlanContext, py: PlanYear, st: StepState, returns: ArrayLike<number>, r: StepResult): void {
  const A = ctx.accounts, n = A.length, { bal, basis } = st
  const taxScratch: TaxScratch = { fed: 0, ltcg: 0, niit: 0, state: 0, total: 0, agi: 0, taxable: 0, marginal: 0, ssTaxable: 0 }
  const sums = { trad: 0, gain: 0 }

  // 1. Required minimum distributions come out of tax-deferred balances first (prior year-end balance = current balance).
  let rmd = 0
  for (let i = 0; i < n; i++) {
    const rate = py.rmdRate[i]
    if (rate > 0 && bal[i] > 0) { const x = bal[i] * rate; bal[i] -= x; rmd += x }
  }
  // 2. Roth conversion: traditional -> Roth, taxed as ordinary income this year (limited to what is left after the RMD).
  let conv = 0
  if (py.rothConversion > 0 && ctx.rothIdx >= 0) {
    let avail = 0
    for (let i = 0; i < n; i++) if (A[i].type === 'traditional') avail += bal[i]
    conv = Math.min(py.rothConversion, avail)
    if (conv > 0) {
      const f = conv / avail
      for (let i = 0; i < n; i++) if (A[i].type === 'traditional') { const x = bal[i] * f; bal[i] -= x; bal[ctx.rothIdx] += x }
    }
  }
  // 3. Sales of real estate / businesses at the start of the year: net of selling costs and secured debt, to cash; gain over basis is LTCG.
  let saleProceeds = 0, saleGain = 0, extraOut = 0
  for (const i of py.sales) {
    const value = bal[i]
    if (value <= 0) continue
    const net = value * (1 - A[i].saleCostPct / 100)
    const proceeds = net - py.salePayoff[i]
    saleGain += Math.max(0, net - basis[i])
    saleProceeds += proceeds
    bal[i] = 0
    if (proceeds >= 0) bal[ctx.cashIdx] += proceeds
    else extraOut -= proceeds
  }

  // 4. Taxes depend on withdrawals and withdrawals depend on taxes: fixed-point loop (taxes rise monotonically with draws, so it converges).
  const ordBase = py.ordTaxable - py.payroll.seDeduction - py.preTaxDeduction + rmd + conv
  const cashIn = py.incomeTotal + rmd
  const outBase = py.expenses.total + py.contribTotal + extraOut
  let tradW = 0, gainW = 0, unfunded = 0, gap = 0
  for (let k = 0; k < MAX_ITERATIONS; k++) {
    computeTax(ctx, py, ordBase, tradW, gainW + saleGain, taxScratch)
    gap = outBase + taxScratch.total - cashIn
    unfunded = planWithdrawals(ctx, st, gap, py.reserve, r.take, sums)
    const moved = Math.abs(sums.trad - tradW) + Math.abs(sums.gain - gainW)
    tradW = sums.trad; gainW = sums.gain
    if (moved < CONVERGED) break
  }

  // 5. Apply withdrawals.
  r.cash = 0; r.taxable = 0; r.traditional = 0; r.roth = 0; r.hsa = 0
  for (let i = 0; i < n; i++) {
    const x = r.take[i]
    if (x <= 0) continue
    if (A[i].type === 'taxable' && bal[i] > 0) basis[i] -= basis[i] * x / bal[i]
    bal[i] -= x
    if (A[i].type === 'cash') r.cash += x
    else if (A[i].type === 'taxable') r.taxable += x
    else if (A[i].type === 'traditional') r.traditional += x
    else if (A[i].type === 'roth') r.roth += x
    else if (A[i].type === 'hsa') r.hsa += x
  }
  r.withdrawn = r.cash + r.taxable + r.traditional + r.roth + r.hsa

  // 6. Growth on what is left, then year-end deposits (contributions, reinvested surplus) which earn nothing until next year.
  for (let i = 0; i < n; i++) bal[i] *= 1 + returns[i]
  for (let i = 0; i < n; i++) {
    const c = py.contrib[i]
    if (c > 0) { bal[i] += c; if (A[i].type === 'taxable') basis[i] += c }
  }
  const surplus = gap < 0 ? -gap : 0
  if (surplus > 0) {
    const toCash = Math.min(surplus, Math.max(0, 0.5 * py.expenses.total - bal[ctx.cashIdx]))
    bal[ctx.cashIdx] += toCash
    bal[ctx.taxableIdx] += surplus - toCash
    basis[ctx.taxableIdx] += surplus - toCash
  }

  // 7. Report.
  r.rmd = rmd; r.conversion = conv; r.saleProceeds = saleProceeds; r.saleGain = saleGain; r.realizedGains = gainW + saleGain
  r.federalIncome = taxScratch.fed; r.federalLtcg = taxScratch.ltcg; r.niit = taxScratch.niit; r.state = taxScratch.state; r.payroll = py.payroll.total
  r.totalTax = taxScratch.total; r.agi = taxScratch.agi; r.taxableIncome = taxScratch.taxable; r.marginalRate = taxScratch.marginal; r.ssTaxable = taxScratch.ssTaxable
  r.irmaa = py.anyAge65 && irmaaFlag(taxScratch.agi, py.filing, py.factor)
  r.surplus = surplus
  r.shortfall = unfunded > FUNDED_TOLERANCE ? unfunded : 0
  let liquid = 0, all = 0
  for (let i = 0; i < n; i++) { all += bal[i]; if (A[i].type !== 'realEstate' && A[i].type !== 'business') liquid += bal[i] }
  r.liquid = liquid
  r.netWorth = all - py.liabilityEnd
}
