import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../lib/store'
import { Card, Eyebrow, Title, Pill, Empty, Grid, Btn, Field, Input, Select, Note } from '../components/ui'
import JourneyTrail from '../components/JourneyTrail'
import { DOC_CATEGORIES } from '../data/docCategories'
import { familyFlags } from '../lib/flags'
import { daysUntil, fmtDate, fmtUsd, ageFrom, num, today } from '../lib/util'
import { netWorthOf } from './Families'
import { useAuth } from '../lib/auth'
import { useWorkTimeline, isOverdue, isClosed, shortDate } from '../lib/work'
import { computeJourney, DEFAULT_JOURNEY, STALL_DAYS } from '../lib/journey'
import { gapFee, blueprintMonthly, DEFAULT_FEE_SCHEDULE } from '../lib/fees'
import { calcNumbers, includedSections, DEFAULT_RATES } from '../lib/numbersCalc'

const TRACK_LABEL = { gap: 'Gap Analysis', gapblueprint: 'Gap Analysis + Blueprint', unknown: 'Track not set' }
const CONTRACT = [['not_sent', 'Not sent'], ['sent', 'Sent'], ['signed', 'Signed']]
const PAYMENT = [['pending', 'Pending'], ['invoiced', 'Invoiced'], ['paid', 'Paid']]
const lbl = (list, v) => (list.find((x) => x[0] === v) || list[0])[1]

export default function Desk({ C, isDesktop, setTab }) {
  const { families, family, setActive, settings, updateFamily } = useStore()
  const W = useWorkTimeline()
  const [view, setViewState] = useState(() => { try { return localStorage.getItem('planning_desk_view') || 'family' } catch { return 'family' } })
  const setView = (v) => { setViewState(v); try { localStorage.setItem('planning_desk_view', v) } catch { /* ignore */ } }
  const stagesDef = settings.journey?.length ? settings.journey : DEFAULT_JOURNEY
  const lite = useMemo(() => {
    const m = {}
    W.items.forEach((t) => { (m[t.familyId] = m[t.familyId] || []).push({ id: t.id, title: t.title, projectName: t.project?.name || '', workflow: t.project?.workflow || '', status: t.status, owner: t.owner, due: t.due, doneAt: t.doneAt, updatedAt: t.updatedAt, createdAt: t.createdAt, order: t.order }) })
    return m
  }, [W.items])
  const journeyOf = (f) => computeJourney({ stages: stagesDef, tasks: lite[f.id] || [], manual: f.journey?.manual, createdAt: f.createdAt, trackOverride: f.journey?.track })
  const journeys = useMemo(() => Object.fromEntries(families.map((f) => [f.id, journeyOf(f)])), [families, lite, stagesDef]) // eslint-disable-line react-hooks/exhaustive-deps
  const showFamily = view === 'family' && family
  return (
    <div>
      <Title C={C} isDesktop={isDesktop} sub={showFamily ? 'Where this family is in the journey, who owns the next step, and what is needed.' : `${families.length} famil${families.length === 1 ? 'y' : 'ies'} across the ${stagesDef.length} stages.`}
        right={<ViewToggle C={C} view={showFamily ? 'family' : 'pipeline'} setView={setView} hasFamily={Boolean(family)} />}>{showFamily ? `Desk · ${family.name}` : 'Desk · Firm pipeline'}</Title>
      {showFamily ? <FamilyDashboard C={C} isDesktop={isDesktop} setTab={setTab} f={family} journey={journeys[family.id]} tasks={lite[family.id] || []} settings={settings} updateFamily={updateFamily} workReady={W.ready} workMissing={W.missingTable} />
        : <Pipeline C={C} isDesktop={isDesktop} families={families} journeys={journeys} stagesDef={stagesDef} onOpen={(f) => { setActive(f.id); setView('family') }} />}
      <Alerts C={C} setTab={setTab} families={families} settings={settings} setActive={setActive} />
    </div>
  )
}

function ViewToggle({ C, view, setView, hasFamily }) {
  const opt = (id, label, off) => <button key={id} disabled={off} onClick={() => setView(id)} style={{ padding: '8px 14px', border: 'none', background: view === id ? C.accentSoft : 'transparent', color: off ? C.t4 : view === id ? C.t1 : C.t3, fontWeight: 700, fontSize: 12.5, cursor: off ? 'default' : 'pointer', fontFamily: 'inherit', boxShadow: view === id ? `inset 0 -2px 0 ${C.accent}` : 'none' }}>{label}</button>
  return <div style={{ display: 'inline-flex', border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>{opt('family', 'Family dashboard', !hasFamily)}{opt('pipeline', 'Firm pipeline')}</div>
}

/* ───────────────────────── family dashboard ───────────────────────── */

function FamilyDashboard({ C, isDesktop, setTab, f, journey, tasks, settings, updateFamily, workReady, workMissing }) {
  const patch = (p) => updateFamily(f.id, p)
  const seenKey = `planning_journey_seen_${f.id}`
  const [burst, setBurst] = useState(0)
  // A burst of confetti when the family moved forward since this browser last looked (first look just records the stage).
  useEffect(() => {
    if (!workReady) return
    let seen = null
    try { const v = localStorage.getItem(seenKey); seen = v == null ? null : Number(v) } catch { /* ignore */ }
    if (seen != null && journey.currentIndex > seen) setBurst((n) => n + 1)
    try { localStorage.setItem(seenKey, String(journey.currentIndex)) } catch { /* ignore */ }
  }, [journey.currentIndex, workReady, seenKey])

  const cur = journey.stages[Math.min(journey.currentIndex, journey.stages.length - 1)]
  const manualOn = Boolean(f.journey?.manual?.[cur.def.id])
  const markStage = () => patch({ journey: { ...(f.journey || {}), manual: { ...(f.journey?.manual || {}), [cur.def.id]: today() } } })
  const undoStage = (id) => { const m = { ...(f.journey?.manual || {}) }; delete m[id]; patch({ journey: { ...(f.journey || {}), manual: m } }) }
  const lastManual = [...journey.stages].reverse().find((s) => s.source === 'manual')

  return (
    <div>
      {workMissing && <Note C={C} tone="warn" style={{ marginBottom: 12 }}>Progress from the Work tab appears once the Work database update is applied. Until then use "Mark stage complete".</Note>}
      <Card C={C} accent style={{ marginBottom: 14, position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
          <Eyebrow C={C} style={{ marginBottom: 0 }}>Where you are in the Journey</Eyebrow>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Select C={C} value={f.journey?.track || 'auto'} onChange={(v) => patch({ journey: { ...(f.journey || {}), track: v } })} options={[{ value: 'auto', label: `Track: ${TRACK_LABEL[journey.track]} (auto)` }, { value: 'gap', label: 'Track: Gap Analysis' }, { value: 'gapblueprint', label: 'Track: Gap Analysis + Blueprint' }]} style={{ padding: '6px 8px', fontSize: 12 }} />
            <Pill C={C} color={C.accent}>{TRACK_LABEL[journey.track]}</Pill>
          </div>
        </div>
        <JourneyTrail C={C} journey={journey} isDesktop={isDesktop} familyName={f.name} burstKey={burst} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 8, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
          <div><div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: 'uppercase', letterSpacing: 1 }}>Current stage</div><div style={{ fontSize: 15, fontWeight: 800, color: C.accent }}>{journey.complete ? 'Journey complete' : `${String(journey.currentIndex + 1).padStart(2, '0')} · ${cur.def.name}`}</div></div>
          {!journey.complete && <div><div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: 'uppercase', letterSpacing: 1 }}>Days in stage</div><div style={{ fontSize: 15, fontWeight: 800, color: C.t1 }}>{journey.daysInStage}</div></div>}
          {!journey.complete && cur.taskTotal > 0 && <div><div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: 'uppercase', letterSpacing: 1 }}>Stage tasks</div><div style={{ fontSize: 15, fontWeight: 800, color: C.t1 }}>{cur.taskDone}/{cur.taskTotal}</div></div>}
          <div><div style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: 'uppercase', letterSpacing: 1 }}>Journey</div><div style={{ fontSize: 15, fontWeight: 800, color: C.t1 }}>{journey.pct}%</div></div>
          {journey.stalled && <span title={`No task completed since ${fmtDate(journey.lastProgress)}`} style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: C.dn, padding: '4px 10px', borderRadius: 20 }}>STALLED · {journey.daysSinceProgress} days without progress</span>}
          <span style={{ flex: 1 }} />
          {!journey.complete && <Btn C={C} small onClick={markStage} title="Marks this stage complete by hand (for stages that have no Work tasks)">Mark stage complete</Btn>}
          {lastManual && <Btn C={C} small ghost onClick={() => undoStage(lastManual.def.id)}>Undo “{lastManual.def.name}”</Btn>}
          <Btn C={C} small ghost onClick={() => setTab('work')}>Open Work</Btn>
        </div>
      </Card>
      <Grid cols={isDesktop ? 2 : 1} gap={14}>
        <FamilyCard C={C} f={f} />
        <TeamCard C={C} f={f} roster={settings.roster || []} patch={patch} nextOwner={journey.nextTasks[0]?.owner || ''} />
        <NextUp C={C} f={f} journey={journey} tasks={tasks} setTab={setTab} />
        <MoneyCard C={C} f={f} settings={settings} patch={patch} />
        <Readiness C={C} f={f} settings={settings} setTab={setTab} />
        <Relationship C={C} f={f} patch={patch} />
      </Grid>
      <MyTasks C={C} setTab={setTab} tasks={tasks} />
    </div>
  )
}

const Row = ({ C, k, v, color, onClick }) => (
  <div onClick={onClick} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderTop: `1px solid ${C.border}`, fontSize: 12.5, cursor: onClick ? 'pointer' : 'default' }}>
    <span style={{ color: C.t3 }}>{k}</span><span style={{ color: color || C.t1, fontWeight: 700, textAlign: 'right' }}>{v || '—'}</span>
  </div>
)

function FamilyCard({ C, f }) {
  const p = f.profile || {}
  const ppl = [p.spouse1, p.spouse2].filter((x) => x && x.name).map((x) => `${x.name}${ageFrom(x.dob) != null ? `, ${ageFrom(x.dob)}` : ''}`)
  return (
    <Card C={C}>
      <Eyebrow C={C}>Family</Eyebrow>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.t1, marginBottom: 4 }}>{f.name}</div>
      <Row C={C} k="Spouses" v={ppl.join(' · ')} />
      <Row C={C} k="State" v={p.state} />
      <Row C={C} k="Tier" v={f.tier === 'under5' ? 'Under $5M' : '$5M+'} />
      <Row C={C} k="Net worth" v={netWorthOf(f) ? fmtUsd(netWorthOf(f), { compact: true }) : ''} />
      <Row C={C} k="Household income" v={p.householdIncome ? fmtUsd(num(p.householdIncome), { compact: true }) : ''} />
      <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: C.t4, textTransform: 'uppercase', letterSpacing: 1 }}>100-Year Vision</div>
      <div style={{ fontSize: 13, color: p.vision ? C.t2 : C.t4, lineHeight: 1.5, fontStyle: p.vision ? 'italic' : 'normal' }}>{p.vision || 'Not entered yet (Families › Profile).'}</div>
    </Card>
  )
}

function TeamCard({ C, f, roster, patch, nextOwner }) {
  const [edit, setEdit] = useState(false)
  const t = f.team || { rm: '', associateRm: '', planners: [] }
  const names = roster.filter((r) => r.name).map((r) => r.name)
  const opts = [{ value: '', label: 'Unassigned' }, ...names.map((n) => ({ value: n, label: n }))]
  const set = (k, v) => patch({ team: { ...t, [k]: v } })
  const planners = t.planners || []
  const mark = (name) => name && nextOwner && name.toLowerCase() === nextOwner.toLowerCase()
  const person = (role, name) => (
    <div key={role + name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '7px 8px', margin: '0 -8px', borderRadius: 8, borderTop: `1px solid ${C.border}`, background: mark(name) ? C.accentSoft : 'transparent', outline: mark(name) ? `1px solid ${C.accent}` : 'none' }}>
      <span style={{ fontSize: 12, color: C.t3 }}>{role}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: name ? C.t1 : C.t4 }}>{name || 'Unassigned'}{mark(name) && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 800, color: C.accent, textTransform: 'uppercase', letterSpacing: 1 }}>Next step</span>}</span>
    </div>
  )
  return (
    <Card C={C}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Eyebrow C={C}>Team</Eyebrow><Btn C={C} small ghost onClick={() => setEdit(!edit)}>{edit ? 'Done' : 'Edit'}</Btn></div>
      {edit ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <Field C={C} label="Relationship Manager"><Select C={C} value={t.rm} onChange={(v) => set('rm', v)} options={opts} style={{ width: '100%' }} /></Field>
          <Field C={C} label="Associate RM"><Select C={C} value={t.associateRm} onChange={(v) => set('associateRm', v)} options={opts} style={{ width: '100%' }} /></Field>
          {[0, 1, 2].map((i) => <Field key={i} C={C} label={`Planner ${i + 1}`}><Select C={C} value={planners[i] || ''} onChange={(v) => { const n = [0, 1, 2].map((k) => (k === i ? v : planners[k] || '')); set('planners', n) }} options={opts} style={{ width: '100%' }} /></Field>)}
        </div>
      ) : (<>{person('Relationship Manager', t.rm)}{person('Associate RM', t.associateRm)}{planners.filter(Boolean).length ? planners.filter(Boolean).map((n, i) => person(i ? `Planner ${i + 1}` : 'Planner', n)) : person('Planner', '')}</>)}
    </Card>
  )
}

function NextUp({ C, f, journey, tasks, setTab }) {
  const t0 = today()
  const meeting = (f.deadlines || []).filter((d) => !d.done && d.kind === 'Meeting' && d.date >= t0).sort((a, b) => a.date.localeCompare(b.date))[0]
  const next = journey.nextTasks[0]
  const overdueTasks = tasks.filter((t) => !isClosed(t.status) && t.due && t.due < t0).sort((a, b) => a.due.localeCompare(b.due))
  const overdueDeadlines = (f.deadlines || []).filter((d) => !d.done && d.date && d.date < t0)
  return (
    <Card C={C}>
      <Eyebrow C={C}>Next up</Eyebrow>
      <Row C={C} k="Next meeting" v={meeting ? `${meeting.title} · ${fmtDate(meeting.date)}` : f.gapMeta?.date && f.gapMeta.date >= t0 ? `Presentation · ${fmtDate(f.gapMeta.date)}` : ''} onClick={() => setTab('calendar')} />
      <Row C={C} k="Next task" v={next ? next.title : ''} onClick={() => setTab('work')} />
      <Row C={C} k="Owner" v={next ? next.owner || 'Unassigned' : ''} color={next && !next.owner ? C.warn : undefined} />
      <Row C={C} k="Due" v={next?.due ? shortDate(next.due) : ''} />
      <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color: overdueTasks.length + overdueDeadlines.length ? C.dn : C.t4, textTransform: 'uppercase', letterSpacing: 1 }}>Overdue · {overdueTasks.length + overdueDeadlines.length}</div>
      {!overdueTasks.length && !overdueDeadlines.length && <div style={{ fontSize: 12.5, color: C.t4, padding: '4px 0' }}>Nothing overdue.</div>}
      {overdueTasks.slice(0, 4).map((t) => <Row key={t.id} C={C} k={t.title} v={shortDate(t.due)} color={C.dn} onClick={() => setTab('work')} />)}
      {overdueDeadlines.slice(0, 3).map((d) => <Row key={d.id} C={C} k={d.title} v={shortDate(d.date)} color={C.dn} onClick={() => setTab('calendar')} />)}
    </Card>
  )
}

function MoneyCard({ C, f, settings, patch }) {
  const [edit, setEdit] = useState(false)
  const m = f.money || { contract: 'not_sent', payment: 'pending', feeQuoted: '' }
  const nw = netWorthOf(f)
  const fs = settings.feeSchedule || DEFAULT_FEE_SCHEDULE
  const rates = { ...DEFAULT_RATES, ...(settings.numbersCalc || {}) }
  const N = f.assessment?.numbers
  const variant = f.assessment?.variant || (f.tier === 'under5' ? 'under5' : 'over5')
  const res = calcNumbers(N || {}, rates)
  const ids = includedSections(N?.include, variant)
  const total = N ? ids.reduce((s, id) => s + res.sections[id].value, 0) : 0
  const quoted = num(m.feeQuoted) || gapFee(nw, fs)
  const set = (k, v) => patch({ money: { ...m, [k]: v } })
  const paid = m.payment === 'paid', signed = m.contract === 'signed'
  return (
    <Card C={C}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Eyebrow C={C}>Money snapshot</Eyebrow><Btn C={C} small ghost onClick={() => setEdit(!edit)}>{edit ? 'Done' : 'Edit'}</Btn></div>
      <Row C={C} k="What the Numbers Reveal (total)" v={total ? fmtUsd(Math.round(total), { compact: true }) : ''} />
      <Row C={C} k={`Gap Analysis fee${num(m.feeQuoted) ? ' (quoted)' : ' (schedule)'}`} v={quoted ? fmtUsd(quoted) : ''} />
      <Row C={C} k="Blueprint, year 1" v={nw ? `${fmtUsd(blueprintMonthly(nw, 1, fs))} / mo` : ''} />
      <Row C={C} k="Contract" v={lbl(CONTRACT, m.contract)} color={signed ? C.up : m.contract === 'sent' ? C.warn : C.t3} />
      <Row C={C} k="Payment" v={lbl(PAYMENT, m.payment)} color={paid ? C.up : m.payment === 'invoiced' ? C.warn : C.t3} />
      {edit && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
          <Field C={C} label="Fee quoted $"><Input C={C} value={m.feeQuoted} onChange={(v) => set('feeQuoted', v)} placeholder={String(gapFee(nw, fs))} /></Field>
          <Field C={C} label="Contract"><Select C={C} value={m.contract} onChange={(v) => set('contract', v)} options={CONTRACT.map(([value, label]) => ({ value, label }))} style={{ width: '100%' }} /></Field>
          <Field C={C} label="Payment"><Select C={C} value={m.payment} onChange={(v) => set('payment', v)} options={PAYMENT.map(([value, label]) => ({ value, label }))} style={{ width: '100%' }} /></Field>
        </div>
      )}
    </Card>
  )
}

function Readiness({ C, f, settings, setTab }) {
  const tax = settings.tax?.[new Date().getFullYear()] || Object.values(settings.tax || {})[0]
  const flags = familyFlags(f, tax)
  const status = (id) => f.documents?.[id]?.status || 'missing'
  const have = DOC_CATEGORIES.filter((c) => status(c.id) === 'received').length
  const needed = DOC_CATEGORIES.filter((c) => status(c.id) !== 'na').length
  const protect = DOC_CATEGORIES.filter((c) => c.protect && status(c.id) === 'missing')
  const goals = (f.goals || []).length
  const strategies = (f.recommendations || []).filter((r) => r.status === 'accepted').length
  const upcoming = (f.deadlines || []).filter((d) => !d.done && daysUntil(d.date) != null && daysUntil(d.date) <= 90).length
  const pct = needed ? Math.round((have / needed) * 100) : 0
  return (
    <Card C={C}>
      <Eyebrow C={C}>Readiness</Eyebrow>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{ flex: 1, height: 6, borderRadius: 3, background: C.border, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: C.up }} /></div>
        <span style={{ fontSize: 11.5, color: C.t3 }}>{have} received · {needed - have} missing</span>
      </div>
      <Row C={C} k="Documents received" v={`${have} of ${needed}`} onClick={() => setTab('documents')} />
      <Row C={C} k="Protection gaps" v={protect.length ? protect.map((c) => c.label.split(' (')[0]).join(', ') : 'None'} color={protect.length ? C.dn : C.up} onClick={() => setTab('documents')} />
      <Row C={C} k="Estate tax exposure" v={flags.includes('estate_tax_exposure') ? 'Yes' : 'No'} color={flags.includes('estate_tax_exposure') ? C.warn : C.up} onClick={() => setTab('gap')} />
      <Row C={C} k="Goals entered" v={String(goals)} color={goals ? undefined : C.warn} onClick={() => setTab('gap')} />
      <Row C={C} k="Strategies accepted" v={String(strategies)} onClick={() => setTab('priorities')} />
      <Row C={C} k="Deadlines within 90 days" v={String(upcoming)} onClick={() => setTab('calendar')} />
    </Card>
  )
}

function Relationship({ C, f, patch }) {
  const [edit, setEdit] = useState(false)
  const r = f.relationship || {}
  const set = (k, v) => patch({ relationship: { ...r, [k]: v } })
  const days = r.lastContact ? Math.max(0, -daysUntil(r.lastContact)) : null
  return (
    <Card C={C}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Eyebrow C={C}>Relationship</Eyebrow><Btn C={C} small ghost onClick={() => setEdit(!edit)}>{edit ? 'Done' : 'Edit'}</Btn></div>
      <Row C={C} k="Lead source" v={r.leadSource} />
      <Row C={C} k="Referred by" v={r.referredBy} />
      <Row C={C} k="First meeting" v={r.firstMeeting ? fmtDate(r.firstMeeting) : ''} />
      <Row C={C} k="Card sent" v={r.cardSent ? fmtDate(r.cardSent) : 'No'} color={r.cardSent ? C.up : C.t4} />
      <Row C={C} k="Book sent" v={r.bookSent ? fmtDate(r.bookSent) : 'No'} color={r.bookSent ? C.up : C.t4} />
      <Row C={C} k="Last contact" v={r.lastContact ? `${fmtDate(r.lastContact)}${days != null ? ` · ${days}d ago` : ''}` : ''} color={days != null && days > 30 ? C.warn : undefined} />
      {edit && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
          <Field C={C} label="Lead source"><Input C={C} value={r.leadSource} onChange={(v) => set('leadSource', v)} placeholder="Facebook ad, referral, event…" /></Field>
          <Field C={C} label="Referred by"><Input C={C} value={r.referredBy} onChange={(v) => set('referredBy', v)} /></Field>
          <Field C={C} label="First meeting"><Input C={C} type="date" value={r.firstMeeting} onChange={(v) => set('firstMeeting', v)} /></Field>
          <Field C={C} label="Last contact"><Input C={C} type="date" value={r.lastContact} onChange={(v) => set('lastContact', v)} /></Field>
          <Field C={C} label="Card sent (date)"><Input C={C} type="date" value={r.cardSent} onChange={(v) => set('cardSent', v)} /></Field>
          <Field C={C} label="Book sent (date)"><Input C={C} type="date" value={r.bookSent} onChange={(v) => set('bookSent', v)} /></Field>
        </div>
      )}
    </Card>
  )
}

// Open tasks owned by the signed-in user for this family.
function MyTasks({ C, setTab, tasks }) {
  const { email } = useAuth()
  const me = String(email || '').toLowerCase()
  if (!me) return null
  const mine = tasks.filter((t) => !isClosed(t.status) && String(t.owner || '').toLowerCase() === me).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))
  if (!mine.length) return null
  return (
    <Card C={C} accent style={{ marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <Eyebrow C={C} style={{ marginBottom: 0 }}>My open tasks</Eyebrow>
        <Btn C={C} small ghost onClick={() => setTab('work')}>Open Work{mine.length > 5 ? ` (${mine.length})` : ''}</Btn>
      </div>
      {mine.slice(0, 5).map((t) => (
        <div key={t.id} onClick={() => setTab('work')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: `1px solid ${C.border}`, cursor: 'pointer' }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title || 'Untitled task'}</span>
          {t.due && <span style={{ fontSize: 11.5, fontWeight: isOverdue(t) ? 800 : 500, color: isOverdue(t) ? C.dn : C.t3, whiteSpace: 'nowrap' }}>{shortDate(t.due)}</span>}
        </div>
      ))}
    </Card>
  )
}

/* ───────────────────────── firm pipeline ───────────────────────── */

function Pipeline({ C, isDesktop, families, journeys, stagesDef, onOpen }) {
  if (!families.length) return <Empty C={C} icon="▦" title="No families yet">Add a family in Families to see it move through the journey.</Empty>
  const cols = stagesDef.map((s, i) => ({ s, i, fams: families.filter((f) => (journeys[f.id]?.complete ? stagesDef.length - 1 : journeys[f.id]?.currentIndex) === i) }))
  return (
    <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 10, alignItems: 'flex-start' }}>
      {cols.map(({ s, i, fams }) => {
        const total = fams.reduce((n, f) => n + netWorthOf(f), 0)
        return (
          <div key={s.id} style={{ flex: '0 0 190px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 10, minHeight: 150 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: C.accent, letterSpacing: 1.2 }}>{String(i + 1).padStart(2, '0')}</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.t1, minHeight: 34, lineHeight: 1.25 }}>{s.name}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.t3, margin: '4px 0 8px', paddingBottom: 6, borderBottom: `1px solid ${C.border}` }}>
              <span><b style={{ color: C.t1 }}>{fams.length}</b> {fams.length === 1 ? 'family' : 'families'}</span><span style={{ fontVariantNumeric: 'tabular-nums' }}>{total ? fmtUsd(total, { compact: true }) : '—'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {fams.map((f) => {
                const j = journeys[f.id]
                return (
                  <div key={f.id} onClick={() => onOpen(f)} style={{ background: C.card, border: `1px solid ${j.stalled ? C.dn : C.border}`, borderLeft: `3px solid ${j.stalled ? C.dn : C.accent}`, borderRadius: 10, padding: '8px 10px', cursor: 'pointer' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 800, color: C.t1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                    <div style={{ fontSize: 10.5, color: C.t3, marginTop: 2 }}>{TRACK_LABEL[j.track]}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: C.t4, marginTop: 4 }}><span>{j.complete ? 'Complete' : `${j.daysInStage}d in stage`}</span><span>{netWorthOf(f) ? fmtUsd(netWorthOf(f), { compact: true }) : ''}</span></div>
                    {j.stalled && <div style={{ fontSize: 10, fontWeight: 800, color: C.dn, marginTop: 3 }}>STALLED {j.daysSinceProgress}d (over {STALL_DAYS})</div>}
                  </div>
                )
              })}
              {!fams.length && <div style={{ fontSize: 11.5, color: C.t4, textAlign: 'center', padding: '10px 0' }}>—</div>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ───────────────────────── cross-family alerts (kept from the old Desk) ───────────────────────── */

function Alerts({ C, setTab, families, settings, setActive }) {
  const [open, setOpen] = useState(false)
  const tax = settings.tax?.[new Date().getFullYear()] || Object.values(settings.tax || {})[0]
  const items = []
  for (const f of families) {
    const flags = familyFlags(f, tax)
    const protect = DOC_CATEGORIES.filter((c) => c.protect && (f.documents?.[c.id]?.status || 'missing') === 'missing')
    if (protect.length) items.push({ family: f, kind: 'protect', title: `${protect.length} protection document${protect.length > 1 ? 's' : ''} missing`, detail: protect.map((c) => c.label).join(' · '), tab: 'documents', sev: 'red' })
    for (const d of (f.deadlines || [])) {
      const days = daysUntil(d.date)
      if (days != null && days <= 90 && !d.done) items.push({ family: f, kind: 'deadline', title: d.title, detail: `${fmtDate(d.date)} · ${days < 0 ? `${-days} days overdue` : `${days} days left`}`, tab: 'calendar', sev: days < 14 ? 'red' : 'amber' })
    }
    const pending = (f.recommendations || []).filter((r) => r.status === 'proposed')
    if (pending.length) items.push({ family: f, kind: 'review', title: `${pending.length} recommendation${pending.length > 1 ? 's' : ''} awaiting review`, detail: pending.slice(0, 3).map((r) => r.name).join(' · '), tab: 'priorities', sev: 'amber' })
    const openGoals = (f.goals || []).filter((g) => g.status === 'open')
    if (f.stage === 'gap' && openGoals.length) items.push({ family: f, kind: 'gap', title: `${openGoals.length} goal${openGoals.length > 1 ? 's' : ''} not yet analysed`, detail: openGoals.slice(0, 2).map((g) => g.text).join(' · '), tab: 'gap', sev: 'amber' })
    if (flags.includes('business_sale_pending')) items.push({ family: f, kind: 'deadline', title: 'Business sale pending: pre-sale planning window', detail: 'Charitable gifts, QSBS stacking, GRAT and DST must be in place before a binding agreement.', tab: 'priorities', sev: 'red' })
    if (flags.includes('estate_tax_exposure')) items.push({ family: f, kind: 'structural', title: 'Estate tax exposure', detail: `Net worth ${fmtUsd(netWorthOf(f), { compact: true })} against the available exemption.`, tab: 'gap', sev: 'amber' })
  }
  const rank = { red: 0, amber: 1, green: 2 }
  items.sort((a, b) => rank[a.sev] - rank[b.sev])
  const col = (s) => (s === 'red' ? C.dn : s === 'amber' ? C.warn : C.up)
  if (!families.length) return null
  return (
    <div style={{ marginTop: 18 }}>
      <button onClick={() => setOpen(!open)} style={{ background: 'transparent', border: 'none', color: C.t1, fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: 8 }}>{open ? '▾' : '▸'} Alerts across all families · {items.filter((i) => i.sev === 'red').length} urgent · {items.filter((i) => i.sev === 'amber').length} needed</button>
      {open && (!items.length ? <Empty C={C} icon="✓" title="All clear">Missing protection documents, deadlines inside 90 days, pending recommendations and un-analysed goals show here.</Empty> : items.map((it, i) => (
        <Card key={i} C={C} hover onClick={() => { setActive(it.family.id); setTab(it.tab) }} style={{ borderLeft: `3px solid ${col(it.sev)}`, marginBottom: 10, padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.t1 }}>{it.family.name}</span>
            <Pill C={C} color={col(it.sev)}>{it.kind}</Pill>
            <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, color: col(it.sev), textTransform: 'uppercase', letterSpacing: 1 }}>{it.sev === 'red' ? 'Urgent' : 'Needed'}</span>
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.t1 }}>{it.title}</div>
          <div style={{ fontSize: 12.5, color: C.t3, marginTop: 3, lineHeight: 1.5 }}>{it.detail}</div>
        </Card>
      )))}
    </div>
  )
}
