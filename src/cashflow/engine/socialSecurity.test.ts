import { describe, it, expect } from 'vitest'
import { annualBenefit, claimingTable, ssBenefitsForYear, ssFactor, type SsPerson } from './socialSecurity'

describe('claiming age factor', () => {
  it('FRA 67: claim at 62 pays 70% of PIA', () => {
    // 60 months early: first 36 x 5/9% = 20%, next 24 x 5/12% = 10%  =>  30% reduction
    expect(ssFactor(62, 67)).toBeCloseTo(0.70, 12)
  })
  it('FRA 67: claim at 70 pays 124% of PIA', () => {
    expect(ssFactor(70, 67)).toBeCloseTo(1.24, 12) // 36 months x 2/3% = 24%
  })
  it('is 100% at full retirement age and interpolates monthly', () => {
    expect(ssFactor(67, 67)).toBe(1)
    expect(ssFactor(64, 67)).toBeCloseTo(0.80, 12) // 36 months x 5/9% = 20% off
    expect(ssFactor(65, 67)).toBeCloseTo(1 - (24 * 5 / 9) / 100, 12)
    expect(ssFactor(68, 67)).toBeCloseTo(1.08, 12)
    expect(ssFactor(66.5, 67)).toBeCloseTo(1 - (6 * 5 / 9) / 100, 12)
  })
  it('works for other full retirement ages and clamps to 62..70', () => {
    expect(ssFactor(62, 66)).toBeCloseTo(0.75, 12) // 48 months early: 20% + 12 x 5/12% = 25%
    expect(ssFactor(70, 66)).toBeCloseTo(1.32, 12)
    expect(ssFactor(60, 67)).toBeCloseTo(0.70, 12)
    expect(ssFactor(72, 67)).toBeCloseTo(1.24, 12)
  })
})

describe('annual benefit and claiming table', () => {
  const m = { ssPiaMonthly: 3_000, ssFra: 67, ssClaimAge: 70 }
  it('annualBenefit is 12 x PIA x factor at the member\'s own claim age', () => {
    expect(annualBenefit(m)).toBeCloseTo(3_000 * 12 * 1.24, 6)
    expect(annualBenefit(m, 62)).toBeCloseTo(3_000 * 12 * 0.70, 6)
    expect(annualBenefit({ ...m, ssPiaMonthly: 0 })).toBe(0)
  })
  it('claimingTable lists ages 62..70 with rising benefits', () => {
    const t = claimingTable(m)
    expect(t.map((r) => r.claimAge)).toEqual([62, 63, 64, 65, 66, 67, 68, 69, 70])
    expect(t[0].annual).toBeCloseTo(25_200, 6)
    expect(t[5].annual).toBeCloseTo(36_000, 6)
    expect(t[8].annual).toBeCloseTo(44_640, 6)
    expect(t[5].monthly).toBeCloseTo(3_000, 6)
    t.forEach((r, i) => { if (i) expect(r.annual).toBeGreaterThan(t[i - 1].annual) })
  })
})

describe('household benefits by year', () => {
  const people: SsPerson[] = [
    { id: 'a', birthYear: 1960, deathYear: 2050, annualBase: 36_000, claimAge: 67, eligibleForSurvivor: true },
    { id: 'b', birthYear: 1962, deathYear: 2060, annualBase: 12_000, claimAge: 67, eligibleForSurvivor: true },
  ]
  it('pays from the claim-age year with COLA from the base year', () => {
    expect(ssBenefitsForYear(people, 2026, 2026, 2.5).a).toBe(0) // a is 66
    expect(ssBenefitsForYear(people, 2027, 2026, 2.5).a).toBeCloseTo(36_000 * 1.025, 6)
    expect(ssBenefitsForYear(people, 2029, 2026, 2.5).b).toBeCloseTo(12_000 * 1.025 ** 3, 6)
  })
  it('stops after death and the survivor takes the larger of the two benefits', () => {
    const y = ssBenefitsForYear(people, 2051, 2026, 2)
    expect(y.a).toBe(0)
    expect(y.b).toBeCloseTo(36_000 * 1.02 ** 25, 6)
    expect(ssBenefitsForYear(people, 2050, 2026, 2).b).toBeCloseTo(12_000 * 1.02 ** 24, 6) // death year: both still paid
  })
  it('the survivor keeps their own benefit when it is larger', () => {
    const swapped = people.map((p) => ({ ...p, annualBase: p.id === 'a' ? 12_000 : 36_000 }))
    expect(ssBenefitsForYear(swapped, 2051, 2026, 0).b).toBe(36_000)
  })
})
