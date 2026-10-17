import { useState } from 'react'
import { Plus, MessageSquare, Trash2, Edit2, Check, X } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || ''

export default function ThreadSidebar({ threads, activeThreadId, onNew, onSelect, onDelete, onRename }) {
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

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
    <div
      className="flex flex-col h-full w-64 shrink-0 border-r"
      style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
    >
      <div className="p-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-sm font-semibold text-indigo-400 uppercase tracking-wider mb-3">
          HR Assistant
        </h1>
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          New Conversation
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {threads.length === 0 && (
          <p className="text-xs text-center py-8 px-4" style={{ color: 'var(--text-secondary)' }}>
            No conversations yet. Start one above.
          </p>
        )}
        {threads.map(thread => {
          const isActive = activeThreadId === thread.id
          return (
            <div
              key={thread.id}
              className="group flex items-center gap-2 px-3 py-2 rounded-lg mb-1 cursor-pointer transition-colors"
              style={{
                backgroundColor: isActive ? undefined : undefined,
                border: isActive ? '1px solid #6366f1' : '1px solid transparent',
              }}
              onClick={() => onSelect(thread.id)}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-card)' }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = '' }}
            >
              <MessageSquare size={14} className="shrink-0" style={{ color: 'var(--text-secondary)' }} />

              {editingId === thread.id ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(thread.id); if (e.key === 'Escape') setEditingId(null) }}
                  className="flex-1 text-xs px-1 py-0.5 rounded outline-none"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span className="flex-1 text-xs truncate" style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-primary)', opacity: isActive ? 1 : 0.85 }}>
                  {thread.title || 'New Conversation'}
                </span>
              )}

              <div className="hidden group-hover:flex items-center gap-1" onClick={e => e.stopPropagation()}>
                {editingId === thread.id ? (
                  <>
                    <button onClick={() => saveEdit(thread.id)} className="text-green-400 hover:text-green-300">
                      <Check size={12} />
                    </button>
                    <button onClick={() => setEditingId(null)} style={{ color: 'var(--text-secondary)' }}>
                      <X size={12} />
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => startEdit(thread)} style={{ color: 'var(--text-secondary)' }} className="hover:text-indigo-400">
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirmDelete === thread.id) {
                          onDelete(thread.id)
                          setConfirmDelete(null)
                        } else {
                          setConfirmDelete(thread.id)
                          setTimeout(() => setConfirmDelete(null), 3000)
                        }
                      }}
                      className={confirmDelete === thread.id ? 'text-red-400' : 'hover:text-red-400'}
                      style={{ color: confirmDelete === thread.id ? undefined : 'var(--text-secondary)' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {activeThreadId && (
        <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
            Thread: <span className="font-mono" style={{ color: 'var(--text-primary)', opacity: 0.7 }}>{activeThreadId}</span>
          </p>
        </div>
      )}
    </div>
  )
}
