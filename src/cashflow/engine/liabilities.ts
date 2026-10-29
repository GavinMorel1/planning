// Debt amortisation: yearly payments and balances for each liability, month by month.
import type { Liability } from '../types'

/** Monthly payment: the stated payment, or the level payment that amortises balance over the remaining term. 0 if neither is known. */
export function monthlyPayment(l: Pick<Liability, 'balance' | 'ratePct' | 'paymentMonthly' | 'termMonths'>): number {
  if (l.balance <= 0) return 0
  if (l.paymentMonthly > 0) return l.paymentMonthly
  if (l.termMonths <= 0) return 0
  const r = l.ratePct / 100 / 12
  if (r === 0) return l.balance / l.termMonths
  return (l.balance * r) / (1 - Math.pow(1 + r, -l.termMonths))
}

export interface LiabilityYear { payment: number; endBalance: number }
export interface LiabilitySchedule {
  years: LiabilityYear[]
  /** Balance repaid out of sale proceeds at the start of stopYear (secured asset sold); 0 if none. */
  payoffAtStop: number
}

/**
 * Schedule for `count` years starting at baseYear. Payments run until the balance is gone (a stated payment keeps going past
 * the term if it has not paid the loan off). If `stopYear` is set the remaining balance is paid off at the start of that year
 * and nothing is paid afterwards. A liability with neither a payment nor a term has no service and a constant balance.
 */
export function liabilitySchedule(l: Liability, baseYear: number, count: number, stopYear: number | null = null): LiabilitySchedule {
  const pmt = monthlyPayment(l)
  const r = l.ratePct / 100 / 12
  let bal = Math.max(0, l.balance), payoffAtStop = 0
  const years: LiabilityYear[] = []
  for (let y = 0; y < count; y++) {
    const year = baseYear + y
    if (stopYear !== null && year >= stopYear) {
      if (year === stopYear) payoffAtStop = bal
      bal = 0
      years.push({ payment: 0, endBalance: 0 })
      continue
    }
    let paid = 0
    if (pmt > 0) {
      for (let m = 0; m < 12 && bal > 0.005; m++) {
        const interest = bal * r
        const due = Math.min(pmt, bal + interest)
        bal = bal + interest - due
        paid += due
      }
      if (bal <= 0.005) bal = 0
    }
    years.push({ payment: paid, endBalance: bal })
  }
  return { years, payoffAtStop }
}
