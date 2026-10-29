// Shared fixtures for the engine tests (not part of the public API). Never reads the clock: baseYear is always explicit.
import { emptyModel, newAccount, newExpense, newIncome, newMember, type CashflowModel } from '../types'
import type { EngineConfig } from './types'

export const CFG: EngineConfig = { taxYear: 2026, estateExemption: 15_000_000, estateTaxRate: 40 }

/**
 * Hand-checkable family: Ann (primary, 60 in 2026) and Bo (58), both retire at 65 and live to 90. Ann earns $300k until she
 * retires (works 2026-2030). Spending $120k. $2M traditional (Ann), $1M taxable (basis $600k), $200k cash, $500k Roth.
 * 3% inflation and salary growth, 6% return, no state tax, no Social Security.
 */
export function sampleModel(): CashflowModel {
  const m = emptyModel(2026)
  const ann = newMember('primary', { id: 'ann', name: 'Ann', dob: '1966-03-01', retirementAge: 65, lifeExpectancy: 90 })
  const bo = newMember('spouse', { id: 'bo', name: 'Bo', dob: '1968-03-01', retirementAge: 65, lifeExpectancy: 90 })
  m.members.push(ann, bo)
  m.income.push(newIncome({ id: 'sal', name: 'Ann salary', kind: 'salary', ownerId: 'ann', annual: 300_000 }))
  m.expenses.push(newExpense({ id: 'life', name: 'Lifestyle', kind: 'lifestyle', annual: 120_000 }))
  m.accounts.push(
    newAccount({ id: 'ira', name: 'Ann IRA', type: 'traditional', ownerId: 'ann', balance: 2_000_000 }),
    newAccount({ id: 'brk', name: 'Brokerage', type: 'taxable', ownerId: 'joint', balance: 1_000_000, costBasis: 600_000 }),
    newAccount({ id: 'chk', name: 'Cash', type: 'cash', ownerId: 'joint', balance: 200_000 }),
    newAccount({ id: 'roth', name: 'Roth', type: 'roth', ownerId: 'joint', balance: 500_000 }),
  )
  Object.assign(m.assumptions, { inflationPct: 3, salaryGrowthPct: 3, returnPct: 6, stdDevPct: 12, ssColaPct: 2.5, filingStatus: 'mfj', state: '', stateTaxRatePct: 0 })
  return m
}
