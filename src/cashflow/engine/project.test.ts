import { describe, it, expect } from 'vitest'
import { emptyModel, newAccount, newExpense, newIncome, newLiability, newMember, newPolicy, type CashflowModel } from '../types'
import { project } from './project'
import { CFG, sampleModel } from './testModel'
import type { Projection, ProjectionRow } from './types'

const row = (p: Projection, year: number): ProjectionRow => {
  const r = p.rows.find((x) => x.year === year)
  if (!r) throw new Error(`no row for ${year}`)
  return r
}
const FLAT = { ...CFG, indexTables: false } // brackets and deductions stay at 2026 values so by-hand arithmetic holds in every year

/** Retired couple (60 and 58, no earnings) with simple round numbers: no growth, no inflation, no tax on plain cash/basis draws. */
function retired(over: (m: CashflowModel) => void): CashflowModel {
  const m = emptyModel(2026)
  m.members.push(newMember('primary', { id: 'ann', name: 'Ann', dob: '1966-01-01', retirementAge: 50, lifeExpectancy: 90 }), newMember('spouse', { id: 'bo', name: 'Bo', dob: '1968-01-01', retirementAge: 50, lifeExpectancy: 90 }))
  m.expenses.push(newExpense({ id: 'life', kind: 'lifestyle', annual: 100_000 }))
  Object.assign(m.assumptions, { inflationPct: 0, returnPct: 0, salaryGrowthPct: 0, ssColaPct: 0, filingStatus: 'mfj', state: '', stateTaxRatePct: 0, survivorExpensePct: 100 })
  over(m)
  return m
}

describe('year 1 of the sample family (all numbers checked by hand)', () => {
  const p = project(sampleModel(), CFG)
  const y1 = p.rows[0]

  it('runs from the base year to the last life expectancy', () => {
    expect(p.startYear).toBe(2026)
    expect(p.endYear).toBe(2058) // Bo born 1968 + 90
    expect(p.rows).toHaveLength(33)
    expect(p.firstDeathYear).toBe(2056) // Ann born 1966 + 90
  })

  it('federal income tax follows the 2026 MFJ bracket schedule', () => {
    // Wages 300,000; standard deduction (nobody is 65) 32,200; taxable 267,800.
    //   10% x 24,800                         =  2,480
    //   12% x (100,800 - 24,800 =  76,000)   =  9,120
    //   22% x (211,400 - 100,800 = 110,600)  = 24,332
    //   24% x (267,800 - 211,400 =  56,400)  = 13,536
    //                                         = 49,468
    expect(y1.taxes.agi).toBe(300_000)
    expect(y1.taxes.taxableIncome).toBe(267_800)
    expect(y1.taxes.federalIncome).toBeCloseTo(49_468, 6)
    expect(y1.taxes.marginalRate).toBe(24)
    expect(y1.taxes.federalLtcg).toBe(0)
    expect(y1.taxes.niit).toBe(0)
  })

  it('payroll tax: 6.2% to the wage base, 1.45% on all wages, 0.9% over 250,000', () => {
    // 11,439 (6.2% x 184,500) + 4,350 (1.45% x 300,000) + 450 (0.9% x 50,000) = 16,239
    expect(y1.taxes.payroll).toBeCloseTo(16_239, 6)
    expect(y1.taxes.total).toBeCloseTo(49_468 + 16_239, 6)
  })

  it('grows each account one year and sweeps the surplus', () => {
    // surplus = 300,000 - 120,000 - 65,707 = 114,293; cash (200,000) is already above six months of spending (60,000), so it goes to taxable.
    expect(y1.surplus).toBeCloseTo(114_293, 6)
    expect(y1.accountBalances.ira).toBeCloseTo(2_120_000, 6) // 2,000,000 x 1.06
    expect(y1.accountBalances.roth).toBeCloseTo(530_000, 6) // 500,000 x 1.06
    expect(y1.accountBalances.chk).toBeCloseTo(204_000, 6) // cash at 2%
    expect(y1.accountBalances.brk).toBeCloseTo(1_060_000 + 114_293, 6)
    expect(y1.balances.traditional).toBeCloseTo(2_120_000, 6)
    expect(y1.netWorth).toBeCloseTo(2_120_000 + 530_000 + 204_000 + 1_174_293, 6)
    expect(y1.liquidAssets).toBeCloseTo(y1.netWorth, 6)
    expect(y1.withdrawals.total).toBe(0)
    expect(y1.shortfall).toBe(0)
  })

  it('fills every field of every row and keeps cash flow balanced', () => {
    for (const r of p.rows) {
      expect(Object.keys(r.income).sort()).toEqual(['business', 'other', 'pension', 'rental', 'rmd', 'salary', 'socialSecurity', 'total'])
      expect(Object.keys(r.expenses).sort()).toEqual(['debtService', 'education', 'gifting', 'goal', 'healthcare', 'housing', 'insurance', 'lifestyle', 'other', 'total'])
      expect(Object.keys(r.balances).sort()).toEqual(['business', 'cash', 'hsa', 'realEstate', 'roth', 'taxable', 'traditional'])
      expect(r.income.total).toBeCloseTo(r.income.salary + r.income.business + r.income.socialSecurity + r.income.pension + r.income.rental + r.income.other + r.income.rmd, 6)
      // income + withdrawals = spending + taxes + contributions + surplus - unfunded
      expect(r.income.total + r.withdrawals.total).toBeCloseTo(r.expenses.total + r.taxes.total + r.contributions + r.surplus - r.shortfall, 3)
      expect(r.taxes.total).toBeCloseTo(r.taxes.federalIncome + r.taxes.federalLtcg + r.taxes.niit + r.taxes.state + r.taxes.payroll, 6)
    }
  })

  it('records retirement years, net worth at retirement and lifetime taxes', () => {
    expect(p.retirementYear).toEqual({ ann: 2031, bo: 2033 })
    expect(p.netWorthAtRetirement).toBe(row(p, 2031).netWorth) // primary = Ann, 1966 + 65
    expect(p.netWorthAtEnd).toBe(p.rows[p.rows.length - 1].netWorth)
    expect(p.lifetimeTaxes).toBeCloseTo(p.rows.reduce((s, r) => s + r.taxes.total, 0), 6)
    expect(p.depletionYear).toBeNull()
  })

  it('stops salary the year before the retirement year, grows it at the salary growth rate', () => {
    expect(row(p, 2030).income.salary).toBeCloseTo(300_000 * 1.03 ** 4, 6)
    expect(row(p, 2031).income.salary).toBe(0)
    expect(row(p, 2031).taxes.payroll).toBe(0)
  })

  it('is deterministic and does not mutate the model', () => {
    const m = sampleModel(), copy = JSON.stringify(m)
    expect(JSON.stringify(project(m, CFG))).toEqual(JSON.stringify(project(m, CFG)))
    expect(JSON.stringify(m)).toBe(copy)
  })
})

describe('required minimum distributions', () => {
  const p = project(sampleModel(), CFG)
  it('start at 75 for someone born in 1966, using the Uniform Lifetime divisor 24.6', () => {
    expect(row(p, 2040).income.rmd).toBe(0) // Ann is 74
    const prior = row(p, 2040).accountBalances.ira
    const r = row(p, 2041) // Ann is 75
    expect(r.income.rmd).toBeCloseTo(prior / 24.6, 6)
    expect(r.income.total).toBeCloseTo(r.income.rmd, 6) // no other income by then
    expect(r.accountBalances.ira).toBeCloseTo((prior - prior / 24.6 - r.withdrawals.traditional) * 1.06, 4)
  })
  it('are taxed as ordinary income', () => {
    const r = row(p, 2041)
    // AGI = RMD + any IRA draw + gains realised on taxable draws (cash is long gone by 2041)
    expect(r.taxes.agi).toBeGreaterThanOrEqual(r.income.rmd + r.withdrawals.traditional - 1e-6)
    expect(r.taxes.federalIncome).toBeGreaterThan(0)
  })
})

describe('withdrawal order', () => {
  const m = retired((x) => {
    x.accounts.push(
      newAccount({ id: 'chk', type: 'cash', balance: 150_000 }),
      newAccount({ id: 'brk', type: 'taxable', balance: 200_000, costBasis: 200_000 }), // no embedded gain, so draws are untaxed
      newAccount({ id: 'ira', type: 'traditional', balance: 300_000 }),
      newAccount({ id: 'rth', type: 'roth', balance: 100_000 }),
      newAccount({ id: 'hsa', type: 'hsa', balance: 50_000 }),
    )
  })
  const p = project(m, FLAT)
  it('draws cash, then taxable, then traditional, then Roth, then HSA', () => {
    expect(row(p, 2026).withdrawals).toMatchObject({ cash: 100_000, taxable: 0, traditional: 0, total: 100_000 })
    expect(row(p, 2027).withdrawals).toMatchObject({ cash: 50_000, taxable: 50_000, traditional: 0 })
    expect(row(p, 2028).withdrawals).toMatchObject({ cash: 0, taxable: 100_000, traditional: 0 })
    expect(row(p, 2029).withdrawals).toMatchObject({ taxable: 50_000 })
    // 2029 needs 50,000 more from the IRA; the draw is taxable, so it is grossed up for its own tax. With standard deduction
    // 32,200 and the 10% bracket (to 24,800 taxable): X - 0.10 * (X - 32,200) = 50,000  =>  X = 46,780 / 0.9 = 51,977.78.
    expect(row(p, 2029).withdrawals.traditional).toBeCloseTo(51_977.78, 1)
    expect(row(p, 2029).taxes.federalIncome).toBeCloseTo(0.1 * (51_977.78 - 32_200), 1)
    expect(row(p, 2029).taxes.agi).toBeCloseTo(51_977.78, 1)
  })
  it('then exhausts the IRA before touching the Roth, and the Roth before the HSA', () => {
    const roth = p.rows.findIndex((r) => r.withdrawals.roth > 0), ira = p.rows.map((r) => r.withdrawals.traditional > 0).lastIndexOf(true), hsa = p.rows.findIndex((r) => r.withdrawals.hsa > 0)
    expect(ira).toBeGreaterThanOrEqual(0)
    expect(roth).toBeGreaterThanOrEqual(ira)
    expect(hsa).toBeGreaterThan(roth)
    expect(row(p, 2026 + roth).accountBalances.ira).toBeCloseTo(0, 6)
  })
  it('keeps the cash reserve target until nothing else is left', () => {
    const r = project(retired((x) => {
      x.assumptions.cashReserveTarget = 50_000
      x.accounts.push(newAccount({ id: 'chk', type: 'cash', balance: 150_000 }), newAccount({ id: 'brk', type: 'taxable', balance: 100_000, costBasis: 100_000 }))
    }), FLAT)
    expect(row(r, 2026).withdrawals.cash).toBe(100_000) // 150,000 - 50,000 reserve
    expect(row(r, 2027)).toMatchObject({ withdrawals: { cash: 0, taxable: 100_000 } })
    expect(row(r, 2028).withdrawals.cash).toBe(50_000) // taxable gone: the reserve is used
    expect(row(r, 2028).shortfall).toBe(50_000)
  })
  it('realises capital gain in proportion to basis when drawing from a taxable account', () => {
    const r = project(retired((x) => {
      x.accounts.push(newAccount({ id: 'brk', type: 'taxable', balance: 400_000, costBasis: 100_000 }))
    }), FLAT)
    // 100,000 + tax drawn from 400,000 with 75% embedded gain. Gain realised = 75% of the draw, all inside the 0% LTCG band
    // (taxable income = gain - 32,200 deduction < 98,900), so there is no tax and the draw is exactly 100,000.
    const y = row(r, 2026)
    expect(y.withdrawals.taxable).toBeCloseTo(100_000, 6)
    expect(y.taxes.agi).toBeCloseTo(75_000, 6)
    expect(y.taxes.total).toBe(0)
    expect(y.accountBalances.brk).toBeCloseTo(300_000, 6)
  })
})

describe('shortfall', () => {
  it('is recorded when assets are too small, with the first such year as depletionYear', () => {
    const p = project(retired((x) => { x.accounts.push(newAccount({ id: 'chk', type: 'cash', balance: 250_000 })) }), FLAT)
    expect(row(p, 2026).shortfall).toBe(0)
    expect(row(p, 2027).shortfall).toBe(0)
    expect(row(p, 2028).shortfall).toBe(50_000) // 250,000 covers 2.5 years of 100,000
    expect(row(p, 2029).shortfall).toBe(100_000)
    expect(p.depletionYear).toBe(2028)
    expect(p.warnings.some((w) => w.includes('2028'))).toBe(true)
    expect(row(p, 2028).liquidAssets).toBe(0)
  })
  it('does not draw on illiquid real estate', () => {
    const p = project(retired((x) => { x.accounts.push(newAccount({ id: 're', type: 'realEstate', balance: 5_000_000, costBasis: 1_000_000 })) }), FLAT)
    expect(p.depletionYear).toBe(2026)
    expect(row(p, 2026).accountBalances.re).toBe(5_000_000)
  })
})

describe('survivor', () => {
  const m = retired((x) => {
    x.members[0].lifeExpectancy = 80 // Ann dies 2046, Bo (90) lives to 2058
    x.assumptions.inflationPct = 3
    x.assumptions.survivorExpensePct = 75
    x.income.push(newIncome({ id: 'pen', kind: 'pension', ownerId: 'bo', annual: 100_000, growthPct: 0 }))
    x.accounts.push(newAccount({ id: 'brk', type: 'taxable', balance: 5_000_000, costBasis: 5_000_000 }))
  })
  const p = project(m, FLAT)
  it('records the first death and removes the decedent from the ages map after the death year', () => {
    expect(p.firstDeathYear).toBe(2046)
    expect(row(p, 2046).ages).toEqual({ ann: 80, bo: 78 })
    expect(row(p, 2047).ages).toEqual({ ann: null, bo: 79 })
  })
  it('steps lifestyle spending down to the survivor percentage from the year after the first death', () => {
    expect(row(p, 2046).expenses.lifestyle).toBeCloseTo(100_000 * 1.03 ** 20, 6)
    expect(row(p, 2047).expenses.lifestyle).toBeCloseTo(0.75 * 100_000 * 1.03 ** 21, 6)
  })
  it('an expense survivorPct overrides the default', () => {
    const q = project(retired((x) => { x.members[0].lifeExpectancy = 80; x.expenses[0].survivorPct = 50; x.accounts.push(newAccount({ id: 'chk', type: 'cash', balance: 9e6 })) }), FLAT)
    expect(row(q, 2047).expenses.lifestyle).toBeCloseTo(50_000, 6)
  })
  it('switches the filing status to single the year after the first death', () => {
    // Pension 100,000 (growth 0). 2046: MFJ, both 65+  -> deduction 32,200 + 2 x 1,650 = 35,500 -> taxable 64,500.
    // 2047: single, one taxpayer 65+ -> deduction 16,100 + 2,050 = 18,150 -> taxable 81,850.
    expect(row(p, 2046).taxes.taxableIncome).toBeCloseTo(64_500, 6)
    expect(row(p, 2047).taxes.taxableIncome).toBeCloseTo(81_850, 6)
  })
  it('the pension ends with its owner and the plan warns about it', () => {
    const q = project(retired((x) => { x.members[1].lifeExpectancy = 70; x.income.push(newIncome({ id: 'pen', name: 'Bo pension', kind: 'pension', ownerId: 'bo', annual: 50_000, growthPct: 0 })); x.accounts.push(newAccount({ id: 'chk', type: 'cash', balance: 9e6 })) }), FLAT)
    expect(row(q, 2038).income.pension).toBe(50_000) // Bo dies 2038 (1968 + 70)
    expect(row(q, 2039).income.pension).toBe(0)
    expect(q.warnings.some((w) => w.includes('Bo pension'))).toBe(true)
  })
})

describe('Roth conversions', () => {
  const base = sampleModel()
  const conv = sampleModel()
  conv.assumptions.rothConversions = [{ year: 2031, amount: 100_000 }]
  const a = project(base, FLAT), b = project(conv, FLAT)
  it('move balance from traditional to Roth', () => {
    const iraBefore = row(a, 2030).accountBalances.ira, rothBefore = row(a, 2030).accountBalances.roth
    expect(row(b, 2031).accountBalances.ira).toBeCloseTo((iraBefore - 100_000) * 1.06, 4)
    expect(row(b, 2031).accountBalances.roth).toBeCloseTo((rothBefore + 100_000) * 1.06, 4)
    expect(row(a, 2031).accountBalances.ira).toBeCloseTo(iraBefore * 1.06, 4)
  })
  it('count as ordinary income and are taxed', () => {
    // Retired in 2031, no other income: AGI = 100,000. Ann is 65, so the deduction is 32,200 + 1,650 = 33,850 and taxable income 66,150.
    // Tax = 2,480 (10% x 24,800) + 12% x (66,150 - 24,800 = 41,350) = 2,480 + 4,962 = 7,442
    const y = row(b, 2031)
    expect(y.taxes.rothConversion).toBe(100_000)
    expect(y.taxes.agi).toBeCloseTo(100_000, 6)
    expect(y.taxes.taxableIncome).toBeCloseTo(66_150, 6)
    expect(y.taxes.federalIncome).toBeCloseTo(7_442, 6)
    expect(row(a, 2031).taxes.rothConversion).toBe(0)
    expect(row(a, 2031).taxes.federalIncome).toBe(0)
    expect(y.income.total).toBe(0) // a conversion is not cash income
  })
  it('creates a Roth landing account when the family has none, and is capped at the traditional balance', () => {
    const m = retired((x) => { x.accounts.push(newAccount({ id: 'ira', type: 'traditional', balance: 60_000 }), newAccount({ id: 'chk', type: 'cash', balance: 1e6 })); x.assumptions.rothConversions = [{ year: 2026, amount: 100_000 }] })
    const p = project(m, FLAT)
    expect(row(p, 2026).taxes.rothConversion).toBe(60_000)
    expect(row(p, 2026).balances.roth).toBe(60_000)
    expect(p.warnings.some((w) => w.includes('Roth conversion'))).toBe(true)
  })
})

describe('sale of real estate', () => {
  const m = retired((x) => {
    x.accounts.push(newAccount({ id: 'chk', type: 'cash', balance: 200_000 }), newAccount({ id: 're', type: 'realEstate', balance: 1_000_000, costBasis: 450_000, saleYear: 2026, saleCostPct: 5 }))
  })
  const p = project(m, FLAT)
  const y = row(p, 2026)
  it('moves net proceeds to cash and removes the asset', () => {
    expect(y.saleProceeds).toBeCloseTo(950_000, 6)
    expect(y.accountBalances.re).toBe(0)
  })
  it('taxes the gain over basis as long-term capital gain plus NIIT', () => {
    // Net 950,000 - basis 450,000 = gain 500,000 (no other income). Deduction 32,200 shelters part of it: taxable gain 467,800.
    //   0% to 98,900;  15% x (467,800 - 98,900 = 368,900) = 55,335.   NIIT 3.8% x (500,000 - 250,000) = 9,500.
    expect(y.taxes.federalIncome).toBe(0)
    expect(y.taxes.federalLtcg).toBeCloseTo(55_335, 6)
    expect(y.taxes.niit).toBeCloseTo(9_500, 6)
    expect(y.taxes.agi).toBeCloseTo(500_000, 6)
  })
  it('pays secured debt out of the proceeds and stops the payments', () => {
    const q = project(retired((x) => {
      x.accounts.push(newAccount({ id: 'chk', type: 'cash', balance: 200_000 }), newAccount({ id: 're', type: 'realEstate', balance: 1_000_000, costBasis: 1_000_000, saleYear: 2028, saleCostPct: 0 }))
      x.liabilities.push(newLiability({ id: 'mtg', balance: 300_000, ratePct: 0, paymentMonthly: 1_000, termMonths: 300, securedById: 're' }))
    }), FLAT)
    expect(row(q, 2027).expenses.debtService).toBe(12_000)
    expect(row(q, 2027).liabilityBalance).toBe(300_000 - 24_000)
    expect(row(q, 2028).saleProceeds).toBeCloseTo(1_000_000 - 276_000, 6)
    expect(row(q, 2028).expenses.debtService).toBe(0)
    expect(row(q, 2028).liabilityBalance).toBe(0)
  })
})

describe('contributions', () => {
  it('flow into accounts while working; traditional contributions reduce taxable income', () => {
    const m = sampleModel()
    m.accounts.find((x) => x.id === 'ira')!.contributionAnnual = 23_000
    const roth = m.accounts.find((x) => x.id === 'roth')!
    roth.contributionAnnual = 7_000; roth.ownerId = 'ann' // a joint account would keep receiving until the later spouse retires (2033)
    const p = project(m, CFG)
    expect(row(p, 2026).contributions).toBe(30_000)
    expect(row(p, 2026).taxes.agi).toBe(300_000 - 23_000)
    expect(row(p, 2026).accountBalances.ira).toBeCloseTo(2_000_000 * 1.06 + 23_000, 6)
    expect(row(p, 2026).accountBalances.roth).toBeCloseTo(500_000 * 1.06 + 7_000, 6)
    expect(row(p, 2030).contributions).toBe(30_000)
    expect(row(p, 2031).contributions).toBe(0) // Ann retires
  })
  it('stop at contributionEndYear', () => {
    const m = sampleModel()
    const roth = m.accounts.find((x) => x.id === 'roth')!
    roth.contributionAnnual = 7_000; roth.contributionEndYear = 2027
    const p = project(m, CFG)
    expect(row(p, 2027).contributions).toBe(7_000)
    expect(row(p, 2028).contributions).toBe(0)
  })
})

describe('expenses and debt', () => {
  it('inflate by kind, honour windows, one-time items and overrides', () => {
    const m = retired((x) => {
      x.assumptions.inflationPct = 3; x.assumptions.healthcareInflationPct = 5
      x.expenses.push(
        newExpense({ id: 'hc', kind: 'healthcare', annual: 10_000 }),
        newExpense({ id: 'edu', kind: 'education', annual: 40_000, startYear: 2028, endYear: 2029, inflationPct: 6 }),
        newExpense({ id: 'boat', kind: 'goal', annual: 80_000, oneTimeYear: 2030 }),
      )
      x.assumptions.giftingAnnual = 18_000
      x.accounts.push(newAccount({ id: 'chk', type: 'cash', balance: 9e6 }))
    })
    const p = project(m, FLAT)
    expect(row(p, 2027).expenses.lifestyle).toBeCloseTo(100_000 * 1.03, 6)
    expect(row(p, 2027).expenses.healthcare).toBeCloseTo(10_000 * 1.05, 6)
    expect(row(p, 2027).expenses.education).toBe(0)
    expect(row(p, 2028).expenses.education).toBeCloseTo(40_000 * 1.06 ** 2, 6)
    expect(row(p, 2030).expenses.education).toBe(0)
    expect(row(p, 2030).expenses.goal).toBeCloseTo(80_000 * 1.03 ** 4, 6)
    expect(row(p, 2029).expenses.goal).toBe(0)
    expect(row(p, 2027).expenses.gifting).toBeCloseTo(18_000 * 1.03, 6)
    const r = row(p, 2027).expenses
    expect(r.total).toBeCloseTo(r.lifestyle + r.healthcare + r.gifting, 6)
  })
  it('amortises a mortgage from balance, rate and term and ends it when paid', () => {
    const m = retired((x) => {
      x.accounts.push(newAccount({ id: 'chk', type: 'cash', balance: 9e6 }))
      x.liabilities.push(newLiability({ id: 'mtg', balance: 120_000, ratePct: 0, termMonths: 24 })) // 5,000 a month for two years
    })
    const p = project(m, FLAT)
    expect(row(p, 2026).expenses.debtService).toBe(60_000)
    expect(row(p, 2026).liabilityBalance).toBe(60_000)
    expect(row(p, 2027).liabilityBalance).toBe(0)
    expect(row(p, 2028).expenses.debtService).toBe(0)
  })
  it('counts insurance premiums until the premium end year or the insured\'s death', () => {
    const m = retired((x) => {
      x.accounts.push(newAccount({ id: 'chk', type: 'cash', balance: 9e6 }))
      x.insurance.push(newPolicy({ id: 'p1', insuredId: 'ann', premiumAnnual: 3_000, premiumEndYear: 2028 }))
    })
    const p = project(m, FLAT)
    expect(row(p, 2028).expenses.insurance).toBe(3_000)
    expect(row(p, 2029).expenses.insurance).toBe(0)
  })
})

describe('Social Security in the projection', () => {
  const m = sampleModel()
  m.members[0].ssPiaMonthly = 3_000; m.members[0].ssClaimAge = 67 // Ann: claims in 2033
  m.members[1].ssPiaMonthly = 1_000; m.members[1].ssClaimAge = 67 // Bo: claims in 2035
  const p = project(m, CFG)
  it('pays each member from the year they reach their claim age, with COLA from the base year', () => {
    expect(row(p, 2032).income.socialSecurity).toBe(0)
    expect(row(p, 2033).income.socialSecurity).toBeCloseTo(36_000 * 1.025 ** 7, 6)
    expect(row(p, 2035).income.socialSecurity).toBeCloseTo((36_000 + 12_000) * 1.025 ** 9, 6)
  })
  it('lets the survivor keep the larger of the two benefits', () => {
    expect(row(p, 2056).income.socialSecurity).toBeCloseTo((36_000 + 12_000) * 1.025 ** 30, 6) // Ann dies this year, still paid
    expect(row(p, 2057).income.socialSecurity).toBeCloseTo(36_000 * 1.025 ** 31, 6) // Bo now gets Ann's larger benefit alone
  })
  it('taxes at most 85% of benefits', () => {
    for (const r of p.rows) expect(r.taxes.ssTaxable).toBeLessThanOrEqual(0.85 * r.income.socialSecurity + 1e-6)
    expect(row(p, 2057).taxes.ssTaxable).toBeGreaterThan(0)
  })
  it('a socialSecurity stream with an amount overrides the automatic benefit for its owner', () => {
    const q = sampleModel()
    q.members[0].ssPiaMonthly = 3_000
    q.income.push(newIncome({ id: 'ssm', kind: 'socialSecurity', ownerId: 'ann', annual: 24_000, startYear: 2034 }))
    const r = project(q, CFG)
    expect(row(r, 2033).income.socialSecurity).toBe(0)
    expect(row(r, 2034).income.socialSecurity).toBeCloseTo(24_000 * 1.025 ** 8, 6)
  })
  it('claiming at 62 pays 70% of the benefit at 67', () => {
    const q = sampleModel()
    q.members[0].ssPiaMonthly = 3_000; q.members[0].ssClaimAge = 62
    const r = project(q, CFG)
    expect(row(r, 2028).income.socialSecurity).toBeCloseTo(0.7 * 36_000 * 1.025 ** 2, 6)
  })
})

describe('other income and edge cases', () => {
  it('pension and rental streams grow at inflation within their window', () => {
    const m = sampleModel()
    m.income.push(newIncome({ id: 'pen', kind: 'pension', ownerId: 'ann', annual: 50_000, startYear: 2031, endYear: 2040 }), newIncome({ id: 'rent', kind: 'rental', ownerId: 'joint', annual: 20_000 }))
    const p = project(m, CFG)
    expect(row(p, 2030).income.pension).toBe(0)
    expect(row(p, 2031).income.pension).toBeCloseTo(50_000 * 1.03 ** 5, 6)
    expect(row(p, 2041).income.pension).toBe(0)
    expect(row(p, 2028).income.rental).toBeCloseTo(20_000 * 1.03 ** 2, 6)
  })
  it('salary with an explicit endYear is not cut at retirement', () => {
    const m = sampleModel()
    m.income[0].endYear = 2033
    expect(row(project(m, CFG), 2033).income.salary).toBeGreaterThan(0)
  })
  it('indexes brackets and the standard deduction by inflation after the tax year', () => {
    const indexed = project(retired((m) => { m.assumptions.inflationPct = 3; m.income.push(newIncome({ kind: 'pension', ownerId: 'ann', annual: 100_000, growthPct: 0 })) }), CFG)
    const flat = project(retired((m) => { m.assumptions.inflationPct = 3; m.income.push(newIncome({ kind: 'pension', ownerId: 'ann', annual: 100_000, growthPct: 0 })) }), FLAT)
    expect(row(indexed, 2026).taxes.taxableIncome).toBeCloseTo(100_000 - 32_200, 6)
    // 2036: Ann 70 and Bo 68 are both 65+, so the deduction is 32,200 + 2 x 1,650 = 35,500, indexed 10 years at 3%
    expect(row(indexed, 2036).taxes.taxableIncome).toBeCloseTo(100_000 - 35_500 * 1.03 ** 10, 6)
    expect(row(flat, 2036).taxes.taxableIncome).toBeCloseTo(100_000 - 35_500, 6)
  })
  it('uses the state table, and assumptions.stateTaxRatePct overrides it', () => {
    const mk = (state: string, pct: number | null) => retired((m) => { m.assumptions.state = state; m.assumptions.stateTaxRatePct = pct; m.income.push(newIncome({ kind: 'pension', ownerId: 'ann', annual: 100_000, growthPct: 0 })) })
    expect(row(project(mk('CA', null), FLAT), 2026).taxes.state).toBeCloseTo(9_300, 6)
    expect(row(project(mk('TX', null), FLAT), 2026).taxes.state).toBe(0)
    expect(row(project(mk('CA', 2), FLAT), 2026).taxes.state).toBeCloseTo(2_000, 6)
  })
  it('flags IRMAA only once someone is 65+ and MAGI is over the threshold', () => {
    const m = retired((x) => { x.income.push(newIncome({ kind: 'pension', ownerId: 'ann', annual: 250_000, growthPct: 0 })) })
    const p = project(m, FLAT)
    expect(row(p, 2026).taxes.irmaaFlag).toBe(false) // 60 years old
    expect(row(p, 2031).taxes.irmaaFlag).toBe(true) // Ann is 65, MAGI 250,000 > 218,000
  })
  it('warns about missing inputs and still returns a projection for an empty model', () => {
    const p = project(emptyModel(2026), CFG)
    expect(p.rows.length).toBeGreaterThan(0)
    expect(p.warnings.some((w) => w.includes('members'))).toBe(true)
    const q = project(retired((m) => { m.members[0].dob = '' }), CFG)
    expect(q.warnings.some((w) => w.includes('Date of birth'))).toBe(true)
  })
  it('a single person has no first death and a single filing status throughout', () => {
    const m = retired((x) => { x.members.pop(); x.assumptions.filingStatus = 'single'; x.accounts.push(newAccount({ type: 'cash', balance: 9e6 })) })
    const p = project(m, FLAT)
    expect(p.firstDeathYear).toBeNull()
    expect(p.endYear).toBe(2056)
  })
})
