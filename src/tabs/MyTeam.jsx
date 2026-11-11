// My Team: who may use Paradiem Planning. Only people listed here can sign in and see anything; only an Admin can add or remove
// people. Enforced by the database (supabase/migrations/20261111_team_access.sql), not just hidden in this screen.
import { useEffect, useState } from 'react'
import { Card, Eyebrow, Title, Btn, Input, Select, Field, Note, Grid, Confirm, Empty, Pill } from '../components/ui'
import { SUPABASE_ENABLED } from '../lib/supabase'
import { useRole } from '../lib/roles'
import { ROLE_LABELS } from '../lib/permissions'
import { useTeam, ROLE_OPTIONS, ROLE_SHORT, memberName } from '../lib/team'
import { fmtDate } from '../lib/util'

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const initials = (s) => String(s || '?').split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'
const Avatar = ({ C, label, size = 34 }) => <span style={{ width: size, height: size, borderRadius: size / 2, background: C.accentSoft, border: `1px solid ${C.borderActive}`, color: C.t1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 800, flex: 'none' }}>{initials(label)}</span>

// Editable name that saves when you click away (so each keystroke is not a database write).
function NameCell({ C, value, onSave }) {
  const [v, setV] = useState(value)
  useEffect(() => setV(value), [value])
  return <Input C={C} value={v} placeholder="Name" onChange={setV} onBlur={() => { const t = v.trim(); if (t !== value) onSave(t) }} style={{ padding: '5px 8px', fontSize: 13.5, fontWeight: 700 }} />
}

export default function MyTeam({ C, isDesktop, setTab }) {
  const { role } = useRole()
  const team = useTeam()
  const { members, ready, missing, error, me } = team
  const admin = role === 'admin'
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [draft, setDraft] = useState({ name: '', email: '', title: '', role: 'planning' })
  const [pending, setPending] = useState(null) // null = not loaded
  const [pendingRole, setPendingRole] = useState({})
  const [hidden, setHidden] = useState(() => { try { return JSON.parse(localStorage.getItem('planning_team_hidden') || '[]') } catch { return [] } })
  const adminCount = members.filter((m) => m.role === 'admin').length

  const loadPending = async () => { try { setPending((await team.pending()).filter((p) => !hidden.includes(p.email))) } catch (e) { setPending([]); if (!/Only an Admin/.test(e.message)) setErr(e.message) } }
  useEffect(() => { if (SUPABASE_ENABLED && admin && !missing && ready) loadPending() }, [admin, missing, ready, members.length]) // eslint-disable-line react-hooks/exhaustive-deps
  const run = async (fn, ok) => { setErr(''); setInfo(''); try { await fn(); if (ok) setInfo(ok) } catch (e) { setErr(e.message) } }
  const viewWork = (m) => { try { localStorage.setItem('planning_work_scope', 'person'); localStorage.setItem('planning_work_person', m.email); window.dispatchEvent(new CustomEvent('planning:work-person', { detail: m.email })) } catch { /* ignore */ } setTab('work') }
  const hide = (em) => { const next = [...hidden, em]; setHidden(next); try { localStorage.setItem('planning_team_hidden', JSON.stringify(next)) } catch { /* ignore */ } setPending((p) => (p || []).filter((x) => x.email !== em)) }

  if (!SUPABASE_ENABLED) {
    return (
      <div>
        <Title C={C} isDesktop={isDesktop} sub="Who can use Paradiem Planning.">My Team</Title>
        <Card C={C}><Empty C={C} icon="⚿" title="Team access needs Supabase">In local mode there is one user on this browser, who is the Admin. When the app is connected to Supabase, sign-in is limited to the people you add here.</Empty></Card>
      </div>
    )
  }

  return (
    <div>
      <Title C={C} isDesktop={isDesktop} sub="Only the people listed here can sign in and see Paradiem Planning. Admins add and remove people.">My Team</Title>
      {missing && <Note C={C} tone="warn" style={{ marginBottom: 12 }}>Run <b>supabase/migrations/20261111_team_access.sql</b> in the Supabase SQL Editor to turn on team access. Until then everyone who signs in can use the app.</Note>}
      {error && <Note C={C} tone="danger" style={{ marginBottom: 12 }}>{error}</Note>}
      {err && <Note C={C} tone="danger" style={{ marginBottom: 12 }}>{err}</Note>}
      {info && <Note C={C} tone="success" style={{ marginBottom: 12 }}>{info}</Note>}
      {!admin && !missing && <Note C={C} tone="info" style={{ marginBottom: 12 }}>You are <b>{ROLE_LABELS[role]}</b>. You can see the team, but only an Admin can add or remove people.</Note>}

      <Grid cols={isDesktop ? 2 : 1} gap={14} style={{ gridTemplateColumns: isDesktop ? 'minmax(0,1.5fr) minmax(0,1fr)' : undefined, alignItems: 'start' }}>
        <Card C={C}>
          <Eyebrow C={C}>Team ({members.length})</Eyebrow>
          {!members.length && <div style={{ fontSize: 12.5, color: C.t4, padding: '6px 0' }}>{ready ? 'Nobody has been added yet.' : 'Loading…'}</div>}
          {members.map((m) => {
            const isMe = m.email === me, lastAdmin = m.role === 'admin' && adminCount <= 1
            return (
              <div key={m.email} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
                <Avatar C={C} label={memberName(m)} />
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  {admin ? <NameCell C={C} value={m.name || ''} onSave={(v) => run(() => team.update(m.email, { name: v || null }))} />
                    : <div style={{ fontSize: 13.5, fontWeight: 700, color: C.t1 }}>{memberName(m)}</div>}
                  <div style={{ fontSize: 12, color: C.t3, overflowWrap: 'anywhere', marginTop: 2 }}>{m.email}{m.title ? ` · ${m.title}` : ''}{isMe ? ' · you' : ''}</div>
                </div>
                {admin ? <Select C={C} value={m.role} onChange={(v) => run(() => team.update(m.email, { role: v }))} options={ROLE_SHORT} style={{ padding: '6px 8px', fontSize: 12 }} /> : <Pill C={C} color={m.role === 'admin' ? C.accent : C.t3}>{ROLE_LABELS[m.role] || m.role}</Pill>}
                <Btn C={C} small ghost onClick={() => viewWork(m)}>View work</Btn>
                {admin && (lastAdmin ? <span title="There must always be at least one Admin" style={{ fontSize: 11, color: C.t4 }}>last Admin</span> : <Confirm C={C} onConfirm={() => run(() => team.remove(m.email), `${memberName(m)} no longer has access.`)}>Remove</Confirm>)}
              </div>
            )
          })}
          <div style={{ fontSize: 11.5, color: C.t4, marginTop: 10 }}>Removing someone takes effect right away: they are signed out of the data and cannot open families, files or Claude. Their past work and comments stay.</div>
        </Card>

        <div>
          {admin && !missing && (
            <Card C={C} style={{ marginBottom: 14 }}>
              <Eyebrow C={C}>Add someone</Eyebrow>
              <Field C={C} label="Name"><Input C={C} value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="Dani Wauchope" /></Field>
              <Field C={C} label="Email" style={{ marginTop: 10 }}><Input C={C} value={draft.email} onChange={(v) => setDraft({ ...draft, email: v })} placeholder="name@paradiem.org" /></Field>
              <Field C={C} label="Title (optional)" style={{ marginTop: 10 }}><Input C={C} value={draft.title} onChange={(v) => setDraft({ ...draft, title: v })} placeholder="Chief Planning Strategist" /></Field>
              <Field C={C} label="Access" style={{ marginTop: 10 }}><Select C={C} value={draft.role} onChange={(v) => setDraft({ ...draft, role: v })} options={ROLE_OPTIONS} style={{ width: '100%' }} /></Field>
              <Btn C={C} primary style={{ marginTop: 12 }} disabled={!EMAIL.test(draft.email.trim())} onClick={() => run(async () => { await team.add(draft); setDraft({ name: '', email: '', title: '', role: 'planning' }) }, `${draft.email.trim().toLowerCase()} can now sign in.`)}>Add to team</Btn>
              <div style={{ fontSize: 11.5, color: C.t4, marginTop: 8, lineHeight: 1.5 }}>They create their own login on the sign-in screen (the shared passcode plus their email and a password). Adding their email here is what lets them in. Use the same name as on the team roster so tasks already assigned to that name show up under them in Work.</div>
            </Card>
          )}
          {admin && !missing && (
            <Card C={C} style={{ marginBottom: 14 }}>
              <Eyebrow C={C}>Pending sign-ups</Eyebrow>
              <div style={{ fontSize: 12, color: C.t3, marginBottom: 8 }}>Accounts that were created but are not on the team. They can sign in but see nothing until you add them.</div>
              {pending === null && <div style={{ fontSize: 12.5, color: C.t4 }}>Loading…</div>}
              {pending && !pending.length && <div style={{ fontSize: 12.5, color: C.t4 }}>No one is waiting.</div>}
              {(pending || []).map((p) => (
                <div key={p.email} style={{ padding: '9px 0', borderTop: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 13, color: C.t1, overflowWrap: 'anywhere' }}>{p.email}</div>
                  <div style={{ fontSize: 11.5, color: C.t4, marginBottom: 6 }}>signed up {fmtDate(p.created_at)}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Select C={C} value={pendingRole[p.email] || 'planning'} onChange={(v) => setPendingRole({ ...pendingRole, [p.email]: v })} options={ROLE_OPTIONS} style={{ padding: '5px 8px', fontSize: 12 }} />
                    <Btn C={C} small primary onClick={() => run(async () => { await team.add({ email: p.email, name: '', title: '', role: pendingRole[p.email] || 'planning' }); await loadPending() }, `${p.email} was added.`)}>Add</Btn>
                    <Btn C={C} small ghost onClick={() => hide(p.email)}>Ignore</Btn>
                  </div>
                </div>
              ))}
            </Card>
          )}
          <Card C={C}>
            <Eyebrow C={C}>What each access level can do</Eyebrow>
            {[['Admin', 'Everything the Planning Team can do, plus adding and removing people and changing access.'], ['Planning Team', 'Can view and edit every family, task, document, deck and plan.'], ['Relationship Manager', 'Can view and export everything but cannot change anything.'], ['Not on the list', 'Cannot see or change anything, even with the passcode and a login.']].map(([t, d]) => (
              <div key={t} style={{ padding: '7px 0', borderTop: `1px solid ${C.border}` }}><div style={{ fontSize: 12.5, fontWeight: 700, color: C.t1 }}>{t}</div><div style={{ fontSize: 12, color: C.t3, lineHeight: 1.45 }}>{d}</div></div>
            ))}
          </Card>
        </div>
      </Grid>
    </div>
  )
}
