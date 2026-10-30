// Editor for the "Family Capital Gap Analysis+" deck (under-$5M clients). Every value the deck prints is entered here or comes
// from another tab: goals from the Goals and Intentions document, tables from the Cashflow engine, portfolio figures shared with
// the Assessment. Slides with nothing to say are left out.
import { useMemo, useRef, useState } from 'react'
import { useStore, useFamily } from '../lib/store'
import { Card, Eyebrow, Title, Btn, Grid, Row, Note, Pill, Check, Field, Input, Select, TextArea, SubTabs, SectionLabel } from '../components/ui'
import GoalsImport, { newGoal } from '../components/GoalsImport'
import { PLUS_SLIDES, gapPlusOf, planFor, cashNeedsFromPlan, planGap, emptyInvest } from '../lib/gapPlus'
import { buildGapPlus, gapPlusOutline } from '../lib/gapPlusDeck'
import { newExpense, newIncome, newScenario } from '../cashflow/types'
import { fmtUsd, num, download, nowIso, uid } from '../lib/util'
import { canEdit, denyEdit } from '../lib/permissions'

const lines = (v) => String(v || '').split('\n').map((s) => s.replace(/^[\s•▪■\-*]+/, ''))
const joined = (arr) => (arr || []).join('\n')

async function imageToData(file, maxW = 1700) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
    const k = Math.min(1, maxW / img.naturalWidth), c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k)
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/png')
  } finally { URL.revokeObjectURL(url) }
}

function PictureField({ C, label, value, onChange, hint }) {
  const ref = useRef(null)
  return (
    <Field C={C} label={label} hint={hint}>
      <Row gap={8}>
        <Btn C={C} small onClick={() => ref.current?.click()}>{value ? 'Replace picture' : 'Upload picture'}</Btn>
        {value && <><img alt="" src={value} style={{ height: 36, borderRadius: 4, border: '1px solid rgba(128,128,128,0.3)' }} /><Btn C={C} small ghost onClick={() => onChange(null)}>Remove</Btn></>}
        <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => { const fl = e.target.files?.[0]; e.target.value = ''; if (fl) onChange(await imageToData(fl)) }} />
      </Row>
    </Field>
  )
}

/** Portfolio composition, 5-year cash needs, performance and lifeboat figures. `a` is f.assessment (shared) or the LTC set. */
function InvestFields({ C, a, set, plan, isDesktop }) {
  const money = (label, key, ph, hint) => <Field C={C} label={label} hint={hint}><Input C={C} value={a[key]} onChange={(v) => set(key, v)} placeholder={ph} /></Field>
  const split = num(a.dividendPct) + num(a.growthPct) + num(a.cashPct)
  const fromPlan = cashNeedsFromPlan(plan)
  return (
    <Grid cols={isDesktop ? 2 : 1} gap={14}>
      <Card C={C}>
        <Eyebrow C={C}>Portfolio and ownership</Eyebrow>
        <Grid cols={2} gap={10}>
          {money('Portfolio total ($)', 'portfolioTotal', '950000')}
          <div />
          {money('Dividend strategy %', 'dividendPct', '64.4')}{money('Growth strategy %', 'growthPct', '27.6')}{money('Cash %', 'cashPct', '8')}
        </Grid>
        {Math.abs(split - 100) > 0.05 && <Note C={C} tone="warn" style={{ marginTop: 8 }}>The three percentages add to {split.toFixed(1)}%. They should add to 100%.</Note>}
      </Card>
      <Card C={C}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Eyebrow C={C} style={{ marginBottom: 0 }}>5-year cash needs</Eyebrow>
          <Btn C={C} small disabled={!fromPlan} title={fromPlan ? '' : 'Needs a plan in the Cashflow tab'} onClick={() => Object.entries(fromPlan).forEach(([k, v]) => set(k, v))}>Fill from the Cashflow plan</Btn>
        </Row>
        <Grid cols={2} gap={10} style={{ marginTop: 8 }}>
          {money('Retirement cash need, year 1', 'retirementCashNeed', '25000', 'Blank prints N/A')}{money('Year 1 cash on hand', 'cashOnHand', '34000')}
          {[2, 3, 4, 5].map((y) => <Field key={y} C={C} label={`Year ${y} $`}><Input C={C} value={a[`cashYear${y}`]} onChange={(v) => set(`cashYear${y}`, v)} placeholder="blank = grown from year 1" /></Field>)}
          {money('Growth % per year (when a year is blank)', 'cashGrowthPct', '3')}
        </Grid>
        <div style={{ fontSize: 11.5, color: C.t4, marginTop: 6 }}>Blank cash-need boxes are filled from the Cashflow plan when one exists, otherwise grown from year 1.</div>
      </Card>
      <Card C={C}>
        <Eyebrow C={C}>Performance audit</Eyebrow>
        <SectionLabel C={C} style={{ marginTop: 0 }}>Current portfolio</SectionLabel>
        <Grid cols={3} gap={10}>{money('Annual return %', 'curAnnualReturn', '8.68')}{money('Dividend yield %', 'curDividendYield', '0.84')}{money('Total return %', 'curTotalReturn', '9.52')}</Grid>
        <SectionLabel C={C}>Potential (proposed) portfolio</SectionLabel>
        <Grid cols={3} gap={10}>{money('Annual return %', 'annualReturn', '10.23')}{money('Dividend yield %', 'dividendYield', '1.64')}{money('Total return %', 'potentialReturn', '11.87')}</Grid>
      </Card>
      <Card C={C}>
        <Eyebrow C={C}>Lifeboat drill (95% range, 6 months)</Eyebrow>
        <Grid cols={2} gap={10}>{money('Potential loss %', 'lossPct', '17.25')}{money('Potential loss $', 'lossAmt', '163000')}{money('Potential gain %', 'gainPct', '27.90')}{money('Potential gain $', 'gainAmt', '265000')}</Grid>
      </Card>
    </Grid>
  )
}

export default function GapPlus({ C, isDesktop, setTab, cf }) {
  const { settings } = useStore()
  const [f, patch] = useFamily()
  const gp = gapPlusOf(f)
  const [sub, setSub] = useState('slides')
  const [sel, setSel] = useState((f.goals || [])[0]?.id || null)
  const [busy, setBusy] = useState(false)
  const set = (p) => patch({ gapPlus: { ...gp, ...p } })
  const a = f.assessment || {}
  const setA = (k, v) => patch({ assessment: { ...(f.assessment || {}), [k]: v } })
  const setLtc = (p) => set({ ltc: { ...gp.ltc, ...p } })
  const setLtcInvest = (k, v) => setLtc({ invest: { ...gp.ltc.invest, [k]: v } })
  const model = cf.model
  const basePlan = useMemo(() => { try { return planFor(model, settings, gp.baseScenario) } catch { return null } }, [model, settings, gp.baseScenario])
  const ltcPlan = useMemo(() => { try { return gp.ltc.scenarioId ? planFor(model, settings, gp.ltc.scenarioId) : null } catch { return null } }, [model, settings, gp.ltc.scenarioId])
  const goals = (f.goals || [])
  const g = goals.find((x) => x.id === sel) || goals[0] || null
  const updGoal = (id, p) => patch({ goals: goals.map((x) => (x.id === id ? { ...x, ...p } : x)) })
  const outline = useMemo(() => gapPlusOutline(f, model, settings), [f, model, settings])
  const scenarioOptions = [{ value: 'base', label: 'Base Facts' }, ...model.scenarios.map((s) => ({ value: s.id, label: s.name }))]

  const generate = async () => {
    setBusy(true)
    try {
      const blob = await buildGapPlus(f, settings, { model })
      const filename = `${f.name.replace(/[^A-Za-z0-9]+/g, '-')}-Family-Capital-Gap-Analysis-Plus-${new Date().toISOString().slice(0, 10)}.pptx`
      download(blob, filename)
      patch({ presentations: [...(f.presentations || []), { id: uid(), type: 'gapPlus', filename, createdAt: nowIso(), tier: f.tier, goals: goals.length }] })
    } catch (e) { alert(`Deck failed: ${e.message}`); console.error(e) }
    setBusy(false)
  }

  // Builds (or refreshes) a Cashflow scenario named "LTC annuity": the premium leaves savings in year 1 and the annuity pays a yearly income.
  const makeScenario = () => {
    if (!canEdit()) { denyEdit(); return }
    const amount = num(gp.ltc.amount), income = num(gp.ltc.annualIncome)
    if (!amount) { alert('Enter the annuity amount first.'); return }
    const base = model.assumptions.baseYear
    const id = gp.ltc.scenarioId && model.scenarios.some((s) => s.id === gp.ltc.scenarioId) ? gp.ltc.scenarioId : newScenario('LTC annuity').id
    const overrides = { addExpenses: [newExpense({ name: 'LTC annuity premium', kind: 'other', annual: amount, oneTimeYear: base })], addIncome: income ? [newIncome({ name: 'LTC annuity income', kind: 'other', ownerId: 'joint', annual: income, startYear: base, endYear: null, growthPct: 0, taxable: true })] : [] }
    cf.save((m) => ({ ...m, scenarios: m.scenarios.some((s) => s.id === id) ? m.scenarios.map((s) => (s.id === id ? { ...s, overrides: { ...s.overrides, ...overrides } } : s)) : [...m.scenarios, { id, name: 'LTC annuity', notes: 'Created from the Gap Analysis+ deck editor.', overrides }] }), { source: 'gap analysis+ annuity scenario', note: `${fmtUsd(amount)} annuity` }, { immediate: true })
    setLtc({ scenarioId: id })
  }

  const topics = gp.analysis
  const setTopic = (id, p) => set({ analysis: topics.map((t) => (t.id === id ? { ...t, ...p } : t)) })
  const Lines = ({ label, value, onChange, placeholder, rows = 4 }) => <Field C={C} label={label}><TextArea C={C} rows={rows} value={joined(value)} onChange={(v) => onChange(lines(v))} placeholder={placeholder} /></Field>

  return (
    <div>
      <Title C={C} isDesktop={isDesktop} sub="For clients under $5M who are moving their investments. The deck follows the reference, slide for slide; fill the fields below and it populates." right={<Btn C={C} primary disabled={busy} onClick={generate}>{busy ? 'Building…' : 'Download .pptx'}</Btn>}>Family Capital Gap Analysis+ · {f.name}</Title>
      <SubTabs C={C} value={sub} onChange={setSub} tabs={[{ id: 'slides', label: 'Cover & slides' }, { id: 'goals', label: 'Goals' }, { id: 'plan', label: 'Plan analysis' }, { id: 'invest', label: 'Cash flow & investments' }, { id: 'ltc', label: 'LTC annuity' }]} />

      {sub === 'slides' && (
        <Grid cols={isDesktop ? 2 : 1} gap={14}>
          <Card C={C}>
            <Eyebrow C={C}>Cover</Eyebrow>
            <Grid cols={2} gap={10}>
              <Field C={C} label="Name line" hint="Blank uses the names on the profile"><Input C={C} value={gp.coverName} onChange={(v) => set({ coverName: v })} placeholder="Frank & Tina Smith" /></Field>
              <Field C={C} label="Presentation date"><Input C={C} type="date" value={gp.date} onChange={(v) => set({ date: v })} /></Field>
            </Grid>
            <SectionLabel C={C}>Slides to include</SectionLabel>
            <Grid cols={2} gap={6}>{PLUS_SLIDES.map(([k, l]) => <Check key={k} C={C} checked={gp.include[k] !== false} onChange={(v) => set({ include: { ...gp.include, [k]: v } })} label={l} />)}</Grid>
            <div style={{ fontSize: 11.5, color: C.t4, marginTop: 8 }}>A slide with nothing entered is left out automatically.</div>
          </Card>
          <Card C={C}>
            <Eyebrow C={C}>This deck will contain ({outline.length} sections)</Eyebrow>
            {outline.map((o, i) => <div key={i} style={{ fontSize: 12.5, color: C.t2, padding: '4px 0', borderTop: i ? `1px solid ${C.border}` : 'none' }}>{String(i + 1).padStart(2, '0')} · {o}</div>)}
          </Card>
        </Grid>
      )}

      {sub === 'goals' && (
        <div>
          <GoalsImport C={C} />
          {!goals.length ? <Note C={C}>No goals yet. Upload the Goals and Intentions document above, or add them in Families.</Note> : (
            <Grid cols={isDesktop ? 2 : 1} gap={14} style={{ gridTemplateColumns: isDesktop ? '320px 1fr' : undefined }}>
              <div>
                {goals.map((x, i) => (
                  <Card key={x.id} C={C} hover onClick={() => setSel(x.id)} style={{ padding: '10px 12px', marginBottom: 6, borderLeft: `3px solid ${g?.id === x.id ? C.accent : C.border}` }}>
                    <div style={{ fontSize: 12.5, color: C.t1, lineHeight: 1.4 }}><span style={{ color: C.t4 }}>{i + 1}.</span> {x.text || <i style={{ color: C.t4 }}>untitled</i>}</div>
                    <Row gap={6} style={{ marginTop: 5 }}>{x.skipPlus ? <Pill C={C} color={C.t4}>no slide</Pill> : <Pill C={C}>{(x.observations || []).length} obs · {(x.solutions || []).length} sol</Pill>}</Row>
                  </Card>
                ))}
                <Btn C={C} small style={{ marginTop: 6 }} onClick={() => { const n = newGoal(''); patch({ goals: [...goals, n] }); setSel(n.id) }}>+ Add goal</Btn>
              </div>
              {g && (
                <Card C={C}>
                  <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}><Eyebrow C={C} style={{ marginBottom: 0 }}>This goal's slide</Eyebrow><Check C={C} checked={!g.skipPlus} onChange={(v) => updGoal(g.id, { skipPlus: !v })} label="Give this goal its own slide" /></Row>
                  <Field C={C} label="Goal (the client's words)"><TextArea C={C} rows={2} value={g.text} onChange={(v) => updGoal(g.id, { text: v })} /></Field>
                  <Field C={C} label="Slide title" hint="Blank uses the goal text" style={{ marginTop: 10 }}><Input C={C} value={g.title} onChange={(v) => updGoal(g.id, { title: v })} placeholder="Emergency reserves" /></Field>
                  <Grid cols={1} gap={12} style={{ marginTop: 10 }}>
                    <Lines label="Observations (left box)" value={g.observations} onChange={(v) => updGoal(g.id, { observations: v })} placeholder={'One per line, in second person.\nYou plan to spend $96,000 a year…'} />
                    <Lines label="Solutions (right box)" value={g.solutions} onChange={(v) => updGoal(g.id, { solutions: v })} placeholder="What we recommend" />
                  </Grid>
                  <Row style={{ marginTop: 10 }}><Btn C={C} small ghost onClick={() => { patch({ goals: goals.filter((x) => x.id !== g.id) }); setSel(null) }}>Delete this goal</Btn></Row>
                </Card>
              )}
            </Grid>
          )}
          <Card C={C} style={{ marginTop: 14 }}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
              <div><Eyebrow C={C} style={{ marginBottom: 2 }}>Additional topic pages</Eyebrow><div style={{ fontSize: 12, color: C.t3 }}>For analysis that is not one of the client's goals, such as Basic Legal Documents, Insurance, Medicare or Social Security.</div></div>
              <Btn C={C} small onClick={() => set({ analysis: [...topics, { id: uid(), title: '', observations: [], solutions: [] }] })}>+ Add topic</Btn>
            </Row>
            <Row gap={6} style={{ marginBottom: 8 }}>
              {['Basic Legal Documents', 'Cash Flow', 'Insurance', 'Medicare', 'Social Security', 'Inheritance'].filter((t) => !topics.some((x) => x.title === t)).map((t) => <Btn key={t} C={C} small ghost onClick={() => set({ analysis: [...topics, { id: uid(), title: t, observations: [], solutions: [] }] })}>+ {t}</Btn>)}
            </Row>
            {topics.map((t) => (
              <div key={t.id} style={{ padding: '10px 0', borderTop: `1px solid ${C.border}` }}>
                <Row gap={8} style={{ marginBottom: 6 }}><Input C={C} value={t.title} onChange={(v) => setTopic(t.id, { title: v })} placeholder="Topic title" style={{ flex: 1 }} /><Btn C={C} small ghost onClick={() => set({ analysis: topics.filter((x) => x.id !== t.id) })}>×</Btn></Row>
                <Grid cols={isDesktop ? 2 : 1} gap={10}>
                  <Lines label="Observations" value={t.observations} onChange={(v) => setTopic(t.id, { observations: v })} rows={3} />
                  <Lines label="Solutions" value={t.solutions} onChange={(v) => setTopic(t.id, { solutions: v })} rows={3} />
                </Grid>
              </div>
            ))}
          </Card>
        </div>
      )}

      {sub === 'plan' && (
        <Grid cols={isDesktop ? 2 : 1} gap={14}>
          <Card C={C}>
            <Eyebrow C={C}>Assumptions in plan</Eyebrow>
            <Grid cols={2} gap={10}>
              <Field C={C} label="Cash growth %"><Input C={C} value={gp.assumptions.cashGrowth} onChange={(v) => set({ assumptions: { ...gp.assumptions, cashGrowth: v } })} placeholder="0" /></Field>
              <Field C={C} label="Investment growth %"><Input C={C} value={gp.assumptions.investGrowth} onChange={(v) => set({ assumptions: { ...gp.assumptions, investGrowth: v } })} placeholder={String(model.assumptions.returnPct)} hint={`Cashflow plan uses ${model.assumptions.returnPct}%`} /></Field>
            </Grid>
          </Card>
          <Card C={C}>
            <Lines label="Pension and Social Security (one bullet per line)" value={gp.pensionSS} onChange={(v) => set({ pensionSS: v })} placeholder="Pension benefits optimization: modeled 100% participant spouse on Pension 1…" />
          </Card>
          <Card C={C}><Lines label="Potential strategies analyzed" value={gp.strategies} onChange={(v) => set({ strategies: v })} placeholder="Investing full $956,000 of IRA rollover into the Paradiem Dividend Strategy [Base Plan]." /></Card>
          <Card C={C}><Lines label="Plan summary" value={gp.planSummary} onChange={(v) => set({ planSummary: v })} placeholder="Begin Social Security at age 63." /></Card>
          <Card C={C}><Lines label="Next steps (blank uses the standard five)" value={gp.nextSteps} onChange={(v) => set({ nextSteps: v })} placeholder={'Cash Flow and Financial Analysis\nGenerational Impact Retreat'} rows={5} /></Card>
        </Grid>
      )}

      {sub === 'invest' && (
        <div>
          <Card C={C} style={{ marginBottom: 14 }}>
            <Eyebrow C={C}>Base plan tables</Eyebrow>
            <div style={{ fontSize: 12.5, color: C.t3, lineHeight: 1.5, marginBottom: 8 }}>The 5-Year and Lifetime Cash Flow slides build themselves from this family's Cashflow plan. {planGap(model)}</div>
            <Grid cols={isDesktop ? 3 : 1} gap={10}>
              <Field C={C} label="Plan used"><Select C={C} value={gp.baseScenario} onChange={(v) => set({ baseScenario: v })} options={scenarioOptions} style={{ width: '100%' }} /></Field>
              <PictureField C={C} label="Or use a picture for the 5-Year Cash Flow" hint="A pasted Excel or planning-software picture replaces the table" value={gp.images.cashFlow5} onChange={(v) => set({ images: { ...gp.images, cashFlow5: v } })} />
              <PictureField C={C} label="Or a picture for the Lifetime Cash Flow" value={gp.images.lifetime} onChange={(v) => set({ images: { ...gp.images, lifetime: v } })} />
            </Grid>
            <PictureField C={C} label="Picture for the first-year timeline (replaces the calendar list)" value={gp.images.timeline} onChange={(v) => set({ images: { ...gp.images, timeline: v } })} />
            <Row style={{ marginTop: 8 }}><Btn C={C} small ghost onClick={() => setTab('cashflow')}>Open Cashflow</Btn></Row>
          </Card>
          <div style={{ fontSize: 12, color: C.t3, marginBottom: 8 }}>These portfolio figures are shared with the Assessment tab, so a number entered there appears here too.</div>
          <InvestFields C={C} a={a} set={setA} plan={basePlan} isDesktop={isDesktop} />
        </div>
      )}

      {sub === 'ltc' && (
        <div>
          <Card C={C} style={{ marginBottom: 14 }}>
            <Row style={{ justifyContent: 'space-between' }}><Eyebrow C={C} style={{ marginBottom: 0 }}>Long-term-care annuity section</Eyebrow>{num(gp.ltc.amount) > 0 ? <Pill C={C} color={C.up}>in the deck</Pill> : <Pill C={C} color={C.t4}>left out (no amount)</Pill>}</Row>
            <div style={{ fontSize: 12.5, color: C.t3, lineHeight: 1.5, margin: '6px 0 10px' }}>When an annuity amount is entered the deck adds the annuity slides and a base-plan-versus-annuity comparison, as in the reference deck. Leave the amount blank to omit the whole section.</div>
            <Grid cols={isDesktop ? 3 : 1} gap={10}>
              <Field C={C} label="Annuity amount ($)"><Input C={C} value={gp.ltc.amount} onChange={(v) => setLtc({ amount: v })} placeholder="300000" /></Field>
              <Field C={C} label="Annual income from the annuity ($)"><Input C={C} value={gp.ltc.annualIncome} onChange={(v) => setLtc({ annualIncome: v })} placeholder="15038" /></Field>
              <Field C={C} label="Cashflow scenario for these tables"><Select C={C} value={gp.ltc.scenarioId} onChange={(v) => setLtc({ scenarioId: v })} options={[{ value: '', label: '— none yet —' }, ...model.scenarios.map((s) => ({ value: s.id, label: s.name }))]} style={{ width: '100%' }} /></Field>
            </Grid>
            <Row style={{ marginTop: 10 }}>
              <Btn C={C} small disabled={!num(gp.ltc.amount)} onClick={makeScenario}>{gp.ltc.scenarioId ? 'Update the "LTC annuity" scenario' : 'Create the "LTC annuity" scenario'}</Btn>
              <span style={{ fontSize: 11.5, color: C.t4 }}>Adds the premium as a one-time withdrawal and the annual income as new income in the Cashflow tab. Fine-tune it in Cashflow > Scenarios.</span>
            </Row>
            <div style={{ marginTop: 10 }}><Lines label="Annuity bullets (one per line)" value={gp.ltc.bullets} onChange={(v) => setLtc({ bullets: v })} placeholder={'$15,038 annual income for your joint life\nIncome doubler triggered by 2 of 6 ADLs\nFour-year waiting period before enhanced benefits become available'} rows={5} /></div>
            <Grid cols={isDesktop ? 2 : 1} gap={10} style={{ marginTop: 8 }}>
              <PictureField C={C} label="Picture for the annuity 5-Year Cash Flow (optional)" value={gp.images.ltcCashFlow5} onChange={(v) => set({ images: { ...gp.images, ltcCashFlow5: v } })} />
              <PictureField C={C} label="Picture for the annuity Lifetime Cash Flow (optional)" value={gp.images.ltcLifetime} onChange={(v) => set({ images: { ...gp.images, ltcLifetime: v } })} />
            </Grid>
          </Card>
          <div style={{ fontSize: 12, color: C.t3, marginBottom: 8 }}>Portfolio, cash-need, performance and lifeboat figures with the annuity in place:</div>
          <InvestFields C={C} a={gp.ltc.invest} set={setLtcInvest} plan={ltcPlan} isDesktop={isDesktop} />
          <Row style={{ marginTop: 10 }}><Btn C={C} small ghost onClick={() => setLtc({ invest: { ...emptyInvest(), ...Object.fromEntries(['portfolioTotal', 'dividendPct', 'growthPct', 'cashPct'].map((k) => [k, a[k] ?? ''])) } })}>Start from the base-plan portfolio</Btn></Row>
        </div>
      )}
    </div>
  )
}
