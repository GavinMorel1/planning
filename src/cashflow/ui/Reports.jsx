// Cashflow > Reports: pick a family's plan (or compare two), choose sections, add a narrative and action items, export to a
// branded PDF or PowerPoint, save templates, and keep a history that can rebuild any past report from its saved model version.
import { useMemo, useState } from 'react'
import { Card, Eyebrow, Grid, Row, Btn, Field, Input, Select, TextArea, Note, Check, Pill, Confirm } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { useStore } from '../../lib/store'
import { CLAUDE_ENABLED, writeNarrative } from '../../lib/claude'
import { COPY } from '../../data/defaults'
import { download, fmtDate, nowIso, today, uid } from '../../lib/util'
import { engineConfig } from '../run'
import { assembleReport } from '../reports/assemble'
import { DEFAULT_SECTIONS, REPORT_SECTIONS, narrativeFacts } from '../reports/content'
import { normalizeModel } from '../types'

const slug = (s) => String(s || '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const defaultDisclosure = (settings) => settings.copy?.cashflowDisclosure || COPY.hypothetical

export default function ReportsTab({ C, isDesktop, family, cf, settings }) {
  const { updateSettings, updateFamily } = useStore()
  const { email } = useAuth()
  const model = cf.model
  const [form, setForm] = useState({ title: 'Cash Flow Analysis', scenarioA: 'base', scenarioB: '', sections: DEFAULT_SECTIONS, narrative: '', actions: '', date: today() })
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [tplName, setTplName] = useState('')
  const set = (p) => setForm((x) => ({ ...x, ...p }))
  const templates = settings.reportTemplates || []
  const history = [...(family.cashflowReports || [])].reverse()
  const planOptions = [{ value: 'base', label: 'Base Facts' }, ...model.scenarios.map((s) => ({ value: s.id, label: s.name }))]
  const ids = [form.scenarioA, ...(form.scenarioB ? [form.scenarioB] : [])]
  const actionItems = useMemo(() => form.actions.split('\n').map((x) => x.trim()).filter(Boolean), [form.actions])
  const cfg = useMemo(() => engineConfig(settings), [settings.tax]) // eslint-disable-line react-hooks/exhaustive-deps

  const request = (m, over = {}) => ({ familyName: family.name, title: form.title, preparedBy: email || 'Paradiem', date: form.date, model: m, scenarioIds: ids, sections: form.sections, narrative: form.narrative, actionItems, disclosure: defaultDisclosure(settings), cfg, ...over })

  const narrate = async () => {
    setBusy('narrative'); setErr('')
    try {
      const inp = assembleReport(request(model))
      set({ narrative: await writeNarrative({ familyName: family.name, facts: narrativeFacts(inp) }) })
    } catch (e) { setErr(e?.message || 'Could not write the narrative') }
    setBusy('')
  }

  const exportReport = async (format) => {
    setBusy(format); setErr('')
    try {
      await cf.save(model, { source: `report snapshot (${format})`, note: `${form.title}` }, { immediate: true }) // pin the exact model version this report used
      const version = cf.currentVersion()
      const inp = assembleReport(request(model))
      const filename = `${slug(family.name)}-${slug(form.title)}-${form.date}.${format}`
      if (format === 'pdf') { const { buildReportPdf } = await import('../reports/pdf'); const { logoData } = await import('../../lib/deckkit'); download(await buildReportPdf(inp, { logo: await logoData().catch(() => null) }), filename) }
      else { const { buildReportPptx } = await import('../reports/pptx'); download(await buildReportPptx(inp), filename) }
      const entry = { id: uid(), createdAt: nowIso(), preparer: email || 'local', format, filename, title: form.title, date: form.date, modelVersion: version, scenarioIds: ids, scenarioNames: inp.scenarios.map((s) => s.name), sections: form.sections, narrative: form.narrative, actionItems, disclosure: defaultDisclosure(settings), cfg: { estateExemption: cfg.estateExemption, estateTaxRate: cfg.estateTaxRate } }
      updateFamily(family.id, (f) => ({ ...f, cashflowReports: [...(f.cashflowReports || []), entry] }))
    } catch (e) { setErr(e?.message || 'Export failed'); console.error(e) }
    setBusy('')
  }

  // Rebuild an old report from the model version and tax constants recorded when it was made.
  const reproduce = async (h, format = h.format) => {
    setBusy(`re-${h.id}`); setErr('')
    try {
      const m = h.modelVersion ? await cf.getVersion(h.modelVersion) : model
      const inp = assembleReport({ familyName: family.name, title: h.title, preparedBy: h.preparer, date: h.date, model: normalizeModel(m), scenarioIds: h.scenarioIds, sections: h.sections, narrative: h.narrative, actionItems: h.actionItems, disclosure: h.disclosure, cfg: { ...cfg, ...(h.cfg || {}) } })
      const filename = `${slug(family.name)}-${slug(h.title)}-${h.date}-v${h.modelVersion}.${format}`
      if (format === 'pdf') { const { buildReportPdf } = await import('../reports/pdf'); const { logoData } = await import('../../lib/deckkit'); download(await buildReportPdf(inp, { logo: await logoData().catch(() => null) }), filename) }
      else { const { buildReportPptx } = await import('../reports/pptx'); download(await buildReportPptx(inp), filename) }
    } catch (e) { setErr(`Could not rebuild: ${e?.message || e}`) }
    setBusy('')
  }

  const saveTemplate = () => { if (!tplName.trim()) return; updateSettings((s) => ({ ...s, reportTemplates: [...(s.reportTemplates || []), { id: uid(), name: tplName.trim(), title: form.title, sections: form.sections, actions: form.actions, compare: Boolean(form.scenarioB) }] })); setTplName('') }
  const loadTemplate = (t) => set({ title: t.title, sections: t.sections, actions: t.actions || '' })
  const toggle = (id) => set({ sections: form.sections.includes(id) ? form.sections.filter((x) => x !== id) : REPORT_SECTIONS.map((s) => s.id).filter((x) => x === id || form.sections.includes(x)) })

  return (
    <div>
      {err && <Note C={C} tone="danger" style={{ marginBottom: 12 }}>{err}</Note>}
      <Grid cols={isDesktop ? 2 : 1} gap={14}>
        <Card C={C}>
          <Eyebrow C={C}>Report builder · {family.name}</Eyebrow>
          <Grid cols={2} gap={10}>
            <Field C={C} label="Report title" style={{ gridColumn: '1 / -1' }}><Input C={C} value={form.title} onChange={(v) => set({ title: v })} /></Field>
            <Field C={C} label="Plan"><Select C={C} value={form.scenarioA} onChange={(v) => set({ scenarioA: v })} options={planOptions} style={{ width: '100%' }} /></Field>
            <Field C={C} label="Compare with (optional)"><Select C={C} value={form.scenarioB} onChange={(v) => set({ scenarioB: v })} options={[{ value: '', label: 'None' }, ...planOptions.filter((p) => p.value !== form.scenarioA)]} style={{ width: '100%' }} /></Field>
            <Field C={C} label="Report date"><Input C={C} type="date" value={form.date} onChange={(v) => set({ date: v })} /></Field>
            <Field C={C} label="Prepared by"><div style={{ padding: '9px 12px', borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, fontSize: 13, color: C.t2 }}>{email || 'local user'}</div></Field>
          </Grid>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.accent, textTransform: 'uppercase', letterSpacing: 1.2, margin: '14px 0 6px' }}>Sections</div>
          <Grid cols={2} gap={4}>{REPORT_SECTIONS.map((s) => <Check key={s.id} C={C} checked={form.sections.includes(s.id)} onChange={() => toggle(s.id)} label={s.label} />)}</Grid>
          <Field C={C} label="Action items (one per line)" style={{ marginTop: 12 }}><TextArea C={C} rows={3} value={form.actions} onChange={(v) => set({ actions: v })} placeholder={'Update beneficiary designations\nSchedule Roth conversion review'} /></Field>
        </Card>
        <Card C={C}>
          <Row style={{ marginBottom: 6 }}>
            <Eyebrow C={C} style={{ marginBottom: 0 }}>Narrative</Eyebrow><span style={{ flex: 1 }} />
            <Btn C={C} small disabled={!CLAUDE_ENABLED || busy === 'narrative'} onClick={narrate}>{busy === 'narrative' ? 'Writing…' : form.narrative ? 'Rewrite with Claude' : 'Narrative'}</Btn>
          </Row>
          {!CLAUDE_ENABLED && <Note C={C} tone="warn" style={{ marginBottom: 8 }}>The Narrative button needs the Claude connection (VITE_PROXY_URL). You can write the summary by hand.</Note>}
          <TextArea C={C} rows={11} value={form.narrative} onChange={(v) => set({ narrative: v })} placeholder="A plain-English summary appears here. Claude is given only the computed numbers; edit it freely before exporting." />
          <div style={{ fontSize: 11.5, color: C.t4, margin: '6px 0 12px' }}>Appears on the first page of the report. Only the results (probability of success, net worth, taxes, shortfall years, estate tax) are sent to Claude.</div>
          <Row>
            <Btn C={C} primary disabled={!!busy || !form.sections.length} onClick={() => exportReport('pdf')}>{busy === 'pdf' ? 'Building PDF…' : 'Export PDF'}</Btn>
            <Btn C={C} disabled={!!busy || !form.sections.length} onClick={() => exportReport('pptx')}>{busy === 'pptx' ? 'Building…' : 'Export PowerPoint'}</Btn>
          </Row>
          <div style={{ fontSize: 11.5, color: C.t4, marginTop: 8 }}>The compliance disclosure printed on the Assumptions page is edited in Settings › Firm averages.</div>
        </Card>
      </Grid>

      <Grid cols={isDesktop ? 2 : 1} gap={14} style={{ marginTop: 14 }}>
        <Card C={C}>
          <Eyebrow C={C}>Templates</Eyebrow>
          {!templates.length && <div style={{ fontSize: 12.5, color: C.t4, marginBottom: 8 }}>Save the current title, sections and action items as a template, e.g. “Gap Analysis Cash Flow” or “Annual Review”.</div>}
          {templates.map((t) => (
            <Row key={t.id} gap={8} style={{ padding: '6px 0', borderTop: `1px solid ${C.border}` }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: C.t1 }}>{t.name} <span style={{ color: C.t4, fontWeight: 500 }}>· {t.sections.length} sections</span></span>
              <Btn C={C} small onClick={() => loadTemplate(t)}>Use</Btn>
              <Confirm C={C} onConfirm={() => updateSettings((s) => ({ ...s, reportTemplates: (s.reportTemplates || []).filter((x) => x.id !== t.id) }))}>Delete</Confirm>
            </Row>
          ))}
          <Row gap={8} style={{ marginTop: 8 }}><Input C={C} value={tplName} onChange={setTplName} placeholder="Template name" style={{ flex: 1 }} /><Btn C={C} small disabled={!tplName.trim()} onClick={saveTemplate}>Save as template</Btn></Row>
        </Card>
        <Card C={C}>
          <Eyebrow C={C}>History · {family.name}</Eyebrow>
          {!history.length ? <div style={{ fontSize: 12.5, color: C.t4 }}>No reports exported yet.</div> : history.map((h) => (
            <div key={h.id} style={{ padding: '8px 0', borderTop: `1px solid ${C.border}` }}>
              <Row gap={8}>
                <span style={{ flex: 1, minWidth: 0 }}><b style={{ color: C.t1, fontSize: 13 }}>{h.title}</b> <Pill C={C}>{h.format}</Pill><div style={{ fontSize: 11.5, color: C.t4 }}>{fmtDate(h.createdAt)} · {h.preparer} · {h.scenarioNames.join(' vs ')} · model v{h.modelVersion}</div></span>
                <Btn C={C} small disabled={!!busy} onClick={() => reproduce(h)} title="Rebuild from the saved model version and constants">{busy === `re-${h.id}` ? '…' : 'Rebuild'}</Btn>
              </Row>
            </div>
          ))}
        </Card>
      </Grid>
    </div>
  )
}
