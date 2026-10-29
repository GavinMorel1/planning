import { describe, it, expect } from 'vitest'
import { ADDITIONAL_DEDUCTION_65, IRMAA_FIRST_THRESHOLD, LTCG_THRESHOLDS, NIIT_THRESHOLD, ORDINARY_BRACKETS, PAYROLL, SS_TAXATION, STANDARD_DEDUCTION, STATE_TAX_RATES, UNIFORM_LIFETIME_DIVISORS } from './taxTables'

describe('tax tables (structure and spec values; amounts must be re-verified by the tax team each year)', () => {
  it('has ascending brackets ending in 37% for every filing status', () => {
    for (const status of ['single', 'mfj', 'mfs', 'hoh'] as const) {
      const br = ORDINARY_BRACKETS[status]
      expect(br.map((b) => b.rate)).toEqual([0.10, 0.12, 0.22, 0.24, 0.32, 0.35, 0.37])
      br.forEach((b, i) => { if (i) expect(b.upTo).toBeGreaterThan(br[i - 1].upTo) })
      expect(br[br.length - 1].upTo).toBe(Infinity)
    }
  })
  it('mfj brackets are double single up to the 32% bracket; mfs is half of mfj', () => {
    for (let i = 0; i < 5; i++) expect(ORDINARY_BRACKETS.mfj[i].upTo).toBe(2 * ORDINARY_BRACKETS.single[i].upTo)
    expect(ORDINARY_BRACKETS.mfs[5].upTo).toBe(ORDINARY_BRACKETS.mfj[5].upTo / 2)
  })
  it('standard deductions and age-65 add-ons match the 2026 figures given by the team', () => {
    expect(STANDARD_DEDUCTION).toEqual({ single: 16_100, mfj: 32_200, hoh: 24_150, mfs: 16_100 })
    expect(ADDITIONAL_DEDUCTION_65.single).toBe(2_050)
    expect(ADDITIONAL_DEDUCTION_65.mfj).toBe(1_650)
  })
  it('keeps the non-indexed thresholds as statutory constants', () => {
    expect(NIIT_THRESHOLD.single).toBe(200_000); expect(NIIT_THRESHOLD.mfj).toBe(250_000)
    expect(SS_TAXATION.single).toEqual({ base: 25_000, adjusted: 34_000 })
    expect(SS_TAXATION.mfj).toEqual({ base: 32_000, adjusted: 44_000 })
    expect(PAYROLL.additionalMedicareThreshold.mfj).toBe(250_000)
    expect(IRMAA_FIRST_THRESHOLD.mfj).toBe(2 * IRMAA_FIRST_THRESHOLD.single)
  })
  it('has 0% < 15% LTCG ceilings in order', () => {
    for (const s of ['single', 'mfj', 'mfs', 'hoh'] as const) expect(LTCG_THRESHOLDS[s].fifteenTop).toBeGreaterThan(LTCG_THRESHOLDS[s].zeroTop)
  })
  it('state table: no-tax states are zero, all 50 states plus DC present', () => {
    for (const s of ['TX', 'FL', 'WA', 'NV', 'TN', 'WY', 'SD', 'AK', 'NH']) expect(STATE_TAX_RATES[s]).toBe(0)
    expect(Object.keys(STATE_TAX_RATES)).toHaveLength(51)
    expect(STATE_TAX_RATES.CA).toBeGreaterThan(8)
  })
  it('Uniform Lifetime Table covers 72..120 and strictly decreases', () => {
    const ages = Object.keys(UNIFORM_LIFETIME_DIVISORS).map(Number).sort((a, b) => a - b)
    expect(ages[0]).toBe(72); expect(ages[ages.length - 1]).toBe(120); expect(ages).toHaveLength(49)
    ages.forEach((a, i) => { if (i) expect(UNIFORM_LIFETIME_DIVISORS[a]).toBeLessThan(UNIFORM_LIFETIME_DIVISORS[a - 1]) })
    expect(UNIFORM_LIFETIME_DIVISORS[75]).toBe(24.6)
  })
})
