// Data for the "Family Capital Gap Analysis+" deck (under-$5M clients moving their investments): defaults, the engine-fed
// cash-flow tables and the 5-year cash needs. Everything here is plain data; src/lib/slidesPlus.js draws it.
import { runPlan, engineConfig, hasPlan } from '../cashflow/run'
import { num } from './util'

export const PLUS_SLIDES = [
  ['balance', 'Balance sheet'], ['assumptions', 'Assumptions in plan'], ['pensionSS', 'Pension and Social Security'], ['strategies', 'Potential strategies analyzed'],
  ['cashFlow5', '5-Year Cash Flow table'], ['cashNeeds', '5 Year Cash Needs (both layouts)'], ['buyOption', 'Buy-option cash strategy'], ['ownership', 'Proposed ownership'],
  ['dividend', '25 Stock Dividend strategy'], ['growth', '25 Stock Growth strategy'], ['audit', 'Performance audit'], ['lifeboat', 'Lifeboat drill'], ['lifetime', 'Lifetime Cash Flow table'],
  ['ltc', 'LTC annuity section'], ['summary', 'Plan summary'], ['timeline', 'Timeline (first year)'], ['nextSteps', 'Next steps'],
]

export const emptyInvest = () => ({ retirementCashNeed: '', cashOnHand: '', cashYear2: '', cashYear3: '', cashYear4: '', cashYear5: '', cashGrowthPct: 3, portfolioTotal: '', dividendPct: 60, growthPct: 30, cashPct: 10, potentialReturn: '', annualReturn: '', dividendYield: '', curAnnualReturn: '', curDividendYield: '', curTotalReturn: '', gainPct: '', gainAmt: '', lossPct: '', lossAmt: '' })

export const DEFAULT_GAP_PLUS = () => ({
  coverName: '', date: '',
  include: {}, // slide id -> false to drop it
  analysis: [], // extra "Observations / Solutions" topic slides that are not goals (Medicare, Insurance...)
  assumptions: { cashGrowth: '0', investGrowth: '' },
  pensionSS: [], strategies: [], planSummary: [], nextSteps: [],
  baseScenario: 'base',
  images: {}, // optional pasted pictures that replace a table slide (cashFlow5, lifetime, ltcCashFlow5, ltcLifetime)
  ltc: { amount: '', annualIncome: '', bullets: [], scenarioId: '', invest: emptyInvest() },
})

/** The family's Gap+ data with defaults filled in (older family records have none). */
export function gapPlusOf(f) {
  const d = DEFAULT_GAP_PLUS(), g = f?.gapPlus || {}
  return { ...d, ...g, assumptions: { ...d.assumptions, ...(g.assumptions || {}) }, ltc: { ...d.ltc, ...(g.ltc || {}), invest: { ...d.ltc.invest, ...(g.ltc?.invest || {}) } }, include: g.include || {}, images: g.images || {} }
}
export const slideOn = (gp, id) => gp.include?.[id] !== false

// ── engine-fed tables ───────────────────────────────────────────────────────────────────
export function planFor(model, settings, scenarioId) {
  if (!model || !hasPlan(model)) return null
  const sc = scenarioId && scenarioId !== 'base' ? model.scenarios.find((s) => s.id === scenarioId) : null
  if (scenarioId && scenarioId !== 'base' && !sc) return null
  return runPlan(model, engineConfig(settings), sc)
}

const roundK = (v) => Math.round(v)
/** Retirement cash need (year 1), cash on hand and years 2-5, from what the plan draws from savings each year. */
export function cashNeedsFromPlan(plan) {
  const rows = plan?.projection?.rows || []
  if (!rows.length) return null
  const need = (r) => roundK((r?.withdrawals?.total || 0) + (r?.shortfall || 0))
  return { retirementCashNeed: need(rows[0]), cashOnHand: roundK(rows[0]?.balances?.cash || 0), cashYear2: need(rows[1]), cashYear3: need(rows[2]), cashYear4: need(rows[3]), cashYear5: need(rows[4]) }
}

const usd = (v) => (v === 0 || v == null || Number.isNaN(v) ? '—' : `${v < 0 ? '(' : ''}$${Math.round(Math.abs(v)).toLocaleString('en-US')}${v < 0 ? ')' : ''}`)
const INCOME_LABEL = { salary: 'Salary', business: 'Business income', socialSecurity: 'Social Security', pension: 'Pension', rental: 'Rental income', rmd: 'Required distributions', other: 'Other income' }
const EXP_LABEL = { lifestyle: 'Living expenses', housing: 'Housing', healthcare: 'Healthcare', education: 'Education', goal: 'Goals and one-time', debtService: 'Debt payments', insurance: 'Insurance', gifting: 'Gifts and transfers', other: 'Other expenses' }

/** Statement-style rows for years [from, from+n): sections of {label, values[]} with totals flagged bold. */
export function fiveYearStatement(plan, n = 5) {
  const rows = (plan?.projection?.rows || []).slice(0, n)
  if (!rows.length) return null
  const members = plan.model.members
  const heads = rows.map((r) => `${r.year} (${members.map((m) => r.ages?.[m.id] ?? '—').join('/')})`)
  const opening = (i) => (i === 0 ? plan.model.accounts.reduce((t, a) => t + (num(a.balance) || 0), 0) : rows[i - 1].liquidAssets)
  const sec = []
  sec.push({ title: 'Portfolio asset balances (beginning of year)', lines: [{ label: 'Total portfolio assets', values: rows.map((_, i) => usd(opening(i))), bold: true }] })
  const kinds = Object.keys(INCOME_LABEL).filter((k) => rows.some((r) => (r.income?.[k] || 0) !== 0))
  const inflow = kinds.map((k) => ({ label: INCOME_LABEL[k], values: rows.map((r) => usd(r.income?.[k] || 0)) }))
  inflow.push({ label: 'Planned distributions from savings', values: rows.map((r) => usd(r.withdrawals?.total || 0)) })
  sec.push({ title: 'Cash inflows', lines: [...inflow, { label: 'Total cash inflows', values: rows.map((r) => usd((r.income?.total || 0) + (r.withdrawals?.total || 0))), bold: true }] })
  const ekinds = Object.keys(EXP_LABEL).filter((k) => rows.some((r) => (r.expenses?.[k] || 0) !== 0))
  const out = ekinds.map((k) => ({ label: EXP_LABEL[k], values: rows.map((r) => usd(r.expenses?.[k] || 0)) }))
  out.push({ label: 'Taxes', values: rows.map((r) => usd(r.taxes?.total || 0)) })
  const totalOut = (r) => (r.expenses?.total || 0) + (r.taxes?.total || 0)
  sec.push({ title: 'Cash outflows', lines: [...out, { label: 'Total cash outflows', values: rows.map((r) => usd(totalOut(r))), bold: true }] })
  sec.push({ title: '', lines: [{ label: 'Net cash flow', values: rows.map((r) => usd((r.surplus || 0) - (r.shortfall || 0))), bold: true }, { label: 'Total portfolio assets (end of year)', values: rows.map((r) => usd(r.liquidAssets)), bold: true }] })
  return { heads, sections: sec }
}

/** Year-by-year table for the Lifetime Cash Flow slide. */
export function lifetimeTable(plan) {
  const rows = plan?.projection?.rows || []
  if (!rows.length) return null
  const members = plan.model.members
  const cols = ['Year', 'Age', 'Total inflows', 'Total expenses', 'Taxes', 'Total outflows', 'Net cash flow', 'Total portfolio assets']
  const body = rows.map((r) => {
    const inflow = (r.income?.total || 0) + (r.withdrawals?.total || 0), outflow = (r.expenses?.total || 0) + (r.taxes?.total || 0)
    return [String(r.year), members.map((m) => r.ages?.[m.id] ?? '—').join('/'), usd(inflow), usd(r.expenses?.total || 0), usd(r.taxes?.total || 0), usd(outflow), usd((r.surplus || 0) - (r.shortfall || 0)), usd(r.liquidAssets)]
  })
  return { cols, body }
}

/** "Cash Flow Summary" for the final plan year, used by the Base Plan vs. Annuity slide. */
export function endSummary(plan) {
  const rows = plan?.projection?.rows || []
  const r = rows[rows.length - 1]
  if (!r) return null
  const inflow = (r.income?.total || 0) + (r.withdrawals?.total || 0), outflow = (r.expenses?.total || 0) + (r.taxes?.total || 0)
  return { year: r.year, lines: [['Income flows', usd(r.income?.total || 0)], ['Planned distributions', usd(r.withdrawals?.total || 0)], ['Total inflows', usd(inflow)], ['Total expenses', usd(r.expenses?.total || 0)], ['Taxes', usd(r.taxes?.total || 0)], ['Total outflows', usd(outflow)], ['Net cash flow', usd((r.surplus || 0) - (r.shortfall || 0))], ['Total portfolio assets', usd(r.liquidAssets)]], total: r.liquidAssets, endYear: r.year }
}

/** One-line description of what the engine could not do (shown in the editor so the planner knows why a table is empty). */
export function planGap(model) { return !model ? 'No cash-flow plan for this family yet.' : hasPlan(model) ? '' : 'The Cashflow tab needs household members with dates of birth plus accounts or income before it can fill these tables.' }
