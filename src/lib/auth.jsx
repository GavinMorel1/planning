// App-wide login. Any @paradiem.org email may sign in; everyone has the same access.
// In LOCAL MODE (no Supabase env) the gate is skipped and a "local" user is used.
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase, SUPABASE_ENABLED } from './supabase'

const isParadiemEmail = (email) => (email ?? '').trim().toLowerCase().endsWith('@paradiem.org')
const NAVY = '#171738', GOLD = '#C9A84C', PARCHMENT = '#F4EFE4'
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(SUPABASE_ENABLED ? undefined : null)
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    if (!SUPABASE_ENABLED) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      setSession(next)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const email = SUPABASE_ENABLED ? (session?.user?.email ?? null) : 'local@paradiem.org'
  const allowed = SUPABASE_ENABLED ? (session ? isParadiemEmail(email) : null) : true
  const loading = SUPABASE_ENABLED && session === undefined

  const value = {
    session, email, allowed, loading, recovery, localMode: !SUPABASE_ENABLED,
    endRecovery: () => setRecovery(false),
    signOut: () => (SUPABASE_ENABLED ? supabase.auth.signOut() : Promise.resolve()),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

export function AuthGate({ children }) {
  const { session, allowed, loading, email, signOut, recovery, endRecovery, localMode } = useAuth()
  if (localMode) return children
  if (recovery) return <SetNewPassword onDone={endRecovery} signOut={signOut} />
  if (loading) return <Splash>Loading…</Splash>
  if (!session) return <Login />
  if (!allowed) return (
    <Splash>
      <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Not authorized</div>
      <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 18 }}>{email} is not a paradiem.org account.</div>
      <button onClick={signOut} style={ghostBtn}>Sign out</button>
    </Splash>
  )
  return children
}

function Splash({ children }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: NAVY, color: PARCHMENT, padding: 20, textAlign: 'center' }}>
      <div>{children}</div>
    </div>
  )
}

function Login() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  const resetPassword = async () => {
    const em = email.trim().toLowerCase()
    if (!em) { setError('Enter your email first, then tap "Forgot password?"'); return }
    setError(null); setInfo(null); setBusy(true)
    try {
      const { error: rErr } = await supabase.auth.resetPasswordForEmail(em, { redirectTo: window.location.origin + window.location.pathname })
      if (rErr) throw rErr
      setInfo('Password reset link sent. Check your inbox, then follow the link to set a new password.')
    } catch (e) { setError(friendly(e?.message)) } finally { setBusy(false) }
  }

  const submit = async () => {
    setError(null); setInfo(null); setBusy(true)
    try {
      const em = email.trim().toLowerCase()
      if (!isParadiemEmail(em)) { setError('Use your paradiem.org email.'); setBusy(false); return }
      if (mode === 'signup') {
        const { error: suErr } = await supabase.auth.signUp({ email: em, password })
        if (suErr) throw suErr
        setInfo('Account created. If confirmation is on, check your inbox, then sign in.')
        setMode('signin')
      } else {
        const { error: siErr } = await supabase.auth.signInWithPassword({ email: em, password })
        if (siErr) throw siErr
      }
    } catch (e) { setError(friendly(e?.message)) } finally { setBusy(false) }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: NAVY, padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 360, background: PARCHMENT, borderRadius: 16, padding: 26 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: NAVY }}>Paradiem Planning</div>
        <div style={{ fontSize: 13, color: '#5b5b6b', marginBottom: 18 }}>{mode === 'signin' ? 'Sign in to continue.' : 'Create your account with your paradiem.org email.'}</div>
        <input type="email" inputMode="email" autoComplete="email" placeholder="you@paradiem.org" value={email} onChange={(e) => setEmail(e.target.value)} style={field} />
        <input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} style={{ ...field, marginTop: 8 }} />
        {error && <div style={{ fontSize: 12, color: '#b3261e', marginTop: 8 }}>{error}</div>}
        {info && <div style={{ fontSize: 12, color: '#1b7a43', marginTop: 8 }}>{info}</div>}
        <button onClick={submit} disabled={busy || !email || !password} style={{ width: '100%', marginTop: 16, padding: '12px 0', borderRadius: 10, border: 'none', background: GOLD, color: NAVY, fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>
        <button onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setInfo(null) }} style={linkBtn}>
          {mode === 'signin' ? 'Need an account? Create one' : 'Have an account? Sign in'}
        </button>
        {mode === 'signin' && <button onClick={resetPassword} disabled={busy} style={linkBtn}>Forgot password?</button>}
      </div>
    </div>
  )
}

function SetNewPassword({ onDone, signOut }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const save = async () => {
    setError(null)
    if (password.length < 6) { setError('Use at least 6 characters.'); return }
    if (password !== confirm) { setError("Passwords don't match."); return }
    setBusy(true)
    try { const { error: uErr } = await supabase.auth.updateUser({ password }); if (uErr) throw uErr; setDone(true) }
    catch (e) { setError(friendly(e?.message)) } finally { setBusy(false) }
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: NAVY, padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 360, background: PARCHMENT, borderRadius: 16, padding: 26 }}>
        {done ? (<>
          <div style={{ fontSize: 18, fontWeight: 800, color: NAVY, marginBottom: 8 }}>Password updated</div>
          <button onClick={onDone} style={{ width: '100%', padding: '12px 0', borderRadius: 10, border: 'none', background: GOLD, color: NAVY, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Continue</button>
        </>) : (<>
          <div style={{ fontSize: 22, fontWeight: 800, color: NAVY }}>Set a new password</div>
          <input type="password" autoComplete="new-password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...field, marginTop: 14 }} />
          <input type="password" autoComplete="new-password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} style={{ ...field, marginTop: 8 }} />
          {error && <div style={{ fontSize: 12, color: '#b3261e', marginTop: 8 }}>{error}</div>}
          <button onClick={save} disabled={busy || !password || !confirm} style={{ width: '100%', marginTop: 16, padding: '12px 0', borderRadius: 10, border: 'none', background: GOLD, color: NAVY, fontWeight: 800, fontSize: 14, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? '…' : 'Save password'}</button>
          <button onClick={signOut} style={linkBtn}>Cancel</button>
        </>)}
      </div>
    </div>
  )
}

const field = { width: '100%', padding: '12px', borderRadius: 10, border: '1px solid #d8d0bd', background: '#fff', color: NAVY, fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit' }
const ghostBtn = { padding: '9px 18px', borderRadius: 10, border: `1px solid ${GOLD}`, background: 'transparent', color: PARCHMENT, fontSize: 13, cursor: 'pointer' }
const linkBtn = { width: '100%', marginTop: 10, background: 'none', border: 'none', color: '#5b5b6b', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }
function friendly(m = '') {
  if (/invalid login/i.test(m)) return 'Incorrect email or password.'
  if (/already registered/i.test(m)) return 'That account exists. Switch to Sign in.'
  if (/confirm/i.test(m)) return 'Confirm your email first. Check your inbox.'
  return m || 'Something went wrong.'
}
