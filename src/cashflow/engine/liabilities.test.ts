import { describe, it, expect } from 'vitest'
import { newLiability } from '../types'
import { liabilitySchedule, monthlyPayment } from './liabilities'

describe('liabilities', () => {
  const mortgage = newLiability({ balance: 300_000, ratePct: 6, termMonths: 360 })
  it('computes the level payment for balance, rate and term', () => {
    expect(monthlyPayment(mortgage)).toBeCloseTo(1_798.65, 2) // standard 30-year 6% payment on 300,000
    expect(monthlyPayment(newLiability({ balance: 12_000, ratePct: 0, termMonths: 12 }))).toBe(1_000)
    expect(monthlyPayment(newLiability({ balance: 100, paymentMonthly: 40, termMonths: 5 }))).toBe(40)
    expect(monthlyPayment(newLiability({ balance: 100 }))).toBe(0)
  })
  it('amortises to zero by the end of the term', () => {
    const s = liabilitySchedule(mortgage, 2026, 35)
    expect(s.years[0].payment).toBeCloseTo(1_798.65 * 12, 0)
    // first-year balance: 300,000 x 1.005^12 - 1,798.65 x ((1.005^12 - 1) / 0.005) = 296,284 (approx)
    expect(s.years[0].endBalance).toBeGreaterThan(295_000)
    expect(s.years[0].endBalance).toBeLessThan(297_500)
    expect(s.years[29].endBalance).toBe(0)
    expect(s.years[30].payment).toBe(0)
    expect(s.years.reduce((x, y) => x + y.payment, 0)).toBeCloseTo(1_798.65 * 360, -1)
  })
  it('balances only decline when the payment exceeds interest', () => {
    const s = liabilitySchedule(mortgage, 2026, 30)
    s.years.forEach((y, i) => { if (i) expect(y.endBalance).toBeLessThanOrEqual(s.years[i - 1].endBalance) })
  })
  it('pays off the balance at the start of the stop year (asset sold)', () => {
    const s = liabilitySchedule(newLiability({ balance: 120_000, ratePct: 0, paymentMonthly: 1_000 }), 2026, 5, 2028)
    expect(s.years[1].endBalance).toBe(96_000)
    expect(s.payoffAtStop).toBe(96_000)
    expect(s.years[2]).toEqual({ payment: 0, endBalance: 0 })
  })
  it('with no payment and no term, balance stays and nothing is paid', () => {
    const s = liabilitySchedule(newLiability({ balance: 50_000, ratePct: 5 }), 2026, 3)
    expect(s.years.every((y) => y.payment === 0 && y.endBalance === 50_000)).toBe(true)
  })
})
