import { describe, it, expect } from 'vitest'
import { calcNumbers, fv, includedSections, DEFAULT_RATES, n } from './numbersCalc'

// Reference values come from "Family Capital Assessment Calculations.xlsx" (Sheet1) and hand calculation of its formulas.
describe('Excel FV', () => {
  it('matches the workbook cached value for K19 (rate 2.04%, 90 years, pmt 90, pv 0, type 1)', () => {
    expect(-fv(0.0204, 90, 90, 0, 1)).toBeCloseTo(23213.771573209015, 6)
  })
  it('equals an annuity-due simulation', () => {
    const [r, nper, pmt, pv] = [0.0204, 25, 25, 1_000_000]
    let bal = pv
    for (let i = 0; i < nper; i++) bal = (bal + pmt) * (1 + r) // payment at the start of each period
    expect(-fv(r, nper, pmt, pv, 1)).toBeCloseTo(bal, 4)
  })
  it('type 0 (end of period) differs from type 1 by one period of growth on the payments', () => {
    const a = -fv(0.05, 10, 100, 0, 0), b = -fv(0.05, 10, 100, 0, 1)
    expect(b).toBeCloseTo(a * 1.05, 8)
  })
  it('handles a zero rate', () => { expect(fv(0, 10, 5, 100, 1)).toBe(-(100 + 50)) })
})

describe('blank inputs behave like empty Excel cells', () => {
  it('reproduces the workbook as saved (age blank, estate blank, only Total Net Worth set)', () => {
    const r = calcNumbers({})
    expect(r.yearsRemaining).toBe(90) // B4 = 90 - blank
    expect(r.sections[1].value).toBe(0)
    expect(r.sections[2].value).toBe(0)
    expect(r.sections[3].value).toBe(0)
    expect(r.sections[4].value).toBe(0)
    expect(r.sections[5].value).toBe(0)
    expect(r.sections[6].value).toBe(0)
    expect(r.sections[7].value).toBe(0)
    expect(r.sections[8].value).toBeCloseTo(23213.771573209015, 6) // K20 with K17 blank
  })
  it('parses currency text', () => { expect(n('$1,250,000')).toBe(1250000); expect(n('')).toBe(0); expect(n('abc')).toBe(0) })
})

describe('sample family: age 60, life expectancy 90, estate $50M', () => {
  const input = { currentAge: 60, lifeExpectancy: 90, estateValue: 50_000_000, annualGiving: 100_000, incomeTaxes: 250_000, taxableGain: 8_000_000, investmentAmount: 2_000_000 }
  const r = calcNumbers(input)
  it('years remaining', () => expect(r.yearsRemaining).toBe(30))
  it('1 generosity = 4.22 x (giving x years)', () => expect(r.sections[1].value).toBeCloseTo(4.22 * 100_000 * 30, 6))
  it('2 income taxes = 12.67% x (taxes x years)', () => expect(r.sections[2].value).toBeCloseTo(0.1267 * 250_000 * 30, 6))
  it('3 capital gains = 61.23% x (gain x 20%)', () => expect(r.sections[3].value).toBeCloseTo(0.6123 * 8_000_000 * 0.2, 6))
  it('4 estate tax = 90.89% x 40% x (estate - 30M)', () => expect(r.sections[4].value).toBeCloseTo(0.9089 * 0.4 * 20_000_000, 6))
  it('5 inheritance moved = 20.27% x estate', () => expect(r.sections[5].value).toBeCloseTo(0.2027 * 50_000_000, 6))
  it('6 wealth failure first generation = 70% x estate', () => expect(r.sections[6].value).toBeCloseTo(35_000_000, 6))
  it('7 wealth failure third generation = 90% x estate', () => expect(r.sections[7].value).toBeCloseTo(45_000_000, 6))
  it('8 investment performance = -FV(2.04%, 30, 30, 2M, 1) - 2M', () => {
    const g = Math.pow(1.0204, 30)
    const expected = 2_000_000 * g + 30 * 1.0204 * ((g - 1) / 0.0204) - 2_000_000
    expect(r.sections[8].value).toBeCloseTo(expected, 4)
  })
})

describe('estate tax exemption', () => {
  it('is 30M married and 15M single', () => {
    expect(calcNumbers({ estateValue: 40_000_000 }).exemption).toBe(30_000_000)
    expect(calcNumbers({ estateValue: 40_000_000, marital: 'single' }).exemption).toBe(15_000_000)
    expect(calcNumbers({ estateValue: 40_000_000, marital: 'single' }).sections[4].value).toBeCloseTo(0.9089 * 0.4 * 25_000_000, 6)
  })
  it('is zero tax at or below the exemption (the IF in K11)', () => {
    expect(calcNumbers({ estateValue: 30_000_000 }).sections[4].value).toBe(0)
    expect(calcNumbers({ estateValue: 10_000_000 }).sections[4].value).toBe(0)
  })
  it('an override wins', () => expect(calcNumbers({ estateValue: 20_000_000, exemptionOverride: 10_000_000 }).sections[4].value).toBeCloseTo(0.9089 * 0.4 * 10_000_000, 6))
})

describe('editable constants', () => {
  it('uses Settings values', () => {
    const r = calcNumbers({ estateValue: 10_000_000 }, { ...DEFAULT_RATES, lifetimePct: 25 })
    expect(r.sections[5].value).toBe(2_500_000)
  })
})

describe('which sections print', () => {
  it('defaults: under $5M = 1,5,6,8; $5M+ = 1,4,5,6,8', () => {
    expect(includedSections(undefined, 'under5')).toEqual([1, 5, 6, 8])
    expect(includedSections({}, 'over5')).toEqual([1, 4, 5, 6, 8])
  })
  it('planner choices override the defaults, kept in order 1..8', () => {
    expect(includedSections({ 7: true, 2: true, 1: false }, 'under5')).toEqual([2, 5, 6, 7, 8])
  })
})

// Values below were produced by recalculating the actual workbook (LibreOffice) with these inputs typed into
// B2=60, B5=50,000,000, B8=100,000, E8=250,000, H8=8,000,000, K17=2,000,000.
describe('workbook recalculation fixture', () => {
  const r = calcNumbers({ currentAge: 60, estateValue: 50_000_000, annualGiving: 100_000, incomeTaxes: 250_000, taxableGain: 8_000_000, investmentAmount: 2_000_000 })
  it('matches every output cell', () => {
    expect(r.yearsRemaining).toBe(30) // B4
    expect(r.sections[1].value).toBeCloseTo(12_660_000, 4) // B11
    expect(r.sections[2].value).toBeCloseTo(950_250, 4) // E11
    expect(r.sections[3].value).toBeCloseTo(979_680, 4) // H11
    expect(r.sections[4].value).toBeCloseTo(7_271_200, 4) // K13
    expect(r.sections[5].value).toBeCloseTo(10_135_000, 4) // B19
    expect(r.sections[6].value).toBeCloseTo(35_000_000, 4) // E19
    expect(r.sections[7].value).toBeCloseTo(45_000_000, 4) // H19
    expect(r.sections[8].value).toBeCloseTo(1_666_836.36061992, 4) // K20
    expect(r.sections[8].steps[2].value).toBeCloseTo(3_666_836.36061992, 4) // K19
  })
})
