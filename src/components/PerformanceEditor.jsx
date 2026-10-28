// Quarterly returns editor. The same component sits in Settings and inside the Assessment tab so the
// planner can refresh the Dividend and Growth lines right where the deck is generated.
import { Card, Eyebrow, Btn, Input, Field, Row, Note, TextArea } from './ui'

export default function PerformanceEditor({ C, settings, updateSettings }) {
  const perf = settings.performance
  const setP = (fn) => updateSettings((s) => ({ ...s, performance: fn(structuredClone(s.performance)) }))
  const num = (v) => (v === '' || v == null ? null : Number(v))

  const Grid2 = ({ sleeve, block, title, rows, labels, columnsKey = 'columns', onCol, addCol, delCol }) => {
    const b = perf[sleeve][block]; if (!b) return null
    return (
      <div style={{ marginBottom: 16 }}>
        <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.t2 }}>{title}</div>
          <Row gap={6}>
            <Btn C={C} small ghost onClick={addCol}>+ Column</Btn>
            <Btn C={C} small ghost onClick={delCol}>− Column</Btn>
          </Row>
        </Row>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: 12 }}>
            <thead><tr><th style={{ textAlign: 'left', padding: 6, color: C.t4 }}></th>{b[columnsKey].map((c, i) => <th key={i} style={{ padding: 6 }}><Input C={C} value={c} onChange={(v) => onCol(i, v)} style={{ padding: '6px 8px', fontSize: 11.5, textAlign: 'center' }} /></th>)}</tr></thead>
            <tbody>{rows.map((r, ri) => (
              <tr key={r}><td style={{ padding: 6, color: C.t2, fontWeight: 700, textTransform: 'uppercase', fontSize: 10.5, letterSpacing: 1, whiteSpace: 'nowrap' }}>{labels?.[ri] || r}</td>
                {b[columnsKey].map((_, i) => <td key={i} style={{ padding: 4 }}><Input C={C} value={b[r]?.[i] ?? ''} onChange={(v) => setP((p) => { p[sleeve][block][r] = [...(p[sleeve][block][r] || [])]; p[sleeve][block][r][i] = num(v); return p })} style={{ padding: '6px 8px', fontSize: 12, textAlign: 'center' }} /></td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    )
  }
  const returnsTable = (sleeve, block, title) => {
    const rows = ['gross', 'net', ...perf[sleeve].benchmarks.map((x) => x.key)]
    const labels = ['Gross', 'Net', ...perf[sleeve].benchmarks.map((x) => x.label)]
    return <Grid2 sleeve={sleeve} block={block} title={title} rows={rows} labels={labels}
      onCol={(i, v) => setP((p) => { p[sleeve][block].columns[i] = v; return p })}
      addCol={() => { const c = prompt('New column label (e.g. 1-YR)'); if (!c) return; setP((p) => { p[sleeve][block].columns.push(c); rows.forEach((r) => { p[sleeve][block][r] = [...(p[sleeve][block][r] || []), null] }); return p }) }}
      delCol={() => setP((p) => { p[sleeve][block].columns.pop(); rows.forEach((r) => { if (p[sleeve][block][r]) p[sleeve][block][r].pop() }); return p })} />
  }
  const st = perf.dividend?.statistics
  return (
    <div>
      <Note C={C} style={{ marginBottom: 14 }}>Update these after each quarter. They feed every Assessment and Gap Analysis deck you generate, for all families. Values are percentages; blank cells print as a dash. The "as of" date prints on each returns slide.</Note>
      <Card C={C} style={{ marginBottom: 14 }}>
        <Row style={{ justifyContent: 'space-between' }}><Eyebrow C={C} style={{ marginBottom: 0 }}>As of (quarter end)</Eyebrow><Input C={C} type="date" value={perf.asOf} onChange={(v) => setP((p) => { p.asOf = v; return p })} style={{ width: 180 }} /></Row>
      </Card>
      {['dividend', 'growth'].map((sleeve) => (
        <Card key={sleeve} C={C} style={{ marginBottom: 14 }}>
          <Field C={C} label="Strategy name"><Input C={C} value={perf[sleeve].name} onChange={(v) => setP((p) => { p[sleeve].name = v; return p })} style={{ marginBottom: 12 }} /></Field>
          {returnsTable(sleeve, 'annualized', sleeve === 'growth' ? 'Returns (1-MO, 3-MO, trailing months since inception)' : 'Annualised returns')}
          {sleeve === 'dividend' && st && (
            <Grid2 sleeve="dividend" block="statistics" title={`Statistics · ${st.vs || ''}`} rows={['up', 'down']} labels={['Up-market capture', 'Down-market capture']}
              onCol={(i, v) => setP((p) => { p.dividend.statistics.columns[i] = v; return p })}
              addCol={() => { const c = prompt('New column label (e.g. 15-YR)'); if (!c) return; setP((p) => { p.dividend.statistics.columns.push(c); p.dividend.statistics.up.push(null); p.dividend.statistics.down.push(null); return p }) }}
              delCol={() => setP((p) => { p.dividend.statistics.columns.pop(); p.dividend.statistics.up.pop(); p.dividend.statistics.down.pop(); return p })} />
          )}
          {perf[sleeve].calendar ? returnsTable(sleeve, 'calendar', 'Calendar year returns (Gap Analysis deck)') : (sleeve === 'dividend' && <Btn C={C} small ghost onClick={() => setP((p) => { p[sleeve].calendar = { columns: [String(new Date().getFullYear() - 1)], gross: [null], net: [null] }; p[sleeve].benchmarks.forEach((x) => { p[sleeve].calendar[x.key] = [null] }); return p })}>+ Add calendar-year table</Btn>)}
          <Field C={C} label="Disclosure text under the table (one paragraph per line)" style={{ marginTop: 10 }}><TextArea C={C} rows={6} value={sleeve === 'dividend' ? (perf.dividend.disclosureStats ?? perf.dividend.disclosure) : perf[sleeve].disclosure} onChange={(v) => setP((p) => { if (sleeve === 'dividend') { p.dividend.disclosureStats = v; p.dividend.disclosure = v } else p[sleeve].disclosure = v; return p })} style={{ fontSize: 11 }} /></Field>
        </Card>
      ))}
    </div>
  )
}
