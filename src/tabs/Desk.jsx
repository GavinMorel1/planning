import { useStore } from '../lib/store'
import { Card, Eyebrow, Title, Pill, Empty, Grid, Btn } from '../components/ui'
import { DOC_CATEGORIES } from '../data/docCategories'
import { familyFlags, FLAG_LABELS } from '../lib/flags'
import { daysUntil, fmtDate, fmtUsd } from '../lib/util'
import { netWorthOf } from './Families'
import { TIERS } from '../data/tools'
import { useAuth } from '../lib/auth'
import { useWork, isOverdue, shortDate } from '../lib/work'

export default function Desk({ C, isDesktop, setTab }) {
  const { families, setActive, settings } = useStore()
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
    const open = (f.goals || []).filter((g) => g.status === 'open')
    if (f.stage === 'gap' && open.length) items.push({ family: f, kind: 'gap', title: `${open.length} goal${open.length > 1 ? 's' : ''} not yet analysed`, detail: open.slice(0, 2).map((g) => g.text).join(' · '), tab: 'gap', sev: 'amber' })
    if (flags.includes('business_sale_pending')) items.push({ family: f, kind: 'deadline', title: 'Business sale pending — pre-sale planning window', detail: 'Charitable gifts, QSBS stacking, GRAT and DST must be in place before a binding agreement.', tab: 'priorities', sev: 'red' })
    if (flags.includes('estate_tax_exposure')) items.push({ family: f, kind: 'structural', title: 'Estate tax exposure', detail: `Net worth ${fmtUsd(netWorthOf(f), { compact: true })} against the available exemption.`, tab: 'gap', sev: 'amber' })
  }
  const sevRank = { red: 0, amber: 1, green: 2 }
  items.sort((a, b) => sevRank[a.sev] - sevRank[b.sev])
  const col = (s) => s === 'red' ? C.dn : s === 'amber' ? C.warn : C.up

  return (
    <div>
      <Title C={C} isDesktop={isDesktop} sub={`${families.length} famil${families.length === 1 ? 'y' : 'ies'} · ${items.filter((i) => i.sev === 'red').length} urgent · ${items.filter((i) => i.sev === 'amber').length} needed`}>Planning Desk</Title>
      <Grid cols={isDesktop ? 3 : 1} gap={12} style={{ marginBottom: 18 }}>
        {[['Families', families.length], ['In Gap Analysis', families.filter((f) => f.stage === 'gap').length], ['In Blueprint', families.filter((f) => f.stage === 'blueprint').length]].map(([l, v]) => (
          <Card key={l} C={C}><Eyebrow C={C}>{l}</Eyebrow><div style={{ fontSize: 28, fontWeight: 800, color: C.t1 }}>{v}</div></Card>
        ))}
      </Grid>
      <MyTasks C={C} setTab={setTab} />
      {!items.length ? (
        <Empty C={C} icon="✓" title="All clear" action={!families.length && <Btn C={C} primary onClick={() => setTab('families')}>Add a family</Btn>}>Missing protection documents, deadlines inside 90 days, pending recommendations and un-analysed goals will show here across every family.</Empty>
      ) : items.map((it, i) => (
        <Card key={i} C={C} hover onClick={() => { setActive(it.family.id); setTab(it.tab) }} style={{ borderLeft: `3px solid ${col(it.sev)}`, marginBottom: 10, padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: C.t1 }}>{it.family.name}</span>
            <Pill C={C} color={col(it.sev)}>{it.kind}</Pill>
            <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, color: col(it.sev), textTransform: 'uppercase', letterSpacing: 1 }}>{it.sev === 'red' ? 'Urgent' : 'Needed'}</span>
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: C.t1 }}>{it.title}</div>
          <div style={{ fontSize: 12.5, color: C.t3, marginTop: 3, lineHeight: 1.5 }}>{it.detail}</div>
        </Card>
      ))}
    </div>
  )
}

// Compact "My open tasks" card for the active family (owner === signed-in email). Hidden when there is nothing to show.
function MyTasks({ C, setTab }) {
  const { family } = useStore()
  const { email } = useAuth()
  const W = useWork(family?.id || null)
  const me = String(email || '').toLowerCase()
  if (!family || !me || W.missingTable || !W.ready) return null
  const mine = W.tasks.filter((t) => t.status !== 'done' && String(t.owner).toLowerCase() === me).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))
  if (!mine.length) return null
  return (
    <Card C={C} accent style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <Eyebrow C={C} style={{ marginBottom: 0 }}>My open tasks · {family.name}</Eyebrow>
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
