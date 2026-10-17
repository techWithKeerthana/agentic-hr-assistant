import { useState, useEffect } from 'react'
import { MessageSquare, BarChart3, FileText, PieChart } from 'lucide-react'
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
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'dashboard', label: 'Dashboard', icon: PieChart },
  { id: 'eval', label: 'Eval Lab', icon: BarChart3 },
  { id: 'docs', label: 'Documents', icon: FileText },
]

export default function App() {
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [activeTab, setActiveTab] = useState('chat')
  const ssState = useSSE()
  const {
    threads, activeThreadId, createThread, selectThread, deleteThread, refreshThreads
  } = useThread()

  // Restore session from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('hr_user')
      const token = localStorage.getItem('hr_token')
      if (stored && token) setUser(JSON.parse(stored))
    } catch {
      // ignore parse errors
    }
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

  // Prevent flash while checking localStorage
  if (!authChecked) return null

  // Show login/register page when not authenticated
  if (!user) return <AuthPage onLogin={handleLogin} />

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      {/* Left sidebar */}
      <ThreadSidebar
        threads={threads}
        activeThreadId={activeThreadId}
        onNew={handleNewThread}
        onSelect={handleSelectThread}
        onDelete={deleteThread}
        onRename={refreshThreads}
      />

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Tab bar */}
        <div
          className="flex items-center justify-between px-4 pt-3 pb-0 border-b"
          style={{ backgroundColor: 'var(--bg-primary)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-1">
            {TABS.map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2 px-4 py-2 text-sm rounded-t-lg transition-colors border-b-2"
                  style={{
                    color: isActive ? 'var(--accent-fg)' : 'var(--text-secondary)',
                    borderBottomColor: isActive ? 'var(--accent)' : 'transparent',
                    backgroundColor: isActive ? 'var(--bg-secondary)' : 'transparent',
                  }}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Right side: user name + logout + theme */}
          <div className="flex items-center gap-3 pb-2">
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              👤 {user.name}
            </span>
            <button
              onClick={handleLogout}
              style={{
                padding: '4px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              Sign out
            </button>
            <ThemeToggle />
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-hidden">
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
