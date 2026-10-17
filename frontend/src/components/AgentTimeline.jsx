import { useState } from 'react'
import { ChevronDown, ChevronUp, CheckCircle2, Loader2 } from 'lucide-react'

const NODE_LABELS = {
  router: 'Router Agent',
  rag: 'RAG Retrieval',
  booking: 'Booking Agent',
  entry: 'Entry',
}

const NODE_COLORS = {
  router: '#a78bfa',   /* purple-400 */
  rag: '#60a5fa',      /* blue-400 */
  booking: '#34d399',  /* emerald-400 */
  entry: '#9ca3af',    /* gray-400 */
}

export default function AgentTimeline({ nodeEvents, isStreaming }) {
  const [collapsed, setCollapsed] = useState(false)

  if (!nodeEvents.length && !isStreaming) return null

  return (
    <div
      className="rounded-xl mb-3 overflow-hidden border"
      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
    >
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs transition-colors"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)' }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
      >
        <span className="font-semibold uppercase tracking-wider">Agent Execution Timeline</span>
        {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-3 space-y-2">
          {nodeEvents.map((ev, i) => {
            const isRunning = ev.status === 'running'
            return (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {isRunning ? (
                    <Loader2 size={16} className="text-indigo-400 animate-spin node-running" />
                  ) : (
                    <CheckCircle2 size={16} className="text-green-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: NODE_COLORS[ev.node] || 'var(--text-primary)' }}>
                      {ev.display_name || NODE_LABELS[ev.node] || ev.node}
                    </span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full font-medium border"
                      style={isRunning
                        ? { backgroundColor: 'rgba(99,102,241,0.15)', color: '#a5b4fc', borderColor: 'rgba(99,102,241,0.4)' }
                        : { backgroundColor: 'rgba(34,197,94,0.1)', color: '#4ade80', borderColor: 'rgba(34,197,94,0.3)' }
                      }
                    >
                      {isRunning ? 'Running' : 'Completed'}
                    </span>
                  </div>
                  {ev.description && (
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>{ev.description}</p>
                  )}
                </div>
              </div>
            )
          })}

          {isStreaming && nodeEvents.length === 0 && (
            <div className="flex items-center gap-3">
              <Loader2 size={16} className="text-indigo-400 animate-spin" />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Initializing...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
