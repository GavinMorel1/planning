import { useEffect, useState } from 'react'
import { Card, Title, Btn, Empty, Pill } from '../components/ui'
import { renderMarkdown } from '../lib/markdown'

// Same pattern as the invest dashboard: public/research/index.json lists markdown memos.
export default function Research({ C, isDesktop }) {
  const [reports, setReports] = useState([])
  const [open, setOpen] = useState(null)
  const [content, setContent] = useState('')
  const base = import.meta.env.BASE_URL || '/'
  useEffect(() => { fetch(`${base}research/index.json?t=${Math.floor(Date.now() / 60000)}`).then((r) => r.ok ? r.json() : []).then(setReports).catch(() => setReports([])) }, [])
  const openReport = (r) => { setOpen(r); setContent(''); fetch(`${base}research/${r.file}`).then((x) => x.ok ? x.text() : 'Failed to load.').then(setContent) }
  if (open) return (
    <div>
      <Btn C={C} ghost small onClick={() => setOpen(null)} style={{ marginBottom: 12 }}>‹ Back to library</Btn>
      <div style={{ fontSize: 11, color: C.t4, marginBottom: 8 }}>{open.date} {open.category && <Pill C={C}>{open.category}</Pill>} {open.author && <span style={{ marginLeft: 8 }}>{open.author}</span>}</div>
      <Card C={C} style={{ padding: isDesktop ? '32px 48px' : '20px 18px' }}><div className="md" style={{ color: C.t2 }}>{content ? renderMarkdown(content, C) : 'Loading…'}</div></Card>
    </div>
  )
  return (
    <div>
      <Title C={C} isDesktop={isDesktop} sub="Internal memos, law changes and strategy write-ups. Add a markdown file to public/research and list it in index.json.">Research</Title>
      {!reports.length ? <Empty C={C} icon="§" title="No memos yet">Drop markdown files into public/research/ and add them to index.json. The first one, on Qualified Opportunity Funds, is included.</Empty> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...reports].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((r) => (
            <Card key={r.id} C={C} hover onClick={() => openReport(r)}>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.t1, marginBottom: 4 }}>{r.title}</div>
              {r.summary && <div style={{ fontSize: 12.5, color: C.t3, lineHeight: 1.5, marginBottom: 6 }}>{r.summary}</div>}
              <div style={{ display: 'flex', gap: 10, fontSize: 11, color: C.t4 }}><span>{r.date}</span>{r.author && <span>{r.author}</span>}{r.category && <Pill C={C}>{r.category}</Pill>}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
