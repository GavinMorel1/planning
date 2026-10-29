// Settings > Access: who is an Admin, Planning Team (edit) or Relationship Manager (read and export). Enforced by the
// database (app_roles + row-level security); see supabase/migrations/20261029_roles.sql.
import { useCallback, useEffect, useState } from 'react'
import { Card, Eyebrow, Btn, Input, Select, Field, Note, Grid, Confirm, Empty } from './ui'
import { supabase, SUPABASE_ENABLED } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { useRole } from '../lib/roles'
import { ROLE_LABELS } from '../lib/permissions'

const OPTIONS = [{ value: 'planning', label: 'Planning Team: can edit' }, { value: 'rm', label: 'Relationship Manager: read and export' }, { value: 'admin', label: 'Admin: edit and manage access' }]

export default function AccessManager({ C, isDesktop }) {
  const { email } = useAuth()
  const { role, reload } = useRole()
  const [rows, setRows] = useState([])
  const [err, setErr] = useState('')
  const [missing, setMissing] = useState(false)
  const [draft, setDraft] = useState({ email: '', role: 'rm' })
  const load = useCallback(async () => {
    if (!SUPABASE_ENABLED) return
    const { data, error } = await supabase.from('app_roles').select('email,role,created_at,created_by').order('email')
    if (error) { if (/app_roles/i.test(error.message) || error.code === '42P01' || error.code === 'PGRST205') setMissing(true); else setErr(error.message); return }
    setRows(data || []); setMissing(false); setErr('')
  }, [])
  useEffect(() => { load() }, [load])
  const noAdmin = !rows.some((r) => r.role === 'admin')
  const canAdmin = role === 'admin' || noAdmin
  const save = async (em, r) => {
    setErr('')
    const { error } = await supabase.from('app_roles').upsert({ email: em.trim().toLowerCase(), role: r, created_by: String(email || '').toLowerCase() })
    if (error) setErr(error.message); else { await load(); reload() }
  }
  const remove = async (em) => { setErr(''); const { error } = await supabase.from('app_roles').delete().eq('email', em); if (error) setErr(error.message); else { await load(); reload() } }

  if (!SUPABASE_ENABLED) return <Card C={C}><Empty C={C} icon="⚿" title="Local mode">Roles apply when the app is connected to Supabase. In local mode everyone on this browser is Planning Team.</Empty></Card>
  if (missing) return <Card C={C}><Note C={C} tone="warn">Run supabase/migrations/20261029_roles.sql in the Supabase SQL Editor to turn on roles. Until then everyone signed in can edit.</Note></Card>
  return (
    <Grid cols={isDesktop ? 2 : 1} gap={14}>
      <Card C={C}>
        <Eyebrow C={C}>Who has access</Eyebrow>
        <div style={{ fontSize: 12, color: C.t3, marginBottom: 10 }}>You are <b style={{ color: C.t1 }}>{ROLE_LABELS[role]}</b>. Anyone signed in who is not listed here is treated as Planning Team. Relationship Managers can view and export everything but cannot change anything: the database refuses their saves.</div>
        {err && <Note C={C} tone="danger" style={{ marginBottom: 10 }}>{err}</Note>}
        {!rows.length && <div style={{ fontSize: 12.5, color: C.t4, padding: '6px 0' }}>No roles assigned yet.</div>}
        {rows.map((r) => (
          <div key={r.email} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
            <span style={{ flex: '1 1 180px', minWidth: 0, fontSize: 13, color: C.t1, overflowWrap: 'anywhere' }}>{r.email}</span>
            <Select C={C} value={r.role} disabled={!canAdmin} onChange={(v) => save(r.email, v)} options={OPTIONS} style={{ padding: '6px 8px', fontSize: 12 }} />
            {canAdmin && <Confirm C={C} onConfirm={() => remove(r.email)}>Remove</Confirm>}
          </div>
        ))}
      </Card>
      <Card C={C}>
        <Eyebrow C={C}>Add or change a role</Eyebrow>
        {!canAdmin && <Note C={C} tone="warn" style={{ marginBottom: 10 }}>Only an Admin can change roles.</Note>}
        {noAdmin && <Note C={C} tone="info" style={{ marginBottom: 10 }}>There is no Admin yet. Give yourself the Admin role first; after that only Admins can manage access.</Note>}
        <Field C={C} label="Email"><Input C={C} value={draft.email} onChange={(v) => setDraft({ ...draft, email: v })} placeholder="name@paradiem.org" /></Field>
        <Field C={C} label="Role" style={{ marginTop: 10 }}><Select C={C} value={draft.role} onChange={(v) => setDraft({ ...draft, role: v })} options={OPTIONS} style={{ width: '100%' }} /></Field>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Btn C={C} primary disabled={!canAdmin || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.email.trim())} onClick={async () => { await save(draft.email, draft.role); setDraft({ email: '', role: 'rm' }) }}>Save role</Btn>
          {email && <Btn C={C} ghost disabled={!canAdmin} onClick={() => save(email, 'admin')}>Make me Admin</Btn>}
        </div>
      </Card>
    </Grid>
  )
}
