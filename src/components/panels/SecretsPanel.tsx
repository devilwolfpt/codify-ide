import { useState } from 'react'
import { Plus, Trash2, Eye, EyeOff } from 'lucide-react'
import type { SecretEntry } from '../../types'

interface SecretsPanelProps {
  secrets: SecretEntry[]
  onChange: (secrets: SecretEntry[]) => void
}

export function SecretsPanel({ secrets, onChange }: SecretsPanelProps) {
  const [visible, setVisible] = useState<Record<string, boolean>>({})

  const add = () => {
    const key = prompt('Nome da variável:')
    if (!key) return
    onChange([...secrets, { id: `s-${Date.now()}`, key, value: '', env: 'all' }])
  }

  return (
    <div className="data-panel">
      <header className="data-panel-header">
        <h2>Secrets</h2>
        <button type="button" className="btn-primary" onClick={add}>
          <Plus size={16} /> Adicionar
        </button>
      </header>
      <p className="data-panel-desc">Variáveis de ambiente guardadas localmente (localStorage).</p>
      <div className="data-table">
        <div className="data-table-head">
          <span>Chave</span>
          <span>Valor</span>
          <span>Ambiente</span>
          <span />
        </div>
        {secrets.map((s) => (
          <div key={s.id} className="data-table-row">
            <input
              value={s.key}
              onChange={(e) =>
                onChange(secrets.map((x) => (x.id === s.id ? { ...x, key: e.target.value } : x)))
              }
            />
            <div className="secret-value-cell">
              <input
                type={visible[s.id] ? 'text' : 'password'}
                value={s.value}
                onChange={(e) =>
                  onChange(secrets.map((x) => (x.id === s.id ? { ...x, value: e.target.value } : x)))
                }
              />
              <button
                type="button"
                onClick={() => setVisible((v) => ({ ...v, [s.id]: !v[s.id] }))}
                aria-label="Mostrar/ocultar"
              >
                {visible[s.id] ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <select
              value={s.env}
              onChange={(e) =>
                onChange(
                  secrets.map((x) =>
                    x.id === s.id ? { ...x, env: e.target.value as SecretEntry['env'] } : x,
                  ),
                )
              }
            >
              <option value="all">all</option>
              <option value="dev">dev</option>
              <option value="prod">prod</option>
            </select>
            <button
              type="button"
              className="icon-btn danger"
              onClick={() => onChange(secrets.filter((x) => x.id !== s.id))}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
