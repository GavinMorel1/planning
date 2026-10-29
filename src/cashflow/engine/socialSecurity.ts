// Social Security retirement benefits from a member's PIA, full retirement age and claim age.
import type { Id, Member } from '../types'

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

/**
 * Share of PIA paid when claiming at `claimAge` (62..70, clamped) with full retirement age `fra`.
 * Early: reduced 5/9 of 1% per month for the first 36 months, 5/12 of 1% for each month beyond.
 * Late: +8% per year (2/3 of 1% per month) until 70.
 * FRA 67: claim at 62 = 0.70, at 67 = 1.00, at 70 = 1.24.
 */
export function ssFactor(claimAge: number, fra = 67): number {
  const claim = clamp(Math.round(claimAge * 12), 62 * 12, 70 * 12)
  const fraM = Math.round(fra * 12)
  const diff = claim - fraM
  if (diff < 0) {
    const early = -diff
    return 1 - (Math.min(early, 36) * 5 / 9 + Math.max(0, early - 36) * 5 / 12) / 100
  }
  const delayed = Math.min(diff, Math.max(0, 70 * 12 - fraM))
  return 1 + (delayed * 2 / 3) / 100
}

/** Annual benefit in base-year dollars (before COLA) if the member claims at `claimAge` (default: their own claim age). */
export function annualBenefit(member: Pick<Member, 'ssPiaMonthly' | 'ssFra' | 'ssClaimAge'>, claimAge = member.ssClaimAge): number {
  return Math.max(0, member.ssPiaMonthly) * 12 * ssFactor(claimAge, member.ssFra)
}

export interface ClaimingRow { claimAge: number; factor: number; monthly: number; annual: number }
/** Annual (and monthly) benefit at every claim age 62..70, in base-year dollars, for the claiming-age comparison in the UI. */
export function claimingTable(member: Pick<Member, 'ssPiaMonthly' | 'ssFra'>): ClaimingRow[] {
  const rows: ClaimingRow[] = []
  for (let age = 62; age <= 70; age++) {
    const factor = ssFactor(age, member.ssFra)
    const monthly = Math.max(0, member.ssPiaMonthly) * factor
    rows.push({ claimAge: age, factor, monthly, annual: monthly * 12 })
  }
  return rows
}

export interface SsPerson {
  id: Id
  birthYear: number
  deathYear: number
  annualBase: number // annual benefit at the member's claim age, base-year dollars
  claimAge: number
  eligibleForSurvivor: boolean // adults only
}

/**
 * Automatic Social Security for one year. Rule: a member with ssPiaMonthly > 0 receives annualBase (grown by COLA from the
 * base year) from the calendar year they reach their claim age until their death year. After a spouse's death the
 * survivor receives the LARGER of their own benefit and the deceased's (from the later of the first death and their own claim
 * age; early-survivor reductions, the 71.5% age-60 rule and the deceased's actual claim date are not modelled).
 */
export function ssBenefitsForYear(people: SsPerson[], year: number, baseYear: number, colaPct: number): Record<Id, number> {
  const cola = Math.pow(1 + colaPct / 100, Math.max(0, year - baseYear))
  const out: Record<Id, number> = {}
  for (const p of people) {
    out[p.id] = 0
    if (year > p.deathYear || year - p.birthYear < p.claimAge) continue
    let amount = p.annualBase
    if (p.eligibleForSurvivor) for (const q of people) if (q.id !== p.id && q.eligibleForSurvivor && q.deathYear < year) amount = Math.max(amount, q.annualBase)
    out[p.id] = amount * cola
  }
  return out
}
