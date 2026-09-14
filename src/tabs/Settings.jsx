import { useState } from 'react'
import { useStore } from '../lib/store'
import { useAuth } from '../lib/auth'
import { CLAUDE_ENABLED, MODEL } from '../lib/claude'
import { Card, Eyebrow, Title, SubTabs, Btn, Input, Field, Grid, Row, Note, TextArea, Pill, Confirm } from '../components/ui'
import { DEFAULT_SETTINGS } from '../data/defaults'
import { download } from '../lib/util'

export default function Settings({ C, isDesktop, themeName, setThemeName }) {
  const { settings, updateSettings, mode, exportAll, importAll, families } = useStore()
  const { email, signOut, localMode } = useAuth()
  const [sub, setSub] = useState('performance')
  const year = new Date().getFullYear()

  return (
    <div>
      <Title C={C} isDesktop={isDesktop} sub="Shared by the whole team. Changes flow into every deck the next time it is generated.">Settings</Title>
      <SubTabs C={C} value={sub} onChange={setSub} tabs={[{ id: 'performance', label: 'Quarterly performance' }, { id: 'tax', label: 'Tax constants' }, { id: 'fees', label: 'Fee schedule' }, { id: 'roster', label: 'Team roster' }, { id: 'firm', label: 'Firm averages' }, { id: 'system', label: 'System' }]} />

      {sub === 'performance' && <Performance C={C} isDesktop={isDesktop} settings={settings} updateSettings={updateSettings} />}

      {sub === 'tax' && (() => {
        const years = Object.keys(settings.tax || {}).sort()
        const [y, setY] = [settings._taxYear || years[years.length - 1] || String(year), (v) => updateSettings({ _taxYear: v })]
        const t = settings.tax?.[y] || {}
        const set = (k, v) => updateSettings((s) => ({ ...s, tax: { ...s.tax, [y]: { ...s.tax[y], [k]: v === '' ? '' : isNaN(Number(v)) ? v : Number(v) } } }))
        const fields = [['estateExemption', 'Estate exemption (per person)'], ['gstExemption', 'GST exemption'], ['annualExclusion', 'Annual gift exclusion'], ['estateTaxRate', 'Estate tax rate %'], ['topOrdinaryRate', 'Top ordinary rate %'], ['ltcgRate', 'Long-term capital gains rate %'], ['niit', 'NIIT %'], ['recaptureRate', 'Depreciation recapture %'], ['corporateRate', 'Corporate rate %'], ['qsbsCap', 'QSBS exclusion cap'], ['qofWindowDays', 'QOF window (days)'], ['exch1031IdDays', '1031 identification (days)'], ['exch1031CloseDays', '1031 close (days)'], ['charitableAgiFloorPct', 'Charitable AGI floor %'], ['charitableCashAgiLimitPct', 'Cash gift AGI limit %'], ['charitableApprecAgiLimitPct', 'Appreciated gift AGI limit %'], ['iraLimit', 'IRA limit'], ['k401Limit', '401(k) limit']]
        return (
          <Card C={C}>
            <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <Row><Eyebrow C={C} style={{ marginBottom: 0 }}>Tax year</Eyebrow>{years.map((yy) => <Btn key={yy} C={C} small primary={yy === y} onClick={() => setY(yy)}>{yy}</Btn>)}<Btn C={C} small ghost onClick={() => { const ny = String(Number(years[years.length - 1] || year) + 1); updateSettings((s) => ({ ...s, tax: { ...s.tax, [ny]: { ...s.tax[years[years.length - 1]], note: `Copied from ${years[years.length - 1]}. Verify.` } }, _taxYear: ny })) }}>+ Next year</Btn></Row>
            </Row>
            <Note C={C} tone="warn" style={{ marginBottom: 12 }}>{t.note || 'Verify with the tax team each January and after any legislation.'}</Note>
            <Grid cols={isDesktop ? 3 : 1} gap={10}>{fields.map(([k, l]) => <Field key={k} C={C} label={l}><Input C={C} value={t[k]} onChange={(v) => set(k, v)} /></Field>)}</Grid>
            <Field C={C} label="Note" style={{ marginTop: 10 }}><Input C={C} value={t.note} onChange={(v) => set('note', v)} /></Field>
          </Card>
        )
      })()}

      {sub === 'fees' && (() => {
        const fs = settings.feeSchedule || DEFAULT_SETTINGS.feeSchedule
        const set = (path, v) => updateSettings((s) => { const next = structuredClone(s.feeSchedule || DEFAULT_SETTINGS.feeSchedule); const ks = path.split('.'); let o = next; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; o[ks[ks.length - 1]] = isNaN(Number(v)) ? v : Number(v); return { ...s, feeSchedule: next } })
        return (
          <Grid cols={isDesktop ? 2 : 1} gap={14}>
            <Card C={C}>
              <Eyebrow C={C}>Family Capital Architecture</Eyebrow>
              <Grid cols={3} gap={10}>
                <Field C={C} label="Gap Analysis bps"><Input C={C} value={fs.gapAnalysis.bps} onChange={(v) => set('gapAnalysis.bps', v)} /></Field>
                <Field C={C} label="Min"><Input C={C} value={fs.gapAnalysis.min} onChange={(v) => set('gapAnalysis.min', v)} /></Field>
                <Field C={C} label="Max"><Input C={C} value={fs.gapAnalysis.max} onChange={(v) => set('gapAnalysis.max', v)} /></Field>
                <Field C={C} label="Blueprint Y1 bps"><Input C={C} value={fs.blueprintYear1.bps} onChange={(v) => set('blueprintYear1.bps', v)} /></Field>
                <Field C={C} label="Min / mo"><Input C={C} value={fs.blueprintYear1.minMo} onChange={(v) => set('blueprintYear1.minMo', v)} /></Field>
                <Field C={C} label="Max / mo"><Input C={C} value={fs.blueprintYear1.maxMo} onChange={(v) => set('blueprintYear1.maxMo', v)} /></Field>
                <Field C={C} label="Blueprint Y2+ bps"><Input C={C} value={fs.blueprintYear2.bps} onChange={(v) => set('blueprintYear2.bps', v)} /></Field>
                <Field C={C} label="Min / mo"><Input C={C} value={fs.blueprintYear2.minMo} onChange={(v) => set('blueprintYear2.minMo', v)} /></Field>
                <Field C={C} label="Max / mo"><Input C={C} value={fs.blueprintYear2.maxMo} onChange={(v) => set('blueprintYear2.maxMo', v)} /></Field>
              </Grid>
              <Field C={C} label="Compliance note (printed on fee slides)" style={{ marginTop: 10 }}><Input C={C} value={fs.note} onChange={(v) => set('note', v)} /></Field>
            </Card>
            <Card C={C}>
              <Eyebrow C={C}>Investment management (AUM)</Eyebrow>
              {fs.aum.map((t, i) => (
                <Grid key={i} cols={2} gap={10} style={{ marginBottom: 8 }}>
                  <Field C={C} label={`Tier ${i + 1} up to`}><Input C={C} value={t.upTo === Infinity || t.upTo == null ? '' : t.upTo} onChange={(v) => set(`aum.${i}.upTo`, v === '' ? Infinity : v)} placeholder="∞" /></Field>
                  <Field C={C} label="Annual rate %"><Input C={C} value={t.rate} onChange={(v) => set(`aum.${i}.rate`, v)} /></Field>
                </Grid>
              ))}
            </Card>
          </Grid>
        )
      })()}

      {sub === 'roster' && (
        <Card C={C}>
          <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}><Eyebrow C={C} style={{ marginBottom: 0 }}>Your Team & Advocates</Eyebrow><Btn C={C} small onClick={() => updateSettings((s) => ({ ...s, roster: [...s.roster, { name: '', title: '' }] }))}>+ Add person</Btn></Row>
          <div style={{ fontSize: 12, color: C.t3, marginBottom: 10 }}>Four per slide, in this order. Photos are added later in PowerPoint (or drop a headshot URL when we wire storage for them).</div>
          {(settings.roster || []).map((p, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: isDesktop ? '1fr 1.4fr auto auto' : '1fr 1fr', gap: 8, alignItems: 'end', padding: '8px 0', borderTop: `1px solid ${C.border}` }}>
              <Field C={C} label="Name"><Input C={C} value={p.name} onChange={(v) => updateSettings((s) => ({ ...s, roster: s.roster.map((x, k) => k === i ? { ...x, name: v } : x) }))} /></Field>
              <Field C={C} label="Title"><Input C={C} value={p.title} onChange={(v) => updateSettings((s) => ({ ...s, roster: s.roster.map((x, k) => k === i ? { ...x, title: v } : x) }))} /></Field>
              <Btn C={C} small ghost disabled={i === 0} onClick={() => updateSettings((s) => { const r = [...s.roster]; [r[i - 1], r[i]] = [r[i], r[i - 1]]; return { ...s, roster: r } })}>↑</Btn>
              <Btn C={C} small ghost onClick={() => updateSettings((s) => ({ ...s, roster: s.roster.filter((_, k) => k !== i) }))}>×</Btn>
            </div>
          ))}
        </Card>
      )}

      {sub === 'firm' && (
        <Card C={C}>
          <Eyebrow C={C}>"What the Numbers Reveal" — firm-wide averages</Eyebrow>
          <div style={{ fontSize: 12, color: C.t3, marginBottom: 10 }}>Fixed slide in every Assessment deck. Average results from serving hundreds of families over 40+ years.</div>
          {Object.entries(settings.firmAverages || {}).map(([k, v]) => (
            <Grid key={k} cols={isDesktop ? 4 : 2} gap={8} style={{ padding: '8px 0', borderTop: `1px solid ${C.border}` }}>
              <Field C={C} label="Headline"><Input C={C} value={v.pct} onChange={(x) => updateSettings((s) => ({ ...s, firmAverages: { ...s.firmAverages, [k]: { ...v, pct: x } } }))} /></Field>
              <Field C={C} label="Label"><Input C={C} value={v.label} onChange={(x) => updateSettings((s) => ({ ...s, firmAverages: { ...s.firmAverages, [k]: { ...v, label: x } } }))} /></Field>
              <Field C={C} label="Dollar figure"><Input C={C} value={v.amount} onChange={(x) => updateSettings((s) => ({ ...s, firmAverages: { ...s.firmAverages, [k]: { ...v, amount: Number(x) || 0 } } }))} /></Field>
              <Field C={C} label="Footnote"><Input C={C} value={v.footnote || ''} onChange={(x) => updateSettings((s) => ({ ...s, firmAverages: { ...s.firmAverages, [k]: { ...v, footnote: x } } }))} /></Field>
            </Grid>
          ))}
        </Card>
      )}

      {sub === 'system' && (
        <Grid cols={isDesktop ? 2 : 1} gap={14}>
          <Card C={C}>
            <Eyebrow C={C}>Account & appearance</Eyebrow>
            <div style={{ fontSize: 12.5, color: C.t3, marginBottom: 10 }}>{localMode ? 'Local mode: no login, data lives in this browser only.' : `Signed in as ${email}`}</div>
            <Row>{['dark', 'light'].map((t) => <Btn key={t} C={C} small primary={themeName === t} onClick={() => setThemeName(t)}>{t === 'dark' ? 'Dark' : 'Light'}</Btn>)}{!localMode && <Btn C={C} small ghost onClick={signOut}>Sign out</Btn>}</Row>
          </Card>
          <Card C={C}>
            <Eyebrow C={C}>Integrations</Eyebrow>
            {[['Data storage', mode === 'local' ? 'Local browser (set VITE_SUPABASE_URL / ANON_KEY to share)' : 'Supabase · shared', mode !== 'local'], ['Claude', CLAUDE_ENABLED ? `Connected via Worker · ${MODEL}` : 'Not configured (set VITE_PROXY_URL)', CLAUDE_ENABLED], ['eMoney', 'Manual export upload (Documents › eMoney Reports)', true]].map(([l, v, ok]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: `1px solid ${C.border}`, fontSize: 12.5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: ok ? C.up : C.warn }} /><b style={{ color: C.t1, width: 100 }}>{l}</b><span style={{ color: C.t3 }}>{v}</span>
              </div>
            ))}
            <div style={{ fontSize: 11.5, color: C.t4, marginTop: 10 }}>Setup instructions: docs/SETUP.md in the repository.</div>
          </Card>
          <Card C={C}>
            <Eyebrow C={C}>Backup</Eyebrow>
            <div style={{ fontSize: 12.5, color: C.t3, marginBottom: 10 }}>Export every family and setting as one JSON file (documents themselves are not included). Import restores it.</div>
            <Row>
              <Btn C={C} onClick={() => download(exportAll(), `paradiem-planning-${new Date().toISOString().slice(0, 10)}.json`)}>Export JSON</Btn>
              <label style={{ display: 'inline-block' }}><span style={{ padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700, border: `1px solid ${C.border}`, cursor: 'pointer', color: C.t1 }}>Import JSON</span><input type="file" accept="application/json" style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; if (!confirm(`Replace ${families.length} families with the contents of ${f.name}?`)) return; try { importAll(await f.text()) } catch (err) { alert(err.message) } }} /></label>
            </Row>
          </Card>
          <Card C={C}>
            <Eyebrow C={C}>Reset</Eyebrow>
            <div style={{ fontSize: 12.5, color: C.t3, marginBottom: 10 }}>Restore roster, performance, tax constants, fee schedule and tool-rule edits to the shipped defaults. Families are untouched.</div>
            <Confirm C={C} label="Reset settings to defaults" onConfirm={() => updateSettings(() => DEFAULT_SETTINGS)} />
          </Card>
        </Grid>
      )}
    </div>
  )
}

function Performance({ C, isDesktop, settings, updateSettings }) {
  const perf = settings.performance
  const setP = (fn) => updateSettings((s) => ({ ...s, performance: fn(structuredClone(s.performance)) }))
  const Table = ({ sleeve, block, title }) => {
    const b = perf[sleeve][block]; if (!b) return null
    const rows = ['gross', 'net', ...perf[sleeve].benchmarks.map((x) => x.key)]
    return (
      <div style={{ marginBottom: 16 }}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.t2 }}>{title}</div>
          <Row gap={6}>
            <Btn C={C} small ghost onClick={() => { const c = prompt('New column label (e.g. 1-YR)'); if (!c) return; setP((p) => { p[sleeve][block].columns.push(c); rows.forEach((r) => { p[sleeve][block][r] = [...(p[sleeve][block][r] || []), null] }); return p }) }}>+ Column</Btn>
            <Btn C={C} small ghost onClick={() => setP((p) => { p[sleeve][block].columns.pop(); rows.forEach((r) => { if (p[sleeve][block][r]) p[sleeve][block][r].pop() }); return p })}>− Column</Btn>
          </Row>
        </Row>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12 }}>
            <thead><tr><th style={{ textAlign: 'left', padding: 6, color: C.t4 }}></th>{b.columns.map((c, i) => <th key={i} style={{ padding: 6 }}><Input C={C} value={c} onChange={(v) => setP((p) => { p[sleeve][block].columns[i] = v; return p })} style={{ padding: '5px 6px', fontSize: 11, textAlign: 'center', fontWeight: 700 }} /></th>)}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r}><td style={{ padding: 6, color: C.t2, fontWeight: 700, textTransform: 'uppercase', fontSize: 10.5, letterSpacing: 1, whiteSpace: 'nowrap' }}>{r}</td>{b.columns.map((_, i) => <td key={i} style={{ padding: 4 }}><Input C={C} value={b[r]?.[i] ?? ''} onChange={(v) => setP((p) => { p[sleeve][block][r] = p[sleeve][block][r] || []; p[sleeve][block][r][i] = v === '' ? null : Number(v); return p })} style={{ padding: '5px 6px', fontSize: 12, textAlign: 'right' }} /></td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    )
  }
  return (
    <div>
      <Note C={C} style={{ marginBottom: 14 }}>Enter the audited results after each quarter. Values are percentages. Blank cells print as blank. Add year columns to Growth as its track record grows.</Note>
      <Card C={C} style={{ marginBottom: 14 }}>
        <Row style={{ justifyContent: 'space-between' }}><Eyebrow C={C} style={{ marginBottom: 0 }}>As of</Eyebrow><Input C={C} type="date" value={perf.asOf} onChange={(v) => setP((p) => { p.asOf = v; return p })} style={{ width: 180 }} /></Row>
      </Card>
      {['dividend', 'growth'].map((sleeve) => (
        <Card key={sleeve} C={C} style={{ marginBottom: 14 }}>
          <Field C={C} label="Strategy name"><Input C={C} value={perf[sleeve].name} onChange={(v) => setP((p) => { p[sleeve].name = v; return p })} style={{ marginBottom: 12 }} /></Field>
          <Table sleeve={sleeve} block="annualized" title="Annualized returns" />
          {perf[sleeve].calendar ? <Table sleeve={sleeve} block="calendar" title="Calendar year returns" /> : <Btn C={C} small ghost onClick={() => setP((p) => { p[sleeve].calendar = { columns: [String(new Date().getFullYear() - 1)], gross: [null], net: [null] }; p[sleeve].benchmarks.forEach((b) => { p[sleeve].calendar[b.key] = [null] }); return p })}>+ Add calendar-year table</Btn>}
          <Field C={C} label="Disclosure" style={{ marginTop: 10 }}><TextArea C={C} rows={3} value={perf[sleeve].disclosure} onChange={(v) => setP((p) => { p[sleeve].disclosure = v; return p })} style={{ fontSize: 11 }} /></Field>
        </Card>
      ))}
    </div>
  )
}
