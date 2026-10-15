import { useState } from 'react'
import { Play, CheckCircle2, XCircle, Minus, Clock, BarChart3 } from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_URL || ''

export default function EvalDashboard() {
  const [results, setResults] = useState(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)

  const runEval = async () => {
    setRunning(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/eval/run`, { method: 'POST' })
      const data = await res.json()
      setResults(data)
    } catch (e) {
      setError('Failed to run evaluation suite')
    } finally {
      setRunning(false)
    }
  }

  const StatusIcon = ({ passed }) => {
    if (passed === true) return <CheckCircle2 size={16} className="text-green-500" />
    if (passed === false) return <XCircle size={16} className="text-red-500" />
    return <Minus size={16} className="text-gray-500" />
  }

  const categories = results
    ? [...new Set(results.results.map(r => r.category))]
    : []

  return (
    <div className="flex flex-col h-full p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 size={24} className="text-indigo-400" />
          <div>
            <h2 className="text-lg font-semibold text-gray-200">Agent Evaluation Lab</h2>
            <p className="text-xs text-gray-500">Verify accuracy, routing, security, and booking correctness</p>
          </div>
        </div>
        <button
          onClick={runEval}
          disabled={running}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          {running ? (
            <>
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-white rounded-full typing-dot" />
                <span className="w-1.5 h-1.5 bg-white rounded-full typing-dot" />
                <span className="w-1.5 h-1.5 bg-white rounded-full typing-dot" />
              </span>
              Running...
            </>
          ) : (
            <>
              <Play size={15} />
              Run Eval Suite
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {results && (
        <>
          {/* Summary metrics */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Pass Rate', value: `${results.summary.pass_rate}%`, color: results.summary.pass_rate >= 80 ? 'text-green-400' : 'text-amber-400' },
              { label: 'Passed', value: results.summary.passed, color: 'text-green-400' },
              { label: 'Failed', value: results.summary.failed, color: results.summary.failed > 0 ? 'text-red-400' : 'text-gray-400' },
              { label: 'Skipped', value: results.summary.skipped, color: 'text-gray-400' },
            ].map(m => (
              <div key={m.label} className="bg-gray-800 border border-gray-700 rounded-xl p-3 text-center">
                <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                <p className="text-xs text-gray-500 mt-1">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Results by category */}
          {categories.map(cat => (
            <div key={cat} className="mb-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{cat}</h3>
              <div className="space-y-1.5">
                {results.results.filter(r => r.category === cat).map(r => (
                  <div
                    key={r.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm ${
                      r.passed === true
                        ? 'bg-green-900/10 border-green-900/50'
                        : r.passed === false
                        ? 'bg-red-900/10 border-red-900/50'
                        : 'bg-gray-800 border-gray-700'
                    }`}
                  >
                    <StatusIcon passed={r.passed} />
                    <span className="flex-1 text-gray-300">{r.description}</span>
                    {r.latency_ms > 0 && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock size={10} />
                        {r.latency_ms}ms
                      </span>
                    )}
                    {r.passed === false && (
                      <span className="text-xs text-red-400 max-w-[200px] truncate">
                        got: {r.actual}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <p className="text-xs text-gray-600 mt-2">
            Last run: {results.timestamp}
          </p>
        </>
      )}

      {!results && !running && (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-center">
          <BarChart3 size={48} className="text-gray-700" />
          <p className="text-gray-500 text-sm">Click "Run Eval Suite" to evaluate the agent's performance</p>
          <p className="text-gray-600 text-xs">Tests: security, input validation, routing, database integrity</p>
        </div>
      )}
    </div>
  )
}
