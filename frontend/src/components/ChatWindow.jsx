import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Bot, User } from 'lucide-react'
import AgentTimeline from './AgentTimeline'
import CitationBadge from './CitationBadge'
import BookingCard from './BookingCard'

const API_BASE = import.meta.env.VITE_API_URL || ''

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2 bg-gray-800 rounded-2xl w-fit">
      <span className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
      <span className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
      <span className="w-2 h-2 bg-gray-400 rounded-full typing-dot" />
    </div>
  )
}

function MessageBubble({ message, onSlotSelect, onCancel, onConfirm }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex gap-3 mb-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
        isUser ? 'bg-indigo-600' : 'bg-gray-700'
      }`}>
        {isUser ? <User size={16} /> : <Bot size={16} className="text-indigo-400" />}
      </div>
      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-indigo-600 text-white rounded-tr-sm'
            : 'bg-gray-800 text-gray-100 rounded-tl-sm'
        }`}>
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
    bookingCard, bookingConfirmed, error, doneData, reset
  } = ssState

  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [streamingContent, setStreamingContent] = useState('')
  const [currentNodeEvents, setCurrentNodeEvents] = useState([])
  const [currentCitations, setCurrentCitations] = useState([])
  const [currentBookingCard, setCurrentBookingCard] = useState(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const prevThreadRef = useRef(null)

  // Load thread message history when threadId changes
  useEffect(() => {
    if (!threadId || threadId === prevThreadRef.current) return
    prevThreadRef.current = threadId
    setMessages([])
    reset()
    setStreamingContent('')
    setCurrentNodeEvents([])
    setCurrentCitations([])
    setCurrentBookingCard(null)

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

  useEffect(() => {
    if (tokens) setStreamingContent(tokens)
  }, [tokens])

  useEffect(() => {
    if (nodeEvents.length > 0) setCurrentNodeEvents(nodeEvents)
  }, [nodeEvents])

  useEffect(() => {
    if (citations.length > 0) setCurrentCitations(citations)
  }, [citations])

  useEffect(() => {
    if (bookingCard) setCurrentBookingCard(bookingCard)
  }, [bookingCard])

  useEffect(() => {
    if (!doneData) return
    // Build the final booking card: prefer bookingConfirmed (confirmed state) over current card
    const finalCard = bookingConfirmed
      ? { status: 'confirmed', ref_id: bookingConfirmed.ref_id, slot_label: bookingConfirmed.slot_label }
      : currentBookingCard

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

  const handleSend = async () => {
    const text = input.trim()
    if (!text || isStreaming) return
    setInput('')
    setStreamingContent('')
    setCurrentNodeEvents([])
    setCurrentCitations([])
    setCurrentBookingCard(null)
    setMessages(prev => [...prev, { role: 'user', content: text }])
    const tid = threadId || `t-${Date.now()}`
    await sendMessage(text, tid)
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
    setMessages(prev => [...prev, { role: 'user', content: msg }])
    await sendMessage(msg, threadId)
  }

  const handleConfirmBooking = async () => {
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: 'Yes, confirm' }])
    await sendMessage('Yes, confirm', threadId)
  }

  const handleCancelBooking = async () => {
    setMessages(prev => [...prev, { role: 'user', content: 'cancel' }])
    await sendMessage('cancel', threadId)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={20} className="text-indigo-400" />
          <span className="font-semibold text-gray-200">HR Assistant</span>
        </div>
        {threadId && (
          <span className="text-xs text-gray-600 font-mono">
            {threadId.slice(0, 24)}...
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {messages.length === 0 && !isStreaming && !loadingHistory && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-indigo-900/30 border border-indigo-800 flex items-center justify-center">
              <Bot size={32} className="text-indigo-400" />
            </div>
            <div>
              <p className="text-gray-300 font-semibold mb-1">Ask about HR policies or book an appointment</p>
              <p className="text-gray-500 text-sm">Try: "How often are performance reviews conducted?" or "Book a meeting"</p>
            </div>
          </div>
        )}

        {loadingHistory && (
          <div className="flex items-center justify-center py-8 text-gray-500 text-sm gap-2">
            <span className="w-2 h-2 bg-gray-500 rounded-full typing-dot" />
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

        {/* Live agent timeline during streaming */}
        {isStreaming && currentNodeEvents.length > 0 && (
          <AgentTimeline nodeEvents={currentNodeEvents} isStreaming={isStreaming} />
        )}

        {/* Streaming text */}
        {isStreaming && streamingContent && (
          <div className="flex gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center shrink-0 mt-0.5">
              <Bot size={16} className="text-indigo-400" />
            </div>
            <div className="max-w-[75%]">
              <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-gray-800 text-gray-100 text-sm leading-relaxed whitespace-pre-wrap">
                {streamingContent}
                <span className="inline-block w-1.5 h-4 bg-indigo-400 ml-0.5 animate-pulse rounded-sm" />
              </div>
            </div>
          </div>
        )}

        {isStreaming && !streamingContent && (
          <div className="flex gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center shrink-0">
              <Bot size={16} className="text-indigo-400" />
            </div>
            <TypingIndicator />
          </div>
        )}

        {error && (
          <div className="text-center text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-2 mb-4">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-gray-800">
        <div className="flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming}
            placeholder="Ask about policies or book an appointment..."
            rows={1}
            className="flex-1 bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-indigo-600 disabled:opacity-50 transition-colors"
            style={{ minHeight: '44px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            className="flex items-center justify-center w-11 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white transition-colors shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
