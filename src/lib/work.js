// Work tab data layer: projects and tasks per family (monday.com style).
//
// SUPABASE MODE: one row per project/task in `work_items` (see supabase/migrations/20261027_work_items.sql).
//   Reads once, then follows Realtime so teammates' edits appear live. Writes are per row (insert / update /
//   delete); the family document is never rewritten. Local state is optimistic, text edits are debounced
//   (~500ms) and an incoming echo of our own write is ignored so the cursor never jumps.
// LOCAL MODE: everything lives in localStorage under `paradiem_planning_work_v1`, keyed by family id.
// Same hook API and row shapes either way.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, SUPABASE_ENABLED } from './supabase'
import { useAuth } from './auth'
import { useStore } from './store'
import { uid, nowIso } from './util'
import { WORKFLOW_BY_ID } from '../data/workflows'

const LS_KEY = 'paradiem_planning_work_v1'
export const TEXT_DEBOUNCE_MS = 500

/* ───────────────────────── Constants (edit these) ───────────────────────── */

export const STATUSES = [
  { id: 'todo', label: 'To do', color: '#8A90A0', fg: '#FFFFFF' },
  { id: 'working', label: 'Working on it', color: '#E8A83A', fg: '#171738' },
  { id: 'stuck', label: 'Stuck', color: '#DF4B4B', fg: '#FFFFFF' },
  { id: 'waiting', label: 'Waiting on client', color: '#4A86E8', fg: '#FFFFFF' },
  { id: 'done', label: 'Done', color: '#2DB37A', fg: '#FFFFFF' },
  { id: 'na', label: 'Not applicable', color: '#5559DF', fg: '#FFFFFF' },
]
// A task in either of these is finished as far as counts and overdue flags go.
export const isClosed = (status) => status === 'done' || status === 'na'
export const STATUS_BY_ID = Object.fromEntries(STATUSES.map((s) => [s.id, s]))
export const PRIORITIES = [
  { id: 'high', label: 'High', color: '#DF4B4B', fg: '#FFFFFF' },
  { id: 'medium', label: 'Medium', color: '#E8A83A', fg: '#171738' },
  { id: 'low', label: 'Low', color: '#6F8FB8', fg: '#FFFFFF' },
]
export const PRIORITY_BY_ID = Object.fromEntries(PRIORITIES.map((p) => [p.id, p]))
export const PROJECT_STATUSES = ['active', 'on hold', 'done']
export const PROJECT_COLORS = ['#C9A84C', '#4A86E8', '#2DB37A', '#A06CD5', '#E8794A', '#3FB6C9', '#D9558B', '#7C8CF0']

// Standard Paradiem engagement. `day` = days after the engagement start date. Edit freely.
export const ENGAGEMENT_TEMPLATE = [
  { name: 'Data gathering', color: '#4A86E8', tasks: [
    { title: 'Collect legal documents from client', day: 7, priority: 'high' },
    { title: 'Send the three alignment surveys', day: 3, priority: 'medium' },
    { title: 'Collect balance sheet', day: 14, priority: 'medium' },
    { title: 'Request eMoney export', day: 14, priority: 'medium' },
    { title: 'Schedule 90-minute initial retreat', day: 21, priority: 'high' },
  ] },
  { name: 'Gap Analysis build', color: '#C9A84C', tasks: [
    { title: 'Enter goals & intentions', day: 24, priority: 'medium' },
    { title: 'Read documents and record findings', day: 28, priority: 'high' },
    { title: 'Draft observations and challenges per goal', day: 35, priority: 'medium' },
    { title: 'Draft estate flow chart', day: 38, priority: 'medium' },
    { title: 'Select and prioritize planning tools', day: 42, priority: 'high' },
    { title: 'Review with second planner', day: 45, priority: 'medium' },
    { title: 'Generate Gap Analysis deck', day: 48, priority: 'high' },
  ] },
  { name: 'Presentation & decision', color: '#A06CD5', tasks: [
    { title: 'Deliver Gap Analysis', day: 56, priority: 'high' },
    { title: 'Agree on Blueprint scope', day: 63, priority: 'high' },
  ] },
  { name: 'Blueprint implementation', color: '#2DB37A', tasks: [
    { title: 'Estate documents drafted', day: 90, priority: 'high' },
    { title: 'Trust funding', day: 105, priority: 'medium' },
    { title: 'Beneficiary designations updated', day: 105, priority: 'medium' },
    { title: 'Tax planning memo', day: 100, priority: 'medium' },
    { title: 'Insurance review', day: 110, priority: 'medium' },
    { title: 'Annual calibration scheduled', day: 120, priority: 'low' },
  ] },
]

// Importing accepted tools from Priorities.
export const TOOLS_PROJECT_NAME = 'Planning tools (from Priorities)'
export const TIER_PRIORITY = { Protect: 'high', Deadline: 'high', Structural: 'medium', Optimize: 'low', Legacy: 'low' }
export const TIER_DAYS = { Protect: 14, Deadline: 30, Structural: 60, Optimize: 90, Legacy: 120 } // Deadline: nearest matching family deadline wins

/* ───────────────────────── Dates ───────────────────────── */

const pad = (n) => String(n).padStart(2, '0')
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayIso = () => ymd(new Date())
export const addDays = (iso, n) => { const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number); return ymd(new Date(y, m - 1, d + n)) }
export const isOverdue = (t, today = todayIso()) => Boolean(t.due) && !isClosed(t.status) && t.due < today
export const shortDate = (iso) => {
  if (!iso) return ''
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`)
  if (isNaN(d)) return String(iso)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString(undefined, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: '2-digit' })
}
export const relTime = (iso) => {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  if (isNaN(ms)) return ''
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d < 30 ? `${d}d ago` : shortDate(iso)
}
export const nameFromEmail = (e) => String(e || '').split('@')[0]
export const initialsOf = (s) => {
  const base = String(s || '').includes('@') ? nameFromEmail(s).replace(/[._-]+/g, ' ') : String(s || '')
  const parts = base.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/* ───────────────────────── Pure builders ───────────────────────── */

// Projects and tasks for the standard engagement, due dates relative to `startIso`.
export function buildTemplate(startIso) {
  const projects = []
  const tasks = []
  ENGAGEMENT_TEMPLATE.forEach((p, i) => {
    const key = `tpl-${i}`
    projects.push({ _key: key, name: p.name, color: p.color || PROJECT_COLORS[i % PROJECT_COLORS.length], due: addDays(startIso, Math.max(...p.tasks.map((t) => t.day))) })
    p.tasks.forEach((t) => tasks.push({ projectKey: key, title: t.title, due: addDays(startIso, t.day), priority: t.priority || 'medium', owner: '' }))
  })
  return { projects, tasks }
}

// Projects and tasks for one of the monday-based workflows in src/data/workflows.js. A step with no subtasks becomes
// a single task named after the step so it still shows up as a to-do.
export function buildWorkflow(workflowId, startIso) {
  const w = WORKFLOW_BY_ID[workflowId]
  const projects = []
  const tasks = []
  if (!w) return { projects, tasks }
  w.steps.forEach((step, i) => {
    const key = `wf-${w.id}-${i}`
    const specs = step.tasks.length ? step.tasks.map((t) => (Array.isArray(t) ? { title: t[0], ...t[1] } : { title: t })) : [{ title: step.name }]
    const days = specs.map((t) => t.day).filter((d) => d != null)
    const stepDay = step.day != null ? step.day : days.length ? Math.max(...days) : null
    projects.push({ _key: key, name: step.name, color: step.color || PROJECT_COLORS[i % PROJECT_COLORS.length], due: stepDay != null ? addDays(startIso, stepDay) : '', workflow: w.id })
    specs.forEach((t) => {
      const notes = [t.notes, t.ref ? `Template file in monday: ${t.ref}` : ''].filter(Boolean).join('\n')
      tasks.push({ projectKey: key, title: t.title, due: t.day != null ? addDays(startIso, t.day) : '', priority: t.priority || 'medium', owner: '', notes })
    })
  })
  return { projects, tasks }
}

const plainName = (s) => String(s || '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase()
// One task spec per accepted recommendation that has not been imported yet (matched on recId).
export function planToolImport(family, existingTasks, today = todayIso()) {
  const have = new Set((existingTasks || []).map((t) => t.recId).filter(Boolean))
  const deadlines = (family?.deadlines || []).filter((d) => d && d.date && d.title && !d.done).map((d) => ({ date: String(d.date).slice(0, 10), title: String(d.title).toLowerCase() }))
  return (family?.recommendations || []).filter((r) => r.status === 'accepted' && !have.has(r.id)).map((r) => {
    const names = [String(r.name || '').toLowerCase(), plainName(r.name)].filter(Boolean)
    let due = addDays(today, TIER_DAYS[r.tier] ?? 90)
    if (r.tier === 'Deadline') {
      const hits = deadlines.filter((d) => names.some((n) => d.title.includes(n))).map((d) => d.date).sort()
      due = hits.find((d) => d >= today) || hits[0] || addDays(today, TIER_DAYS.Deadline)
    }
    return { recId: r.id, title: r.name || 'Planning tool', notes: r.rationale || '', priority: TIER_PRIORITY[r.tier] || 'low', due, owner: '' }
  })
}

/* ───────────────────────── Normalisers ───────────────────────── */

export const normProject = (r) => ({ name: '', color: PROJECT_COLORS[0], owner: '', due: '', status: 'active', order: 0, collapsed: false, ...(r.data || {}), id: r.id, createdBy: r.created_by || '', createdAt: r.created_at || '', updatedBy: r.updated_by || '', updatedAt: r.updated_at || '' })
export const normTask = (r) => ({ projectId: '', title: '', status: 'todo', owner: '', due: '', priority: 'medium', notes: '', subtasks: [], files: [], comments: [], recId: '', order: 0, doneAt: '', ...(r.data || {}), id: r.id, createdBy: r.created_by || '', createdAt: r.created_at || '', updatedBy: r.updated_by || '', updatedAt: r.updated_at || '' })
const byOrder = (a, b) => (a.order || 0) - (b.order || 0) || String(a.createdAt).localeCompare(String(b.createdAt))
const TEXT_KEYS = ['title', 'name', 'notes']

/* ───────────────────────── Error helpers ───────────────────────── */

export function isMissingTable(e) {
  if (!e) return false
  const code = String(e.code || '')
  const msg = String(e.message || e.details || e || '')
  return code === '42P01' || code === 'PGRST205' || /could not find the table/i.test(msg) || (/work_items/i.test(msg) && /does not exist|schema cache/i.test(msg))
}

/* ───────────────────────── Local storage ───────────────────────── */

function readLocal(familyId) {
  try { const all = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); return Array.isArray(all?.[familyId]) ? all[familyId] : [] } catch { return [] }
}
function writeLocal(familyId, rows) {
  try {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}
    all[familyId] = Object.values(rows)
    localStorage.setItem(LS_KEY, JSON.stringify(all))
  } catch { /* storage full or blocked: the in-memory state still works for this session */ }
}
const toMap = (list) => Object.fromEntries((list || []).filter((r) => r && r.id).map((r) => [r.id, r]))
const freshSync = (familyId) => ({ familyId, alive: true, persisted: new Set(), timers: {}, chain: {}, pending: new Set(), inflight: {}, recent: {}, deleted: new Set() })

/* ───────────────────────── The hook ───────────────────────── */

export function useWork(familyId) {
  const { removeFile } = useStore()
  const { email } = useAuth()
  const me = String(email || '').toLowerCase()
  const meRef = useRef(me); meRef.current = me
  const [rows, setRows] = useState({})
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [missingTable, setMissingTable] = useState(false)
  const rowsRef = useRef({})
  const S = useRef(freshSync(null))
  const missingRef = useRef(false)

  const commit = useCallback((next) => {
    rowsRef.current = next
    setRows(next)
    if (!SUPABASE_ENABLED && S.current.familyId) writeLocal(S.current.familyId, next)
  }, [])
  const fail = useCallback((e) => {
    if (isMissingTable(e)) { missingRef.current = true; setMissingTable(true); setError(''); return }
    setError(e?.message || String(e || 'Work sync failed'))
  }, [])

  const isBusy = (s, id) => s.pending.has(id) || (s.inflight[id] || 0) > 0
  const run = useCallback((s, id, fn) => {
    s.inflight[id] = (s.inflight[id] || 0) + 1
    const p = (s.chain[id] || Promise.resolve()).then(fn).catch(fail).finally(() => { s.inflight[id] = Math.max(0, (s.inflight[id] || 1) - 1) })
    s.chain[id] = p
    return p
  }, [fail])
  const remember = (s, id, data) => { const l = (s.recent[id] = s.recent[id] || []); l.push(JSON.stringify(data)); if (l.length > 12) l.shift() }

  const flush = useCallback((id) => {
    const s = S.current
    clearTimeout(s.timers[id]); delete s.timers[id]
    if (!s.pending.has(id)) return
    s.pending.delete(id)
    const rec = rowsRef.current[id]
    if (!rec || !supabase) return
    const snap = { id, family_id: rec.family_id, kind: rec.kind, data: rec.data }
    remember(s, id, snap.data)
    run(s, id, async () => {
      if (s.deleted.has(id) || missingRef.current) return
      if (s.persisted.has(id)) {
        const { error: e } = await supabase.from('work_items').update({ data: snap.data }).eq('id', id)
        if (e) throw e
      } else {
        const { error: e } = await supabase.from('work_items').insert(snap)
        if (e) throw e
        s.persisted.add(id)
      }
    })
  }, [run])
  const schedule = useCallback((id, delay) => {
    if (!SUPABASE_ENABLED) return
    const s = S.current
    s.pending.add(id)
    clearTimeout(s.timers[id])
    s.timers[id] = setTimeout(() => flush(id), delay)
  }, [flush])
  const flushAll = useCallback(() => { [...S.current.pending].forEach(flush) }, [flush])

  const load = useCallback(async () => {
    const s = S.current
    if (!supabase || !s.familyId) return
    try {
      const { data, error: e } = await supabase.from('work_items').select('*').eq('family_id', s.familyId)
      if (e) throw e
      if (!s.alive) return
      const cur = rowsRef.current
      const next = {}
      const seen = new Set()
      for (const r of data || []) {
        seen.add(r.id); s.persisted.add(r.id)
        if (s.deleted.has(r.id)) continue
        next[r.id] = isBusy(s, r.id) && cur[r.id] ? cur[r.id] : r
      }
      for (const id of Object.keys(cur)) {
        if (seen.has(id)) continue
        if (isBusy(s, id) || Date.now() - new Date(cur[id].created_at).getTime() < 15000) { next[id] = cur[id]; continue } // just created here
        if (s.persisted.has(id)) { s.persisted.delete(id); continue } // deleted by a teammate
        next[id] = cur[id] // not saved yet
      }
      commit(next)
      setError('')
    } catch (e) { if (s.alive) fail(e) } finally { if (s.alive) setReady(true) }
  }, [commit, fail])

  const onRealtime = useCallback((payload) => {
    const s = S.current
    try {
      if (payload.eventType === 'DELETE') {
        const id = payload.old?.id
        if (!id || !rowsRef.current[id]) return
        s.persisted.delete(id)
        const next = { ...rowsRef.current }; delete next[id]; commit(next)
        return
      }
      const r = payload.new
      if (!r || !r.id || r.family_id !== s.familyId || s.deleted.has(r.id)) return
      s.persisted.add(r.id)
      const cur = rowsRef.current[r.id]
      if (cur) {
        if (isBusy(s, r.id)) return // we have unsent or in-flight edits: ours win, the echo would reset the cursor
        if ((s.recent[r.id] || []).includes(JSON.stringify(r.data))) { // echo of our own write: refresh stamps only
          commit({ ...rowsRef.current, [r.id]: { ...cur, updated_at: r.updated_at, updated_by: r.updated_by, created_by: r.created_by } })
          return
        }
      }
      commit({ ...rowsRef.current, [r.id]: r })
    } catch (e) { fail(e) }
  }, [commit, fail])

  useEffect(() => {
    const s = freshSync(familyId)
    S.current = s
    missingRef.current = false
    rowsRef.current = {}
    setRows({}); setError(''); setMissingTable(false); setReady(false)
    if (!familyId) { setReady(true); return undefined }
    if (!SUPABASE_ENABLED) {
      const loadLocal = () => { rowsRef.current = toMap(readLocal(familyId)); setRows(rowsRef.current) }
      loadLocal(); setReady(true)
      const onStorage = (e) => { if (e.key === LS_KEY) loadLocal() }
      window.addEventListener('storage', onStorage)
      return () => { s.alive = false; window.removeEventListener('storage', onStorage) }
    }
    let ch = null
    load()
    try {
      ch = supabase.channel(`work_items_${familyId}_${Math.random().toString(36).slice(2, 8)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'work_items', filter: `family_id=eq.${familyId}` }, onRealtime)
        .subscribe()
    } catch { ch = null }
    const onVis = () => { if (document.visibilityState === 'visible') load() }
    const onHide = () => flushAll()
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('pagehide', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pagehide', onHide)
      try { flushAll() } catch { /* best effort */ }
      s.alive = false
      try { if (ch) supabase.removeChannel(ch) } catch { /* ignore */ }
    }
  }, [familyId, load, onRealtime, flushAll])

  /* ── mutations ── */
  const stamp = (rec) => ({ ...rec, updated_at: nowIso(), updated_by: meRef.current })
  const insertRecords = useCallback((recs) => {
    const s = S.current
    if (!recs.length || !s.familyId || missingRef.current) return
    const next = { ...rowsRef.current }
    recs.forEach((r) => { next[r.id] = r })
    commit(next)
    if (!SUPABASE_ENABLED) return
    const batch = recs.map(({ id, family_id, kind, data }) => ({ id, family_id, kind, data }))
    batch.forEach((r) => remember(s, r.id, r.data))
    const p = (async () => {
      const { error: e } = await supabase.from('work_items').insert(batch)
      if (e) throw e
      batch.forEach((r) => s.persisted.add(r.id))
    })()
    const settled = p.catch(fail)
    batch.forEach((r) => {
      s.inflight[r.id] = (s.inflight[r.id] || 0) + 1
      s.chain[r.id] = settled.finally(() => { s.inflight[r.id] = Math.max(0, (s.inflight[r.id] || 1) - 1) })
    })
  }, [commit, fail])

  const makeRec = (kind, data) => {
    const t = nowIso()
    return { id: uid(), family_id: S.current.familyId, kind, data, created_at: t, created_by: meRef.current, updated_at: t, updated_by: meRef.current }
  }
  const nextOrder = (kind, filter) => 1 + Math.max(0, ...Object.values(rowsRef.current).filter((r) => r.kind === kind && filter(r)).map((r) => r.data?.order || 0))

  const addProject = useCallback((partial = {}) => {
    const used = Object.values(rowsRef.current).filter((r) => r.kind === 'project').length
    const rec = makeRec('project', { name: 'New project', color: PROJECT_COLORS[used % PROJECT_COLORS.length], owner: '', due: '', status: 'active', order: nextOrder('project', () => true), collapsed: false, ...partial })
    insertRecords([rec]); return rec.id
  }, [insertRecords])
  const addTask = useCallback((partial = {}) => {
    const projectId = partial.projectId
    const status = partial.status || 'todo'
    const rec = makeRec('task', { projectId, title: '', status, owner: '', due: '', priority: 'medium', notes: '', subtasks: [], files: [], comments: [], recId: '', order: nextOrder('task', (r) => r.data?.projectId === projectId), doneAt: status === 'done' ? nowIso() : '', ...partial })
    insertRecords([rec]); return rec.id
  }, [insertRecords])
  // Template / import: create several projects and tasks at once (one insert). Tasks reference a new project by
  // `projectKey` (matching a project spec's `_key`) or an existing one by `projectId`.
  const addMany = useCallback((projectSpecs = [], taskSpecs = []) => {
    const recs = []
    const keyToId = {}
    let po = nextOrder('project', () => true)
    projectSpecs.forEach((p, i) => {
      const { _key, ...data } = p
      const used = Object.values(rowsRef.current).filter((r) => r.kind === 'project').length + i
      const rec = makeRec('project', { name: 'New project', color: PROJECT_COLORS[used % PROJECT_COLORS.length], owner: '', due: '', status: 'active', order: po++, collapsed: false, ...data })
      keyToId[_key ?? `p${i}`] = rec.id; recs.push(rec)
    })
    const orders = {}
    taskSpecs.forEach((t) => {
      const { projectKey, ...data } = t
      const projectId = data.projectId || keyToId[projectKey]
      if (!projectId) return
      if (orders[projectId] == null) orders[projectId] = nextOrder('task', (r) => r.data?.projectId === projectId)
      recs.push(makeRec('task', { title: '', status: 'todo', owner: '', due: '', priority: 'medium', notes: '', subtasks: [], files: [], comments: [], recId: '', doneAt: '', ...data, projectId, order: orders[projectId]++ }))
    })
    insertRecords(recs)
    return keyToId
  }, [insertRecords])

  const patchRow = useCallback((id, kind, patch) => {
    if (missingRef.current) return
    const cur = rowsRef.current[id]
    if (!cur) return
    const view = kind === 'task' ? normTask(cur) : normProject(cur)
    const p = typeof patch === 'function' ? patch(view) : patch
    if (!p) return
    const data = { ...cur.data, ...p }
    commit({ ...rowsRef.current, [id]: stamp({ ...cur, data }) })
    schedule(id, TEXT_KEYS.some((k) => typeof p[k] === 'string') ? TEXT_DEBOUNCE_MS : 60)
  }, [commit, schedule])
  const updateProject = useCallback((id, patch) => patchRow(id, 'project', patch), [patchRow])
  const updateTask = useCallback((id, patch) => {
    patchRow(id, 'task', (t) => {
      const p = typeof patch === 'function' ? patch(t) : patch
      if (p && p.status && p.status !== t.status && p.doneAt === undefined) return { ...p, doneAt: p.status === 'done' ? nowIso() : '' }
      return p
    })
  }, [patchRow])

  const removeIds = useCallback((ids) => {
    const s = S.current
    if (!ids.length) return
    const next = { ...rowsRef.current }
    ids.forEach((id) => { delete next[id]; s.deleted.add(id); clearTimeout(s.timers[id]); delete s.timers[id]; s.pending.delete(id) })
    commit(next)
    if (!SUPABASE_ENABLED || missingRef.current) return
    const op = Promise.all(ids.map((id) => s.chain[id] || Promise.resolve())).then(async () => {
      const real = ids.filter((id) => s.persisted.has(id))
      if (!real.length) return
      const { error: e } = await supabase.from('work_items').delete().in('id', real)
      if (e) throw e
      real.forEach((id) => s.persisted.delete(id))
    }).catch(fail)
    ids.forEach((id) => { s.chain[id] = op })
  }, [commit, fail])
  const dropUploads = useCallback((task) => {
    ;(task.files || []).filter((f) => f.source === 'upload' && f.key).forEach((f) => { Promise.resolve().then(() => removeFile(f.key)).catch(() => {}) })
  }, [removeFile])
  const removeTask = useCallback((id) => {
    const r = rowsRef.current[id]
    if (!r) return
    dropUploads(normTask(r))
    removeIds([id])
  }, [removeIds, dropUploads])
  const removeProject = useCallback((id) => {
    const kids = Object.values(rowsRef.current).filter((r) => r.kind === 'task' && r.data?.projectId === id)
    kids.forEach((r) => dropUploads(normTask(r)))
    removeIds([...kids.map((r) => r.id), id])
  }, [removeIds, dropUploads])

  // Move a task (within its project) or a project one place up (-1) or down (+1). Orders are renumbered 1..n so ties heal.
  const moveItem = useCallback((id, dir) => {
    const cur = rowsRef.current[id]
    if (!cur) return
    const kind = cur.kind
    const sibs = Object.values(rowsRef.current)
      .filter((r) => r.kind === kind && (kind === 'project' || r.data?.projectId === cur.data?.projectId))
      .map((r) => (kind === 'task' ? normTask(r) : normProject(r))).sort(byOrder)
    const i = sibs.findIndex((x) => x.id === id), j = i + dir
    if (i < 0 || j < 0 || j >= sibs.length) return
    const arr = [...sibs]; [arr[i], arr[j]] = [arr[j], arr[i]]
    arr.forEach((x, idx) => { if ((x.order || 0) !== idx + 1) patchRow(x.id, kind, { order: idx + 1 }) })
  }, [patchRow])
  const removeTasks = useCallback((ids) => {
    const real = ids.filter((id) => rowsRef.current[id]?.kind === 'task')
    real.forEach((id) => dropUploads(normTask(rowsRef.current[id])))
    removeIds(real)
  }, [removeIds, dropUploads])
  const updateTasks = useCallback((ids, patch) => { ids.forEach((id) => updateTask(id, patch)) }, [updateTask])

  const addComment = useCallback((taskId, text) => {
    const t = String(text || '').trim()
    if (!t) return
    patchRow(taskId, 'task', (cur) => ({ comments: [...cur.comments, { id: uid(), by: meRef.current || 'unknown', at: nowIso(), text: t }] }))
  }, [patchRow])

  const projects = useMemo(() => Object.values(rows).filter((r) => r.kind === 'project').map(normProject).sort(byOrder), [rows])
  const tasks = useMemo(() => Object.values(rows).filter((r) => r.kind === 'task').map(normTask).sort(byOrder), [rows])

  return { projects, tasks, ready, error, missingTable, me, reload: load, clearError: () => setError(''), addProject, updateProject, removeProject, addTask, updateTask, removeTask, addComment, addMany, moveItem, removeTasks, updateTasks }
}
