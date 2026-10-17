import { useState } from 'react'
import { FileText, ChevronDown, ChevronUp, AlertCircle, CheckCircle } from 'lucide-react'

export default function CitationBadge({ citations = [], confidence, abstained }) {
  const [expanded, setExpanded] = useState(false)
  const [openIdx, setOpenIdx] = useState(null)

  if (!citations.length && !abstained) return null

  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        {abstained ? (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border"
            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }}
          >
            <AlertCircle size={12} />
            Insufficient information
          </span>
        ) : (
          <button
            onClick={() => setExpanded(e => !e)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors"
            style={{ backgroundColor: 'rgba(52,211,153,0.1)', color: '#4ade80', borderColor: 'rgba(52,211,153,0.3)' }}
          >
            <CheckCircle size={12} />
            Evidence available
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>
        )}

        {citations.map((c, i) => (
          <button
            key={i}
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors"
            style={{ backgroundColor: 'rgba(96,165,250,0.1)', color: '#60a5fa', borderColor: 'rgba(96,165,250,0.3)' }}
          >
            <FileText size={12} />
            {c.doc} · Page {c.page}
          </button>
        ))}
      </div>

      {expanded && citations.map((c, i) => (
        <div
          key={i}
          className={`text-xs rounded-lg p-3 border ${openIdx !== null && openIdx !== i ? 'hidden' : ''}`}
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        >
          <p className="mb-1 font-medium" style={{ color: 'var(--text-secondary)' }}>{c.doc}, Page {c.page}</p>
          <p className="leading-relaxed">{c.snippet}</p>
        </div>
      ))}

      {openIdx !== null && !expanded && citations[openIdx] && (
        <div
          className="text-xs rounded-lg p-3 border"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}
        >
          <p className="mb-1 font-medium" style={{ color: 'var(--text-secondary)' }}>{citations[openIdx].doc}, Page {citations[openIdx].page}</p>
          <p className="leading-relaxed">{citations[openIdx].snippet}</p>
        </div>
      )}
    </div>
  )
}
