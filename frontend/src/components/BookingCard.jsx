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
      <div className="bg-emerald-900/20 border border-emerald-700 rounded-xl p-4 mt-2">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 size={20} className="text-emerald-400" />
          <span className="font-semibold text-emerald-300">Booking Confirmed!</span>
        </div>
        <p className="text-sm text-gray-300 mb-1">
          <span className="text-gray-500">Reference:</span>{' '}
          <code className="text-emerald-400 font-mono bg-emerald-900/30 px-1.5 py-0.5 rounded">
            {ref_id}
          </code>
        </p>
        {slot_label && (
          <p className="text-sm text-gray-300">
            <span className="text-gray-500">Slot:</span> {slot_label}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 mt-2">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar size={18} className="text-indigo-400" />
          <span className="font-semibold text-gray-200 text-sm">Schedule Appointment</span>
        </div>
        {status === 'pending_confirmation' && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400 border border-amber-800">
            Pending Confirmation
          </span>
        )}
      </div>

      {(name || email) && (
        <div className="text-xs text-gray-400 mb-3 space-y-0.5">
          {name && <p><span className="text-gray-500">Name:</span> {name}</p>}
          {email && <p><span className="text-gray-500">Email:</span> {email}</p>}
        </div>
      )}

      {status !== 'pending_confirmation' && slots.length > 0 && (
        <div className="space-y-2 mb-3">
          <p className="text-xs text-gray-400 font-medium">Available Slots:</p>
          <div className="grid gap-2">
            {slots.map(slot => (
              <button
                key={slot.id}
                onClick={() => setSelectedSlot(slot.id)}
                disabled={!slot.available}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all border ${
                  selectedSlot === slot.id
                    ? 'bg-indigo-700 border-indigo-500 text-white'
                    : slot.available
                    ? 'bg-gray-700/50 border-gray-600 text-gray-300 hover:bg-gray-700 hover:border-gray-500'
                    : 'bg-gray-800 border-gray-700 text-gray-600 cursor-not-allowed'
                }`}
              >
                <Clock size={14} />
                {slot.label}
                {!slot.available && <span className="ml-auto text-xs text-gray-600">Taken</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {status === 'pending_confirmation' && (
        <div className="text-sm text-gray-300 bg-gray-900/50 rounded-lg p-3 mb-3">
          <p className="font-medium text-gray-200 mb-1">Confirm your booking?</p>
          {slot_label && <p className="text-gray-400"><span className="text-gray-500">Slot:</span> {slot_label}</p>}
        </div>
      )}

      <div className="flex gap-2">
        {status === 'pending_confirmation' ? (
          <>
            <button
              onClick={handleFinalConfirm}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {submitting ? (
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-white rounded-full typing-dot" />
                  <span className="w-1.5 h-1.5 bg-white rounded-full typing-dot" />
                  <span className="w-1.5 h-1.5 bg-white rounded-full typing-dot" />
                </span>
              ) : (
                <>
                  <CheckCircle2 size={15} />
                  Yes, Confirm Booking
                </>
              )}
            </button>
            <button
              onClick={() => onSlotSelect('__reschedule__')}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm transition-colors"
            >
              <RotateCcw size={14} />
              Reschedule
            </button>
          </>
        ) : (
          <button
            onClick={handleSelectAndConfirm}
            disabled={!selectedSlot || submitting}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {submitting ? (
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-white rounded-full typing-dot" />
                <span className="w-1.5 h-1.5 bg-white rounded-full typing-dot" />
                <span className="w-1.5 h-1.5 bg-white rounded-full typing-dot" />
              </span>
            ) : (
              <>
                <CheckCircle2 size={15} />
                Confirm Booking
              </>
            )}
          </button>
        )}
        <button
          onClick={onCancel}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-300 text-sm transition-colors border border-gray-700"
        >
          <X size={14} />
          Cancel
        </button>
      </div>
    </div>
  )
}
