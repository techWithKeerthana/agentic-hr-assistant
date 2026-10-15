import { useState } from 'react'
import { Plus, MessageSquare, Trash2, Edit2, Check, X } from 'lucide-react'

export default function ThreadSidebar({ threads, activeThreadId, onNew, onSelect, onDelete }) {
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)

  const startEdit = (thread) => {
    setEditingId(thread.id)
    setEditValue(thread.title || 'New Conversation')
  }

  const saveEdit = async (id) => {
    // Title edits are local-only for now (could persist via API)
    setEditingId(null)
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 border-r border-gray-800 w-64 shrink-0">
      <div className="p-4 border-b border-gray-800">
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
          <p className="text-gray-500 text-xs text-center py-8 px-4">
            No conversations yet. Start one above.
          </p>
        )}
        {threads.map(thread => (
          <div
            key={thread.id}
            className={`group flex items-center gap-2 px-3 py-2 rounded-lg mb-1 cursor-pointer transition-colors ${
              activeThreadId === thread.id
                ? 'bg-indigo-900/50 border border-indigo-700'
                : 'hover:bg-gray-800'
            }`}
            onClick={() => onSelect(thread.id)}
          >
            <MessageSquare size={14} className="text-gray-400 shrink-0" />

            {editingId === thread.id ? (
              <input
                autoFocus
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(thread.id); if (e.key === 'Escape') setEditingId(null) }}
                className="flex-1 bg-gray-700 text-white text-xs px-1 py-0.5 rounded outline-none"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="flex-1 text-xs text-gray-300 truncate">
                {thread.title || 'New Conversation'}
              </span>
            )}

            <div className="hidden group-hover:flex items-center gap-1" onClick={e => e.stopPropagation()}>
              {editingId === thread.id ? (
                <>
                  <button onClick={() => saveEdit(thread.id)} className="text-green-400 hover:text-green-300">
                    <Check size={12} />
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-gray-400 hover:text-gray-300">
                    <X size={12} />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => startEdit(thread)} className="text-gray-400 hover:text-gray-300">
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
                    className={confirmDelete === thread.id ? 'text-red-400' : 'text-gray-400 hover:text-red-400'}
                  >
                    <Trash2 size={12} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {activeThreadId && (
        <div className="p-3 border-t border-gray-800">
          <p className="text-xs text-gray-500 truncate">
            Thread: <span className="text-gray-400 font-mono">{activeThreadId}</span>
          </p>
        </div>
      )}
    </div>
  )
}
