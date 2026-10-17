import { useState } from 'react'

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
      <div style={{
        borderRadius: '16px', padding: '16px', marginTop: '8px',
        background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.06))',
        border: '1px solid rgba(16,185,129,0.35)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <span style={{ fontSize: '18px' }}>✅</span>
          <span style={{ fontWeight: 700, color: '#34d399', fontSize: '14px' }}>Booking Confirmed!</span>
        </div>
        <p style={{ fontSize: '13px', marginBottom: '4px', color: 'var(--text-primary)' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Reference: </span>
          <code style={{ color: '#34d399', fontFamily: 'monospace', background: 'rgba(52,211,153,0.1)', padding: '2px 6px', borderRadius: '4px' }}>{ref_id}</code>
        </p>
        {slot_label && (
          <p style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Slot: </span>{slot_label}
          </p>
        )}
      </div>
    )
  }

  const btnBase = { border: 'none', fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600, fontSize: '13px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(91,76,245,0.08), rgba(139,92,246,0.04))',
      border: '1px solid rgba(91,76,245,0.25)',
      borderRadius: '20px', padding: '20px', marginTop: '8px',
      boxShadow: '0 4px 24px rgba(91,76,245,0.1)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '36px', height: '36px',
            background: 'linear-gradient(135deg, #5b4cf5, #8b5cf6)',
            borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px',
          }}>📅</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>Book HR Appointment</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Select an available slot</div>
          </div>
        </div>
        {status === 'pending_confirmation' && (
          <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '99px', background: 'rgba(245,158,11,0.12)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)', fontWeight: 600 }}>
            Pending
          </span>
        )}
      </div>

      {(name || email) && (
        <div style={{ fontSize: '12px', marginBottom: '14px', color: 'var(--text-secondary)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {name && <span><span style={{ color: 'var(--text-muted)' }}>Name: </span>{name}</span>}
          {email && <span><span style={{ color: 'var(--text-muted)' }}>Email: </span>{email}</span>}
        </div>
      )}

      {status !== 'pending_confirmation' && slots.length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Available Slots</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {slots.map(slot => (
              <button key={slot.id} onClick={() => slot.available && setSelectedSlot(slot.id)} disabled={!slot.available} style={{
                ...btnBase,
                padding: '10px 14px', borderRadius: '10px',
                border: `1.5px solid ${selectedSlot === slot.id ? '#5b4cf5' : 'var(--border)'}`,
                background: selectedSlot === slot.id
                  ? 'linear-gradient(135deg, rgba(91,76,245,0.2), rgba(139,92,246,0.1))'
                  : 'var(--bg-secondary)',
                color: !slot.available ? 'var(--text-muted)' : selectedSlot === slot.id ? 'var(--accent-fg)' : 'var(--text-primary)',
                cursor: slot.available ? 'pointer' : 'not-allowed',
                boxShadow: selectedSlot === slot.id ? '0 0 0 3px rgba(91,76,245,0.15)' : 'none',
              }}>
                🕐 {slot.label}
                {!slot.available && <span style={{ marginLeft: 'auto', fontSize: '11px', color: 'var(--text-muted)' }}>Taken</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {status === 'pending_confirmation' && (
        <div style={{ fontSize: '13px', borderRadius: '12px', padding: '12px 14px', marginBottom: '14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <p style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>Confirm your booking?</p>
          {slot_label && <p style={{ color: 'var(--text-secondary)' }}><span style={{ color: 'var(--text-muted)' }}>Slot: </span>{slot_label}</p>}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        {status === 'pending_confirmation' ? (
          <>
            <button onClick={handleFinalConfirm} disabled={submitting} style={{
              ...btnBase, flex: 1, padding: '10px 16px', borderRadius: '10px', justifyContent: 'center',
              background: submitting ? 'var(--bg-hover)' : 'linear-gradient(135deg, #059669, #10b981)',
              color: submitting ? 'var(--text-muted)' : '#fff',
              boxShadow: submitting ? 'none' : '0 2px 10px rgba(16,185,129,0.3)',
            }}>
              {submitting ? '⏳' : '✅'} Yes, Confirm
            </button>
            <button onClick={() => onSlotSelect('__reschedule__')} style={{
              ...btnBase, padding: '10px 14px', borderRadius: '10px',
              background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)',
            }}>🔄 Reschedule</button>
          </>
        ) : (
          <button onClick={handleSelectAndConfirm} disabled={!selectedSlot || submitting} style={{
            ...btnBase, flex: 1, padding: '10px 16px', borderRadius: '10px', justifyContent: 'center',
            background: (!selectedSlot || submitting) ? 'var(--bg-hover)' : 'linear-gradient(135deg, #5b4cf5, #7c5cf6)',
            color: (!selectedSlot || submitting) ? 'var(--text-muted)' : '#fff',
            boxShadow: (!selectedSlot || submitting) ? 'none' : '0 2px 10px rgba(91,76,245,0.3)',
          }}>
            {submitting ? '⏳' : '✅'} Confirm Booking
          </button>
        )}
        <button onClick={onCancel} style={{
          ...btnBase, padding: '10px 14px', borderRadius: '10px',
          background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)',
        }}>✕ Cancel</button>
      </div>
    </div>
  )
}
