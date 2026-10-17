import { useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || ''

export default function ThreadSidebar({ threads, activeThreadId, onNew, onSelect, onDelete, onRename }) {
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)

  const startEdit = (thread) => {
    setEditingId(thread.id)
    setEditValue(thread.title || 'New Conversation')
  }

  const saveEdit = async (id) => {
    const title = editValue.trim()
    if (title) {
      try {
        await fetch(`${API_BASE}/api/threads/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        })
        if (onRename) onRename()
      } catch { /* ignore */ }
    }
    setEditingId(null)
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', width: '240px', flexShrink: 0,
      borderRight: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)',
    }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-fg)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '12px' }}>
          Conversations
        </p>
        <button
          onClick={onNew}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '9px 12px', borderRadius: '10px', border: 'none',
            background: 'linear-gradient(135deg, #5b4cf5, #7c5cf6)',
            color: '#fff', fontWeight: 600, fontSize: '13px', cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(91,76,245,0.3)', transition: 'all 0.2s', fontFamily: 'inherit',
          }}
          onMouseOver={e => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
        >
          + New Conversation
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {threads.length === 0 && (
          <p style={{ fontSize: '12px', textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary)' }}>
            No conversations yet.
          </p>
        )}
        {threads.map(thread => {
          const isActive = activeThreadId === thread.id
          return (
            <div
              key={thread.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 10px', borderRadius: '10px', marginBottom: '2px',
                cursor: 'pointer', transition: 'all 0.15s',
                background: isActive
                  ? 'linear-gradient(135deg, rgba(91,76,245,0.15), rgba(139,92,246,0.08))'
                  : hoveredId === thread.id ? 'var(--bg-hover)' : 'transparent',
                border: isActive ? '1px solid rgba(91,76,245,0.3)'
                  : hoveredId === thread.id ? '1px solid var(--border-subtle)' : '1px solid transparent',
              }}
              onClick={() => onSelect(thread.id)}
              onMouseEnter={() => setHoveredId(thread.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <span style={{ fontSize: '13px', flexShrink: 0 }}>💬</span>

              {editingId === thread.id ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(thread.id); if (e.key === 'Escape') setEditingId(null) }}
                  style={{
                    flex: 1, fontSize: '12px', padding: '2px 6px', borderRadius: '6px',
                    border: '1px solid var(--accent)', background: 'var(--bg-card)',
                    color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit',
                  }}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span style={{ flex: 1, fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                  {thread.title || 'New Conversation'}
                </span>
              )}

              {(hoveredId === thread.id || editingId === thread.id) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={e => e.stopPropagation()}>
                  {editingId === thread.id ? (
                    <>
                      <button onClick={() => saveEdit(thread.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--success)', fontSize: '13px', padding: '2px' }}>✓</button>
                      <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px', padding: '2px' }}>✕</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEdit(thread)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px', padding: '2px' }}>✏</button>
                      <button
                        onClick={() => {
                          if (confirmDelete === thread.id) { onDelete(thread.id); setConfirmDelete(null) }
                          else { setConfirmDelete(thread.id); setTimeout(() => setConfirmDelete(null), 3000) }
                        }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', padding: '2px', color: confirmDelete === thread.id ? 'var(--danger)' : 'var(--text-muted)' }}
                      >🗑</button>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {activeThreadId && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
            {activeThreadId}
          </p>
        </div>
      )}
    </div>
  )
}
