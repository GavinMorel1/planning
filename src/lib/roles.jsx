import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase, SUPABASE_ENABLED } from './supabase'
import { useAuth } from './auth'
import { setRole, getRole } from './permissions'

const RoleContext = createContext({ role: 'planning', ready: true, reload: () => {} })

export function RoleProvider({ children }) {
  const { email } = useAuth()
  const [role, setLocal] = useState('planning')
  const [ready, setReady] = useState(!SUPABASE_ENABLED)
  const load = useCallback(async () => {
    if (!SUPABASE_ENABLED || !email) { setRole('planning'); setLocal('planning'); setReady(true); return }
    try {
      const { data, error } = await supabase.from('app_roles').select('role').eq('email', String(email).toLowerCase()).maybeSingle()
      if (error) throw error
      const r = data?.role || 'planning' // no row (or table not created yet) = Planning Team, as in the database
      setRole(r); setLocal(getRole())
    } catch { setRole('planning'); setLocal('planning') } finally { setReady(true) }
  }, [email])
  useEffect(() => { load() }, [load])
  return <RoleContext.Provider value={{ role, ready, reload: load }}>{children}</RoleContext.Provider>
}
export const useRole = () => useContext(RoleContext)
