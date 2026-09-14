// Minimal markdown renderer (headings, lists, tables, bold/italic/code/links). Same idiom as the invest app.
export function renderMarkdown(md, C) {
  if (!md) return null
  let text = md
  const fm = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/); if (fm) text = text.slice(fm[0].length)
  const lines = text.split('\n'); const out = []; let list = []
  const flush = () => { if (list.length) { out.push(<ul key={`ul${out.length}`}>{list}</ul>); list = [] } }
  const inline = (t) => t.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/).map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
    if (p.startsWith('*') && p.endsWith('*') && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>
    const m = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/); if (m) return <a key={i} href={m[2]} target="_blank" rel="noreferrer" style={{ color: C?.info || '#60A5FA' }}>{m[1]}</a>
    return p
  })
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (l.trim().startsWith('|') && l.trim().endsWith('|')) {
      flush(); const rows = []; let j = i
      while (j < lines.length && lines[j].trim().startsWith('|') && lines[j].trim().endsWith('|')) { rows.push(lines[j]); j++ }
      if (rows.length >= 2) {
        const parse = (r) => r.split('|').slice(1, -1).map((c) => c.trim())
        const head = parse(rows[0]); const start = rows[1].replace(/[|\s\-:]/g, '') === '' ? 2 : 1
        out.push(<div key={i} style={{ overflowX: 'auto' }}><table><thead><tr>{head.map((h, k) => <th key={k}>{inline(h)}</th>)}</tr></thead><tbody>{rows.slice(start).map((r, k) => <tr key={k}>{parse(r).map((c, m) => <td key={m}>{inline(c)}</td>)}</tr>)}</tbody></table></div>)
        i = j - 1; continue
      }
    }
    if (l.startsWith('# ')) { flush(); out.push(<h1 key={i}>{inline(l.slice(2))}</h1>) }
    else if (l.startsWith('## ')) { flush(); out.push(<h2 key={i}>{inline(l.slice(3))}</h2>) }
    else if (l.startsWith('### ')) { flush(); out.push(<h3 key={i}>{inline(l.slice(4))}</h3>) }
    else if (/^\s*[-*] /.test(l)) list.push(<li key={i}>{inline(l.replace(/^\s*[-*] /, ''))}</li>)
    else if (/^\s*\d+\. /.test(l)) list.push(<li key={i}>{inline(l.replace(/^\s*\d+\. /, ''))}</li>)
    else if (l.trim() === '') flush()
    else if (l.startsWith('---')) { flush(); out.push(<hr key={i} style={{ border: 'none', borderTop: `1px solid ${C?.border || '#ccc'}`, margin: '18px 0' }} />) }
    else { flush(); out.push(<p key={i}>{inline(l)}</p>) }
  }
  flush(); return out
}
