import { describe, it, expect } from 'vitest'
import { newAccount, newExpense, newIncome, newScenario, type CashflowModel } from '../types'
import { monteCarlo } from './monteCarlo'
import { project } from './project'
import { applyScenario, compareScenarios } from './scenario'
import { CFG, sampleModel } from './testModel'

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

describe('applyScenario', () => {
  it('is pure: the input model is untouched and a new object comes back', () => {
    const m = sampleModel(), copy = JSON.stringify(m)
    const out = applyScenario(m, { overrides: { retirementAge: { ann: 60 }, spendingMultiplier: 2, returnPct: 3, addExpenses: [newExpense({ annual: 1 })] } })
    expect(JSON.stringify(m)).toBe(copy)
    expect(out).not.toBe(m)
    expect(out.members[0]).not.toBe(m.members[0])
  })
  it('with no overrides returns an equal copy', () => {
    const m = sampleModel()
    expect(applyScenario(m, { overrides: {} })).toEqual(m)
  })
  it('retirementAge and ssClaimAge are keyed by member id', () => {
    const out = applyScenario(sampleModel(), { overrides: { retirementAge: { ann: 60 }, ssClaimAge: { bo: 70 } } })
    expect(out.members.find((x) => x.id === 'ann')!.retirementAge).toBe(60)
    expect(out.members.find((x) => x.id === 'bo')!.retirementAge).toBe(65)
    expect(out.members.find((x) => x.id === 'bo')!.ssClaimAge).toBe(70)
    expect(out.members.find((x) => x.id === 'ann')!.ssClaimAge).toBe(67)
  })
  it('spendingMultiplier scales lifestyle expenses only', () => {
    const m = sampleModel(); m.expenses.push(newExpense({ id: 'hc', kind: 'healthcare', annual: 10_000 }))
    const out = applyScenario(m, { overrides: { spendingMultiplier: 1.1 } })
    expect(out.expenses.find((e) => e.id === 'life')!.annual).toBeCloseTo(132_000, 6)
    expect(out.expenses.find((e) => e.id === 'hc')!.annual).toBe(10_000)
  })
  it('returnPct, inflationPct, giftingAnnual and the assumptions partial change the assumptions; specific keys win over the partial', () => {
    const out = applyScenario(sampleModel(), { overrides: { returnPct: 4, inflationPct: 2, giftingAnnual: 18_000, assumptions: { returnPct: 9, state: 'CA', cashReserveTarget: 50_000 } } })
    expect(out.assumptions).toMatchObject({ returnPct: 4, inflationPct: 2, giftingAnnual: 18_000, state: 'CA', cashReserveTarget: 50_000 })
  })
  it('rothConversions replace the base list', () => {
    const m = sampleModel(); m.assumptions.rothConversions = [{ year: 2030, amount: 1 }]
    expect(applyScenario(m, { overrides: { rothConversions: [{ year: 2032, amount: 50_000 }] } }).assumptions.rothConversions).toEqual([{ year: 2032, amount: 50_000 }])
  })
  it('addExpenses and addIncome append', () => {
    const out = applyScenario(sampleModel(), { overrides: { addExpenses: [newExpense({ id: 'x', annual: 5 })], addIncome: [newIncome({ id: 'y', annual: 7 })] } })
    expect(out.expenses.map((e) => e.id)).toContain('x')
    expect(out.income.map((e) => e.id)).toContain('y')
    expect(out.expenses).toHaveLength(2); expect(out.income).toHaveLength(2)
  })
  it('sellBusiness sets the sale year, optionally prices the sale, and ends the owner\'s business income', () => {
    const m = sampleModel()
    m.accounts.push(newAccount({ id: 'biz', type: 'business', ownerId: 'ann', balance: 1_000_000, costBasis: 200_000, returnPct: 0 }))
    m.income.push(newIncome({ id: 'bi', kind: 'business', ownerId: 'ann', annual: 100_000, endYear: 2040 }))
    const out = applyScenario(m, { overrides: { sellBusiness: { accountId: 'biz', year: 2029, price: 3_000_000 } } })
    const biz = out.accounts.find((a) => a.id === 'biz')!
    expect(biz.saleYear).toBe(2029)
    expect(biz.balance).toBe(3_000_000) // no growth, so the starting value is the price
    expect(out.income.find((i) => i.id === 'bi')!.endYear).toBe(2028)
    const p = project(out, CFG)
    expect(p.rows.find((r) => r.year === 2029)!.saleProceeds).toBeCloseTo(3_000_000, 6)
    expect(p.rows.find((r) => r.year === 2028)!.income.business).toBeGreaterThan(0)
    expect(p.rows.find((r) => r.year === 2029)!.income.business).toBe(0)
  })
  it('sellBusiness back-solves the starting balance so a growing business is worth `price` in the sale year', () => {
    const m = sampleModel()
    m.accounts.push(newAccount({ id: 'biz', type: 'business', balance: 1, costBasis: 0, returnPct: 5 }))
    const out = applyScenario(m, { overrides: { sellBusiness: { accountId: 'biz', year: 2031, price: 2_000_000 } } })
    expect(out.accounts.find((a) => a.id === 'biz')!.balance).toBeCloseTo(2_000_000 / 1.05 ** 5, 6)
    const p = project(out, CFG)
    expect(p.rows.find((r) => r.year === 2031)!.saleProceeds).toBeCloseTo(2_000_000, 4)
  })
  it('sellBusiness without a price keeps the balance; null or an unknown account changes nothing', () => {
    const m = sampleModel(); m.accounts.push(newAccount({ id: 'biz', type: 'business', balance: 500_000 }))
    expect(applyScenario(m, { overrides: { sellBusiness: { accountId: 'biz', year: 2030 } } }).accounts.find((a) => a.id === 'biz')).toMatchObject({ balance: 500_000, saleYear: 2030 })
    expect(applyScenario(m, { overrides: { sellBusiness: null } })).toEqual(m)
    expect(applyScenario(m, { overrides: { sellBusiness: { accountId: 'nope', year: 2030 } } })).toEqual(m)
  })
})

describe('compareScenarios', () => {
  it('puts the base facts first with id "base" and one entry per stored scenario', () => {
    const m = sampleModel()
    const s1 = newScenario('Retire at 60'); s1.overrides = { retirementAge: { ann: 60 } }
    const s2 = newScenario('Spend 20% more'); s2.overrides = { spendingMultiplier: 1.2 }
    m.scenarios.push(s1, s2)
    const out = compareScenarios(m, CFG)
    expect(out.map((x) => x.id)).toEqual(['base', s1.id, s2.id])
    expect(out[0].name).toBe('Base facts')
    expect(out.every((x) => x.successProbability === null)).toBe(true)
    expect(out[0].projection.rows[0].income.salary).toBe(300_000)
    expect(out[1].projection.rows[0].income.salary).toBe(0) // retiring at 60 means no salary from 2026
    expect(out[2].projection.rows[0].expenses.lifestyle).toBeCloseTo(144_000, 6)
    expect(out[0].projection.netWorthAtEnd).toBeGreaterThan(out[2].projection.netWorthAtEnd)
  })
  it('retiring earlier lowers the Monte Carlo success probability', () => {
    const m = thin()
    const early = newScenario('Retire now'); early.overrides = { retirementAge: { ann: 60 } }
    m.scenarios.push(early)
    const out = compareScenarios(m, CFG, { runs: 500, seed: 1 })
    expect(out[0].successProbability).not.toBeNull()
    expect(out[1].successProbability!).toBeLessThan(out[0].successProbability!)
    expect(out[0].successProbability!).toBeGreaterThan(0.7)
    expect(out[1].successProbability!).toBeLessThan(0.6)
    expect(out[1].projection.netWorthAtEnd).toBeLessThan(out[0].projection.netWorthAtEnd)
  })
  it('retiring earlier flips a funded zero-volatility plan to a failing one', () => {
    const m = thin(); m.assumptions.stdDevPct = 0
    m.expenses[0].annual = 100_000
    const early = applyScenario(m, { overrides: { retirementAge: { ann: 60 } } })
    expect(monteCarlo(m, CFG, { runs: 10 }).successProbability).toBe(1)
    expect(project(early, CFG).depletionYear).toBe(2052)
    expect(monteCarlo(early, CFG, { runs: 10 }).successProbability).toBe(0)
  })
  it('true runs Monte Carlo with default options', () => {
    const m = sampleModel(); m.assumptions.stdDevPct = 0
    const out = compareScenarios(m, CFG, true)
    expect(out[0].successProbability).toBe(1)
  })
})
