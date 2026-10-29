import { useState } from 'react'
import { useStore, useFamily } from '../lib/store'
import { CASE_STUDIES } from '../data/caseStudies'
import { gapFee, blueprintMonthly, blendedAumRate, DEFAULT_FEE_SCHEDULE } from '../lib/fees'
import { buildAssessment, assessmentVariant } from '../lib/pptx'
import { Card, Eyebrow, Title, Btn, Input, Field, Grid, Row, Note, Pill, Check, Select, SectionLabel, SubTabs } from '../components/ui'
import { fmtUsd, num, download, nowIso, uid } from '../lib/util'
import { netWorthOf } from './Families'
import { familyFlags } from '../lib/flags'
import PerformanceEditor from '../components/PerformanceEditor'
import NumbersCalculator from '../components/NumbersCalculator'

const SLIDES_U5 = [
  ['matthew25', 'Matthew 25 parable (2 slides)'], ['income', 'Income · Clarity · Protection'], ['inspiration', 'Inspiration partners'],
  ['values', 'Values screening'], ['convictions', 'Conviction-based decisions (logos)'], ['pies', 'Ownership allocation pies'],
  ['audit', 'Performance audit (current vs potential)'], ['fees', 'Our Fees'],
]

// Shrink an uploaded logo to a small PNG data URL so the family record stays light.
async function logoToData(file, maxW = 420) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
    const k = Math.min(1, maxW / img.naturalWidth), c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k)
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/png')
  } finally { URL.revokeObjectURL(url) }
}

export default function Assessment({ C, isDesktop, setTab }) {
  const { settings, updateSettings } = useStore()
  const [f, patch] = useFamily()
  const [busy, setBusy] = useState(false)
  const [sub, setSub] = useState('cover')
  const a = f.assessment || {}
  const set = (k, v) => patch({ assessment: { ...a, [k]: v } })
  const setMany = (o) => patch({ assessment: { ...a, ...o } })
  const variant = assessmentVariant(f)
  const under = variant === 'under5'
  const fs = settings.feeSchedule || DEFAULT_FEE_SCHEDULE
  const nw = netWorthOf(f)
  const tax = settings.tax?.[new Date().getFullYear()] || Object.values(settings.tax || {})[0]
  const flags = new Set(familyFlags(f, tax))
  const suggested = CASE_STUDIES.filter((cs) => cs.tags.some((t) => flags.has(t) || (t === 'business_owner' && f.business?.owner) || (t === 'young_children' && flags.has('minor_children')))).map((cs) => cs.id)
  const total = num(a.portfolioTotal)
  const split = num(a.dividendPct) + num(a.growthPct) + num(a.bondsPct) + num(a.cashPct)
  const gapFeeCalc = gapFee(nw, fs)
  const aum = num(a.feeAum) || total
  const slideOn = (k) => a.slides?.[k] !== false
  const goalsMet = (f.goals || []).filter((g) => g.status === 'met').length, goalsMissed = (f.goals || []).filter((g) => g.status === 'missed').length
  const goalsCost = (f.goals || []).reduce((t, g) => t + (g.status === 'missed' ? num(g.cost?.amount) : 0), 0)
  const setSlide = (k, v) => set('slides', { ...(a.slides || {}), [k]: v })
  const values = a.values || { funds: 10, categories: [] }
  const convictions = a.convictions || []
  const setConv = (i, p) => set('convictions', convictions.map((c, k) => (k === i ? { ...c, ...p } : c)))

  const generate = async () => {
    setBusy(true)
    try {
      const blob = await buildAssessment(f, settings)
      const filename = `${f.name.replace(/[^A-Za-z0-9]+/g, '-')}-Family-Capital-Assessment-${under ? 'Under-5M' : 'Over-5M'}-${(a.date || '').replace(/-/g, '')}.pptx`
      download(blob, filename)
      patch({ presentations: [...(f.presentations || []), { id: uid(), type: 'assessment', filename, createdAt: nowIso(), tier: f.tier, variant }] })
    } catch (e) { alert(`Deck failed: ${e.message}`); console.error(e) }
    setBusy(false)
  }

  const money = (label, key, ph, hint) => <Field C={C} label={label} hint={hint}><Input C={C} value={a[key]} onChange={(v) => set(key, v)} placeholder={ph} /></Field>
  const tabs = [{ id: 'cover', label: 'Cover & income' }, { id: 'numbers', label: 'What the numbers reveal' }, { id: 'owner', label: 'Think like an owner' }, { id: 'portfolio', label: 'Portfolio & cash' }, { id: 'performance', label: 'Performance & risk' }, { id: 'quarterly', label: 'Quarterly returns' }, { id: 'close', label: 'Gap summary, fees & close' }]

  return (
    <div>
      <Title C={C} isDesktop={isDesktop} sub="Everything the assessment conversation produces. Fixed slides fill themselves. Switch deck type any time; the fields below adapt." right={<Btn C={C} primary disabled={busy} onClick={generate}>{busy ? 'Building…' : `Generate ${under ? 'Under-$5M' : '$5M+'} deck (.pptx)`}</Btn>}>Assessment · {f.name}</Title>

      <Card C={C} style={{ marginBottom: 14 }}>
        <Row gap={14}>
          <div style={{ minWidth: 220 }}>
            <Eyebrow C={C}>Deck type</Eyebrow>
            <Row gap={6}>
              <Btn C={C} small primary={!under} onClick={() => set('variant', 'over5')}>$5M and above</Btn>
              <Btn C={C} small primary={under} onClick={() => set('variant', 'under5')}>Under $5M</Btn>
            </Row>
          </div>
          <div style={{ fontSize: 12.5, color: C.t3, lineHeight: 1.6, flex: 1, minWidth: 240 }}>
            {under ? '32 slides: parable, owner’s lens, values screening, conviction logos, pies, performance audit and fees are included. Switch off any optional slide in the checklist.' : '28 slides: the standard $5M+ Assessment with the Gap Analysis next step, gap summary and Blueprint scope.'}
            {' '}Net worth {fmtUsd(nw, { compact: true })}{f.tier === 'under5' && !under ? ' · this family is flagged under $5M but is set to the $5M+ deck' : ''}.
          </div>
        </Row>
      </Card>

      <SubTabs C={C} value={sub} onChange={setSub} tabs={tabs} />

      {sub === 'cover' && (
        <Grid cols={isDesktop ? 2 : 1} gap={14}>
          <Card C={C}>
            <Eyebrow C={C}>Cover</Eyebrow>
            <Grid cols={2} gap={10}>
              <Field C={C} label="Presentation date" hint={under ? '' : 'Prints as "Presented | March 3rd, 2026"'}><Input C={C} type="date" value={a.date} onChange={(v) => set('date', v)} /></Field>
              <Field C={C} label="Cover name line" hint='Prints under the title. Blank = spouse names. e.g. "Mr. and Mrs. Abrams"'><Input C={C} value={a.coverName} onChange={(v) => set('coverName', v)} placeholder="Mr. and Mrs. ______" /></Field>
              <Field C={C} label="Family short name" hint='Used in "NAME Family Capital Assessment" titles'><Input C={C} value={a.familyShort} onChange={(v) => set('familyShort', v)} placeholder={(f.name || '').replace(/^The /, '').replace(/ Family$/, '')} /></Field>
            </Grid>
          </Card>
          {under && (
            <Card C={C}>
              <Eyebrow C={C}>Income · Clarity · Protection</Eyebrow>
              <Grid cols={3} gap={10}>
                <Field C={C} label="Income" hint="Printed as $ per year or per month"><Input C={C} value={a.incomeAmount} onChange={(v) => set('incomeAmount', v)} placeholder="36000" /></Field>
                <Field C={C} label="Income unit"><Select C={C} value={a.incomeUnit || 'per year'} onChange={(v) => set('incomeUnit', v)} options={['per year', '/ mo']} style={{ width: '100%' }} /></Field>
                <Field C={C} label="Net worth (Clarity)"><Input C={C} value={a.clarityNetWorth} onChange={(v) => set('clarityNetWorth', v)} placeholder={String(nw || '')} /></Field>
                <Field C={C} label="Protection"><Input C={C} value={a.protectionPct} onChange={(v) => set('protectionPct', v)} placeholder="100%" /></Field>
              </Grid>
            </Card>
          )}
        </Grid>
      )}

      {sub === 'portfolio' && (
        <Grid cols={isDesktop ? 2 : 1} gap={14}>
          <Card C={C}>
            <Eyebrow C={C}>Proposed ownership</Eyebrow>
            <Grid cols={isDesktop ? 3 : 2} gap={10}>
              {money('Portfolio total $', 'portfolioTotal', '730253')}
              {money('Dividends %', 'dividendPct', '55.6')}
              {money('Growth %', 'growthPct', '23.8')}
              {money('Bonds %', 'bondsPct', '19.5')}
              {money('Cash %', 'cashPct', '1.1')}
              {under && money('Other %', 'otherPct', '0', 'Pie chart only')}
            </Grid>
            <Row gap={8} style={{ marginTop: 10 }}>
              <Pill C={C} color={Math.abs(split - 100) < 0.5 ? C.up : C.dn}>Split totals {split.toFixed(1)}%</Pill>
              {total > 0 && <><Pill C={C}>Dividends {fmtUsd(total * num(a.dividendPct) / 100)}</Pill><Pill C={C}>Growth {fmtUsd(total * num(a.growthPct) / 100)}</Pill>{num(a.bondsPct) > 0 && <Pill C={C}>Bonds {fmtUsd(total * num(a.bondsPct) / 100)}</Pill>}<Pill C={C}>Cash {fmtUsd(total * num(a.cashPct) / 100)}</Pill></>}
            </Row>
            <div style={{ fontSize: 11.5, color: C.t4, marginTop: 8 }}>Planner judgement based on the family's financial goals and the 5-year cash need. A bonds row appears on the slide only when Bonds % is above zero.</div>
          </Card>
          <Card C={C}>
            <Eyebrow C={C}>5-year cash needs</Eyebrow>
            <Grid cols={3} gap={10}>
              <Field C={C} label="Retirement cash need (yr 1)" hint='Blank prints "N/A"'><Input C={C} value={a.retirementCashNeed} onChange={(v) => set('retirementCashNeed', v)} placeholder="125000" /></Field>
              <Field C={C} label="Cash on hand (yr 1)"><Input C={C} value={a.cashOnHand} onChange={(v) => set('cashOnHand', v)} placeholder="7668" /></Field>
              <Field C={C} label="Growth % / yr"><Input C={C} value={a.cashGrowthPct} onChange={(v) => set('cashGrowthPct', v)} placeholder="0" /></Field>
            </Grid>
            <SectionLabel C={C}>Years 2 to 5, typed in</SectionLabel>
            <Grid cols={4} gap={10}>
              {[2, 3, 4, 5].map((y) => <Field key={y} C={C} label={`Year ${y} $`}><Input C={C} value={a[`cashYear${y}`]} onChange={(v) => set(`cashYear${y}`, v)} placeholder={a.retirementCashNeed ? String(Math.round(num(a.retirementCashNeed) * Math.pow(1 + num(a.cashGrowthPct) / 100, y - 1))) : ''} /></Field>)}
            </Grid>
            <div style={{ fontSize: 11.5, color: C.t4, marginTop: 8 }}>Type each year's cash need to print exactly what you enter, for example 129000 prints as $129K. Leave a year blank to use the retirement need grown by the Growth % above. With no retirement need entered, the income figure is used.</div>
          </Card>
          {(
            <Card C={C}>
              <Eyebrow C={C}>Ownership pies · current portfolio</Eyebrow>
              {under && <Check C={C} checked={slideOn('pies')} onChange={(v) => setSlide('pies', v)} label="Include the Ownership Allocation slide" />}
              <Grid cols={4} gap={10} style={{ marginTop: 10 }}>
                {['stocks', 'bonds', 'cash', 'other'].map((k) => <Field key={k} C={C} label={`${k} %`}><Input C={C} value={a.currentAlloc?.[k]} onChange={(v) => set('currentAlloc', { ...(a.currentAlloc || {}), [k]: v })} placeholder="0" /></Field>)}
              </Grid>
              <div style={{ fontSize: 11.5, color: C.t4, marginTop: 8 }}>Potential portfolio comes from the ownership percentages on the left (dividends + growth = stocks). Leave the current split empty to skip the slide.</div>
            </Card>
          )}
        </Grid>
      )}

      {sub === 'performance' && (
        <Grid cols={isDesktop ? 2 : 1} gap={14}>
          <Card C={C}>
            <Eyebrow C={C}>Proposed performance</Eyebrow>
            <div style={{ fontSize: 11.5, color: C.t4, marginBottom: 8 }}>Planner-entered figures (no Riskalyze licence).</div>
            <Grid cols={3} gap={10}>
              {money('Total potential return %', 'potentialReturn', '9.91')}
              {money('Potential annual return %', 'annualReturn', '7.68')}
              {money('Annual dividend yield %', 'dividendYield', '2.23')}
            </Grid>
            {<><SectionLabel C={C}>Current portfolio (Performance Audit slide)</SectionLabel>
              <Grid cols={3} gap={10}>
                {money('Current annual return %', 'curAnnualReturn', '3.32')}
                {money('Current dividend yield %', 'curDividendYield', '1.84')}
                {money('Current total return %', 'curTotalReturn', '5.16')}
              </Grid>
              {under && <Check C={C} checked={slideOn('audit')} onChange={(v) => setSlide('audit', v)} label="Include the Performance Audit slide" />}</>}
          </Card>
          <Card C={C}>
            <Eyebrow C={C}>Lifeboat Drill (95% range, 6 months)</Eyebrow>
            <Grid cols={2} gap={10}>
              {money('Potential gain %', 'gainPct', '23.61')}{money('Potential gain $', 'gainAmt', '172442')}
              {money('Potential loss %', 'lossPct', '13.94')}{money('Potential loss $', 'lossAmt', '101783')}
            </Grid>
          </Card>
        </Grid>
      )}

      {sub === 'owner' && (
        <Grid cols={isDesktop ? 2 : 1} gap={14}>
          <Card C={C}>
            <Eyebrow C={C}>Owner's lens scorecard (out of 10)</Eyebrow>
            <div style={{ fontSize: 11.5, color: C.t4, marginBottom: 8 }}>Type a score in each box. The gold bar under it fills to that score on the slide. A blank box prints a dash and an empty bar.</div>
            {under ? (
              <Field C={C} label="Layout"><Select C={C} value={a.lensMode || 'compare'} onChange={(v) => set('lensMode', v)} options={[{ value: 'compare', label: 'Current vs proposed (one slide)' }, { value: 'single', label: 'Proposed only (one slide)' }, { value: 'both', label: 'Both slides' }]} style={{ width: '100%' }} /></Field>
            ) : (<>
              <SectionLabel C={C}>Slide 9 · An Owner's Lens (three boxes)</SectionLabel>
              <Grid cols={3} gap={10}>{['innovation', 'inspiration', 'infrastructure'].map((k) => <Field key={k} C={C} label={k}><Input C={C} value={a.scorecardOverview?.[k]} onChange={(v) => set('scorecardOverview', { ...(a.scorecardOverview || {}), [k]: v })} placeholder="6.2" /></Field>)}</Grid>
              <div style={{ fontSize: 11.5, color: C.t4, marginTop: 6 }}>If left empty this slide uses the proposed scores below.</div>
            </>)}
            <SectionLabel C={C}>{under ? 'Current portfolio' : 'Slide 10 · Current portfolio'}</SectionLabel>
            <Grid cols={3} gap={10}>{['innovation', 'inspiration', 'infrastructure'].map((k) => <Field key={k} C={C} label={k}><Input C={C} value={a.scorecardCurrent?.[k]} onChange={(v) => set('scorecardCurrent', { ...(a.scorecardCurrent || {}), [k]: v })} placeholder="7.9" /></Field>)}</Grid>
            <SectionLabel C={C}>{under ? 'Proposed holdings' : 'Slide 10 · Proposed holdings'}</SectionLabel>
            <Grid cols={3} gap={10}>{['innovation', 'inspiration', 'infrastructure'].map((k) => <Field key={k} C={C} label={k}><Input C={C} value={a.scorecard?.[k]} onChange={(v) => set('scorecard', { ...(a.scorecard || {}), [k]: v })} placeholder="8.8" /></Field>)}</Grid>
          </Card>
          {under && <Card C={C}>
            <Eyebrow C={C}>Optional slides</Eyebrow>
            <Grid cols={1} gap={6}>{SLIDES_U5.map(([k, l]) => <Check key={k} C={C} checked={slideOn(k)} onChange={(v) => setSlide(k, v)} label={l} />)}</Grid>
          </Card>}
          {under && <Card C={C}>
            <Eyebrow C={C}>Values screening</Eyebrow>
            <Row gap={10}><Field C={C} label="Funds screened"><Input C={C} value={values.funds} onChange={(v) => set('values', { ...values, funds: v })} placeholder="10" /></Field><Field C={C} label="Funds with any exposure"><Input C={C} value={values.flagged} onChange={(v) => set('values', { ...values, flagged: v })} placeholder="2" /></Field></Row>
            {(values.categories || []).map((c, i) => (
              <Row key={i} gap={8} style={{ marginTop: 8 }}>
                <Input C={C} value={c.name} onChange={(v) => set('values', { ...values, categories: values.categories.map((x, k) => (k === i ? { ...x, name: v } : x)) })} placeholder="Category (e.g. Abortion Activism)" style={{ flex: 1 }} />
                <Input C={C} value={c.count} onChange={(v) => set('values', { ...values, categories: values.categories.map((x, k) => (k === i ? { ...x, count: v } : x)) })} placeholder="# funds" style={{ width: 90 }} />
                <Btn C={C} small ghost onClick={() => set('values', { ...values, categories: values.categories.filter((_, k) => k !== i) })}>×</Btn>
              </Row>
            ))}
            <Btn C={C} small style={{ marginTop: 10 }} onClick={() => set('values', { ...values, categories: [...(values.categories || []), { name: '', count: '' }] })}>+ Category</Btn>
            <div style={{ fontSize: 11.5, color: C.t4, marginTop: 8 }}>From the Paradiem Values Screening Report. Leave empty to skip the slide.</div>
          </Card>}
          {under && <Card C={C}>
            <Eyebrow C={C}>Conviction-based decisions (up to 4 companies)</Eyebrow>
            {convictions.map((c, i) => (
              <Row key={i} gap={8} style={{ marginTop: i ? 8 : 0 }}>
                <Input C={C} value={c.name} onChange={(v) => setConv(i, { name: v })} placeholder="Company" style={{ flex: 1 }} />
                <Select C={C} value={c.action || 'buy'} onChange={(v) => setConv(i, { action: v })} options={[{ value: 'buy', label: 'Buy (green)' }, { value: 'sell', label: 'Sell (red)' }]} />
                <label style={{ fontSize: 12, fontWeight: 700, color: C.t2, cursor: 'pointer', padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 10, whiteSpace: 'nowrap' }}>{c.logo ? 'Logo ✓' : 'Logo…'}<input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => { const file = e.target.files?.[0]; if (file) setConv(i, { logo: await logoToData(file) }) }} /></label>
                <Btn C={C} small ghost onClick={() => set('convictions', convictions.filter((_, k) => k !== i))}>×</Btn>
              </Row>
            ))}
            {convictions.length < 4 && <Btn C={C} small style={{ marginTop: 10 }} onClick={() => set('convictions', [...convictions, { name: '', action: 'buy' }])}>+ Company</Btn>}
          </Card>}
        </Grid>
      )}

      {sub === 'numbers' && <NumbersCalculator C={C} f={f} patch={patch} settings={settings} isDesktop={isDesktop} variant={variant} />}

      {sub === 'quarterly' && <PerformanceEditor C={C} settings={settings} updateSettings={updateSettings} />}

      {sub === 'close' && (
        <Grid cols={isDesktop ? 2 : 1} gap={14}>
          {!under && (
            <Card C={C}>
              <Eyebrow C={C}>Gap Analysis of Your Current Goals slide</Eyebrow>
              <div style={{ fontSize: 11.5, color: C.t4, marginBottom: 8 }}>Counts come from the goals marked Met / Missed in the Gap Analysis tab ({goalsMet} met, {goalsMissed} missed, {fmtUsd(goalsCost)} cost of inaction). Type a number below to override any figure. The circle re-colors to match.</div>
              <Grid cols={2} gap={10}>
                <Field C={C} label="Goals met"><Input C={C} value={a.gapMet} onChange={(v) => set('gapMet', v)} placeholder={String(goalsMet)} /></Field>
                <Field C={C} label="Goals missed"><Input C={C} value={a.gapMissed} onChange={(v) => set('gapMissed', v)} placeholder={String(goalsMissed)} /></Field>
                <Field C={C} label="Total goals" hint="Blank = met + missed"><Input C={C} value={a.gapTotal} onChange={(v) => set('gapTotal', v)} placeholder={String(goalsMet + goalsMissed || (f.goals || []).length)} /></Field>
                <Field C={C} label="Total cost of inaction $"><Input C={C} value={a.gapCost} onChange={(v) => set('gapCost', v)} placeholder={String(goalsCost)} /></Field>
              </Grid>
            </Card>
          )}
          <Card C={C}>
            <Eyebrow C={C}>Next step slide</Eyebrow>
            {under && <Field C={C} label="Wording" hint="A: 100-Year Vision framing. B: Dependable income framing."><Select C={C} value={a.nextStepVariant || 'B'} onChange={(v) => set('nextStepVariant', v)} options={[{ value: 'B', label: 'B — Dependable income & protection' }, { value: 'A', label: 'A — 100-Year Vision' }]} style={{ width: '100%' }} /></Field>}
            <Row gap={16} style={{ marginTop: under ? 10 : 0 }}>
              <div style={{ fontSize: 13, color: C.t2 }}>Calculated Gap Analysis fee <b>{fmtUsd(gapFeeCalc)}</b></div>
              <div style={{ fontSize: 13, color: C.t2 }}>Blueprint <b>{fmtUsd(blueprintMonthly(nw, 1, fs))}/mo</b> year one</div>
            </Row>
            <div style={{ marginTop: 10 }}><Field C={C} label="Fee override $" hint="Leave blank to use the calculated fee. The reference deck for under-$5M families shows a flat engagement amount."><Input C={C} value={a.gapFeeOverride} onChange={(v) => set('gapFeeOverride', v)} placeholder={String(gapFeeCalc)} /></Field></div>
            <div style={{ fontSize: 11.5, color: C.t4, marginTop: 6 }}>{fs.gapAnalysis.bps} bps of net worth, {fmtUsd(fs.gapAnalysis.min)}–{fmtUsd(fs.gapAnalysis.max)}. {fs.note}</div>
          </Card>
          {under && (
            <Card C={C}>
              <Eyebrow C={C}>Our Fees slide</Eyebrow>
              <Check C={C} checked={slideOn('fees')} onChange={(v) => setSlide('fees', v)} label="Include the Our Fees slide" />
              <Field C={C} label="Assets under management $" hint="Blank uses the portfolio total"><Input C={C} value={a.feeAum} onChange={(v) => set('feeAum', v)} placeholder={String(total || '')} /></Field>
              <div style={{ fontSize: 13, color: C.t2, marginTop: 10 }}>Advisory <b>{aum ? blendedAumRate(aum, fs).toFixed(2) : '—'}%</b> + expense ratio <b>{(fs.expenseRatio ?? 0.05).toFixed(2)}%</b> = <b>{aum ? (blendedAumRate(aum, fs) + (fs.expenseRatio ?? 0.05)).toFixed(2) : '—'}%</b></div>
              <div style={{ fontSize: 11.5, color: C.t4, marginTop: 6 }}>Tier rates come from the fee schedule in Settings.</div>
            </Card>
          )}
          <Card C={C}>
            <Eyebrow C={C}>Case studies</Eyebrow>
            <Row gap={8} style={{ marginBottom: 8 }}><div style={{ fontSize: 11.5, color: C.t4 }}>Suggested from the family's flags. You pick.</div><Btn C={C} small ghost onClick={() => set('caseStudies', CASE_STUDIES.map((c) => c.id))}>Select all</Btn><Btn C={C} small ghost onClick={() => set('caseStudies', [])}>None</Btn></Row>
            {CASE_STUDIES.map((cs) => (
              <div key={cs.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: `1px solid ${C.border}` }}>
                <Check C={C} checked={(a.caseStudies || []).includes(cs.id)} onChange={(v) => set('caseStudies', v ? [...(a.caseStudies || []), cs.id] : (a.caseStudies || []).filter((x) => x !== cs.id))} label={cs.family} />
                <span style={{ fontSize: 11, color: C.t4 }}>{cs.archetype}</span>
                {suggested.includes(cs.id) && <Pill C={C} color={C.up}>suggested</Pill>}
              </div>
            ))}
            {under && <div style={{ fontSize: 11.5, color: C.t4, marginTop: 8 }}>The under-$5M reference deck does not include case studies, so they are skipped for that deck type.</div>}
          </Card>
          <Note C={C}>Fixed slides (disclosures, framework, two kinds of return, process, firm averages, philosophy, principles, buy-option strategy, team) and the quarterly performance tables come from Settings. Fonts in the file are Georgia and Calibri.</Note>
        </Grid>
      )}
    </div>
  )
}
