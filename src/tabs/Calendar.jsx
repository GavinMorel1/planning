import { useState } from 'react'
import { useStore } from '../lib/store'
import { Card, Eyebrow, Title, Btn, Input, Select, Field, Grid, Pill, Empty, Check, Note } from '../components/ui'
import { uid, daysUntil, fmtDate, today } from '../lib/util'

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

export default function Calendar({ C, isDesktop }) {
  const { families, family, updateFamily, setActive } = useStore()
  const [draft, setDraft] = useState({ title: '', date: '', kind: 'Deadline' })
  const all = families.flatMap((f) => (f.deadlines || []).map((d) => ({ ...d, family: f })))
    .sort((a, b) => (a.done - b.done) || (a.date || '').localeCompare(b.date || ''))
  const color = (days, done) => done ? C.t4 : days == null ? C.t3 : days < 0 ? C.dn : days < 30 ? C.warn : C.up
  const addTo = (fam, d) => updateFamily(fam.id, (f) => ({ ...f, deadlines: [...(f.deadlines || []), { id: uid(), done: false, ...d }] }))

  return (
    <div>
      <Title C={C} isDesktop={isDesktop} sub="Statutory windows, filing dates and review cadences for every family.">Calendar</Title>
      <Grid cols={isDesktop ? 2 : 1} gap={14}>
        <div>
          {!all.length && <Empty C={C} icon="▦" title="No deadlines yet">Add one on the right, or use a template. Items inside 90 days also show on the Desk.</Empty>}
          {all.map((d) => {
            const days = daysUntil(d.date)
            return (
              <Card key={d.id} C={C} style={{ borderLeft: `3px solid ${color(days, d.done)}`, marginBottom: 8, padding: '10px 14px', opacity: d.done ? 0.6 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Check C={C} checked={d.done} onChange={(v) => updateFamily(d.family.id, (f) => ({ ...f, deadlines: f.deadlines.map((x) => x.id === d.id ? { ...x, done: v } : x) }))} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: C.t1, textDecoration: d.done ? 'line-through' : 'none' }}>{d.title}</div>
                    <div style={{ fontSize: 11.5, color: C.t3, marginTop: 2 }}><span onClick={() => setActive(d.family.id)} style={{ color: C.accent, cursor: 'pointer' }}>{d.family.name}</span> · {fmtDate(d.date)}{days != null && !d.done ? ` · ${days < 0 ? `${-days} days overdue` : `${days} days`}` : ''}</div>
                  </div>
                  <Pill C={C} color={color(days, d.done)}>{d.kind}</Pill>
                  <Btn C={C} small ghost onClick={() => updateFamily(d.family.id, (f) => ({ ...f, deadlines: f.deadlines.filter((x) => x.id !== d.id) }))}>×</Btn>
                </div>
              </Card>
            )
          })}
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
