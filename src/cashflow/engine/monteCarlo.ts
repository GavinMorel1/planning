// Monte Carlo: the same year-step as project() with random market returns. Reproducible: mulberry32 seeded PRNG + Box-Muller.
//
// Each year one standard normal z is drawn and shared by every market account (taxable, traditional, roth, hsa); the account's
// return is mean + sd * z, clamped at -60%. Account mean = account.returnPct ?? (opts.meanReturnPct ?? assumptions.returnPct);
// sd = account.stdDevPct ?? (opts.stdDevPct ?? assumptions.stdDevPct). Cash, real estate and business grow deterministically.
// A run succeeds when no year has a shortfall.
import type { CashflowModel } from '../types'
import type { EngineConfig, MonteCarloOptions, MonteCarloResult } from './types'
import { buildPlan, expectedReturns } from './project'
import { initialState, newStepResult, stepYear } from './step'

export const MIN_RETURN = -0.6

/** mulberry32: small fast 32-bit PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Standard normal from two uniforms (Box-Muller). */
export function normal(rand: () => number): number {
  const u1 = Math.max(rand(), 1e-12), u2 = rand()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

function quantile(sorted: Float64Array, p: number): number {
  if (!sorted.length) return 0
  const x = (sorted.length - 1) * p, lo = Math.floor(x), hi = Math.ceil(x)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (x - lo)
}

export function monteCarlo(model: CashflowModel, cfg: EngineConfig, opts: MonteCarloOptions = {}): MonteCarloResult {
  const runs = Math.max(1, Math.floor(opts.runs ?? 1000))
  const seed = opts.seed ?? 1
  const ctx = buildPlan(model, cfg)
  const A = ctx.accounts, n = A.length, T = ctx.years.length
  const defMean = (opts.meanReturnPct ?? model.assumptions.returnPct) / 100
  const defSd = (opts.stdDevPct ?? model.assumptions.stdDevPct) / 100
  const base = expectedReturns(ctx)
  const mean = Float64Array.from(A, (x, i) => (x.risky && !x.meanExplicit ? defMean : base[i]))
  const sd = Float64Array.from(A, (x) => (x.risky ? (x.sdExplicit ? x.sd : defSd) : 0))
  const rand = mulberry32(seed)
  const returns = new Float64Array(n)
  const r = newStepResult(n)
  const liquid: Float64Array[] = Array.from({ length: T }, () => new Float64Array(runs))
  const failYears: number[] = []
  let successes = 0
  for (let run = 0; run < runs; run++) {
    const st = initialState(ctx)
    let failed = -1
    for (let t = 0; t < T; t++) {
      const z = normal(rand)
      for (let i = 0; i < n; i++) returns[i] = sd[i] > 0 ? Math.max(MIN_RETURN, mean[i] + sd[i] * z) : mean[i]
      stepYear(ctx, ctx.years[t], st, returns, r)
      liquid[t][run] = r.liquid
      if (failed < 0 && r.shortfall > 0) failed = ctx.years[t].year
    }
    if (failed < 0) successes++
    else failYears.push(failed)
  }
  const bands = liquid.map((v, t) => {
    v.sort()
    return { year: ctx.years[t].year, p10: quantile(v, 0.1), p25: quantile(v, 0.25), p50: quantile(v, 0.5), p75: quantile(v, 0.75), p90: quantile(v, 0.9) }
  })
  const last = bands[bands.length - 1]
  failYears.sort((x, y) => x - y)
  return {
    runs, successProbability: successes / runs, bands,
    medianEndingLiquid: last ? last.p50 : 0, p10EndingLiquid: last ? last.p10 : 0,
    failureYearMedian: failYears.length ? failYears[Math.floor((failYears.length - 1) / 2)] : null,
  }
}
