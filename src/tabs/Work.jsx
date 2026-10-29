import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, useFamily } from '../lib/store'
import { useAuth } from '../lib/auth'
import { DARK } from '../lib/theme'
import { DEFAULT_ROSTER } from '../data/defaults'
import { DOC_CATEGORIES } from '../data/docCategories'
import { Card, Eyebrow, Title, Btn, Input, TextArea, Select, Field, Empty, Note, Spinner, Confirm } from '../components/ui'
import { download, uid, nowIso } from '../lib/util'
import {
  useWork, STATUSES, STATUS_BY_ID, PRIORITIES, PRIORITY_BY_ID, PROJECT_COLORS, PROJECT_STATUSES, TOOLS_PROJECT_NAME,
  buildTemplate, buildWorkflow, planToolImport, todayIso, addDays, isOverdue, isClosed, shortDate, relTime, nameFromEmail, initialsOf, ENGAGEMENT_TEMPLATE,
} from '../lib/work'
import { WORKFLOWS, WORKFLOW_BY_ID, workflowTaskCount } from '../data/workflows'

const COLS = '34px minmax(220px,1fr) 130px 150px 112px 88px 56px 140px'
const VIEW_KEY = 'planning_work_view'
const rosterPhoto = (p) => {
  const src = p?.photo || DEFAULT_ROSTER.find((d) => d.name === p?.name)?.photo
  return src ? (src.startsWith('data:') ? src : `${import.meta.env.BASE_URL || '/'}${src}`) : ''
}

export default function Work(props) {
  const [f] = useFamily()
  if (!f) return null
  return <WorkInner key={f.id} f={f} {...props} />
}

function WorkInner({ C, isDesktop, f }) {
  const { settings, putFile, getFile, removeFile } = useStore()
  const { email } = useAuth()
  const W = useWork(f.id)
  const { projects, tasks } = W
  const me = String(email || '').toLowerCase()
  const roster = useMemo(() => (settings.roster || []).filter((p) => p.name), [settings.roster])
  const ownerOptions = useMemo(() => [{ value: '', label: 'Unassigned' }, ...(me ? [{ value: me, label: `Me (${me})` }] : []), ...roster.map((p) => ({ value: p.name, label: p.name }))], [roster, me])
  const [view, setViewState] = useState(() => { try { return localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'table' } catch { return 'table' } })
  const setView = (v) => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v) } catch { /* ignore */ } }
  const [flt, setFlt] = useState({ owner: '', status: '', mine: false, overdue: false, q: '' })
  const [openId, setOpenId] = useState(null)
  const [editId, setEditId] = useState(null)
  const [editProj, setEditProj] = useState(null)
  const [modal, setModal] = useState(null) // 'template'
  const [flash, setFlash] = useState(null)
  const say = (t, tone = 'success') => { setFlash({ t, tone }); setTimeout(() => setFlash((x) => (x && x.t === t ? null : x)), 6000) }
  const isDark = C === DARK

  const today = todayIso()
  const inSeven = addDays(today, 7)
  const thisMonth = today.slice(0, 7)
  const stats = useMemo(() => {
    const open = tasks.filter((t) => !isClosed(t.status))
    const done = tasks.filter((t) => isClosed(t.status))
    return {
      open: open.length,
      overdue: open.filter((t) => isOverdue(t, today)).length,
      soon: open.filter((t) => t.due && t.due >= today && t.due <= inSeven).length,
      doneMonth: done.filter((t) => String(t.doneAt || t.updatedAt || '').slice(0, 7) === thisMonth).length,
      pct: tasks.length ? Math.round((done.length / tasks.length) * 100) : 0,
    }
  }, [tasks, today, inSeven, thisMonth])

  const filtersOn = Boolean(flt.owner || flt.status || flt.mine || flt.overdue || flt.q)
  const projName = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p.name])), [projects])
  const visible = useMemo(() => {
    const q = flt.q.trim().toLowerCase()
    return tasks.filter((t) => {
      if (flt.owner === '__none' ? t.owner : flt.owner && t.owner !== flt.owner) return false
      if (flt.status && t.status !== flt.status) return false
      if (flt.mine && String(t.owner).toLowerCase() !== me) return false
      if (flt.overdue && !isOverdue(t, today)) return false
      if (q && !`${t.title} ${t.notes} ${t.owner} ${projName[t.projectId] || ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [tasks, flt, me, today, projName])
  const toImport = useMemo(() => planToolImport(f, tasks, today), [f, tasks, today])
  const openTask = tasks.find((t) => t.id === openId) || null
  useEffect(() => { if (openId && !openTask && W.ready) setOpenId(null) }, [openId, openTask, W.ready])

  const ownerFilterOptions = useMemo(() => {
    const extra = [...new Set(tasks.map((t) => t.owner).filter((o) => o && !ownerOptions.some((x) => x.value === o)))].map((o) => ({ value: o, label: o }))
    return [{ value: '', label: 'All owners' }, { value: '__none', label: 'Unassigned' }, ...ownerOptions.filter((o) => o.value), ...extra]
  }, [ownerOptions, tasks])

  /* ── actions ── */
  const newProject = () => { const id = W.addProject({ name: 'New project' }); setEditProj(id) }
  const newTask = () => {
    const pid = projects[0]?.id || W.addProject({ name: 'General' })
    setFlt({ owner: '', status: '', mine: false, overdue: false, q: '' })
    const id = W.addTask({ projectId: pid, title: '' })
    if (isDesktop) setEditId(id); else setOpenId(id)
  }
  const addToGroup = (pid, title) => { const s = title.trim(); if (s) W.addTask({ projectId: pid, title: s }) }
  const toggleDone = (t) => W.updateTask(t.id, { status: t.status === 'done' ? 'todo' : 'done' })
  const duplicate = (t) => W.addTask({ projectId: t.projectId, title: `${t.title || 'Untitled task'} (copy)`, status: 'todo', owner: t.owner, due: t.due, priority: t.priority, notes: t.notes, subtasks: t.subtasks.map((s) => ({ ...s, id: uid(), done: false })) })
  const createTemplate = (id, start) => {
    const w = WORKFLOW_BY_ID[id]
    const { projects: ps, tasks: ts } = w ? buildWorkflow(id, start) : buildTemplate(start)
    W.addMany(ps, ts)
    setModal(null)
    say(`Created ${ps.length} projects and ${ts.length} tasks from ${w ? `the ${w.name} workflow` : 'the standard engagement'}, starting ${shortDate(start)}.`)
  }
  const importTools = () => {
    if (!toImport.length) { say('No new accepted tools to import. Accept tools in Priorities first, or all of them are already here.', 'info'); return }
    const existing = projects.find((p) => p.name === TOOLS_PROJECT_NAME)
    if (existing) W.addMany([], toImport.map((t) => ({ ...t, projectId: existing.id })))
    else W.addMany([{ _key: 'tools', name: TOOLS_PROJECT_NAME, color: '#A06CD5' }], toImport.map((t) => ({ ...t, projectKey: 'tools' })))
    say(`Imported ${toImport.length} accepted tool${toImport.length > 1 ? 's' : ''} into "${TOOLS_PROJECT_NAME}".`)
  }

  const shared = { C, isDesktop, isDark, ownerOptions, roster, me }
  const css = `
    .wk-row .wk-acts { opacity: 0; pointer-events: none; transition: opacity .12s; }
    .wk-row:hover .wk-acts, .wk-row:focus-within .wk-acts { opacity: 1; pointer-events: auto; }
    .wk-row:hover { background: ${C.cardHover}; }
    .wk-row .wk-pencil { opacity: 0; transition: opacity .12s; }
    .wk-row:hover .wk-pencil, .wk-row:focus-within .wk-pencil { opacity: .8; }
    .wk-ghost { background: transparent; border: 1px solid transparent; color: ${C.t1}; font: inherit; }
    .wk-ghost:hover, .wk-ghost:focus { border-color: ${C.border}; background: ${C.surface}; }
    .wk-card:hover { border-color: ${C.borderHover} !important; }
  `

  if (W.missingTable) {
    return (
      <div>
        <Title C={C} isDesktop={isDesktop}>Work · {f.name}</Title>
        <Card C={C} accent>
          <Eyebrow C={C}>One-time setup</Eyebrow>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.t1, marginBottom: 6 }}>Work tracking needs a one-time database update</div>
          <div style={{ fontSize: 13, color: C.t3, lineHeight: 1.6 }}>Ask Claude to apply <code style={{ background: C.accentSoft, padding: '2px 6px', borderRadius: 6, color: C.t1 }}>supabase/migrations/20261027_work_items.sql</code>. It adds the shared table that holds projects and tasks. Nothing else changes, and this tab will work as soon as it is applied.</div>
          <div style={{ marginTop: 14 }}><Btn C={C} onClick={() => W.reload()}>Check again</Btn></div>
        </Card>
      </div>
    )
  }

  const empty = W.ready && !projects.length && !tasks.length

  return (
    <div>
      <style>{css}</style>
      <Title C={C} isDesktop={isDesktop} sub="Projects, tasks, owners, due dates and files for this family. Changes are shared with the team as they happen."
        right={<><Btn C={C} primary onClick={newProject}>+ New project</Btn><Btn C={C} onClick={newTask}>+ New task</Btn></>}>Work · {f.name}</Title>

      {W.error && <Note C={C} tone="danger" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ flex: 1, minWidth: 200 }}>Could not sync work items: {W.error}</span>
          <Btn C={C} small onClick={() => { W.clearError(); W.reload() }}>Retry</Btn>
        </div>
      </Note>}
      {flash && <Note C={C} tone={flash.tone} style={{ marginBottom: 12 }}>{flash.t}</Note>}

      {!W.ready ? <Spinner C={C} label="Loading work…" /> : empty ? (
        <FirstRun C={C} onTemplate={() => setModal('template')} onProject={newProject} onImport={importTools} importCount={toImport.length} />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 14 }}>
            <StatBox C={C} label="Open tasks" value={stats.open} />
            <StatBox C={C} label="Overdue" value={stats.overdue} color={stats.overdue ? C.dn : undefined} />
            <StatBox C={C} label="Due next 7 days" value={stats.soon} color={stats.soon ? C.warn : undefined} />
            <StatBox C={C} label="Done this month" value={stats.doneMonth} color={stats.doneMonth ? C.up : undefined} />
            <StatBox C={C} label="Complete" value={`${stats.pct}%`} bar={stats.pct} />
          </div>

          <Toolbar C={C} isDesktop={isDesktop} view={view} setView={setView} flt={flt} setFlt={setFlt} ownerFilterOptions={ownerFilterOptions}
            onTemplate={() => setModal('template')} onImport={importTools} importCount={toImport.length} />

          {view === 'table' ? (
            <TableView {...shared} W={W} projects={projects} visible={visible} filtersOn={filtersOn} editId={editId} setEditId={setEditId} editProj={editProj} setEditProj={setEditProj}
              onOpen={setOpenId} onToggle={toggleDone} onDuplicate={duplicate} onAdd={addToGroup} today={today} />
          ) : (
            <BoardView {...shared} W={W} projects={projects} visible={visible} onOpen={setOpenId} today={today} />
          )}
        </>
      )}

      {openTask && <TaskPanel {...shared} f={f} W={W} task={openTask} projects={projects} onClose={() => setOpenId(null)} putFile={putFile} getFile={getFile} removeFile={removeFile} email={me} />}
      {modal === 'template' && <TemplateModal C={C} isDark={isDark} projects={projects} onClose={() => setModal(null)} onCreate={createTemplate} />}
    </div>
  )
}

/* ───────────────────────── small pieces ───────────────────────── */

const StatBox = ({ C, label, value, color, bar }) => (
  <div style={{ padding: '12px 14px', borderRadius: 12, background: C.card, border: `1px solid ${C.border}` }}>
    <div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color: color || C.t1, fontVariantNumeric: 'tabular-nums', marginTop: 3 }}>{value}</div>
    {bar != null && <div style={{ height: 4, borderRadius: 2, background: C.border, marginTop: 6, overflow: 'hidden' }}><div style={{ width: `${bar}%`, height: '100%', background: C.up }} /></div>}
  </div>
)

function Avatar({ C, owner, roster, size = 24 }) {
  const person = owner ? roster.find((p) => p.name.toLowerCase() === String(owner).toLowerCase()) : null
  const photo = person ? rosterPhoto(person) : ''
  const base = { width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.4), fontWeight: 800 }
  if (!owner) return <span style={{ ...base, border: `1px dashed ${C.t4}`, color: C.t4 }}>+</span>
  if (photo) return <img src={photo} alt="" style={{ ...base, objectFit: 'cover', objectPosition: 'top', background: C.surface, border: `1px solid ${C.borderActive}` }} />
  return <span style={{ ...base, background: C.accentSoft, border: `1px solid ${C.borderActive}`, color: C.t1 }}>{initialsOf(owner)}</span>
}

const ownerLabel = (o, me) => (!o ? 'Unassigned' : String(o).toLowerCase() === me ? 'Me' : String(o).includes('@') ? nameFromEmail(o) : o)

function OwnerSelect({ C, value, onChange, ownerOptions, roster, me, showName = true, label = 'Owner' }) {
  const opts = value && !ownerOptions.some((o) => o.value === value) ? [...ownerOptions, { value, label: value }] : ownerOptions
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7, maxWidth: '100%', minWidth: 0, cursor: 'pointer' }}>
      <Avatar C={C} owner={value} roster={roster} />
      {showName && <span style={{ fontSize: 12.5, color: value ? C.t1 : C.t4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ownerLabel(value, me)}</span>}
      <select aria-label={label} value={value || ''} onChange={(e) => onChange(e.target.value)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </span>
  )
}

function StatusPill({ C, value, onChange, block }) {
  const s = STATUS_BY_ID[value] || STATUS_BY_ID.todo
  return (
    <span style={{ position: 'relative', display: block ? 'flex' : 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '5px 10px', borderRadius: 6, background: s.color, color: s.fg, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', minWidth: block ? 0 : 104, cursor: 'pointer' }}>
      {s.label}
      <select aria-label="Status" value={s.id} onChange={(e) => onChange(e.target.value)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}>
        {STATUSES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
      </select>
    </span>
  )
}

function PriorityChip({ C, value, onChange }) {
  const p = PRIORITY_BY_ID[value] || PRIORITY_BY_ID.medium
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, background: p.color + '26', border: `1px solid ${p.color}77`, color: p.color, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
      {p.label}
      <select aria-label="Priority" value={p.id} onChange={(e) => onChange(e.target.value)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}>
        {PRIORITIES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
      </select>
    </span>
  )
}

const Clip = ({ color, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>
)
const Chevron = ({ color, open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}><polyline points="9 6 15 12 9 18" /></svg>
)

function DueInput({ C, value, onChange, overdue, isDark, label = 'Due date', style }) {
  return (
    <input type="date" aria-label={label} value={value || ''} onChange={(e) => onChange(e.target.value)}
      style={{ padding: '4px 6px', borderRadius: 8, border: `1px solid ${overdue ? C.dn + '88' : 'transparent'}`, background: overdue ? C.dnSoft : 'transparent', color: overdue ? C.dn : value ? C.t1 : C.t4, fontWeight: overdue ? 700 : 500, fontSize: 12.5, fontFamily: 'inherit', outline: 'none', colorScheme: isDark ? 'dark' : 'light', width: '100%', minWidth: 0, ...style }} />
  )
}

function Seg({ C, value, onChange, options }) {
  return (
    <div style={{ display: 'inline-flex', border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
      {options.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)} style={{ padding: '8px 14px', border: 'none', background: value === o.id ? C.accentSoft : 'transparent', color: value === o.id ? C.t1 : C.t3, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', boxShadow: value === o.id ? `inset 0 -2px 0 ${C.accent}` : 'none' }}>{o.label}</button>
      ))}
    </div>
  )
}

function Toggle2({ C, on, onClick, children }) {
  return <button onClick={onClick} aria-pressed={on} style={{ padding: '8px 13px', borderRadius: 10, border: `1px solid ${on ? C.accent : C.border}`, background: on ? C.accentSoft : 'transparent', color: on ? C.t1 : C.t3, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>{children}</button>
}

function Toolbar({ C, isDesktop, view, setView, flt, setFlt, ownerFilterOptions, onTemplate, onImport, importCount }) {
  const set = (p) => setFlt((x) => ({ ...x, ...p }))
  const anyFilter = flt.owner || flt.status || flt.mine || flt.overdue || flt.q
  return (
    <Card C={C} style={{ padding: '12px 14px', marginBottom: 14 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Seg C={C} value={view} onChange={setView} options={[{ id: 'table', label: 'Table' }, { id: 'board', label: 'Board' }]} />
        <Input C={C} value={flt.q} onChange={(v) => set({ q: v })} placeholder="Search tasks…" aria-label="Search tasks" style={{ width: isDesktop ? 170 : '100%', flex: isDesktop ? '0 0 auto' : '1 1 100%', padding: '8px 12px' }} />
        <Select C={C} value={flt.owner} onChange={(v) => set({ owner: v })} options={ownerFilterOptions} style={{ padding: '8px 10px', maxWidth: 150 }} />
        <Select C={C} value={flt.status} onChange={(v) => set({ status: v })} options={[{ value: '', label: 'All statuses' }, ...STATUSES.map((s) => ({ value: s.id, label: s.label }))]} style={{ padding: '8px 10px', maxWidth: 150 }} />
        <Toggle2 C={C} on={flt.mine} onClick={() => set({ mine: !flt.mine })}>Mine</Toggle2>
        <Toggle2 C={C} on={flt.overdue} onClick={() => set({ overdue: !flt.overdue })}>Overdue</Toggle2>
        {anyFilter && <Btn C={C} small ghost onClick={() => setFlt({ owner: '', status: '', mine: false, overdue: false, q: '' })}>Clear</Btn>}
        <span style={{ flex: 1 }} />
        <Btn C={C} small onClick={onTemplate}>Start from template</Btn>
        <Btn C={C} small onClick={onImport} title="Create tasks from the tools accepted in Priorities">Import accepted tools{importCount ? ` (${importCount})` : ''}</Btn>
      </div>
    </Card>
  )
}

function FirstRun({ C, onTemplate, onProject, onImport, importCount }) {
  return (
    <Card C={C} accent>
      <Empty C={C} icon="▦" title="Plan the work for this family"
        action={<div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Btn C={C} primary onClick={onTemplate}>Start from template</Btn>
          <Btn C={C} onClick={onProject}>+ New project</Btn>
          <Btn C={C} onClick={onImport}>Import accepted tools{importCount ? ` (${importCount})` : ''}</Btn>
        </div>}>
        Projects hold tasks. Each task has an owner, status, due date, notes, subtasks, comments and files, and the team sees changes live.<br />
        Start from one of the Paradiem workflows (Gap Analysis, Gap Analysis & Blueprint, Survey, Design), import the tools accepted in Priorities, or build your own list.
      </Empty>
    </Card>
  )
}

/* ───────────────────────── table view ───────────────────────── */

function TableView({ C, isDesktop, isDark, ownerOptions, roster, me, W, projects, visible, filtersOn, editId, setEditId, editProj, setEditProj, onOpen, onToggle, onDuplicate, onAdd, today }) {
  const groups = projects.map((p) => ({ p, tasks: visible.filter((t) => t.projectId === p.id) }))
  const orphans = visible.filter((t) => !projects.some((p) => p.id === t.projectId))
  const shown = groups.filter((g) => !filtersOn || g.tasks.length)
  const allTasks = (pid) => W.tasks.filter((t) => t.projectId === pid)
  const body = (
    <>
      {shown.map(({ p, tasks }) => (
        <div key={p.id} style={{ marginBottom: 14, border: `1px solid ${C.border}`, borderRadius: 14, background: C.card, overflow: 'hidden', borderLeft: `4px solid ${p.color}` }}>
          <ProjectHeader C={C} isDesktop={isDesktop} isDark={isDark} p={p} all={allTasks(p.id)} W={W} ownerOptions={ownerOptions} roster={roster} me={me} editing={editProj === p.id} setEditing={setEditProj} />
          {!p.collapsed && (
            <>
              {tasks.map((t) => (
                <TaskRow key={t.id} C={C} isDesktop={isDesktop} isDark={isDark} t={t} W={W} ownerOptions={ownerOptions} roster={roster} me={me} today={today}
                  editing={editId === t.id} setEditId={setEditId} onOpen={onOpen} onToggle={onToggle} onDuplicate={onDuplicate} />
              ))}
              {!tasks.length && filtersOn === false && <div style={{ padding: '10px 16px', fontSize: 12, color: C.t4 }}>No tasks yet.</div>}
              <AddRow C={C} onAdd={(title) => onAdd(p.id, title)} />
            </>
          )}
        </div>
      ))}
      {orphans.length > 0 && <Note C={C} tone="warn">{orphans.length} task{orphans.length > 1 ? 's' : ''} belong to a project that no longer exists.</Note>}
      {filtersOn && !shown.length && <Empty C={C} icon="⌕" title="Nothing matches these filters">Clear the filters to see every task.</Empty>}
    </>
  )
  if (!isDesktop) return <div>{body}</div>
  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <div style={{ minWidth: 960 }}>
        <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '0 16px 6px 20px', fontSize: 10, fontWeight: 700, color: C.t4, textTransform: 'uppercase', letterSpacing: 1 }}>
          <span /><span>Task</span><span>Owner</span><span>Status</span><span>Due</span><span>Priority</span><span>Files</span><span>Updated</span>
        </div>
        {body}
      </div>
    </div>
  )
}

function ProjectHeader({ C, isDesktop, isDark, p, all, W, ownerOptions, roster, me, editing, setEditing }) {
  const done = all.filter((t) => isClosed(t.status)).length
  const pct = all.length ? Math.round((done / all.length) * 100) : 0
  const ref = useRef(null)
  useEffect(() => { if (editing && ref.current) { ref.current.focus(); ref.current.select() } }, [editing])
  const nextColor = () => W.updateProject(p.id, { color: PROJECT_COLORS[(PROJECT_COLORS.indexOf(p.color) + 1) % PROJECT_COLORS.length] })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: isDesktop ? 12 : 8, flexWrap: 'wrap', padding: '10px 14px', borderBottom: p.collapsed ? 'none' : `1px solid ${C.border}`, background: C.surface }}>
      <button aria-label={p.collapsed ? 'Expand project' : 'Collapse project'} onClick={() => W.updateProject(p.id, { collapsed: !p.collapsed })} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}><Chevron color={p.color} open={!p.collapsed} /></button>
      <button title="Change colour" aria-label="Change project colour" onClick={nextColor} style={{ width: 12, height: 22, borderRadius: 3, background: p.color, border: 'none', cursor: 'pointer', padding: 0 }} />
      <input ref={ref} aria-label="Project name" className="wk-ghost" value={p.name} placeholder="Project name" onFocus={() => setEditing(p.id)} onBlur={() => setEditing(null)} onChange={(e) => W.updateProject(p.id, { name: e.target.value })}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur() }}
        style={{ flex: '1 1 160px', minWidth: 120, padding: '5px 8px', borderRadius: 8, fontSize: 15, fontWeight: 800, outline: 'none' }} />
      <span style={{ fontSize: 11.5, color: C.t3, whiteSpace: 'nowrap' }}>{all.length} task{all.length === 1 ? '' : 's'}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 110 }} title={`${done} of ${all.length} done`}>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: C.border, overflow: 'hidden', minWidth: 60 }}><div style={{ width: `${pct}%`, height: '100%', background: C.up }} /></div>
        <span style={{ fontSize: 11, color: C.t3, fontVariantNumeric: 'tabular-nums', width: 32 }}>{pct}%</span>
      </div>
      <OwnerSelect C={C} value={p.owner} onChange={(v) => W.updateProject(p.id, { owner: v })} ownerOptions={ownerOptions} roster={roster} me={me} showName={isDesktop} label="Project owner" />
      <div style={{ width: 128 }}><DueInput C={C} value={p.due} onChange={(v) => W.updateProject(p.id, { due: v })} isDark={isDark} label="Project due date" /></div>
      <select aria-label="Project status" value={p.status} onChange={(e) => W.updateProject(p.id, { status: e.target.value })} style={{ padding: '4px 6px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.card, color: C.t2, fontSize: 11.5, fontFamily: 'inherit' }}>
        {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <Confirm C={C} onConfirm={() => W.removeProject(p.id)}>Delete</Confirm>
    </div>
  )
}

function TitleCell({ C, t, editing, setEditId, onChange, onOpen, compact }) {
  const ref = useRef(null)
  useEffect(() => { if (editing && ref.current) ref.current.focus() }, [editing])
  const subDone = t.subtasks.filter((s) => s.done).length
  const meta = (
    <>
      {t.subtasks.length > 0 && <span title="Subtasks" style={{ fontSize: 11, color: C.t4, whiteSpace: 'nowrap' }}>☑ {subDone}/{t.subtasks.length}</span>}
      {t.comments.length > 0 && <span title="Comments" style={{ fontSize: 11, color: C.t4, whiteSpace: 'nowrap' }}>✉ {t.comments.length}</span>}
    </>
  )
  if (editing) {
    return <input ref={ref} aria-label="Task title" value={t.title} placeholder="Task name" onChange={(e) => onChange(e.target.value)} onBlur={() => setEditId(null)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur() }}
      style={{ width: '100%', padding: '5px 8px', borderRadius: 8, border: `1px solid ${C.accent}`, background: C.surface, color: C.t1, fontSize: 13.5, fontFamily: 'inherit', outline: 'none' }} />
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <span role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); if (e.key === 'F2') setEditId(t.id) }} title="Click to open the task. Use the pencil (or F2) to rename."
        style={{ fontSize: 13.5, fontWeight: 600, color: t.status === 'done' ? C.t4 : t.title ? C.t1 : C.t4, textDecoration: t.status === 'done' ? 'line-through' : 'none', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: compact ? 'normal' : 'nowrap', overflowWrap: 'anywhere', minWidth: 0 }}>{t.title || 'Untitled task'}</span>
      {!compact && <button className="wk-pencil" aria-label="Rename task" title="Rename" onClick={() => setEditId(t.id)} style={{ background: 'transparent', border: 'none', color: C.t3, cursor: 'pointer', fontSize: 12, padding: 2 }}>✎</button>}
      {meta}
    </div>
  )
}

function TaskRow({ C, isDesktop, isDark, t, W, ownerOptions, roster, me, today, editing, setEditId, onOpen, onToggle, onDuplicate }) {
  const overdue = isOverdue(t, today)
  const check = <input type="checkbox" aria-label="Done" checked={t.status === 'done'} onChange={() => onToggle(t)} style={{ accentColor: C.up, width: 16, height: 16, cursor: 'pointer' }} />
  const upd = (p) => W.updateTask(t.id, p)
  const fileBtn = (
    <button aria-label={`Files (${t.files.length})`} onClick={() => onOpen(t.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, color: t.files.length ? C.t1 : C.t4, fontSize: 12, padding: 2 }}>
      <Clip color={t.files.length ? C.accent : C.t4} />{t.files.length > 0 && t.files.length}
    </button>
  )
  if (!isDesktop) {
    return (
      <div className="wk-row" style={{ padding: '12px 14px', borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ paddingTop: 2 }}>{check}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <TitleCell C={C} t={t} compact editing={false} setEditId={() => onOpen(t.id)} onChange={() => {}} onOpen={() => onOpen(t.id)} />
          </div>
          <div style={{ width: 118, flexShrink: 0 }}><StatusPill C={C} value={t.status} onChange={(v) => upd({ status: v })} block /></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingLeft: 26 }}>
          <OwnerSelect C={C} value={t.owner} onChange={(v) => upd({ owner: v })} ownerOptions={ownerOptions} roster={roster} me={me} />
          <div style={{ width: 120 }}><DueInput C={C} value={t.due} onChange={(v) => upd({ due: v })} overdue={overdue} isDark={isDark} /></div>
          {fileBtn}
          <span style={{ marginLeft: 'auto' }}><PriorityChip C={C} value={t.priority} onChange={(v) => upd({ priority: v })} /></span>
        </div>
      </div>
    )
  }
  return (
    <div className="wk-row" style={{ position: 'relative', display: 'grid', gridTemplateColumns: COLS, gap: 8, alignItems: 'center', padding: '7px 16px 7px 16px', borderTop: `1px solid ${C.border}`, background: C.card }}>
      <span>{check}</span>
      <TitleCell C={C} t={t} editing={editing} setEditId={setEditId} onChange={(v) => upd({ title: v })} onOpen={() => onOpen(t.id)} />
      <OwnerSelect C={C} value={t.owner} onChange={(v) => upd({ owner: v })} ownerOptions={ownerOptions} roster={roster} me={me} />
      <StatusPill C={C} value={t.status} onChange={(v) => upd({ status: v })} block />
      <DueInput C={C} value={t.due} onChange={(v) => upd({ due: v })} overdue={overdue} isDark={isDark} />
      <span><PriorityChip C={C} value={t.priority} onChange={(v) => upd({ priority: v })} /></span>
      <span>{fileBtn}</span>
      <span style={{ fontSize: 11, color: C.t4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.updatedAt ? `Updated by ${t.updatedBy || 'unknown'} ${new Date(t.updatedAt).toLocaleString()}` : ''}>{t.updatedAt ? `${nameFromEmail(t.updatedBy) || '—'} · ${relTime(t.updatedAt)}` : ''}</span>
      <div className="wk-acts" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 4, alignItems: 'center', background: C.cardHover, padding: '3px 5px', borderRadius: 10, border: `1px solid ${C.border}` }}>
        <Btn C={C} small ghost title="Open" onClick={() => onOpen(t.id)}>Open</Btn>
        <Btn C={C} small ghost title="Duplicate" onClick={() => onDuplicate(t)}>Duplicate</Btn>
        <Confirm C={C} onConfirm={() => W.removeTask(t.id)}>Delete</Confirm>
      </div>
    </div>
  )
}

function AddRow({ C, onAdd }) {
  const [v, setV] = useState('')
  const commit = () => { if (v.trim()) { onAdd(v); setV('') } }
  return (
    <div style={{ padding: '6px 16px 8px 50px', borderTop: `1px solid ${C.border}` }}>
      <input aria-label="Add task" value={v} onChange={(e) => setV(e.target.value)} placeholder="+ Add task (press Enter)" onKeyDown={(e) => { if (e.key === 'Enter') commit() }} onBlur={commit}
        style={{ width: '100%', maxWidth: 420, padding: '6px 8px', borderRadius: 8, border: '1px solid transparent', background: 'transparent', color: C.t1, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
        onFocus={(e) => { e.currentTarget.style.background = C.surface; e.currentTarget.style.borderColor = C.border }} />
    </div>
  )
}

/* ───────────────────────── board view ───────────────────────── */

function BoardView({ C, isDesktop, ownerOptions, roster, me, W, projects, visible, onOpen, today }) {
  const [drag, setDrag] = useState(null)
  const [over, setOver] = useState(null)
  const proj = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects])
  return (
    <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8, alignItems: 'flex-start' }}>
      {STATUSES.map((s) => {
        const col = visible.filter((t) => t.status === s.id)
        return (
          <div key={s.id} data-col={s.id}
            onDragOver={(e) => { e.preventDefault(); setOver(s.id) }}
            onDragLeave={() => setOver((o) => (o === s.id ? null : o))}
            onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain') || drag; setOver(null); setDrag(null); const t = W.tasks.find((x) => x.id === id); if (t && t.status !== s.id) W.updateTask(id, { status: s.id }) }}
            style={{ flex: isDesktop ? '1 1 0' : '0 0 270px', minWidth: isDesktop ? 200 : 270, background: over === s.id ? C.accentSoft : C.surface, border: `1px solid ${over === s.id ? C.accent : C.border}`, borderRadius: 14, padding: 10, minHeight: 140, transition: 'background .12s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px 10px' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
              <span style={{ fontSize: 12.5, fontWeight: 800, color: C.t1 }}>{s.label}</span>
              <span style={{ fontSize: 11.5, color: C.t4 }}>{col.length}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {col.map((t) => {
                const p = proj[t.projectId]
                const overdue = isOverdue(t, today)
                return (
                  <div key={t.id} className="wk-card" draggable data-task={t.id} onDragStart={(e) => { e.dataTransfer.setData('text/plain', t.id); e.dataTransfer.effectAllowed = 'move'; setDrag(t.id) }} onDragEnd={() => { setDrag(null); setOver(null) }}
                    onClick={() => onOpen(t.id)}
                    style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${p?.color || C.accent}`, borderRadius: 10, padding: '10px 12px', cursor: 'grab', opacity: drag === t.id ? 0.4 : 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.status === 'done' ? C.t4 : C.t1, textDecoration: t.status === 'done' ? 'line-through' : 'none', lineHeight: 1.35, marginBottom: 8 }}>{t.title || 'Untitled task'}</div>
                    {p && <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10.5, fontWeight: 700, color: p.color, background: p.color + '1F', padding: '2px 8px', borderRadius: 20, marginBottom: 8, maxWidth: '100%' }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span></div>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <Avatar C={C} owner={t.owner} roster={roster} size={22} />
                      {t.due && <span style={{ fontSize: 11.5, fontWeight: overdue ? 700 : 500, color: overdue ? C.dn : C.t3 }}>{shortDate(t.due)}</span>}
                      <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: t.files.length ? C.t2 : C.t4 }}><Clip color={t.files.length ? C.accent : C.t4} size={12} />{t.files.length || ''}</span>
                    </div>
                    {!isDesktop && (
                      <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 8 }}>
                        <select aria-label="Move to status" value={t.status} onChange={(e) => W.updateTask(t.id, { status: e.target.value })} style={{ width: '100%', padding: '5px 6px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.t2, fontSize: 12, fontFamily: 'inherit' }}>
                          {STATUSES.map((x) => <option key={x.id} value={x.id}>Move to: {x.label}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )
              })}
              {!col.length && <div style={{ fontSize: 12, color: C.t4, textAlign: 'center', padding: '14px 4px' }}>Drop tasks here</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ───────────────────────── modals ───────────────────────── */

function Modal({ C, title, onClose, children, width = 560 }) {
  useEffect(() => { const h = (e) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [onClose])
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10010, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }} />
      <div role="dialog" aria-label={title} style={{ position: 'relative', width: '100%', maxWidth: width, maxHeight: '86dvh', overflowY: 'auto', background: C.card, border: `1px solid ${C.borderActive}`, borderTop: `2px solid ${C.accent}`, borderRadius: 14, padding: '18px 20px', boxShadow: '0 12px 40px rgba(0,0,0,0.45)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.t1 }}>{title}</div>
          <Btn C={C} small ghost onClick={onClose}>Close</Btn>
        </div>
        {children}
      </div>
    </div>
  )
}

function TemplateModal({ C, isDark, projects, onClose, onCreate }) {
  const [pick, setPick] = useState(WORKFLOWS[0].id)
  const [start, setStart] = useState(todayIso())
  const w = WORKFLOW_BY_ID[pick]
  const steps = w ? w.steps : ENGAGEMENT_TEMPLATE.map((p) => ({ name: p.name, color: p.color, tasks: p.tasks.map((t) => t.title) }))
  const count = w ? workflowTaskCount(w) : ENGAGEMENT_TEMPLATE.reduce((n, p) => n + p.tasks.length, 0)
  const hasDays = Boolean(w) && w.steps.some((x) => x.day != null || x.tasks.some((t) => Array.isArray(t) && t[1]?.day != null))
  const dup = w ? projects.some((x) => x.workflow === w.id) : ENGAGEMENT_TEMPLATE.some((p) => projects.some((x) => x.name === p.name))
  const options = [...WORKFLOWS.map((x) => ({ id: x.id, label: x.short })), { id: 'standard', label: 'Generic engagement' }]
  return (
    <Modal C={C} title="Start from a workflow" onClose={onClose} width={640}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {options.map((o) => <Toggle2 key={o.id} C={C} on={pick === o.id} onClick={() => setPick(o.id)}>{o.label}</Toggle2>)}
      </div>
      <div style={{ fontSize: 12.5, color: C.t3, lineHeight: 1.6, marginBottom: 12 }}>
        {w ? <>{w.blurb} Copied from <b style={{ color: C.t2 }}>{w.source}</b>: each monday step becomes a project and each subitem a task. </> : 'A generic four-phase engagement with due dates counted from the start date. '}
        Creates {steps.length} projects and {count} tasks. {w ? (hasDays ? 'Due dates are set only where the monday template states timing (contract one week before kick-off, check-ins in weeks 2 and 4); set the rest as meetings are booked. ' : 'The monday template has no due dates, so tasks start undated; set them as meetings are booked. ') : ''}Owners start as Unassigned.
      </div>
      <Field C={C} label={w ? w.startLabel : 'Engagement start date'}><Input C={C} type="date" value={start} onChange={setStart} aria-label="Start date" style={{ colorScheme: isDark ? 'dark' : 'light', maxWidth: 220 }} /></Field>
      <div style={{ margin: '14px 0', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '34dvh', overflowY: 'auto' }}>
        {steps.map((p) => (
          <div key={p.name} style={{ borderLeft: `3px solid ${p.color}`, paddingLeft: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.t1 }}>{p.name} <span style={{ fontWeight: 500, color: C.t4 }}>· {Math.max(1, p.tasks.length)} task{p.tasks.length > 1 ? 's' : ''}</span></div>
            <div style={{ fontSize: 11.5, color: C.t3, lineHeight: 1.5 }}>{p.tasks.map((t) => (Array.isArray(t) ? t[0] : t)).join(' · ')}</div>
          </div>
        ))}
      </div>
      {dup && <Note C={C} tone="warn" style={{ marginBottom: 12 }}>This family already has projects from this workflow. Creating it again adds duplicates.</Note>}
      {w?.next && <Note C={C} tone="info" style={{ marginBottom: 12 }}>Next stage in the monday flow: {WORKFLOW_BY_ID[w.next].name}. Start it from here when the client moves forward.</Note>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn C={C} ghost onClick={onClose}>Cancel</Btn>
        <Btn C={C} primary disabled={!start} onClick={() => onCreate(pick, start)}>Create projects and tasks</Btn>
      </div>
    </Modal>
  )
}

function AttachModal({ C, f, task, onAttach, onClose }) {
  const docs = f.documents || {}
  const cats = DOC_CATEGORIES.map((c) => ({ c, files: docs[c.id]?.files || [] })).filter((x) => x.files.length)
  const have = new Set(task.files.map((x) => x.key))
  return (
    <Modal C={C} title="Attach from family documents" onClose={onClose}>
      {!cats.length ? <Empty C={C} icon="▤" title="No documents uploaded yet">Upload files in the Documents tab and they can be attached to tasks here without copying them.</Empty> : cats.map(({ c, files }) => (
        <div key={c.id} style={{ marginBottom: 12 }}>
          <Eyebrow C={C}>{c.label}</Eyebrow>
          {files.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, marginBottom: 6 }}>
              <Clip color={C.accent} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
              <span style={{ fontSize: 11, color: C.t4, whiteSpace: 'nowrap' }}>{Math.max(1, Math.round((m.size || 0) / 1024))} KB</span>
              {have.has(m.key) ? <span style={{ fontSize: 11.5, fontWeight: 700, color: C.up }}>Attached</span> : <Btn C={C} small onClick={() => onAttach(c, m)}>Attach</Btn>}
            </div>
          ))}
        </div>
      ))}
    </Modal>
  )
}

/* ───────────────────────── task panel ───────────────────────── */

function TaskPanel({ C, isDesktop, isDark, ownerOptions, roster, me, f, W, task: t, projects, onClose, putFile, getFile, removeFile, email }) {
  const [attach, setAttach] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fileErr, setFileErr] = useState('')
  const [newSub, setNewSub] = useState('')
  const [comment, setComment] = useState('')
  const upd = (p) => W.updateTask(t.id, p)
  useEffect(() => { const h = (e) => { if (e.key === 'Escape' && !attach) onClose() }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [onClose, attach])
  const opts = t.owner && !ownerOptions.some((o) => o.value === t.owner) ? [...ownerOptions, { value: t.owner, label: t.owner }] : ownerOptions
  const by = email || 'local'

  const upload = async (list) => {
    const files = [...list]
    if (!files.length) return
    setBusy(true); setFileErr('')
    const metas = []
    try {
      for (const file of files) {
        const m = await putFile(f.id, file, { taskId: t.id })
        metas.push({ ...m, source: 'upload', by })
      }
    } catch (e) { setFileErr(`Upload failed: ${e?.message || e}`) }
    if (metas.length) W.updateTask(t.id, (cur) => ({ files: [...cur.files, ...metas] }))
    setBusy(false)
  }
  const attachDoc = (cat, m) => {
    W.updateTask(t.id, (cur) => (cur.files.some((x) => x.key === m.key) ? null : { files: [...cur.files, { id: uid(), key: m.key, name: m.name, size: m.size, type: m.type, uploadedAt: m.uploadedAt || nowIso(), source: 'document', category: cat.id, by }] }))
  }
  const dl = async (m) => {
    setFileErr('')
    try { const blob = await getFile(m.key); if (!blob) throw new Error('File not found in storage'); download(blob, m.name) } catch (e) { setFileErr(`Download failed: ${e?.message || e}`) }
  }
  const detach = async (m) => {
    setFileErr('')
    if (m.source === 'upload') { try { await removeFile(m.key) } catch { /* the reference is still detached */ } }
    W.updateTask(t.id, (cur) => ({ files: cur.files.filter((x) => x.id !== m.id) }))
  }
  const sub = (id, p) => upd({ subtasks: t.subtasks.map((s) => (s.id === id ? { ...s, ...p } : s)) })
  const addSub = () => { const s = newSub.trim(); if (!s) return; upd({ subtasks: [...t.subtasks, { id: uid(), text: s, done: false }] }); setNewSub('') }
  const post = () => { if (!comment.trim()) return; W.addComment(t.id, comment); setComment('') }
  const catLabel = (id) => DOC_CATEGORIES.find((c) => c.id === id)?.label

  const section = (label, children, right) => (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: C.accent, textTransform: 'uppercase', letterSpacing: 1.2 }}>{label}</div>{right}
      </div>
      {children}
    </div>
  )

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9990, background: 'rgba(0,0,0,0.5)' }} />
      <aside role="dialog" aria-label="Task details" style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: isDesktop ? 500 : '100%', maxWidth: '100%', zIndex: 9991, background: C.bg, borderLeft: `1px solid ${C.borderActive}`, display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 30px rgba(0,0,0,0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: isDesktop ? '14px 20px' : 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px', borderBottom: `1px solid ${C.border}`, background: C.surface }}>
          <input type="checkbox" aria-label="Done" checked={t.status === 'done'} onChange={() => upd({ status: t.status === 'done' ? 'todo' : 'done' })} style={{ accentColor: C.up, width: 18, height: 18, cursor: 'pointer' }} />
          <input aria-label="Task title" value={t.title} placeholder="Task name" onChange={(e) => upd({ title: e.target.value })}
            style={{ flex: 1, minWidth: 0, padding: '6px 8px', borderRadius: 8, border: '1px solid transparent', background: 'transparent', color: C.t1, fontSize: 18, fontWeight: 800, fontFamily: 'inherit', outline: 'none' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = C.borderActive }} onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent' }} />
          <Btn C={C} small ghost onClick={onClose} title="Close (Esc)">Close</Btn>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: isDesktop ? '8px 20px 24px' : '8px 16px 28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
            <Field C={C} label="Project">
              <Select C={C} value={t.projectId} onChange={(v) => upd({ projectId: v })} options={projects.some((p) => p.id === t.projectId) ? projects.map((p) => ({ value: p.id, label: p.name || 'Untitled project' })) : [{ value: t.projectId, label: '(missing project)' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]} style={{ width: '100%' }} />
            </Field>
            <Field C={C} label="Owner">
              <Select C={C} value={t.owner} onChange={(v) => upd({ owner: v })} options={opts} style={{ width: '100%' }} />
            </Field>
            <Field C={C} label="Status">
              <Select C={C} value={t.status} onChange={(v) => upd({ status: v })} options={STATUSES.map((s) => ({ value: s.id, label: s.label }))} style={{ width: '100%' }} />
            </Field>
            <Field C={C} label="Priority">
              <Select C={C} value={t.priority} onChange={(v) => upd({ priority: v })} options={PRIORITIES.map((p) => ({ value: p.id, label: p.label }))} style={{ width: '100%' }} />
            </Field>
            <Field C={C} label="Due date" style={{ gridColumn: '1 / -1' }}>
              <Input C={C} type="date" value={t.due} onChange={(v) => upd({ due: v })} aria-label="Due date" style={{ colorScheme: isDark ? 'dark' : 'light', maxWidth: 240, borderColor: isOverdue(t) ? C.dn : undefined }} />
            </Field>
          </div>

          {section('Notes', <TextArea C={C} rows={4} value={t.notes} onChange={(v) => upd({ notes: v })} placeholder="Context, links, what done looks like…" />)}

          {section(`Subtasks${t.subtasks.length ? ` · ${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}` : ''}`, (
            <div>
              {t.subtasks.map((s) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <input type="checkbox" aria-label="Subtask done" checked={s.done} onChange={() => sub(s.id, { done: !s.done })} style={{ accentColor: C.up, width: 15, height: 15 }} />
                  <input aria-label="Subtask text" value={s.text} onChange={(e) => sub(s.id, { text: e.target.value })} className="wk-ghost" style={{ flex: 1, minWidth: 0, padding: '5px 8px', borderRadius: 8, fontSize: 13, outline: 'none', textDecoration: s.done ? 'line-through' : 'none', color: s.done ? C.t4 : C.t1 }} />
                  <button aria-label="Remove subtask" onClick={() => upd({ subtasks: t.subtasks.filter((x) => x.id !== s.id) })} style={{ background: 'transparent', border: 'none', color: C.t4, cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>×</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8 }}>
                <Input C={C} value={newSub} onChange={setNewSub} placeholder="Add a subtask…" aria-label="New subtask" onKeyDown={(e) => { if (e.key === 'Enter') addSub() }} />
                <Btn C={C} onClick={addSub} disabled={!newSub.trim()}>Add</Btn>
              </div>
            </div>
          ))}

          {section(`Files${t.files.length ? ` · ${t.files.length}` : ''}`, (
            <div>
              {fileErr && <Note C={C} tone="danger" style={{ marginBottom: 8 }}>{fileErr}</Note>}
              {t.files.map((m) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, marginBottom: 6, flexWrap: 'wrap' }}>
                  <Clip color={C.accent} />
                  <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                    <div onClick={() => dl(m)} title="Download" style={{ fontSize: 13, fontWeight: 600, color: C.t1, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: C.t4 }}>{Math.max(1, Math.round((m.size || 0) / 1024))} KB · {m.source === 'document' ? `Family document${catLabel(m.category) ? ` · ${catLabel(m.category)}` : ''}` : 'Uploaded'} · {nameFromEmail(m.by) || '—'} {relTime(m.uploadedAt)}</div>
                  </div>
                  <Btn C={C} small onClick={() => dl(m)}>Download</Btn>
                  <Confirm C={C} onConfirm={() => detach(m)}>{m.source === 'upload' ? 'Remove' : 'Detach'}</Confirm>
                </div>
              ))}
              {!t.files.length && <div style={{ fontSize: 12, color: C.t4, marginBottom: 8 }}>No files yet.</div>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <label style={{ cursor: busy ? 'wait' : 'pointer' }}>
                  <span style={{ display: 'inline-block', padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, border: `1px solid ${C.accent}`, background: C.accentSoft, color: C.t1, opacity: busy ? 0.6 : 1 }}>{busy ? 'Uploading…' : 'Upload'}</span>
                  <input type="file" multiple disabled={busy} aria-label="Upload files" style={{ display: 'none' }} onChange={(e) => { const l = e.target.files; upload(l ? [...l] : []); e.target.value = '' }} />
                </label>
                <Btn C={C} onClick={() => setAttach(true)}>Attach from family documents</Btn>
              </div>
            </div>
          ))}

          {section(`Comments${t.comments.length ? ` · ${t.comments.length}` : ''}`, (
            <div>
              {t.comments.map((c) => (
                <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <Avatar C={C} owner={c.by} roster={roster} size={28} />
                  <div style={{ flex: 1, minWidth: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '8px 12px' }}>
                    <div style={{ fontSize: 11.5, color: C.t4, marginBottom: 2 }}><b style={{ color: C.t2 }}>{c.by}</b> · {new Date(c.at).toLocaleString()}</div>
                    <div style={{ fontSize: 13, color: C.t1, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.text}</div>
                  </div>
                </div>
              ))}
              <div onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') post() }}><TextArea C={C} rows={2} value={comment} onChange={setComment} placeholder="Write a comment… (Ctrl+Enter to post)" /></div>
              <div style={{ marginTop: 6, textAlign: 'right' }}><Btn C={C} primary disabled={!comment.trim()} onClick={post}>Post comment</Btn></div>
            </div>
          ))}

          <div style={{ marginTop: 22, paddingTop: 12, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 11.5, color: C.t4, lineHeight: 1.6 }}>
              Created by {t.createdBy || 'unknown'}{t.createdAt ? ` · ${new Date(t.createdAt).toLocaleString()}` : ''}<br />
              Updated by {t.updatedBy || 'unknown'}{t.updatedAt ? ` · ${new Date(t.updatedAt).toLocaleString()}` : ''}
            </div>
            <Confirm C={C} onConfirm={() => { onClose(); W.removeTask(t.id) }}>Delete task</Confirm>
          </div>
        </div>
      </aside>
      {attach && <AttachModal C={C} f={f} task={t} onAttach={attachDoc} onClose={() => setAttach(false)} />}
    </>
  )
}
