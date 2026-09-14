import { useState } from 'react'
import { useStore } from '../lib/store'
import { Card, Eyebrow, Title, SubTabs, Btn, Input, TextArea, Select, Field, Toggle, Grid, Row, Pill, Empty, Confirm, SectionLabel, Note, Check } from '../components/ui'
import { fmtUsd, num, uid, ageFrom } from '../lib/util'
import { familyFlags, FLAG_LABELS } from '../lib/flags'
import { DOC_CATEGORIES } from '../data/docCategories'

const US_STATES = ['', 'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC']
export const ASSET_TYPES = [
  { value: 'cash', label: 'Cash & reserves' }, { value: 'taxable', label: 'Taxable investments' }, { value: 'retirement', label: 'Retirement accounts' },
  { value: 'business', label: 'Business interest' }, { value: 'residence', label: 'Primary residence' }, { value: 'vacation_home', label: 'Vacation / second home' },
  { value: 'rental_real_estate', label: 'Investment real estate' }, { value: 'concentrated', label: 'Concentrated stock' }, { value: 'life_insurance', label: 'Life insurance (cash value)' },
  { value: 'personal', label: 'Personal property' }, { value: 'other', label: 'Other' },
]
export const OWNERS = [{ value: 'joint', label: 'Joint' }, { value: 'spouse1', label: 'Spouse 1' }, { value: 'spouse2', label: 'Spouse 2' }, { value: 'trust', label: 'Trust' }, { value: 'entity', label: 'Entity' }, { value: 'child', label: 'Child' }]
export const totalAssets = (f) => (f.balanceSheet?.assets || []).reduce((s, a) => s + num(a.value), 0)
export const totalLiab = (f) => (f.balanceSheet?.liabilities || []).reduce((s, a) => s + num(a.value), 0)
export const netWorthOf = (f) => (f.netWorth !== '' && f.netWorth != null ? num(f.netWorth) : totalAssets(f) - totalLiab(f))

export default function Families({ C, isDesktop, setTab }) {
  const { families, family, setActive, createFamily, updateFamily, deleteFamily, settings } = useStore()
  const [view, setView] = useState(family ? 'detail' : 'list')
  const [sub, setSub] = useState('profile')
  const [q, setQ] = useState('')

  if (view === 'list' || !family) {
    const list = families.filter((f) => !q || f.name.toLowerCase().includes(q.toLowerCase()))
    return (
      <div>
        <Title C={C} isDesktop={isDesktop} sub="Every family the planning team is working with. Pick one to make it active." right={<Btn C={C} primary onClick={() => { const name = prompt('Family name (e.g. "The Fookes Family")'); if (name) { createFamily(name); setSub('profile'); setView('detail') } }}>+ Add family</Btn>}>Families</Title>
        <Input C={C} value={q} onChange={setQ} placeholder="Search families…" style={{ marginBottom: 14 }} />
        {!list.length ? (
          <Empty C={C} icon="⌂" title="No families yet" action={<Btn C={C} primary onClick={() => { const name = prompt('Family name'); if (name) { createFamily(name); setView('detail') } }}>Add the first family</Btn>}>Add a family, then fill in the profile, upload their documents and enter their goals. Every other tab works on the active family.</Empty>
        ) : (
          <Grid cols={isDesktop ? 3 : 1}>
            {list.map((f) => {
              const docs = Object.values(f.documents || {}).filter((d) => d.status === 'received').length
              const met = (f.goals || []).filter((g) => g.status === 'met').length, missed = (f.goals || []).filter((g) => g.status === 'missed').length
              return (
                <Card key={f.id} C={C} hover onClick={() => { setActive(f.id); setView('detail') }} style={{ borderLeft: family?.id === f.id ? `3px solid ${C.accent}` : undefined }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: C.t1 }}>{f.name}</div>
                    <Pill C={C}>{f.tier === 'under5' ? 'Under $5M' : '$5M+'}</Pill>
                  </div>
                  <div style={{ fontSize: 12, color: C.t3, marginTop: 4 }}>{f.profile?.spouse1?.name || '—'}{f.profile?.spouse2?.name ? ` & ${f.profile.spouse2.name}` : ''}{f.profile?.state ? ` · ${f.profile.state}` : ''}</div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 12, color: C.t3 }}>
                    <span><b style={{ color: C.t1 }}>{fmtUsd(netWorthOf(f), { compact: true })}</b> net worth</span>
                    <span><b style={{ color: C.t1 }}>{(f.goals || []).length}</b> goals</span>
                    <span><b style={{ color: C.t1 }}>{docs}</b> docs</span>
                  </div>
                  {(met + missed) > 0 && <div style={{ display: 'flex', gap: 6, marginTop: 8 }}><Pill C={C} color={C.up}>{met} met</Pill><Pill C={C} color={C.dn}>{missed} missed</Pill></div>}
                  <div style={{ fontSize: 10.5, color: C.t4, marginTop: 10, textTransform: 'uppercase', letterSpacing: 1 }}>{f.stage} · updated {new Date(f.updatedAt).toLocaleDateString()}</div>
                </Card>
              )
            })}
          </Grid>
        )}
      </div>
    )
  }

  const f = family
  const patch = (p) => updateFamily(f.id, p)
  const setPath = (path, value) => updateFamily(f.id, (cur) => {
    const next = structuredClone(cur); let o = next; const keys = path.split('.')
    for (let i = 0; i < keys.length - 1; i++) { o[keys[i]] = o[keys[i]] ?? {}; o = o[keys[i]] }
    o[keys[keys.length - 1]] = value; return next
  })
  const p = f.profile || {}
  const flags = familyFlags(f, settings.tax?.[new Date().getFullYear()] || Object.values(settings.tax || {})[0])
  const tabs = [{ id: 'profile', label: 'Profile' }, { id: 'household', label: 'Household', count: (f.children || []).length }, { id: 'business', label: 'Business' }, { id: 'balance', label: 'Balance Sheet' }, { id: 'goals', label: 'Goals & Vision', count: (f.goals || []).length }, { id: 'estate', label: 'Estate Tax' }]

  return (
    <div>
      <Btn C={C} ghost small onClick={() => setView('list')} style={{ marginBottom: 12 }}>‹ All families</Btn>
      <Title C={C} isDesktop={isDesktop} sub={`${f.tier === 'under5' ? 'Under $5M' : '$5M+'} · ${fmtUsd(netWorthOf(f))} net worth · ${flags.length} planning flags`} right={<>
        <Select C={C} value={f.stage} onChange={(v) => patch({ stage: v })} options={[{ value: 'assessment', label: 'Stage: Assessment' }, { value: 'gap', label: 'Stage: Gap Analysis' }, { value: 'blueprint', label: 'Stage: Blueprint' }]} />
        <Confirm C={C} label="Delete family" onConfirm={() => { deleteFamily(f.id); setView('list') }} />
      </>}>{f.name}</Title>
      <SubTabs C={C} value={sub} onChange={setSub} tabs={tabs} />

      {sub === 'profile' && (
        <Grid cols={isDesktop ? 2 : 1} gap={14}>
          <Card C={C}>
            <Eyebrow C={C}>Family</Eyebrow>
            <Grid cols={2} gap={10}>
              <Field C={C} label="Family name" style={{ gridColumn: '1 / -1' }}><Input C={C} value={f.name} onChange={(v) => patch({ name: v })} /></Field>
              <Field C={C} label="Engagement tier" hint="Known from the first conversation with the prospect."><Select C={C} value={f.tier} onChange={(v) => patch({ tier: v })} options={[{ value: 'under5', label: 'Under $5M net worth' }, { value: 'over5', label: '$5M+ net worth' }]} style={{ width: '100%' }} /></Field>
              <Field C={C} label="Net worth (override)" hint="Leave blank to use the balance sheet."><Input C={C} value={f.netWorth} onChange={(v) => patch({ netWorth: v })} placeholder={fmtUsd(totalAssets(f) - totalLiab(f))} /></Field>
              <Field C={C} label="State of residence"><Select C={C} value={p.state} onChange={(v) => setPath('profile.state', v)} options={US_STATES} style={{ width: '100%' }} /></Field>
              <Field C={C} label="City"><Input C={C} value={p.city} onChange={(v) => setPath('profile.city', v)} /></Field>
              <Field C={C} label="Household income (annual)"><Input C={C} value={p.householdIncome} onChange={(v) => setPath('profile.householdIncome', v)} placeholder="e.g. 850000" /></Field>
              <Field C={C} label="Year current estate documents were signed"><Input C={C} value={p.documentsYear} onChange={(v) => setPath('profile.documentsYear', v)} placeholder="e.g. 2017" /></Field>
            </Grid>
            <SectionLabel C={C}>Situation flags</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[['recentLiquidity', 'Recent or imminent liquidity event (sale, inheritance, bonus)'], ['lowIncomeYear', 'This is a low-income year'], ['retired', 'Retired'], ['inheritanceExpected', 'Inheritance expected'], ['multiStateProperty', 'Property in more than one state'], ['existingLifeInsurance', 'Existing life insurance policies'], ['equityComp', 'RSUs / stock options'], ['secondMarriage', 'Second marriage'], ['healthConcern', 'Health concern for either spouse'], ['unfundedAccounts', 'Accounts not yet titled to the trust'], ['singleIncome', 'Single income household']].map(([k, l]) => (
                <Check key={k} C={C} checked={p[k]} onChange={(v) => setPath(`profile.${k}`, v)} label={l} />
              ))}
            </div>
          </Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Card C={C}>
              <Eyebrow C={C}>Spouses</Eyebrow>
              {['spouse1', 'spouse2'].map((k, i) => (
                <Grid key={k} cols={3} gap={10} style={{ marginBottom: 10 }}>
                  <Field C={C} label={`Spouse ${i + 1} name`} style={{ gridColumn: 'span 2' }}><Input C={C} value={p[k]?.name} onChange={(v) => setPath(`profile.${k}.name`, v)} /></Field>
                  <Field C={C} label="Date of birth" hint={p[k]?.dob ? `Age ${ageFrom(p[k].dob)}` : undefined}><Input C={C} type="date" value={p[k]?.dob} onChange={(v) => setPath(`profile.${k}.dob`, v)} /></Field>
                </Grid>
              ))}
              <div style={{ fontSize: 11, color: C.t4 }}>The older spouse is assumed to pass first in the estate flow chart.</div>
            </Card>
            <Card C={C}>
              <Eyebrow C={C}>100-Year Vision</Eyebrow>
              <TextArea C={C} rows={6} value={p.vision} onChange={(v) => setPath('profile.vision', v)} placeholder="What the family said they want their wealth to do across generations. Faith, family, generosity, business, place…" />
              <div style={{ fontSize: 11, color: C.t4, marginTop: 6 }}>Everything the tool recommends is written against this and the goals list.</div>
            </Card>
            <Card C={C}>
              <Eyebrow C={C}>Planner notes</Eyebrow>
              <TextArea C={C} rows={4} value={f.notes} onChange={(v) => patch({ notes: v })} placeholder="Internal notes. Not shown to the client." />
            </Card>
          </div>
        </Grid>
      )}

      {sub === 'household' && (
        <Card C={C}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
            <Eyebrow C={C} style={{ marginBottom: 0 }}>Children & dependents</Eyebrow>
            <Btn C={C} small onClick={() => patch({ children: [...(f.children || []), { id: uid(), name: '', dob: '', married: false, inBusiness: false, specialNeeds: false, notes: '' }] })}>+ Add child</Btn>
          </Row>
          {!(f.children || []).length && <div style={{ fontSize: 12.5, color: C.t4 }}>No children entered.</div>}
          {(f.children || []).map((c) => (
            <div key={c.id} style={{ display: 'grid', gridTemplateColumns: isDesktop ? '2fr 1.2fr 1fr 1fr 1fr 2fr auto' : '1fr 1fr', gap: 10, alignItems: 'end', padding: '10px 0', borderTop: `1px solid ${C.border}` }}>
              <Field C={C} label="Name"><Input C={C} value={c.name} onChange={(v) => patch({ children: f.children.map((x) => x.id === c.id ? { ...x, name: v } : x) })} /></Field>
              <Field C={C} label="Date of birth" hint={c.dob ? `Age ${ageFrom(c.dob)}` : undefined}><Input C={C} type="date" value={c.dob} onChange={(v) => patch({ children: f.children.map((x) => x.id === c.id ? { ...x, dob: v } : x) })} /></Field>
              <Check C={C} checked={c.married} onChange={(v) => patch({ children: f.children.map((x) => x.id === c.id ? { ...x, married: v } : x) })} label="Married" />
              <Check C={C} checked={c.inBusiness} onChange={(v) => patch({ children: f.children.map((x) => x.id === c.id ? { ...x, inBusiness: v } : x) })} label="In business" />
              <Check C={C} checked={c.specialNeeds} onChange={(v) => patch({ children: f.children.map((x) => x.id === c.id ? { ...x, specialNeeds: v } : x) })} label="Special needs" />
              <Field C={C} label="Notes"><Input C={C} value={c.notes} onChange={(v) => patch({ children: f.children.map((x) => x.id === c.id ? { ...x, notes: v } : x) })} placeholder="Interests, role, situation" /></Field>
              <Btn C={C} small ghost onClick={() => patch({ children: f.children.filter((x) => x.id !== c.id) })}>×</Btn>
            </div>
          ))}
          <Grid cols={isDesktop ? 3 : 1} gap={10} style={{ marginTop: 14 }}>
            <Field C={C} label="Number of grandchildren"><Input C={C} value={p.grandchildren} onChange={(v) => setPath('profile.grandchildren', v)} /></Field>
            <Field C={C} label="Other dependents"><Input C={C} value={p.dependents} onChange={(v) => setPath('profile.dependents', v)} placeholder="e.g. parents supported at $3,000/mo" /></Field>
          </Grid>
        </Card>
      )}

      {sub === 'business' && (
        <Card C={C}>
          <Toggle C={C} checked={f.business?.owner} onChange={(v) => setPath('business.owner', v)} label="The family owns a business" />
          {f.business?.owner && (
            <Grid cols={isDesktop ? 3 : 1} gap={10} style={{ marginTop: 14 }}>
              <Field C={C} label="Business name"><Input C={C} value={f.business.name} onChange={(v) => setPath('business.name', v)} /></Field>
              <Field C={C} label="Entity type"><Select C={C} value={f.business.entity} onChange={(v) => setPath('business.entity', v)} options={[{ value: '', label: '—' }, { value: 's_corp', label: 'S-corporation' }, { value: 'c_corp', label: 'C-corporation' }, { value: 'llc', label: 'LLC (partnership)' }, { value: 'partnership', label: 'Partnership' }, { value: 'sole', label: 'Sole proprietorship' }]} style={{ width: '100%' }} /></Field>
              <Field C={C} label="Estimated value"><Input C={C} value={f.business.value} onChange={(v) => setPath('business.value', v)} placeholder="e.g. 38000000" /></Field>
              <Field C={C} label="Annual revenue"><Input C={C} value={f.business.revenue} onChange={(v) => setPath('business.revenue', v)} /></Field>
              <Field C={C} label="Other owners (count)"><Input C={C} value={f.business.otherOwners} onChange={(v) => setPath('business.otherOwners', v)} /></Field>
              <Field C={C} label="Sale horizon (years)" hint="Blank if no sale planned."><Input C={C} value={f.business.saleHorizonYears} onChange={(v) => setPath('business.saleHorizonYears', v)} /></Field>
              <Field C={C} label="Named successor"><Input C={C} value={f.business.successor} onChange={(v) => setPath('business.successor', v)} /></Field>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, gridColumn: isDesktop ? 'span 2' : undefined }}>
                <Check C={C} checked={f.business.salePending} onChange={(v) => setPath('business.salePending', v)} label="A sale is pending or under discussion (no binding agreement yet)" />
                <Check C={C} checked={f.business.successionPlan} onChange={(v) => setPath('business.successionPlan', v)} label="A written succession plan exists" />
                <Check C={C} checked={f.business.keyEmployees} onChange={(v) => setPath('business.keyEmployees', v)} label="Key employees the business depends on" />
              </div>
            </Grid>
          )}
        </Card>
      )}

      {sub === 'balance' && <BalanceSheet C={C} isDesktop={isDesktop} f={f} patch={patch} />}

      {sub === 'goals' && (
        <Card C={C}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            <div><Eyebrow C={C} style={{ marginBottom: 2 }}>Goals & Intentions</Eyebrow><div style={{ fontSize: 12, color: C.t3 }}>Typed by the planning team from the surveys and the 90-minute retreat. One line per goal, in the client's words.</div></div>
            <Btn C={C} small onClick={() => patch({ goals: [...(f.goals || []), { id: uid(), text: '', status: 'open', observations: [], challenges: [], cost: { amount: '', basis: '' }, tools: [], notes: '' }] })}>+ Add goal</Btn>
          </Row>
          <Note C={C} style={{ marginBottom: 12 }}>Paste a whole Goals & Intentions document below and each line becomes a goal. Analysis (observations, challenges, cost of inaction, tools) happens in the Gap Analysis tab.</Note>
          <TextArea C={C} rows={3} placeholder="Paste goals here, one per line, then click Import" value={f._goalPaste} onChange={(v) => patch({ _goalPaste: v })} />
          <Btn C={C} small style={{ marginTop: 8, marginBottom: 14 }} onClick={() => { const lines = String(f._goalPaste || '').split('\n').map((l) => l.replace(/^[\s•\-\*\d\.\)]+/, '').trim()).filter(Boolean); if (!lines.length) return; patch({ goals: [...(f.goals || []), ...lines.map((text) => ({ id: uid(), text, status: 'open', observations: [], challenges: [], cost: { amount: '', basis: '' }, tools: [], notes: '' }))], _goalPaste: '' }) }}>Import lines as goals</Btn>
          {(f.goals || []).map((g, i) => (
            <div key={g.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 11, color: C.t4, width: 22, textAlign: 'right' }}>{i + 1}.</span>
              <Input C={C} value={g.text} onChange={(v) => patch({ goals: f.goals.map((x) => x.id === g.id ? { ...x, text: v } : x) })} placeholder="e.g. Provide an inheritance of $25,000,000 to each of our children through trust structures." />
              <Pill C={C} color={g.status === 'met' ? C.up : g.status === 'missed' ? C.dn : C.t4}>{g.status}</Pill>
              <Btn C={C} small ghost title="Move up" disabled={i === 0} onClick={() => { const gs = [...f.goals]; [gs[i - 1], gs[i]] = [gs[i], gs[i - 1]]; patch({ goals: gs }) }}>↑</Btn>
              <Btn C={C} small ghost onClick={() => patch({ goals: f.goals.filter((x) => x.id !== g.id) })}>×</Btn>
            </div>
          ))}
          {!(f.goals || []).length && <div style={{ fontSize: 12.5, color: C.t4, padding: '10px 0' }}>No goals yet.</div>}
        </Card>
      )}

      {sub === 'estate' && (
        <Grid cols={isDesktop ? 2 : 1} gap={14}>
          {['s1', 's2'].map((k, i) => {
            const tax = settings.tax?.[new Date().getFullYear()] || Object.values(settings.tax || {})[0] || {}
            const e = f.estateTax?.[k] || {}
            return (
              <Card key={k} C={C}>
                <Eyebrow C={C}>{p[`spouse${i + 1}`]?.name || `Spouse ${i + 1}`}</Eyebrow>
                <Grid cols={2} gap={10}>
                  <Field C={C} label="Applicable credit amount used" hint="From Form 709 if uploaded, else enter."><Input C={C} value={e.creditUsed} onChange={(v) => setPath(`estateTax.${k}.creditUsed`, v)} /></Field>
                  <Field C={C} label="GST exemption used"><Input C={C} value={e.gstUsed} onChange={(v) => setPath(`estateTax.${k}.gstUsed`, v)} /></Field>
                </Grid>
                <div style={{ marginTop: 12, fontSize: 13, color: C.t2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: `1px solid ${C.border}` }}><span>Applicable credit available</span><b>{fmtUsd((tax.estateExemption || 0) - num(e.creditUsed))}</b></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: `1px solid ${C.border}` }}><span>GST exemption available</span><b>{fmtUsd((tax.gstExemption || 0) - num(e.gstUsed))}</b></div>
                </div>
              </Card>
            )
          })}
          <Card C={C} style={{ gridColumn: '1 / -1' }}>
            <Eyebrow C={C}>Estimated exposure</Eyebrow>
            <EstateExposure C={C} f={f} tax={settings.tax?.[new Date().getFullYear()] || Object.values(settings.tax || {})[0] || {}} />
          </Card>
        </Grid>
      )}

      <Card C={C} style={{ marginTop: 16 }}>
        <Eyebrow C={C}>Planning flags derived from this profile</Eyebrow>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {flags.length ? flags.map((fl) => <Pill key={fl} C={C} color={/^no_|gap|stale|exposure|pending/.test(fl) ? C.warn : C.accent}>{FLAG_LABELS[fl] || fl}</Pill>) : <span style={{ fontSize: 12, color: C.t4 }}>Fill in the profile, balance sheet, goals and documents to generate flags.</span>}
        </div>
      </Card>
    </div>
  )
}

export function EstateExposure({ C, f, tax }) {
  const nw = netWorthOf(f)
  const married = Boolean(f.profile?.spouse2?.name)
  const used = num(f.estateTax?.s1?.creditUsed) + (married ? num(f.estateTax?.s2?.creditUsed) : 0)
  const exemption = (tax.estateExemption || 0) * (married ? 2 : 1) - used
  const taxable = Math.max(0, nw - exemption)
  const est = taxable * ((tax.estateTaxRate || 40) / 100)
  return (
    <Row gap={12}>
      <div style={{ fontSize: 13, color: C.t2 }}>Net worth <b>{fmtUsd(nw)}</b></div>
      <div style={{ fontSize: 13, color: C.t2 }}>Combined exemption available <b>{fmtUsd(exemption)}</b></div>
      <div style={{ fontSize: 13, color: C.t2 }}>Taxable estate today <b>{fmtUsd(taxable)}</b></div>
      <div style={{ fontSize: 13, color: est > 0 ? C.dn : C.up }}>Estimated estate tax if both pass today <b>{fmtUsd(est)}</b></div>
    </Row>
  )
}

function BalanceSheet({ C, isDesktop, f, patch }) {
  const bs = f.balanceSheet || { assets: [], liabilities: [] }
  const setBs = (next) => patch({ balanceSheet: next })
  const addA = () => setBs({ ...bs, assets: [...bs.assets, { id: uid(), name: '', type: 'taxable', owner: 'joint', value: '', basis: '', salePending: false }] })
  const addL = () => setBs({ ...bs, liabilities: [...bs.liabilities, { id: uid(), name: '', value: '', rate: '' }] })
  const upA = (id, k, v) => setBs({ ...bs, assets: bs.assets.map((a) => a.id === id ? { ...a, [k]: v } : a) })
  const upL = (id, k, v) => setBs({ ...bs, liabilities: bs.liabilities.map((a) => a.id === id ? { ...a, [k]: v } : a) })
  const byType = ASSET_TYPES.map((t) => ({ ...t, total: bs.assets.filter((a) => a.type === t.value).reduce((s, a) => s + num(a.value), 0) })).filter((t) => t.total > 0)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Card C={C}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}><Eyebrow C={C} style={{ marginBottom: 0 }}>Assets · {fmtUsd(totalAssets(f))}</Eyebrow><Btn C={C} small onClick={addA}>+ Add asset</Btn></Row>
        {bs.assets.map((a) => (
          <div key={a.id} style={{ display: 'grid', gridTemplateColumns: isDesktop ? '2fr 1.4fr 1fr 1fr 1fr auto auto' : '1fr 1fr', gap: 8, alignItems: 'end', padding: '8px 0', borderTop: `1px solid ${C.border}` }}>
            <Field C={C} label="Asset"><Input C={C} value={a.name} onChange={(v) => upA(a.id, 'name', v)} placeholder="e.g. Bee Green LLC" /></Field>
            <Field C={C} label="Type"><Select C={C} value={a.type} onChange={(v) => upA(a.id, 'type', v)} options={ASSET_TYPES} style={{ width: '100%' }} /></Field>
            <Field C={C} label="Owner"><Select C={C} value={a.owner} onChange={(v) => upA(a.id, 'owner', v)} options={OWNERS} style={{ width: '100%' }} /></Field>
            <Field C={C} label="Value"><Input C={C} value={a.value} onChange={(v) => upA(a.id, 'value', v)} /></Field>
            <Field C={C} label="Basis"><Input C={C} value={a.basis} onChange={(v) => upA(a.id, 'basis', v)} /></Field>
            <Check C={C} checked={a.salePending} onChange={(v) => upA(a.id, 'salePending', v)} label="Sale pending" />
            <Btn C={C} small ghost onClick={() => setBs({ ...bs, assets: bs.assets.filter((x) => x.id !== a.id) })}>×</Btn>
          </div>
        ))}
        {!bs.assets.length && <div style={{ fontSize: 12.5, color: C.t4 }}>No assets entered. Upload eMoney reports or a Personal Financial Statement in Documents and Claude will list them here for you to confirm.</div>}
      </Card>
      <Card C={C}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}><Eyebrow C={C} style={{ marginBottom: 0 }}>Liabilities · {fmtUsd(totalLiab(f))}</Eyebrow><Btn C={C} small onClick={addL}>+ Add liability</Btn></Row>
        {bs.liabilities.map((l) => (
          <div key={l.id} style={{ display: 'grid', gridTemplateColumns: isDesktop ? '3fr 1fr 1fr auto' : '1fr 1fr', gap: 8, alignItems: 'end', padding: '8px 0', borderTop: `1px solid ${C.border}` }}>
            <Field C={C} label="Liability"><Input C={C} value={l.name} onChange={(v) => upL(l.id, 'name', v)} placeholder="e.g. Mortgage — primary residence" /></Field>
            <Field C={C} label="Balance"><Input C={C} value={l.value} onChange={(v) => upL(l.id, 'value', v)} /></Field>
            <Field C={C} label="Rate %"><Input C={C} value={l.rate} onChange={(v) => upL(l.id, 'rate', v)} /></Field>
            <Btn C={C} small ghost onClick={() => setBs({ ...bs, liabilities: bs.liabilities.filter((x) => x.id !== l.id) })}>×</Btn>
          </div>
        ))}
      </Card>
      <Card C={C}>
        <Eyebrow C={C}>Composition</Eyebrow>
        <Row gap={8}>{byType.map((t) => <Pill key={t.value} C={C}>{t.label} · {fmtUsd(t.total, { compact: true })}</Pill>)}<Pill C={C} color={C.up}>Net worth · {fmtUsd(totalAssets(f) - totalLiab(f))}</Pill></Row>
      </Card>
    </div>
  )
}
