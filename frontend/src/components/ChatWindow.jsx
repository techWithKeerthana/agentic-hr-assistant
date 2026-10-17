import { useState, useRef, useEffect } from 'react'
import AgentTimeline from './AgentTimeline'
import CitationBadge from './CitationBadge'
import BookingCard from './BookingCard'
import FollowUpChips from './FollowUpChips'

const API_BASE = import.meta.env.VITE_API_URL || ''

function getGreeting(name) {
  const hour = new Date().getHours()
  const first = name?.split(' ')[0] || 'there'
  if (hour >= 5  && hour < 12) return `Good morning, ${first}! ☀️`
  if (hour >= 12 && hour < 17) return `Good afternoon, ${first}! 👋`
  if (hour >= 17 && hour < 21) return `Good evening, ${first}! 🌆`
  return `Good night, ${first}! 🌙`
}

const SUGGESTION_CHIPS = [
  '📋 What are the working hours?',
  '🏖️ How many vacation days do I get?',
  '🏠 What is the remote work policy?',
  '📅 Book an HR appointment',
]

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function cleanTextForSpeech(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/\[.*?\]\(.*?\)/g, '')
    .replace(/`.*?`/g, '')
    .replace(/\[\d+\]/g, '')
    .trim()
}

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

function MessageBubble({ message, onSlotSelect, onCancel, onConfirm, showToast }) {
  const isUser = message.role === 'user'
  const [hovered, setHovered] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [copied, setCopied] = useState(false)

  const speakMessage = () => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    if (speaking) { setSpeaking(false); return }
    const utterance = new SpeechSynthesisUtterance(cleanTextForSpeech(message.content))
    utterance.lang = 'en-US'
    utterance.rate = 1.0
    utterance.pitch = 1.0
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(v =>
      v.name.includes('Google') || v.name.includes('Samantha') ||
      v.name.includes('Karen') || (v.lang === 'en-US' && v.localService)
    )
    if (preferred) utterance.voice = preferred
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }

  const copyMessage = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true)
      if (showToast) showToast('Message copied!', 'success')
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="message-enter" style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      gap: '10px',
      marginBottom: hovered && !isUser ? '32px' : '16px',
      alignItems: 'flex-start',
      transition: 'margin-bottom 0.15s',
    }}>
      {!isUser && (
        <div style={{
          width: '32px', height: '32px', flexShrink: 0,
          background: 'linear-gradient(135deg, #5b4cf5, #a855f7)',
          borderRadius: '10px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: '15px', color: '#fff', letterSpacing: '-1px',
          boxShadow: '0 0 10px rgba(91,76,245,0.35)',
        }}>N</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: isUser ? '75%' : '85%', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
        {/* Bubble with hover wrapper for assistant messages */}
        <div
          style={{ position: 'relative' }}
          onMouseEnter={() => !isUser && setHovered(true)}
          onMouseLeave={() => !isUser && setHovered(false)}
        >
          <div style={isUser
            ? {
                padding: '12px 16px',
                borderRadius: '18px 18px 4px 18px',
                background: 'linear-gradient(135deg, #5b4cf5, #7c5cf6)',
                color: '#fff', fontSize: '14px', lineHeight: '1.6',
                boxShadow: '0 4px 16px rgba(91,76,245,0.3)', whiteSpace: 'pre-wrap',
              }
            : {
                padding: '14px 18px',
                borderRadius: '4px 18px 18px 18px',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.7',
                boxShadow: 'var(--shadow-sm)', whiteSpace: 'pre-wrap',
              }
          }>
            {message.content}
          </div>

          {/* Timestamp — hover reveal on both sides */}
          {message.timestamp && (
            <div style={{
              position: 'absolute', bottom: '-20px',
              [isUser ? 'right' : 'left']: '4px',
              fontSize: '11px', color: 'var(--text-muted)',
              opacity: hovered ? 1 : 0, transition: 'opacity 0.2s',
              pointerEvents: 'none', whiteSpace: 'nowrap',
            }}>
              {formatTime(message.timestamp)}
            </div>
          )}

          {/* Action bar — hover reveal on assistant messages */}
          {!isUser && hovered && (
            <div style={{
              position: 'absolute', bottom: '-28px', left: '4px',
              display: 'flex', gap: '4px',
              animation: 'fadeIn 0.15s ease',
            }}>
              <button
                onClick={speakMessage}
                title={speaking ? 'Stop' : 'Read aloud'}
                style={{
                  padding: '3px 8px', borderRadius: '6px',
                  border: '1px solid var(--border)', background: 'var(--bg-card)',
                  color: speaking ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: '11px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '4px',
                  transition: 'all 0.15s', fontFamily: 'inherit', fontWeight: 500,
                }}
                onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                onMouseOut={e => { if (!speaking) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' } }}
              >
                {speaking ? '⏹ Stop' : '🔊 Read aloud'}
              </button>
              <button
                onClick={copyMessage}
                title="Copy"
                style={{
                  padding: '3px 8px', borderRadius: '6px',
                  border: '1px solid var(--border)', background: 'var(--bg-card)',
                  color: copied ? 'var(--success)' : 'var(--text-muted)',
                  fontSize: '11px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
                  transition: 'all 0.15s',
                }}
              >
                {copied ? '✓ Copied' : '📋 Copy'}
              </button>
            </div>
          )}
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

export default function ChatWindow({ threadId, onThreadUpdated, ssState, userName, showToast }) {
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
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const prevThreadRef = useRef(null)
  const bookingCardRef = useRef(null)
  const recognitionRef = useRef(null)
  const transcriptRef = useRef('')

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
          timestamp: Date.now(),
        },
      ])
      if (bookingConfirmed && showToast) showToast('Booking confirmed!', 'success')
    }
    setStreamingContent('')
    setCurrentCitations([])
    setCurrentBookingCard(null)
    setCurrentNodeEvents([])
    if (onThreadUpdated) onThreadUpdated()
  }, [doneData])

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { alert('Voice input is not supported in this browser. Try Chrome.'); return }
    const recognition = new SR()
    recognition.lang = 'en-US'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.onstart = () => { setIsListening(true); setTranscript(''); transcriptRef.current = '' }
    recognition.onresult = (event) => {
      let interim = '', final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) final += t
        else interim += t
      }
      const current = final || interim
      setTranscript(current)
      transcriptRef.current = current
      if (final) setInput(final)
    }
    recognition.onend = () => {
      setIsListening(false)
      const said = transcriptRef.current
      if (said) { handleSend(said); setTranscript(''); transcriptRef.current = '' }
    }
    recognition.onerror = (e) => { console.error('Speech error:', e.error); setIsListening(false) }
    recognitionRef.current = recognition
    recognition.start()
  }

  const stopListening = () => { recognitionRef.current?.stop(); setIsListening(false) }

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
      return [...prev, { role: 'user', content: msg, _ts: now, timestamp: now }]
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
    setMessages(prev => [...prev, { role: 'user', content: msg, _ts: Date.now(), timestamp: Date.now() }])
    await sendMessage(msg, threadId)
  }

  const handleConfirmBooking = async () => {
    setInput('')
    setCurrentNodeEvents([])
    setCurrentCitations([])
    setCurrentBookingCard(null)
    setShownFollowUps([])
    setMessages(prev => [...prev, { role: 'user', content: 'Yes, confirm', _ts: Date.now(), timestamp: Date.now() }])
    await sendMessage('Yes, confirm', threadId)
  }

  const handleCancelBooking = async () => {
    setCurrentNodeEvents([])
    setShownFollowUps([])
    setMessages(prev => [...prev, { role: 'user', content: 'cancel', _ts: Date.now(), timestamp: Date.now() }])
    await sendMessage('cancel', threadId)
  }

  const hasMessages = messages.length > 0 || isStreaming || loadingHistory

  const botAvatar = (
    <div style={{
      width: '32px', height: '32px', flexShrink: 0,
      background: 'linear-gradient(135deg, #5b4cf5, #a855f7)',
      borderRadius: '10px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: '15px', color: '#fff', letterSpacing: '-1px',
      boxShadow: '0 0 10px rgba(91,76,245,0.35)',
    }}>N</div>
  )

  const inputBar = (centered = false) => (
    <div style={{ position: 'relative' }}>
      {/* Live transcript preview */}
      {isListening && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, right: 0,
          padding: '10px 16px', marginBottom: '8px',
          background: 'var(--bg-card)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: '12px', fontSize: '14px', color: 'var(--text-primary)',
          display: 'flex', alignItems: 'center', gap: '10px',
          animation: 'fadeIn 0.15s ease',
        }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: '#ef4444', flexShrink: 0,
            animation: 'micPulse 1s ease-in-out infinite',
          }} />
          <span style={{ fontStyle: transcript ? 'normal' : 'italic', color: transcript ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {transcript || 'Listening… speak now'}
          </span>
        </div>
      )}

      <div
        style={{
          display: 'flex', gap: '8px', alignItems: 'flex-end',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: centered ? '20px' : '16px',
          padding: centered ? '14px 16px' : '10px 12px',
          boxShadow: centered ? '0 4px 24px rgba(0,0,0,0.2)' : 'var(--shadow-sm)',
          transition: 'border-color 0.2s, box-shadow 0.2s',
        }}
        onFocusCapture={e => {
          e.currentTarget.style.borderColor = 'var(--accent)'
          e.currentTarget.style.boxShadow = centered ? '0 0 0 3px var(--accent-soft), 0 4px 24px rgba(0,0,0,0.2)' : '0 0 0 3px var(--accent-soft)'
        }}
        onBlurCapture={e => {
          e.currentTarget.style.borderColor = 'var(--border)'
          e.currentTarget.style.boxShadow = centered ? '0 4px 24px rgba(0,0,0,0.2)' : 'var(--shadow-sm)'
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          placeholder="Ask about NexaHR policies or book an appointment..."
          rows={1}
          style={{
            flex: 1, border: 'none', background: 'transparent',
            color: 'var(--text-primary)', fontSize: '14px',
            resize: 'none', outline: 'none', lineHeight: '1.5',
            maxHeight: '120px', overflowY: 'auto', fontFamily: 'inherit',
            opacity: isStreaming ? 0.5 : 1,
          }}
        />

        {/* Mic button */}
        <button
          onClick={isListening ? stopListening : startListening}
          title={isListening ? 'Stop recording' : 'Speak your question'}
          style={{
            width: '36px', height: '36px', borderRadius: '10px', border: 'none',
            background: isListening ? 'rgba(239,68,68,0.15)' : 'var(--bg-hover)',
            color: isListening ? '#ef4444' : 'var(--text-secondary)',
            cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '16px', transition: 'all 0.2s',
            boxShadow: isListening ? '0 0 0 3px rgba(239,68,68,0.25)' : 'none',
            animation: isListening ? 'micPulse 1.5s ease-in-out infinite' : 'none',
            fontFamily: 'inherit',
          }}
        >{isListening ? '⏹' : '🎤'}</button>

        {/* Send button */}
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || isStreaming}
          style={{
            width: '36px', height: '36px', borderRadius: '10px', border: 'none',
            background: (!input.trim() || isStreaming) ? 'var(--bg-hover)' : 'linear-gradient(135deg, #5b4cf5, #7c5cf6)',
            color: (!input.trim() || isStreaming) ? 'var(--text-muted)' : '#fff',
            fontSize: '18px', cursor: (!input.trim() || isStreaming) ? 'not-allowed' : 'pointer',
            flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: (!input.trim() || isStreaming) ? 'none' : '0 2px 8px rgba(91,76,245,0.3)',
            transition: 'transform 0.1s, box-shadow 0.1s', fontFamily: 'inherit',
          }}
          onMouseOver={e => { if (input.trim() && !isStreaming) e.currentTarget.style.transform = 'scale(1.05)' }}
          onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)' }}
        >↑</button>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-primary)' }}>

      {!hasMessages ? (
        /* ── Centered empty state ── */
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
          <div style={{
            width: '72px', height: '72px',
            background: 'linear-gradient(135deg, #5b4cf5, #a855f7)',
            borderRadius: '24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '34px', color: '#fff', letterSpacing: '-2px',
            marginBottom: '24px',
            boxShadow: '0 8px 32px rgba(91,76,245,0.35)',
          }}>N</div>

          <h2 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px', textAlign: 'center', letterSpacing: '-0.5px' }}>
            {getGreeting(userName)}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', margin: '0 0 32px', textAlign: 'center' }}>
            Your AI-powered HR assistant — ask anything or book an appointment
          </p>

          {/* Suggestion chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginBottom: '32px', maxWidth: '580px' }}>
            {SUGGESTION_CHIPS.map(chip => (
              <button
                key={chip}
                onClick={() => handleSend(chip.replace(/^\S+\s/, ''))}
                style={{
                  padding: '10px 16px', borderRadius: '99px',
                  border: '1px solid var(--border)', background: 'var(--bg-card)',
                  color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer',
                  transition: 'all 0.2s', fontWeight: 500, fontFamily: 'inherit',
                }}
                onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'var(--accent-soft)' }}
                onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-card)' }}
              >{chip}</button>
            ))}
            {/* Non-clickable voice prompt */}
            <div style={{
              padding: '10px 16px', borderRadius: '99px',
              border: '1.5px dashed rgba(91,76,245,0.4)',
              color: 'var(--accent)', fontSize: '13px', fontWeight: 500, opacity: 0.75,
              userSelect: 'none',
            }}>
              🎤 Or just click the mic button below!
            </div>
          </div>

          {/* Centered input */}
          <div style={{ width: '100%', maxWidth: '600px' }}>
            {inputBar(true)}
          </div>
        </div>
      ) : (
        /* ── Normal chat layout ── */
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
            <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 20px' }}>

              {loadingHistory && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  <span className="typing-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--text-secondary)', display: 'inline-block' }} />
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
                  showToast={showToast}
                />
              ))}

              {!isStreaming && shownFollowUps.length > 0 && (
                <FollowUpChips questions={shownFollowUps} onSend={handleSend} />
              )}

              {currentNodeEvents.length > 0 && (
                <AgentTimeline nodeEvents={currentNodeEvents} isStreaming={isStreaming} />
              )}

              {isStreaming && streamingContent && (
                <div className="message-enter" style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'flex-start' }}>
                  {botAvatar}
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
                  {botAvatar}
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

          <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', background: 'var(--bg-secondary)' }}>
            <div style={{ maxWidth: '720px', margin: '0 auto' }}>
              {inputBar(false)}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
