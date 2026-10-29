import { describe, it, expect } from 'vitest'
import { federalIncomeTax, indexFactor, irmaaFlag, ltcgTax, marginalRate, niit, ordinaryTax, payroll, standardDeduction, stateTax, taxableSocialSecurity } from './tax'

describe('indexing', () => {
  it('is 1 up to the table year and compounds after it', () => {
    expect(indexFactor(2026, 3)).toBe(1)
    expect(indexFactor(2025, 3)).toBe(1)
    expect(indexFactor(2036, 3)).toBeCloseTo(1.03 ** 10, 12)
    expect(indexFactor(2036, 3, 2026, false)).toBe(1)
    expect(indexFactor(2031, 3, 2030)).toBeCloseTo(1.03, 12)
  })
  it('standard deduction adds the 65+ amount per taxpayer and scales with the index', () => {
    expect(standardDeduction('mfj', 0)).toBe(32_200)
    expect(standardDeduction('mfj', 2)).toBe(32_200 + 2 * 1_650)
    expect(standardDeduction('single', 1)).toBe(16_100 + 2_050)
    expect(standardDeduction('single', 0, 1.1)).toBeCloseTo(17_710, 6)
  })
})

describe('ordinary income tax', () => {
  it('mfj 267,800 taxable = 49,468', () => {
    // 10% x 24,800 + 12% x 76,000 + 22% x 110,600 + 24% x 56,400 = 2,480 + 9,120 + 24,332 + 13,536
    expect(ordinaryTax(267_800, 'mfj')).toBeCloseTo(49_468, 6)
  })
  it('single 100,000 taxable = 16,712', () => {
    // 10% x 12,400 + 12% x 38,000 + 22% x 49,600 = 1,240 + 4,560 + 10,912
    expect(ordinaryTax(100_000, 'single')).toBeCloseTo(16_712, 6)
  })
  it('is zero for no income, and the top bracket is 37%', () => {
    expect(ordinaryTax(0, 'single')).toBe(0)
    const a = ordinaryTax(1_000_000, 'single'), b = ordinaryTax(1_000_100, 'single')
    expect(b - a).toBeCloseTo(37, 6)
  })
  it('brackets scale with the index factor', () => {
    expect(ordinaryTax(24_800 * 1.1, 'mfj', 1.1)).toBeCloseTo(0.1 * 24_800 * 1.1, 6)
  })
  it('reports the marginal bracket of the next dollar', () => {
    expect(marginalRate(267_800, 'mfj')).toBe(24)
    expect(marginalRate(24_800, 'mfj')).toBe(12) // the next dollar after the 10% bracket tops out
    expect(marginalRate(10_000, 'single')).toBe(10)
    expect(marginalRate(900_000, 'single')).toBe(37)
  })
})

describe('long-term capital gains stacked on ordinary income', () => {
  it('uses the 0% band that ordinary income has not already filled', () => {
    // mfj ordinary 80,000 + gains 50,000: 18,900 of gain under 98,900 is at 0%, 31,100 at 15% = 4,665
    expect(ltcgTax(80_000, 50_000, 'mfj')).toBeCloseTo(4_665, 6)
    expect(ltcgTax(0, 50_000, 'mfj')).toBe(0)
  })
  it('splits a gain that straddles the 15%/20% line', () => {
    // single ordinary 500,000, gain 100,000: 45,500 at 15% (to 545,500) = 6,825, 54,500 at 20% = 10,900
    expect(ltcgTax(500_000, 100_000, 'single')).toBeCloseTo(17_725, 6)
    expect(ltcgTax(600_000, 100_000, 'single')).toBeCloseTo(20_000, 6)
  })
  it('federalIncomeTax combines both and reports the ordinary marginal rate', () => {
    const t = federalIncomeTax(80_000, 50_000, 'mfj')
    expect(t.ordinary).toBeCloseTo(ordinaryTax(80_000, 'mfj'), 9)
    expect(t.ltcg).toBeCloseTo(4_665, 6)
    expect(t.total).toBeCloseTo(t.ordinary + t.ltcg, 9)
    expect(t.marginalRate).toBe(12)
  })
})

describe('taxable Social Security (provisional income formula)', () => {
  it('is zero at or below the base amount', () => {
    expect(taxableSocialSecurity(20_000, 10_000, 'single')).toBe(0) // PI = 20,000
    expect(taxableSocialSecurity(0, 100_000, 'single')).toBe(0)
  })
  it('taxes up to 50% between the base and adjusted base', () => {
    // single, benefits 20,000, other income 20,000: PI = 30,000; 50% x (30,000 - 25,000) = 2,500
    expect(taxableSocialSecurity(20_000, 20_000, 'single')).toBeCloseTo(2_500, 6)
  })
  it('taxes up to 85% above the adjusted base', () => {
    // single, benefits 30,000, other 40,000: PI = 55,000; 85% x (55,000 - 34,000) + 4,500 = 22,350 (cap 25,500)
    expect(taxableSocialSecurity(30_000, 40_000, 'single')).toBeCloseTo(22_350, 6)
    // mfj, benefits 40,000, other 30,000: PI = 50,000; 85% x (50,000 - 44,000) + 6,000 = 11,100
    expect(taxableSocialSecurity(40_000, 30_000, 'mfj')).toBeCloseTo(11_100, 6)
  })
  it('never exceeds 85% of benefits', () => {
    expect(taxableSocialSecurity(30_000, 100_000, 'single')).toBeCloseTo(25_500, 6)
    expect(taxableSocialSecurity(30_000, 1_000_000, 'mfj')).toBeCloseTo(25_500, 6)
  })
})

describe('NIIT, payroll, state, IRMAA', () => {
  it('NIIT is 3.8% of the lesser of NII and MAGI over the threshold', () => {
    expect(niit(50_000, 230_000, 'single')).toBeCloseTo(1_140, 6) // lesser = 30,000
    expect(niit(10_000, 500_000, 'single')).toBeCloseTo(380, 6) // lesser = 10,000
    expect(niit(50_000, 240_000, 'mfj')).toBe(0)
  })
  it('FICA: 7.65% to the wage base, 1.45% above, 0.9% additional Medicare over the threshold', () => {
    expect(payroll([100_000], [], 'single').total).toBeCloseTo(7_650, 6)
    const p = payroll([300_000], [], 'mfj')
    expect(p.socialSecurity).toBeCloseTo(11_439, 6)
    expect(p.medicare).toBeCloseTo(4_350, 6)
    expect(p.additionalMedicare).toBeCloseTo(450, 6)
    expect(p.total).toBeCloseTo(16_239, 6)
  })
  it('the wage base is per earner and indexes', () => {
    expect(payroll([184_500, 184_500], [], 'mfj').socialSecurity).toBeCloseTo(2 * 11_439, 6)
    expect(payroll([300_000], [], 'mfj', 1.1).socialSecurity).toBeCloseTo(0.062 * 184_500 * 1.1, 6)
  })
  it('self-employment pays both halves on 92.35% of net and shares the wage base with wages', () => {
    const p = payroll([], [100_000], 'single')
    // net 92,350: 12.4% = 11,451.40, 2.9% = 2,678.15
    expect(p.selfEmployment).toBeCloseTo(14_129.55, 6)
    expect(p.seDeduction).toBeCloseTo(7_064.775, 6)
    expect(payroll([184_500], [100_000], 'single').selfEmployment).toBeCloseTo(0.029 * 92_350, 6) // wage base already used up
  })
  it('state tax uses the table, the override wins, unknown states are zero', () => {
    expect(stateTax(100_000, 'CA')).toBeCloseTo(9_300, 6)
    expect(stateTax(100_000, 'ca')).toBeCloseTo(9_300, 6)
    expect(stateTax(100_000, 'TX')).toBe(0)
    expect(stateTax(100_000, 'CA', 0)).toBe(0)
    expect(stateTax(100_000, 'XX')).toBe(0)
    expect(stateTax(-5, 'CA')).toBe(0)
  })
  it('IRMAA flag is above the first threshold, indexed', () => {
    expect(irmaaFlag(109_000, 'single')).toBe(false)
    expect(irmaaFlag(109_001, 'single')).toBe(true)
    expect(irmaaFlag(218_001, 'mfj')).toBe(true)
    expect(irmaaFlag(120_000, 'single', 1.2)).toBe(false)
  })
})
