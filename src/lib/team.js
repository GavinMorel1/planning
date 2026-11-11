// My Team: the people allowed to use the app (table app_roles; see supabase/migrations/20261111_team_access.sql). One shared
// copy is kept here so the My Team tab, the Work tab and task owners all show the same names.
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { supabase, SUPABASE_ENABLED } from './supabase'
import { useAuth } from './auth'

export const ROLE_OPTIONS = [
  { value: 'planning', label: 'Planning Team: can edit' },
  { value: 'rm', label: 'Relationship Manager: read and export' },
  { value: 'admin', label: 'Admin: edit and manage the team' },
]

export const ROLE_SHORT = [{ value: 'planning', label: 'Planning Team' }, { value: 'rm', label: 'Relationship Manager' }, { value: 'admin', label: 'Admin' }]

let state = { members: [], ready: false, missing: false, error: '' }
const listeners = new Set()
const set = (p) => { state = { ...state, ...p }; listeners.forEach((l) => l()) }
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }
let inflight = null

const missingTable = (e) => /app_roles/i.test(String(e?.message || '')) && /does not exist|schema cache|could not find/i.test(String(e?.message || '')) || e?.code === '42P01' || e?.code === 'PGRST205'

export async function loadTeam(force = false) {
  if (!SUPABASE_ENABLED) { set({ ready: true }); return }
  if (inflight && !force) return inflight
  inflight = (async () => {
    // 'name' and 'title' arrive with the team-access migration; fall back to the older columns if it has not been run.
    let res = await supabase.from('app_roles').select('email,role,name,title,created_at,created_by').order('email')
    if (res.error && /name|title/i.test(res.error.message || '')) res = await supabase.from('app_roles').select('email,role,created_at,created_by').order('email')
    if (res.error) { set({ ready: true, missing: missingTable(res.error), error: missingTable(res.error) ? '' : res.error.message }); return }
    set({ members: (res.data || []).map((m) => ({ name: '', title: '', ...m, email: String(m.email).toLowerCase() })), ready: true, missing: false, error: '' })
  })().finally(() => { inflight = null })
  return inflight
}

export const nameFromEmail = (e) => { const s = String(e || '').split('@')[0].replace(/[._-]+/g, ' ').trim(); return s.replace(/\b\w/g, (c) => c.toUpperCase()) }
export const memberName = (m) => (m?.name || '').trim() || nameFromEmail(m?.email)

/** Which team member does a task's owner string refer to? Owners are stored as an email or as a name (the roster/Work picker). */
export function memberForOwner(owner, members) {
  const o = String(owner || '').trim().toLowerCase()
  if (!o) return null
  return members.find((m) => m.email === o) || members.find((m) => m.name && m.name.trim().toLowerCase() === o) || null
}
/** Friendly label for an owner value, using the team list when it knows the person. */
export function ownerDisplay(owner, members = state.members) {
  if (!owner) return 'Unassigned'
  const m = memberForOwner(owner, members)
  if (m) return memberName(m)
  return String(owner).includes('@') ? nameFromEmail(owner) : String(owner)
}

export function useTeam() {
  const s = useSyncExternalStore(subscribe, () => state)
  const { email } = useAuth()
  useEffect(() => { loadTeam() }, [])
  const me = String(email || '').toLowerCase()
  const members = SUPABASE_ENABLED ? s.members : (me ? [{ email: me, name: 'You', title: '', role: 'admin' }] : [])
  const reload = useCallback(() => loadTeam(true), [])
  const guard = (r) => { if (r.error) throw new Error(r.error.message); return reload() }
  const add = useCallback(async ({ email: em, name, title, role }) => guard(await supabase.from('app_roles').upsert({ email: em.trim().toLowerCase(), role, name: (name || '').trim() || null, title: (title || '').trim() || null, created_by: me })), [me]) // eslint-disable-line react-hooks/exhaustive-deps
  const update = useCallback(async (em, patch) => guard(await supabase.from('app_roles').update(patch).eq('email', em)), []) // eslint-disable-line react-hooks/exhaustive-deps
  const remove = useCallback(async (em) => guard(await supabase.from('app_roles').delete().eq('email', em)), []) // eslint-disable-line react-hooks/exhaustive-deps
  const pending = useCallback(async () => { const { data, error } = await supabase.rpc('pending_signups'); if (error) throw new Error(error.message); return data || [] }, [])
  return { members, ready: s.ready, missing: s.missing, error: s.error, reload, add, update, remove, pending, me }
}
