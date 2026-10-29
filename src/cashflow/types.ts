// Typed cash-flow data model for one family. Stored as one JSON document per family in Supabase table `cashflow_models`
// (history in `cashflow_history`), see supabase/migrations/20261029_cashflow_model.sql. All money is nominal US dollars in
// the plan's base year; all rates are percentages as plain numbers (3 means 3%). Years are calendar years (e.g. 2031).

export type Id = string
export type FilingStatus = 'single' | 'mfj' | 'mfs' | 'hoh'
export type MemberRole = 'primary' | 'spouse' | 'dependent'

export interface Member {
  id: Id
  name: string
  role: MemberRole
  dob: string // ISO yyyy-mm-dd, '' if unknown
  retirementAge: number // age work income stops
  lifeExpectancy: number // plan runs to the last member's life expectancy
  ssClaimAge: number // 62..70, used when a socialSecurity stream names this member
  ssPiaMonthly: number // monthly benefit at full retirement age (today's dollars); 0 = none
  ssFra: number // full retirement age, default 67
}

/** Stored income kinds. RMDs are derived by the engine from tax-deferred accounts and appear in projections as 'rmd'. */
export type StoredIncomeKind = 'salary' | 'business' | 'socialSecurity' | 'pension' | 'rental' | 'other'
export type IncomeKind = StoredIncomeKind | 'rmd'

export interface IncomeStream {
  id: Id
  name: string
  kind: StoredIncomeKind
  ownerId: Id | 'joint' // member id
  annual: number // today's dollars (for socialSecurity: ignored, benefit comes from the member's PIA and claim age)
  startYear: number | null // null = from the plan's base year
  endYear: number | null // null = until the owner's retirement (salary, business) or end of plan (others)
  growthPct: number | null // null = use assumptions (salary growth / inflation)
  taxable: boolean // pension, salary, business, rental are taxable; set false for e.g. a tax-free stream
}

export type ExpenseKind = 'lifestyle' | 'goal' | 'education' | 'healthcare' | 'housing' | 'other'
export interface Expense {
  id: Id
  name: string
  kind: ExpenseKind
  annual: number // today's dollars per year; for a one-time item this is the single amount
  startYear: number | null
  endYear: number | null
  oneTimeYear: number | null // if set the expense happens once, in that year
  inflationPct: number | null // null = general inflation (healthcare defaults to the healthcare inflation assumption)
  /** Lifestyle spending that steps down after the first death (percent of the couple's amount kept), null = unchanged. */
  survivorPct: number | null
}

export type AccountType = 'taxable' | 'traditional' | 'roth' | 'hsa' | 'cash' | 'realEstate' | 'business'
export interface Account {
  id: Id
  name: string
  type: AccountType
  ownerId: Id | 'joint'
  balance: number
  contributionAnnual: number // while contributing; goes into this account from cash flow
  contributionEndYear: number | null // null = until owner's retirement
  returnPct: number | null // null = use assumptions
  stdDevPct: number | null // for Monte Carlo, null = assumptions
  costBasis: number | null // taxable accounts, real estate and business: basis for capital gains
  saleYear: number | null // real estate / business sold in this year (proceeds to cash, gain taxed)
  saleCostPct: number // selling costs as % of value
  illiquid: boolean // real estate and business are never drawn down unless sold
}

export type LiabilityKind = 'mortgage' | 'heloc' | 'auto' | 'student' | 'business' | 'other'
export interface Liability {
  id: Id
  name: string
  kind: LiabilityKind
  balance: number
  ratePct: number
  paymentMonthly: number // 0 = compute from balance, rate and term
  termMonths: number // remaining
  securedById: Id | null // account id of the asset it is secured by
}

export type PolicyKind = 'term' | 'whole' | 'universal' | 'variable' | 'ltc' | 'disability' | 'umbrella'
export interface InsurancePolicy {
  id: Id
  name: string
  kind: PolicyKind
  insuredId: Id | null // member
  ownerName: string // owner or trust (an ILIT keeps the death benefit out of the estate)
  deathBenefit: number
  cashValue: number
  premiumAnnual: number
  premiumEndYear: number | null
  inEstate: boolean // included in the taxable estate at the insured's death
}

export interface Assumptions {
  baseYear: number // first projection year
  inflationPct: number
  healthcareInflationPct: number
  salaryGrowthPct: number
  returnPct: number // default account return
  stdDevPct: number // default volatility for Monte Carlo
  ssColaPct: number
  filingStatus: FilingStatus
  state: string // 2-letter, '' = none
  stateTaxRatePct: number | null // flat override; null = engine's table
  withdrawalOrder: Array<'cash' | 'taxable' | 'traditional' | 'roth' | 'hsa'> // order accounts are drawn on when income < spending
  cashReserveTarget: number // keep at least this in cash before drawing others
  survivorExpensePct: number // default share of spending that continues after the first death
  rothConversions: Array<{ year: number; amount: number }>
  giftingAnnual: number // annual exclusion/lifetime gifting out of the estate, 0 = none
  estateExemption: number | null // null = Settings > Tax constants
}

export interface Scenario {
  id: Id
  name: string
  notes: string
  /** Applied on top of the base facts by applyScenario(); only listed keys change. */
  overrides: ScenarioOverrides
}
export interface ScenarioOverrides {
  retirementAge?: Record<Id, number> // by member id
  ssClaimAge?: Record<Id, number>
  spendingMultiplier?: number // 1.1 = spend 10% more (lifestyle expenses)
  returnPct?: number
  inflationPct?: number
  assumptions?: Partial<Assumptions>
  sellBusiness?: { accountId: Id; year: number; price?: number } | null
  rothConversions?: Array<{ year: number; amount: number }>
  giftingAnnual?: number
  addExpenses?: Expense[]
  addIncome?: IncomeStream[]
}

export interface CashflowModel {
  schemaVersion: 1
  members: Member[]
  income: IncomeStream[]
  expenses: Expense[]
  accounts: Account[]
  liabilities: Liability[]
  insurance: InsurancePolicy[]
  assumptions: Assumptions
  scenarios: Scenario[]
}

export const ACCOUNT_TYPES: Array<{ id: AccountType; label: string }> = [
  { id: 'cash', label: 'Cash' }, { id: 'taxable', label: 'Taxable' }, { id: 'traditional', label: 'Traditional IRA / 401(k)' },
  { id: 'roth', label: 'Roth' }, { id: 'hsa', label: 'HSA' }, { id: 'realEstate', label: 'Real estate' }, { id: 'business', label: 'Business' },
]

const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export function defaultAssumptions(baseYear = new Date().getFullYear()): Assumptions {
  return {
    baseYear, inflationPct: 3, healthcareInflationPct: 5, salaryGrowthPct: 3, returnPct: 6, stdDevPct: 12, ssColaPct: 2.5,
    filingStatus: 'mfj', state: '', stateTaxRatePct: null,
    withdrawalOrder: ['cash', 'taxable', 'traditional', 'roth', 'hsa'], cashReserveTarget: 0, survivorExpensePct: 75,
    rothConversions: [], giftingAnnual: 0, estateExemption: null,
  }
}

export function newMember(role: MemberRole = 'primary', over: Partial<Member> = {}): Member {
  return { id: rid(), name: '', role, dob: '', retirementAge: 65, lifeExpectancy: 90, ssClaimAge: 67, ssPiaMonthly: 0, ssFra: 67, ...over }
}
export function newIncome(over: Partial<IncomeStream> = {}): IncomeStream {
  return { id: rid(), name: '', kind: 'salary', ownerId: 'joint', annual: 0, startYear: null, endYear: null, growthPct: null, taxable: true, ...over }
}
export function newExpense(over: Partial<Expense> = {}): Expense {
  return { id: rid(), name: '', kind: 'lifestyle', annual: 0, startYear: null, endYear: null, oneTimeYear: null, inflationPct: null, survivorPct: null, ...over }
}
export function newAccount(over: Partial<Account> = {}): Account {
  const type = over.type || 'taxable'
  return { id: rid(), name: '', type, ownerId: 'joint', balance: 0, contributionAnnual: 0, contributionEndYear: null, returnPct: null, stdDevPct: null, costBasis: null, saleYear: null, saleCostPct: 0, illiquid: type === 'realEstate' || type === 'business', ...over }
}
export function newLiability(over: Partial<Liability> = {}): Liability {
  return { id: rid(), name: '', kind: 'mortgage', balance: 0, ratePct: 0, paymentMonthly: 0, termMonths: 0, securedById: null, ...over }
}
export function newPolicy(over: Partial<InsurancePolicy> = {}): InsurancePolicy {
  return { id: rid(), name: '', kind: 'term', insuredId: null, ownerName: '', deathBenefit: 0, cashValue: 0, premiumAnnual: 0, premiumEndYear: null, inEstate: true, ...over }
}
export function newScenario(name = 'New scenario'): Scenario { return { id: rid(), name, notes: '', overrides: {} } }

export function emptyModel(baseYear = new Date().getFullYear()): CashflowModel {
  return { schemaVersion: 1, members: [], income: [], expenses: [], accounts: [], liabilities: [], insurance: [], assumptions: defaultAssumptions(baseYear), scenarios: [] }
}

/** Seed members from the family record (spouse names and dates of birth) so the planner does not retype them. */
export function modelFromFamily(f: { profile?: { spouse1?: { name?: string; dob?: string }; spouse2?: { name?: string; dob?: string }; state?: string } } | null | undefined, baseYear = new Date().getFullYear()): CashflowModel {
  const m = emptyModel(baseYear)
  const p = f?.profile
  if (p?.spouse1?.name || p?.spouse1?.dob) m.members.push(newMember('primary', { name: p.spouse1.name || '', dob: p.spouse1.dob || '' }))
  if (p?.spouse2?.name || p?.spouse2?.dob) m.members.push(newMember('spouse', { name: p.spouse2.name || '', dob: p.spouse2.dob || '' }))
  m.assumptions.state = (p?.state || '').slice(0, 2).toUpperCase()
  m.assumptions.filingStatus = m.members.length > 1 ? 'mfj' : 'single'
  return m
}

const num = (v: unknown, d = 0) => { const x = typeof v === 'number' ? v : Number(v); return Number.isFinite(x) ? x : d }
const nul = (v: unknown): number | null => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v))
const arr = <T,>(v: unknown, f: (x: any) => T): T[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object').map(f) : [])
const oneOf = <T extends string>(v: unknown, list: readonly T[], d: T): T => (list.includes(v as T) ? (v as T) : d)

/** Make any stored/imported/extracted JSON a valid CashflowModel (unknown fields dropped, bad values defaulted). */
export function normalizeModel(raw: any, baseYear = new Date().getFullYear()): CashflowModel {
  const d = defaultAssumptions(baseYear)
  const a = raw?.assumptions || {}
  const orderAll = ['cash', 'taxable', 'traditional', 'roth', 'hsa'] as const
  const order = Array.isArray(a.withdrawalOrder) ? (a.withdrawalOrder.filter((x: string) => (orderAll as readonly string[]).includes(x)) as Assumptions['withdrawalOrder']) : d.withdrawalOrder
  for (const k of orderAll) if (!order.includes(k)) order.push(k)
  return {
    schemaVersion: 1,
    members: arr(raw?.members, (m) => ({ ...newMember(oneOf(m.role, ['primary', 'spouse', 'dependent'] as const, 'primary')), id: str(m.id) || rid(), name: str(m.name), dob: str(m.dob), retirementAge: num(m.retirementAge, 65), lifeExpectancy: num(m.lifeExpectancy, 90), ssClaimAge: num(m.ssClaimAge, 67), ssPiaMonthly: num(m.ssPiaMonthly), ssFra: num(m.ssFra, 67) })),
    income: arr(raw?.income, (i) => ({ id: str(i.id) || rid(), name: str(i.name), kind: oneOf(i.kind, ['salary', 'business', 'socialSecurity', 'pension', 'rental', 'other'] as const, 'other'), ownerId: str(i.ownerId) || 'joint', annual: num(i.annual), startYear: nul(i.startYear), endYear: nul(i.endYear), growthPct: nul(i.growthPct), taxable: i.taxable !== false })),
    expenses: arr(raw?.expenses, (e) => ({ id: str(e.id) || rid(), name: str(e.name), kind: oneOf(e.kind, ['lifestyle', 'goal', 'education', 'healthcare', 'housing', 'other'] as const, 'other'), annual: num(e.annual), startYear: nul(e.startYear), endYear: nul(e.endYear), oneTimeYear: nul(e.oneTimeYear), inflationPct: nul(e.inflationPct), survivorPct: nul(e.survivorPct) })),
    accounts: arr(raw?.accounts, (x) => { const type = oneOf(x.type, ['taxable', 'traditional', 'roth', 'hsa', 'cash', 'realEstate', 'business'] as const, 'taxable'); return { id: str(x.id) || rid(), name: str(x.name), type, ownerId: str(x.ownerId) || 'joint', balance: num(x.balance), contributionAnnual: num(x.contributionAnnual), contributionEndYear: nul(x.contributionEndYear), returnPct: nul(x.returnPct), stdDevPct: nul(x.stdDevPct), costBasis: nul(x.costBasis), saleYear: nul(x.saleYear), saleCostPct: num(x.saleCostPct), illiquid: x.illiquid === undefined ? type === 'realEstate' || type === 'business' : Boolean(x.illiquid) } }),
    liabilities: arr(raw?.liabilities, (l) => ({ id: str(l.id) || rid(), name: str(l.name), kind: oneOf(l.kind, ['mortgage', 'heloc', 'auto', 'student', 'business', 'other'] as const, 'other'), balance: num(l.balance), ratePct: num(l.ratePct), paymentMonthly: num(l.paymentMonthly), termMonths: num(l.termMonths), securedById: str(l.securedById) || null })),
    insurance: arr(raw?.insurance, (p) => ({ id: str(p.id) || rid(), name: str(p.name), kind: oneOf(p.kind, ['term', 'whole', 'universal', 'variable', 'ltc', 'disability', 'umbrella'] as const, 'term'), insuredId: str(p.insuredId) || null, ownerName: str(p.ownerName), deathBenefit: num(p.deathBenefit), cashValue: num(p.cashValue), premiumAnnual: num(p.premiumAnnual), premiumEndYear: nul(p.premiumEndYear), inEstate: p.inEstate !== false })),
    assumptions: {
      baseYear: num(a.baseYear, d.baseYear), inflationPct: num(a.inflationPct, d.inflationPct), healthcareInflationPct: num(a.healthcareInflationPct, d.healthcareInflationPct), salaryGrowthPct: num(a.salaryGrowthPct, d.salaryGrowthPct),
      returnPct: num(a.returnPct, d.returnPct), stdDevPct: num(a.stdDevPct, d.stdDevPct), ssColaPct: num(a.ssColaPct, d.ssColaPct), filingStatus: oneOf(a.filingStatus, ['single', 'mfj', 'mfs', 'hoh'] as const, d.filingStatus),
      state: str(a.state).slice(0, 2).toUpperCase(), stateTaxRatePct: nul(a.stateTaxRatePct), withdrawalOrder: order, cashReserveTarget: num(a.cashReserveTarget), survivorExpensePct: num(a.survivorExpensePct, d.survivorExpensePct),
      rothConversions: arr(a.rothConversions, (r) => ({ year: num(r.year), amount: num(r.amount) })), giftingAnnual: num(a.giftingAnnual), estateExemption: nul(a.estateExemption),
    },
    scenarios: arr(raw?.scenarios, (s) => ({ id: str(s.id) || rid(), name: str(s.name) || 'Scenario', notes: str(s.notes), overrides: s.overrides && typeof s.overrides === 'object' ? s.overrides : {} })),
  }
}

/** Human-readable list of what is missing before a projection is meaningful. */
export function modelGaps(m: CashflowModel): string[] {
  const g: string[] = []
  if (!m.members.length) g.push('Add at least one household member with a date of birth.')
  m.members.forEach((x) => { if (!x.dob) g.push(`Date of birth for ${x.name || 'a household member'}.`) })
  if (!m.expenses.some((e) => e.kind === 'lifestyle' && e.annual > 0)) g.push('Annual lifestyle spending.')
  if (!m.income.length && !m.accounts.length) g.push('Income streams or accounts.')
  return g
}
