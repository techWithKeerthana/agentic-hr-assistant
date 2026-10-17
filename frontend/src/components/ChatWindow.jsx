import { useState, useRef, useEffect } from 'react'
import AgentTimeline from './AgentTimeline'
import CitationBadge from './CitationBadge'
import BookingCard from './BookingCard'
import FollowUpChips from './FollowUpChips'

const API_BASE = import.meta.env.VITE_API_URL || ''

function TypingIndicator() {
  const dot = { width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--text-secondary)', display: 'inline-block' }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '12px 16px', borderRadius: '4px 18px 18px 18px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <span className="typing-dot" style={dot} />
      <span className="typing-dot" style={dot} />
      <span className="typing-dot" style={dot} />
    </div>
  )
}

function MessageBubble({ message, onSlotSelect, onCancel, onConfirm }) {
  const isUser = message.role === 'user'
  return (
    <div className="message-enter" style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      gap: '10px',
      marginBottom: '16px',
      alignItems: 'flex-start',
    }}>
      {!isUser && (
        <div style={{
          width: '32px', height: '32px', flexShrink: 0,
          background: 'linear-gradient(135deg, #1c1c2e, #2a2a3e)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '16px',
        }}>🤖</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: isUser ? '75%' : '85%', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        <div style={isUser
          ? {
              padding: '12px 16px',
              borderRadius: '18px 18px 4px 18px',
              background: 'linear-gradient(135deg, #5b4cf5, #7c5cf6)',
              color: '#fff',
              fontSize: '14px',
              lineHeight: '1.6',
              boxShadow: '0 4px 16px rgba(91,76,245,0.3)',
              whiteSpace: 'pre-wrap',
            }
          : {
              padding: '14px 18px',
              borderRadius: '4px 18px 18px 18px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              lineHeight: '1.7',
              boxShadow: 'var(--shadow-sm)',
              whiteSpace: 'pre-wrap',
            }
        }>
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

export default function ChatWindow({ threadId, onThreadUpdated, ssState, userName }) {
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-primary)' }}>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 20px' }}>

          {messages.length === 0 && !isStreaming && !loadingHistory && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px', textAlign: 'center' }}>
              <div style={{
                width: '64px', height: '64px',
                background: 'linear-gradient(135deg, rgba(91,76,245,0.2), rgba(139,92,246,0.1))',
                border: '1px solid rgba(91,76,245,0.3)',
                borderRadius: '20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '32px',
              }}>🤖</div>
              <div>
                <p style={{ fontWeight: 600, fontSize: '16px', marginBottom: '6px', color: 'var(--text-primary)' }}>
                  {userName ? `Hello ${userName}! 👋` : 'Welcome to HR Assistant'}
                </p>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Ask about HR policies or book an appointment</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>Try: "How often are performance reviews conducted?" or "Book a meeting"</p>
              </div>
            </div>
          )}

          {loadingHistory && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
              <span className="w-2 h-2 rounded-full typing-dot" style={{ backgroundColor: 'var(--text-secondary)', width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block' }} />
              Loading conversation...
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

          {!isStreaming && shownFollowUps.length > 0 && (
            <FollowUpChips questions={shownFollowUps} onSend={handleSend} />
          )}

          {currentNodeEvents.length > 0 && (
            <AgentTimeline nodeEvents={currentNodeEvents} isStreaming={isStreaming} />
          )}

          {/* Streaming bubble */}
          {isStreaming && streamingContent && (
            <div className="message-enter" style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'flex-start' }}>
              <div style={{
                width: '32px', height: '32px', flexShrink: 0,
                background: 'linear-gradient(135deg, #1c1c2e, #2a2a3e)',
                border: '1px solid var(--border)', borderRadius: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
              }}>🤖</div>
              <div style={{
                maxWidth: '85%', padding: '14px 18px',
                borderRadius: '4px 18px 18px 18px',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.7',
                whiteSpace: 'pre-wrap', boxShadow: 'var(--shadow-sm)',
              }}>
                {streamingContent}
                <span style={{ display: 'inline-block', width: '6px', height: '16px', background: 'var(--accent)', marginLeft: '3px', borderRadius: '2px', animation: 'pulse 1s infinite' }} />
              </div>
            </div>
          )}

          {isStreaming && !streamingContent && (
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'flex-start' }}>
              <div style={{
                width: '32px', height: '32px', flexShrink: 0,
                background: 'linear-gradient(135deg, #1c1c2e, #2a2a3e)',
                border: '1px solid var(--border)', borderRadius: '10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
              }}>🤖</div>
              <TypingIndicator />
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', fontSize: '13px', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px', padding: '10px 16px', marginBottom: '16px', backgroundColor: 'rgba(239,68,68,0.08)' }}>
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', background: 'var(--bg-secondary)' }}>
        <div
          style={{
            maxWidth: '720px', margin: '0 auto',
            display: 'flex', gap: '10px', alignItems: 'flex-end',
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: '16px', padding: '10px 12px',
            boxShadow: 'var(--shadow-sm)', transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
          onFocusCapture={e => {
            e.currentTarget.style.borderColor = 'var(--accent)'
            e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-soft)'
          }}
          onBlurCapture={e => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder="Ask about HR policies or book an appointment..."
            rows={1}
            style={{
              flex: 1, border: 'none', background: 'transparent',
              color: 'var(--text-primary)', fontSize: '14px',
              resize: 'none', outline: 'none', lineHeight: '1.5',
              maxHeight: '120px', overflowY: 'auto', fontFamily: 'inherit',
              opacity: isStreaming ? 0.5 : 1,
            }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isStreaming}
            style={{
              width: '36px', height: '36px', borderRadius: '10px', border: 'none',
              background: (!input.trim() || isStreaming)
                ? 'var(--bg-hover)'
                : 'linear-gradient(135deg, #5b4cf5, #7c5cf6)',
              color: (!input.trim() || isStreaming) ? 'var(--text-muted)' : '#fff',
              fontSize: '18px', cursor: (!input.trim() || isStreaming) ? 'not-allowed' : 'pointer',
              flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: (!input.trim() || isStreaming) ? 'none' : '0 2px 8px rgba(91,76,245,0.3)',
              transition: 'transform 0.1s, box-shadow 0.1s',
              fontFamily: 'inherit',
            }}
            onMouseOver={e => { if (!(!input.trim() || isStreaming)) e.currentTarget.style.transform = 'scale(1.05)' }}
            onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)' }}
          >↑</button>
        </div>
      </div>
    </div>
  )
}
