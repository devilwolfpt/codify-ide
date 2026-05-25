import {
  Home,
  Clock,
  Layers,
  Bot,
  Box,
  Lock,
  Database,
  UserCheck,
  Plus,
  FolderOpen,
  Search,
  Puzzle,
} from 'lucide-react'
import type { NavView } from '../types'

const NAV: { id: NavView; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'agent', label: 'Agent', icon: Bot },
  { id: 'history', label: 'Histórico de tarefas', icon: Clock },
  { id: 'memory', label: 'Memória', icon: Layers },
  { id: 'sessions', label: 'Sessões', icon: Box },
  { id: 'secrets', label: 'Secrets', icon: Lock },
  { id: 'database', label: 'Database', icon: Database },
  { id: 'auth', label: 'Auth', icon: UserCheck },
  { id: 'extensions', label: 'Extensions', icon: Puzzle },
]

interface SidebarProps {
  active: NavView
  onNavigate: (view: NavView) => void
  onNewTab: () => void
  searchOpen: boolean
  onSearchToggle: () => void
  explorerOpen: boolean
  onExplorerToggle: () => void
  style?: React.CSSProperties
}

export function Sidebar({
  active,
  onNavigate,
  onNewTab,
  searchOpen,
  onSearchToggle,
  explorerOpen,
  onExplorerToggle,
  style,
}: SidebarProps) {
  const isCollapsed = typeof style?.width === 'number' && style.width < 140

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`} style={style} data-context-type="sidebar">
      <nav className="sidebar-nav">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={`sidebar-item ${active === id ? 'active' : ''}`}
            onClick={() => onNavigate(id)}
          >
            <Icon size={18} strokeWidth={1.75} />
            <span>{label}</span>
          </button>
        ))}
        <button type="button" className="sidebar-item" onClick={onNewTab}>
          <Plus size={18} strokeWidth={1.75} />
          <span>New Tab</span>
        </button>
      </nav>

      <div className="sidebar-footer sidebar-footer--row">
        <button
          type="button"
          className={`sidebar-search ${searchOpen ? 'open' : ''}`}
          onClick={onSearchToggle}
        >
          <Search size={14} />
          <span>Search...</span>
          <kbd>⌘K</kbd>
        </button>
        <button
          type="button"
          className={`sidebar-icon-btn ${explorerOpen ? 'active' : ''}`}
          onClick={onExplorerToggle}
          title="Ficheiros (painel direito)"
        >
          <FolderOpen size={18} />
        </button>
      </div>
    </aside>
  )
}
