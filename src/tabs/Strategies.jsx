import { useState } from 'react'
import { useStore } from '../lib/store'
import { TOOLS, CATEGORIES, TIERS, categoryLabel } from '../data/tools'
import { Card, Eyebrow, Title, SubTabs, Input, Pill, Btn, TextArea, Field, Grid, SectionLabel, Note } from '../components/ui'
import { FLAG_LABELS } from '../lib/flags'

export default function Strategies({ C, isDesktop }) {
  const { settings, updateSettings, family, updateFamily } = useStore()
  const [cat, setCat] = useState('all')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)
  const [edit, setEdit] = useState(false)
  const overrides = settings.toolOverrides || {}
  const tools = TOOLS.map((t) => ({ ...t, ...(overrides[t.id] || {}) }))
  const list = tools.filter((t) => (cat === 'all' || t.category === cat) && (!q || `${t.name} ${t.summary} ${t.fit.join(' ')}`.toLowerCase().includes(q.toLowerCase())))
  const tierColor = (id) => ({ Protect: C.dn, Deadline: C.warn, Structural: C.accent, Optimize: C.info, Legacy: C.up })[id] || C.t3
  const sel = tools.find((t) => t.id === open)
  const setOv = (id, k, v) => updateSettings((s) => ({ ...s, toolOverrides: { ...(s.toolOverrides || {}), [id]: { ...((s.toolOverrides || {})[id] || {}), [k]: v } } }))
  const lines = (arr) => (arr || []).join('\n')
  const fromLines = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean)

  if (sel) return (
    <div>
      <Btn C={C} ghost small onClick={() => { setOpen(null); setEdit(false) }} style={{ marginBottom: 12 }}>‹ All strategies</Btn>
      <Title C={C} isDesktop={isDesktop} sub={categoryLabel(sel.category)} right={<>
        <Pill C={C} color={tierColor(sel.tier)}>{sel.tier}</Pill>
        <Btn C={C} small onClick={() => setEdit(!edit)}>{edit ? 'Done editing' : 'Edit rules'}</Btn>
        {family && <Btn C={C} small primary onClick={() => updateFamily(family.id, (f) => ({ ...f, recommendations: [...(f.recommendations || []), { id: `${sel.id}-${Date.now()}`, toolId: sel.id, name: sel.name, tier: sel.tier, rationale: '', goalIds: [], status: 'proposed', source: 'planner' }] }))}>+ Add to {family.name}</Btn>}
      </>}>{sel.name}</Title>
      {edit ? (
        <Card C={C}>
          <Note C={C} style={{ marginBottom: 12 }}>Edits are saved for the whole team and override the built-in draft. One item per line.</Note>
          <Grid cols={isDesktop ? 2 : 1} gap={12}>
            <Field C={C} label="Summary" style={{ gridColumn: '1 / -1' }}><TextArea C={C} rows={3} value={sel.summary} onChange={(v) => setOv(sel.id, 'summary', v)} /></Field>
            <Field C={C} label="Fits when"><TextArea C={C} rows={5} value={lines(sel.fit)} onChange={(v) => setOv(sel.id, 'fit', fromLines(v))} /></Field>
            <Field C={C} label="Disqualifiers"><TextArea C={C} rows={5} value={lines(sel.disqualifiers)} onChange={(v) => setOv(sel.id, 'disqualifiers', fromLines(v))} /></Field>
            <Field C={C} label="Sequencing"><TextArea C={C} rows={3} value={sel.sequencing} onChange={(v) => setOv(sel.id, 'sequencing', v)} /></Field>
            <Field C={C} label="Prerequisites"><TextArea C={C} rows={3} value={lines(sel.prerequisites)} onChange={(v) => setOv(sel.id, 'prerequisites', fromLines(v))} /></Field>
            <Field C={C} label="Experts / partners"><TextArea C={C} rows={2} value={lines(sel.experts)} onChange={(v) => setOv(sel.id, 'experts', fromLines(v))} /></Field>
            <Field C={C} label="Default priority tier"><select value={sel.tier} onChange={(e) => setOv(sel.id, 'tier', e.target.value)} style={{ padding: 9, borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, color: C.t1, fontFamily: 'inherit' }}>{TIERS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></Field>
            <Field C={C} label="Team notes (internal)" style={{ gridColumn: '1 / -1' }}><TextArea C={C} rows={3} value={sel.teamNotes} onChange={(v) => setOv(sel.id, 'teamNotes', v)} placeholder="Lessons learned, which attorneys draft it well, pricing…" /></Field>
          </Grid>
        </Card>
      ) : (
        <Grid cols={isDesktop ? 2 : 1} gap={14}>
          <Card C={C} style={{ gridColumn: '1 / -1' }}><Eyebrow C={C}>What it does</Eyebrow><div style={{ fontSize: 14, color: C.t2, lineHeight: 1.65 }}>{sel.summary}</div></Card>
          <Card C={C}><Eyebrow C={C} color={C.up}>Fits when</Eyebrow><ul style={{ paddingLeft: 18, color: C.t2, fontSize: 13, lineHeight: 1.7 }}>{sel.fit.map((x, i) => <li key={i}>{x}</li>)}</ul></Card>
          <Card C={C}><Eyebrow C={C} color={C.dn}>Do not use when</Eyebrow>{sel.disqualifiers.length ? <ul style={{ paddingLeft: 18, color: C.t2, fontSize: 13, lineHeight: 1.7 }}>{sel.disqualifiers.map((x, i) => <li key={i}>{x}</li>)}</ul> : <div style={{ fontSize: 13, color: C.t4 }}>No hard disqualifiers.</div>}</Card>
          <Card C={C}><Eyebrow C={C}>Sequencing</Eyebrow><div style={{ fontSize: 13, color: C.t2, lineHeight: 1.65 }}>{sel.sequencing}</div>{sel.prerequisites?.length > 0 && <><SectionLabel C={C}>Prerequisites</SectionLabel><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{sel.prerequisites.map((x) => <Pill key={x} C={C}>{x}</Pill>)}</div></>}</Card>
          <Card C={C}><Eyebrow C={C}>Triggers</Eyebrow><div style={{ fontSize: 12, color: C.t3, marginBottom: 8 }}>Family flags that make this a candidate.</div><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{(sel.triggers || []).map((x) => <Pill key={x} C={C} color={C.t3}>{FLAG_LABELS[x] || x}</Pill>)}</div>{sel.experts?.length > 0 && <><SectionLabel C={C}>Experts</SectionLabel><div style={{ fontSize: 13, color: C.t2 }}>{sel.experts.join(', ')}</div></>}{sel.teamNotes && <><SectionLabel C={C}>Team notes</SectionLabel><div style={{ fontSize: 13, color: C.t2, whiteSpace: 'pre-wrap' }}>{sel.teamNotes}</div></>}</Card>
        </Grid>
      )}
    </div>
  )

  return (
    <div>
      <Title C={C} isDesktop={isDesktop} sub={`${TOOLS.length} planning tools across six categories. Rules are a first draft — open a tool and edit them as the team learns.`}>Strategies</Title>
      <Input C={C} value={q} onChange={setQ} placeholder="Search tools, fit rules…" style={{ marginBottom: 12 }} />
      <SubTabs C={C} value={cat} onChange={setCat} tabs={[{ id: 'all', label: 'All', count: TOOLS.length }, ...CATEGORIES.map((c) => ({ id: c.id, label: c.label, count: TOOLS.filter((t) => t.category === c.id).length }))]} />
      <Grid cols={isDesktop ? 2 : 1} gap={10}>
        {list.map((t) => (
          <Card key={t.id} C={C} hover onClick={() => setOpen(t.id)} style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.t1 }}>{t.name}</div>
              <Pill C={C} color={tierColor(t.tier)}>{t.tier}</Pill>
            </div>
            <div style={{ fontSize: 11, color: C.t4, marginTop: 2 }}>{categoryLabel(t.category)}{t.sub ? ` · ${t.sub.replace('_', ' ')}` : ''}</div>
            <div style={{ fontSize: 12.5, color: C.t3, marginTop: 8, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{t.summary}</div>
          </Card>
        ))}
      </Grid>
    </div>
  )
}
