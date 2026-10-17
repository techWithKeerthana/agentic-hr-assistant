import { useState, useEffect } from 'react'

import ThreadSidebar from './components/ThreadSidebar'
import ChatWindow from './components/ChatWindow'
import EvalDashboard from './components/EvalDashboard'
import DocPanel from './components/DocPanel'
import Dashboard from './components/Dashboard'
import ThemeToggle from './components/ThemeToggle'
import AuthPage from './components/AuthPage'
import { useSSE } from './hooks/useSSE'
import { useThread } from './hooks/useThread'

const TABS = [
  { id: 'chat',      label: 'Chat',      icon: '💬' },
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'eval',      label: 'Eval Lab',  icon: '🧪' },
  { id: 'docs',      label: 'Documents', icon: '📄' },
]

export default function App() {
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [activeTab, setActiveTab] = useState('chat')
  const ssState = useSSE()
  const {
    threads, activeThreadId, createThread, selectThread, deleteThread, refreshThreads
  } = useThread()

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

  const initial = user.name?.charAt(0).toUpperCase() || '?'

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
            background: 'linear-gradient(135deg, #5b4cf5, #8b5cf6)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', boxShadow: '0 0 12px rgba(91,76,245,0.4)',
            flexShrink: 0,
          }}>🤖</div>
          <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
            HR Assistant
          </span>
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
              background: activeTab === tab.id
                ? 'linear-gradient(135deg, #5b4cf5, #7c5cf6)'
                : 'transparent',
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

        {/* Right: theme + user */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ThemeToggle />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px', height: '28px',
              background: 'linear-gradient(135deg, #5b4cf5, #8b5cf6)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>{initial}</div>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user.name}
            </span>
            <button
              onClick={handleLogout}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-muted)',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                fontFamily: 'inherit',
              }}
              onMouseOver={e => e.currentTarget.style.borderColor = 'var(--danger)'}
              onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >Sign out</button>
          </div>
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
            />
          )}
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'eval' && <EvalDashboard />}
          {activeTab === 'docs' && <DocPanel />}
        </div>
      </div>
    </div>
  )
}
