import { useState, useCallback, useRef } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || ''

export function useSSE() {
  const [isStreaming, setIsStreaming] = useState(false)
  const [tokens, setTokens] = useState('')
  const [nodeEvents, setNodeEvents] = useState([])
  const [citations, setCitations] = useState([])
  const [bookingCard, setBookingCard] = useState(null)
  const [bookingConfirmed, setBookingConfirmed] = useState(null)
  const [retrievalStatus, setRetrievalStatus] = useState(null)
  const [followUpQuestions, setFollowUpQuestions] = useState([])
  const [isDone, setIsDone] = useState(false)
  const [error, setError] = useState(null)
  const [doneData, setDoneData] = useState(null)
  const abortRef = useRef(null)

  const reset = useCallback(() => {
    setTokens('')
    setNodeEvents([])
    setCitations([])
    setBookingCard(null)
    setBookingConfirmed(null)
    setRetrievalStatus(null)
    setFollowUpQuestions([])
    setIsDone(false)
    setError(null)
    setDoneData(null)
  }, [])

  const sendMessage = useCallback(async (message, threadId, onToken) => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    // 60-second timeout — Render free tier can be slow to wake up
    const timeoutId = setTimeout(() => controller.abort('timeout'), 60_000)

    reset()
    setIsStreaming(true)

    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, thread_id: threadId }),
        signal: controller.signal,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      clearTimeout(timeoutId)

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        let currentEvent = null
        let currentData = null

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            try {
              currentData = JSON.parse(line.slice(6))
            } catch { currentData = {} }

            if (currentEvent && currentData !== null) {
              handleEvent(currentEvent, currentData, onToken)
              currentEvent = null
              currentData = null
            }
          }
        }
      }
    } catch (err) {
      clearTimeout(timeoutId)
      if (err.name === 'AbortError' || err.message === 'timeout') {
        setError('Backend is waking up, please try again in 30 seconds.')
      } else {
        setError('Connection error. Please try again.')
      }
    } finally {
      setIsStreaming(false)
      setIsDone(true)
    }
  }, [reset])

  const handleEvent = (eventType, data, onToken) => {
    switch (eventType) {
      case 'node_change': {
        const entry = {
          node: data.node,
          display_name: data.display_name || data.node,
          description: data.description || '',
          status: data.status || 'completed',
          timestamp: Date.now(),
        }
        setNodeEvents(prev => {
          const idx = prev.findIndex(e => e.node === data.node)
          if (idx >= 0) {
            const updated = [...prev]
            updated[idx] = { ...updated[idx], ...entry }
            return updated
          }
          return [...prev, entry]
        })
        break
      }
      case 'token':
        setTokens(prev => prev + (data.token || ''))
        if (onToken) onToken(data.token || '')
        break
      case 'citation':
        setCitations(prev => [...prev, data])
        break
      case 'booking_card':
        setBookingCard(data)
        break
      case 'booking_confirmed':
        setBookingConfirmed(data)
        break
      case 'retrieval_status':
        setRetrievalStatus(data)
        break
      case 'followup_questions':
        if (Array.isArray(data.questions)) setFollowUpQuestions(data.questions)
        break
      case 'done':
        setDoneData(data)
        setIsDone(true)
        break
      case 'error':
        setError(data.message || 'An error occurred')
        break
      default:
        break
    }
  }

  const abort = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
    setIsStreaming(false)
  }, [])

  return {
    sendMessage,
    abort,
    isStreaming,
    tokens,
    nodeEvents,
    citations,
    bookingCard,
    bookingConfirmed,
    retrievalStatus,
    followUpQuestions,
    isDone,
    error,
    doneData,
    reset,
  }
}
