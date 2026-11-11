import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase, SUPABASE_ENABLED } from './supabase'
import { useAuth, Splash, ghostBtn } from './auth'
import { setRole, getRole } from './permissions'

const RoleContext = createContext({ role: 'planning', ready: true, reload: () => {} })

// The caller's role comes from the database (current_role_name(), supabase/migrations/20261111_team_access.sql):
// admin, planning, rm, or none (signed in but not on the My Team list). If that function does not exist yet (migration not
// run) fall back to the older app_roles lookup, where no row meant Planning Team.
async function fetchRole(email) {
  const rpc = await supabase.rpc('current_role_name')
  if (!rpc.error && rpc.data) return String(rpc.data)
  const { data, error } = await supabase.from('app_roles').select('role').eq('email', String(email).toLowerCase()).maybeSingle()
  if (error) throw error
  return data?.role || 'planning'
}

export function RoleProvider({ children }) {
  const { email } = useAuth()
  const [role, setLocal] = useState(SUPABASE_ENABLED ? null : 'admin') // local mode: the one person on this browser administers it
  const [ready, setReady] = useState(!SUPABASE_ENABLED)
  const load = useCallback(async () => {
    if (!SUPABASE_ENABLED || !email) { setRole('admin'); setLocal('admin'); setReady(true); return }
    try {
      const r = await fetchRole(email)
      setRole(r); setLocal(getRole())
    } catch { setRole('planning'); setLocal('planning') } finally { setReady(true) }
  }, [email])
  useEffect(() => { load() }, [load])
  // An Admin may add or remove someone at any moment: look again whenever the tab regains focus.
  useEffect(() => {
    if (!SUPABASE_ENABLED) return undefined
    const h = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', h)
    return () => document.removeEventListener('visibilitychange', h)
  }, [load])
  return <RoleContext.Provider value={{ role: role || 'planning', ready, reload: load }}>{children}</RoleContext.Provider>
}
export const useRole = () => useContext(RoleContext)

/** Shows a "no access" screen to anyone who is signed in but has not been added to My Team. */
export function AccessGate({ children }) {
  const { role, ready } = useRole()
  const { email, signOut } = useAuth()
  if (!SUPABASE_ENABLED) return children
  if (!ready) return <Splash>Loading…</Splash>
  if (role !== 'none') return children
  return (
    <Splash>
      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>You don't have access yet</div>
      <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6, maxWidth: 360 }}>{email} is not on the Paradiem Planning team.</div>
      <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 18, maxWidth: 360 }}>Ask an Admin to add this email address in My Team, then check again.</div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button onClick={() => window.location.reload()} style={ghostBtn}>Check again</button>
        <button onClick={signOut} style={ghostBtn}>Sign out</button>
      </div>
    </Splash>
  )
}
