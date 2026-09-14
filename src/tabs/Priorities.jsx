import { useState } from 'react'
import { useStore, useFamily } from '../lib/store'
import { recommendTools, rationaleFor } from '../lib/recommend'
import { TIERS, TOOLS, toolById, tierRank } from '../data/tools'
import { familyFlags, FLAG_LABELS } from '../lib/flags'
import { Card, Eyebrow, Title, Pill, Btn, TextArea, Select, Empty, Note, SectionLabel, Row, SubTabs } from '../components/ui'

export default function Priorities({ C, isDesktop, setTab }) {
  const { settings } = useStore()
  const [f, patch] = useFamily()
  const [view, setView] = useState('plan')
  const tax = settings.tax?.[new Date().getFullYear()] || Object.values(settings.tax || {})[0]
  const recs = f.recommendations || []
  const suggestions = recommendTools(f, tax).filter((r) => !recs.some((x) => x.toolId === r.tool.id))
  const flags = familyFlags(f, tax)
  const tierColor = (id) => ({ Protect: C.dn, Deadline: C.warn, Structural: C.accent, Optimize: C.info, Legacy: C.up })[id] || C.t3
  const upd = (id, p) => patch({ recommendations: recs.map((r) => r.id === id ? { ...r, ...p } : r) })
  const add = (rec) => patch({ recommendations: [...recs, { id: `${rec.tool.id}-${Date.now()}`, toolId: rec.tool.id, name: rec.tool.name, tier: rec.tool.tier, rationale: rationaleFor(rec, f), goalIds: rec.goalIds, status: 'proposed', source: 'rules', hits: rec.hits }] })
  const accepted = recs.filter((r) => r.status !== 'rejected').sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || (a.order || 0) - (b.order || 0))
  const goalText = (id) => (f.goals || []).find((g) => g.id === id)?.text

  return (
    <div>
      <Title C={C} isDesktop={isDesktop} sub="The ranked plan for this family, most urgent first, with why each tool was chosen for them." right={<Btn C={C} onClick={() => setTab('gap')}>Open Gap Analysis</Btn>}>Priorities · {f.name}</Title>
      <SubTabs C={C} value={view} onChange={setView} tabs={[{ id: 'plan', label: 'Plan', count: accepted.length }, { id: 'suggest', label: 'Suggestions', count: suggestions.length }, { id: 'rejected', label: 'Rejected', count: recs.filter((r) => r.status === 'rejected').length }]} />

      {view === 'plan' && (!accepted.length ? (
        <Empty C={C} icon="≡" title="No tools in the plan yet" action={<Btn C={C} primary onClick={() => setView('suggest')}>Review suggestions</Btn>}>Suggestions come from the family's flags and goals. Accept the ones that fit, edit the rationale in the family's words, and they appear in the Gap Analysis deck.</Empty>
      ) : TIERS.map((tier) => {
        const rows = accepted.filter((r) => r.tier === tier.id)
        if (!rows.length) return null
        return (
          <div key={tier.id} style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: tierColor(tier.id), textTransform: 'uppercase', letterSpacing: 1.2 }}>{tier.label}</span>
              <span style={{ fontSize: 11, color: C.t4 }}>{tier.desc}</span>
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>
            {rows.map((r, i) => (
              <Card key={r.id} C={C} style={{ borderLeft: `3px solid ${tierColor(r.tier)}`, marginBottom: 8, padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: C.t1 }}>{i + 1}. {r.name}</span>
                  <Pill C={C} color={r.status === 'accepted' ? C.up : C.warn}>{r.status}</Pill>
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <Select C={C} value={r.tier} onChange={(v) => upd(r.id, { tier: v })} options={TIERS.map((t) => ({ value: t.id, label: t.label }))} style={{ padding: '4px 8px', fontSize: 11 }} />
                    {r.status !== 'accepted' && <Btn C={C} small primary onClick={() => upd(r.id, { status: 'accepted' })}>Accept</Btn>}
                    <Btn C={C} small ghost onClick={() => upd(r.id, { status: 'rejected' })}>Reject</Btn>
                  </span>
                </div>
                {(r.goalIds || []).length > 0 && <div style={{ fontSize: 11.5, color: C.accent, marginTop: 6 }}>↳ Serves: {r.goalIds.map(goalText).filter(Boolean).join(' · ')}</div>}
                <TextArea C={C} rows={2} value={r.rationale} onChange={(v) => upd(r.id, { rationale: v })} placeholder="Why this tool, for this family, in their words." style={{ marginTop: 8 }} />
                {toolById(r.toolId)?.disqualifiers?.length > 0 && <div style={{ fontSize: 11, color: C.t4, marginTop: 6 }}>Check: {toolById(r.toolId).disqualifiers.join(' · ')}</div>}
              </Card>
            ))}
          </div>
        )
      }))}

      {view === 'suggest' && (
        <div>
          <Card C={C} style={{ marginBottom: 14 }}>
            <Eyebrow C={C}>Why these suggestions</Eyebrow>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{flags.map((fl) => <Pill key={fl} C={C} color={C.t3}>{FLAG_LABELS[fl] || fl}</Pill>)}</div>
            {!flags.length && <div style={{ fontSize: 12.5, color: C.t4 }}>No flags yet. Fill in the family profile, balance sheet, goals and documents.</div>}
          </Card>
          {!suggestions.length && <Empty C={C} icon="✓" title="Nothing new to suggest">Every matching tool is already in the plan or rejected.</Empty>}
          {suggestions.map((s) => (
            <Card key={s.tool.id} C={C} style={{ borderLeft: `3px solid ${tierColor(s.tool.tier)}`, marginBottom: 8, padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: C.t1 }}>{s.tool.name}</span>
                <Pill C={C} color={tierColor(s.tool.tier)}>{s.tool.tier}</Pill>
                <span style={{ marginLeft: 'auto' }}><Btn C={C} small primary onClick={() => add(s)}>Add to plan</Btn></span>
              </div>
              <div style={{ fontSize: 12.5, color: C.t3, marginTop: 6, lineHeight: 1.5 }}>{s.tool.summary}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>{s.hits.map((h) => <Pill key={h} C={C}>{FLAG_LABELS[h] || h}</Pill>)}{s.goalIds.map((g) => <Pill key={g} C={C} color={C.up}>goal: {(goalText(g) || '').slice(0, 40)}…</Pill>)}</div>
            </Card>
          ))}
        </div>
      )}

      {view === 'rejected' && recs.filter((r) => r.status === 'rejected').map((r) => (
        <Card key={r.id} C={C} style={{ marginBottom: 8, padding: '12px 16px', opacity: 0.8 }}>
          <Row style={{ justifyContent: 'space-between' }}><span style={{ fontWeight: 700, color: C.t2 }}>{r.name}</span><Btn C={C} small onClick={() => upd(r.id, { status: 'proposed' })}>Restore</Btn></Row>
        </Card>
      ))}
    </div>
  )
}
