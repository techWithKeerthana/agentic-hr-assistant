import { useState } from 'react'

const NODE_LABELS = {
  router: 'Router Agent',
  rag: 'RAG Retrieval',
  booking: 'Booking Agent',
  entry: 'Entry',
}

const NODE_COLORS = {
  router: '#a78bfa',
  rag: '#60a5fa',
  booking: '#34d399',
  entry: '#9ca3af',
}

export default function AgentTimeline({ nodeEvents, isStreaming }) {
  const [collapsed, setCollapsed] = useState(false)

  if (!nodeEvents.length && !isStreaming) return null

  return (
    <div style={{
      borderRadius: '12px', marginBottom: '12px', overflow: 'hidden',
      background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
    }}>
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 600,
          letterSpacing: '0.6px', textTransform: 'uppercase', fontFamily: 'inherit',
          transition: 'color 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
      >
        <span>Agent Execution Timeline</span>
        <span style={{ fontSize: '14px' }}>{collapsed ? '▾' : '▴'}</span>
      </button>

      {!collapsed && (
        <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {nodeEvents.map((ev, i) => {
            const isRunning = ev.status === 'running'
            const nodeColor = NODE_COLORS[ev.node] || 'var(--text-primary)'
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 12px', borderRadius: '8px',
                background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
              }}>
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                  background: isRunning ? 'var(--accent)' : 'var(--success)',
                  boxShadow: isRunning ? '0 0 6px var(--accent)' : 'none',
                  animation: isRunning ? 'pulse 1.5s infinite' : 'none',
                }} />
                <span style={{ fontSize: '12px', color: nodeColor, fontWeight: 600, fontFamily: 'monospace' }}>
                  {ev.display_name || NODE_LABELS[ev.node] || ev.node}
                </span>
                {ev.description && (
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {ev.description}
                  </span>
                )}
                <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0 }}>
                  {isRunning ? '⏳' : '✓'}
                </span>
              </div>
            )
          })}

          {isStreaming && nodeEvents.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Initializing...</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
