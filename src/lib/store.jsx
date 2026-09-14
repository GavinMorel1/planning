// Data layer. One JSON document per family plus one settings document.
// LOCAL MODE: localStorage (+ IndexedDB for file blobs). SUPABASE MODE: tables `families`,
// `settings` and storage bucket `documents` (see supabase/schema.sql). Same API either way.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, SUPABASE_ENABLED } from './supabase'
import { idbPut, idbGet, idbDel } from './idb'
import { DEFAULT_SETTINGS } from '../data/defaults'
import { uid, nowIso, today } from './util'

const LS_KEY = 'paradiem_planning_v1'
const StoreContext = createContext(null)

export function newFamily(name = 'New Family') {
  return {
    id: uid(), name, createdAt: nowIso(), updatedAt: nowIso(),
    tier: 'over5', netWorth: '', stage: 'assessment', // assessment | gap | blueprint
    profile: { spouse1: { name: '', dob: '' }, spouse2: { name: '', dob: '' }, state: '', city: '', householdIncome: '', vision: '', grandchildren: '', documentsYear: '' },
    children: [], business: { owner: false, name: '', entity: '', revenue: '', value: '', otherOwners: 0, saleHorizonYears: '', salePending: false, successionPlan: false, successor: '', keyEmployees: false },
    balanceSheet: { assets: [], liabilities: [] },
    estateTax: { s1: { creditUsed: 0, gstUsed: 0 }, s2: { creditUsed: 0, gstUsed: 0 } },
    goals: [], documents: {}, recommendations: [], deadlines: [], notes: '',
    assessment: { date: today(), incomeMonthly: '', clarityNetWorth: '', protectionPct: '100%', retirementCashNeed: '', cashOnHand: '', cashGrowthPct: 3, dividendPct: 60, growthPct: 30, cashPct: 10, portfolioTotal: '', potentialReturn: '', annualReturn: '', dividendYield: '', gainPct: '', gainAmt: '', lossPct: '', lossAmt: '', numbersSlide: 'firm', nextStepVariant: 'A', caseStudies: [], scorecard: { innovation: '', inspiration: '', infrastructure: '' } },
    gapMeta: { date: today(), topOfMind: '', includeInvestmentSlides: true, includeToolPages: true },
    flowchart: null, presentations: [],
  }
}

function loadLocal() {
  try { const s = localStorage.getItem(LS_KEY); if (s) return JSON.parse(s) } catch {}
  return { families: [], settings: DEFAULT_SETTINGS, activeFamilyId: null }
}

export function StoreProvider({ children }) {
  const [state, setState] = useState(() => (SUPABASE_ENABLED ? { families: [], settings: DEFAULT_SETTINGS, activeFamilyId: null } : loadLocal()))
  const [ready, setReady] = useState(!SUPABASE_ENABLED)
  const [syncErr, setSyncErr] = useState('')
  const saveTimers = useRef({})

  // ── initial load (Supabase) ──
  useEffect(() => {
    if (!SUPABASE_ENABLED) return
    let cancel = false
    ;(async () => {
      try {
        const [{ data: fams, error: e1 }, { data: sets, error: e2 }] = await Promise.all([
          supabase.from('families').select('id,data').order('updated_at', { ascending: false }),
          supabase.from('settings').select('key,data'),
        ])
        if (e1) throw e1; if (e2) throw e2
        if (cancel) return
        const settings = { ...DEFAULT_SETTINGS, ...(sets?.find((s) => s.key === 'app')?.data || {}) }
        const families = (fams || []).map((r) => ({ ...r.data, id: r.id }))
        setState({ families, settings, activeFamilyId: localStorage.getItem(`${LS_KEY}_active`) || families[0]?.id || null })
      } catch (e) { setSyncErr(e.message || 'Load failed') }
      finally { if (!cancel) setReady(true) }
    })()
    const ch = supabase.channel('families_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'families' }, (payload) => {
      setState((s) => {
        if (payload.eventType === 'DELETE') return { ...s, families: s.families.filter((f) => f.id !== payload.old.id) }
        const row = payload.new; const fam = { ...row.data, id: row.id }
        const exists = s.families.some((f) => f.id === fam.id)
        // don't clobber a local edit that is newer
        const local = s.families.find((f) => f.id === fam.id)
        if (local && local.updatedAt && fam.updatedAt && local.updatedAt > fam.updatedAt) return s
        return { ...s, families: exists ? s.families.map((f) => (f.id === fam.id ? fam : f)) : [fam, ...s.families] }
      })
    }).subscribe()
    return () => { cancel = true; supabase.removeChannel(ch) }
  }, [])

  // ── persistence ──
  useEffect(() => {
    if (SUPABASE_ENABLED) { if (state.activeFamilyId) localStorage.setItem(`${LS_KEY}_active`, state.activeFamilyId); return }
    try { localStorage.setItem(LS_KEY, JSON.stringify(state)) } catch (e) { setSyncErr('Local storage is full. Export or delete old families.') }
  }, [state])

  const persistFamily = useCallback((fam) => {
    if (!SUPABASE_ENABLED) return
    clearTimeout(saveTimers.current[fam.id])
    saveTimers.current[fam.id] = setTimeout(async () => {
      const { id, ...data } = fam
      const { error } = await supabase.from('families').upsert({ id, data: { ...data, id }, updated_at: fam.updatedAt })
      setSyncErr(error ? error.message : '')
    }, 600)
  }, [])
  const persistSettings = useCallback((settings) => {
    if (!SUPABASE_ENABLED) return
    clearTimeout(saveTimers.current.__settings)
    saveTimers.current.__settings = setTimeout(async () => {
      const { error } = await supabase.from('settings').upsert({ key: 'app', data: settings })
      setSyncErr(error ? error.message : '')
    }, 600)
  }, [])

  // ── API ──
  const api = useMemo(() => ({
    createFamily(name) {
      const fam = newFamily(name)
      setState((s) => ({ ...s, families: [fam, ...s.families], activeFamilyId: fam.id }))
      persistFamily(fam)
      return fam
    },
    updateFamily(id, patch) {
      setState((s) => {
        const families = s.families.map((f) => {
          if (f.id !== id) return f
          const next = typeof patch === 'function' ? patch(f) : { ...f, ...patch }
          const stamped = { ...next, updatedAt: nowIso() }
          persistFamily(stamped)
          return stamped
        })
        return { ...s, families }
      })
    },
    async deleteFamily(id) {
      setState((s) => ({ ...s, families: s.families.filter((f) => f.id !== id), activeFamilyId: s.activeFamilyId === id ? (s.families.find((f) => f.id !== id)?.id || null) : s.activeFamilyId }))
      if (SUPABASE_ENABLED) await supabase.from('families').delete().eq('id', id)
    },
    setActive(id) { setState((s) => ({ ...s, activeFamilyId: id })) },
    updateSettings(patch) {
      setState((s) => {
        const settings = typeof patch === 'function' ? patch(s.settings) : { ...s.settings, ...patch }
        persistSettings(settings)
        return { ...s, settings }
      })
    },
    // files
    async putFile(familyId, file, meta = {}) {
      const id = uid()
      const key = `${familyId}/${id}-${file.name.replace(/[^A-Za-z0-9._-]/g, '_')}`
      if (SUPABASE_ENABLED) {
        const { error } = await supabase.storage.from('documents').upload(key, file, { upsert: false, contentType: file.type || 'application/octet-stream' })
        if (error) throw error
      } else { await idbPut(key, file) }
      return { id, key, name: file.name, size: file.size, type: file.type, uploadedAt: nowIso(), ...meta }
    },
    async getFile(key) {
      if (SUPABASE_ENABLED) { const { data, error } = await supabase.storage.from('documents').download(key); if (error) throw error; return data }
      return idbGet(key)
    },
    async removeFile(key) {
      if (SUPABASE_ENABLED) { await supabase.storage.from('documents').remove([key]) } else { await idbDel(key) }
    },
    exportAll() {
      const blob = new Blob([JSON.stringify({ exportedAt: nowIso(), ...state }, null, 2)], { type: 'application/json' })
      return blob
    },
    importAll(json) {
      const data = typeof json === 'string' ? JSON.parse(json) : json
      if (!data || !Array.isArray(data.families)) throw new Error('Not a planning export')
      setState((s) => ({ families: data.families, settings: { ...DEFAULT_SETTINGS, ...(data.settings || s.settings) }, activeFamilyId: data.families[0]?.id || null }))
      if (SUPABASE_ENABLED) { data.families.forEach(persistFamily); persistSettings(data.settings || {}) }
    },
  }), [persistFamily, persistSettings, state])

  const family = state.families.find((f) => f.id === state.activeFamilyId) || null
  const value = { ...state, family, ready, syncErr, ...api, mode: SUPABASE_ENABLED ? 'supabase' : 'local' }
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
// Convenience: patch the active family
export function useFamily() {
  const { family, updateFamily } = useStore()
  const patch = useCallback((p) => family && updateFamily(family.id, p), [family, updateFamily])
  return [family, patch]
}
