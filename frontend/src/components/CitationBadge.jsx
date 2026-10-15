import { useState } from 'react'
import { FileText, ChevronDown, ChevronUp, AlertCircle, CheckCircle } from 'lucide-react'

export default function CitationBadge({ citations = [], confidence, abstained }) {
  const [expanded, setExpanded] = useState(false)
  const [openIdx, setOpenIdx] = useState(null)

  if (!citations.length && !abstained) return null

  return (
    <div className="mt-2 space-y-1">
      {/* Evidence badge */}
      <div className="flex items-center gap-2 flex-wrap">
        {abstained ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-gray-800 text-gray-400 border border-gray-700">
            <AlertCircle size={12} />
            Insufficient information
          </span>
        ) : (
          <button
            onClick={() => setExpanded(e => !e)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-emerald-900/30 text-emerald-400 border border-emerald-800 hover:bg-emerald-900/50 transition-colors"
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
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-blue-900/30 text-blue-400 border border-blue-800 hover:bg-blue-900/50 transition-colors"
          >
            <FileText size={12} />
            {c.doc} · Page {c.page}
          </button>
        ))}
      </div>

      {/* Snippet previews */}
      {expanded && citations.map((c, i) => (
        <div key={i} className={`text-xs text-gray-300 bg-gray-800/60 border border-gray-700 rounded-lg p-3 ${openIdx !== null && openIdx !== i ? 'hidden' : ''}`}>
          <p className="text-gray-500 mb-1 font-medium">{c.doc}, Page {c.page}</p>
          <p className="leading-relaxed">{c.snippet}</p>
        </div>
      ))}

      {openIdx !== null && !expanded && citations[openIdx] && (
        <div className="text-xs text-gray-300 bg-gray-800/60 border border-gray-700 rounded-lg p-3">
          <p className="text-gray-500 mb-1 font-medium">{citations[openIdx].doc}, Page {citations[openIdx].page}</p>
          <p className="leading-relaxed">{citations[openIdx].snippet}</p>
        </div>
      )}
    </div>
  )
}
