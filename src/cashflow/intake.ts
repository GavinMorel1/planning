// AI intake: turns what Claude read from statements, tax returns, eMoney reports, paystubs and policies into PROPOSED changes
// to the cash-flow model. Nothing is saved until a planner accepts it. Every proposal keeps its source file, page and confidence,
// conflicting values for the same field are flagged (never silently overwritten), and applying returns an audit trail.
import type { CashflowModel, Id } from './types'
import { newAccount, newExpense, newIncome, newLiability, newMember, newPolicy, normalizeModel } from './types'

export type Collection = 'members' | 'income' | 'expenses' | 'accounts' | 'liabilities' | 'insurance' | 'assumptions'
export type FieldType = 'string' | 'number' | 'year' | 'pct' | 'bool' | 'date' | 'enum'
export interface FieldSpec { type: FieldType; label: string; values?: readonly string[] }

const E = {
  incomeKind: ['salary', 'business', 'socialSecurity', 'pension', 'rental', 'other'],
  expenseKind: ['lifestyle', 'goal', 'education', 'healthcare', 'housing', 'other'],
  accountType: ['taxable', 'traditional', 'roth', 'hsa', 'cash', 'realEstate', 'business'],
  liabilityKind: ['mortgage', 'heloc', 'auto', 'student', 'business', 'other'],
  policyKind: ['term', 'whole', 'universal', 'variable', 'ltc', 'disability', 'umbrella'],
  filing: ['single', 'mfj', 'mfs', 'hoh'],
} as const

/** The fields Claude may extract, per collection. `ownerName` / `insuredName` are resolved to member ids when applied. */
export const INTAKE_FIELDS: Record<Collection, Record<string, FieldSpec>> = {
  members: { dob: { type: 'date', label: 'Date of birth' }, retirementAge: { type: 'number', label: 'Retirement age' }, lifeExpectancy: { type: 'number', label: 'Life expectancy' }, ssClaimAge: { type: 'number', label: 'Social Security claim age' }, ssPiaMonthly: { type: 'number', label: 'Social Security benefit at full retirement age (monthly)' } },
  income: { kind: { type: 'enum', label: 'Kind', values: E.incomeKind }, ownerName: { type: 'string', label: 'Owner' }, annual: { type: 'number', label: 'Annual amount' }, startYear: { type: 'year', label: 'Start year' }, endYear: { type: 'year', label: 'End year' }, growthPct: { type: 'pct', label: 'Growth %' }, taxable: { type: 'bool', label: 'Taxable' } },
  expenses: { kind: { type: 'enum', label: 'Kind', values: E.expenseKind }, annual: { type: 'number', label: 'Annual amount' }, startYear: { type: 'year', label: 'Start year' }, endYear: { type: 'year', label: 'End year' }, oneTimeYear: { type: 'year', label: 'One-time year' }, inflationPct: { type: 'pct', label: 'Inflation %' } },
  accounts: { type: { type: 'enum', label: 'Type', values: E.accountType }, ownerName: { type: 'string', label: 'Owner' }, balance: { type: 'number', label: 'Balance' }, contributionAnnual: { type: 'number', label: 'Annual contribution' }, contributionEndYear: { type: 'year', label: 'Contributions end' }, returnPct: { type: 'pct', label: 'Return %' }, costBasis: { type: 'number', label: 'Cost basis' } },
  liabilities: { kind: { type: 'enum', label: 'Kind', values: E.liabilityKind }, balance: { type: 'number', label: 'Balance' }, ratePct: { type: 'pct', label: 'Interest rate %' }, paymentMonthly: { type: 'number', label: 'Monthly payment' }, termMonths: { type: 'number', label: 'Remaining term (months)' } },
  insurance: { kind: { type: 'enum', label: 'Kind', values: E.policyKind }, insuredName: { type: 'string', label: 'Insured' }, ownerName: { type: 'string', label: 'Owner / trust' }, deathBenefit: { type: 'number', label: 'Death benefit' }, cashValue: { type: 'number', label: 'Cash value' }, premiumAnnual: { type: 'number', label: 'Annual premium' }, premiumEndYear: { type: 'year', label: 'Premiums end' }, inEstate: { type: 'bool', label: 'In taxable estate' } },
  assumptions: { filingStatus: { type: 'enum', label: 'Filing status', values: E.filing }, state: { type: 'string', label: 'State' }, inflationPct: { type: 'pct', label: 'Inflation %' }, returnPct: { type: 'pct', label: 'Return %' } },
}
export const COLLECTION_LABEL: Record<Collection, string> = { members: 'Household member', income: 'Income', expenses: 'Expense', accounts: 'Account', liabilities: 'Liability', insurance: 'Insurance', assumptions: 'Assumptions' }

export interface ExtractedField { field: string; value: string | number | boolean | null; page: number | null; confidence: number; quote: string }
export interface ExtractedRecord { collection: Collection; record_name: string; fields: ExtractedField[] }
export interface Extraction { source_file: string; document_type: string; document_category: string; records: ExtractedRecord[]; notes: string }

/** JSON schema handed to Claude (output_config.format) so its answer matches the model exactly. */
export function intakeSchema() {
  const fieldNames = [...new Set(Object.values(INTAKE_FIELDS).flatMap((c) => Object.keys(c)))]
  return {
    type: 'object', additionalProperties: false, required: ['source_file', 'document_type', 'document_category', 'records', 'notes'],
    properties: {
      source_file: { type: 'string' },
      document_type: { type: 'string', description: 'e.g. brokerage statement, 401(k) statement, Form 1040, paystub, life insurance policy, eMoney report, mortgage statement' },
      document_category: { type: 'string', description: 'Best match for the Documents checklist: wills, rlt, poa, insurance, pfs, statements, ssa, tax_personal, tax_gift, tax_business, emoney, other' },
      records: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['collection', 'record_name', 'fields'], properties: {
        collection: { type: 'string', enum: Object.keys(INTAKE_FIELDS) },
        record_name: { type: 'string', description: 'The account/stream/policy/person name exactly as the document shows it (include the last 4 digits of an account number if shown). For assumptions use "Assumptions".' },
        fields: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['field', 'value', 'page', 'confidence', 'quote'], properties: {
          field: { type: 'string', enum: fieldNames },
          value: { type: ['string', 'number', 'boolean'] },
          page: { type: ['integer', 'null'], description: 'Page number in the document where the value appears, null if the file has no pages' },
          confidence: { type: 'number', description: '0 to 1: how sure you are this value is correct and refers to this record' },
          quote: { type: 'string', description: 'Short exact text from the document that supports the value' },
        } } },
      } } },
      notes: { type: 'string', description: 'Anything a planner should double-check. Empty string if none.' },
    },
  }
}

export const INTAKE_SYSTEM_RULES = `You extract planning facts for a cash-flow model from ONE uploaded document. Rules: never invent or estimate a value; if a field is not stated in the document, do not output it. Dollar amounts are plain numbers in US dollars (no symbols). Percentages are plain numbers (6.5 means 6.5%). Dates are yyyy-mm-dd. For every value give the page number, a short exact quote and a confidence from 0 to 1 (lower it when the document is ambiguous, old, or the value refers to a different person or account). Use the account/policy/person name exactly as printed. Statement balances are as of the statement date; mention that date in the quote. Do not extract Social Security numbers or full account numbers.`

/** Field catalogue as prompt text so Claude knows each collection's fields and types. */
export function intakeFieldGuide(): string {
  return (Object.keys(INTAKE_FIELDS) as Collection[]).map((c) => `${c}: ${Object.entries(INTAKE_FIELDS[c]).map(([k, s]) => `${k} (${s.type === 'enum' ? s.values!.join('|') : s.type})`).join(', ')}`).join('\n')
}
export function existingRecordHints(m: CashflowModel): string {
  const names = (xs: Array<{ name: string }>) => xs.map((x) => x.name).filter(Boolean).join('; ') || '(none)'
  return `Existing records (reuse these exact names when the document is about the same thing):\nmembers: ${names(m.members)}\naccounts: ${names(m.accounts)}\nincome: ${names(m.income)}\nexpenses: ${names(m.expenses)}\nliabilities: ${names(m.liabilities)}\ninsurance: ${names(m.insurance)}`
}

/* ───────────────────────── proposals ───────────────────────── */

export type ProposalStatus = 'pending' | 'accepted' | 'rejected'
export interface Proposal {
  id: string
  collection: Collection
  recordId: Id | null // existing record this updates, null = a new record
  recordKey: string // groups fields of one record (new records)
  recordLabel: string
  isNew: boolean
  field: string
  label: string
  current: string | number | boolean | null
  proposed: string | number | boolean | null // what will be saved (editable by the planner)
  extracted: string | number | boolean | null // what Claude read, never changed
  source: { file: string; page: number | null; quote: string }
  confidence: number
  status: ProposalStatus
  conflictGroup: string | null // proposals that disagree about the same field share a group id; one must be chosen
  unchanged: boolean // extracted equals current
  invalid: string | null // why the value cannot be saved (bad enum/number), proposal is then not acceptable
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
const last4 = (s: string) => (s.match(/(\d{4})\D*$/) || [])[1] || ''
const num = (v: unknown): number | null => { if (typeof v === 'number') return Number.isFinite(v) ? v : null; const t = String(v ?? '').replace(/[$,%\s]/g, '').replace(/^\((.*)\)$/, '-$1'); if (t === '') return null; const x = Number(t); return Number.isFinite(x) ? x : null }

type AnyRec = { id: Id; name: string; [k: string]: unknown }
/** Find the existing record a document's name refers to: same name, one name containing the other, or same last 4 digits. */
export function findRecord(list: AnyRec[], name: string): AnyRec | null {
  const n = norm(name); if (!n) return null
  const exact = list.find((r) => norm(r.name) === n); if (exact) return exact
  const l4 = last4(name)
  const near = list.find((r) => { const m = norm(r.name); return m.length >= 5 && n.length >= 5 && (m.includes(n) || n.includes(m)) })
  if (near) return near
  if (l4) { const same = list.filter((r) => last4(r.name) === l4); if (same.length === 1) return same[0] }
  return null
}

export function coerce(spec: FieldSpec, v: unknown): { value: string | number | boolean | null; error: string | null } {
  if (v === null || v === undefined || v === '') return { value: null, error: 'Empty value' }
  switch (spec.type) {
    case 'number': case 'pct': { const x = num(v); return x === null ? { value: null, error: 'Not a number' } : { value: x, error: null } }
    case 'year': { const x = num(v); return x !== null && x >= 1900 && x <= 2200 ? { value: Math.round(x), error: null } : { value: null, error: 'Not a year' } }
    case 'bool': { if (typeof v === 'boolean') return { value: v, error: null }; const t = String(v).toLowerCase(); return ['true', 'yes', 'y', '1'].includes(t) ? { value: true, error: null } : ['false', 'no', 'n', '0'].includes(t) ? { value: false, error: null } : { value: null, error: 'Not yes/no' } }
    case 'date': { const t = String(v).trim(); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? { value: t, error: null } : { value: null, error: 'Use yyyy-mm-dd' } }
    case 'enum': { const t = String(v).trim(); const hit = spec.values!.find((x) => x.toLowerCase() === t.toLowerCase()); return hit ? { value: hit, error: null } : { value: null, error: `Must be one of ${spec.values!.join(', ')}` } }
    default: return { value: String(v).trim(), error: null }
  }
}

const memberName = (m: CashflowModel, id: unknown) => (id === 'joint' ? 'Joint' : m.members.find((x) => x.id === id)?.name || '')
function currentValue(model: CashflowModel, c: Collection, rec: AnyRec | null, field: string): string | number | boolean | null {
  if (c === 'assumptions') { const a = model.assumptions as unknown as Record<string, unknown>; return (a[field] as never) ?? null }
  if (!rec) return null
  if (field === 'ownerName') return memberName(model, rec.ownerId) || null
  if (field === 'insuredName') return memberName(model, rec.insuredId) || null
  const v = rec[field]; return v === undefined || v === '' ? null : (v as never)
}
const sameValue = (a: unknown, b: unknown) => (typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) <= Math.max(0.5, Math.abs(a) * 0.001) : String(a ?? '').toLowerCase() === String(b ?? '').toLowerCase())

let seq = 0
/** Build the proposal list from one or more extractions, flagging conflicts. */
export function proposalsFromExtractions(model: CashflowModel, extractions: Extraction[]): Proposal[] {
  const out: Proposal[] = []
  for (const ex of extractions) {
    for (const rec of ex.records || []) {
      const specs = INTAKE_FIELDS[rec.collection]; if (!specs) continue
      const list = (rec.collection === 'assumptions' ? [] : (model[rec.collection] as unknown as AnyRec[]))
      const existing = rec.collection === 'assumptions' ? null : findRecord(list, rec.record_name)
      const recordKey = `${rec.collection}:${norm(rec.record_name) || 'unnamed'}`
      for (const f of rec.fields || []) {
        const spec = specs[f.field]; if (!spec) continue
        const { value, error } = coerce(spec, f.value)
        const current = currentValue(model, rec.collection, existing, f.field)
        out.push({
          id: `p${++seq}`, collection: rec.collection, recordId: existing ? existing.id : null, recordKey: existing ? `id:${existing.id}` : recordKey,
          recordLabel: existing ? existing.name : rec.record_name || COLLECTION_LABEL[rec.collection], isNew: !existing && rec.collection !== 'assumptions',
          field: f.field, label: spec.label, current, proposed: value, extracted: value ?? (f.value as never),
          source: { file: ex.source_file, page: f.page ?? null, quote: f.quote || '' }, confidence: Math.max(0, Math.min(1, Number(f.confidence) || 0)),
          status: 'pending', conflictGroup: null, unchanged: value !== null && current !== null && sameValue(value, current), invalid: error,
        })
      }
    }
  }
  // Conflicts: same record + field proposed with different values (two statements, or two places in one).
  const groups = new Map<string, Proposal[]>()
  for (const p of out) { const k = `${p.recordKey}|${p.field}`; (groups.get(k) || groups.set(k, []).get(k)!).push(p) }
  let g = 0
  for (const list of groups.values()) {
    const valid = list.filter((p) => !p.invalid)
    const distinct = valid.filter((p, i) => valid.findIndex((q) => sameValue(q.proposed, p.proposed)) === i)
    if (distinct.length > 1) { const id = `c${++g}`; valid.forEach((p) => { p.conflictGroup = id }) }
    else if (valid.length > 1) valid.slice(1).forEach((p) => { p.status = 'rejected' }) // identical duplicates collapse into the first
  }
  return out
}

export function setStatus(ps: Proposal[], id: string, status: ProposalStatus): Proposal[] {
  const target = ps.find((p) => p.id === id); if (!target) return ps
  return ps.map((p) => {
    if (p.id === id) return { ...p, status: status === 'accepted' && p.invalid ? 'pending' : status }
    // choosing one value of a conflict un-chooses the others
    if (status === 'accepted' && target.conflictGroup && p.conflictGroup === target.conflictGroup && p.status === 'accepted') return { ...p, status: 'pending' }
    return p
  })
}
export function editProposal(ps: Proposal[], id: string, raw: string): Proposal[] {
  return ps.map((p) => {
    if (p.id !== id) return p
    const spec = INTAKE_FIELDS[p.collection][p.field]; const { value, error } = coerce(spec, raw)
    return { ...p, proposed: value ?? raw, invalid: error, unchanged: value !== null && p.current !== null && sameValue(value, p.current), status: error && p.status === 'accepted' ? 'pending' : p.status }
  })
}
/** Accept every proposal that is valid, changes something and is not in a conflict (conflicts always need a human choice). */
export function acceptAll(ps: Proposal[]): Proposal[] { return ps.map((p) => (p.status === 'pending' && !p.invalid && !p.conflictGroup && !p.unchanged ? { ...p, status: 'accepted' } : p)) }
export function rejectAll(ps: Proposal[]): Proposal[] { return ps.map((p) => (p.status === 'pending' ? { ...p, status: 'rejected' } : p)) }
export const unresolvedConflicts = (ps: Proposal[]) => [...new Set(ps.filter((p) => p.conflictGroup && p.status !== 'rejected').map((p) => p.conflictGroup!))].filter((g) => !ps.some((p) => p.conflictGroup === g && p.status === 'accepted'))

export interface AppliedChange { label: string; field: string; from: unknown; to: unknown; file: string; page: number | null; isNew: boolean }
/** Apply the accepted proposals. Returns the new model and an audit trail (source file and page for every value saved). */
export function applyProposals(model: CashflowModel, ps: Proposal[]): { model: CashflowModel; changes: AppliedChange[] } {
  const m: CashflowModel = JSON.parse(JSON.stringify(model))
  const changes: AppliedChange[] = []
  const created = new Map<string, AnyRec>()
  const accepted = ps.filter((p) => p.status === 'accepted' && !p.invalid && p.proposed !== null)
  const memberId = (name: unknown): Id | 'joint' | null => { const n = norm(String(name || '')); if (!n) return null; if (n === 'joint' || n.includes('jointly') || n === 'both') return 'joint'; return m.members.find((x) => norm(x.name) === n || (n.length > 3 && norm(x.name).includes(n)))?.id ?? null }
  const make = (c: Collection, name: string): AnyRec => {
    const base = c === 'members' ? newMember('spouse', { name }) : c === 'income' ? newIncome({ name }) : c === 'expenses' ? newExpense({ name }) : c === 'accounts' ? newAccount({ name }) : c === 'liabilities' ? newLiability({ name }) : newPolicy({ name })
    ;(m[c as Exclude<Collection, 'assumptions'>] as unknown as AnyRec[]).push(base as unknown as AnyRec); return base as unknown as AnyRec
  }
  for (const p of accepted) {
    let target: AnyRec | Record<string, unknown>
    if (p.collection === 'assumptions') target = m.assumptions as unknown as Record<string, unknown>
    else if (p.recordId) { target = (m[p.collection] as unknown as AnyRec[]).find((r) => r.id === p.recordId) as AnyRec; if (!target) continue }
    else { target = created.get(p.recordKey) as AnyRec; if (!target) { target = make(p.collection, p.recordLabel); created.set(p.recordKey, target as AnyRec) } }
    let key = p.field, val: unknown = p.proposed
    if (key === 'ownerName') { key = 'ownerId'; val = memberId(val) ?? 'joint' }
    else if (key === 'insuredName') { key = 'insuredId'; val = memberId(val) }
    else if (p.collection === 'accounts' && key === 'type') (target as Record<string, unknown>).illiquid = val === 'realEstate' || val === 'business'
    if (p.collection === 'assumptions' && key === 'state') val = String(val).slice(0, 2).toUpperCase()
    const from = (target as Record<string, unknown>)[key]
    ;(target as Record<string, unknown>)[key] = val
    changes.push({ label: `${p.recordLabel} · ${p.label}`, field: p.field, from: from ?? null, to: p.proposed, file: p.source.file, page: p.source.page, isNew: p.isNew })
  }
  return { model: normalizeModel(m, m.assumptions.baseYear), changes }
}

/** One line per saved value, for the history log. */
export function auditNote(changes: AppliedChange[]): string {
  return changes.map((c) => `${c.label}: ${c.from ?? '(empty)'} -> ${c.to} [${c.file}${c.page ? ` p.${c.page}` : ''}]`).join('; ').slice(0, 4000)
}
