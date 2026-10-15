import { useState } from 'react'
import { ChevronDown, ChevronUp, CheckCircle2, Loader2, Circle } from 'lucide-react'

const NODE_LABELS = {
  router: 'Router Agent',
  rag: 'RAG Retrieval',
  booking: 'Booking Agent',
  entry: 'Entry',
}

const NODE_COLORS = {
  router: 'text-purple-400',
  rag: 'text-blue-400',
  booking: 'text-emerald-400',
  entry: 'text-gray-400',
}

export default function AgentTimeline({ nodeEvents, isStreaming }) {
  const [collapsed, setCollapsed] = useState(false)

  if (!nodeEvents.length && !isStreaming) return null

  return (
    <div className="bg-gray-900/80 border border-gray-700 rounded-xl mb-3 overflow-hidden">
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-gray-400 hover:text-gray-300 transition-colors"
      >
        <span className="font-semibold uppercase tracking-wider">Agent Execution Timeline</span>
        {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-3 space-y-2">
          {nodeEvents.map((ev, i) => {
            const isLast = i === nodeEvents.length - 1
            const isRunning = isLast && isStreaming
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
                    <span className={`text-xs font-semibold ${NODE_COLORS[ev.node] || 'text-gray-300'}`}>
                      {NODE_LABELS[ev.node] || ev.node}
                    </span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      isRunning
                        ? 'bg-indigo-900/50 text-indigo-300 border border-indigo-700'
                        : 'bg-green-900/30 text-green-400 border border-green-800'
                    }`}>
                      {isRunning ? 'Running' : 'Completed'}
                    </span>
                  </div>
                  {ev.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{ev.description}</p>
                  )}
                </div>
              </div>
            )
          })}

          {isStreaming && nodeEvents.length === 0 && (
            <div className="flex items-center gap-3">
              <Loader2 size={16} className="text-indigo-400 animate-spin" />
              <span className="text-xs text-gray-400">Initializing...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
