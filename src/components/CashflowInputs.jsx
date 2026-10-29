// Data entry for the cash-flow model: household, income, expenses, accounts, liabilities, insurance and assumptions.
// Every table edits one typed collection of the CashflowModel (src/cashflow/types.ts).
import { useState } from 'react'
import { Card, Eyebrow, Btn, Field, Input, Select, Grid, Check, SectionLabel } from './ui'
import { ACCOUNT_TYPES, newAccount, newExpense, newIncome, newLiability, newMember, newPolicy } from '../cashflow/types'

const KINDS = {
  income: ['salary', 'business', 'socialSecurity', 'pension', 'rental', 'other'],
  expense: ['lifestyle', 'goal', 'education', 'healthcare', 'housing', 'other'],
  liability: ['mortgage', 'heloc', 'auto', 'student', 'business', 'other'],
  policy: ['term', 'whole', 'universal', 'variable', 'ltc', 'disability', 'umbrella'],
  role: ['primary', 'spouse', 'dependent'],
}
const opts = (xs) => xs.map((x) => ({ value: x, label: x }))

function Cell({ C, col, row, members, onSet }) {
  const v = row[col.key]
  const common = { C, style: { padding: '6px 8px', fontSize: 12.5, minWidth: 0 } }
  if (col.type === 'select') return <Select C={C} value={v} onChange={(x) => onSet(col.key, x)} options={col.options} style={{ ...common.style, width: '100%' }} />
  if (col.type === 'owner') return <Select C={C} value={v ?? ''} onChange={(x) => onSet(col.key, x === '' && col.nullable ? null : x)} options={[...(col.nullable ? [{ value: '', label: '—' }] : [{ value: 'joint', label: 'Joint' }]), ...members.map((m) => ({ value: m.id, label: m.name || 'Member' }))]} style={{ ...common.style, width: '100%' }} />
  if (col.type === 'bool') return <div style={{ paddingTop: 4 }}><Check C={C} checked={Boolean(v)} onChange={(x) => onSet(col.key, x)} label="" /></div>
  if (col.type === 'text' || col.type === 'date') return <Input C={C} type={col.type === 'date' ? 'date' : 'text'} value={v ?? ''} onChange={(x) => onSet(col.key, x)} placeholder={col.ph} {...common} />
  // numbers: blank means null for nullable fields, otherwise 0
  return <Input C={C} value={v === null || v === undefined || (v === 0 && col.blank0) ? '' : String(v)} onChange={(x) => { const t = x.replace(/[$,\s]/g, ''); onSet(col.key, t === '' ? (col.nullable ? null : 0) : Number.isFinite(Number(t)) ? Number(t) : v) }} placeholder={col.ph} {...common} />
}

function Table({ C, isDesktop, title, hint, items, columns, members, onChange, make, empty }) {
  const set = (id, k, v) => onChange(items.map((r) => (r.id === id ? { ...r, [k]: v } : r)))
  const grid = `${columns.map((c) => `minmax(${isDesktop ? 92 : 120}px, ${c.w || 1}fr)`).join(' ')} 30px`
  return (
    <Card C={C} style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Eyebrow C={C} style={{ marginBottom: 2 }}>{title}</Eyebrow>
        <Btn C={C} small onClick={() => onChange([...items, make()])}>+ Add</Btn>
      </div>
      {hint && <div style={{ fontSize: 11.5, color: C.t4, marginBottom: 8 }}>{hint}</div>}
      {!items.length ? <div style={{ fontSize: 12.5, color: C.t4, padding: '8px 0' }}>{empty}</div> : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: columns.length * 100 + 30 }}>
            <div style={{ display: 'grid', gridTemplateColumns: grid, gap: 6, fontSize: 10, fontWeight: 700, color: C.t4, textTransform: 'uppercase', letterSpacing: 0.8, padding: '4px 0' }}>
              {columns.map((c) => <span key={c.key}>{c.label}</span>)}<span />
            </div>
            {items.map((r) => (
              <div key={r.id} style={{ display: 'grid', gridTemplateColumns: grid, gap: 6, alignItems: 'center', padding: '4px 0', borderTop: `1px solid ${C.border}` }}>
                {columns.map((c) => <Cell key={c.key} C={C} col={c} row={r} members={members} onSet={(k, v) => set(r.id, k, v)} />)}
                <button aria-label="Remove row" title="Remove" onClick={() => onChange(items.filter((x) => x.id !== r.id))} style={{ background: 'transparent', border: 'none', color: C.t4, cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

export default function CashflowInputs({ C, isDesktop, model, save }) {
  const upd = (k) => (list) => save((m) => ({ ...m, [k]: list }), { source: 'manual', note: `Edited ${k}` })
  const A = model.assumptions
  const setA = (patch) => save((m) => ({ ...m, assumptions: { ...m.assumptions, ...patch } }), { source: 'manual', note: 'Edited assumptions' })
  const nf = (key, label, ph, extra = {}) => ({ key, label, type: 'num', ph, ...extra })
  const [moveErr] = useState('')
  const order = A.withdrawalOrder
  const move = (i, d) => { const o = [...order]; const j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; setA({ withdrawalOrder: o }) }
  const ORDER_LABEL = { cash: 'Cash', taxable: 'Taxable', traditional: 'Traditional IRA / 401(k)', roth: 'Roth', hsa: 'HSA' }
  const common = { C, isDesktop, members: model.members }
  return (
    <div>
      <Table {...common} title="Household" hint="Dates of birth drive ages, Social Security and RMDs. The plan runs to the last life expectancy." items={model.members} onChange={upd('members')} make={() => newMember(model.members.length ? 'spouse' : 'primary')} empty="Add each adult in the household."
        columns={[{ key: 'name', label: 'Name', type: 'text', w: 1.4 }, { key: 'role', label: 'Role', type: 'select', options: opts(KINDS.role) }, { key: 'dob', label: 'Date of birth', type: 'date', w: 1.1 }, nf('retirementAge', 'Retire at'), nf('lifeExpectancy', 'Life exp.'), nf('ssPiaMonthly', 'SS / mo at FRA', '0'), nf('ssClaimAge', 'SS claim age'), nf('ssFra', 'FRA')]} />
      <Table {...common} title="Income" hint="Today's dollars per year. Social Security comes from each member's benefit above; add a Social Security row only to override it." items={model.income} onChange={upd('income')} make={() => newIncome({ ownerId: model.members[0]?.id || 'joint' })} empty="Salary, business, pension, rental and other income."
        columns={[{ key: 'name', label: 'Name', type: 'text', w: 1.3 }, { key: 'kind', label: 'Kind', type: 'select', options: opts(KINDS.income) }, { key: 'ownerId', label: 'Owner', type: 'owner' }, nf('annual', 'Per year'), nf('startYear', 'From', 'now', { nullable: true }), nf('endYear', 'Until', 'retire', { nullable: true }), nf('growthPct', 'Growth %', 'default', { nullable: true }), { key: 'taxable', label: 'Taxable', type: 'bool', w: 0.6 }]} />
      <Table {...common} title="Expenses" hint="Today's dollars per year, inflated by the assumptions. A one-time year makes it a single payment." items={model.expenses} onChange={upd('expenses')} make={() => newExpense()} empty="Lifestyle spending, goals, education, healthcare."
        columns={[{ key: 'name', label: 'Name', type: 'text', w: 1.3 }, { key: 'kind', label: 'Kind', type: 'select', options: opts(KINDS.expense) }, nf('annual', 'Per year'), nf('startYear', 'From', 'now', { nullable: true }), nf('endYear', 'Until', 'end', { nullable: true }), nf('oneTimeYear', 'One-time year', '', { nullable: true }), nf('inflationPct', 'Inflation %', 'default', { nullable: true }), nf('survivorPct', 'Survivor %', 'default', { nullable: true })]} />
      <Table {...common} title="Accounts" hint="Balances today. Contributions stop at the owner's retirement unless an end year is set. Real estate and business are not drawn on unless sold." items={model.accounts} onChange={upd('accounts')} make={() => newAccount({ ownerId: 'joint' })} empty="Taxable, IRA/401(k), Roth, HSA, cash, real estate, business."
        columns={[{ key: 'name', label: 'Name', type: 'text', w: 1.3 }, { key: 'type', label: 'Type', type: 'select', options: ACCOUNT_TYPES.map((t) => ({ value: t.id, label: t.label })), w: 1.2 }, { key: 'ownerId', label: 'Owner', type: 'owner' }, nf('balance', 'Balance'), nf('contributionAnnual', 'Saves / yr', '0'), nf('contributionEndYear', 'Saves until', 'retire', { nullable: true }), nf('returnPct', 'Return %', 'default', { nullable: true }), nf('stdDevPct', 'Std dev %', 'default', { nullable: true }), nf('costBasis', 'Cost basis', '', { nullable: true }), nf('saleYear', 'Sale year', '', { nullable: true })]} />
      <Table {...common} title="Liabilities" hint="Leave the payment at 0 to compute it from balance, rate and remaining term." items={model.liabilities} onChange={upd('liabilities')} make={() => newLiability()} empty="Mortgage, HELOC, auto, student and business loans."
        columns={[{ key: 'name', label: 'Name', type: 'text', w: 1.3 }, { key: 'kind', label: 'Kind', type: 'select', options: opts(KINDS.liability) }, nf('balance', 'Balance'), nf('ratePct', 'Rate %'), nf('paymentMonthly', 'Payment / mo', '0'), nf('termMonths', 'Months left')]} />
      <Table {...common} title="Insurance policies" hint="A policy owned by an irrevocable trust (ILIT) is outside the taxable estate: untick “in estate”." items={model.insurance} onChange={upd('insurance')} make={() => newPolicy({ insuredId: model.members[0]?.id || null })} empty="Term, permanent, long-term care, disability, umbrella."
        columns={[{ key: 'name', label: 'Name', type: 'text', w: 1.3 }, { key: 'kind', label: 'Kind', type: 'select', options: opts(KINDS.policy) }, { key: 'insuredId', label: 'Insured', type: 'owner', nullable: true }, { key: 'ownerName', label: 'Owner / trust', type: 'text' }, nf('deathBenefit', 'Death benefit'), nf('cashValue', 'Cash value', '0'), nf('premiumAnnual', 'Premium / yr', '0'), nf('premiumEndYear', 'Premiums until', '', { nullable: true }), { key: 'inEstate', label: 'In estate', type: 'bool', w: 0.6 }]} />
      <Card C={C}>
        <Eyebrow C={C}>Assumptions</Eyebrow>
        <Grid cols={isDesktop ? 4 : 2} gap={10}>
          <Field C={C} label="First projection year"><Input C={C} value={A.baseYear} onChange={(x) => setA({ baseYear: Number(x) || A.baseYear })} /></Field>
          <Field C={C} label="Inflation %"><Input C={C} value={A.inflationPct} onChange={(x) => setA({ inflationPct: Number(x) || 0 })} /></Field>
          <Field C={C} label="Healthcare inflation %"><Input C={C} value={A.healthcareInflationPct} onChange={(x) => setA({ healthcareInflationPct: Number(x) || 0 })} /></Field>
          <Field C={C} label="Salary growth %"><Input C={C} value={A.salaryGrowthPct} onChange={(x) => setA({ salaryGrowthPct: Number(x) || 0 })} /></Field>
          <Field C={C} label="Default return %"><Input C={C} value={A.returnPct} onChange={(x) => setA({ returnPct: Number(x) || 0 })} /></Field>
          <Field C={C} label="Default std dev %" hint="Monte Carlo"><Input C={C} value={A.stdDevPct} onChange={(x) => setA({ stdDevPct: Number(x) || 0 })} /></Field>
          <Field C={C} label="Social Security COLA %"><Input C={C} value={A.ssColaPct} onChange={(x) => setA({ ssColaPct: Number(x) || 0 })} /></Field>
          <Field C={C} label="Survivor spending %" hint="Kept after the first death"><Input C={C} value={A.survivorExpensePct} onChange={(x) => setA({ survivorExpensePct: Number(x) || 0 })} /></Field>
          <Field C={C} label="Filing status"><Select C={C} value={A.filingStatus} onChange={(x) => setA({ filingStatus: x })} options={[{ value: 'mfj', label: 'Married filing jointly' }, { value: 'single', label: 'Single' }, { value: 'hoh', label: 'Head of household' }, { value: 'mfs', label: 'Married filing separately' }]} style={{ width: '100%' }} /></Field>
          <Field C={C} label="State (2 letters)"><Input C={C} value={A.state} onChange={(x) => setA({ state: x.slice(0, 2).toUpperCase() })} /></Field>
          <Field C={C} label="State tax % override" hint="Blank = estimate by state"><Input C={C} value={A.stateTaxRatePct ?? ''} onChange={(x) => setA({ stateTaxRatePct: x === '' ? null : Number(x) || 0 })} /></Field>
          <Field C={C} label="Cash reserve to keep $"><Input C={C} value={A.cashReserveTarget} onChange={(x) => setA({ cashReserveTarget: Number(String(x).replace(/[$,]/g, '')) || 0 })} /></Field>
          <Field C={C} label="Annual gifting $" hint="Out of the estate"><Input C={C} value={A.giftingAnnual} onChange={(x) => setA({ giftingAnnual: Number(String(x).replace(/[$,]/g, '')) || 0 })} /></Field>
          <Field C={C} label="Estate exemption override $" hint="Blank = Settings"><Input C={C} value={A.estateExemption ?? ''} onChange={(x) => setA({ estateExemption: x === '' ? null : Number(String(x).replace(/[$,]/g, '')) || 0 })} /></Field>
        </Grid>
        <SectionLabel C={C}>Withdrawal order (first to last when income is short)</SectionLabel>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {order.map((k, i) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, fontSize: 12.5, color: C.t1, fontWeight: 700 }}>
              <span style={{ color: C.accent }}>{i + 1}</span> {ORDER_LABEL[k]}
              <button aria-label={`Move ${ORDER_LABEL[k]} earlier`} disabled={i === 0} onClick={() => move(i, -1)} style={{ background: 'transparent', border: 'none', color: i === 0 ? C.t4 : C.t1, cursor: i === 0 ? 'default' : 'pointer' }}>◀</button>
              <button aria-label={`Move ${ORDER_LABEL[k]} later`} disabled={i === order.length - 1} onClick={() => move(i, 1)} style={{ background: 'transparent', border: 'none', color: i === order.length - 1 ? C.t4 : C.t1, cursor: i === order.length - 1 ? 'default' : 'pointer' }}>▶</button>
            </div>
          ))}
        </div>
        <SectionLabel C={C}>Roth conversions</SectionLabel>
        {(A.rothConversions || []).map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <Input C={C} value={r.year} onChange={(x) => setA({ rothConversions: A.rothConversions.map((q, k) => (k === i ? { ...q, year: Number(x) || 0 } : q)) })} placeholder="Year" style={{ width: 100 }} />
            <Input C={C} value={r.amount} onChange={(x) => setA({ rothConversions: A.rothConversions.map((q, k) => (k === i ? { ...q, amount: Number(String(x).replace(/[$,]/g, '')) || 0 } : q)) })} placeholder="Amount $" style={{ width: 160 }} />
            <Btn C={C} small ghost onClick={() => setA({ rothConversions: A.rothConversions.filter((_, k) => k !== i) })}>×</Btn>
          </div>
        ))}
        <Btn C={C} small onClick={() => setA({ rothConversions: [...(A.rothConversions || []), { year: A.baseYear + 1, amount: 50000 }] })}>+ Roth conversion</Btn>
        {moveErr}
      </Card>
    </div>
  )
}
