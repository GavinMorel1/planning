// "What the Numbers Reveal" calculator: global inputs, eight sections (each with its own include checkbox, inputs, the
// calculation line by line, and the Value for Presentation). All maths lives in src/lib/numbersCalc.ts (matches the workbook).
import { useMemo } from 'react'
import { Card, Eyebrow, Btn, Input, Field, Grid, Note, Check, Select } from './ui'
import { calcNumbers, includedSections, ageFromDob, DEFAULT_RATES, SECTION_IDS } from '../lib/numbersCalc'
import { fmtUsd } from '../lib/util'
import { netWorthOf } from '../tabs/Families'

const INPUT_FOR = { 1: ['annualGiving', 'Current annual giving $'], 2: ['incomeTaxes', 'Current income taxes $ (per year)'], 3: ['taxableGain', 'Taxable gain on sale $'], 8: ['investmentAmount', 'Current investment amount $'] }
const fmtStep = (s) => (s.kind === 'pct' ? `${Number(s.value.toFixed(4))}%` : s.kind === 'years' ? `${s.value} yrs` : fmtUsd(s.value))

export function numbersVariant(f) { return f?.tier === 'under5' ? 'under5' : 'over5' }

export default function NumbersCalculator({ C, f, patch, settings, isDesktop, variant }) {
  const v = variant || numbersVariant(f)
  const a = f.assessment || {}
  const N = a.numbers || {}
  const rates = { ...DEFAULT_RATES, ...(settings.numbersCalc || {}) }
  const set = (o) => patch({ assessment: { ...a, numbers: { ...N, ...o } } })
  const res = useMemo(() => calcNumbers({ ...N, lifeExpectancy: N.lifeExpectancy }, rates), [N, rates])
  const on = new Set(includedSections(N.include, v))
  const toggle = (id, val) => set({ include: { ...(N.include || {}), [id]: val } })
  const dobAge = ageFromDob(f.profile?.spouse1?.dob)
  const nw = netWorthOf(f)
  const missingAge = N.currentAge === undefined || N.currentAge === ''
  return (
    <div>
      <Card C={C} style={{ marginBottom: 14 }}>
        <Eyebrow C={C}>"What the Numbers Reveal" · inputs for this family</Eyebrow>
        <div style={{ fontSize: 11.5, color: C.t4, marginBottom: 10 }}>These feed the eight sections below. Tick a section to print it on the "What the Numbers Reveal" slide. Percentages come from Settings › Firm averages.</div>
        <Grid cols={isDesktop ? 4 : 2} gap={10}>
          <Field C={C} label="Current age" hint={dobAge != null ? `Spouse 1 is ${dobAge} from date of birth` : ''}><Input C={C} value={N.currentAge} onChange={(x) => set({ currentAge: x })} placeholder={dobAge != null ? String(dobAge) : '60'} /></Field>
          <Field C={C} label="Life expectancy"><Input C={C} value={N.lifeExpectancy} onChange={(x) => set({ lifeExpectancy: x })} placeholder={String(rates.defaultLifeExpectancy)} /></Field>
          <Field C={C} label="Years of life remaining" hint="Life expectancy minus current age"><div style={{ padding: '9px 12px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, fontSize: 13.5, fontWeight: 800, color: C.t1 }}>{res.yearsRemaining}</div></Field>
          <Field C={C} label="Estate value $" hint="Its own input, separate from net worth"><Input C={C} value={N.estateValue} onChange={(x) => set({ estateValue: x })} placeholder="e.g. 50000000" /></Field>
          <Field C={C} label="Married / single"><Select C={C} value={N.marital || 'married'} onChange={(x) => set({ marital: x })} options={[{ value: 'married', label: 'Married' }, { value: 'single', label: 'Single (exemption halved)' }]} style={{ width: '100%' }} /></Field>
          <Field C={C} label="Estate exemption" hint={N.exemptionOverride ? 'Override in use' : N.marital === 'single' ? 'Half of the married exemption' : 'From Settings'}><Input C={C} value={N.exemptionOverride} onChange={(x) => set({ exemptionOverride: x })} placeholder={String(res.exemption)} /></Field>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>{nw > 0 && <Btn C={C} small onClick={() => set({ estateValue: String(Math.round(nw)) })} title="Copy the family's net worth into Estate value">Use net worth ({fmtUsd(nw, { compact: true })})</Btn>}</div>
        </Grid>
        {missingAge && <Note C={C} tone="warn" style={{ marginTop: 10 }}>Current age is blank, so years remaining equals life expectancy ({res.yearsRemaining}). Enter the age to get the family's real figures.</Note>}
      </Card>
      <Grid cols={isDesktop ? 2 : 1} gap={14}>
        {SECTION_IDS.map((id) => {
          const sec = res.sections[id]
          const inp = INPUT_FOR[id]
          return (
            <Card key={id} C={C} style={{ borderLeft: `3px solid ${on.has(id) ? C.accent : C.border}`, opacity: on.has(id) ? 1 : 0.82 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.t1 }}><span style={{ color: C.accent }}>{id}</span> · {sec.title}</div>
                <Check C={C} checked={on.has(id)} onChange={(x) => toggle(id, x)} label="Include in presentation" />
              </div>
              {inp && <Field C={C} label={inp[1]} style={{ marginBottom: 8 }}><Input C={C} value={N[inp[0]]} onChange={(x) => set({ [inp[0]]: x })} placeholder="0" /></Field>}
              <div>{sec.steps.map((s, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '4px 0', borderTop: i ? `1px solid ${C.border}` : 'none', fontSize: 12.5 }}>
                  <span style={{ color: C.t3 }}>{s.label}</span><span style={{ color: C.t1, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtStep(s)}</span>
                </div>))}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.borderActive}` }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: C.accent, textTransform: 'uppercase', letterSpacing: 1 }}>Value for Presentation</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: C.t1, fontVariantNumeric: 'tabular-nums' }}>{fmtUsd(Math.round(sec.value))}</span>
              </div>
            </Card>
          )
        })}
      </Grid>
      <div style={{ fontSize: 11.5, color: C.t4, marginTop: 10 }}>{on.size} of 8 sections will print ({v === 'under5' ? 'under-$5M default: 1, 5, 6, 8' : '$5M+ default: 1, 4, 5, 6, 8'}). Section 8 follows the workbook exactly: the annual payment equals the years remaining.</div>
    </div>
  )
}
