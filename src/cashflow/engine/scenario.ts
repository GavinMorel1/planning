// Scenarios: overrides applied on top of the base facts, and side-by-side comparison.
import type { CashflowModel, Scenario } from '../types'
import type { EngineConfig, MonteCarloOptions, ScenarioComparison } from './types'
import { monteCarlo } from './monteCarlo'
import { project } from './project'

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T

/**
 * Pure: returns a new model with the scenario applied; the input is never mutated. Order: `assumptions` partial first, then the
 * dedicated keys (returnPct, inflationPct, giftingAnnual, rothConversions) so a specific key beats the generic partial.
 *  - returnPct / inflationPct change the DEFAULT assumptions (accounts and expenses with their own rate keep it).
 *  - spendingMultiplier scales lifestyle expenses only.
 *  - sellBusiness sets saleYear on the account; with `price` the starting balance is back-solved so the account is worth exactly
 *    `price` at the start of the sale year given its growth rate. Business income streams of the same owner (all, if the account
 *    is jointly owned) end the year before the sale.
 */
export function applyScenario(model: CashflowModel, scenario: Pick<Scenario, 'overrides'>): CashflowModel {
  const m = clone(model)
  const o = scenario.overrides || {}
  if (o.assumptions) Object.assign(m.assumptions, clone(o.assumptions))
  if (o.returnPct !== undefined) m.assumptions.returnPct = o.returnPct
  if (o.inflationPct !== undefined) m.assumptions.inflationPct = o.inflationPct
  if (o.giftingAnnual !== undefined) m.assumptions.giftingAnnual = o.giftingAnnual
  if (o.rothConversions) m.assumptions.rothConversions = clone(o.rothConversions)
  if (o.retirementAge) for (const mem of m.members) if (o.retirementAge[mem.id] !== undefined) mem.retirementAge = o.retirementAge[mem.id]
  if (o.ssClaimAge) for (const mem of m.members) if (o.ssClaimAge[mem.id] !== undefined) mem.ssClaimAge = o.ssClaimAge[mem.id]
  if (o.spendingMultiplier !== undefined) for (const e of m.expenses) if (e.kind === 'lifestyle') e.annual *= o.spendingMultiplier
  if (o.sellBusiness) {
    const { accountId, year, price } = o.sellBusiness
    const acct = m.accounts.find((x) => x.id === accountId)
    if (acct) {
      acct.saleYear = year
      if (price !== undefined && price >= 0) {
        const r = (acct.returnPct ?? m.assumptions.inflationPct) / 100
        acct.balance = price / Math.pow(1 + r, Math.max(0, year - m.assumptions.baseYear))
      }
      if (acct.type === 'business') {
        for (const s of m.income) {
          if (s.kind === 'business' && (acct.ownerId === 'joint' || s.ownerId === acct.ownerId) && (s.endYear === null || s.endYear >= year)) s.endYear = year - 1
        }
      }
    }
  }
  if (o.addExpenses) m.expenses.push(...clone(o.addExpenses))
  if (o.addIncome) m.income.push(...clone(o.addIncome))
  return m
}

/** Base facts first (id 'base'), then every stored scenario. successProbability is null unless Monte Carlo is requested. */
export function compareScenarios(model: CashflowModel, cfg: EngineConfig, withMonteCarlo: boolean | MonteCarloOptions = false): ScenarioComparison[] {
  const mcOpts: MonteCarloOptions | null = withMonteCarlo ? (withMonteCarlo === true ? {} : withMonteCarlo) : null
  const one = (id: string, name: string, m: CashflowModel): ScenarioComparison => ({
    id, name, projection: project(m, cfg), successProbability: mcOpts ? monteCarlo(m, cfg, mcOpts).successProbability : null,
  })
  return [one('base', 'Base facts', model), ...model.scenarios.map((s) => one(s.id, s.name, applyScenario(model, s)))]
}
