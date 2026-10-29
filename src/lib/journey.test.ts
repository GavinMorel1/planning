import { describe, it, expect } from 'vitest'
import { computeJourney, DEFAULT_JOURNEY, type TaskLite } from './journey'

const T = (projectName: string, status: string, over: Partial<TaskLite> = {}): TaskLite => ({ id: Math.random().toString(36).slice(2), title: 'x', projectName, workflow: 'gap', status, ...over })
const today = '2026-11-20'

describe('journey', () => {
  it('starts at Intake with nothing done', () => {
    const j = computeJourney({ tasks: [], createdAt: '2026-11-10', today })
    expect(j.currentIndex).toBe(0)
    expect(j.stages[0].status).toBe('current')
    expect(j.stages).toHaveLength(11)
    expect(j.track).toBe('unknown')
  })
  it('moves forward when every task of a stage is done, and implies earlier task-less stages', () => {
    const tasks = [T('Send Contract (Docusign) One Week Before Kick Off Call', 'done', { doneAt: '2026-11-12T10:00:00Z' }), T('Schedule Kick Off Call in GHL', 'done', { doneAt: '2026-11-11T10:00:00Z' }), T('Associate RM 1 hour before Kick Off Call', 'todo')]
    const j = computeJourney({ tasks, createdAt: '2026-11-01', today })
    expect(j.stages[3].status).toBe('done') // Agreement and Payment
    expect(j.stages[3].completedAt).toBe('2026-11-12')
    expect(j.stages[0].source).toBe('implied') // Intake, interview, FCA presentation implied by later progress
    expect(j.stages[4].status).toBe('current') // Onboarding
    expect(j.daysInStage).toBe(8) // since 12 Nov
    expect(j.nextTasks).toHaveLength(1)
  })
  it('a stage with one open task stays current', () => {
    const j = computeJourney({ tasks: [T('Kick Off Call', 'done'), T('Kick Off Call', 'working')], createdAt: '2026-11-01', today })
    expect(j.stages[5].status === 'current' || j.stages[4].status === 'current').toBe(true)
    expect(j.stages[5].taskDone).toBe(1)
    expect(j.stages[5].taskTotal).toBe(2)
  })
  it('manual completion works for stages without tasks', () => {
    const j = computeJourney({ tasks: [], manual: { s01: '2026-11-15' }, createdAt: '2026-11-01', today })
    expect(j.stages[0].status).toBe('done')
    expect(j.stages[0].source).toBe('manual')
    expect(j.currentIndex).toBe(1)
  })
  it('flags a stall after 14 days with no completed work', () => {
    const tasks = [T('Kick Off Call', 'working', { createdAt: '2026-10-20' } as Partial<TaskLite>)]
    expect(computeJourney({ tasks, createdAt: '2026-10-20', today: '2026-11-20' }).stalled).toBe(true)
    expect(computeJourney({ tasks, createdAt: '2026-10-20', today: '2026-11-01' }).stalled).toBe(false)
    const fresh = [T('Kick Off Call', 'done', { doneAt: '2026-11-18T00:00:00Z' }), T('Kick Off Call', 'todo')]
    expect(computeJourney({ tasks: fresh, createdAt: '2026-09-01', today: '2026-11-20' }).stalled).toBe(false)
  })
  it('detects the track from the workflows present, with a manual override', () => {
    expect(computeJourney({ tasks: [T('Kick Off Call', 'todo', { workflow: 'gapblueprint' })], today }).track).toBe('gapblueprint')
    expect(computeJourney({ tasks: [T('Kick Off Call', 'todo')], today }).track).toBe('gap')
    expect(computeJourney({ tasks: [T('Kick Off Call', 'todo')], today, trackOverride: 'gapblueprint' }).track).toBe('gapblueprint')
  })
  it('Blueprint Engagement uses survey and design workflows, and the journey completes', () => {
    const all = DEFAULT_JOURNEY.flatMap((d) => d.steps.map((s) => T(s, 'done', { doneAt: '2026-11-18T00:00:00Z' }))).concat([T('Initial Tasks', 'done', { workflow: 'survey', doneAt: '2026-11-19T00:00:00Z' })])
    const j = computeJourney({ tasks: all, createdAt: '2026-01-01', today })
    expect(j.complete).toBe(true)
    expect(j.pct).toBe(100)
    expect(j.stalled).toBe(false)
  })
  it('honours edited stage names and mappings', () => {
    const j = computeJourney({ stages: [{ id: 'a', name: 'First', steps: ['Alpha'], workflows: [] }, { id: 'b', name: 'Second', steps: ['Beta'], workflows: [] }], tasks: [T('alpha', 'done'), T('Beta', 'todo')], today })
    expect(j.stages.map((s) => s.status)).toEqual(['done', 'current'])
  })
})
