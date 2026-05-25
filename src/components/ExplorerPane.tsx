import { X } from 'lucide-react'
import { FileTree } from './FileTree'
import type { FileNode } from '../types'

interface ExplorerPaneProps {
  nodes: FileNode[]
  activeId: string
  onOpen: (id: string) => void
  onCreateFile: (parentId: string, name: string) => void
  onCreateFolder: (parentId: string, name: string) => void
  onDelete: (id: string) => void
  variant?: 'docked' | 'drawer'
  onClose?: () => void
  onOpenFolder?: () => void
  style?: React.CSSProperties
}

export function ExplorerPane({
  nodes,
  activeId,
  onOpen,
  onCreateFile,
  onCreateFolder,
  onDelete,
  variant = 'docked',
  onClose,
  onOpenFolder,
  style,
}: ExplorerPaneProps) {
  return (
    <aside className={`explorer-pane explorer-pane--${variant}`} style={style}>
      {variant === 'drawer' && (
        <header className="explorer-drawer-header">
          <span>Ficheiros</span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>
      )}
      <FileTree
        nodes={nodes}
        activeId={activeId}
        onOpen={onOpen}
        onCreateFile={onCreateFile}
        onCreateFolder={onCreateFolder}
        onDelete={onDelete}
        onOpenFolder={onOpenFolder}
      />
    </aside>
  )
}
