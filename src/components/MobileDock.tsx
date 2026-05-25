import { FolderOpen, Search, X } from 'lucide-react'
import { BottomBar } from './BottomBar'
import { MobileToolCarousel } from './MobileToolCarousel'
import type { BottomPanel, NavView } from '../types'

interface MobileDockProps {
  bottomPanel: BottomPanel
  carouselOpen: boolean
  searchOpen: boolean
  activeView?: string
  onBottomChange: (panel: BottomPanel) => void
  onCarouselSelect: (id: NavView | 'new-tab') => void
  onSearchOpen: () => void
  onSearchClose: () => void
  onExplorerToggle: () => void
}

export function MobileDock({
  bottomPanel,
  carouselOpen,
  searchOpen,
  activeView,
  onBottomChange,
  onCarouselSelect,
  onSearchOpen,
  onSearchClose,
  onExplorerToggle,
}: MobileDockProps) {
  return (
    <aside className="mobile-dock">
      <MobileToolCarousel open={carouselOpen} active={activeView} onSelect={onCarouselSelect} />
      <BottomBar active={bottomPanel} onChange={onBottomChange} mobile />
      <div className="mobile-search-bar">
        <button type="button" className="mobile-search" onClick={onSearchOpen}>
          <Search size={16} className="mobile-search-icon" />
          <span>Search...</span>
        </button>
        <button
          type="button"
          className="mobile-dock-btn"
          onClick={onSearchClose}
          aria-label={searchOpen ? 'Fechar pesquisa' : 'Limpar'}
        >
          <X size={20} strokeWidth={1.75} />
        </button>
        <button type="button" className="mobile-dock-btn" onClick={onExplorerToggle} aria-label="Explorador">
          <FolderOpen size={20} strokeWidth={1.75} />
        </button>
      </div>
    </aside>
  )
}
