import { useState } from 'react'
import { Calendar, CheckCircle2, X, RotateCcw, Clock } from 'lucide-react'

export default function BookingCard({ bookingData, onSlotSelect, onCancel, onConfirm }) {
  const [selectedSlot, setSelectedSlot] = useState(bookingData?.selected_slot || null)
  const [submitting, setSubmitting] = useState(false)

  if (!bookingData) return null

  const { slots = [], status, name, email, slot_label, ref_id } = bookingData

  const handleSelectAndConfirm = async () => {
    if (!selectedSlot) return
    setSubmitting(true)
    await onSlotSelect(selectedSlot)
    setSubmitting(false)
  }

  const handleFinalConfirm = async () => {
    setSubmitting(true)
    if (onConfirm) await onConfirm()
    setSubmitting(false)
  }

  if (status === 'confirmed') {
    return (
      <div className="rounded-xl p-4 mt-2 border" style={{ backgroundColor: 'rgba(52,211,153,0.08)', borderColor: 'rgba(52,211,153,0.4)' }}>
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 size={20} className="text-emerald-400" />
          <span className="font-semibold text-emerald-300">Booking Confirmed!</span>
        </div>
        <p className="text-sm mb-1" style={{ color: 'var(--text-primary)' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Reference:</span>{' '}
          <code className="text-emerald-400 font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(52,211,153,0.1)' }}>
            {ref_id}
          </code>
        </p>
        {slot_label && (
          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Slot:</span> {slot_label}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl p-4 mt-2 border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-indigo-400" />
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Schedule Appointment</span>
        </div>
        {status === 'pending_confirmation' && (
          <span className="text-xs px-2 py-0.5 rounded-full border" style={{ backgroundColor: 'rgba(251,191,36,0.1)', color: '#fbbf24', borderColor: 'rgba(251,191,36,0.3)' }}>
            Pending Confirmation
          </span>
        )}
      </div>

      {(name || email) && (
        <div className="text-xs mb-3 space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
          {name && <p><span style={{ color: 'var(--text-faint)' }}>Name:</span> {name}</p>}
          {email && <p><span style={{ color: 'var(--text-faint)' }}>Email:</span> {email}</p>}
        </div>
      )}

      {status !== 'pending_confirmation' && slots.length > 0 && (
        <div className="space-y-2 mb-3">
          <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Available Slots:</p>
          <div className="grid gap-2">
            {slots.map(slot => (
              <button
                key={slot.id}
                onClick={() => setSelectedSlot(slot.id)}
                disabled={!slot.available}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all border"
                style={
                  selectedSlot === slot.id
                    ? { backgroundColor: '#4f46e5', borderColor: '#6366f1', color: '#ffffff' }
                    : slot.available
                    ? { backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)', color: 'var(--text-primary)' }
                    : { backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text-faint)', cursor: 'not-allowed' }
                }
              >
                <Clock size={14} />
                {slot.label}
                {!slot.available && <span className="ml-auto text-xs" style={{ color: 'var(--text-faint)' }}>Taken</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {status === 'pending_confirmation' && (
        <div className="text-sm rounded-lg p-3 mb-3" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
          <p className="font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Confirm your booking?</p>
          {slot_label && <p style={{ color: 'var(--text-secondary)' }}><span style={{ color: 'var(--text-faint)' }}>Slot:</span> {slot_label}</p>}
        </div>
      )}

      <div className="flex gap-2">
        {status === 'pending_confirmation' ? (
          <>
            <button
              onClick={handleFinalConfirm}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              style={submitting ? { backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' } : undefined}
            >
              {submitting ? (
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-white rounded-full typing-dot" />
                  <span className="w-1.5 h-1.5 bg-white rounded-full typing-dot" />
                  <span className="w-1.5 h-1.5 bg-white rounded-full typing-dot" />
                </span>
              ) : (
                <><CheckCircle2 size={15} />Yes, Confirm Booking</>
              )}
            </button>
            <button
              onClick={() => onSlotSelect('__reschedule__')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
            >
              <RotateCcw size={14} />
              Reschedule
            </button>
          </>
        ) : (
          <button
            onClick={handleSelectAndConfirm}
            disabled={!selectedSlot || submitting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            style={(!selectedSlot || submitting) ? { backgroundColor: 'var(--bg-input)', color: 'var(--text-secondary)' } : undefined}
          >
            {submitting ? (
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-white rounded-full typing-dot" />
                <span className="w-1.5 h-1.5 bg-white rounded-full typing-dot" />
                <span className="w-1.5 h-1.5 bg-white rounded-full typing-dot" />
              </span>
            ) : (
              <><CheckCircle2 size={15} />Confirm Booking</>
            )}
          </button>
        )}
        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors border"
          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}
        >
          <X size={14} />
          Cancel
        </button>
      </div>
    </div>
  )
}
