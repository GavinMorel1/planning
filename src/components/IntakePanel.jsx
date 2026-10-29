// AI intake: drop statements, tax returns, eMoney reports, paystubs and insurance policies. Claude reads each file (through the
// Worker) and returns structured values with source file, page and confidence. Nothing is saved until the planner reviews the
// table below and accepts (or edits / rejects) each line. Conflicting values are flagged, never overwritten.
import { useMemo, useRef, useState } from 'react'
import { Card, Eyebrow, Btn, Note, Pill, Check, Input, Spinner } from './ui'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { CLAUDE_ENABLED, extractCashflow, INTAKE_ACCEPT } from '../lib/claude'
import { DOC_CATEGORIES } from '../data/docCategories'
import { fmtUsd } from '../lib/util'
import { proposalsFromExtractions, acceptAll, rejectAll, setStatus, editProposal, applyProposals, auditNote, unresolvedConflicts, COLLECTION_LABEL } from '../cashflow/intake'

const confColor = (C, c) => (c >= 0.85 ? C.up : c >= 0.6 ? C.warn : C.dn)
const show = (v) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'number' ? (Math.abs(v) >= 1000 ? fmtUsd(v) : String(v)) : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v))

export default function IntakePanel({ C, isDesktop, family, cf, summarize, mode = 'cashflow' }) {
  const { putFile, updateFamily } = useStore()
  const { email } = useAuth()
  const [files, setFiles] = useState([]) // {name, status: 'reading'|'done'|'error', error, notes}
  const [ps, setPs] = useState([])
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const [keep, setKeep] = useState(true)
  const [result, setResult] = useState(null) // { changes, summary }
  const [err, setErr] = useState('')
  const input = useRef(null)
  const extractions = useRef([])

  const run = async (list) => {
    const picked = [...list].filter((f) => f && f.name)
    if (!picked.length) return
    setErr(''); setResult(null); setBusy(true)
    const base = { ...(cf.model) }
    setFiles((cur) => [...cur, ...picked.map((f) => ({ name: f.name, status: 'reading', error: '', notes: '' }))])
    const done = []
    for (const file of picked) {
      try {
        const ex = await extractCashflow(file, { familyName: family.name, model: base })
        extractions.current.push(ex); done.push(ex)
        setFiles((cur) => cur.map((x) => (x.name === file.name && x.status === 'reading' ? { ...x, status: 'done', notes: ex.notes || '', count: (ex.records || []).reduce((n, r) => n + (r.fields || []).length, 0) } : x)))
        if (keep) await fileAway(file, ex)
      } catch (e) {
        setFiles((cur) => cur.map((x) => (x.name === file.name && x.status === 'reading' ? { ...x, status: 'error', error: e?.message || 'Could not read this file' } : x)))
      }
    }
    // Rebuild every proposal from all extractions so conflicts between files are found; keep decisions already made.
    const all = proposalsFromExtractions(base, extractions.current)
    setPs(all)
    setBusy(false)
  }

  // Store the original in the family's Documents under the category Claude guessed (so the source stays on file).
  const fileAway = async (file, ex) => {
    try {
      const cat = DOC_CATEGORIES.some((c) => c.id === ex.document_category) ? ex.document_category : 'other'
      const meta = await putFile(family.id, file, { category: cat })
      updateFamily(family.id, (cur) => { const c = cur.documents?.[cat] || { status: 'missing', files: [] }; return { ...cur, documents: { ...cur.documents, [cat]: { ...c, status: 'received', files: [...(c.files || []), meta] } } } })
    } catch { /* the extraction still counts; the file just is not filed */ }
  }

  const accepted = ps.filter((p) => p.status === 'accepted')
  const conflicts = unresolvedConflicts(ps)
  const groups = useMemo(() => {
    const m = new Map()
    ps.forEach((p) => { (m.get(p.recordKey) || m.set(p.recordKey, []).get(p.recordKey)).push(p) })
    return [...m.values()]
  }, [ps])

  const apply = async () => {
    setBusy(true); setErr('')
    try {
      const before = cf.model
      const { model: after, changes } = applyProposals(before, ps)
      if (!changes.length) { setBusy(false); return }
      const files = [...new Set(changes.map((c) => c.file))]
      await cf.save(after, { source: `intake: ${files.join(', ')} (approved by ${email || 'local user'})`, note: auditNote(changes) }, { immediate: true })
      const summary = summarize ? await summarize(before, after) : null
      setResult({ changes, summary })
      setPs([]); extractions.current = []; setFiles([])
    } catch (e) { setErr(e?.message || 'Could not save') }
    setBusy(false)
  }

  const reset = () => { setPs([]); extractions.current = []; setFiles([]); setResult(null); setErr('') }

  return (
    <Card C={C} accent style={{ marginBottom: 14 }}>
      <Eyebrow C={C}>AI intake</Eyebrow>
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (CLAUDE_ENABLED) run(e.dataTransfer.files) }}
        onClick={() => CLAUDE_ENABLED && input.current && input.current.click()}
        role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' && CLAUDE_ENABLED) input.current && input.current.click() }}
        style={{ border: `2px dashed ${over ? C.accent : C.borderActive}`, background: over ? C.accentSoft : C.surface, borderRadius: 14, padding: isDesktop ? '26px 20px' : '18px 14px', textAlign: 'center', cursor: CLAUDE_ENABLED ? 'pointer' : 'not-allowed', transition: 'all .12s' }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.t1 }}>Drop statements, tax returns, eMoney reports, paystubs, insurance policies</div>
        <div style={{ fontSize: 12.5, color: C.t3, marginTop: 4 }}>PDF, images, CSV or XLSX, up to 20 MB each. Claude proposes values; you approve each one.</div>
        <input ref={input} type="file" multiple accept={INTAKE_ACCEPT} style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.length) run(e.target.files); e.target.value = '' }} />
      </div>
      {!CLAUDE_ENABLED && <Note C={C} tone="warn" style={{ marginTop: 10 }}>Intake needs the Claude connection (VITE_PROXY_URL, see docs/SETUP.md). You can still enter everything by hand.</Note>}
      <div style={{ marginTop: 8 }}><Check C={C} checked={keep} onChange={setKeep} label="Also file the originals in Documents (recommended: keeps the source on record)" /></div>
      {err && <Note C={C} tone="danger" style={{ marginTop: 10 }}>{err}</Note>}

      {files.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {files.map((f, i) => (
            <div key={`${f.name}${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: i ? `1px solid ${C.border}` : 'none', fontSize: 12.5 }}>
              <span style={{ width: 16, color: f.status === 'done' ? C.up : f.status === 'error' ? C.dn : C.t3 }}>{f.status === 'done' ? '✓' : f.status === 'error' ? '×' : '…'}</span>
              <span style={{ flex: 1, minWidth: 0, color: C.t1, fontWeight: 600, overflowWrap: 'anywhere' }}>{f.name}</span>
              <span style={{ color: f.status === 'error' ? C.dn : C.t3 }}>{f.status === 'reading' ? 'Reading…' : f.status === 'error' ? f.error : `${f.count || 0} value${f.count === 1 ? '' : 's'} found`}</span>
              {f.notes && <span title={f.notes} style={{ color: C.warn, cursor: 'help' }}>⚠ note</span>}
            </div>
          ))}
          {busy && !ps.length && <Spinner C={C} label="Reading with Claude…" />}
        </div>
      )}

      {ps.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.t1, flex: 1, minWidth: 200 }}>Review proposed changes <span style={{ color: C.t4, fontWeight: 600 }}>· {ps.length} lines, {accepted.length} accepted</span></div>
            <Btn C={C} small onClick={() => setPs(acceptAll(ps))} title="Accepts every valid line that changes something and is not in a conflict">Accept all</Btn>
            <Btn C={C} small ghost onClick={() => setPs(rejectAll(ps))}>Reject all</Btn>
            <Btn C={C} small ghost onClick={reset}>Discard</Btn>
            <Btn C={C} small primary disabled={!accepted.length || busy} onClick={apply}>{busy ? 'Saving…' : `Save ${accepted.length} accepted`}</Btn>
          </div>
          {conflicts.length > 0 && <Note C={C} tone="warn" style={{ marginBottom: 10 }}>{conflicts.length} field{conflicts.length > 1 ? 's have' : ' has'} conflicting values. Choose one for each; they are not saved until you do.</Note>}
          {groups.map((g) => (
            <div key={g[0].recordKey} style={{ border: `1px solid ${C.border}`, borderRadius: 12, marginBottom: 8, overflow: 'hidden' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 12px', background: C.surface, fontSize: 13, fontWeight: 800, color: C.t1 }}>
                {g[0].recordLabel}<Pill C={C} color={g[0].isNew ? C.accent : C.t3}>{g[0].isNew ? `new ${COLLECTION_LABEL[g[0].collection].toLowerCase()}` : COLLECTION_LABEL[g[0].collection].toLowerCase()}</Pill>
              </div>
              {g.map((p) => (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: isDesktop ? '150px 1fr 1.1fr 1.3fr 70px 150px' : '1fr', gap: 8, alignItems: 'center', padding: '8px 12px', borderTop: `1px solid ${C.border}`, background: p.status === 'accepted' ? C.upSoft : p.status === 'rejected' ? 'transparent' : p.conflictGroup ? C.dnSoft : 'transparent', opacity: p.status === 'rejected' ? 0.5 : 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: C.t2 }}>{p.label}{p.conflictGroup && <span style={{ marginLeft: 6, fontSize: 10, color: C.dn, fontWeight: 800 }}>CONFLICT</span>}{p.unchanged && <span style={{ marginLeft: 6, fontSize: 10, color: C.t4 }}>same</span>}</div>
                  <div style={{ fontSize: 12.5, color: C.t3 }}><span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, marginRight: 6, color: C.t4 }}>Now</span>{show(p.current)}</div>
                  <div><Input C={C} value={p.proposed === null ? String(p.extracted ?? '') : String(p.proposed)} onChange={(v) => setPs((cur) => editProposal(cur, p.id, v))} style={{ padding: '5px 8px', fontSize: 12.5, borderColor: p.invalid ? C.dn : undefined }} />{p.invalid && <div style={{ fontSize: 10.5, color: C.dn }}>{p.invalid}</div>}</div>
                  <div style={{ fontSize: 11.5, color: C.t3, lineHeight: 1.4 }} title={p.source.quote}><b style={{ color: C.t2 }}>{p.source.file}</b>{p.source.page ? ` · p.${p.source.page}` : ''}{p.source.quote && <div style={{ color: C.t4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>“{p.source.quote}”</div>}</div>
                  <div><span style={{ fontSize: 11, fontWeight: 800, color: confColor(C, p.confidence), border: `1px solid ${confColor(C, p.confidence)}66`, borderRadius: 20, padding: '2px 8px' }}>{Math.round(p.confidence * 100)}%</span></div>
                  <div style={{ display: 'flex', gap: 6, justifyContent: isDesktop ? 'flex-end' : 'flex-start' }}>
                    <Btn C={C} small primary={p.status === 'accepted'} disabled={Boolean(p.invalid)} onClick={() => setPs((cur) => setStatus(cur, p.id, p.status === 'accepted' ? 'pending' : 'accepted'))}>{p.status === 'accepted' ? 'Accepted' : p.conflictGroup ? 'Use this' : 'Accept'}</Btn>
                    <Btn C={C} small ghost onClick={() => setPs((cur) => setStatus(cur, p.id, p.status === 'rejected' ? 'pending' : 'rejected'))}>{p.status === 'rejected' ? 'Undo' : 'Reject'}</Btn>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 14, padding: 12, borderRadius: 12, border: `1px solid ${C.up}66`, background: C.upSoft }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.t1, marginBottom: 6 }}>Saved {result.changes.length} value{result.changes.length === 1 ? '' : 's'}. The projection has been re-run.</div>
          {result.summary && result.summary.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? 'repeat(4, minmax(0, 1fr))' : '1fr 1fr', gap: 8, marginBottom: 8 }}>
              {result.summary.map((s) => (
                <div key={s.label} style={{ padding: '8px 10px', borderRadius: 10, background: C.card, border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</div>
                  <div style={{ fontSize: 13, color: C.t3 }}>{s.before}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: s.better === false ? C.dn : s.better === true ? C.up : C.t1 }}>→ {s.after}</div>
                </div>
              ))}
            </div>
          )}
          <details><summary style={{ cursor: 'pointer', fontSize: 12, color: C.t3 }}>What changed</summary>
            {result.changes.map((c, i) => <div key={i} style={{ fontSize: 12, color: C.t2, padding: '3px 0' }}>{c.label}: {show(c.from)} → <b>{show(c.to)}</b> <span style={{ color: C.t4 }}>({c.file}{c.page ? ` p.${c.page}` : ''})</span></div>)}
          </details>
          <Btn C={C} small ghost onClick={reset} style={{ marginTop: 8 }}>Done</Btn>
        </div>
      )}
      {mode === 'documents' && !ps.length && !result && <div style={{ fontSize: 11.5, color: C.t4, marginTop: 8 }}>Accepted values go into the Cashflow tab's planning model. Originals are filed under the checklist category below.</div>}
    </Card>
  )
}
