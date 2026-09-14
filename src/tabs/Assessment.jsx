import { useState } from 'react'
import { useStore, useFamily } from '../lib/store'
import { CASE_STUDIES } from '../data/caseStudies'
import { gapFee, blueprintMonthly, DEFAULT_FEE_SCHEDULE } from '../lib/fees'
import { buildAssessment } from '../lib/pptx'
import { Card, Eyebrow, Title, Btn, Input, Field, Grid, Row, Note, Pill, Check, Select, SectionLabel } from '../components/ui'
import { fmtUsd, num, download, nowIso, uid } from '../lib/util'
import { netWorthOf } from './Families'
import { familyFlags } from '../lib/flags'

export default function Assessment({ C, isDesktop, setTab }) {
  const { settings } = useStore()
  const [f, patch] = useFamily()
  const [busy, setBusy] = useState(false)
  const a = f.assessment || {}
  const set = (k, v) => patch({ assessment: { ...a, [k]: v } })
  const under = f.tier === 'under5'
  const fs = settings.feeSchedule || DEFAULT_FEE_SCHEDULE
  const nw = netWorthOf(f)
  const tax = settings.tax?.[new Date().getFullYear()] || Object.values(settings.tax || {})[0]
  const flags = new Set(familyFlags(f, tax))
  const suggested = CASE_STUDIES.filter((cs) => cs.tags.some((t) => flags.has(t) || (t === 'business_owner' && f.business?.owner) || (t === 'business_sale_pending' && flags.has('business_sale_pending')) || (t === 'real_estate' && flags.has('real_estate')) || (t === 'young_children' && flags.has('minor_children')) || (t === 'children_in_business' && flags.has('children_in_business')) || (t === 'charitable_intent' && flags.has('charitable_intent')))).map((cs) => cs.id)
  const total = num(a.portfolioTotal)
  const split = num(a.dividendPct) + num(a.growthPct) + num(a.cashPct)

  const generate = async () => {
    setBusy(true)
    try {
      const blob = await buildAssessment(f, settings)
      const filename = `${f.name.replace(/[^A-Za-z0-9]+/g, '-')}-Family-Capital-Assessment-${(a.date || '').replace(/-/g, '')}.pptx`
      download(blob, filename)
      patch({ presentations: [...(f.presentations || []), { id: uid(), type: 'assessment', filename, createdAt: nowIso(), tier: f.tier }] })
    } catch (e) { alert(`Deck failed: ${e.message}`) }
    setBusy(false)
  }

  return (
    <div>
      <Title C={C} isDesktop={isDesktop} sub={`${under ? 'Under-$5M' : '$5M+'} version. Everything on this page comes out of the assessment conversation. Fixed slides fill themselves.`} right={<Btn C={C} primary disabled={busy} onClick={generate}>{busy ? 'Building…' : 'Generate Assessment deck (.pptx)'}</Btn>}>Assessment · {f.name}</Title>
      <Grid cols={isDesktop ? 2 : 1} gap={14}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card C={C}>
            <Eyebrow C={C}>Cover & tier</Eyebrow>
            <Grid cols={2} gap={10}>
              <Field C={C} label="Presentation date"><Input C={C} type="date" value={a.date} onChange={(v) => set('date', v)} /></Field>
              <Field C={C} label="Tier (change in Families)"><div style={{ padding: '10px 12px', borderRadius: 10, background: C.surface, border: `1px solid ${C.border}`, fontSize: 13, color: C.t2 }}>{under ? 'Under $5M net worth' : '$5M+ net worth'} · {fmtUsd(nw, { compact: true })}</div></Field>
            </Grid>
            {under && (
              <Grid cols={2} gap={10} style={{ marginTop: 10 }}>
                <Field C={C} label='"What the Numbers Reveal" slide' hint="Under-5M decks carry the firm-averages slide; optionally add the Income / Clarity / Protection version too."><Select C={C} value={a.numbersSlide || 'firm'} onChange={(v) => set('numbersSlide', v)} options={[{ value: 'firm', label: 'Firm averages only' }, { value: 'both', label: 'Firm averages + Income / Clarity / Protection' }]} style={{ width: '100%' }} /></Field>
                <Field C={C} label="Next Step slide" hint="A: 100-Year Vision framing. B: Dependable income framing."><Select C={C} value={a.nextStepVariant || 'A'} onChange={(v) => set('nextStepVariant', v)} options={[{ value: 'A', label: 'A — 100-Year Vision' }, { value: 'B', label: 'B — Dependable income & protection' }]} style={{ width: '100%' }} /></Field>
              </Grid>
            )}
          </Card>
          {under && (
            <Card C={C}>
              <Eyebrow C={C}>Income · Clarity · Protection</Eyebrow>
              <Grid cols={3} gap={10}>
                <Field C={C} label="Income / month"><Input C={C} value={a.incomeMonthly} onChange={(v) => set('incomeMonthly', v)} placeholder="1750" /></Field>
                <Field C={C} label="Net worth (Clarity)"><Input C={C} value={a.clarityNetWorth} onChange={(v) => set('clarityNetWorth', v)} placeholder={String(nw || '')} /></Field>
                <Field C={C} label="Protection"><Input C={C} value={a.protectionPct} onChange={(v) => set('protectionPct', v)} placeholder="100%" /></Field>
              </Grid>
            </Card>
          )}
          <Card C={C}>
            <Eyebrow C={C}>Proposed ownership</Eyebrow>
            <Grid cols={4} gap={10}>
              <Field C={C} label="Portfolio total"><Input C={C} value={a.portfolioTotal} onChange={(v) => set('portfolioTotal', v)} placeholder="950000" /></Field>
              <Field C={C} label="Dividends %"><Input C={C} value={a.dividendPct} onChange={(v) => set('dividendPct', v)} /></Field>
              <Field C={C} label="Growth %"><Input C={C} value={a.growthPct} onChange={(v) => set('growthPct', v)} /></Field>
              <Field C={C} label="Cash %"><Input C={C} value={a.cashPct} onChange={(v) => set('cashPct', v)} /></Field>
            </Grid>
            <Row gap={8} style={{ marginTop: 10 }}>
              <Pill C={C} color={Math.abs(split - 100) < 0.01 ? C.up : C.dn}>Split totals {split.toFixed(1)}%</Pill>
              {total > 0 && <><Pill C={C}>Dividends {fmtUsd(total * num(a.dividendPct) / 100)}</Pill><Pill C={C}>Growth {fmtUsd(total * num(a.growthPct) / 100)}</Pill><Pill C={C}>Cash {fmtUsd(total * num(a.cashPct) / 100)}</Pill></>}
            </Row>
            <div style={{ fontSize: 11.5, color: C.t4, marginTop: 8 }}>Planner judgement based on the family's financial goals and the 5-year cash need.</div>
          </Card>
          <Card C={C}>
            <Eyebrow C={C}>5-year cash needs</Eyebrow>
            <Grid cols={3} gap={10}>
              <Field C={C} label="Retirement cash need (yr 1)"><Input C={C} value={a.retirementCashNeed} onChange={(v) => set('retirementCashNeed', v)} placeholder="125000" /></Field>
              <Field C={C} label="Cash on hand (yr 1)"><Input C={C} value={a.cashOnHand} onChange={(v) => set('cashOnHand', v)} placeholder="125000" /></Field>
              <Field C={C} label="Growth % / yr"><Input C={C} value={a.cashGrowthPct} onChange={(v) => set('cashGrowthPct', v)} placeholder="3" /></Field>
            </Grid>
          </Card>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card C={C}>
            <Eyebrow C={C}>Proposed performance & Lifeboat Drill</Eyebrow>
            <div style={{ fontSize: 11.5, color: C.t4, marginBottom: 8 }}>Planner-entered figures (no Riskalyze licence).</div>
            <Grid cols={3} gap={10}>
              <Field C={C} label="Total potential return %"><Input C={C} value={a.potentialReturn} onChange={(v) => set('potentialReturn', v)} placeholder="10.93" /></Field>
              <Field C={C} label="Potential annual return %"><Input C={C} value={a.annualReturn} onChange={(v) => set('annualReturn', v)} placeholder="9.28" /></Field>
              <Field C={C} label="Annual dividend yield %"><Input C={C} value={a.dividendYield} onChange={(v) => set('dividendYield', v)} placeholder="1.65" /></Field>
              <Field C={C} label="6-mo potential gain %"><Input C={C} value={a.gainPct} onChange={(v) => set('gainPct', v)} placeholder="27.90" /></Field>
              <Field C={C} label="Potential gain $"><Input C={C} value={a.gainAmt} onChange={(v) => set('gainAmt', v)} placeholder="265000" /></Field>
              <div />
              <Field C={C} label="6-mo potential loss %"><Input C={C} value={a.lossPct} onChange={(v) => set('lossPct', v)} placeholder="17.25" /></Field>
              <Field C={C} label="Potential loss $"><Input C={C} value={a.lossAmt} onChange={(v) => set('lossAmt', v)} placeholder="163000" /></Field>
            </Grid>
            <SectionLabel C={C}>Owner's lens scorecard (out of 10)</SectionLabel>
            <Grid cols={3} gap={10}>
              {['innovation', 'inspiration', 'infrastructure'].map((k) => <Field key={k} C={C} label={k}><Input C={C} value={a.scorecard?.[k]} onChange={(v) => set('scorecard', { ...(a.scorecard || {}), [k]: v })} placeholder="8.6" /></Field>)}
            </Grid>
          </Card>
          <Card C={C}>
            <Eyebrow C={C}>Case studies</Eyebrow>
            <div style={{ fontSize: 11.5, color: C.t4, marginBottom: 8 }}>Suggested from the family's flags. You pick.</div>
            {CASE_STUDIES.map((cs) => (
              <div key={cs.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: `1px solid ${C.border}` }}>
                <Check C={C} checked={(a.caseStudies || []).includes(cs.id)} onChange={(v) => set('caseStudies', v ? [...(a.caseStudies || []), cs.id] : (a.caseStudies || []).filter((x) => x !== cs.id))} label={cs.family} />
                <span style={{ fontSize: 11, color: C.t4 }}>{cs.archetype}</span>
                {suggested.includes(cs.id) && <Pill C={C} color={C.up}>suggested</Pill>}
              </div>
            ))}
          </Card>
          <Card C={C}>
            <Eyebrow C={C}>Fees printed on the deck</Eyebrow>
            <Row gap={16}>
              <div style={{ fontSize: 13, color: C.t2 }}>Gap Analysis <b>{fmtUsd(gapFee(nw, fs))}</b></div>
              <div style={{ fontSize: 13, color: C.t2 }}>Blueprint <b>{fmtUsd(blueprintMonthly(nw, 1, fs))}/mo</b> year one</div>
            </Row>
            <div style={{ fontSize: 11.5, color: C.t4, marginTop: 6 }}>{fs.gapAnalysis.bps} bps of net worth, {fmtUsd(fs.gapAnalysis.min)}–{fmtUsd(fs.gapAnalysis.max)}. {fs.note}</div>
          </Card>
          <Note C={C}>Fixed slides (disclosures, framework, two kinds of return, process, firm averages, philosophy, principles, buy-option strategy, blueprint scope, team) and the quarterly performance tables come from Settings. Fonts in the file are Georgia and Calibri so it opens correctly anywhere.</Note>
        </div>
      </Grid>
    </div>
  )
}
