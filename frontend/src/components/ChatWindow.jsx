import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, User } from 'lucide-react'
import AgentTimeline from './AgentTimeline'
import CitationBadge from './CitationBadge'
import BookingCard from './BookingCard'
import FollowUpChips from './FollowUpChips'

const API_BASE = import.meta.env.VITE_API_URL || ''

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2 rounded-2xl w-fit" style={{ backgroundColor: 'var(--bg-card)' }}>
      <span className="w-2 h-2 rounded-full typing-dot" style={{ backgroundColor: 'var(--text-secondary)' }} />
      <span className="w-2 h-2 rounded-full typing-dot" style={{ backgroundColor: 'var(--text-secondary)' }} />
      <span className="w-2 h-2 rounded-full typing-dot" style={{ backgroundColor: 'var(--text-secondary)' }} />
    </div>
  )
}

function MessageBubble({ message, onSlotSelect, onCancel, onConfirm }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex gap-3 mb-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{ backgroundColor: isUser ? '#4f46e5' : 'var(--bg-card)' }}
      >
        {isUser
          ? <User size={16} className="text-white" />
          : <Bot size={16} className="text-indigo-400" />
        }
      </div>
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${isUser ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
          style={isUser
            ? { backgroundColor: '#4f46e5', color: '#ffffff' }
            : { backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }
          }
        >
          {message.content}
        </div>

        {!isUser && (message.citations?.length > 0 || message.abstained) && (
          <CitationBadge
            citations={message.citations || []}
            confidence={message.confidence}
            abstained={message.abstained}
          />
        )}

        {!isUser && message.bookingCard && (
          <BookingCard
            bookingData={message.bookingCard}
            onSlotSelect={onSlotSelect}
            onCancel={onCancel}
            onConfirm={onConfirm}
          />
        )}
      </div>
    </div>
  )
}

export default function ChatWindow({ threadId, onThreadUpdated, ssState }) {
  const {
    sendMessage, isStreaming, tokens, nodeEvents, citations,
    bookingCard, bookingConfirmed, error, doneData, reset,
    followUpQuestions,
  } = ssState

  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [streamingContent, setStreamingContent] = useState('')
  const [currentNodeEvents, setCurrentNodeEvents] = useState([])
  const [currentCitations, setCurrentCitations] = useState([])
  const [currentBookingCard, setCurrentBookingCard] = useState(null)
  const [shownFollowUps, setShownFollowUps] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const prevThreadRef = useRef(null)
  const bookingCardRef = useRef(null)

  useEffect(() => {
    if (!threadId || threadId === prevThreadRef.current) return
    prevThreadRef.current = threadId
    setMessages([])
    reset()
    setStreamingContent('')
    setCurrentNodeEvents([])
    setCurrentCitations([])
    setCurrentBookingCard(null)
    setShownFollowUps([])

    setLoadingHistory(true)
    fetch(`${API_BASE}/api/threads/${threadId}/messages`)
      .then(r => r.json())
      .then(data => {
        if (data.messages?.length > 0) {
          setMessages(data.messages.map(m => ({ role: m.role, content: m.content })))
        }
      })
      .catch(() => {})
      .finally(() => setLoadingHistory(false))
  }, [threadId, reset])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent, isStreaming])

  useEffect(() => { if (tokens) setStreamingContent(tokens) }, [tokens])
  useEffect(() => { if (nodeEvents.length > 0) setCurrentNodeEvents(nodeEvents) }, [nodeEvents])
  useEffect(() => { if (citations.length > 0) setCurrentCitations(citations) }, [citations])
  useEffect(() => {
    bookingCardRef.current = bookingCard
    if (bookingCard) setCurrentBookingCard(bookingCard)
  }, [bookingCard])

  // Show follow-up chips once streaming is done
  useEffect(() => {
    if (followUpQuestions?.length > 0) setShownFollowUps(followUpQuestions)
  }, [followUpQuestions])

  useEffect(() => {
    if (!doneData) return
    const finalCard = bookingConfirmed
      ? { status: 'confirmed', ref_id: bookingConfirmed.ref_id, slot_label: bookingConfirmed.slot_label }
      : bookingCardRef.current

    const content = streamingContent || ''
    if (content || finalCard) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content,
          citations: currentCitations,
          bookingCard: finalCard,
          abstained: content.includes("doesn't contain enough information"),
        },
      ])
    }
    setStreamingContent('')
    setCurrentCitations([])
    setCurrentBookingCard(null)
    setCurrentNodeEvents([])
    if (onThreadUpdated) onThreadUpdated()
  }, [doneData])

  const handleSend = async (text) => {
    const msg = (text || input).trim()
    if (!msg || isStreaming) return
    setInput('')
    setStreamingContent('')
    setCurrentNodeEvents([])
    setCurrentCitations([])
    setCurrentBookingCard(null)
    setShownFollowUps([])   // clear chips on new send
    const now = Date.now()
    setMessages(prev => {
      const recentDup = prev.some(m => m.role === 'user' && m.content === msg && now - (m._ts || 0) < 2000)
      if (recentDup) return prev
      return [...prev, { role: 'user', content: msg, _ts: now }]
    })
    const tid = threadId || `t-${Date.now()}`
    await sendMessage(msg, tid)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSlotSelect = async (slotId) => {
    const msg = slotId === '__reschedule__' ? 'I want to reschedule' : `I select slot ${slotId}`
    setInput('')
    setCurrentNodeEvents([])
    setCurrentCitations([])
    setCurrentBookingCard(null)
    setShownFollowUps([])
    setMessages(prev => [...prev, { role: 'user', content: msg, _ts: Date.now() }])
    await sendMessage(msg, threadId)
  }

  const handleConfirmBooking = async () => {
    setInput('')
    setCurrentNodeEvents([])
    setCurrentCitations([])
    setCurrentBookingCard(null)
    setShownFollowUps([])
    setMessages(prev => [...prev, { role: 'user', content: 'Yes, confirm', _ts: Date.now() }])
    await sendMessage('Yes, confirm', threadId)
  }

  const handleCancelBooking = async () => {
    setCurrentNodeEvents([])
    setShownFollowUps([])
    setMessages(prev => [...prev, { role: 'user', content: 'cancel', _ts: Date.now() }])
    await sendMessage('cancel', threadId)
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="px-6 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <Bot size={20} className="text-indigo-400" />
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>HR Assistant</span>
        </div>
        {threadId && (
          <span className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>
            {threadId.slice(0, 24)}...
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 && !isStreaming && !loadingHistory && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-full border flex items-center justify-center" style={{ backgroundColor: 'rgba(99,102,241,0.1)', borderColor: 'rgba(99,102,241,0.3)' }}>
              <Bot size={32} className="text-indigo-400" />
            </div>
            <div>
              <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Ask about HR policies or book an appointment</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Try: "How often are performance reviews conducted?" or "Book a meeting"</p>
            </div>
          </div>
        )}

        {loadingHistory && (
          <div className="flex items-center justify-center py-8 text-sm gap-2" style={{ color: 'var(--text-secondary)' }}>
            <span className="w-2 h-2 rounded-full typing-dot" style={{ backgroundColor: 'var(--text-secondary)' }} />
            <span>Loading conversation...</span>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            message={msg}
            onSlotSelect={handleSlotSelect}
            onCancel={handleCancelBooking}
            onConfirm={handleConfirmBooking}
          />
        ))}

        {/* Follow-up chips after last assistant message (only when not streaming) */}
        {!isStreaming && shownFollowUps.length > 0 && (
          <FollowUpChips questions={shownFollowUps} onSend={handleSend} />
        )}

        {currentNodeEvents.length > 0 && (
          <AgentTimeline nodeEvents={currentNodeEvents} isStreaming={isStreaming} />
        )}

        {/* Streaming text */}
        {isStreaming && streamingContent && (
          <div className="flex gap-3 mb-4">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: 'var(--bg-card)' }}>
              <Bot size={16} className="text-indigo-400" />
            </div>
            <div className="max-w-[75%]">
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed whitespace-pre-wrap" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                {streamingContent}
                <span className="inline-block w-1.5 h-4 bg-indigo-400 ml-0.5 animate-pulse rounded-sm" />
              </div>
            </div>
          </div>
        )}

        {isStreaming && !streamingContent && (
          <div className="flex gap-3 mb-4">
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--bg-card)' }}>
              <Bot size={16} className="text-indigo-400" />
            </div>
            <TypingIndicator />
          </div>
        )}

        {error && (
          <div className="text-center text-sm text-red-400 border border-red-800 rounded-lg px-4 py-2 mb-4" style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}>
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder="Ask about policies or book an appointment..."
            rows={1}
            className="flex-1 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none disabled:opacity-50 transition-colors border"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
              minHeight: '44px',
              maxHeight: '120px',
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isStreaming}
            className="flex items-center justify-center w-11 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:cursor-not-allowed text-white transition-colors shrink-0"
            style={(!input.trim() || isStreaming) ? { backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' } : undefined}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
