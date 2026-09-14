import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider, AuthGate } from './lib/auth'
import { StoreProvider } from './lib/store'
import { PasscodeGate } from './lib/passcode'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('App crash:', error, info) }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, background: '#171738', color: '#FAF7F2', textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Something went wrong</div>
          <div style={{ fontSize: 13, color: '#B8B4AC', marginBottom: 24, maxWidth: 420 }}>{String(this.state.error?.message || 'Unexpected error')}</div>
          <button onClick={() => location.reload()} style={{ padding: '12px 28px', borderRadius: 10, border: '1px solid rgba(201,168,76,0.4)', background: 'rgba(201,168,76,0.12)', color: '#FAF7F2', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Reload</button>
        </div>
      )
    }
    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PasscodeGate>
    <AuthProvider>
      <AuthGate>
        <StoreProvider>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </StoreProvider>
      </AuthGate>
    </AuthProvider>
    </PasscodeGate>
  </React.StrictMode>,
)

requestAnimationFrame(() => {
  const splash = document.getElementById('app-splash')
  if (splash) { splash.style.transition = 'opacity 0.3s ease'; splash.style.opacity = '0'; setTimeout(() => splash.remove(), 320) }
})
