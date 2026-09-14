import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

// When the two env vars are missing the app runs in LOCAL MODE: no login, data in this
// browser only. Set them (see docs/SETUP.md) to turn on shared, authenticated storage.
export const SUPABASE_ENABLED = Boolean(url && anon)

export const supabase = SUPABASE_ENABLED
  ? createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } })
  : null
