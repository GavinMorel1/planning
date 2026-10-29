// Runs the Monte Carlo off the main thread so the page stays responsive.
import { monteCarlo } from '../engine'
self.onmessage = (e: MessageEvent) => {
  const { id, model, cfg, opts } = e.data
  try { (self as unknown as Worker).postMessage({ id, result: monteCarlo(model, cfg, opts) }) } catch (err) { (self as unknown as Worker).postMessage({ id, error: String((err as Error)?.message || err) }) }
}
