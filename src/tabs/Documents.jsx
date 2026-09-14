import { useState } from 'react'
import { useStore, useFamily } from '../lib/store'
import { DOC_CATEGORIES, DOC_GROUPS } from '../data/docCategories'
import { extractDocument, CLAUDE_ENABLED } from '../lib/claude'
import { Card, Eyebrow, Title, Btn, Pill, Grid, Row, Note, Empty, Stat, SubTabs } from '../components/ui'
import { download, fmtDate, uid } from '../lib/util'

export default function Documents({ C, isDesktop, setTab }) {
  const { putFile, getFile, removeFile, updateFamily } = useStore()
  const [f] = useFamily()
  const [busy, setBusy] = useState({})
  const [open, setOpen] = useState(null) // fileId whose extraction is expanded
  const [group, setGroup] = useState('all')
  const docs = f.documents || {}
  const status = (id) => docs[id]?.status || (docs[id]?.files?.length ? 'received' : 'missing')
  const counts = { received: 0, na: 0, missing: 0 }
  DOC_CATEGORIES.forEach((c) => counts[status(c.id)]++)
  const protectMissing = DOC_CATEGORIES.filter((c) => c.protect && status(c.id) === 'missing')

  const setCat = (id, patch) => updateFamily(f.id, (cur) => ({ ...cur, documents: { ...cur.documents, [id]: { status: 'missing', files: [], ...(cur.documents?.[id] || {}), ...patch } } }))
  const upload = async (id, files) => {
    setBusy((b) => ({ ...b, [id]: true }))
    try {
      const metas = []
      for (const file of files) metas.push(await putFile(f.id, file, { category: id }))
      updateFamily(f.id, (cur) => { const c = cur.documents?.[id] || { status: 'missing', files: [] }; return { ...cur, documents: { ...cur.documents, [id]: { ...c, status: 'received', files: [...(c.files || []), ...metas] } } } })
    } catch (e) { alert(`Upload failed: ${e.message}`) }
    setBusy((b) => ({ ...b, [id]: false }))
  }
  const read = async (catId, meta) => {
    setBusy((b) => ({ ...b, [meta.id]: true }))
    try {
      const blob = await getFile(meta.key)
      if (!blob) throw new Error('File not found in storage')
      const file = new File([blob], meta.name, { type: meta.type || blob.type })
      const extraction = await extractDocument(file, { category: DOC_CATEGORIES.find((c) => c.id === catId)?.label, familyName: f.name })
      updateFamily(f.id, (cur) => ({ ...cur, documents: { ...cur.documents, [catId]: { ...cur.documents[catId], files: cur.documents[catId].files.map((x) => x.id === meta.id ? { ...x, extraction, readAt: new Date().toISOString() } : x) } } }))
      setOpen(meta.id)
    } catch (e) { alert(e.message) }
    setBusy((b) => ({ ...b, [meta.id]: false }))
  }
  const remove = async (catId, meta) => {
    if (!confirm(`Remove ${meta.name}?`)) return
    try { await removeFile(meta.key) } catch {}
    updateFamily(f.id, (cur) => { const files = cur.documents[catId].files.filter((x) => x.id !== meta.id); return { ...cur, documents: { ...cur.documents, [catId]: { ...cur.documents[catId], files, status: files.length ? cur.documents[catId].status : (cur.documents[catId].status === 'received' ? 'missing' : cur.documents[catId].status) } } } })
  }
  const view = async (meta) => { const blob = await getFile(meta.key); if (blob) download(blob, meta.name) }
  const readAll = async () => { for (const c of DOC_CATEGORIES) for (const m of (docs[c.id]?.files || [])) if (!m.extraction) await read(c.id, m) }
  const unread = DOC_CATEGORIES.flatMap((c) => (docs[c.id]?.files || []).filter((m) => !m.extraction)).length
  const sevColor = (s) => s === 'red' ? C.dn : s === 'amber' ? C.warn : C.up
  const statusColor = (s) => s === 'received' ? C.up : s === 'na' ? C.t4 : C.dn
  const cats = DOC_CATEGORIES.filter((c) => group === 'all' || c.group === group)

  return (
    <div>
      <Title C={C} isDesktop={isDesktop} sub="Upload what the family provided. Mark the rest not applicable or leave it missing so the gap shows." right={<Btn C={C} primary disabled={!CLAUDE_ENABLED || !unread} onClick={readAll}>{CLAUDE_ENABLED ? `Read ${unread} unread with Claude` : 'Claude not configured'}</Btn>}>Documents · {f.name}</Title>
      <Grid cols={isDesktop ? 4 : 2} gap={10} style={{ marginBottom: 14 }}>
        <Stat C={C} label="Received" value={counts.received} color={C.up} />
        <Stat C={C} label="Not applicable" value={counts.na} color={C.t3} />
        <Stat C={C} label="Missing" value={counts.missing} color={C.dn} />
        <Stat C={C} label="Read by Claude" value={DOC_CATEGORIES.flatMap((c) => (docs[c.id]?.files || []).filter((m) => m.extraction)).length} />
      </Grid>
      {protectMissing.length > 0 && <Note C={C} tone="danger" style={{ marginBottom: 14 }}><b>Protection gap.</b> Missing: {protectMissing.map((c) => c.label).join(', ')}. If the family truly has none, that is a Protect-tier finding for the Gap Analysis. If they have them, mark received or upload.</Note>}
      {!CLAUDE_ENABLED && <Note C={C} tone="warn" style={{ marginBottom: 14 }}>Document reading needs the Claude connection. Set VITE_PROXY_URL after deploying the Worker (docs/SETUP.md). Uploads and the checklist work without it.</Note>}
      <SubTabs C={C} value={group} onChange={setGroup} tabs={[{ id: 'all', label: 'All' }, ...DOC_GROUPS.map((g) => ({ id: g, label: g }))]} />

      {cats.map((c) => {
        const d = docs[c.id] || { status: 'missing', files: [] }
        const st = status(c.id)
        return (
          <Card key={c.id} C={C} style={{ marginBottom: 10, padding: '12px 16px', borderLeft: `3px solid ${statusColor(st)}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.t1, flex: 1, minWidth: 200 }}>{c.label}{c.protect && <span title="Protection document" style={{ marginLeft: 6, fontSize: 10, color: C.warn }}>●</span>}</div>
              <Pill C={C} color={statusColor(st)}>{st === 'na' ? 'not applicable' : st}</Pill>
              <Row gap={6}>
                {st !== 'na' && <Btn C={C} small ghost onClick={() => setCat(c.id, { status: 'na' })}>Mark N/A</Btn>}
                {st === 'na' && <Btn C={C} small ghost onClick={() => setCat(c.id, { status: d.files?.length ? 'received' : 'missing' })}>Undo N/A</Btn>}
                {st === 'missing' && <Btn C={C} small ghost onClick={() => setCat(c.id, { status: 'received' })}>Have it (no upload)</Btn>}
                <label><span style={{ padding: '6px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, border: `1px solid ${C.accent}`, background: C.accentSoft, color: C.t1, cursor: 'pointer', display: 'inline-block' }}>{busy[c.id] ? 'Uploading…' : '+ Upload'}</span><input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.txt,.csv,.md,.xlsx,.docx" style={{ display: 'none' }} onChange={(e) => { if (e.target.files?.length) upload(c.id, [...e.target.files]); e.target.value = '' }} /></label>
              </Row>
            </div>
            {(d.files || []).map((m) => (
              <div key={m.id} style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, background: C.surface, border: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span onClick={() => view(m)} style={{ fontSize: 13, fontWeight: 600, color: C.t1, cursor: 'pointer', textDecoration: 'underline dotted' }}>{m.name}</span>
                  <span style={{ fontSize: 11, color: C.t4 }}>{Math.round((m.size || 0) / 1024)} KB · {fmtDate(m.uploadedAt)}</span>
                  {m.extraction && <Pill C={C} color={C.up} onClick={() => setOpen(open === m.id ? null : m.id)}>{m.extraction.doc_type} · {open === m.id ? 'hide' : 'show'}</Pill>}
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <Btn C={C} small disabled={!CLAUDE_ENABLED || busy[m.id]} onClick={() => read(c.id, m)}>{busy[m.id] ? 'Reading…' : m.extraction ? 'Re-read' : 'Read with Claude'}</Btn>
                    <Btn C={C} small ghost onClick={() => remove(c.id, m)}>×</Btn>
                  </span>
                </div>
                {m.extraction && open === m.id && <Extraction C={C} isDesktop={isDesktop} x={m.extraction} sevColor={sevColor} />}
              </div>
            ))}
          </Card>
        )
      })}
    </div>
  )
}

function Extraction({ C, isDesktop, x, sevColor }) {
  const Block = ({ title, children }) => <div><Eyebrow C={C}>{title}</Eyebrow>{children}</div>
  const list = (arr, render) => arr?.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{arr.map((it, i) => <div key={i} style={{ fontSize: 12.5, color: C.t2, lineHeight: 1.5 }}>{render(it)}</div>)}</div> : <div style={{ fontSize: 12, color: C.t4 }}>None found.</div>
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 13, color: C.t2, lineHeight: 1.6, marginBottom: 12 }}><b style={{ color: C.t1 }}>{x.title}</b> — {x.summary}</div>
      {x.flags?.length > 0 && <div style={{ marginBottom: 12 }}>{x.flags.map((fl, i) => <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, color: C.t2, padding: '5px 0' }}><span style={{ width: 8, height: 8, borderRadius: 4, background: sevColor(fl.severity), marginTop: 5, flexShrink: 0 }} />{fl.issue}</div>)}</div>}
      <Grid cols={isDesktop ? 3 : 1} gap={14}>
        <Block title="Parties">{list(x.parties, (p) => <><b>{p.name}</b> · {p.role}</>)}</Block>
        <Block title="Fiduciaries">{list(x.fiduciaries, (p) => <><b>{p.name}</b> · {p.role}{p.successor ? ' (successor)' : ''}</>)}</Block>
        <Block title="Dates">{list(x.dates, (d) => <>{d.label}: <b>{d.date}</b></>)}</Block>
        <Block title="Key terms">{list(x.key_terms, (k) => <><b>{k.term}</b> — {k.detail}</>)}</Block>
        <Block title="Financials">{list(x.financials, (k) => <>{k.label}: <b>{k.value}</b></>)}</Block>
        <Block title="Planning notes">{list(x.planning_notes, (n) => <>• {n}</>)}</Block>
      </Grid>
    </div>
  )
}
