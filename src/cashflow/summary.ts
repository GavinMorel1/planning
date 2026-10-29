// "What changed" after AI intake: re-runs the projection on the model before and after and compares the headline numbers.
import type { CashflowModel } from './types'
import { compareRuns, engineConfig, hasPlan, runPlan, runMonteCarlo } from './run'

export async function summarizeChange(before: CashflowModel, after: CashflowModel, settings: Parameters<typeof engineConfig>[0]) {
  if (!hasPlan(after)) return null
  const cfg = engineConfig(settings)
  const a = hasPlan(before) ? runPlan(before, cfg) : null
  const b = runPlan(after, cfg)
  if (!a) return compareRuns(b, b)
  const mc = (m: CashflowModel) => runMonteCarlo(m, cfg, { runs: 300, seed: 7 }) // lighter than the Monte Carlo tab, same seed for both sides
  return compareRuns(a, b, mc(before), mc(after))
}
