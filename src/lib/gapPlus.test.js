import { describe, it, expect } from 'vitest'
import { gapPlusOf, slideOn, planFor, cashNeedsFromPlan, fiveYearStatement, lifetimeTable, endSummary } from './gapPlus'
import { goalsFromText } from './claude'
import { sampleModel } from '../cashflow/engine/testModel'
import { newExpense, newIncome } from '../cashflow/types'

const settings = { tax: { '2026': { estateExemption: 15_000_000, estateTaxRate: 40 } } }

describe('Gap Analysis+ data', () => {
  it('fills defaults for a family that has no gapPlus record', () => {
    const gp = gapPlusOf({})
    expect(gp.assumptions.cashGrowth).toBe('0')
    expect(gp.ltc.invest.cashGrowthPct).toBe(3)
    expect(slideOn(gp, 'balance')).toBe(true)
    expect(slideOn({ ...gp, include: { balance: false } }, 'balance')).toBe(false)
  })
  it('keeps what the planner saved and fills what is missing', () => {
    const gp = gapPlusOf({ gapPlus: { coverName: 'A & B', ltc: { amount: '300000' } } })
    expect(gp.coverName).toBe('A & B'); expect(gp.ltc.amount).toBe('300000'); expect(gp.ltc.bullets).toEqual([])
  })
  it('builds the 5-year statement, cash needs and lifetime table from the engine', () => {
    const plan = planFor(sampleModel(), settings, 'base')
    const st = fiveYearStatement(plan)
    expect(st.heads).toHaveLength(5)
    expect(st.heads[0]).toMatch(/^\d{4} \(\d+\/\d+\)$/)
    const labels = st.sections.flatMap((s) => s.lines.map((l) => l.label))
    expect(labels).toContain('Total cash inflows'); expect(labels).toContain('Total cash outflows'); expect(labels).toContain('Net cash flow')
    st.sections.forEach((s) => s.lines.forEach((l) => expect(l.values).toHaveLength(5)))
    const needs = cashNeedsFromPlan(plan)
    expect(needs.retirementCashNeed).toBe(Math.round(plan.projection.rows[0].withdrawals.total + plan.projection.rows[0].shortfall))
    const life = lifetimeTable(plan)
    expect(life.body).toHaveLength(plan.projection.rows.length)
    expect(life.body[0]).toHaveLength(life.cols.length)
    expect(endSummary(plan).total).toBe(plan.projection.rows[plan.projection.rows.length - 1].liquidAssets)
  })
  it('an annuity scenario changes the plan: premium leaves savings and income is added', () => {
    const m = sampleModel(); const base = new Date().getFullYear()
    m.scenarios.push({ id: 'ltc', name: 'LTC annuity', notes: '', overrides: { addExpenses: [newExpense({ name: 'premium', kind: 'other', annual: 300000, oneTimeYear: m.assumptions.baseYear })], addIncome: [newIncome({ name: 'annuity', kind: 'other', annual: 15038, startYear: m.assumptions.baseYear })] } })
    const a = planFor(m, settings, 'base'), b = planFor(m, settings, 'ltc')
    expect(b.projection.rows[0].expenses.total).toBeGreaterThan(a.projection.rows[0].expenses.total + 250000)
    expect(b.projection.rows[0].income.total).toBeGreaterThan(a.projection.rows[0].income.total)
    expect(planFor(m, settings, 'missing')).toBeNull()
    expect(base).toBeGreaterThan(2000)
  })
  it('returns null (so the deck prints a note) when there is no usable plan', () => {
    expect(planFor(null, settings, 'base')).toBeNull()
    expect(fiveYearStatement(null)).toBeNull(); expect(cashNeedsFromPlan(null)).toBeNull(); expect(lifetimeTable(null)).toBeNull()
  })
})

describe('goals from pasted text', () => {
  it('splits one goal per line and strips bullets and numbering', () => {
    const g = goalsFromText('1. Maintain lifestyle spending at $96,000\n• Leave an inheritance\n- Give $8,000 a year\n\n  ')
    expect(g.map((x) => x.text)).toEqual(['Maintain lifestyle spending at $96,000', 'Leave an inheritance', 'Give $8,000 a year'])
  })
})
