// Shared team passcode shown before anything else loads. The passcode itself is not in the
// bundle, only its SHA-256; the browser hashes what is typed and compares. Remembered per device.
import { useEffect, useState } from 'react'

const PASSCODE_SHA256 = 'aa3cd9269290e1409fe976808f9cd82a49cf8f5ae9e784a33c3c08f89084ab1c'
const KEY = 'planning_unlocked_v1'
const NAVY = '#171738', GOLD = '#C9A84C', PARCHMENT = '#F4EFE4'

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
export function lockApp() { try { localStorage.removeItem(KEY) } catch {} location.reload() }

export function PasscodeGate({ children }) {
  const [ok, setOk] = useState(() => { try { return localStorage.getItem(KEY) === PASSCODE_SHA256 } catch { return false } })
  const [code, setCode] = useState('')
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => { document.body.style.background = NAVY }, [])
  if (ok) return children
  const submit = async () => {
    if (!code) return
    setBusy(true)
    const h = await sha256(code.trim())
    if (h === PASSCODE_SHA256) { try { localStorage.setItem(KEY, h) } catch {} setOk(true) }
    else { setErr(true); setCode(''); setTimeout(() => setErr(false), 600) }
    setBusy(false)
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: NAVY, padding: 20, fontFamily: "'DM Sans', sans-serif" }}>
      <style>{'@keyframes shake { 0%,100% { transform: translateX(0) } 20%,60% { transform: translateX(-6px) } 40%,80% { transform: translateX(6px) } }'}</style>
      <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
        <img src="paradiem-logo-dark.png" alt="Paradiem" style={{ width: 200, marginBottom: 6 }} />
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, color: GOLD, textTransform: 'uppercase', marginBottom: 28 }}>Planning</div>
        <div style={{ background: PARCHMENT, borderRadius: 16, padding: 26, animation: err ? 'shake 0.4s' : 'none' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 4 }}>Team access</div>
          <div style={{ fontSize: 12.5, color: '#5b5b6b', marginBottom: 16 }}>Enter the planning team passcode.</div>
          <input type="password" autoFocus autoComplete="off" placeholder="Passcode" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()}
            style={{ width: '100%', padding: 12, borderRadius: 10, border: `1px solid ${err ? '#A8332F' : '#d8d0bd'}`, background: '#fff', color: NAVY, fontSize: 15, boxSizing: 'border-box', fontFamily: 'inherit', textAlign: 'center', letterSpacing: 2 }} />
          <button onClick={submit} disabled={busy || !code} style={{ width: '100%', marginTop: 14, padding: '12px 0', borderRadius: 10, border: 'none', background: GOLD, color: NAVY, fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', opacity: busy || !code ? 0.6 : 1 }}>Continue</button>
          {err && <div style={{ fontSize: 12, color: '#A8332F', marginTop: 10 }}>That passcode is not right.</div>}
        </div>
        <div style={{ fontSize: 11, color: '#8B7355', marginTop: 18 }}>Paradiem, LLC · Confidential · Not for distribution</div>
      </div>
    </div>
  )
}
