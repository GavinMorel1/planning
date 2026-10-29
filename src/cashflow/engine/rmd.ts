// Required minimum distributions from tax-deferred accounts (SECURE 2.0 start ages, IRS Uniform Lifetime Table).
import { RMD_START_AGES, UNIFORM_LIFETIME_DIVISORS } from './taxTables'

/** Age at which RMDs begin: born 1950 or earlier 72, 1951-1959 73, 1960 or later 75. */
export function rmdStartAge(birthYear: number): number {
  if (birthYear <= 1950) return RMD_START_AGES.upTo1950
  if (birthYear <= 1959) return RMD_START_AGES.from1951
  return RMD_START_AGES.from1960
}

/** Uniform Lifetime Table distribution period; ages over 120 use the 120 divisor, null below 72 (never used before the start age). */
export function rmdDivisor(age: number): number | null {
  if (age < 72) return null
  return UNIFORM_LIFETIME_DIVISORS[Math.min(120, Math.floor(age))]
}

/** RMD for the year the owner reaches `age`: prior December 31 balance divided by the divisor; 0 before the start age. */
export function rmdAmount(age: number, birthYear: number, priorYearEndBalance: number): number {
  if (age < rmdStartAge(birthYear) || priorYearEndBalance <= 0) return 0
  const d = rmdDivisor(age)
  return d ? priorYearEndBalance / d : 0
}
