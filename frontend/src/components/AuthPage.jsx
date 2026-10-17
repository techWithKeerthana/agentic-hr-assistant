import { useState } from 'react'
import { API_URL as API } from '../config'

const labelStyle = {
  fontSize: '13px',
  fontWeight: 500,
  color: 'var(--text-secondary)',
  display: 'block',
  marginBottom: '6px',
}

const inputStyle = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: '10px',
  border: '1px solid var(--border)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  fontSize: '14px',
  fontFamily: 'inherit',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  boxSizing: 'border-box',
}

function getPasswordStrength(password) {
  if (!password) return { score: 0, label: '', color: '', checks: {} }
  const checks = {
    length:  password.length >= 8,
    upper:   /[A-Z]/.test(password),
    lower:   /[a-z]/.test(password),
    number:  /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  }
  const score = Object.values(checks).filter(Boolean).length
  const levels = [
    { label: '',            color: '' },
    { label: 'Very Weak',  color: '#ef4444' },
    { label: 'Weak',       color: '#f97316' },
    { label: 'Fair',       color: '#f59e0b' },
    { label: 'Strong',     color: '#10b981' },
    { label: 'Very Strong',color: '#059669' },
  ]
  return { score, ...levels[score], checks }
}

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const switchMode = (m) => {
    setMode(m)
    setError('')
    setConfirmPassword('')
    setShowPassword(false)
  }

  const strength = getPasswordStrength(form.password)
  const passwordsMatch = form.password === confirmPassword

  const isSubmitDisabled = loading
    || (mode === 'register' && strength.score < 4)
    || (mode === 'register' && !!confirmPassword && !passwordsMatch)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (mode === 'register' && !passwordsMatch) {
      setError('Passwords do not match')
      return
    }
    setLoading(true)
    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
    const body = mode === 'login'
      ? { email: form.email, password: form.password }
      : { name: form.name, email: form.email, password: form.password }
    try {
      const res = await fetch(`${API}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail || 'Something went wrong')
        return
      }
      localStorage.setItem('hr_token', data.token)
      localStorage.setItem('hr_user', JSON.stringify({ name: data.name, email: data.email }))
      onLogin({ name: data.name, email: data.email })
    } catch {
      setError('Cannot connect to server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background orbs */}
      <div style={{
        position: 'absolute', width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(91,76,245,0.15) 0%, transparent 70%)',
        top: '-100px', right: '-100px', borderRadius: '50%',
        animation: 'float 6s ease-in-out infinite', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: '300px', height: '300px',
        background: 'radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)',
        bottom: '-50px', left: '-50px', borderRadius: '50%',
        animation: 'float 8s ease-in-out infinite reverse', pointerEvents: 'none',
      }} />

      {/* Card */}
      <div style={{
        width: '420px', background: 'var(--bg-card)',
        border: '1px solid var(--border)', borderRadius: '24px',
        padding: '40px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)',
        position: 'relative', zIndex: 1,
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px', height: '56px',
            background: 'linear-gradient(135deg, #5b4cf5, #a855f7)',
            borderRadius: '18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '26px', color: '#fff', letterSpacing: '-2px',
            margin: '0 auto 16px',
            boxShadow: '0 0 24px rgba(91,76,245,0.45)',
          }}>N</div>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
            NexaHR
          </h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
            {mode === 'login' ? 'Welcome back!' : 'Create your account'}
          </p>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '12px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            Intelligent HR · Powered by AI
          </p>
        </div>

        {/* Mode switcher */}
        <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '10px', padding: '4px', marginBottom: '24px', border: '1px solid var(--border)' }}>
          {['login', 'register'].map((m) => (
            <button key={m} onClick={() => switchMode(m)} style={{
              flex: 1, padding: '8px', borderRadius: '8px', border: 'none',
              background: mode === m ? 'linear-gradient(135deg, #5b4cf5, #7c5cf6)' : 'transparent',
              color: mode === m ? '#fff' : 'var(--text-secondary)',
              fontWeight: 600, fontSize: '14px', cursor: 'pointer',
              transition: 'all 0.2s', textTransform: 'capitalize', fontFamily: 'inherit',
              boxShadow: mode === m ? '0 2px 8px rgba(91,76,245,0.3)' : 'none',
            }}>{m}</button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {mode === 'register' && (
            <div>
              <label style={labelStyle}>Full Name</label>
              <input type="text" required placeholder="Jane Smith" value={form.name} onChange={set('name')} style={inputStyle} />
            </div>
          )}

          <div>
            <label style={labelStyle}>Email</label>
            <input type="email" required placeholder="you@company.com" value={form.email} onChange={set('email')} style={inputStyle} />
          </div>

          {/* Password field with show/hide toggle */}
          <div>
            <label style={labelStyle}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder={mode === 'register' ? 'Min 8 chars, upper, number, special' : 'Your password'}
                value={form.password}
                onChange={set('password')}
                style={{ ...inputStyle, paddingRight: '44px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                style={{
                  position: 'absolute', right: '12px', top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none',
                  color: 'var(--text-muted)', cursor: 'pointer',
                  fontSize: '16px', padding: '4px', lineHeight: 1,
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>

            {/* Password strength meter — register only */}
            {mode === 'register' && form.password && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '6px' }}>
                  {[1,2,3,4,5].map(i => (
                    <div key={i} style={{
                      flex: 1, height: '3px', borderRadius: '99px',
                      background: i <= strength.score ? strength.color : 'var(--border)',
                      transition: 'background 0.3s',
                    }} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '11px', color: strength.color, fontWeight: 600 }}>
                    {strength.label}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {[
                    { key: 'length',  label: 'At least 8 characters' },
                    { key: 'upper',   label: 'One uppercase letter' },
                    { key: 'lower',   label: 'One lowercase letter' },
                    { key: 'number',  label: 'One number' },
                    { key: 'special', label: 'One special character (!@#$...)' },
                  ].map(req => (
                    <div key={req.key} style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      fontSize: '11px',
                      color: strength.checks?.[req.key] ? '#10b981' : 'var(--text-muted)',
                    }}>
                      <span>{strength.checks?.[req.key] ? '✓' : '○'}</span>
                      {req.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Confirm password — register only */}
          {mode === 'register' && (
            <div>
              <label style={labelStyle}>Confirm Password</label>
              <input
                type="password"
                required
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                style={{
                  ...inputStyle,
                  borderColor: confirmPassword && !passwordsMatch ? '#ef4444' : 'var(--border)',
                }}
              />
              {confirmPassword && !passwordsMatch && (
                <p style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px', margin: '4px 0 0' }}>
                  ⚠️ Passwords do not match
                </p>
              )}
            </div>
          )}

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: '10px',
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
              color: '#f87171', fontSize: '13px',
            }}>⚠️ {error}</div>
          )}

          <button
            type="submit"
            disabled={isSubmitDisabled}
            style={{
              padding: '12px', borderRadius: '12px', border: 'none',
              background: isSubmitDisabled ? 'var(--bg-hover)' : 'linear-gradient(135deg, #5b4cf5, #7c5cf6)',
              color: isSubmitDisabled ? 'var(--text-muted)' : '#fff',
              fontWeight: 700, fontSize: '15px',
              cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
              marginTop: '4px', fontFamily: 'inherit',
              boxShadow: isSubmitDisabled ? 'none' : '0 4px 16px rgba(91,76,245,0.35)',
              transition: 'all 0.2s',
            }}
          >
            {loading ? '⏳ Please wait...' : mode === 'login' ? '🔐 Sign In' : '🚀 Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
