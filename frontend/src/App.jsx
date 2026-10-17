import { useState, useEffect, useRef } from 'react'

import ThreadSidebar from './components/ThreadSidebar'
import ChatWindow from './components/ChatWindow'
import EvalDashboard from './components/EvalDashboard'
import DocPanel from './components/DocPanel'
import Dashboard from './components/Dashboard'
import AuthPage from './components/AuthPage'
import { useSSE } from './hooks/useSSE'
import { useThread } from './hooks/useThread'

const TABS = [
  { id: 'chat',      label: 'Chat',      icon: '💬' },
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'eval',      label: 'Eval Lab',  icon: '🧪' },
  { id: 'docs',      label: 'Documents', icon: '📄' },
]

const THEME_OPTIONS = [
  { value: 'dark',   label: '🌙 Dark' },
  { value: 'light',  label: '☀️ Light' },
  { value: 'system', label: '💻 System' },
]

function applyTheme(t) {
  const root = document.documentElement
  if (t === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', t)
}

export default function App() {
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [activeTab, setActiveTab] = useState('chat')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('hr-theme') || 'system' } catch { return 'system' }
  })
  const [toast, setToast] = useState(null)
  const toastTimerRef = useRef(null)
  const dropdownRef = useRef(null)

  const showToast = (message, type = 'success') => {
    clearTimeout(toastTimerRef.current)
    setToast({ message, type })
    toastTimerRef.current = setTimeout(() => setToast(null), 3000)
  }
  const ssState = useSSE()
  const { threads, activeThreadId, createThread, selectThread, deleteThread, refreshThreads } = useThread()

  // Apply theme whenever it changes
  useEffect(() => {
    applyTheme(theme)
    try { localStorage.setItem('hr-theme', theme) } catch {}
  }, [theme])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    try {
      const stored = localStorage.getItem('hr_user')
      const token = localStorage.getItem('hr_token')
      if (stored && token) setUser(JSON.parse(stored))
    } catch { /* ignore */ }
    setAuthChecked(true)
  }, [])

  const handleLogin = (userData) => setUser(userData)

  const handleLogout = () => {
    localStorage.removeItem('hr_token')
    localStorage.removeItem('hr_user')
    setUser(null)
    setDropdownOpen(false)
  }

  const handleNewThread = () => {
    const id = createThread()
    ssState.reset()
    setActiveTab('chat')
    return id
  }

  const handleSelectThread = (id) => {
    selectThread(id)
    ssState.reset()
    setActiveTab('chat')
  }

  if (!authChecked) return null
  if (!user) return <AuthPage onLogin={handleLogin} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>

      {/* ── Sticky header ── */}
      <header style={{
        height: '56px',
        borderBottom: '1px solid var(--border)',
        background: 'rgba(15,15,19,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px',
            background: 'linear-gradient(135deg, #5b4cf5, #a855f7)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '16px', color: '#fff', letterSpacing: '-1px',
            boxShadow: '0 0 16px rgba(91,76,245,0.5)',
            flexShrink: 0,
          }}>N</div>
          <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
            NexaHR
          </span>
          {(window.SpeechRecognition || window.webkitSpeechRecognition) && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '2px 8px', borderRadius: '99px',
              background: 'rgba(16,185,129,0.1)',
              border: '1px solid rgba(16,185,129,0.2)',
              fontSize: '11px', color: '#10b981', fontWeight: 500,
            }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
              Voice
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-secondary)',
          borderRadius: '10px',
          padding: '3px',
          gap: '2px',
          border: '1px solid var(--border)',
        }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: 'none',
              background: activeTab === tab.id ? 'linear-gradient(135deg, #5b4cf5, #7c5cf6)' : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? 600 : 400,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', gap: '6px',
              boxShadow: activeTab === tab.id ? '0 2px 8px rgba(91,76,245,0.3)' : 'none',
              fontFamily: 'inherit',
            }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Right: user dropdown */}
        <div ref={dropdownRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setDropdownOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '5px 10px 5px 5px',
              borderRadius: '99px',
              border: '1px solid var(--border)',
              background: dropdownOpen ? 'var(--bg-hover)' : 'var(--bg-secondary)',
              cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit',
            }}
          >
            <div style={{
              width: '26px', height: '26px',
              background: 'linear-gradient(135deg, #5b4cf5, #a855f7)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>
              {user.name?.charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500, maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.name}
            </span>
            <span style={{
              fontSize: '10px', color: 'var(--text-muted)',
              display: 'inline-block',
              transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}>▼</span>
          </button>

          {dropdownOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', right: 0,
              width: '220px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '14px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              overflow: 'hidden',
              zIndex: 200,
              animation: 'fadeIn 0.15s ease',
            }}>
              {/* User info */}
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{user.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{user.email}</div>
              </div>

              {/* Theme picker */}
              <div style={{ padding: '8px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 8px 6px' }}>
                  Theme
                </div>
                {THEME_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setTheme(opt.value)} style={{
                    width: '100%', padding: '8px 10px',
                    borderRadius: '8px', border: 'none',
                    background: theme === opt.value ? 'var(--accent-soft)' : 'transparent',
                    color: theme === opt.value ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: '13px', cursor: 'pointer', textAlign: 'left',
                    fontWeight: theme === opt.value ? 600 : 400,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontFamily: 'inherit', transition: 'background 0.15s',
                  }}>
                    {opt.label}
                    {theme === opt.value && <span style={{ fontSize: '11px' }}>✓</span>}
                  </button>
                ))}
              </div>

              <div style={{ height: '1px', background: 'var(--border)', margin: '0 8px' }} />

              {/* Sign out */}
              <div style={{ padding: '8px' }}>
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%', padding: '8px 10px',
                    borderRadius: '8px', border: 'none',
                    background: 'transparent', color: '#ef4444',
                    fontSize: '13px', cursor: 'pointer', textAlign: 'left',
                    fontWeight: 500, transition: 'background 0.15s', fontFamily: 'inherit',
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                  onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                >
                  🚪 Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ── Body below header ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {activeTab === 'chat' && (
          <ThreadSidebar
            threads={threads}
            activeThreadId={activeThreadId}
            onNew={handleNewThread}
            onSelect={handleSelectThread}
            onDelete={deleteThread}
            onRename={refreshThreads}
          />
        )}

        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'chat' && (
            <ChatWindow
              threadId={activeThreadId}
              ssState={ssState}
              onThreadUpdated={refreshThreads}
              userName={user.name}
              showToast={showToast}
            />
          )}
          {activeTab === 'dashboard' && <Dashboard setActiveTab={setActiveTab} showToast={showToast} />}
          {activeTab === 'eval' && <EvalDashboard />}
          {activeTab === 'docs' && <DocPanel />}
        </div>
      </div>

      {/* ── Toast notifications ── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '28px', left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          animation: 'slideUp 0.25s ease forwards',
          pointerEvents: 'none',
        }}>
          <div style={{
            padding: '10px 20px',
            borderRadius: '99px',
            background: toast.type === 'error'
              ? 'rgba(239,68,68,0.95)'
              : toast.type === 'warning'
              ? 'rgba(245,158,11,0.95)'
              : 'rgba(16,185,129,0.95)',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', gap: '8px',
            whiteSpace: 'nowrap',
          }}>
            {toast.type === 'error' ? '✕' : toast.type === 'warning' ? '⚠️' : '✓'} {toast.message}
          </div>
        </div>
      )}
    </div>
  )
}
