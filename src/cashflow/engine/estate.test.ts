import { describe, it, expect } from 'vitest'
import { emptyModel, newAccount, newLiability, newMember, newPolicy, type CashflowModel } from '../types'
import { estateSnapshots } from './estate'
import { project } from './project'
import { CFG } from './testModel'
import type { EngineConfig } from './types'

const FLAT: EngineConfig = { ...CFG, indexTables: false }

/** Everything frozen: 0% return and 0% inflation, no spending, so account values stay exactly as entered. */
function frozen(): CashflowModel {
  const m = emptyModel(2026)
  Object.assign(m.assumptions, { inflationPct: 0, returnPct: 0, salaryGrowthPct: 0, stateTaxRatePct: 0 })
  return m
}
const snap = (m: CashflowModel, cfg: EngineConfig = FLAT) => estateSnapshots(m, project(m, cfg), cfg)

describe('single decedent', () => {
  const m = frozen()
  m.assumptions.filingStatus = 'single'
  m.members.push(newMember('primary', { id: 'a', name: 'Ann', dob: '1966-01-01', lifeExpectancy: 70 })) // dies 2036
  m.accounts.push(newAccount({ id: 'brk', type: 'taxable', ownerId: 'a', balance: 40_000_000, costBasis: 40_000_000, returnPct: 0 }))
  it('taxes (40M - 15M) at 40% = 10M', () => {
    const [s] = snap(m)
    expect(s.year).toBe(2036)
    expect(s.deceasedId).toBe('a'); expect(s.deceasedName).toBe('Ann')
    expect(s.grossEstate).toBeCloseTo(40_000_000, 4)
    expect(s.maritalDeduction).toBe(0)
    expect(s.taxableEstate).toBeCloseTo(40_000_000, 4)
    expect(s.exemptionAvailable).toBe(15_000_000)
    expect(s.exemptionUsed).toBe(15_000_000)
    expect(s.federalEstateTax).toBeCloseTo(10_000_000, 4) // (40M - 15M) x 40%
    expect(s.netToHeirs).toBeCloseTo(30_000_000, 4)
  })
  it('no tax below the exemption', () => {
    const small = JSON.parse(JSON.stringify(m)) as CashflowModel
    small.accounts[0].balance = 10_000_000; small.accounts[0].costBasis = 10_000_000
    const [s] = snap(small)
    expect(s.federalEstateTax).toBe(0)
    expect(s.exemptionUsed).toBeCloseTo(10_000_000, 4)
    expect(s.netToHeirs).toBeCloseTo(10_000_000, 4)
  })
  it('subtracts liabilities and includes insurance only when it is in the estate', () => {
    const q = JSON.parse(JSON.stringify(m)) as CashflowModel
    q.liabilities.push(newLiability({ id: 'l', balance: 5_000_000, ratePct: 0, paymentMonthly: 0, termMonths: 0 }))
    q.insurance.push(newPolicy({ id: 'p1', insuredId: 'a', deathBenefit: 3_000_000, inEstate: true, kind: 'whole' }), newPolicy({ id: 'p2', insuredId: 'a', deathBenefit: 4_000_000, inEstate: false, kind: 'whole' }))
    const [s] = snap(q)
    expect(s.insuranceInEstate).toBe(3_000_000)
    expect(s.grossEstate).toBeCloseTo(43_000_000, 4)
    expect(s.liabilities).toBeCloseTo(5_000_000, 4)
    expect(s.taxableEstate).toBeCloseTo(38_000_000, 4)
    expect(s.federalEstateTax).toBeCloseTo(0.4 * (38_000_000 - 15_000_000), 4)
  })
  it('indexes the exemption by inflation from the tax year to the year of death', () => {
    const q = JSON.parse(JSON.stringify(m)) as CashflowModel
    q.assumptions.inflationPct = 3
    const idx = { ...CFG } // indexTables default true: 2036 is ten years after 2026
    const [s] = snap(q, idx)
    expect(s.exemptionAvailable).toBeCloseTo(15_000_000 * 1.03 ** 10, 4)
    expect(s.federalEstateTax).toBeGreaterThan(0)
  })
  it('life insurance on a term policy that has lapsed is not counted', () => {
    const q = JSON.parse(JSON.stringify(m)) as CashflowModel
    q.insurance.push(newPolicy({ insuredId: 'a', deathBenefit: 2_000_000, kind: 'term', premiumEndYear: 2030 }))
    expect(snap(q)[0].insuranceInEstate).toBe(0)
  })
})

describe('married couple', () => {
  const couple = (): CashflowModel => {
    const m = frozen()
    m.members.push(newMember('primary', { id: 'a', name: 'Ann', dob: '1966-01-01', lifeExpectancy: 80 }), newMember('spouse', { id: 'b', name: 'Bo', dob: '1968-01-01', lifeExpectancy: 90 })) // 2046 and 2058
    m.accounts.push(newAccount({ id: 'joint', type: 'taxable', ownerId: 'joint', balance: 30_000_000, costBasis: 30_000_000, returnPct: 0 }), // Roth and taxable (no RMDs) so balances stay exactly as entered
      newAccount({ id: 'hers', type: 'roth', ownerId: 'a', balance: 6_000_000, returnPct: 0 }), newAccount({ id: 'his', type: 'taxable', ownerId: 'b', balance: 4_000_000, costBasis: 4_000_000, returnPct: 0 }))
    return m
  }
  it('gives one snapshot per death, in order', () => {
    const s = snap(couple())
    expect(s.map((x) => [x.year, x.deceasedId])).toEqual([[2046, 'a'], [2058, 'b']])
  })
  it('first death: joint 50/50 plus own accounts all pass to the spouse free of tax', () => {
    const [first] = snap(couple())
    expect(first.grossEstate).toBeCloseTo(15_000_000 + 6_000_000, 4) // half the joint account + her IRA
    expect(first.maritalDeduction).toBeCloseTo(21_000_000, 4)
    expect(first.taxableEstate).toBeCloseTo(0, 6)
    expect(first.federalEstateTax).toBe(0)
    expect(first.exemptionUsed).toBe(0)
  })
  it('second death: the whole estate is taxed against own exemption plus the ported exemption', () => {
    const [, second] = snap(couple())
    expect(second.grossEstate).toBeCloseTo(40_000_000, 4)
    expect(second.maritalDeduction).toBe(0)
    expect(second.exemptionAvailable).toBe(30_000_000) // 15M own + 15M DSUE
    expect(second.federalEstateTax).toBeCloseTo(0.4 * (40_000_000 - 30_000_000), 4)
    expect(second.netToHeirs).toBeCloseTo(36_000_000, 4)
  })
  it('without portability only the survivor\'s own exemption applies', () => {
    const [, second] = snap(couple(), { ...FLAT, portability: false })
    expect(second.exemptionAvailable).toBe(15_000_000)
    expect(second.federalEstateTax).toBeCloseTo(0.4 * (40_000_000 - 15_000_000), 4)
  })
  it('insurance on the first decedent is in that estate but passes tax-free; liabilities follow the secured asset', () => {
    const m = couple()
    m.insurance.push(newPolicy({ insuredId: 'a', deathBenefit: 2_000_000, inEstate: true, kind: 'whole' }))
    m.liabilities.push(newLiability({ balance: 1_000_000, ratePct: 0, securedById: 'his' }))
    const [first, second] = snap(m)
    expect(first.insuranceInEstate).toBe(2_000_000)
    expect(first.grossEstate).toBeCloseTo(23_000_000, 4)
    expect(first.liabilities).toBe(0) // the debt is secured by his account
    expect(first.federalEstateTax).toBe(0)
    expect(second.insuranceInEstate).toBe(0)
    expect(second.liabilities).toBeCloseTo(1_000_000, 4)
  })
  it('ignores dependents and returns nothing for an empty model', () => {
    const m = couple(); m.members.push(newMember('dependent', { id: 'kid', dob: '2010-01-01', lifeExpectancy: 85 }))
    expect(snap(m)).toHaveLength(2)
    expect(snap(emptyModel(2026))).toEqual([])
  })
})
