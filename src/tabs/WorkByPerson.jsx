// Work > By person: every team member's open work across all families, so a manager can see what each person has to finish.
// Read-only overview; "Open" jumps to the task in the family's Work screen where it is edited.
import { useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { Card, Eyebrow, Btn, Pill, Empty, Note, Input } from '../components/ui'
import { useWorkTimeline, STATUS_BY_ID, PRIORITY_BY_ID, isClosed, isOverdue, todayIso, addDays, shortDate } from '../lib/work'
import { useTeam, memberForOwner, memberName, ownerDisplay } from '../lib/team'

const KEY = 'planning_work_person'
const UNASSIGNED = '__none'
const OVERVIEW = '__all'
const initials = (s) => String(s || '?').split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'
const Avatar = ({ C, label, size = 30 }) => <span style={{ width: size, height: size, borderRadius: size / 2, background: C.accentSoft, border: `1px solid ${C.borderActive}`, color: C.t1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 800, flex: 'none' }}>{initials(label)}</span>

export default function WorkByPerson({ C, isDesktop, openTask }) {
  const { families } = useStore()
  const { email } = useAuth()
  const { members } = useTeam()
  const W = useWorkTimeline()
  const me = String(email || '').toLowerCase()
  const today = todayIso(), soon = addDays(today, 7), month = today.slice(0, 7)
  const famName = useMemo(() => Object.fromEntries(families.map((f) => [f.id, f.name])), [families])
  const [sel, setSelState] = useState(() => { try { return localStorage.getItem(KEY) || '' } catch { return '' } })
  const setSel = (v) => { setSelState(v); try { localStorage.setItem(KEY, v) } catch { /* ignore */ } }
  const [q, setQ] = useState('')
  const [show, setShow] = useState('open')

  // Every task and every open subtask becomes a row owned by one person.
  const rows = useMemo(() => {
    const out = []
    W.items.forEach((t) => {
      if (!famName[t.familyId]) return // family was deleted
      const base = { familyId: t.familyId, family: famName[t.familyId], project: t.project?.name || '', priority: t.priority, status: t.status, taskId: t.id }
      out.push({ ...base, key: `t-${t.id}`, owner: t.owner, title: t.title || 'Untitled task', due: t.due, closed: isClosed(t.status), doneAt: t.doneAt || t.updatedAt || '', kind: 'Task', subs: t.subtasks.length ? `${t.subtasks.filter((x) => x.done).length}/${t.subtasks.length}` : '' })
      t.subtasks.forEach((x) => { if (x.owner) out.push({ ...base, key: `s-${t.id}-${x.id}`, owner: x.owner, title: x.text || 'Subtask', due: x.due, closed: Boolean(x.done) || isClosed(t.status), doneAt: t.doneAt || '', kind: 'Subtask', parent: t.title || 'Untitled task', subs: '' }) })
    })
    return out
  }, [W.items, famName])

  // People: every team member, plus anyone named on a task who is not on the team (roster names, former staff), plus Unassigned.
  const people = useMemo(() => {
    const map = new Map()
    members.forEach((m) => map.set(m.email, { id: m.email, name: memberName(m), sub: m.title || '', member: m, rows: [] }))
    const other = new Map()
    rows.forEach((r) => {
      if (!r.owner) { (map.get(UNASSIGNED) || map.set(UNASSIGNED, { id: UNASSIGNED, name: 'Unassigned', sub: 'no owner yet', member: null, rows: [] }).get(UNASSIGNED)).rows.push(r); return }
      const m = memberForOwner(r.owner, members)
      if (m) { map.get(m.email).rows.push(r); return }
      const id = `o:${String(r.owner).toLowerCase()}`
      if (!other.has(id)) other.set(id, { id, name: ownerDisplay(r.owner, members), sub: 'not on the team list', member: null, rows: [] })
      other.get(id).rows.push(r)
    })
    const stat = (p) => {
      const open = p.rows.filter((r) => !r.closed)
      return { ...p, open: open.length, overdue: open.filter((r) => r.due && r.due < today).length, soon: open.filter((r) => r.due && r.due >= today && r.due <= soon).length, doneMonth: p.rows.filter((r) => r.closed && String(r.doneAt).slice(0, 7) === month).length }
    }
    const un = map.get(UNASSIGNED); map.delete(UNASSIGNED)
    const list = [...map.values(), ...other.values()].map(stat).sort((a, b) => (b.member ? 1 : 0) - (a.member ? 1 : 0) || b.overdue - a.overdue || b.open - a.open || a.name.localeCompare(b.name))
    if (un) list.push(stat(un))
    return list
  }, [rows, members, today, soon, month])

  const myId = members.find((m) => m.email === me)?.email
  const active = sel === OVERVIEW || people.some((p) => p.id === sel) ? sel : (myId && people.some((p) => p.id === myId) ? myId : OVERVIEW)
  const person = people.find((p) => p.id === active) || null
  const total = { open: people.reduce((t, p) => t + p.open, 0), overdue: people.reduce((t, p) => t + p.overdue, 0) }

  const list = useMemo(() => {
    if (!person) return []
    const text = q.trim().toLowerCase()
    return person.rows.filter((r) => (show === 'open' ? !r.closed : r.closed)).filter((r) => !text || `${r.title} ${r.family} ${r.project}`.toLowerCase().includes(text))
      .sort((a, b) => (show === 'open' ? (a.due || '9999').localeCompare(b.due || '9999') : String(b.doneAt).localeCompare(String(a.doneAt))) || a.title.localeCompare(b.title))
  }, [person, show, q])
  const byFamily = useMemo(() => { const g = []; list.forEach((r) => { let x = g.find((y) => y.familyId === r.familyId); if (!x) { x = { familyId: r.familyId, family: r.family, items: [] }; g.push(x) } x.items.push(r) }); return g }, [list])

  const dueColor = (r) => (r.closed || !r.due ? C.t3 : r.due < today ? C.dn : r.due <= soon ? C.warn : C.t3)
  const Stat = ({ label, value, color }) => <div style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface }}><div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: C.t4 }}>{label}</div><div style={{ fontSize: 22, fontWeight: 800, color: color || C.t1, marginTop: 2 }}>{value}</div></div>

  if (W.missingTable) return <Card C={C}><Note C={C} tone="warn">Work data is not set up yet. Run the Work SQL from supabase/ALL_PENDING_MIGRATIONS.sql.</Note></Card>

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isDesktop ? '270px minmax(0,1fr)' : '1fr', gap: 14, alignItems: 'start' }}>
      <Card C={C} style={{ padding: 10 }}>
        <button onClick={() => setSel(OVERVIEW)} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: active === OVERVIEW ? C.accentSoft : 'transparent', boxShadow: active === OVERVIEW ? `inset 3px 0 0 ${C.accent}` : 'none' }}>
          <span style={{ width: 30, height: 30, borderRadius: 8, background: C.accentSoft, color: C.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}>◫</span>
          <span style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>Whole team</div><div style={{ fontSize: 11.5, color: C.t3 }}>{total.open} open{total.overdue ? ` · ${total.overdue} overdue` : ''}</div></span>
        </button>
        <div style={{ height: 1, background: C.border, margin: '6px 4px' }} />
        {people.map((p) => (
          <button key={p.id} onClick={() => setSel(p.id)} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: active === p.id ? C.accentSoft : 'transparent', boxShadow: active === p.id ? `inset 3px 0 0 ${C.accent}` : 'none' }}>
            <Avatar C={C} label={p.id === UNASSIGNED ? '?' : p.name} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}{p.member?.email === me ? ' (you)' : ''}</div>
              <div style={{ fontSize: 11, color: C.t4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.sub || ' '}</div>
            </span>
            {p.overdue > 0 && <Pill C={C} color={C.dn}>{p.overdue}</Pill>}
            <span style={{ fontSize: 12, fontWeight: 800, color: p.open ? C.t1 : C.t4, minWidth: 18, textAlign: 'right' }}>{p.open}</span>
          </button>
        ))}
        {!people.length && <div style={{ fontSize: 12.5, color: C.t4, padding: 10 }}>No team members yet. Add people in My Team.</div>}
      </Card>

      <div>
        {active === OVERVIEW ? (
          <Card C={C}>
            <Eyebrow C={C}>Workload by person</Eyebrow>
            {!W.ready && <div style={{ fontSize: 12.5, color: C.t4 }}>Loading…</div>}
            {!people.length && W.ready && <Empty C={C} icon="◫" title="No work yet">Start a workflow in a family's Work screen and assign owners; each person's work appears here.</Empty>}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ textAlign: 'right', color: C.t4, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 1 }}><th style={{ textAlign: 'left', padding: '6px 4px' }}>Person</th><th>Open</th><th>Overdue</th><th>Due in 7 days</th><th>Done this month</th></tr></thead>
                <tbody>{people.map((p) => (
                  <tr key={p.id} onClick={() => setSel(p.id)} style={{ cursor: 'pointer', borderTop: `1px solid ${C.border}`, textAlign: 'right' }}>
                    <td style={{ textAlign: 'left', padding: '9px 4px' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Avatar C={C} label={p.id === UNASSIGNED ? '?' : p.name} size={26} /><span style={{ fontWeight: 700, color: C.t1 }}>{p.name}</span></span></td>
                    <td style={{ fontWeight: 800, color: C.t1 }}>{p.open}</td>
                    <td style={{ fontWeight: 800, color: p.overdue ? C.dn : C.t4 }}>{p.overdue}</td>
                    <td style={{ color: p.soon ? C.warn : C.t4, fontWeight: 700 }}>{p.soon}</td>
                    <td style={{ color: p.doneMonth ? C.up : C.t4, fontWeight: 700 }}>{p.doneMonth}</td>
                  </tr>))}</tbody>
              </table>
            </div>
            <div style={{ fontSize: 11.5, color: C.t4, marginTop: 10 }}>Click a person to see their tasks. Subtasks assigned to someone count toward that person.</div>
          </Card>
        ) : person && (
          <div>
            <Card C={C} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <Avatar C={C} label={person.id === UNASSIGNED ? '?' : person.name} size={44} />
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: C.t1 }}>{person.name}</div>
                  <div style={{ fontSize: 12.5, color: C.t3 }}>{person.member ? `${person.member.email}${person.sub ? ` · ${person.sub}` : ''}` : person.sub}</div>
                </div>
                <div style={{ display: 'inline-flex', border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                  {[['open', 'Open'], ['done', 'Completed']].map(([id, l]) => <button key={id} onClick={() => setShow(id)} style={{ padding: '8px 14px', border: 'none', background: show === id ? C.accentSoft : 'transparent', color: show === id ? C.t1 : C.t3, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', boxShadow: show === id ? `inset 0 -2px 0 ${C.accent}` : 'none' }}>{l}</button>)}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginTop: 12 }}>
                <Stat label="Open" value={person.open} />
                <Stat label="Overdue" value={person.overdue} color={person.overdue ? C.dn : undefined} />
                <Stat label="Due next 7 days" value={person.soon} color={person.soon ? C.warn : undefined} />
                <Stat label="Done this month" value={person.doneMonth} color={person.doneMonth ? C.up : undefined} />
              </div>
              <div style={{ marginTop: 12 }}><Input C={C} value={q} onChange={setQ} placeholder="Search this person's work…" /></div>
            </Card>
            {!list.length && <Card C={C}><Empty C={C} icon={show === 'open' ? '✓' : '◫'} title={show === 'open' ? 'Nothing open' : 'Nothing completed yet'}>{show === 'open' ? `${person.name} has no open tasks.` : 'Finished tasks appear here.'}</Empty></Card>}
            {byFamily.map((g) => (
              <Card C={C} key={g.familyId} style={{ marginBottom: 10, padding: '10px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.accent, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 6 }}>{g.family} <span style={{ color: C.t4, fontWeight: 600 }}>· {g.items.length}</span></div>
                {g.items.map((r) => (
                  <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: C.t1, textDecoration: r.closed ? 'line-through' : 'none' }}>{r.title}</div>
                      <div style={{ fontSize: 11.5, color: C.t3 }}>{r.kind === 'Subtask' ? `Subtask of ${r.parent}` : ''}{r.kind === 'Subtask' && r.project ? ' · ' : ''}{r.project}{r.subs ? ` · subtasks ${r.subs}` : ''}</div>
                    </div>
                    {r.kind === 'Task' && STATUS_BY_ID[r.status] && <Pill C={C}>{STATUS_BY_ID[r.status].label}</Pill>}
                    {r.priority === 'high' && PRIORITY_BY_ID.high && <Pill C={C} color={C.dn}>High</Pill>}
                    <span style={{ fontSize: 12, fontWeight: 700, color: dueColor(r), minWidth: 92, textAlign: 'right' }}>{r.closed ? (r.doneAt ? `done ${shortDate(String(r.doneAt).slice(0, 10))}` : 'done') : r.due ? `${r.due < today ? 'overdue · ' : ''}${shortDate(r.due)}` : 'no date'}</span>
                    <Btn C={C} small ghost onClick={() => openTask(r.familyId, r.taskId)}>Open</Btn>
                  </div>
                ))}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
