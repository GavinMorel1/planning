import { useEffect, useMemo, useState } from 'react'
import { useStore, useFamily } from '../lib/store'
import { Card, Eyebrow, Title, SubTabs, Btn, Note, Select, Confirm, Empty, Spinner } from '../components/ui'
import IntakePanel from '../components/IntakePanel'
import CashflowInputs from '../components/CashflowInputs'
import Overview from '../cashflow/ui/Overview'
import { CashFlowTable, NetWorthTab, TaxesTab } from '../cashflow/ui/Tables'
import { RetirementTab, MonteCarloTab } from '../cashflow/ui/Retirement'
import Scenarios from '../cashflow/ui/Scenarios'
import ReportsTab from '../cashflow/ui/Reports'
import { usePlan } from '../cashflow/ui/useResults'
import { useCashflowModel } from '../lib/cashflowStore'
import { summarizeChange } from '../cashflow/summary'
import { modelGaps } from '../cashflow/types'
import { fmtDate } from '../lib/util'

const TABS = [['overview', 'Overview'], ['table', 'Cash Flow Table'], ['networth', 'Net Worth'], ['taxes', 'Taxes'], ['retirement', 'Retirement'], ['montecarlo', 'Monte Carlo'], ['scenarios', 'Scenarios'], ['reports', 'Reports'], ['inputs', 'Inputs']]

export default function Cashflow({ C, isDesktop, setTab }) {
  const [f] = useFamily()
  const { settings, updateFamily } = useStore()
  const cf = useCashflowModel(f)
  const model = cf.model
  const [sub, setSubState] = useState(() => { try { return localStorage.getItem('planning_cf_sub') || 'overview' } catch { return 'overview' } })
  const setSub = (v) => { setSubState(v); try { localStorage.setItem('planning_cf_sub', v) } catch { /* ignore */ } }
  const [planId, setPlanId] = useState('base')
  const [mcOpts, setMcOpts] = useState({ runs: 1000 })
  const [showHistory, setShowHistory] = useState(false)
  const scenario = planId === 'base' ? null : model.scenarios.find((s) => s.id === planId) || null
  const plan = usePlan(model, settings, scenario, { mcOpts })
  const base = usePlan(model, settings, null, { auto: false })
  const patchAssessment = (p) => updateFamily(f.id, (cur) => ({ ...cur, assessment: { ...(cur.assessment || {}), ...p } }))
  const gaps = useMemo(() => modelGaps(model), [model])
  const noData = cf.ready && !plan.ready

  return (
    <div>
      <Title C={C} isDesktop={isDesktop} sub="Projection, taxes, Monte Carlo, scenarios and client reports built from this family's cash-flow model."
        right={<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11.5, color: C.t4 }}>{cf.saving ? 'Saving…' : cf.exists ? `Saved · v${cf.version}` : 'Not saved yet'}</span>
          <Btn C={C} small ghost onClick={() => setShowHistory(!showHistory)}>History</Btn>
        </div>}>Cashflow · {f.name}</Title>
      {cf.missingTable && <Note C={C} tone="warn" style={{ marginBottom: 12 }}>The cash-flow tables are not in the database yet, so changes are kept in this browser session only. Run <code>supabase/ALL_PENDING_MIGRATIONS.sql</code> in the Supabase SQL Editor.</Note>}
      {cf.error && <Note C={C} tone="danger" style={{ marginBottom: 12 }}><div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}><span style={{ flex: 1 }}>{cf.error}</span><Btn C={C} small onClick={cf.clearError}>Dismiss</Btn></div></Note>}
      {showHistory && <HistoryPanel C={C} cf={cf} close={() => setShowHistory(false)} />}

      <SubTabs C={C} value={sub} onChange={setSub} tabs={TABS.map(([id, label]) => ({ id, label }))} />
      {sub !== 'inputs' && sub !== 'reports' && model.scenarios.length > 0 && sub !== 'scenarios' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.t4, textTransform: 'uppercase', letterSpacing: 1 }}>Plan</span>
          <Select C={C} value={planId} onChange={setPlanId} options={[{ value: 'base', label: 'Base Facts' }, ...model.scenarios.map((s) => ({ value: s.id, label: s.name }))]} style={{ padding: '6px 10px', fontSize: 12.5 }} />
        </div>
      )}

      {!cf.ready ? <Spinner C={C} label="Loading cash-flow model…" /> : (
        <>
          {sub === 'inputs' && (
            <>
              <IntakePanel C={C} isDesktop={isDesktop} family={f} cf={cf} summarize={(b, a) => summarizeChange(b, a, settings)} />
              <CashflowInputs C={C} isDesktop={isDesktop} model={model} save={cf.save} />
            </>
          )}
          {sub === 'reports' && <ReportsTab C={C} isDesktop={isDesktop} family={f} cf={cf} settings={settings} />}
          {sub !== 'inputs' && sub !== 'reports' && noData && (
            <Card C={C}><Empty C={C} icon="◇" title="Enter the household first" action={<Btn C={C} primary onClick={() => setSub('inputs')}>Go to Inputs</Btn>}>The projection needs at least one person with a date of birth and some income or accounts. Or drop statements on Inputs and let Claude propose the numbers.{gaps.length > 0 && <><br />Still needed: {gaps.join(' ')}</>}</Empty></Card>
          )}
          {sub !== 'inputs' && sub !== 'reports' && !noData && plan.error && <Note C={C} tone="danger">The projection could not run: {plan.error}</Note>}
          {!noData && plan.run && sub === 'overview' && <Overview C={C} isDesktop={isDesktop} f={f} model={plan.run.model} run={plan.run} mc={plan.mc} mcBusy={plan.mcBusy} runMc={plan.runMc} patchAssessment={patchAssessment} setSub={setSub} />}
          {!noData && plan.run && sub === 'table' && <CashFlowTable C={C} model={plan.run.model} run={plan.run} />}
          {!noData && plan.run && sub === 'networth' && <NetWorthTab C={C} isDesktop={isDesktop} model={plan.run.model} run={plan.run} />}
          {!noData && plan.run && sub === 'taxes' && <TaxesTab C={C} isDesktop={isDesktop} model={plan.run.model} run={plan.run} />}
          {!noData && plan.run && sub === 'retirement' && <RetirementTab C={C} isDesktop={isDesktop} model={plan.run.model} run={plan.run} cfg={plan.cfg} save={cf.save} />}
          {!noData && plan.run && sub === 'montecarlo' && <MonteCarloTab C={C} isDesktop={isDesktop} model={plan.run.model} run={plan.run} mc={plan.mc} mcBusy={plan.mcBusy} runMc={plan.runMc} mcOpts={mcOpts} setMcOpts={setMcOpts} />}
          {!noData && base.run && sub === 'scenarios' && <Scenarios C={C} isDesktop={isDesktop} model={model} save={cf.save} baseRun={base.run} baseMc={planId === 'base' ? plan.mc : null} settings={settings} />}
        </>
      )}
    </div>
  )
}

function HistoryPanel({ C, cf, close }) {
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { cf.loadHistory().then(setRows).catch(() => setRows([])) }, [cf.version]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Card C={C} style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><Eyebrow C={C}>Change history</Eyebrow><Btn C={C} small ghost onClick={close}>Close</Btn></div>
      {rows == null ? <Spinner C={C} label="Loading…" /> : !rows.length ? <div style={{ fontSize: 12.5, color: C.t4 }}>No saved versions yet.</div> : (
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          {rows.map((r) => (
            <div key={r.version} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: `1px solid ${C.border}`, fontSize: 12.5, flexWrap: 'wrap' }}>
              <b style={{ color: C.t1, width: 40 }}>v{r.version}</b>
              <span style={{ color: C.t3, minWidth: 150 }}>{fmtDate(r.changed_at)} {r.changed_at ? new Date(r.changed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
              <span style={{ color: C.t2, minWidth: 140 }}>{r.changed_by || '—'}</span>
              <span style={{ flex: 1, minWidth: 160, color: C.t3, overflowWrap: 'anywhere' }} title={r.note || ''}>{r.source || 'manual'}{r.note ? ` · ${String(r.note).slice(0, 120)}` : ''}</span>
              {r.version !== cf.version && <Confirm C={C} onConfirm={async () => { setBusy(true); try { await cf.restore(r.version) } finally { setBusy(false) } }}>{busy ? '…' : 'Restore'}</Confirm>}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
