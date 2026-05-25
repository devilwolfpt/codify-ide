import { Plus, Trash2 } from 'lucide-react'
import type { MemoryEntry } from '../../types'

interface MemoryPanelProps {
  memories: MemoryEntry[]
  onChange: (m: MemoryEntry[]) => void
}

export function MemoryPanel({ memories, onChange }: MemoryPanelProps) {
  const add = () => {
    const title = prompt('Título da memória:')
    if (!title) return
    onChange([
      ...memories,
      { id: `m-${Date.now()}`, title, content: '', tags: [], updatedAt: Date.now() },
    ])
  }

  return (
    <div className="list-panel">
      <header className="data-panel-header">
        <h2>Memória</h2>
        <button type="button" className="btn-primary" onClick={add}>
          <Plus size={16} /> Nova
        </button>
      </header>
      <div className="memory-grid">
        {memories.map((m) => (
          <article key={m.id} className="memory-card">
            <header>
              <input
                className="memory-title"
                value={m.title}
                onChange={(e) =>
                  onChange(memories.map((x) => (x.id === m.id ? { ...x, title: e.target.value } : x)))
                }
              />
              <button
                type="button"
                className="icon-btn danger"
                onClick={() => onChange(memories.filter((x) => x.id !== m.id))}
              >
                <Trash2 size={14} />
              </button>
            </header>
            <textarea
              value={m.content}
              onChange={(e) =>
                onChange(
                  memories.map((x) =>
                    x.id === m.id ? { ...x, content: e.target.value, updatedAt: Date.now() } : x,
                  ),
                )
              }
              rows={4}
            />
            <div className="memory-tags">
              {m.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
