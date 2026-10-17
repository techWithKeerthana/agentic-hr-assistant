import { useState, useEffect } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'

const THEMES = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
  { value: 'system', icon: Monitor, label: 'System' },
]

function applyTheme(theme) {
  const html = document.documentElement
  if (theme === 'system') {
    html.removeAttribute('data-theme')
  } else {
    html.setAttribute('data-theme', theme)
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('hr-theme') || 'system' } catch { return 'system' }
  })

  useEffect(() => {
    applyTheme(theme)
    try { localStorage.setItem('hr-theme', theme) } catch {}
  }, [theme])

  const current = THEMES.find(t => t.value === theme) || THEMES[2]
  const Icon = current.icon

  const cycle = () => {
    const idx = THEMES.findIndex(t => t.value === theme)
    setTheme(THEMES[(idx + 1) % THEMES.length].value)
  }

  return (
    <button
      onClick={cycle}
      title={`Theme: ${current.label} — click to cycle`}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors text-xs"
      style={{
        color: 'var(--text-secondary)',
        borderColor: 'var(--border)',
        backgroundColor: 'transparent',
      }}
      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-card)'; e.currentTarget.style.color = 'var(--text-primary)' }}
      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
    >
      <Icon size={14} />
      <span>{current.label}</span>
    </button>
  )
}
