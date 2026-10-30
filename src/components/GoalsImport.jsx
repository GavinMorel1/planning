// Upload the client's "Goals and Intentions" document (PDF, photo or text) and turn it into one goal per line. Claude reads the
// file through the Worker; the planner reviews and edits every goal before anything is saved. Each saved goal gets its own
// slide in both Gap Analysis decks. Paste is the fallback when Claude is not connected.
import { useRef, useState } from 'react'
import { Card, Eyebrow, Btn, Input, Row, Note, TextArea, Check, Pill } from './ui'
import { CLAUDE_ENABLED, extractGoals, goalsFromText, GOALS_ACCEPT, INTAKE_MAX_BYTES } from '../lib/claude'
import { useFamily } from '../lib/store'
import { uid } from '../lib/util'
import { canEdit, denyEdit } from '../lib/permissions'

export const newGoal = (text, title = '') => ({ id: uid(), text, title, status: 'open', observations: [], challenges: [], solutions: [], cost: { amount: '', basis: '' }, tools: [], notes: '' })

export default function GoalsImport({ C, compact = false }) {
  const [f, patch] = useFamily()
  const [found, setFound] = useState(null) // { source, notes, couple, rows: [{ key, text, title, page, confidence, keep }] }
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [over, setOver] = useState(false)
  const [paste, setPaste] = useState('')
  const [mode, setMode] = useState('add')
  const input = useRef(null)
  const existing = (f.goals || []).filter((g) => g.text).length
  const rowsOf = (list) => list.map((g) => ({ key: uid(), text: g.text, title: g.title || '', page: g.page ?? null, confidence: g.confidence || 'high', keep: true }))

  const read = async (file) => {
    if (!file) return
    if (!canEdit()) { denyEdit(); return }
    setBusy(true); setErr(''); setFound(null)
    try {
      const out = await extractGoals(file, { familyName: f.name })
      if (!out.goals?.length) throw new Error('No goals were found in that file. Check the file, or paste the goals instead.')
      setFound({ source: file.name, notes: out.notes || '', couple: out.couple_names || '', rows: rowsOf(out.goals) })
      setMode('add')
    } catch (e) { setErr(e?.message || 'Could not read that file') }
    setBusy(false)
  }
  const fromPaste = () => {
    const list = goalsFromText(paste)
    if (!list.length) { setErr('Paste at least one goal, one per line.'); return }
    setErr(''); setFound({ source: 'pasted text', notes: '', couple: '', rows: rowsOf(list) }); setMode('add')
  }
  const setRow = (key, p) => setFound((x) => ({ ...x, rows: x.rows.map((r) => (r.key === key ? { ...r, ...p } : r)) }))
  const kept = found ? found.rows.filter((r) => r.keep && r.text.trim()) : []

  const apply = () => {
    if (!canEdit()) { denyEdit(); return }
    const fresh = kept.map((r) => newGoal(r.text.trim(), r.title.trim()))
    patch((cur) => {
      const cleaned = (cur.goals || []).filter((g) => g.text)
      // "replace" keeps the analysis of any goal whose wording is unchanged so no work is lost
      const same = (t) => cleaned.find((g) => g.text.trim().toLowerCase() === t.trim().toLowerCase())
      const merged = fresh.map((g) => { const old = same(g.text); return old ? { ...old, title: g.title || old.title } : g })
      const goals = mode === 'replace' ? merged : [...cleaned, ...merged.filter((g) => !cleaned.some((c) => c.id === g.id))]
      return { ...cur, goals }
    })
    setFound(null); setPaste('')
  }

  return (
    <Card C={C} style={{ marginBottom: 14 }}>
      <Eyebrow C={C}>Goals and Intentions document</Eyebrow>
      <div style={{ fontSize: 12.5, color: C.t3, lineHeight: 1.5, marginBottom: 10 }}>Drop the client's Goals and Intentions PDF here. Each goal becomes its own slide in the Gap Analysis decks. You check and edit every goal before it is saved.</div>
      {!found && (<>
        <div onClick={() => CLAUDE_ENABLED && input.current?.click()} onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); if (CLAUDE_ENABLED) read(e.dataTransfer.files?.[0]) }}
          style={{ border: `2px dashed ${over ? C.accent : C.border}`, borderRadius: 12, padding: compact ? '16px 12px' : '24px 16px', textAlign: 'center', cursor: CLAUDE_ENABLED ? 'pointer' : 'not-allowed', background: over ? C.accentSoft : 'transparent', opacity: CLAUDE_ENABLED ? 1 : 0.6 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.t1 }}>{busy ? 'Reading the document…' : 'Drop a PDF or photo of the Goals and Intentions'}</div>
          <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>{CLAUDE_ENABLED ? `PDF, image or text, up to ${INTAKE_MAX_BYTES / 1024 / 1024} MB. Claude reads it and lists each goal.` : 'Reading a PDF needs Claude (the Worker in docs/SETUP.md). Until then, paste the goals below.'}</div>
          <input ref={input} type="file" accept={GOALS_ACCEPT} style={{ display: 'none' }} onChange={(e) => { read(e.target.files?.[0]); e.target.value = '' }} />
        </div>
        <div style={{ marginTop: 12 }}>
          <TextArea C={C} rows={3} value={paste} onChange={setPaste} placeholder="Or paste the goals here, one per line, then click Review" />
          <Btn C={C} small style={{ marginTop: 8 }} disabled={!paste.trim()} onClick={fromPaste}>Review pasted goals</Btn>
        </div>
      </>)}
      {err && <Note C={C} tone="warn" style={{ marginTop: 10 }}>{err}</Note>}
      {found && (
        <div>
          <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{found.rows.length} goal{found.rows.length === 1 ? '' : 's'} found in {found.source}{found.couple ? ` · ${found.couple}` : ''}</div>
            <Pill C={C} color={C.up}>{kept.length} will become slides</Pill>
          </Row>
          {found.notes && <Note C={C} tone="warn" style={{ marginBottom: 8 }}>{found.notes}</Note>}
          {found.rows.map((r, i) => (
            <div key={r.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 0', borderTop: `1px solid ${C.border}`, opacity: r.keep ? 1 : 0.5 }}>
              <span style={{ fontSize: 11, color: C.t4, width: 22, textAlign: 'right', paddingTop: 10 }}>{i + 1}.</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <TextArea C={C} rows={2} value={r.text} onChange={(v) => setRow(r.key, { text: v })} />
                <Row gap={8} style={{ marginTop: 4 }}>
                  <Input C={C} value={r.title} onChange={(v) => setRow(r.key, { title: v })} placeholder="Short title (optional)" style={{ maxWidth: 240, padding: '5px 8px', fontSize: 12 }} />
                  {r.page != null && <span style={{ fontSize: 11, color: C.t4 }}>page {r.page}</span>}
                  {r.confidence !== 'high' && <Pill C={C} color={r.confidence === 'low' ? C.dn : C.warn}>{r.confidence} confidence: check</Pill>}
                </Row>
              </div>
              <Check C={C} checked={r.keep} onChange={(v) => setRow(r.key, { keep: v })} label="Keep" />
            </div>
          ))}
          <Row style={{ marginTop: 12 }}>
            {existing > 0 && <><Check C={C} checked={mode === 'replace'} onChange={(v) => setMode(v ? 'replace' : 'add')} label={`Replace the ${existing} goal${existing === 1 ? '' : 's'} already entered (analysis is kept when the wording matches)`} /></>}
            <div style={{ flex: 1 }} />
            <Btn C={C} ghost onClick={() => setFound(null)}>Cancel</Btn>
            <Btn C={C} primary disabled={!kept.length} onClick={apply}>Save {kept.length} goal{kept.length === 1 ? '' : 's'}</Btn>
          </Row>
        </div>
      )}
    </Card>
  )
}
