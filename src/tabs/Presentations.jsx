import { useState } from 'react'
import { useStore, useFamily } from '../lib/store'
import { buildAssessment, buildGap } from '../lib/pptx'
import { Card, Eyebrow, Title, Btn, Grid, Row, Note, Pill, Check, Empty, Field, Input } from '../components/ui'
import { download, nowIso, uid, fmtDate } from '../lib/util'
import { DOC_CATEGORIES } from '../data/docCategories'

export default function Presentations({ C, isDesktop, setTab }) {
  const { settings } = useStore()
  const [f, patch] = useFamily()
  const [busy, setBusy] = useState('')
  const goals = f.goals || []
  const gm = f.gapMeta || {}
  const recs = (f.recommendations || []).filter((r) => r.status === 'accepted')
  const checks = [
    ['Spouse names', Boolean(f.profile?.spouse1?.name), 'families'],
    ['Goals entered', goals.length > 0, 'families'],
    ['Every goal assessed (met / missed)', goals.length > 0 && goals.every((g) => g.status !== 'open'), 'gap'],
    ['Observations on missed goals', goals.filter((g) => g.status === 'missed').every((g) => g.observations?.length), 'gap'],
    ['Balance sheet entered', (f.balanceSheet?.assets || []).length > 0, 'families'],
    ['Estate flow chart saved to deck', Boolean(f.flowchart?.png), 'estate'],
    ['Tools accepted in Priorities', recs.length > 0, 'priorities'],
    ['Protection documents reviewed', DOC_CATEGORIES.filter((c) => c.protect).every((c) => (f.documents?.[c.id]?.status || 'missing') !== 'missing'), 'documents'],
  ]
  const run = async (type) => {
    setBusy(type)
    try {
      const blob = type === 'assessment' ? await buildAssessment(f, settings) : await buildGap(f, settings)
      const filename = `${f.name.replace(/[^A-Za-z0-9]+/g, '-')}-${type === 'assessment' ? 'Family-Capital-Assessment' : 'Family-Capital-Gap-Analysis'}-${new Date().toISOString().slice(0, 10)}.pptx`
      download(blob, filename)
      patch({ presentations: [...(f.presentations || []), { id: uid(), type, filename, createdAt: nowIso(), tier: f.tier, goals: goals.length }] })
    } catch (e) { alert(`Deck failed: ${e.message}`); console.error(e) }
    setBusy('')
  }
  const gapOutline = ['Cover', 'Disclosures', 'Two Kinds of Return', 'Our Process (Gap Analysis = today)', 'What you said you want', `Goals and Intentions (${goals.length})`, 'Gap summary (met / missed / cost of inaction)', `One analysis page per goal (${goals.length})`, gm.includeToolPages !== false ? `Recommended tools (${recs.length}, by priority)` : null, gm.includeInvestmentSlides !== false ? 'Investment performance (Dividend, Growth)' : null, 'Balance sheet', 'Estate tax information', 'Estate flow chart', 'Current plan analysis (✓ / ×)', 'Gap summary', "What's top of mind?", 'Team & Advocates', 'Blueprint scope + fee'].filter(Boolean)

  return (
    <div>
      <Title C={C} isDesktop={isDesktop} sub="Editable PowerPoint files built from everything entered for this family. Georgia and Calibri, brand palette, flat shapes.">Presentations · {f.name}</Title>
      <Grid cols={isDesktop ? 2 : 1} gap={14}>
        <Card C={C}>
          <Eyebrow C={C}>Family Capital Assessment</Eyebrow>
          <div style={{ fontSize: 12.5, color: C.t3, lineHeight: 1.5, marginBottom: 10 }}>{f.tier === 'under5' ? 'Under-$5M variant' : '$5M+ variant'}. Intake fields live in the Assessment tab.</div>
          <Row><Btn C={C} primary disabled={!!busy} onClick={() => run('assessment')}>{busy === 'assessment' ? 'Building…' : 'Download .pptx'}</Btn><Btn C={C} ghost onClick={() => setTab('assessment')}>Edit intake</Btn></Row>
        </Card>
        <Card C={C}>
          <Eyebrow C={C}>Family Capital Gap Analysis</Eyebrow>
          <Grid cols={2} gap={10} style={{ marginBottom: 10 }}>
            <Field C={C} label="Presentation date"><Input C={C} type="date" value={gm.date} onChange={(v) => patch({ gapMeta: { ...gm, date: v } })} /></Field>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'flex-end' }}>
              <Check C={C} checked={gm.includeInvestmentSlides !== false} onChange={(v) => patch({ gapMeta: { ...gm, includeInvestmentSlides: v } })} label="Include investment slides" />
              <Check C={C} checked={gm.includeToolPages !== false} onChange={(v) => patch({ gapMeta: { ...gm, includeToolPages: v } })} label="Include recommended-tools pages" />
            </div>
          </Grid>
          <Row><Btn C={C} primary disabled={!!busy} onClick={() => run('gap')}>{busy === 'gap' ? 'Building…' : 'Download .pptx'}</Btn><Btn C={C} ghost onClick={() => setTab('gap')}>Edit analysis</Btn></Row>
        </Card>
        <Card C={C}>
          <Eyebrow C={C}>Readiness</Eyebrow>
          {checks.map(([l, ok, tab]) => (
            <div key={l} onClick={() => !ok && setTab(tab)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: `1px solid ${C.border}`, fontSize: 13, color: ok ? C.t2 : C.t1, cursor: ok ? 'default' : 'pointer' }}>
              <span style={{ width: 18, height: 18, borderRadius: 9, background: ok ? C.upSoft : C.dnSoft, color: ok ? C.up : C.dn, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{ok ? '✓' : '×'}</span>
              {l}{!ok && <span style={{ marginLeft: 'auto', fontSize: 11, color: C.accent }}>fix →</span>}
            </div>
          ))}
          <div style={{ fontSize: 11.5, color: C.t4, marginTop: 8 }}>Decks generate regardless; unchecked items print as blanks or are skipped.</div>
        </Card>
        <Card C={C}>
          <Eyebrow C={C}>Gap Analysis outline</Eyebrow>
          <ol style={{ paddingLeft: 20, fontSize: 12.5, color: C.t2, lineHeight: 1.8 }}>{gapOutline.map((x) => <li key={x}>{x}</li>)}</ol>
        </Card>
      </Grid>
      <Card C={C} style={{ marginTop: 14 }}>
        <Eyebrow C={C}>History</Eyebrow>
        {!(f.presentations || []).length ? <div style={{ fontSize: 12.5, color: C.t4 }}>No decks generated yet.</div> : [...f.presentations].reverse().map((p) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: `1px solid ${C.border}`, fontSize: 12.5 }}>
            <Pill C={C}>{p.type}</Pill><span style={{ color: C.t1 }}>{p.filename}</span><span style={{ marginLeft: 'auto', color: C.t4 }}>{fmtDate(p.createdAt)}</span>
          </div>
        ))}
        <Note C={C} style={{ marginTop: 10 }}>Files download to your computer. Version history here records what was generated and when; re-generate any time after editing.</Note>
      </Card>
    </div>
  )
}
