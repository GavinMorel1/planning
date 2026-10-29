// Runs the projection (instant) and Monte Carlo (in a Web Worker, debounced) for a model + scenario.
import { useEffect, useMemo, useRef, useState } from 'react'
import { engineConfig, hasPlan, runPlan, runMonteCarlo } from '../run'

let worker = null, seq = 0
const pending = new Map()
function mcAsync(model, cfg, opts) {
  try {
    if (!worker) { worker = new Worker(new URL('./mcWorker.ts', import.meta.url), { type: 'module' }); worker.onmessage = (e) => { const p = pending.get(e.data.id); if (!p) return; pending.delete(e.data.id); e.data.error ? p.reject(new Error(e.data.error)) : p.resolve(e.data.result) } }
    const id = ++seq
    return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); worker.postMessage({ id, model, cfg, opts }) })
  } catch { return Promise.resolve().then(() => runMonteCarlo(model, cfg, opts)) } // no Worker support: run here
}

export function usePlan(baseModel, settings, scenario, { auto = true, mcOpts } = {}) {
  const cfg = useMemo(() => engineConfig(settings), [settings.tax]) // eslint-disable-line react-hooks/exhaustive-deps
  const ready = hasPlan(baseModel)
  const run = useMemo(() => { if (!ready) return null; try { return runPlan(baseModel, cfg, scenario) } catch (e) { return { error: e } } }, [baseModel, cfg, scenario, ready])
  const [mc, setMc] = useState(null)
  const [busy, setBusy] = useState(false)
  const tick = useRef(0)
  const key = run && !run.error ? JSON.stringify([run.model, mcOpts]) : ''
  const go = (opts) => {
    if (!run || run.error) return
    const t = ++tick.current
    setBusy(true)
    mcAsync(run.model, cfg, { ...(mcOpts || {}), ...(opts || {}) }).then((r) => { if (t === tick.current) { setMc(r); setBusy(false) } }).catch(() => { if (t === tick.current) setBusy(false) })
  }
  useEffect(() => {
    if (!auto || !key) return undefined
    const id = setTimeout(() => go(), 500)
    return () => clearTimeout(id)
  }, [key, auto]) // eslint-disable-line react-hooks/exhaustive-deps
  return { cfg, run: run && !run.error ? run : null, error: run?.error ? String(run.error.message || run.error) : '', ready, mc, mcBusy: busy, runMc: go }
}
