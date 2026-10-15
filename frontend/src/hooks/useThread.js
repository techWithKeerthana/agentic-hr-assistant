import { useState, useEffect, useCallback } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || ''

export function useThread() {
  const [threads, setThreads] = useState([])
  const [activeThreadId, setActiveThreadId] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/threads`)
      const data = await res.json()
      setThreads(data.threads || [])
    } catch {
      // silently fail
    }
  }, [])

  useEffect(() => {
    fetchThreads()
    const interval = setInterval(fetchThreads, 10000)
    return () => clearInterval(interval)
  }, [fetchThreads])

  const createThread = useCallback(() => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setActiveThreadId(id)
    return id
  }, [])

  const selectThread = useCallback((id) => {
    setActiveThreadId(id)
  }, [])

  const deleteThread = useCallback(async (id) => {
    try {
      await fetch(`${API_BASE}/api/threads/${id}`, { method: 'DELETE' })
      setThreads(prev => prev.filter(t => t.id !== id))
      if (activeThreadId === id) {
        setActiveThreadId(null)
      }
    } catch { /* ignore */ }
  }, [activeThreadId])

  const refreshThreads = useCallback(() => {
    fetchThreads()
  }, [fetchThreads])

  return {
    threads,
    activeThreadId,
    loading,
    createThread,
    selectThread,
    deleteThread,
    refreshThreads,
    setActiveThreadId,
  }
}
