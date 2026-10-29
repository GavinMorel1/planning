import { describe, it, expect } from 'vitest'
import { assembleReport } from './assemble'
import { buildSections, narrativeFacts, DEFAULT_SECTIONS, usd, usdK } from './content'
import { newScenario } from '../types'
import { sampleModel, CFG } from '../engine/testModel'

const req = (over = {}) => ({ familyName: 'Test Family', title: 'Cash Flow Analysis', preparedBy: 'planner@paradiem.org', date: '2026-10-29', model: sampleModel(), scenarioIds: ['base'], sections: DEFAULT_SECTIONS, narrative: 'Hello.', actionItems: ['Do a thing', ''], disclosure: 'Hypothetical.', cfg: CFG, monteCarloRuns: 200, ...over })

describe('report content', () => {
  it('produces every selected section with numbers that match the projection', () => {
    const inp = assembleReport(req())
    const secs = buildSections(inp)
    expect(secs.map((s) => s.id)).toEqual(['summary', 'netWorth', 'cashFlowTable', 'incomeVsExpenses', 'retirement', 'monteCarlo', 'tax', 'estate', 'assumptions', 'actions'])
    const P = inp.scenarios[0].projection
    const kp = secs[0].blocks[0]
    expect(kp.type === 'kpis' && kp.items.find((i) => i.label === 'Net worth at end of plan')!.values[0]).toBe(usdK(P.netWorthAtEnd))
    const table = secs.find((s) => s.id === 'cashFlowTable')!.blocks[0]
    expect(table.type === 'table' && table.rows).toHaveLength(P.rows.length)
    expect(table.type === 'table' && table.rows[0].nw).toBe(usd(P.rows[0].netWorth))
  })
  it('flags shortfall years in the cash flow table', () => {
    const m = sampleModel(); m.accounts.forEach((a) => { a.balance = Math.round(a.balance / 40) })
    const inp = assembleReport(req({ model: m }))
    const t = buildSections(inp).find((s) => s.id === 'cashFlowTable')!.blocks[0]
    expect(inp.scenarios[0].projection.depletionYear).not.toBeNull()
    expect(t.type === 'table' && (t.flagRows || []).length).toBeGreaterThan(0)
  })
  it('compares two scenarios with a comparison table', () => {
    const m = sampleModel(); const sc = newScenario('Retire early'); sc.overrides = { retirementAge: Object.fromEntries(m.members.map((x) => [x.id, x.retirementAge - 4])) }; m.scenarios.push(sc)
    const inp = assembleReport(req({ model: m, scenarioIds: ['base', sc.id] }))
    const comp = buildSections(inp).find((s) => s.id === 'comparison')!
    expect(comp.blocks[0].type === 'table' && comp.blocks[0].columns.map((c) => c.label)).toEqual(['Measure', 'Base Facts', 'Retire early'])
    expect(inp.scenarios[1].projection.netWorthAtRetirement).not.toBe(inp.scenarios[0].projection.netWorthAtRetirement)
  })
  it('omits unchecked sections and empty action items; hands Claude only computed numbers', () => {
    const inp = assembleReport(req({ sections: ['netWorth'], actionItems: ['', ' '] }))
    expect(buildSections(inp).map((s) => s.id)).toEqual(['summary', 'netWorth'])
    const facts = JSON.stringify(narrativeFacts(inp))
    expect(facts).not.toContain('planner@paradiem.org')
    expect(facts).toContain('probabilityOfSuccessPct')
  })
  it('is reproducible: same inputs give identical content', () => {
    expect(JSON.stringify(buildSections(assembleReport(req())))).toBe(JSON.stringify(buildSections(assembleReport(req()))))
  })
})
