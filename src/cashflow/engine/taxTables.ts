// US tax tables used by the cash-flow engine. DATA ONLY: no logic lives here (see tax.ts, rmd.ts).
//
// SOURCE AND STATUS: 2026 federal figures transcribed from IRS Rev. Proc. 2025-32 (2026 inflation adjustments), IRS
// Publication 915 / Form 8960 instructions (Social Security taxation and NIIT thresholds), SSA 2026 COLA fact sheet (wage
// base), CMS 2026 Medicare Part B premium notice (IRMAA tiers) and IRS Publication 590-B (Uniform Lifetime Table, 2022+).
// They were entered from memory of those publications, not re-downloaded: VERIFY WITH THE TAX TEAM before client use and
// whenever a new year's Revenue Procedure is published. Not modelled: AMT, QBI deduction, itemized deductions, the 2025-2028
// "senior" deduction added by the 2025 budget act, credits, and the Medicare Part B surcharge amounts themselves.
//
// INDEXING: brackets, standard/additional deductions, LTCG thresholds, the Social Security wage base and the IRMAA threshold
// are indexed by inflation after TAX_TABLE_YEAR (tax.ts: indexFactor). NIIT thresholds, the Social Security taxation
// thresholds and the additional Medicare threshold are NOT indexed in current law, so they are never scaled.
import type { FilingStatus } from '../types'

export const TAX_TABLE_YEAR = 2026

export interface Bracket { upTo: number; rate: number } // rate is a fraction (0.22); upTo is the top of the bracket in taxable dollars

const b = (rows: Array<[number, number]>): Bracket[] => rows.map(([upTo, rate]) => ({ upTo, rate }))
const INF = Infinity

/** 2026 ordinary income brackets (taxable income, after deductions). */
export const ORDINARY_BRACKETS: Record<FilingStatus, Bracket[]> = {
  single: b([[12_400, 0.10], [50_400, 0.12], [105_700, 0.22], [201_775, 0.24], [256_225, 0.32], [640_600, 0.35], [INF, 0.37]]),
  mfj: b([[24_800, 0.10], [100_800, 0.12], [211_400, 0.22], [403_550, 0.24], [512_450, 0.32], [768_700, 0.35], [INF, 0.37]]),
  mfs: b([[12_400, 0.10], [50_400, 0.12], [105_700, 0.22], [201_775, 0.24], [256_225, 0.32], [384_350, 0.35], [INF, 0.37]]),
  hoh: b([[17_700, 0.10], [67_450, 0.12], [105_700, 0.22], [201_750, 0.24], [256_200, 0.32], [640_600, 0.35], [INF, 0.37]]),
}

export const STANDARD_DEDUCTION: Record<FilingStatus, number> = { single: 16_100, mfj: 32_200, mfs: 16_100, hoh: 24_150 }
/** Extra standard deduction per taxpayer aged 65 or older (married statuses use the lower married amount). */
export const ADDITIONAL_DEDUCTION_65: Record<FilingStatus, number> = { single: 2_050, mfj: 1_650, mfs: 1_650, hoh: 2_050 }

/** Long-term capital gains: top of the 0% band and top of the 15% band, in taxable income (ordinary + gains stacked). */
export const LTCG_THRESHOLDS: Record<FilingStatus, { zeroTop: number; fifteenTop: number }> = {
  single: { zeroTop: 49_450, fifteenTop: 545_500 },
  mfj: { zeroTop: 98_900, fifteenTop: 613_700 },
  mfs: { zeroTop: 49_450, fifteenTop: 306_850 },
  hoh: { zeroTop: 66_200, fifteenTop: 579_600 },
}
export const LTCG_RATES = { zero: 0, fifteen: 0.15, twenty: 0.20 } as const

/** Net investment income tax: 3.8% of the lesser of NII and MAGI over the threshold. Thresholds are NOT indexed. */
export const NIIT_RATE = 0.038
export const NIIT_THRESHOLD: Record<FilingStatus, number> = { single: 200_000, mfj: 250_000, mfs: 125_000, hoh: 200_000 }

/** Social Security benefit taxation (provisional income = other income + half of benefits). NOT indexed. */
export const SS_TAXATION: Record<FilingStatus, { base: number; adjusted: number }> = {
  single: { base: 25_000, adjusted: 34_000 },
  hoh: { base: 25_000, adjusted: 34_000 },
  mfj: { base: 32_000, adjusted: 44_000 },
  mfs: { base: 0, adjusted: 0 }, // married filing separately and living with the spouse
}
export const SS_TAX_TIERS = { lower: 0.5, upper: 0.85 } as const

/** First IRMAA (Medicare Part B/D surcharge) MAGI threshold, 2026 (approximate; confirm against the CMS notice). */
export const IRMAA_FIRST_THRESHOLD: Record<FilingStatus, number> = { single: 109_000, mfj: 218_000, mfs: 109_000, hoh: 109_000 }

/** Payroll taxes. Employee share of FICA for wages; both halves for self-employment ('business' income). */
export const PAYROLL = {
  ssWageBase: 184_500, // indexed
  ssRate: 0.062,
  medicareRate: 0.0145,
  additionalMedicareRate: 0.009,
  additionalMedicareThreshold: { single: 200_000, mfj: 250_000, mfs: 125_000, hoh: 200_000 } as Record<FilingStatus, number>, // NOT indexed
  seNetFactor: 0.9235, // self-employment tax applies to 92.35% of net earnings
  seSsRate: 0.124,
  seMedicareRate: 0.029,
} as const

/**
 * ESTIMATE ONLY. Approximate top or typical effective state income tax rate (percent) applied to income other than Social
 * Security. Real state tax depends on brackets, deductions, retirement-income exclusions and local taxes; use
 * assumptions.stateTaxRatePct to override. 0 for states with no wage income tax (AK FL NV NH SD TN TX WA WY).
 */
export const STATE_TAX_RATES: Record<string, number> = {
  AL: 5.0, AK: 0, AZ: 2.5, AR: 3.9, CA: 9.3, CO: 4.4, CT: 5.5, DE: 5.5, DC: 8.5, FL: 0, GA: 5.2, HI: 8.25, ID: 5.3, IL: 4.95, IN: 3.0,
  IA: 3.8, KS: 5.2, KY: 4.0, LA: 3.0, ME: 7.0, MD: 5.0, MA: 5.0, MI: 4.25, MN: 7.5, MS: 4.0, MO: 4.7, MT: 5.4, NE: 5.2, NV: 0, NH: 0,
  NJ: 6.0, NM: 4.5, NY: 6.0, NC: 3.99, ND: 2.0, OH: 3.0, OK: 4.25, OR: 8.75, PA: 3.07, RI: 5.0, SC: 6.0, SD: 0, TN: 0, TX: 0, UT: 4.5,
  VT: 6.5, VA: 5.5, WA: 0, WV: 4.5, WI: 5.3, WY: 0,
}

/** IRS Uniform Lifetime Table (Pub. 590-B, effective 2022): distribution period by age at year end. Ages 72..120 (120 and over use 2.0). */
export const UNIFORM_LIFETIME_DIVISORS: Record<number, number> = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6, 76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1, 80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7, 84: 16.8,
  85: 16.0, 86: 15.2, 87: 14.4, 88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5, 92: 10.8, 93: 10.1, 94: 9.5, 95: 8.9, 96: 8.4, 97: 7.8,
  98: 7.3, 99: 6.8, 100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2, 104: 4.9, 105: 4.6, 106: 4.3, 107: 4.1, 108: 3.9, 109: 3.7, 110: 3.5,
  111: 3.4, 112: 3.3, 113: 3.1, 114: 3.0, 115: 2.9, 116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3, 120: 2.0,
}

/** SECURE 2.0 required beginning ages by birth year: 1950 or earlier 72, 1951-1959 73, 1960 or later 75. */
export const RMD_START_AGES = { upTo1950: 72, from1951: 73, from1960: 75 } as const
