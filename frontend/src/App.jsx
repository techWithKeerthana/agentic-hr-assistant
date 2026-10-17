import { useState } from 'react'
import { MessageSquare, BarChart3, FileText } from 'lucide-react'
import ThreadSidebar from './components/ThreadSidebar'
import ChatWindow from './components/ChatWindow'
import EvalDashboard from './components/EvalDashboard'
import DocPanel from './components/DocPanel'
import ThemeToggle from './components/ThemeToggle'
import { useSSE } from './hooks/useSSE'
import { useThread } from './hooks/useThread'

const TABS = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'eval', label: 'Eval Lab', icon: BarChart3 },
  { id: 'docs', label: 'Documents', icon: FileText },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('chat')
  const ssState = useSSE()
  const {
    threads, activeThreadId, createThread, selectThread, deleteThread, refreshThreads
  } = useThread()

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
          <div className="pb-2">
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
            />
          )}
          {activeTab === 'eval' && <EvalDashboard />}
          {activeTab === 'docs' && <DocPanel />}
        </div>
      </div>
    </div>
  )
}
