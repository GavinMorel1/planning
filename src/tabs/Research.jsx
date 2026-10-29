import { useEffect, useState } from 'react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { Card, Title, Btn, Empty, Pill, Field, Input, TextArea, Select, Note, Confirm } from '../components/ui'
import { renderMarkdown } from '../lib/markdown'
import { download, uid, today } from '../lib/util'

const CATEGORIES = ['Law change', 'Strategy', 'Tax', 'Estate', 'Investments', 'Client letter', 'Other']
const isText = (m) => /\.(md|markdown|txt)$/i.test(m.name || '') || /^text\//.test(m.type || '')

// Memo library. Memos added with "Add memo" are stored in the private documents bucket (key research/...) with their
// details in settings; the older memos listed in public/research/index.json still show too.
export default function Research({ C, isDesktop }) {
  const { settings, updateSettings, putFile, getFile, removeFile } = useStore()
  const { email } = useAuth()
  const [fixed, setFixed] = useState([])
  const [open, setOpen] = useState(null)
  const [content, setContent] = useState('')
  const [adding, setAdding] = useState(false)
  const base = import.meta.env.BASE_URL || '/'
  const uploaded = (settings.researchMemos || []).map((m) => ({ ...m, uploaded: true }))
  useEffect(() => { fetch(`${base}research/index.json?t=${Math.floor(Date.now() / 60000)}`).then((r) => (r.ok ? r.json() : [])).then(setFixed).catch(() => setFixed([])) }, [])
  const reports = [...uploaded, ...fixed]

  const openReport = async (r) => {
    setOpen(r); setContent('')
    try {
      if (r.uploaded) {
        if (!isText(r)) { setContent(''); return }
        const blob = await getFile(r.key); setContent(blob ? await blob.text() : 'File not found.')
      } else setContent(await fetch(`${base}research/${r.file}`).then((x) => (x.ok ? x.text() : 'Failed to load.')))
    } catch (e) { setContent(`Failed to load: ${e.message}`) }
  }
  const remove = async (r) => {
    try { await removeFile(r.key) } catch { /* the entry is removed either way */ }
    updateSettings((s) => ({ ...s, researchMemos: (s.researchMemos || []).filter((m) => m.id !== r.id) }))
    setOpen(null)
  }

  if (open) {
    const canRender = !open.uploaded || isText(open)
    return (
      <div>
        <Btn C={C} ghost small onClick={() => setOpen(null)} style={{ marginBottom: 12 }}>‹ Back to library</Btn>
        <div style={{ fontSize: 11, color: C.t4, marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{open.date} {open.category && <Pill C={C}>{open.category}</Pill>} {open.author && <span>{open.author}</span>}
          {open.uploaded && <><Btn C={C} small onClick={async () => { const b = await getFile(open.key); if (b) download(b, open.name) }}>Download</Btn><Confirm C={C} onConfirm={() => remove(open)}>Delete memo</Confirm></>}</div>
        <Card C={C} style={{ padding: isDesktop ? '32px 48px' : '20px 18px' }}>
          {canRender ? <div className="md" style={{ color: C.t2 }}>{content ? renderMarkdown(content, C) : 'Loading…'}</div>
            : <div><div style={{ fontSize: 16, fontWeight: 800, color: C.t1, marginBottom: 6 }}>{open.title}</div><div style={{ fontSize: 13, color: C.t3, lineHeight: 1.6 }}>{open.summary || 'No summary.'}</div><div style={{ fontSize: 12, color: C.t4, marginTop: 10 }}>This file type opens in its own program: use Download.</div></div>}
        </Card>
      </div>
    )
  }
  return (
    <div>
      <Title C={C} isDesktop={isDesktop} sub="Internal memos, law changes and strategy write-ups." right={<Btn C={C} primary onClick={() => setAdding(true)}>+ Add memo</Btn>}>Research</Title>
      {adding && <AddMemo C={C} author={email || ''} onCancel={() => setAdding(false)} onSave={async (m, file) => {
        const meta = await putFile('research', file, {})
        updateSettings((s) => ({ ...s, researchMemos: [{ id: uid(), ...m, key: meta.key, name: meta.name, type: meta.type, size: meta.size }, ...(s.researchMemos || [])] }))
        setAdding(false)
      }} />}
      {!reports.length ? <Empty C={C} icon="§" title="No memos yet" action={<Btn C={C} primary onClick={() => setAdding(true)}>+ Add memo</Btn>}>Add a memo by uploading a file (Markdown, text, PDF or Word) or pasting text.</Empty> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...reports].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((r) => (
            <Card key={r.id} C={C} hover onClick={() => openReport(r)}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, marginBottom: 4 }}>{r.title}</div>
              {r.summary && <div style={{ fontSize: 12.5, color: C.t3, lineHeight: 1.5, marginBottom: 6 }}>{r.summary}</div>}
              <div style={{ display: 'flex', gap: 10, fontSize: 11, color: C.t4 }}><span>{r.date}</span>{r.author && <span>{r.author}</span>}{r.category && <Pill C={C}>{r.category}</Pill>}{r.uploaded && <span>· {r.name}</span>}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function AddMemo({ C, author, onSave, onCancel }) {
  const [m, setM] = useState({ title: '', category: 'Strategy', summary: '', date: today(), author })
  const [file, setFile] = useState(null)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ready = m.title.trim() && (file || body.trim())
  const save = async () => {
    setBusy(true); setErr('')
    try {
      const f = file || new File([body], `${m.title.trim().replace(/[^A-Za-z0-9]+/g, '-').slice(0, 60) || 'memo'}.md`, { type: 'text/markdown' })
      await onSave({ ...m, title: m.title.trim() }, f)
    } catch (e) { setErr(e?.message || 'Could not save the memo'); setBusy(false) }
  }
  return (
    <Card C={C} accent style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.t1, marginBottom: 10 }}>Add memo</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
        <Field C={C} label="Title" style={{ gridColumn: '1 / -1' }}><Input C={C} value={m.title} onChange={(v) => setM({ ...m, title: v })} placeholder="e.g. Qualified Opportunity Funds after 2026" /></Field>
        <Field C={C} label="Category"><Select C={C} value={m.category} onChange={(v) => setM({ ...m, category: v })} options={CATEGORIES} style={{ width: '100%' }} /></Field>
        <Field C={C} label="Date"><Input C={C} type="date" value={m.date} onChange={(v) => setM({ ...m, date: v })} /></Field>
        <Field C={C} label="Author"><Input C={C} value={m.author} onChange={(v) => setM({ ...m, author: v })} /></Field>
        <Field C={C} label="Summary" hint="One or two sentences shown in the library"><Input C={C} value={m.summary} onChange={(v) => setM({ ...m, summary: v })} /></Field>
        <Field C={C} label="Upload a file (Markdown, text, PDF, Word)" style={{ gridColumn: '1 / -1' }}>
          <input type="file" accept=".md,.markdown,.txt,.pdf,.doc,.docx,text/markdown,text/plain,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ color: C.t2, fontSize: 13 }} />
        </Field>
        <Field C={C} label="…or paste the memo text (Markdown)" style={{ gridColumn: '1 / -1' }}><TextArea C={C} rows={7} value={body} onChange={setBody} placeholder="# Heading&#10;Body text…" /></Field>
      </div>
      {err && <Note C={C} tone="danger" style={{ marginTop: 10 }}>{err}</Note>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}><Btn C={C} ghost onClick={onCancel}>Cancel</Btn><Btn C={C} primary disabled={!ready || busy} onClick={save}>{busy ? 'Saving…' : 'Save memo'}</Btn></div>
    </Card>
  )
}
