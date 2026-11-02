import { useState, useRef, useEffect } from 'react'
import { LoginByPassword } from '../../wailsjs/go/main/App'

export interface UserInfo {
  id: string
  name: string
  email: string
  roleName: string
  permissions: string
}

interface LoginPageProps {
  onLogin: (user: UserInfo) => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    emailRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Please enter email and password')
      return
    }
    setLoading(true)
    setError('')
    try {
      if (!(window as any)['go']?.['main']) {
        setError('Backend not connected. Close DevTools and reopen the app.')
        setLoading(false)
        return
      }
      const user = await LoginByPassword(email, password)
      localStorage.setItem('sst_user', JSON.stringify(user))
      onLogin(user)
    } catch (err: any) {
      setError(typeof err === 'string' ? err : err?.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.brand}>
          <div style={styles.logoIcon}>SST</div>
          <h1 style={styles.title}>SHIV SHANKAR TYRES</h1>
          <p style={styles.subtitle}>ERP System</p>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        <form style={styles.form} onSubmit={handleSubmit}>
          <div style={styles.field}>
            <label style={styles.fieldLabel}>Email</label>
            <input
              ref={emailRef}
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              style={styles.input}
              placeholder="owner@sst.local"
              autoComplete="email"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.fieldLabel}>Password</label>
            <div style={styles.passwordWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                style={styles.passwordInput}
                placeholder="Enter password"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                style={styles.toggleBtn}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <button type="submit" style={styles.loginBtn} disabled={loading}>
            {loading ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <div style={styles.footer}>
          <span style={styles.footerText}>Default: owner@sst.local / admin</span>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    width: '100vw',
    background: '#f5f7fa',
  },
  card: {
    background: '#ffffff',
    border: '1px solid rgba(0, 0, 0, 0.1)',
    borderRadius: '16px',
    padding: '40px 36px 28px',
    width: '400px',
    maxWidth: '95vw',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
  },
  brand: {
    textAlign: 'center' as const,
    marginBottom: '4px',
  },
  logoIcon: {
    width: '60px',
    height: '60px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, #1976D2, #42A5F5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 12px',
    fontWeight: 800,
    fontSize: '18px',
    color: '#fff',
    letterSpacing: '1px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#1a1a2e',
    letterSpacing: '1.5px',
    margin: 0,
  },
  subtitle: {
    fontSize: '13px',
    color: '#666',
    marginTop: '4px',
  },
  error: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#dc2626',
    fontSize: '13px',
    textAlign: 'center' as const,
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
    width: '100%',
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  fieldLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#555',
  },
  input: {
    padding: '11px 14px',
    borderRadius: '8px',
    border: '1px solid rgba(0, 0, 0, 0.15)',
    background: '#fff',
    color: '#1a1a2e',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.15s ease',
  },
  passwordWrapper: {
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
  },
  passwordInput: {
    padding: '11px 14px',
    paddingRight: '60px',
    borderRadius: '8px',
    border: '1px solid rgba(0, 0, 0, 0.15)',
    background: '#fff',
    color: '#1a1a2e',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.15s ease',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  toggleBtn: {
    position: 'absolute' as const,
    right: '10px',
    background: 'none',
    border: 'none',
    color: '#1976D2',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '4px 6px',
  },
  loginBtn: {
    padding: '12px',
    borderRadius: '10px',
    border: 'none',
    background: '#1976D2',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '4px',
    transition: 'background 0.15s ease',
    width: '100%',
  },
  footer: {
    marginTop: '8px',
    textAlign: 'center' as const,
  },
  footerText: {
    fontSize: '11px',
    color: '#999',
  },
}
