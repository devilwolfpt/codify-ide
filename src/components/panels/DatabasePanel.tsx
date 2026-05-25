import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { DbTable } from '../../types'

interface DatabasePanelProps {
  tables: DbTable[]
  onChange: (tables: DbTable[]) => void
}

export function DatabasePanel({ tables, onChange }: DatabasePanelProps) {
  const [selected, setSelected] = useState(tables[0]?.id ?? '')

  const table = tables.find((t) => t.id === selected)

  const addRow = () => {
    if (!table) return
    const row: Record<string, string> = {}
    table.columns.forEach((c) => (row[c] = ''))
    onChange(
      tables.map((t) =>
        t.id === selected ? { ...t, rows: [...t.rows, row] } : t,
      ),
    )
  }

  return (
    <div className="data-panel">
      <header className="data-panel-header">
        <h2>Database</h2>
        <div className="table-tabs">
          {tables.map((t) => (
            <button
              key={t.id}
              type="button"
              className={selected === t.id ? 'active' : ''}
              onClick={() => setSelected(t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
      </header>
      {table && (
        <>
          <div className="db-toolbar">
            <button type="button" className="btn-primary" onClick={addRow}>
              <Plus size={16} /> Nova linha
            </button>
          </div>
          <div className="db-grid-wrap">
            <table className="db-grid">
              <thead>
                <tr>
                  {table.columns.map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, ri) => (
                  <tr key={ri}>
                    {table.columns.map((col) => (
                      <td key={col}>
                        <input
                          value={row[col] ?? ''}
                          onChange={(e) =>
                            onChange(
                              tables.map((t) =>
                                t.id === selected
                                  ? {
                                      ...t,
                                      rows: t.rows.map((r, i) =>
                                        i === ri ? { ...r, [col]: e.target.value } : r,
                                      ),
                                    }
                                  : t,
                              ),
                            )
                          }
                        />
                      </td>
                    ))}
                    <td>
                      <button
                        type="button"
                        className="icon-btn danger"
                        onClick={() =>
                          onChange(
                            tables.map((t) =>
                              t.id === selected
                                ? { ...t, rows: t.rows.filter((_, i) => i !== ri) }
                                : t,
                            ),
                          )
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
