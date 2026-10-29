import { describe, it, expect } from 'vitest'
import { emptyModel, normalizeModel, modelFromFamily, modelGaps, newAccount, newMember } from './types'

describe('cash-flow model', () => {
  it('seeds members from the family profile', () => {
    const m = modelFromFamily({ profile: { spouse1: { name: 'Ann', dob: '1965-04-02' }, spouse2: { name: 'Bo', dob: '1967-09-30' }, state: 'tx' } }, 2026)
    expect(m.members.map((x) => x.name)).toEqual(['Ann', 'Bo'])
    expect(m.assumptions.filingStatus).toBe('mfj')
    expect(m.assumptions.state).toBe('TX')
  })
  it('normalizes junk into a valid model', () => {
    const m = normalizeModel({ members: [{ name: 5, retirementAge: 'abc' }], accounts: [{ type: 'weird', balance: '1,000' }, null], assumptions: { withdrawalOrder: ['roth'], inflationPct: '2.5' } }, 2026)
    expect(m.members[0].retirementAge).toBe(65)
    expect(m.accounts).toHaveLength(1)
    expect(m.accounts[0].type).toBe('taxable')
    expect(m.assumptions.inflationPct).toBe(2.5)
    expect(m.assumptions.withdrawalOrder).toEqual(['roth', 'cash', 'taxable', 'traditional', 'hsa']) // missing types appended
  })
  it('round-trips an already valid model unchanged', () => {
    const base = emptyModel(2026); base.members.push(newMember('primary', { name: 'Ann', dob: '1965-01-01' })); base.accounts.push(newAccount({ name: 'IRA', type: 'traditional', balance: 500000 }))
    expect(normalizeModel(JSON.parse(JSON.stringify(base)), 2026)).toEqual(base)
  })
  it('real estate and business default to illiquid', () => {
    expect(newAccount({ type: 'realEstate' }).illiquid).toBe(true)
    expect(newAccount({ type: 'roth' }).illiquid).toBe(false)
  })
  it('lists what is missing', () => { expect(modelGaps(emptyModel(2026)).length).toBeGreaterThan(0) })
})
