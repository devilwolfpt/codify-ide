import { useState, useEffect, useRef } from 'react'
import { Search, File, X } from 'lucide-react'

interface SearchModalProps {
  open: boolean
  onClose: () => void
  files: { id: string; path: string }[]
  onOpenFile: (id: string) => void
}

export function SearchModal({ open, onClose, files, onOpenFile }: SearchModalProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) onClose()
      }
      if (e.key === 'Escape' && open) onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const filtered = files.filter((f) => f.path.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="search-overlay" onClick={onClose} role="presentation">
      <div className="search-modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="search-input-wrap">
          <Search size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar ficheiros..."
          />
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <ul className="search-results">
          {filtered.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                onClick={() => {
                  onOpenFile(f.id)
                  onClose()
                }}
              >
                <File size={16} />
                {f.path}
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="search-empty">Nenhum resultado</li>}
        </ul>
      </div>
    </div>
  )
}
