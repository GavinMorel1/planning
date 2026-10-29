// Per-family cash-flow model storage. SUPABASE MODE: table `cashflow_models` (one JSON document, optimistic version check)
// and append-only `cashflow_history` (written by a database trigger with who/when, see
// supabase/migrations/20261029_cashflow_model.sql). LOCAL MODE: localStorage with the same history kept in the browser.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, SUPABASE_ENABLED } from './supabase'
import { useAuth } from './auth'
import { normalizeModel, modelFromFamily } from '../cashflow/types'
import { nowIso } from './util'
import { canEdit, denyEdit } from './permissions'

const LS_KEY = 'paradiem_planning_cashflow_v1'
const SAVE_DELAY = 700
const readLocal = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {} } catch { return {} } }
const writeLocal = (all) => { try { localStorage.setItem(LS_KEY, JSON.stringify(all)) } catch { /* storage full: in-memory state still works */ } }
const missing = (e) => /cashflow_(models|history)/i.test(String(e?.message || '')) && /does not exist|schema cache|could not find/i.test(String(e?.message || '')) || e?.code === '42P01' || e?.code === 'PGRST205'

export function useCashflowModel(family) {
  const familyId = family?.id || null
  const { email } = useAuth()
  const me = String(email || '').toLowerCase()
  const seed = useMemo(() => modelFromFamily(family), [familyId]) // eslint-disable-line react-hooks/exhaustive-deps
  const [state, setState] = useState({ model: seed, version: 0, exists: false, ready: false })
  const [error, setError] = useState('')
  const [missingTable, setMissingTable] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef({ model: seed, version: 0, exists: false, timer: null, pending: null, familyId })
  ref.current.familyId = familyId

  const apply = useCallback((model, version, exists) => { ref.current.model = model; ref.current.version = version; ref.current.exists = exists; setState({ model, version, exists, ready: true }) }, [])

  const load = useCallback(async () => {
    if (!familyId) return
    try {
      if (!SUPABASE_ENABLED) {
        const rec = readLocal()[familyId]
        if (rec) apply(normalizeModel(rec.data), rec.version || 1, true); else apply(seed, 0, false)
        return
      }
      const { data, error: e } = await supabase.from('cashflow_models').select('data,version').eq('family_id', familyId).maybeSingle()
      if (e) throw e
      if (data) apply(normalizeModel(data.data), data.version, true); else apply(seed, 0, false)
      setError(''); setMissingTable(false)
    } catch (e) { if (missing(e)) { setMissingTable(true); apply(seed, 0, false) } else { setError(e?.message || 'Could not load the cash-flow model'); setState((s) => ({ ...s, ready: true })) } }
  }, [familyId, seed, apply])

  useEffect(() => {
    clearTimeout(ref.current.timer); ref.current.pending = null
    setState({ model: seed, version: 0, exists: false, ready: false }); setError(''); setMissingTable(false)
    load()
    if (!SUPABASE_ENABLED || !familyId) return undefined
    const ch = supabase.channel(`cashflow_${familyId}_${Math.random().toString(36).slice(2, 7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cashflow_models', filter: `family_id=eq.${familyId}` }, (p) => {
        const r = p.new
        if (!r || !r.data || ref.current.pending) return // our own unsent edit wins
        if (r.version > ref.current.version) apply(normalizeModel(r.data), r.version, true)
      }).subscribe()
    return () => { try { supabase.removeChannel(ch) } catch { /* ignore */ } }
  }, [familyId]) // eslint-disable-line react-hooks/exhaustive-deps

  const flush = useCallback(async () => {
    const r = ref.current, p = r.pending
    if (!p || !r.familyId) return
    r.pending = null; clearTimeout(r.timer)
    const meta = { source: p.source || 'manual', note: p.note || null }
    setSaving(true)
    try {
      if (!SUPABASE_ENABLED) {
        const all = readLocal(); const rec = all[r.familyId] || { version: 0, history: [] }
        const version = (rec.version || 0) + 1
        all[r.familyId] = { data: r.model, version, history: [...(rec.history || []), { version, data: r.model, source: meta.source, note: meta.note, changed_by: me || 'local', changed_at: nowIso() }].slice(-60) }
        writeLocal(all); r.version = version; r.exists = true; setState((s) => ({ ...s, version, exists: true }))
      } else if (!r.exists) {
        const { error: e } = await supabase.from('cashflow_models').insert({ family_id: r.familyId, data: r.model, last_source: meta.source, last_note: meta.note })
        if (e) throw e
        r.version = 1; r.exists = true; setState((s) => ({ ...s, version: 1, exists: true }))
      } else {
        const { data, error: e } = await supabase.from('cashflow_models').update({ data: r.model, last_source: meta.source, last_note: meta.note }).eq('family_id', r.familyId).eq('version', r.version).select('version')
        if (e) throw e
        if (!data || !data.length) { setError('Someone else changed this model while you were editing. Reloaded their version; re-apply your change.'); await load(); return }
        r.version = data[0].version; setState((s) => ({ ...s, version: data[0].version }))
      }
      setError('')
    } catch (e) { if (missing(e)) setMissingTable(true); else setError(e?.message || 'Save failed') } finally { setSaving(false) }
  }, [me, load])

  // Save a change. `updater` is a model or (model) => model. `meta` records where it came from (shown in History).
  const save = useCallback((updater, meta = {}, { immediate = false } = {}) => {
    if (!canEdit()) { denyEdit(); return undefined }
    const r = ref.current
    const next = normalizeModel(typeof updater === 'function' ? updater(r.model) : updater, r.model.assumptions.baseYear)
    r.model = next
    setState((s) => ({ ...s, model: next }))
    r.pending = { source: meta.source || r.pending?.source, note: meta.note || r.pending?.note }
    clearTimeout(r.timer)
    if (immediate) return flush()
    r.timer = setTimeout(flush, SAVE_DELAY)
    return undefined
  }, [flush])

  useEffect(() => () => { try { flush() } catch { /* best effort */ } }, [familyId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const h = () => { flush() }
    window.addEventListener('pagehide', h)
    return () => window.removeEventListener('pagehide', h)
  }, [flush])

  const loadHistory = useCallback(async () => {
    if (!familyId) return []
    if (!SUPABASE_ENABLED) return [...(readLocal()[familyId]?.history || [])].reverse().map(({ data, ...x }) => x)
    const { data, error: e } = await supabase.from('cashflow_history').select('version,source,note,changed_by,changed_at').eq('family_id', familyId).order('version', { ascending: false }).limit(100)
    if (e) { if (missing(e)) setMissingTable(true); return [] }
    return data || []
  }, [familyId])
  const getVersion = useCallback(async (version) => {
    if (!SUPABASE_ENABLED) return normalizeModel((readLocal()[familyId]?.history || []).find((h) => h.version === version)?.data)
    const { data, error: e } = await supabase.from('cashflow_history').select('data').eq('family_id', familyId).eq('version', version).maybeSingle()
    if (e || !data) throw e || new Error('Version not found')
    return normalizeModel(data.data)
  }, [familyId])
  const restore = useCallback(async (version) => { const m = await getVersion(version); await save(m, { source: `restore v${version}`, note: `Restored version ${version}` }, { immediate: true }) }, [getVersion, save])

  const currentVersion = useCallback(() => ref.current.version, [])
  return { currentVersion, model: state.model, ready: state.ready, version: state.version, exists: state.exists, saving, error, missingTable, save, loadHistory, getVersion, restore, reload: load, clearError: () => setError('') }
}
