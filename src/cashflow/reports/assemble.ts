// Runs the engine for the chosen plans and packages everything a report needs (so a past report can be rebuilt from a saved model version).
import type { CashflowModel } from '../types'
import type { EngineConfig } from '../engine/types'
import { applyScenario, estateSnapshots, monteCarlo, project } from '../engine'
import type { ReportInput, ReportScenario, ReportSectionId } from './content'

export interface ReportRequest {
  familyName: string; title: string; preparedBy: string; date: string
  model: CashflowModel; scenarioIds: string[]; sections: ReportSectionId[]
  narrative: string; actionItems: string[]; disclosure: string
  cfg: EngineConfig; monteCarloRuns?: number
}

export function assembleReport(req: ReportRequest): ReportInput {
  const ids = req.scenarioIds.length ? req.scenarioIds.slice(0, 2) : ['base']
  const scenarios: ReportScenario[] = ids.map((id) => {
    const sc = id === 'base' ? null : req.model.scenarios.find((s) => s.id === id) || null
    const model = sc ? applyScenario(req.model, sc) : req.model
    const projection = project(model, req.cfg)
    const wantMc = req.sections.includes('monteCarlo') || true // headline success probability is always shown
    return { id, name: sc ? sc.name : 'Base Facts', projection, estate: estateSnapshots(model, projection, req.cfg), monteCarlo: wantMc ? monteCarlo(model, req.cfg, { runs: req.monteCarloRuns ?? 1000, seed: 1 }) : null }
  })
  return { familyName: req.familyName, title: req.title, preparedBy: req.preparedBy, date: req.date, model: req.model, scenarios, sections: req.sections, narrative: req.narrative, actionItems: req.actionItems, disclosure: req.disclosure }
}
