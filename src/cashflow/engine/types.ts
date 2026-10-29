// Public contract of the cash-flow engine (src/cashflow/engine/*). The UI, reports and tests code against these types.
import type { AccountType, CashflowModel, Id, IncomeKind } from '../types'

/** Constants the engine needs from Settings > Tax constants (passed in; the engine never reads app settings). */
export interface EngineConfig {
  /** Year the tax tables are stated in; later years are indexed by inflation. Default: model.assumptions.baseYear. */
  taxYear?: number
  /** Federal estate/gift exemption per person, in taxYear dollars (Settings: estateExemption). */
  estateExemption: number
  /** Federal estate tax rate, percent (Settings: estateTaxRate, 40). */
  estateTaxRate: number
  /** Surviving spouse inherits the first spouse's unused exemption (DSUE). Default true. */
  portability?: boolean
  /** Index the exemption and tax brackets for inflation after taxYear. Default true. */
  indexTables?: boolean
}

export type AgeMap = Record<Id, number | null> // null once the member has died

export interface IncomeBreakdown extends Record<IncomeKind, number> { total: number }
export interface ExpenseBreakdown { lifestyle: number; goal: number; education: number; healthcare: number; housing: number; other: number; debtService: number; insurance: number; gifting: number; total: number }
export interface TaxBreakdown {
  federalIncome: number; federalLtcg: number; niit: number; state: number; payroll: number; total: number
  agi: number; taxableIncome: number
  marginalRate: number // percent, ordinary federal bracket at the top of taxable income
  effectiveRate: number // percent of total income
  ssTaxable: number // taxable portion of Social Security
  irmaaFlag: boolean // MAGI (two years prior approximated by the same year) is above the first IRMAA threshold
  rothConversion: number // amount converted this year (included in ordinary income)
}
export interface WithdrawalBreakdown { cash: number; taxable: number; traditional: number; roth: number; hsa: number; total: number }

export interface ProjectionRow {
  year: number
  ages: AgeMap
  income: IncomeBreakdown
  expenses: ExpenseBreakdown
  taxes: TaxBreakdown
  contributions: number // savings into accounts this year
  withdrawals: WithdrawalBreakdown // drawn to cover spending and taxes (RMDs counted in income.rmd, not here)
  surplus: number // cash left after spending, taxes and contributions that was reinvested
  shortfall: number // spending that could not be funded this year (accounts exhausted); 0 when funded
  balances: Record<AccountType, number> // end-of-year balance by account type
  accountBalances: Record<Id, number> // end-of-year balance by account id
  liabilityBalance: number
  netWorth: number // all assets (incl. real estate, business) minus liabilities, end of year
  liquidAssets: number // cash + taxable + traditional + roth + hsa
  saleProceeds?: number // net proceeds of real estate / business sales this year (after costs and secured debt), added to cash
}

export interface Projection {
  rows: ProjectionRow[]
  startYear: number
  endYear: number // year the last member reaches life expectancy
  firstDeathYear: number | null
  retirementYear: Record<Id, number> // calendar year each member retires (works to retirementAge)
  depletionYear: number | null // first year with a shortfall, null if funded to the end
  lifetimeTaxes: number
  netWorthAtRetirement: number // end of the year the primary member retires (first row if already retired)
  netWorthAtEnd: number
  warnings: string[]
}

export interface MonteCarloOptions { runs?: number; seed?: number; meanReturnPct?: number; stdDevPct?: number }
export interface MonteCarloBand { year: number; p10: number; p25: number; p50: number; p75: number; p90: number }
export interface MonteCarloResult {
  runs: number
  successProbability: number // 0..1: share of runs with no shortfall through the plan end
  bands: MonteCarloBand[] // liquid assets by year
  medianEndingLiquid: number
  p10EndingLiquid: number
  failureYearMedian: number | null // median year of first shortfall among failed runs
}

export interface EstateSnapshot {
  year: number
  deceasedId: Id
  deceasedName: string
  grossEstate: number // assets owned by the decedent (joint assets counted 50/50 for spouses), plus life insurance included in the estate
  insuranceInEstate: number
  liabilities: number
  maritalDeduction: number // passes to a surviving spouse tax-free
  taxableEstate: number
  exemptionAvailable: number // own exemption plus any portability received
  exemptionUsed: number
  federalEstateTax: number
  netToHeirs: number
  note: string
}

export interface ScenarioComparison { id: Id; name: string; projection: Projection; successProbability: number | null }

export type { CashflowModel }
