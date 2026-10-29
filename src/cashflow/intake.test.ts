import { describe, it, expect } from 'vitest'
import { emptyModel, newAccount, newMember } from './types'
import { proposalsFromExtractions, acceptAll, setStatus, applyProposals, editProposal, unresolvedConflicts, findRecord, coerce, intakeSchema, INTAKE_FIELDS, auditNote, type Extraction } from './intake'

const model = () => { const m = emptyModel(2026); m.members.push(newMember('primary', { name: 'Ann Lee' })); m.accounts.push(newAccount({ name: 'Schwab IRA x1234', type: 'traditional', balance: 500000 })); return m }
const F = (field: string, value: string | number | boolean, page = 1, confidence = 0.9, quote = 'q') => ({ field, value, page, confidence, quote })
const ex = (file: string, records: Extraction['records']): Extraction => ({ source_file: file, document_type: 'statement', document_category: 'statements', records, notes: '' })

describe('intake proposals', () => {
  it('matches existing records by name or last four digits and shows current vs extracted', () => {
    const ps = proposalsFromExtractions(model(), [ex('s.pdf', [{ collection: 'accounts', record_name: 'Schwab Traditional IRA 1234', fields: [F('balance', 612345.67, 2)] }])])
    expect(ps).toHaveLength(1)
    expect(ps[0].isNew).toBe(false)
    expect(ps[0].current).toBe(500000)
    expect(ps[0].proposed).toBe(612345.67)
    expect(ps[0].source).toEqual({ file: 's.pdf', page: 2, quote: 'q' })
  })
  it('creates a new record for an unknown account and never touches others', () => {
    const m = model(); const ps = acceptAll(proposalsFromExtractions(m, [ex('f.pdf', [{ collection: 'accounts', record_name: 'Fidelity Roth 9999', fields: [F('type', 'roth'), F('balance', '$80,000')] }])]))
    const r = applyProposals(m, ps)
    expect(r.model.accounts).toHaveLength(2)
    const a = r.model.accounts.find((x) => x.name === 'Fidelity Roth 9999')!
    expect(a.type).toBe('roth'); expect(a.balance).toBe(80000)
    expect(r.model.accounts.find((x) => x.name.startsWith('Schwab'))!.balance).toBe(500000)
    expect(r.changes.every((c) => c.file === 'f.pdf')).toBe(true)
  })
  it('flags two different balances for one account as a conflict and does not accept it automatically', () => {
    const m = model()
    const ps = proposalsFromExtractions(m, [ex('jan.pdf', [{ collection: 'accounts', record_name: 'Schwab IRA 1234', fields: [F('balance', 500000)] }]), ex('mar.pdf', [{ collection: 'accounts', record_name: 'Schwab IRA 1234', fields: [F('balance', 540000)] }])])
    expect(ps.every((p) => p.conflictGroup)).toBe(true)
    expect(acceptAll(ps).every((p) => p.status === 'pending')).toBe(true)
    expect(unresolvedConflicts(ps)).toHaveLength(1)
    const chosen = setStatus(ps, ps[1].id, 'accepted')
    expect(unresolvedConflicts(chosen)).toHaveLength(0)
    expect(applyProposals(m, chosen).model.accounts[0].balance).toBe(540000)
  })
  it('choosing one conflicting value un-chooses the other', () => {
    let ps = proposalsFromExtractions(model(), [ex('a.pdf', [{ collection: 'accounts', record_name: 'Schwab IRA 1234', fields: [F('balance', 1)] }]), ex('b.pdf', [{ collection: 'accounts', record_name: 'Schwab IRA 1234', fields: [F('balance', 2)] }])])
    ps = setStatus(setStatus(ps, ps[0].id, 'accepted'), ps[1].id, 'accepted')
    expect(ps.filter((p) => p.status === 'accepted')).toHaveLength(1)
  })
  it('identical duplicates collapse, unchanged values are not auto-accepted', () => {
    const ps = proposalsFromExtractions(model(), [ex('a.pdf', [{ collection: 'accounts', record_name: 'Schwab IRA 1234', fields: [F('balance', 500000)] }]), ex('b.pdf', [{ collection: 'accounts', record_name: 'Schwab IRA 1234', fields: [F('balance', 500000)] }])])
    expect(ps.filter((p) => p.conflictGroup)).toHaveLength(0)
    expect(acceptAll(ps).filter((p) => p.status === 'accepted')).toHaveLength(0) // equals current: nothing to change
  })
  it('only accepted values are saved; rejected and pending are not', () => {
    const m = model(); let ps = proposalsFromExtractions(m, [ex('a.pdf', [{ collection: 'accounts', record_name: 'Schwab IRA 1234', fields: [F('balance', 600000), F('returnPct', 7)] }])])
    ps = setStatus(ps, ps[0].id, 'accepted'); ps = setStatus(ps, ps[1].id, 'rejected')
    const r = applyProposals(m, ps)
    expect(r.model.accounts[0].balance).toBe(600000); expect(r.model.accounts[0].returnPct).toBeNull(); expect(r.changes).toHaveLength(1)
  })
  it('lets the planner edit a value before accepting, and refuses invalid values', () => {
    const m = model(); let ps = proposalsFromExtractions(m, [ex('a.pdf', [{ collection: 'accounts', record_name: 'Schwab IRA 1234', fields: [F('balance', 600000), F('type', 'bogus')] }])])
    expect(ps[1].invalid).toBeTruthy()
    expect(setStatus(ps, ps[1].id, 'accepted')[1].status).toBe('pending')
    ps = setStatus(editProposal(ps, ps[0].id, '$601,000'), ps[0].id, 'accepted')
    expect(applyProposals(m, ps).model.accounts[0].balance).toBe(601000)
  })
  it('resolves owner names to member ids and updates assumptions', () => {
    const m = model(); const ps = acceptAll(proposalsFromExtractions(m, [ex('t.pdf', [{ collection: 'accounts', record_name: 'Schwab IRA 1234', fields: [F('ownerName', 'Ann Lee', 1, 0.8)] }, { collection: 'assumptions', record_name: 'Assumptions', fields: [F('state', 'texas'), F('filingStatus', 'mfj')] }])]))
    const r = applyProposals(m, ps)
    expect(r.model.accounts[0].ownerId).toBe(m.members[0].id)
    expect(r.model.assumptions.state).toBe('TE'); expect(r.model.assumptions.filingStatus).toBe('mfj')
  })
  it('records an audit trail with file and page', () => {
    const m = model(); const ps = acceptAll(proposalsFromExtractions(m, [ex('stmt.pdf', [{ collection: 'accounts', record_name: 'Schwab IRA 1234', fields: [F('balance', 700000, 3)] }])]))
    expect(auditNote(applyProposals(m, ps).changes)).toContain('[stmt.pdf p.3]')
  })
  it('helpers', () => {
    expect(findRecord([{ id: '1', name: 'Chase Checking 4821' }], 'Checking acct ending 4821')?.id).toBe('1')
    expect(coerce({ type: 'number', label: '' }, '(1,200)').value).toBe(-1200)
    expect(coerce({ type: 'enum', label: '', values: ['a'] }, 'B').error).toBeTruthy()
  })
  it('the schema lists every field the model can hold, and only those', () => {
    const s = intakeSchema() as any
    const names: string[] = s.properties.records.items.properties.fields.items.properties.field.enum
    for (const c of Object.values(INTAKE_FIELDS)) for (const k of Object.keys(c)) expect(names).toContain(k)
    expect(s.properties.records.items.properties.collection.enum).toEqual(Object.keys(INTAKE_FIELDS))
  })
})
