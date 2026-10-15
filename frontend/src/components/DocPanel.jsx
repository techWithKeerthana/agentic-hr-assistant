import { useState, useEffect, useRef } from 'react'
import { FileText, Upload, RefreshCw, Search, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || ''

export default function DocPanel() {
  const [docs, setDocs] = useState([])
  const [uploading, setUploading] = useState(false)
  const [previewQuery, setPreviewQuery] = useState('')
  const [previewChunks, setPreviewChunks] = useState([])
  const [previewing, setPreviewing] = useState(false)
  const fileRef = useRef(null)

  const fetchDocs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/docs`)
      const data = await res.json()
      setDocs(data.documents || [])
    } catch { /* ignore */ }
  }

  useEffect(() => { fetchDocs() }, [])

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch(`${API_BASE}/api/docs/upload`, { method: 'POST', body: formData })
      await res.json()
      await fetchDocs()
    } catch { /* ignore */ }
    setUploading(false)
    fileRef.current.value = ''
  }

  const handlePreview = async () => {
    if (!previewQuery.trim()) return
    setPreviewing(true)
    try {
      const res = await fetch(`${API_BASE}/api/docs/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: previewQuery }),
      })
      const data = await res.json()
      setPreviewChunks(data.chunks || [])
    } catch { /* ignore */ }
    setPreviewing(false)
  }

  return (
    <div className="flex flex-col h-full p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText size={24} className="text-blue-400" />
          <div>
            <h2 className="text-lg font-semibold text-gray-200">Document Management</h2>
            <p className="text-xs text-gray-500">Manage indexed PDFs and diagnose retrieval</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchDocs}
            className="p-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-gray-300 transition-colors border border-gray-700"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white text-sm font-medium transition-colors"
          >
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            Upload PDF
          </button>
          <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {/* Indexed documents */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Indexed Documents</h3>
        {docs.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-sm">
            No documents indexed yet. The system ingests PDFs on startup.
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map((doc, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl">
                <FileText size={18} className="text-blue-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200 truncate">{doc.doc_name}</p>
                  <p className="text-xs text-gray-500">
                    {doc.chunk_count} chunks · {doc.page_count} pages
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {doc.status === 'indexed' ? (
                    <CheckCircle2 size={15} className="text-green-500" />
                  ) : (
                    <AlertCircle size={15} className="text-amber-500" />
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    doc.status === 'indexed'
                      ? 'bg-green-900/20 text-green-400 border-green-800'
                      : 'bg-amber-900/20 text-amber-400 border-amber-800'
                  }`}>
                    {doc.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Test query */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Preview Retrieval</h3>
        <div className="flex gap-2 mb-3">
          <input
            value={previewQuery}
            onChange={e => setPreviewQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handlePreview()}
            placeholder="Enter a test query to see retrieved chunks..."
            className="flex-1 bg-gray-800 border border-gray-700 text-gray-200 placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-600"
          />
          <button
            onClick={handlePreview}
            disabled={previewing || !previewQuery.trim()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 text-sm transition-colors"
          >
            {previewing ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          </button>
        </div>

        {previewChunks.length > 0 && (
          <div className="space-y-2">
            {previewChunks.map((chunk, i) => (
              <div key={i} className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-medium text-blue-400">{chunk.doc_name}</span>
                  <span className="text-xs text-gray-500">Page {chunk.page_number}</span>
                  <span className="ml-auto text-xs text-gray-500">
                    score: <span className="text-gray-400">{(chunk.score * 100).toFixed(0)}%</span>
                  </span>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{chunk.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
