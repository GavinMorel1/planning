// Minimal .xlsx reader for AI intake: turns each sheet into tab-separated text Claude can read. Handles shared strings,
// inline strings and numbers; ignores formatting, formulas' text and charts. Pure (JSZip only), no DOM.
import JSZip from 'jszip'

const unxml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&')
const colIndex = (ref: string) => { const m = /^([A-Z]+)/.exec(ref); let n = 0; for (const ch of m ? m[1] : '') n = n * 26 + ch.charCodeAt(0) - 64; return n - 1 }

export async function xlsxToText(data: ArrayBuffer | Uint8Array, opts: { maxRows?: number; maxChars?: number } = {}): Promise<string> {
  const maxRows = opts.maxRows ?? 500, maxChars = opts.maxChars ?? 120_000
  const zip = await JSZip.loadAsync(data)
  const read = async (p: string) => { const f = zip.file(p); return f ? f.async('string') : '' }
  const shared: string[] = []
  const sst = await read('xl/sharedStrings.xml')
  for (const si of sst.match(/<si[\s>][\s\S]*?<\/si>/g) || []) shared.push(unxml((si.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('')))
  // sheet names and their files, in workbook order
  const wb = await read('xl/workbook.xml'), rels = await read('xl/_rels/workbook.xml.rels')
  const target: Record<string, string> = {}
  for (const r of rels.match(/<Relationship\b[^>]*>/g) || []) { const id = /Id="([^"]+)"/.exec(r)?.[1], t = /Target="([^"]+)"/.exec(r)?.[1]; if (id && t) target[id] = t.replace(/^\/?(xl\/)?/, 'xl/') }
  const sheets = (wb.match(/<sheet\b[^>]*>/g) || []).map((s) => ({ name: unxml(/name="([^"]*)"/.exec(s)?.[1] || 'Sheet'), file: target[/r:id="([^"]+)"/.exec(s)?.[1] || ''] })).filter((s) => s.file)
  if (!sheets.length) Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort().forEach((n, i) => sheets.push({ name: `Sheet${i + 1}`, file: n }))
  let out = ''
  for (const sh of sheets) {
    const xml = await read(sh.file); out += `=== Sheet: ${sh.name} ===\n`
    let rows = 0
    for (const row of xml.match(/<row\b[\s\S]*?<\/row>/g) || []) {
      if (rows++ >= maxRows) { out += '(more rows not shown)\n'; break }
      const cells: string[] = []
      for (const c of row.match(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []) {
        const ref = /\br="([A-Z]+\d+)"/.exec(c)?.[1] || '', t = /\bt="([^"]+)"/.exec(c)?.[1] || ''
        const v = /<v>([\s\S]*?)<\/v>/.exec(c)?.[1]
        let val = ''
        if (t === 's' && v !== undefined) val = shared[Number(v)] ?? ''
        else if (t === 'inlineStr') val = unxml((c.match(/<t[^>]*>([\s\S]*?)<\/t>/g) || []).map((x) => x.replace(/<[^>]+>/g, '')).join(''))
        else if (v !== undefined) val = unxml(v)
        cells[colIndex(ref)] = val
      }
      if (cells.some((x) => x !== undefined && x !== '')) out += Array.from(cells, (x) => x ?? '').join('\t') + '\n'
      if (out.length > maxChars) { out += '(truncated)\n'; break }
    }
  }
  return out
}
