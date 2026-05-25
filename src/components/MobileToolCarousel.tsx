import { Lock, Database, UserCheck, Plus, Puzzle } from 'lucide-react'
import type { NavView } from '../types'

const CAROUSEL_ITEMS: { id: NavView | 'new-tab'; label: string; icon: typeof Lock }[] = [
  { id: 'secrets', label: 'Secrets', icon: Lock },
  { id: 'database', label: 'Database', icon: Database },
  { id: 'auth', label: 'Auth', icon: UserCheck },
  { id: 'extensions', label: 'Extensions', icon: Puzzle },
  { id: 'new-tab', label: 'New Tab', icon: Plus },
]

interface MobileToolCarouselProps {
  open: boolean
  active?: string
  onSelect: (id: NavView | 'new-tab') => void
}

export function MobileToolCarousel({ open, active, onSelect }: MobileToolCarouselProps) {
  if (!open) return null

  return (
    <section className="mobile-carousel" aria-label="Ferramentas">
      <div className="mobile-carousel-track">
        {CAROUSEL_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`mobile-carousel-card ${active === id ? 'active' : ''}`}
            onClick={() => onSelect(id)}
          >
            <span className="mobile-carousel-icon">
              <Icon size={22} strokeWidth={1.75} />
            </span>
            <span className="mobile-carousel-label">{label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
