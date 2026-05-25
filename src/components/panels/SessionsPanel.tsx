import { Plus, Circle } from 'lucide-react'
import type { SessionEntry } from '../../types'

interface SessionsPanelProps {
  sessions: SessionEntry[]
  onChange: (s: SessionEntry[]) => void
}

export function SessionsPanel({ sessions, onChange }: SessionsPanelProps) {
  const add = () => {
    const name = prompt('Nome da sessão:')
    if (!name) return
    onChange([
      ...sessions.map((s) => ({ ...s, active: false })),
      { id: `sess-${Date.now()}`, name, createdAt: Date.now(), active: true },
    ])
  }

  const activate = (id: string) => {
    onChange(sessions.map((s) => ({ ...s, active: s.id === id })))
  }

  return (
    <div className="list-panel">
      <header className="data-panel-header">
        <h2>Sessões</h2>
        <button type="button" className="btn-primary" onClick={add}>
          <Plus size={16} /> Nova sessão
        </button>
      </header>
      <ul className="session-list">
        {sessions.map((s) => (
          <li key={s.id} className={`session-item ${s.active ? 'active' : ''}`}>
            <button type="button" onClick={() => activate(s.id)}>
              <Circle size={10} fill={s.active ? 'var(--accent)' : 'transparent'} />
              <div>
                <strong>{s.name}</strong>
                <span>{new Date(s.createdAt).toLocaleString('pt-PT')}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
