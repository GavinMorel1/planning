// "Where you are in the Journey": eleven stages whose progress comes from the family's Work tab (completed tasks), with a
// manual override for stages that have no tasks (Intake, interview, ...). Names and the Work steps that complete each stage
// are editable in Settings > Journey.

export interface StageDef { id: string; name: string; steps: string[]; workflows: string[] }

export const DEFAULT_JOURNEY: StageDef[] = [
  { id: 's01', name: 'Intake', steps: [], workflows: [] },
  { id: 's02', name: 'FCA Interview', steps: [], workflows: [] },
  { id: 's03', name: 'FCA Presentation', steps: [], workflows: [] },
  { id: 's04', name: 'Agreement and Payment', steps: ['Schedule Kick Off Call in GHL', 'Send Contract (Docusign) One Week Before Kick Off Call'], workflows: [] },
  { id: 's05', name: 'Onboarding', steps: ['Associate RM 1 hour before Kick Off Call'], workflows: [] },
  { id: 's06', name: 'Kickoff Call', steps: ['Kick Off Call', 'Post-Kick Off Call'], workflows: [] },
  { id: 's07', name: 'Data Gathering', steps: ['Check In Call 1', 'Review Information', 'Check In Call 2'], workflows: [] },
  { id: 's08', name: 'Retreat', steps: ['Host Initial Retreat', 'Post-Initial Retreat'], workflows: [] },
  { id: 's09', name: 'Gap Analysis Presentation', steps: ['Create Presentation', 'Review Presentation', 'Presentation Meeting'], workflows: [] },
  { id: 's10', name: 'Gap Analysis Wrap-up', steps: ['After Presentation Meeting'], workflows: [] },
  { id: 's11', name: 'Blueprint Engagement', steps: [], workflows: ['survey', 'design'] },
]

export interface TaskLite {
  id: string
  title: string
  projectName: string
  workflow: string // '' when the project did not come from a workflow template
  status: string // todo | working | stuck | waiting | done | na
  owner?: string
  due?: string
  doneAt?: string
  updatedAt?: string
  order?: number
}
export type StageStatus = 'done' | 'current' | 'upcoming'
export interface StageState {
  def: StageDef
  index: number
  status: StageStatus
  taskTotal: number
  taskDone: number
  completedAt: string | null // ISO date when the stage finished (latest task completion or the manual date)
  source: 'tasks' | 'manual' | 'implied' | 'none'
}
export type Track = 'gap' | 'gapblueprint' | 'unknown'
export interface Journey {
  stages: StageState[]
  currentIndex: number // index of the current stage; stages.length when everything is complete
  complete: boolean
  pct: number
  daysInStage: number
  stageEnteredAt: string
  lastProgress: string
  daysSinceProgress: number
  stalled: boolean
  track: Track
  nextTasks: TaskLite[] // open tasks of the current stage, soonest due first
}

const closed = (s: string) => s === 'done' || s === 'na'
const day = (iso: string | undefined | null) => (iso ? String(iso).slice(0, 10) : '')
const diffDays = (a: string, b: string) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000)
const maxDay = (xs: string[]) => xs.filter(Boolean).sort().pop() || ''

export const STALL_DAYS = 14

export function stageTasks(def: StageDef, tasks: TaskLite[]): TaskLite[] {
  const steps = new Set(def.steps.map((s) => s.trim().toLowerCase()).filter(Boolean))
  const wfs = new Set(def.workflows)
  return tasks.filter((t) => (steps.size && steps.has(t.projectName.trim().toLowerCase())) || (wfs.size && wfs.has(t.workflow)))
}

export function trackOf(tasks: TaskLite[], override?: string): Track {
  if (override === 'gap' || override === 'gapblueprint') return override
  if (tasks.some((t) => t.workflow === 'gapblueprint')) return 'gapblueprint'
  if (tasks.some((t) => t.workflow === 'gap')) return 'gap'
  return 'unknown'
}

export function computeJourney(input: { stages?: StageDef[]; tasks: TaskLite[]; manual?: Record<string, string>; createdAt?: string; today?: string; trackOverride?: string }): Journey {
  const stages = input.stages && input.stages.length ? input.stages : DEFAULT_JOURNEY
  const today = input.today || new Date().toISOString().slice(0, 10)
  const manual = input.manual || {}
  const created = day(input.createdAt) || today
  const per = stages.map((def) => {
    const ts = stageTasks(def, input.tasks)
    return { def, ts, done: ts.filter((t) => closed(t.status)) }
  })
  // A stage with no tasks is "implied" complete when any LATER stage already has a finished task.
  const laterProgress = (i: number) => per.slice(i + 1).some((p) => p.done.length > 0)
  const states: StageState[] = per.map((p, i) => {
    const m = day(manual[p.def.id])
    let source: StageState['source'] = 'none'
    let completedAt: string | null = null
    let finished = false
    if (p.ts.length && p.done.length === p.ts.length) { finished = true; source = 'tasks'; completedAt = maxDay(p.done.map((t) => day(t.doneAt) || day(t.updatedAt))) || today }
    else if (m) { finished = true; source = 'manual'; completedAt = m }
    else if (!p.ts.length && laterProgress(i)) { finished = true; source = 'implied' }
    return { def: p.def, index: i, status: finished ? 'done' : 'upcoming', taskTotal: p.ts.length, taskDone: p.done.length, completedAt, source }
  })
  const firstOpen = states.findIndex((s) => s.status !== 'done')
  const currentIndex = firstOpen === -1 ? states.length : firstOpen
  if (firstOpen !== -1) states[firstOpen].status = 'current'
  const complete = firstOpen === -1
  const prevDone = states.slice(0, currentIndex).map((s) => s.completedAt || '')
  const stageEnteredAt = maxDay(prevDone) || created
  const earliestTask = input.tasks.map((t) => day((t as { createdAt?: string }).createdAt)).filter(Boolean).sort()[0] || ''
  const lastProgress = maxDay([created, earliestTask, ...input.tasks.filter((t) => closed(t.status)).map((t) => day(t.doneAt) || day(t.updatedAt)), ...Object.values(manual).map(day)])
  const daysSinceProgress = Math.max(0, diffDays(today, lastProgress))
  const cur = per[currentIndex]
  const nextTasks = cur ? cur.ts.filter((t) => !closed(t.status)).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || (a.order || 0) - (b.order || 0)) : []
  return {
    stages: states, currentIndex, complete,
    pct: Math.round((states.filter((s) => s.status === 'done').length / states.length) * 100),
    daysInStage: Math.max(0, diffDays(today, stageEnteredAt)), stageEnteredAt, lastProgress, daysSinceProgress,
    stalled: !complete && daysSinceProgress >= STALL_DAYS, track: trackOf(input.tasks, input.trackOverride), nextTasks,
  }
}
