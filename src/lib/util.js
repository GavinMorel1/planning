export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`)
export const today = () => new Date().toISOString().slice(0, 10)
export const nowIso = () => new Date().toISOString()

export const fmtUsd = (v, opts = {}) => {
  if (v == null || v === '' || isNaN(Number(v))) return '—'
  const n = Number(v)
  const abs = Math.abs(n)
  const s = opts.compact
    ? abs >= 1e9 ? `$${(abs / 1e9).toFixed(2)}B` : abs >= 1e6 ? `$${(abs / 1e6).toFixed(abs >= 1e7 ? 1 : 2)}M` : abs >= 1e3 ? `$${Math.round(abs / 1e3)}K` : `$${Math.round(abs)}`
    : `$${Math.round(abs).toLocaleString()}`
  return n < 0 ? `−${s}` : s
}
export const fmtPct = (v, d = 2) => (v == null || v === '' || isNaN(Number(v))) ? '—' : `${Number(v) >= 0 ? '' : ''}${Number(v).toFixed(d)}%`
export const fmtDate = (s) => {
  if (!s) return ''
  const d = new Date(String(s).length === 10 ? `${s}T00:00:00` : s)
  return isNaN(d) ? String(s) : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
export const num = (v) => { const n = Number(String(v ?? '').replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n }
export const ageFrom = (dob) => {
  if (!dob) return null
  const d = new Date(dob); if (isNaN(d)) return null
  const t = new Date(); let a = t.getFullYear() - d.getFullYear()
  if (t < new Date(t.getFullYear(), d.getMonth(), d.getDate())) a--
  return a
}
export const daysUntil = (dateStr) => {
  if (!dateStr) return null
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`)
  if (isNaN(d)) return null
  return Math.ceil((d.getTime() - Date.now()) / 86400000)
}
export const download = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click()
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 500)
}
export const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(String(r.result).split(',')[1])
  r.onerror = reject
  r.readAsDataURL(file)
})
export const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
