import { useState } from 'react'
import { useStore, useFamily } from '../lib/store'
import { draftGoal, CLAUDE_ENABLED } from '../lib/claude'
import { familyContext } from '../lib/context'
import { TOOLS, TIERS, toolById, tierRank } from '../data/tools'
import { Card, Eyebrow, Title, Btn, Pill, Grid, Row, Note, Empty, Stat, TextArea, Input, Field, Select, SectionLabel } from '../components/ui'
import { fmtUsd, num, uid } from '../lib/util'

export default function GapAnalysis({ C, isDesktop, setTab }) {
  const { settings } = useStore()
  const [f, patch] = useFamily()
  const goals = f.goals || []
  const [sel, setSel] = useState(goals[0]?.id || null)
  const [busy, setBusy] = useState(false)
  const g = goals.find((x) => x.id === sel) || null
  const met = goals.filter((x) => x.status === 'met').length, missed = goals.filter((x) => x.status === 'missed').length
  const totalCost = goals.reduce((s, x) => s + (x.status === 'missed' ? num(x.cost?.amount) : 0), 0)
  const upd = (id, p) => patch({ goals: goals.map((x) => x.id === id ? { ...x, ...p } : x) })
  const tierColor = (id) => ({ Protect: C.dn, Deadline: C.warn, Structural: C.accent, Optimize: C.info, Legacy: C.up })[id] || C.t3
  const recs = f.recommendations || []
  const goalRecs = (id) => recs.filter((r) => (r.goalIds || []).includes(id) && r.status !== 'rejected').sort((a, b) => tierRank(a.tier) - tierRank(b.tier))

  const draft = async () => {
    if (!g) return
    setBusy(true)
    try {
      const context = familyContext(f, settings)
      const out = await draftGoal({ goal: g, family: f, context, tools: TOOLS })
      const newRecs = (out.recommended_tools || []).filter((r) => toolById(r.tool_id)).map((r) => ({ id: `${r.tool_id}-${uid().slice(0, 6)}`, toolId: r.tool_id, name: toolById(r.tool_id).name, tier: r.tier, rationale: r.rationale, goalIds: [g.id], status: 'proposed', source: 'claude' }))
      patch((cur) => {
        const existing = cur.recommendations || []
        const merged = [...existing]
        for (const nr of newRecs) {
          const dup = merged.find((x) => x.toolId === nr.toolId)
          if (dup) { if (!dup.goalIds.includes(g.id)) dup.goalIds = [...dup.goalIds, g.id]; if (!dup.rationale) dup.rationale = nr.rationale } else merged.push(nr)
        }
        return { ...cur, recommendations: merged, goals: cur.goals.map((x) => x.id === g.id ? { ...x, observations: out.observations || [], challenges: out.challenges || [], cost: { amount: out.cost_of_inaction?.amount ?? '', basis: out.cost_of_inaction?.basis || '' }, status: x.status === 'open' && out.status_suggestion !== 'unclear' ? out.status_suggestion : x.status, drafted: true } : x) }
      })
    } catch (e) { alert(e.message) }
    setBusy(false)
  }

  const Lines = ({ label, value, onChange, placeholder }) => (
    <Field C={C} label={label}><TextArea C={C} rows={4} value={(value || []).join('\n')} onChange={(v) => onChange(v.split('\n').map((s) => s.replace(/^[\s•\-\*]+/, '')).filter((s, i, a) => s || i < a.length - 1))} placeholder={placeholder} /></Field>
  )

  if (!goals.length) return (
    <div>
      <Title C={C} isDesktop={isDesktop}>Gap Analysis · {f.name}</Title>
      <Empty C={C} icon="◫" title="No goals yet" action={<Btn C={C} primary onClick={() => setTab('families')}>Enter goals in Families</Btn>}>The Gap Analysis works goal by goal: what they said they want, what the current plan does, what it costs to stay put, and which tools close the gap.</Empty>
    </div>
  )

  return (
    <div>
      <Title C={C} isDesktop={isDesktop} sub="Goal by goal: observations, potential challenges, cost of inaction and the tools that close the gap." right={<><Btn C={C} onClick={() => setTab('priorities')}>Priorities</Btn><Btn C={C} primary onClick={() => setTab('presentations')}>Build deck</Btn></>}>Gap Analysis · {f.name}</Title>
      <Grid cols={isDesktop ? 4 : 2} gap={10} style={{ marginBottom: 14 }}>
        <Stat C={C} label="Total goals" value={goals.length} />
        <Stat C={C} label="Goals met" value={met} color={C.up} sub="Current plan status" />
        <Stat C={C} label="Goals missed" value={missed} color={C.dn} sub="Opportunity to improve" />
        <Stat C={C} label="Total cost of inaction" value={fmtUsd(totalCost)} color={totalCost ? C.dn : C.t3} />
      </Grid>
      <Grid cols={isDesktop ? 2 : 1} gap={14} style={{ gridTemplateColumns: isDesktop ? '340px 1fr' : undefined }}>
        <div>
          {goals.map((x, i) => (
            <Card key={x.id} C={C} hover onClick={() => setSel(x.id)} style={{ padding: '10px 12px', marginBottom: 6, borderLeft: `3px solid ${x.status === 'met' ? C.up : x.status === 'missed' ? C.dn : C.border}`, background: sel === x.id ? C.cardHover : C.card }}>
              <div style={{ fontSize: 12.5, color: C.t1, lineHeight: 1.4 }}><span style={{ color: C.t4 }}>{i + 1}.</span> {x.text || <i style={{ color: C.t4 }}>untitled</i>}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 5 }}><Pill C={C} color={x.status === 'met' ? C.up : x.status === 'missed' ? C.dn : C.t4}>{x.status}</Pill>{num(x.cost?.amount) > 0 && <Pill C={C} color={C.dn}>{fmtUsd(num(x.cost.amount), { compact: true })}</Pill>}{goalRecs(x.id).length > 0 && <Pill C={C}>{goalRecs(x.id).length} tools</Pill>}</div>
            </Card>
          ))}
          <Card C={C} style={{ marginTop: 10 }}>
            <Eyebrow C={C}>Deck extras</Eyebrow>
            <Field C={C} label="What's top of mind? (closing slide notes)"><TextArea C={C} rows={3} value={f.gapMeta?.topOfMind} onChange={(v) => patch({ gapMeta: { ...(f.gapMeta || {}), topOfMind: v } })} /></Field>
          </Card>
        </div>
        {g && (
          <div>
            <Card C={C} style={{ marginBottom: 12 }}>
              <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <Eyebrow C={C} style={{ marginBottom: 0 }}>Goal</Eyebrow>
                <Row gap={6}>
                  {['open', 'met', 'missed'].map((s) => <Btn key={s} C={C} small primary={g.status === s} onClick={() => upd(g.id, { status: s })} style={g.status === s ? { background: s === 'met' ? C.up : s === 'missed' ? C.dn : C.accent, borderColor: 'transparent' } : undefined}>{s === 'open' ? 'Not assessed' : s === 'met' ? '✓ Met' : '× Missed'}</Btn>)}
                </Row>
              </Row>
              <TextArea C={C} rows={2} value={g.text} onChange={(v) => upd(g.id, { text: v })} />
              <Field C={C} label="Planner notes from the retreat and surveys (feed Claude; not printed)" style={{ marginTop: 10 }}><TextArea C={C} rows={3} value={g.notes} onChange={(v) => upd(g.id, { notes: v })} placeholder="What each spouse said, numbers they mentioned, alignment scores, tensions…" /></Field>
              <Row style={{ marginTop: 10, justifyContent: 'space-between' }}>
                <div style={{ fontSize: 11.5, color: C.t4 }}>{CLAUDE_ENABLED ? 'Claude drafts from the profile, documents and your notes. You edit everything before it prints.' : 'Connect Claude to draft these pages automatically.'}</div>
                <Btn C={C} primary disabled={!CLAUDE_ENABLED || busy} onClick={draft}>{busy ? 'Drafting…' : g.drafted ? 'Re-draft with Claude' : 'Draft with Claude'}</Btn>
              </Row>
            </Card>
            <Card C={C} style={{ marginBottom: 12 }}>
              <Grid cols={1} gap={12}>
                <Lines label="Observations" value={g.observations} onChange={(v) => upd(g.id, { observations: v })} placeholder={"One per line, in second person.\nYou mentioned having $30,000 in personal reserves…"} />
                <Lines label="Potential challenges" value={g.challenges} onChange={(v) => upd(g.id, { challenges: v })} placeholder="What happens if nothing changes" />
                <Grid cols={isDesktop ? 3 : 1} gap={10}>
                  <Field C={C} label="Potential cost of inaction ($)"><Input C={C} value={g.cost?.amount} onChange={(v) => upd(g.id, { cost: { ...(g.cost || {}), amount: v } })} placeholder="e.g. 22438000" /></Field>
                  <Field C={C} label="Basis (one sentence, printed under the amount)" style={{ gridColumn: isDesktop ? 'span 2' : undefined }}><Input C={C} value={g.cost?.basis} onChange={(v) => upd(g.id, { cost: { ...(g.cost || {}), basis: v } })} placeholder="At a 37% marginal rate, $56,400 of after-tax support costs $21,000 a year…" /></Field>
                </Grid>
              </Grid>
            </Card>
            <Card C={C}>
              <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                <Eyebrow C={C} style={{ marginBottom: 0 }}>Tools that close this gap</Eyebrow>
                <Select C={C} value="" onChange={(v) => { if (!v) return; const t = toolById(v); patch((cur) => { const existing = (cur.recommendations || []).find((r) => r.toolId === v); const recs = existing ? cur.recommendations.map((r) => r.toolId === v ? { ...r, goalIds: [...new Set([...(r.goalIds || []), g.id])], status: r.status === 'rejected' ? 'proposed' : r.status } : r) : [...(cur.recommendations || []), { id: `${v}-${uid().slice(0, 6)}`, toolId: v, name: t.name, tier: t.tier, rationale: '', goalIds: [g.id], status: 'proposed', source: 'planner' }]; return { ...cur, recommendations: recs } }) }} options={[{ value: '', label: '+ Add a tool…' }, ...TOOLS.map((t) => ({ value: t.id, label: t.name }))]} style={{ maxWidth: 320 }} />
              </Row>
              {!goalRecs(g.id).length && <div style={{ fontSize: 12.5, color: C.t4 }}>No tools linked yet. Draft with Claude or add one.</div>}
              {goalRecs(g.id).map((r) => (
                <div key={r.id} style={{ padding: '10px 0', borderTop: `1px solid ${C.border}` }}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Row gap={8}><span style={{ fontSize: 13.5, fontWeight: 700, color: C.t1 }}>{r.name}</span><Pill C={C} color={tierColor(r.tier)}>{r.tier}</Pill><Pill C={C} color={r.status === 'accepted' ? C.up : C.warn}>{r.status}</Pill></Row>
                    <Row gap={6}>
                      <Select C={C} value={r.tier} onChange={(v) => patch({ recommendations: recs.map((x) => x.id === r.id ? { ...x, tier: v } : x) })} options={TIERS.map((t) => ({ value: t.id, label: t.label }))} style={{ padding: '4px 8px', fontSize: 11 }} />
                      {r.status !== 'accepted' && <Btn C={C} small primary onClick={() => patch({ recommendations: recs.map((x) => x.id === r.id ? { ...x, status: 'accepted' } : x) })}>Accept</Btn>}
                      <Btn C={C} small ghost onClick={() => patch({ recommendations: recs.map((x) => x.id === r.id ? { ...x, goalIds: x.goalIds.filter((k) => k !== g.id) } : x) })}>Unlink</Btn>
                    </Row>
                  </Row>
                  <TextArea C={C} rows={2} value={r.rationale} onChange={(v) => patch({ recommendations: recs.map((x) => x.id === r.id ? { ...x, rationale: v } : x) })} placeholder="Why this tool for this family and this goal" style={{ marginTop: 6 }} />
                </div>
              ))}
            </Card>
          </div>
        )}
      </Grid>
    </div>
  )
}
