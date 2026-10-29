import { describe, it, expect } from 'vitest'
import { newAccount, newExpense, newIncome, newLiability, newMember, emptyModel, type CashflowModel } from '../types'
import { monteCarlo, mulberry32, normal } from './monteCarlo'
import { project } from './project'
import { CFG, sampleModel } from './testModel'

/** Thinner plan than the sample: success is not a foregone conclusion. */
function thin(): CashflowModel {
  const m = sampleModel()
  m.accounts = [
    newAccount({ id: 'ira', type: 'traditional', ownerId: 'ann', balance: 1_000_000 }),
    newAccount({ id: 'chk', type: 'cash', balance: 100_000 }),
    newAccount({ id: 'brk', type: 'taxable', balance: 300_000, costBasis: 200_000 }),
  ]
  m.income = [newIncome({ id: 'sal', kind: 'salary', ownerId: 'ann', annual: 150_000 })]
  m.expenses[0].annual = 90_000
  m.members[0].ssPiaMonthly = 3_000; m.members[1].ssPiaMonthly = 1_500
  return m
}

describe('random number generation', () => {
  it('mulberry32 is reproducible and uniform', () => {
    const a = mulberry32(42), b = mulberry32(42)
    const xs = Array.from({ length: 5 }, () => a()), ys = Array.from({ length: 5 }, () => b())
    expect(xs).toEqual(ys)
    expect(mulberry32(43)()).not.toBe(xs[0])
    const r = mulberry32(7); let sum = 0
    for (let i = 0; i < 100_000; i++) { const x = r(); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); sum += x }
    expect(sum / 100_000).toBeCloseTo(0.5, 2)
  })
  it('Box-Muller draws are standard normal', () => {
    const r = mulberry32(11); const n = 100_000; let s = 0, s2 = 0
    for (let i = 0; i < n; i++) { const z = normal(r); s += z; s2 += z * z }
    expect(s / n).toBeCloseTo(0, 1)
    expect(s2 / n - (s / n) ** 2).toBeCloseTo(1, 1)
  })
})

describe('reproducibility', () => {
  it('the same seed gives an identical result; another seed does not', () => {
    const m = thin()
    const a = monteCarlo(m, CFG, { runs: 300, seed: 5 }), b = monteCarlo(m, CFG, { runs: 300, seed: 5 }), c = monteCarlo(m, CFG, { runs: 300, seed: 6 })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c))
  })
  it('defaults to 1,000 runs and does not mutate the model', () => {
    const m = thin(), copy = JSON.stringify(m)
    expect(monteCarlo(m, CFG).runs).toBe(1000)
    expect(JSON.stringify(m)).toBe(copy)
  })
})

describe('zero volatility equals the deterministic projection', () => {
  it('a funded plan has success probability 1 and flat bands equal to the projection', () => {
    const m = sampleModel(); m.assumptions.stdDevPct = 0
    const p = project(m, CFG)
    const mc = monteCarlo(m, CFG, { runs: 50, seed: 3 })
    expect(mc.successProbability).toBe(1)
    expect(mc.failureYearMedian).toBeNull()
    expect(mc.bands).toHaveLength(p.rows.length)
    mc.bands.forEach((b, i) => {
      expect(b.year).toBe(p.rows[i].year)
      expect(b.p10).toBeCloseTo(p.rows[i].liquidAssets, 4)
      expect(b.p50).toBeCloseTo(p.rows[i].liquidAssets, 4)
      expect(b.p90).toBeCloseTo(p.rows[i].liquidAssets, 4)
    })
    expect(mc.medianEndingLiquid).toBeCloseTo(p.rows[p.rows.length - 1].liquidAssets, 4)
  })
  it('an underfunded plan has success probability 0 and fails in the projection\'s depletion year', () => {
    const m = emptyModel(2026)
    m.members.push(newMember('primary', { id: 'a', dob: '1966-01-01', lifeExpectancy: 90, retirementAge: 60 }))
    m.expenses.push(newExpense({ kind: 'lifestyle', annual: 100_000 }))
    m.accounts.push(newAccount({ type: 'cash', balance: 250_000 }))
    Object.assign(m.assumptions, { stdDevPct: 0, inflationPct: 0, returnPct: 0 })
    const p = project(m, CFG)
    const mc = monteCarlo(m, CFG, { runs: 20 })
    expect(p.depletionYear).toBe(2028)
    expect(mc.successProbability).toBe(0)
    expect(mc.failureYearMedian).toBe(2028)
  })
  it('opts.stdDevPct = 0 also removes the randomness', () => {
    const m = thin()
    const mc = monteCarlo(m, CFG, { runs: 20, stdDevPct: 0 })
    expect(mc.bands.every((b) => Math.abs(b.p10 - b.p90) < 1e-6)).toBe(true)
  })
})

describe('behaviour with volatility', () => {
  it('bands are ordered and a higher mean return raises the success probability', () => {
    const m = thin()
    const lo = monteCarlo(m, CFG, { runs: 500, seed: 9, meanReturnPct: 4 }), hi = monteCarlo(m, CFG, { runs: 500, seed: 9, meanReturnPct: 8 })
    for (const b of hi.bands) { expect(b.p10).toBeLessThanOrEqual(b.p25); expect(b.p25).toBeLessThanOrEqual(b.p50); expect(b.p50).toBeLessThanOrEqual(b.p75); expect(b.p75).toBeLessThanOrEqual(b.p90) }
    expect(hi.successProbability).toBeGreaterThan(lo.successProbability)
    expect(hi.successProbability).toBeGreaterThan(0); expect(lo.successProbability).toBeLessThan(1)
    expect(hi.medianEndingLiquid).toBeGreaterThan(lo.medianEndingLiquid)
    expect(hi.p10EndingLiquid).toBeLessThanOrEqual(hi.medianEndingLiquid)
  })
  it('more volatility widens the spread of outcomes', () => {
    const m = thin()
    const calm = monteCarlo(m, CFG, { runs: 500, seed: 2, stdDevPct: 4 }), wild = monteCarlo(m, CFG, { runs: 500, seed: 2, stdDevPct: 20 })
    const spread = (r: typeof calm) => r.bands[10].p90 - r.bands[10].p10
    expect(spread(wild)).toBeGreaterThan(spread(calm))
  })
  it('an account stdDevPct of its own overrides the default volatility', () => {
    const m = thin(); m.assumptions.stdDevPct = 25
    for (const a of m.accounts) a.stdDevPct = 0
    const mc = monteCarlo(m, CFG, { runs: 30 })
    expect(mc.bands.every((b) => Math.abs(b.p10 - b.p90) < 1e-6)).toBe(true)
  })
  it('failures are reported with a median year inside the plan', () => {
    const mc = monteCarlo(thin(), CFG, { runs: 400, seed: 4 })
    expect(mc.successProbability).toBeLessThan(1)
    expect(mc.failureYearMedian).not.toBeNull()
    expect(mc.failureYearMedian!).toBeGreaterThanOrEqual(2026)
    expect(mc.failureYearMedian!).toBeLessThanOrEqual(2058)
  })
})

describe('performance', () => {
  it('1,000 runs of a 40+ year plan with SS, a mortgage, a sale and conversions finish in under 3 seconds', () => {
    const m = emptyModel(2026)
    m.members.push(newMember('primary', { id: 'a', name: 'A', dob: '1976-05-01', retirementAge: 62, lifeExpectancy: 90, ssPiaMonthly: 3_500, ssClaimAge: 67 }), newMember('spouse', { id: 'b', name: 'B', dob: '1978-05-01', retirementAge: 62, lifeExpectancy: 92, ssPiaMonthly: 2_000, ssClaimAge: 67 }))
    m.income.push(newIncome({ kind: 'salary', ownerId: 'a', annual: 250_000 }), newIncome({ kind: 'salary', ownerId: 'b', annual: 120_000 }), newIncome({ kind: 'rental', ownerId: 'joint', annual: 24_000 }))
    m.expenses.push(newExpense({ kind: 'lifestyle', annual: 160_000 }), newExpense({ kind: 'healthcare', annual: 15_000 }), newExpense({ kind: 'education', annual: 50_000, startYear: 2030, endYear: 2037 }))
    m.accounts.push(
      newAccount({ id: 'ira', type: 'traditional', ownerId: 'a', balance: 1_500_000, contributionAnnual: 23_000 }), newAccount({ id: 'roth', type: 'roth', ownerId: 'b', balance: 400_000, contributionAnnual: 7_000 }),
      newAccount({ id: 'brk', type: 'taxable', balance: 1_200_000, costBasis: 700_000 }), newAccount({ id: 'chk', type: 'cash', balance: 150_000 }), newAccount({ id: 'hsa', type: 'hsa', balance: 60_000 }),
      newAccount({ id: 'home', type: 'realEstate', balance: 1_500_000, costBasis: 600_000, saleYear: 2060, saleCostPct: 6 }), newAccount({ id: 'biz', type: 'business', balance: 2_000_000, costBasis: 300_000, saleYear: 2040, saleCostPct: 3 }),
    )
    m.liabilities.push(newLiability({ balance: 400_000, ratePct: 4.5, termMonths: 300, securedById: 'home' }))
    Object.assign(m.assumptions, { state: 'CA', rothConversions: [{ year: 2040, amount: 80_000 }, { year: 2041, amount: 80_000 }] })
    const p = project(m, CFG)
    expect(p.rows.length).toBeGreaterThanOrEqual(43)
    const t0 = performance.now()
    const mc = monteCarlo(m, CFG, { runs: 1000, seed: 1 })
    const ms = performance.now() - t0
    console.info(`Monte Carlo: 1000 runs x ${p.rows.length} years in ${ms.toFixed(0)} ms (success ${mc.successProbability})`)
    expect(mc.runs).toBe(1000)
    expect(ms).toBeLessThan(3000)
  })
})
