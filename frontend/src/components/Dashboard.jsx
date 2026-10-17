import { useState, useEffect, useCallback } from 'react'

const API = 'http://localhost:8080'

const STATUS_COLORS = {
  confirmed: '#5b4cf5',
  pending: '#f59e0b',
  pending_confirmation: '#f59e0b',
  cancelled: '#ef4444',
  idle: '#9ca3af',
  collecting_info: '#3b82f6',
  slot_selection: '#3b82f6',
}

const STATUS_LABELS = {
  confirmed: 'Confirmed',
  pending: 'Pending',
  pending_confirmation: 'Pending',
  cancelled: 'Cancelled',
  idle: 'Idle',
  collecting_info: 'In Progress',
  slot_selection: 'In Progress',
}

// ── SVG Donut Chart ───────────────────────────────────────────────────────────

function DonutChart({ data }) {
  const size = 160
  const cx = size / 2
  const cy = size / 2
  const r = 58
  const strokeW = 26

  const total = data.reduce((s, d) => s + d.count, 0)

  if (total === 0) {
    return (
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={strokeW} />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="13" fill="var(--text-faint)">
          No data
        </text>
      </svg>
    )
  }

  const circumference = 2 * Math.PI * r
  let offset = 0
  const slices = data.map((d) => {
    const ratio = d.count / total
    const dash = ratio * circumference
    const slice = { ...d, dash, gap: circumference - dash, offset }
    offset += dash
    return slice
  })

  return (
    <svg width={size} height={size}>
      {slices.map((s, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={s.color}
          strokeWidth={strokeW}
          strokeDasharray={`${s.dash} ${s.gap}`}
          strokeDashoffset={-s.offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          opacity={0.9}
        />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--text-primary)">
        {total}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize="11" fill="var(--text-faint)">
        total
      </text>
    </svg>
  )
}

// ── SVG Horizontal Bar Chart ──────────────────────────────────────────────────

function BarChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ color: 'var(--text-faint)', fontSize: '13px', padding: '24px 0', textAlign: 'center' }}>
        No booking hours data yet
      </div>
    )
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1)
  const barH = 22
  const gap = 10
  const labelW = 52
  const countW = 28
  const barMaxW = 200
  const svgW = labelW + barMaxW + countW + 16
  const svgH = data.length * (barH + gap) + 10

  const formatHour = (h) => {
    const ampm = h >= 12 ? 'PM' : 'AM'
    const disp = h === 0 ? 12 : h > 12 ? h - 12 : h
    return `${disp}:00 ${ampm}`
  }

  return (
    <svg width={svgW} height={svgH} style={{ overflow: 'visible' }}>
      {data.map((d, i) => {
        const barW = (d.count / maxCount) * barMaxW
        const y = i * (barH + gap) + 5
        return (
          <g key={i}>
            <text
              x={labelW - 6}
              y={y + barH / 2 + 4}
              textAnchor="end"
              fontSize="11"
              fill="var(--text-secondary)"
            >
              {formatHour(d.hour)}
            </text>
            <rect x={labelW} y={y} width={Math.max(barW, 2)} height={barH} rx={4} fill="var(--accent)" opacity={0.8} />
            <text
              x={labelW + Math.max(barW, 2) + 6}
              y={y + barH / 2 + 4}
              fontSize="11"
              fill="var(--text-secondary)"
            >
              {d.count}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Stat Tile ─────────────────────────────────────────────────────────────────

function StatTile({ icon, label, value, color }) {
  const tileColor = color || 'var(--accent)'
  return (
    <div
      style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '20px',
        position: 'relative', overflow: 'hidden',
        flex: 1, minWidth: 0,
        transition: 'transform 0.2s, box-shadow 0.2s', cursor: 'default',
      }}
      onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)' }}
      onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
    >
      <div style={{
        position: 'absolute', top: 0, right: 0, width: '80px', height: '80px',
        background: `radial-gradient(circle at top right, ${tileColor}22, transparent 70%)`,
        borderRadius: '0 16px 0 0', pointerEvents: 'none',
      }} />
      <div style={{ fontSize: '24px', marginBottom: '8px' }}>{icon}</div>
      <div style={{ fontSize: '2rem', fontWeight: 800, color: tileColor, lineHeight: 1 }}>{value ?? '—'}</div>
      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px', fontWeight: 500 }}>{label}</div>
    </div>
  )
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status] || '#9ca3af'
  const label = STATUS_LABELS[status] || status
  return (
    <span
      style={{
        background: color + '22',
        color: color,
        border: `1px solid ${color}44`,
        borderRadius: '99px',
        padding: '2px 10px',
        fontSize: '12px',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '48px',
        color: 'var(--text-faint)',
        textAlign: 'center',
      }}
    >
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <rect x="8" y="16" width="64" height="52" rx="8" stroke="var(--border)" strokeWidth="2" />
        <rect x="8" y="16" width="64" height="14" rx="8" fill="var(--accent)" opacity="0.15" />
        <line x1="20" y1="44" x2="40" y2="44" stroke="var(--border)" strokeWidth="2" strokeLinecap="round" />
        <line x1="20" y1="54" x2="56" y2="54" stroke="var(--border)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="60" cy="56" r="12" fill="var(--bg-card)" stroke="var(--border)" strokeWidth="2" />
        <line x1="60" y1="51" x2="60" y2="57" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
        <line x1="57" y1="57" x2="63" y2="57" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>
        No bookings yet
      </div>
      <div style={{ fontSize: '13px', maxWidth: '280px' }}>
        Start a conversation to book your first HR appointment. Stats will appear here.
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [secondsAgo, setSecondsAgo] = useState(0)

  // Reschedule modal state
  const [rescheduleModal, setRescheduleModal] = useState({ open: false })
  const [selectedNewSlot, setSelectedNewSlot] = useState(null)
  const [availableSlots, setAvailableSlots] = useState([])

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/analytics/summary`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
      setLastUpdated(Date.now())
      setSecondsAgo(0)
      setError(null)
    } catch (e) {
      setError('Could not load analytics. Is the backend running?')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch + 30-second polling
  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [fetchStats])

  // "X seconds ago" counter
  useEffect(() => {
    const tick = setInterval(() => {
      if (lastUpdated) setSecondsAgo(Math.floor((Date.now() - lastUpdated) / 1000))
    }, 1000)
    return () => clearInterval(tick)
  }, [lastUpdated])

  // Load available slots when modal opens
  useEffect(() => {
    if (rescheduleModal.open) {
      fetch(`${API}/api/slots`)
        .then((r) => r.json())
        .then((d) => setAvailableSlots(d.slots || []))
        .catch(() => setAvailableSlots([]))
    }
  }, [rescheduleModal.open])

  const handleCancel = async (bookingId) => {
    if (!window.confirm('Cancel this booking?')) return
    const res = await fetch(`${API}/api/bookings/${bookingId}/cancel`, { method: 'POST' })
    if (res.ok) {
      fetchStats()
    } else {
      const err = await res.json().catch(() => ({}))
      window.alert(err.detail || 'Failed to cancel booking')
    }
  }

  const handleReschedule = async (bookingId) => {
    if (!selectedNewSlot) return
    const res = await fetch(`${API}/api/bookings/${bookingId}/reschedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_slot_id: selectedNewSlot }),
    })
    if (res.ok) {
      setRescheduleModal({ open: false })
      setSelectedNewSlot(null)
      fetchStats()
    } else {
      const err = await res.json().catch(() => ({}))
      window.alert(err.detail || 'Failed to reschedule booking')
    }
  }

  // Build stat values
  const confirmed = data?.by_status?.find((s) => s.status === 'confirmed')?.count ?? 0
  const cancelled = data?.by_status?.find((s) => s.status === 'cancelled')?.count ?? 0

  // Build donut slices
  const donutData = (data?.by_status ?? []).map((s) => ({
    ...s,
    color: STATUS_COLORS[s.status] || '#9ca3af',
    label: STATUS_LABELS[s.status] || s.status,
  }))

  const cardStyle = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '20px 24px',
  }

  const btnBase = {
    padding: '4px 10px',
    borderRadius: '6px',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
  }

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: '24px',
        background: 'var(--bg-primary)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            HR Analytics Dashboard
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-faint)', margin: '2px 0 0' }}>
            Live booking stats from the database
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {lastUpdated && (
            <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>
              Last updated: {secondsAgo}s ago
            </span>
          )}
          <button
            onClick={fetchStats}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: '#ef444422',
            border: '1px solid #ef4444',
            color: '#ef4444',
            fontSize: '13px',
            marginBottom: '20px',
          }}
        >
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ color: 'var(--text-faint)', textAlign: 'center', padding: '40px' }}>
          Loading analytics…
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && data?.total_bookings === 0 && <EmptyState />}

      {/* Content */}
      {!loading && !error && data !== null && (
        <>
          {/* Stat tiles */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <StatTile icon="📅" label="Total Bookings" value={data.total_bookings} />
            <StatTile icon="✅" label="Confirmed" value={confirmed} color="#5b4cf5" />
            <StatTile icon="🕐" label="Available Slots" value={data.available_slots} color="#3b82f6" />
            <StatTile icon="❌" label="Cancelled" value={cancelled} color="#ef4444" />
          </div>

          {/* Charts row */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {/* Donut chart */}
            <div style={{ ...cardStyle, flex: '0 0 auto', minWidth: '240px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px' }}>
                Bookings by Status
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <DonutChart data={donutData} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {donutData.map((d) => (
                    <div key={d.status} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }}
                      />
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {d.label}: <strong style={{ color: 'var(--text-primary)' }}>{d.count}</strong>
                      </span>
                    </div>
                  ))}
                  {donutData.length === 0 && (
                    <span style={{ fontSize: '12px', color: 'var(--text-faint)' }}>No data</span>
                  )}
                </div>
              </div>
            </div>

            {/* Bar chart */}
            <div style={{ ...cardStyle, flex: 1, minWidth: '260px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px' }}>
                Peak Booking Hours
              </h3>
              <BarChart data={data.by_hour} />
            </div>
          </div>

          {/* Recent bookings table */}
          {data.recent_bookings?.length > 0 && (
            <div style={cardStyle}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px' }}>
                Recent Bookings
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      {['Name', 'Email', 'Slot', 'Status', 'Time', 'Actions'].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: '8px 12px',
                            textAlign: 'left',
                            color: 'var(--text-faint)',
                            fontWeight: 600,
                            borderBottom: '1px solid var(--border)',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent_bookings.map((b, i) => (
                      <tr
                        key={i}
                        style={{ borderBottom: i < data.recent_bookings.length - 1 ? '1px solid var(--border)' : 'none' }}
                      >
                        <td style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>
                          {b.name || '—'}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                          {b.email || '—'}
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                          {b.slot_label || '—'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <StatusBadge status={b.status} />
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>
                          {b.created_at ? new Date(b.created_at).toLocaleString() : '—'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {b.status !== 'cancelled' ? (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={() => handleCancel(b.id)}
                                style={{ ...btnBase, border: '1px solid #ef4444', color: '#ef4444' }}
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() =>
                                  setRescheduleModal({ open: true, bookingId: b.id, bookingRef: b.ref_id })
                                }
                                style={{ ...btnBase, border: '1px solid var(--accent)', color: 'var(--accent)' }}
                              >
                                Reschedule
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-faint)', fontSize: '12px' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Reschedule modal */}
      {rescheduleModal.open && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              padding: '24px',
              width: '420px',
              maxWidth: '90vw',
            }}
          >
            <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontSize: '16px', fontWeight: 700 }}>
              Reschedule Booking
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
              Ref: <strong>{rescheduleModal.bookingRef}</strong> — Select a new slot:
            </p>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '240px',
                overflowY: 'auto',
              }}
            >
              {availableSlots.length === 0 && (
                <p style={{ color: 'var(--text-faint)', fontSize: '13px', textAlign: 'center', padding: '16px' }}>
                  No available slots
                </p>
              )}
              {availableSlots.map((slot) => (
                <button
                  key={slot.id}
                  onClick={() => setSelectedNewSlot(slot.id)}
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: `2px solid ${selectedNewSlot === slot.id ? 'var(--accent)' : 'var(--border)'}`,
                    background: selectedNewSlot === slot.id ? 'var(--accent-soft)' : 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '14px',
                    transition: 'border-color 0.15s',
                  }}
                >
                  {slot.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setRescheduleModal({ open: false })
                  setSelectedNewSlot(null)
                }}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleReschedule(rescheduleModal.bookingId)}
                disabled={!selectedNewSlot}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--accent)',
                  color: '#fff',
                  cursor: selectedNewSlot ? 'pointer' : 'not-allowed',
                  opacity: selectedNewSlot ? 1 : 0.5,
                  fontWeight: 600,
                  fontSize: '14px',
                }}
              >
                Confirm Reschedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
