// Paradiem fee schedule (August 2026). Reference only — the executed advisory agreement governs.
export const DEFAULT_FEE_SCHEDULE = {
  updated: '2026-08',
  gapAnalysis: { bps: 5, min: 500, max: 6500 },
  blueprintYear1: { bps: 20, minMo: 500, maxMo: 6500 },
  blueprintYear2: { bps: 10, minMo: 350, maxMo: 4500 },
  aum: [
    { upTo: 1000000, rate: 1.5 }, { upTo: 5000000, rate: 1.25 }, { upTo: 10000000, rate: 1.0 },
    { upTo: 30000000, rate: 0.75 }, { upTo: Infinity, rate: 0.5 },
  ],
  note: 'Confirm current rates with Compliance before quoting.',
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
export function gapFee(netWorth, fs = DEFAULT_FEE_SCHEDULE) {
  const raw = (Number(netWorth) || 0) * fs.gapAnalysis.bps / 10000
  return Math.round(clamp(raw, fs.gapAnalysis.min, fs.gapAnalysis.max) / 100) * 100
}
export function blueprintMonthly(netWorth, year = 1, fs = DEFAULT_FEE_SCHEDULE) {
  const t = year === 1 ? fs.blueprintYear1 : fs.blueprintYear2
  const raw = (Number(netWorth) || 0) * t.bps / 10000 / 12
  return Math.round(clamp(raw, t.minMo, t.maxMo) / 50) * 50
}
export function aumRate(assets, fs = DEFAULT_FEE_SCHEDULE) {
  const a = Number(assets) || 0
  return (fs.aum.find((t) => a <= t.upTo) || fs.aum[fs.aum.length - 1]).rate
}
