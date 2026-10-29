// Pure US tax functions on top of taxTables.ts. Every function that depends on indexed tables takes `factor`, the cumulative
// inflation index since the table year (1 = tables as published); get it from indexFactor().
import type { FilingStatus } from '../types'
import {
  ADDITIONAL_DEDUCTION_65, IRMAA_FIRST_THRESHOLD, LTCG_THRESHOLDS, NIIT_RATE, NIIT_THRESHOLD, ORDINARY_BRACKETS, PAYROLL, SS_TAXATION,
  SS_TAX_TIERS, STANDARD_DEDUCTION, STATE_TAX_RATES, TAX_TABLE_YEAR,
} from './taxTables'

/** Cumulative inflation index for `year` relative to the table year. 1 when indexing is off or the year is not after the table year. */
export function indexFactor(year: number, inflationPct: number, taxYear = TAX_TABLE_YEAR, indexTables = true): number {
  if (!indexTables || year <= taxYear) return 1
  return Math.pow(1 + inflationPct / 100, year - taxYear)
}

export function standardDeduction(status: FilingStatus, taxpayersAge65Plus: number, factor = 1): number {
  return (STANDARD_DEDUCTION[status] + Math.max(0, taxpayersAge65Plus) * ADDITIONAL_DEDUCTION_65[status]) * factor
}

/** Tax on ordinary taxable income from the bracket schedule. */
export function ordinaryTax(taxable: number, status: FilingStatus, factor = 1): number {
  let tax = 0, lower = 0
  for (const br of ORDINARY_BRACKETS[status]) {
    const upper = br.upTo * factor
    if (taxable > lower) tax += (Math.min(taxable, upper) - lower) * br.rate
    if (taxable <= upper) break
    lower = upper
  }
  return tax
}

/** Federal ordinary bracket rate (percent) that the next dollar of ordinary taxable income would face. */
export function marginalRate(ordinaryTaxable: number, status: FilingStatus, factor = 1): number {
  for (const br of ORDINARY_BRACKETS[status]) if (ordinaryTaxable < br.upTo * factor) return br.rate * 100
  return 37
}

/**
 * Long-term capital gains tax. Gains are stacked on top of ordinary taxable income, so the part of the gain that falls under
 * the 0% ceiling depends on how much ordinary income is already there.
 */
export function ltcgTax(ordinaryTaxable: number, ltcgTaxable: number, status: FilingStatus, factor = 1): number {
  if (ltcgTaxable <= 0) return 0
  const { zeroTop, fifteenTop } = LTCG_THRESHOLDS[status]
  const z = zeroTop * factor, f = fifteenTop * factor
  const lo = Math.max(0, ordinaryTaxable), hi = lo + ltcgTaxable
  const in15 = Math.max(0, Math.min(hi, f) - Math.max(lo, z))
  const in20 = Math.max(0, hi - Math.max(lo, f))
  return in15 * 0.15 + in20 * 0.20
}

export interface FederalTax { ordinary: number; ltcg: number; total: number; marginalRate: number }
export function federalIncomeTax(ordinaryTaxable: number, ltcgTaxable: number, status: FilingStatus, factor = 1): FederalTax {
  const ordinary = ordinaryTax(Math.max(0, ordinaryTaxable), status, factor)
  const ltcg = ltcgTax(ordinaryTaxable, ltcgTaxable, status, factor)
  return { ordinary, ltcg, total: ordinary + ltcg, marginalRate: marginalRate(Math.max(0, ordinaryTaxable), status, factor) }
}

/**
 * Taxable part of Social Security benefits (Pub. 915 worksheet). `otherIncome` is AGI excluding benefits (plus tax-exempt
 * interest). Provisional income = otherIncome + 50% of benefits. Up to 50% of benefits are taxable between the base and
 * adjusted-base thresholds, up to 85% above the adjusted base. The thresholds are not indexed.
 */
export function taxableSocialSecurity(ssBenefit: number, otherIncome: number, status: FilingStatus): number {
  if (ssBenefit <= 0) return 0
  const { base, adjusted } = SS_TAXATION[status]
  const pi = otherIncome + SS_TAX_TIERS.lower * ssBenefit
  if (pi <= base) return 0
  if (pi <= adjusted) return Math.min(SS_TAX_TIERS.lower * (pi - base), SS_TAX_TIERS.lower * ssBenefit)
  const tier1 = Math.min(SS_TAX_TIERS.lower * (adjusted - base), SS_TAX_TIERS.lower * ssBenefit)
  return Math.min(SS_TAX_TIERS.upper * (pi - adjusted) + tier1, SS_TAX_TIERS.upper * ssBenefit)
}

/** Net investment income tax: 3.8% of the lesser of net investment income and MAGI over the (non-indexed) threshold. */
export function niit(netInvestmentIncome: number, magi: number, status: FilingStatus): number {
  const over = Math.max(0, magi - NIIT_THRESHOLD[status])
  return NIIT_RATE * Math.max(0, Math.min(netInvestmentIncome, over))
}

export interface PayrollTax {
  socialSecurity: number; medicare: number; additionalMedicare: number; selfEmployment: number
  total: number
  /** Deductible half of self-employment tax (reduces AGI). */
  seDeduction: number
}
/**
 * Payroll taxes for one household. `wages[i]` and `selfEmployed[i]` are the i-th earner's wages and net business income;
 * the Social Security wage base applies per earner. Wages pay 6.2% to the base plus 1.45% on everything; self-employed
 * earnings pay both halves (12.4% + 2.9%) on 92.35% of net, sharing the wage base with the earner's wages. The 0.9% additional
 * Medicare tax applies to combined Medicare earnings over the (non-indexed) threshold.
 */
export function payroll(wages: number[], selfEmployed: number[], status: FilingStatus, factor = 1): PayrollTax {
  const base = PAYROLL.ssWageBase * factor
  let ss = 0, med = 0, se = 0, medicareEarnings = 0
  const n = Math.max(wages.length, selfEmployed.length)
  for (let i = 0; i < n; i++) {
    const w = Math.max(0, wages[i] || 0), s = Math.max(0, selfEmployed[i] || 0)
    ss += PAYROLL.ssRate * Math.min(w, base)
    med += PAYROLL.medicareRate * w
    const net = s * PAYROLL.seNetFactor
    se += PAYROLL.seSsRate * Math.max(0, Math.min(net, base - w)) + PAYROLL.seMedicareRate * net
    medicareEarnings += w + net
  }
  const additional = PAYROLL.additionalMedicareRate * Math.max(0, medicareEarnings - PAYROLL.additionalMedicareThreshold[status])
  return { socialSecurity: ss, medicare: med, additionalMedicare: additional, selfEmployment: se, total: ss + med + se + additional, seDeduction: se / 2 }
}

/** Approximate state income tax: flat rate (percent) times the base. `overridePct` (assumptions.stateTaxRatePct) wins over the table. */
export function stateTax(base: number, state: string, overridePct: number | null = null): number {
  const rate = overridePct ?? STATE_TAX_RATES[(state || '').toUpperCase()] ?? 0
  return Math.max(0, base) * rate / 100
}

/** True when MAGI is above the first IRMAA threshold (Medicare surcharges start). Two-year look-back is approximated by the same year. */
export function irmaaFlag(magi: number, status: FilingStatus, factor = 1): boolean {
  return magi > IRMAA_FIRST_THRESHOLD[status] * factor
}
