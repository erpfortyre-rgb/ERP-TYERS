import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './style.css'

function WailsReady({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(() => !!(window as any)['go']?.['main'])
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (ready) return
    let cancelled = false
    const check = () => {
      if ((window as any)['go']?.['main']) {
        if (!cancelled) setReady(true)
        return
      }
      if (!cancelled) setTimeout(check, 200)
    }
    check()
    const timeout = setTimeout(() => { if (!cancelled) setTimedOut(true) }, 5000)
    return () => { cancelled = true; clearTimeout(timeout) }
  }, [ready])

  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f5f7fa' }}>
        <div style={{ textAlign: 'center', maxWidth: 360 }}>
          {!timedOut ? (
            <>
              <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTop: '3px solid #1976D2', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
              <p style={{ color: '#666', fontSize: 14 }}>Connecting to backend...</p>
            </>
          ) : (
            <>
              <div style={{ width: 50, height: 50, borderRadius: 14, background: 'linear-gradient(135deg, #ef4444, #f87171)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#fff', fontSize: 24, fontWeight: 700 }}>!</div>
              <p style={{ color: '#333', fontSize: 15, fontWeight: 600, margin: '0 0 8px' }}>Connection Failed</p>
              <p style={{ color: '#666', fontSize: 13, lineHeight: 1.5 }}>
                Backend is not reachable. Please close this window and reopen the application.
              </p>
              <p style={{ color: '#999', fontSize: 11, marginTop: 12 }}>
                Do not use browser reload — it disconnects from the desktop runtime.
              </p>
            </>
          )}
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <WailsReady>
        <App />
      </WailsReady>
      <Toaster position="bottom-right" toastOptions={{ duration: 3000 }} />
    </HashRouter>
  </React.StrictMode>,
)
