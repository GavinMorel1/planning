// Glue between the app (settings, scenarios) and the pure engine in ./engine.
import type { CashflowModel, Scenario } from './types'
import type { EngineConfig, EstateSnapshot, MonteCarloOptions, MonteCarloResult, Projection } from './engine/types'
import { applyScenario, estateSnapshots, monteCarlo, project } from './engine'

type TaxSettings = { estateExemption?: number; estateTaxRate?: number }
/** Engine constants from Settings > Tax constants (the current year's table, else the first one). */
export function engineConfig(settings: { tax?: Record<string, TaxSettings> } | undefined, year = new Date().getFullYear()): EngineConfig {
  const t = settings?.tax?.[String(year)] || Object.values(settings?.tax || {})[0] || {}
  return { estateExemption: Number(t.estateExemption) || 15_000_000, estateTaxRate: Number(t.estateTaxRate) || 40, portability: true, indexTables: true }
}

export interface PlanRun { model: CashflowModel; projection: Projection; estate: EstateSnapshot[] }
export const hasPlan = (m: CashflowModel) => m.members.some((x) => x.dob) && (m.accounts.length > 0 || m.income.length > 0)

export function runPlan(base: CashflowModel, cfg: EngineConfig, scenario?: Pick<Scenario, 'overrides'> | null): PlanRun {
  const model = scenario ? applyScenario(base, scenario as Scenario) : base
  const projection = project(model, cfg)
  return { model, projection, estate: estateSnapshots(model, projection, cfg) }
}
export function runMonteCarlo(model: CashflowModel, cfg: EngineConfig, opts?: MonteCarloOptions): MonteCarloResult { return monteCarlo(model, cfg, opts) }

export interface Metric { label: string; before: string; after: string; better: boolean | null }
const k = (v: number) => { const a = Math.abs(v); const s = a >= 1e6 ? `$${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `$${Math.round(a / 1e3)}K` : `$${Math.round(a)}`; return v < 0 ? `−${s}` : s }
/** Before/after headline numbers after a model change (used by AI intake and scenario comparison). */
export function compareRuns(a: PlanRun, b: PlanRun, mcA?: MonteCarloResult | null, mcB?: MonteCarloResult | null): Metric[] {
  const pa = a.projection, pb = b.projection
  const out: Metric[] = []
  if (mcA && mcB) out.push({ label: 'Probability of success', before: `${Math.round(mcA.successProbability * 100)}%`, after: `${Math.round(mcB.successProbability * 100)}%`, better: mcB.successProbability === mcA.successProbability ? null : mcB.successProbability > mcA.successProbability })
  out.push({ label: 'Net worth today', before: k(pa.rows[0]?.netWorth ?? 0), after: k(pb.rows[0]?.netWorth ?? 0), better: (pb.rows[0]?.netWorth ?? 0) === (pa.rows[0]?.netWorth ?? 0) ? null : (pb.rows[0]?.netWorth ?? 0) > (pa.rows[0]?.netWorth ?? 0) })
  out.push({ label: 'Net worth at retirement', before: k(pa.netWorthAtRetirement), after: k(pb.netWorthAtRetirement), better: pb.netWorthAtRetirement === pa.netWorthAtRetirement ? null : pb.netWorthAtRetirement > pa.netWorthAtRetirement })
  out.push({ label: 'Net worth at end of plan', before: k(pa.netWorthAtEnd), after: k(pb.netWorthAtEnd), better: pb.netWorthAtEnd === pa.netWorthAtEnd ? null : pb.netWorthAtEnd > pa.netWorthAtEnd })
  out.push({ label: 'Lifetime taxes', before: k(pa.lifetimeTaxes), after: k(pb.lifetimeTaxes), better: pb.lifetimeTaxes === pa.lifetimeTaxes ? null : pb.lifetimeTaxes < pa.lifetimeTaxes })
  out.push({ label: 'First shortfall year', before: pa.depletionYear ? String(pa.depletionYear) : 'None', after: pb.depletionYear ? String(pb.depletionYear) : 'None', better: (pa.depletionYear ?? 9999) === (pb.depletionYear ?? 9999) ? null : (pb.depletionYear ?? 9999) > (pa.depletionYear ?? 9999) })
  return out
}
