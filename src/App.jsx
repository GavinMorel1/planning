import { useEffect, useMemo, useState } from 'react'
import { themeFor } from './lib/theme'
import { useStore } from './lib/store'
import { useAuth } from './lib/auth'
import Desk from './tabs/Desk'
import Families from './tabs/Families'
import Documents from './tabs/Documents'
import Assessment from './tabs/Assessment'
import GapAnalysis from './tabs/GapAnalysis'
import Strategies from './tabs/Strategies'
import Priorities from './tabs/Priorities'
import EstateFlow from './tabs/EstateFlow'
import Cashflow from './tabs/Cashflow'
import Presentations from './tabs/Presentations'
import Calendar from './tabs/Calendar'
import Research from './tabs/Research'
import Settings from './tabs/Settings'

const ICON = (paths, fill) => (a, C) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill={a && fill ? C.navAccentSoft : 'none'} stroke={a ? C.navText : C.navTextMuted} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths}</svg>
)
const NAV = [
  { id: 'desk', label: 'Desk', icon: ICON(<><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></>) },
  { id: 'families', label: 'Families', icon: ICON(<><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></>) },
  { id: 'documents', label: 'Documents', icon: ICON(<><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></>, true) },
  { id: 'assessment', label: 'Assessment', icon: ICON(<><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>) },
  { id: 'gap', label: 'Gap Analysis', icon: ICON(<><path d="M3 3v18h18" /><path d="M7 14l4-4 4 4 5-6" /></>) },
  { id: 'strategies', label: 'Strategies', icon: ICON(<><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></>, true) },
  { id: 'priorities', label: 'Priorities', icon: ICON(<><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></>) },
  { id: 'estate', label: 'Estate Flow', icon: ICON(<><rect x="3" y="3" width="7" height="5" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="8.5" y="16" width="7" height="5" rx="1" /><path d="M6.5 8v4h11V8" /><path d="M12 12v4" /></>) },
  { id: 'cashflow', label: 'Cashflow', icon: ICON(<><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></>) },
  { id: 'presentations', label: 'Presentations', icon: ICON(<><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></>, true) },
  { id: 'calendar', label: 'Calendar', icon: ICON(<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>, true) },
  { id: 'research', label: 'Research', icon: ICON(<><path d="M10 2v7.527a2 2 0 01-.211.896L4.72 20.578A1 1 0 005.598 22h12.804a1 1 0 00.878-1.422l-5.069-10.155A2 2 0 0114 9.527V2" /><path d="M8.5 2h7" /></>, true) },
  { id: 'settings', label: 'Settings', icon: ICON(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></>) },
]
const FAMILY_TABS = new Set(['documents', 'assessment', 'gap', 'priorities', 'estate', 'cashflow', 'presentations'])

function useMedia(q) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => { const mq = window.matchMedia(q); const on = (e) => setM(e.matches); mq.addEventListener('change', on); return () => mq.removeEventListener('change', on) }, [q])
  return m
}

export default function App() {
  const store = useStore()
  const { families, family, setActive, settings, updateSettings, syncErr, ready, mode } = store
  const { email, signOut, localMode } = useAuth()
  const isDesktop = useMedia('(min-width: 900px)')
  const [tab, setTab] = useState(() => localStorage.getItem('planning_tab') || 'desk')
  const [menu, setMenu] = useState(false)
  const [themeName, setThemeName] = useState(() => localStorage.getItem('planning_theme') || 'dark')
  const C = useMemo(() => themeFor(themeName), [themeName])
  useEffect(() => { localStorage.setItem('planning_tab', tab) }, [tab])
  useEffect(() => { localStorage.setItem('planning_theme', themeName); document.body.style.background = C.bg }, [themeName, C])

  const props = { C, isDesktop, setTab }
  const needsFamily = FAMILY_TABS.has(tab) && !family

  const content = needsFamily ? (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: C.t4 }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.t3, marginBottom: 6 }}>Pick a family first</div>
      <div style={{ fontSize: 12.5, marginBottom: 16 }}>Everything in this tab is done for one family at a time. Choose one at the top or add one in Families.</div>
      <button onClick={() => setTab('families')} style={{ padding: '9px 16px', borderRadius: 10, border: `1px solid ${C.accent}`, background: C.accent, color: '#171738', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Go to Families</button>
    </div>
  ) : (
    <>
      {tab === 'desk' && <Desk {...props} />}
      {tab === 'families' && <Families {...props} />}
      {tab === 'documents' && <Documents {...props} />}
      {tab === 'assessment' && <Assessment {...props} />}
      {tab === 'gap' && <GapAnalysis {...props} />}
      {tab === 'strategies' && <Strategies {...props} />}
      {tab === 'priorities' && <Priorities {...props} />}
      {tab === 'estate' && <EstateFlow {...props} />}
      {tab === 'cashflow' && <Cashflow {...props} />}
      {tab === 'presentations' && <Presentations {...props} />}
      {tab === 'calendar' && <Calendar {...props} />}
      {tab === 'research' && <Research {...props} />}
      {tab === 'settings' && <Settings {...props} themeName={themeName} setThemeName={setThemeName} />}
    </>
  )

  const familySelect = (
    <select value={family?.id || ''} onChange={(e) => { if (e.target.value === '__new') { setTab('families'); return } setActive(e.target.value) }}
      style={{ padding: '8px 12px', borderRadius: 10, border: `1px solid ${C.borderActive}`, background: C.accentSoft, color: C.t1, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', outline: 'none', maxWidth: isDesktop ? 260 : 190, appearance: 'auto' }}>
      <option value="">— No family selected —</option>
      {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      <option value="__new">+ Add family…</option>
    </select>
  )

  const navList = (onPick) => NAV.map((t) => (
    <button key={t.id} onClick={() => { setTab(t.id); onPick?.() }} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '12px 24px', background: tab === t.id ? C.navAccentSoft : 'transparent', border: 'none', borderLeft: tab === t.id ? `3px solid ${C.accent}` : '3px solid transparent', cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit' }}>
      {t.icon(tab === t.id, C)}
      <span style={{ fontSize: 14, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? C.navText : C.navTextDim }}>{t.label}</span>
    </button>
  ))

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, color: C.t1, display: isDesktop ? 'flex' : 'block', paddingBottom: isDesktop ? 0 : 40 }}>
      <GS />
      {isDesktop && (
        <div style={{ width: 240, position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 50, background: C.nav, borderRight: `1px solid ${C.navBorder}`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px 20px 14px', borderBottom: `1px solid ${C.navBorder}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <img src="paradiem-logo-dark.png" alt="Paradiem" style={{ width: '78%', height: 'auto' }} />
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 2.4, color: C.accent, textTransform: 'uppercase' }}>Planning</div>
          </div>
          <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>{navList()}</nav>
          <div style={{ padding: '14px 22px', borderTop: `1px solid ${C.navBorder}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, background: syncErr ? C.dn : ready ? C.up : C.warn, boxShadow: `0 0 6px ${syncErr ? C.dn : C.up}66` }} />
              <span style={{ fontSize: 11.5, fontWeight: 600, color: C.navTextDim }}>{mode === 'local' ? 'Local mode' : syncErr ? 'Sync error' : 'Synced'}</span>
            </div>
            <div style={{ fontSize: 11, color: C.navTextMuted, overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0, marginLeft: isDesktop ? 240 : 0 }}>
        <div style={{ padding: isDesktop ? '14px 40px' : '12px 18px', paddingTop: isDesktop ? 14 : 'calc(env(safe-area-inset-top, 12px) + 12px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderBottom: `1px solid ${C.border}`, background: themeName !== 'light' ? 'rgba(23,23,56,0.88)' : 'rgba(244,239,228,0.94)', backdropFilter: 'blur(24px) saturate(1.2)', WebkitBackdropFilter: 'blur(24px) saturate(1.2)', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            {!isDesktop && (
              <button onClick={() => setMenu(true)} style={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 10, cursor: 'pointer', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.t2} strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
              </button>
            )}
            {isDesktop && <span style={{ fontSize: 10, fontWeight: 700, color: C.t4, textTransform: 'uppercase', letterSpacing: 1.4, whiteSpace: 'nowrap' }}>Active family</span>}
            {familySelect}
            {family && <span style={{ fontSize: 11, color: C.t4, whiteSpace: 'nowrap' }}>{family.tier === 'under5' ? 'Under $5M' : '$5M+'} · {family.stage === 'assessment' ? 'Assessment' : family.stage === 'gap' ? 'Gap Analysis' : 'Blueprint'}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setThemeName(themeName === 'light' ? 'dark' : 'light')} title="Toggle theme" style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.t3, cursor: 'pointer', fontSize: 14 }}>{themeName === 'light' ? '☾' : '☀'}</button>
            {!localMode && <button onClick={signOut} style={{ padding: '7px 12px', borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.t3, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>}
          </div>
        </div>

        {syncErr && <div style={{ margin: isDesktop ? '12px 40px 0' : '12px 18px 0', padding: '10px 14px', borderRadius: 10, background: C.dnSoft, border: `1px solid ${C.dn}55`, fontSize: 12.5, color: C.t2 }}>{syncErr}</div>}

        <div style={{ maxWidth: 1400, margin: '0 auto', padding: isDesktop ? '20px 40px 40px' : '16px 18px 40px' }}>
          <div key={tab} style={{ animation: 'fadeIn 0.3s ease' }}>{content}</div>
        </div>
      </div>

      {!isDesktop && menu && (
        <>
          <div onClick={() => setMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.5)' }} />
          <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: 280, zIndex: 9999, background: C.nav, borderRight: `1px solid ${C.navBorder}`, display: 'flex', flexDirection: 'column', paddingTop: 'calc(env(safe-area-inset-top, 20px) + 16px)', animation: 'slideInLeft 0.25s cubic-bezier(0.16,1,0.3,1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 16px', borderBottom: `1px solid ${C.navBorder}` }}>
              <img src="paradiem-logo-dark.png" alt="Paradiem" style={{ height: 32 }} />
              <button onClick={() => setMenu(false)} style={{ width: 32, height: 32, borderRadius: 16, background: C.navTextMuted + '30', border: 'none', color: C.navTextDim, cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
            <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>{navList(() => setMenu(false))}</nav>
            <div style={{ padding: '16px 24px', borderTop: `1px solid ${C.navBorder}`, fontSize: 11, color: C.navTextMuted }}>{email} · {mode === 'local' ? 'Local mode' : 'Synced'}</div>
          </div>
        </>
      )}
    </div>
  )
}

function GS() {
  return (
    <style>{`
      @keyframes spin { 0% { transform: rotate(0deg) } 100% { transform: rotate(360deg) } }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
      @keyframes slideInLeft { from { opacity: 0; transform: translateX(-30px) } to { opacity: 1; transform: translateX(0) } }
      @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }
      * { -webkit-tap-highlight-color: transparent; }
      input::placeholder, textarea::placeholder { color: #8B7355AA !important; }
      input:focus, textarea:focus, select:focus { border-color: rgba(201,168,76,0.55) !important; }
      ::-webkit-scrollbar { width: 10px; height: 8px; }
      ::-webkit-scrollbar-thumb { background: rgba(201,168,76,0.35); border-radius: 10px; }
      button:hover { opacity: 0.9; }
      table { border-collapse: collapse; }
      .md h1 { font-size: 26px; font-weight: 800; margin: 22px 0 10px; } .md h2 { font-size: 20px; font-weight: 700; margin: 18px 0 8px; } .md h3 { font-size: 16px; font-weight: 700; margin: 14px 0 6px; }
      .md p { margin: 8px 0; line-height: 1.7; } .md ul { margin: 8px 0; padding-left: 22px; } .md li { margin-bottom: 5px; line-height: 1.6; }
      .md table { width: 100%; font-size: 13px; margin: 10px 0; } .md th, .md td { padding: 7px 10px; text-align: left; border-bottom: 1px solid rgba(201,168,76,0.18); }
      .md code { padding: 2px 5px; border-radius: 4px; background: rgba(201,168,76,0.12); font-family: 'IBM Plex Mono', monospace; font-size: 0.9em; }
    `}</style>
  )
}
