import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { Card, Eyebrow, Title, Btn, Input, Select, Field, Grid, Pill, Empty, Check, Note } from '../components/ui'
import { uid, daysUntil, fmtDate } from '../lib/util'
import { useWorkTimeline, isClosed, PRIORITY_BY_ID, nameFromEmail } from '../lib/work'

const TEMPLATES = [
  { title: 'QOF reinvestment window closes (180 days from sale)', days: 180, kind: 'Deadline' },
  { title: '1031 identification deadline (45 days from closing)', days: 45, kind: 'Deadline' },
  { title: '1031 exchange close deadline (180 days from closing)', days: 180, kind: 'Deadline' },
  { title: 'Roth conversion must complete (December 31)', date: `${new Date().getFullYear()}-12-31`, kind: 'Deadline' },
  { title: 'Annual exclusion gifts (December 31)', date: `${new Date().getFullYear()}-12-31`, kind: 'Optimize' },
  { title: 'QCD before RMD is taken', date: `${new Date().getFullYear()}-11-30`, kind: 'Optimize' },
  { title: 'OCLAT funding in the income-spike year (December 31)', date: `${new Date().getFullYear()}-12-31`, kind: 'Deadline' },
  { title: 'Estate documents review (every 3 years)', days: 365 * 3, kind: 'Protect' },
  { title: 'Beneficiary designation audit', days: 30, kind: 'Protect' },
  { title: 'Form 709 gift tax return due (April 15)', date: `${new Date().getFullYear() + 1}-04-15`, kind: 'Deadline' },
]
const SHOW = [{ id: 'all', label: 'All' }, { id: 'deadline', label: 'Deadlines' }, { id: 'work', label: 'Work' }]
const monthLabel = (iso) => new Date(`${iso.slice(0, 7)}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

export default function Calendar({ C, isDesktop, setTab }) {
  const { families, family, updateFamily, setActive } = useStore()
  const W = useWorkTimeline()
  const [draft, setDraft] = useState({ title: '', date: '', kind: 'Deadline' })
  const [show, setShow] = useState('all')
  const color = (days, done) => done ? C.t4 : days == null ? C.t3 : days < 0 ? C.dn : days < 30 ? C.warn : C.up
  const addTo = (fam, d) => updateFamily(fam.id, (f) => ({ ...f, deadlines: [...(f.deadlines || []), { id: uid(), done: false, ...d }] }))
  const famById = useMemo(() => Object.fromEntries(families.map((f) => [f.id, f])), [families])

  // One list: statutory deadlines plus every open task (and open subtask) that has a due date, across all families.
  const entries = useMemo(() => {
    const out = []
    families.forEach((f) => (f.deadlines || []).forEach((d) => out.push({ key: `d-${d.id}`, source: 'deadline', done: Boolean(d.done), date: d.date || '', title: d.title, kind: d.kind, family: f, deadline: d })))
    W.items.forEach((t) => {
      const fam = famById[t.familyId]
      if (!fam || isClosed(t.status)) return
      const base = { source: 'work', done: false, family: fam, project: t.project?.name || '', owner: t.owner, priority: t.priority, status: t.status }
      if (t.due) out.push({ ...base, key: `t-${t.id}`, date: t.due, title: t.title || 'Untitled task', kind: 'Work' })
      t.subtasks.filter((x) => x.due && !x.done).forEach((x) => out.push({ ...base, key: `s-${t.id}-${x.id}`, date: x.due, title: x.text || 'Subtask', kind: 'Subtask', parent: t.title || 'Untitled task', owner: x.owner || t.owner }))
    })
    return out.filter((e) => show === 'all' || e.source === show)
  }, [families, W.items, famById, show])

  const groups = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const sorted = [...entries].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.title.localeCompare(b.title))
    const g = []
    const push = (label, e) => { let x = g.find((y) => y.label === label); if (!x) { x = { label, items: [] }; g.push(x) } x.items.push(e) }
    sorted.filter((e) => !e.done && e.date && e.date < today).forEach((e) => push('Overdue', e))
    sorted.filter((e) => !e.done && e.date && e.date >= today).forEach((e) => push(monthLabel(e.date), e))
    sorted.filter((e) => !e.done && !e.date).forEach((e) => push('No date', e))
    sorted.filter((e) => e.done).forEach((e) => push('Completed', e))
    return g
  }, [entries])
  const workCount = entries.filter((e) => e.source === 'work').length
  const openWork = (fam) => { setActive(fam.id); setTab && setTab('work') }

  return (
    <div>
      <Title C={C} isDesktop={isDesktop} sub="Statutory windows, filing dates and review cadences for every family, plus the work due dates from each family's Work tab." right={<div style={{ display: 'inline-flex', border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        {SHOW.map((o) => <button key={o.id} onClick={() => setShow(o.id)} style={{ padding: '8px 14px', border: 'none', background: show === o.id ? C.accentSoft : 'transparent', color: show === o.id ? C.t1 : C.t3, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', boxShadow: show === o.id ? `inset 0 -2px 0 ${C.accent}` : 'none' }}>{o.label}</button>)}
      </div>}>Calendar</Title>
      <Grid cols={isDesktop ? 2 : 1} gap={14}>
        <div>
          {W.missingTable && <Note C={C} tone="warn" style={{ marginBottom: 10 }}>Work due dates will appear here once the Work database update is applied.</Note>}
          {!entries.length && <Empty C={C} icon="▦" title="Nothing scheduled yet">Add a deadline on the right, or start a workflow in a family's Work tab. Open tasks with a due date appear here automatically, and items inside 90 days also show on the Desk.</Empty>}
          {groups.map((g) => (
            <div key={g.label} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: g.label === 'Overdue' ? C.dn : C.accent, textTransform: 'uppercase', letterSpacing: 1.2, margin: '4px 2px 8px' }}>{g.label} <span style={{ color: C.t4, fontWeight: 600 }}>· {g.items.length}</span></div>
              {g.items.map((d) => {
                const days = daysUntil(d.date)
                const work = d.source === 'work'
                return (
                  <Card key={d.key} C={C} style={{ borderLeft: `3px solid ${color(days, d.done)}`, marginBottom: 8, padding: '10px 14px', opacity: d.done ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {!work && <Check C={C} checked={d.done} onChange={(v) => updateFamily(d.family.id, (f) => ({ ...f, deadlines: f.deadlines.map((x) => x.id === d.deadline.id ? { ...x, done: v } : x) }))} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.t1, textDecoration: d.done ? 'line-through' : 'none' }}>{d.title}</div>
                        <div style={{ fontSize: 11.5, color: C.t3, marginTop: 2 }}>
                          <span onClick={() => setActive(d.family.id)} style={{ color: C.accent, cursor: 'pointer' }}>{d.family.name}</span>
                          {work && d.project ? ` · ${d.parent ? `${d.parent} › ` : ''}${d.project}` : ''}
                          {work && d.owner ? ` · ${String(d.owner).includes('@') ? nameFromEmail(d.owner) : d.owner}` : ''}
                          {d.date ? ` · ${fmtDate(d.date)}` : ''}{days != null && !d.done ? ` · ${days < 0 ? `${-days} days overdue` : days === 0 ? 'today' : `${days} days`}` : ''}
                        </div>
                      </div>
                      {work && PRIORITY_BY_ID[d.priority] && d.priority === 'high' && <Pill C={C} color={C.dn}>High</Pill>}
                      <Pill C={C} color={work ? C.accent : color(days, d.done)}>{d.kind}</Pill>
                      {work ? <Btn C={C} small ghost onClick={() => openWork(d.family)}>Open</Btn>
                        : <Btn C={C} small ghost onClick={() => updateFamily(d.family.id, (f) => ({ ...f, deadlines: f.deadlines.filter((x) => x.id !== d.deadline.id) }))}>×</Btn>}
                    </div>
                  </Card>
                )
              })}
            </div>
          ))}
          {show === 'work' && !workCount && !W.missingTable && <Note C={C} tone="info">No open work has a due date. Set due dates on tasks in the Work tab and they show up here.</Note>}
        </div>
        <div>
          <Card C={C} style={{ marginBottom: 14 }}>
            <Eyebrow C={C}>Add deadline{family ? ` for ${family.name}` : ''}</Eyebrow>
            {!family && <Note C={C} tone="warn" style={{ marginBottom: 10 }}>Select a family at the top first.</Note>}
            <Field C={C} label="Title"><Input C={C} value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} /></Field>
            <Grid cols={2} gap={10} style={{ marginTop: 10 }}>
              <Field C={C} label="Date"><Input C={C} type="date" value={draft.date} onChange={(v) => setDraft({ ...draft, date: v })} /></Field>
              <Field C={C} label="Kind"><Select C={C} value={draft.kind} onChange={(v) => setDraft({ ...draft, kind: v })} options={['Deadline', 'Protect', 'Optimize', 'Review', 'Meeting']} style={{ width: '100%' }} /></Field>
            </Grid>
            <Btn C={C} primary disabled={!family || !draft.title || !draft.date} style={{ marginTop: 12 }} onClick={() => { addTo(family, draft); setDraft({ title: '', date: '', kind: 'Deadline' }) }}>Add</Btn>
          </Card>
          <Card C={C}>
            <Eyebrow C={C}>Templates</Eyebrow>
            <div style={{ fontSize: 12, color: C.t3, marginBottom: 8 }}>Windows counted from today; adjust the date after adding.</div>
            {TEMPLATES.map((t) => (
              <div key={t.title} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: `1px solid ${C.border}` }}>
                <div style={{ flex: 1, fontSize: 12.5, color: C.t2 }}>{t.title}</div>
                <Btn C={C} small disabled={!family} onClick={() => addTo(family, { title: t.title, kind: t.kind, date: t.date || new Date(Date.now() + t.days * 86400000).toISOString().slice(0, 10) })}>+ Add</Btn>
              </div>
            ))}
          </Card>
        </div>
      </Grid>
    </div>
  )
}
