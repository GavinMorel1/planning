import { useState } from 'react'
import { useStore, useFamily } from '../lib/store'
import { Card, Eyebrow, Title, Grid, Field, Input, Note, Btn, Row, Stat } from '../components/ui'
import { fmtUsd, num } from '../lib/util'
import { netWorthOf } from './Families'

// eMoney is the cash-flow engine. This tab keeps the numbers the decks need and reads what
// Claude extracted from uploaded eMoney reports (Documents › eMoney Reports).
export default function Cashflow({ C, isDesktop, setTab }) {
  const [f, patch] = useFamily()
  const a = f.assessment || {}
  const setA = (k, v) => patch({ assessment: { ...a, [k]: v } })
  const emoney = (f.documents?.emoney?.files || []).filter((x) => x.extraction)
  const need = num(a.retirementCashNeed), growth = num(a.cashGrowthPct) || 3
  const years = [0, 1, 2, 3, 4].map((i) => ({ year: new Date().getFullYear() + i, need: Math.round(need * Math.pow(1 + growth / 100, i)) }))
  const income = num(f.profile?.householdIncome)
  const spend = num(a.lifestyleSpend)
  return (
    <div>
      <Title C={C} isDesktop={isDesktop} sub="eMoney remains the cash-flow engine. Keep the figures the decks use here, and upload eMoney exports in Documents for Claude to read." right={<Btn C={C} onClick={() => setTab('documents')}>Upload eMoney reports</Btn>}>Cashflow · {f.name}</Title>
      <Grid cols={isDesktop ? 4 : 2} gap={10} style={{ marginBottom: 14 }}>
        <Stat C={C} label="Household income" value={fmtUsd(income, { compact: true })} />
        <Stat C={C} label="Lifestyle spend" value={fmtUsd(spend, { compact: true })} />
        <Stat C={C} label="Net worth" value={fmtUsd(netWorthOf(f), { compact: true })} />
        <Stat C={C} label="Savings rate" value={income ? `${Math.round((1 - spend / income) * 100)}%` : '—'} color={income && spend / income > 0.9 ? C.dn : C.up} />
      </Grid>
      <Grid cols={isDesktop ? 2 : 1} gap={14}>
        <Card C={C}>
          <Eyebrow C={C}>Inputs</Eyebrow>
          <Grid cols={2} gap={10}>
            <Field C={C} label="Annual lifestyle spending"><Input C={C} value={a.lifestyleSpend} onChange={(v) => setA('lifestyleSpend', v)} placeholder="e.g. 425000" /></Field>
            <Field C={C} label="Emergency reserve target"><Input C={C} value={a.reserveTarget} onChange={(v) => setA('reserveTarget', v)} placeholder="e.g. 250000" /></Field>
            <Field C={C} label="Retirement cash need (year 1)"><Input C={C} value={a.retirementCashNeed} onChange={(v) => setA('retirementCashNeed', v)} placeholder="e.g. 125000" /></Field>
            <Field C={C} label="Cash need growth % / yr"><Input C={C} value={a.cashGrowthPct} onChange={(v) => setA('cashGrowthPct', v)} placeholder="3" /></Field>
            <Field C={C} label="Cash on hand (year 1)"><Input C={C} value={a.cashOnHand} onChange={(v) => setA('cashOnHand', v)} /></Field>
            <Field C={C} label="Monthly income (under-$5M tile)"><Input C={C} value={a.incomeMonthly} onChange={(v) => setA('incomeMonthly', v)} placeholder="e.g. 1750" /></Field>
          </Grid>
        </Card>
        <Card C={C}>
          <Eyebrow C={C}>5-year cash needs (deck slide)</Eyebrow>
          <Row gap={8} style={{ marginTop: 6 }}>
            {years.map((y, i) => (
              <div key={y.year} style={{ flex: 1, minWidth: 90, padding: '12px 10px', borderRadius: 10, background: i === 0 ? C.accentSoft : C.surface, border: `1px solid ${i === 0 ? C.borderActive : C.border}`, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: C.t4, textTransform: 'uppercase', letterSpacing: 1 }}>Year {i + 1}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: C.t1 }}>{need ? fmtUsd(y.need, { compact: true }) : '—'}</div>
                <div style={{ fontSize: 10.5, color: C.t3 }}>{y.year}</div>
              </div>
            ))}
          </Row>
          <div style={{ fontSize: 11.5, color: C.t4, marginTop: 10 }}>Retirement cash need {fmtUsd(need)} · cash on hand {fmtUsd(num(a.cashOnHand))} · grows {growth}% a year.</div>
        </Card>
      </Grid>
      <Card C={C} style={{ marginTop: 14 }}>
        <Eyebrow C={C}>From eMoney</Eyebrow>
        {!emoney.length ? <Note C={C}>No eMoney reports read yet. Upload the cash-flow, balance-sheet and estate reports under Documents › eMoney Reports, click Read, and the extracted figures will appear here.</Note> : emoney.map((x) => (
          <div key={x.id} style={{ padding: '10px 0', borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.t1 }}>{x.name}</div>
            <div style={{ fontSize: 12.5, color: C.t3, margin: '4px 0 8px', lineHeight: 1.5 }}>{x.extraction.summary}</div>
            <Grid cols={isDesktop ? 3 : 1} gap={6}>{(x.extraction.financials || []).map((fin, i) => <div key={i} style={{ fontSize: 12, color: C.t2, display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: C.surface, borderRadius: 6 }}><span style={{ color: C.t3 }}>{fin.label}</span><b>{fin.value}</b></div>)}</Grid>
          </div>
        ))}
      </Card>
    </div>
  )
}
