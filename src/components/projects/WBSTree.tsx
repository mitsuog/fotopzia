'use client'

import { useState, useCallback } from 'react'
import { Plus, FolderPlus } from 'lucide-react'
import type { WBSNode, WBSLevel } from '@/types/wbs'
import type { TeamProfile } from '@/hooks/useProject'
import { WBSNodeRow } from './WBSNodeRow'

interface WBSTreeProps {
  nodes: WBSNode[]
  tree: WBSNode[]  // pre-built tree from useWBS
  profiles: TeamProfile[]
  getNodeProgress: (id: string) => number
  onUpdateNode: (id: string, updates: Partial<WBSNode>) => Promise<unknown>
  onCreateNode: (payload: { title: string; level: WBSLevel; parent_id?: string | null; position?: number }) => Promise<unknown>
  onDeleteNode: (id: string) => Promise<unknown>
  onOpenNode: (node: WBSNode) => void
}

export function WBSTree({
  nodes,
  tree,
  profiles,
  getNodeProgress,
  onUpdateNode,
  onCreateNode,
  onDeleteNode,
  onOpenNode,
}: WBSTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    // Auto-expand macro and activity nodes on initial render
    () => new Set(nodes.filter(n => n.level !== 'task').map(n => n.id)),
  )
  const [addingAt, setAddingAt] = useState<{ parentId: string | null; level: WBSLevel } | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving] = useState(false)

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  async function handleCreate() {
    if (!newTitle.trim() || !addingAt) return
    setSaving(true)
    try {
      await onCreateNode({
        title: newTitle.trim(),
        level: addingAt.level,
        parent_id: addingAt.parentId,
        position: 0,
      })
      setNewTitle('')
      setAddingAt(null)
      // Auto-expand parent
      if (addingAt.parentId) {
        setExpandedIds(prev => new Set([...prev, addingAt.parentId!]))
      }
    } finally {
      setSaving(false)
    }
  }

  function renderNodes(items: WBSNode[], depth = 0): React.ReactNode[] {
    return items.flatMap(node => {
      const children = node.children ?? []
      const isExpanded = expandedIds.has(node.id)
      const progress = getNodeProgress(node.id)
      const rows: React.ReactNode[] = [
        <WBSNodeRow
          key={node.id}
          node={node}
          progress={progress}
          profiles={profiles}
          isExpanded={isExpanded}
          hasChildren={children.length > 0}
          onToggleExpand={() => toggleExpand(node.id)}
          onUpdate={updates => onUpdateNode(node.id, updates)}
          onDelete={() => onDeleteNode(node.id)}
          onOpen={() => onOpenNode(node)}
          onAddChild={level => {
            setAddingAt({ parentId: node.id, level })
            setNewTitle('')
            setExpandedIds(prev => new Set([...prev, node.id]))
          }}
        />,
      ]

      // Show inline add form right after this node if adding here
      if (addingAt?.parentId === node.id) {
        const indentPx = node.level === 'macro' ? 60 : node.level === 'activity' ? 80 : 100
        rows.push(
          <div key={`add-${node.id}`} className="flex items-center gap-2 py-1" style={{ paddingLeft: `${indentPx}px` }}>
            <input
              autoFocus
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') void handleCreate()
                if (e.key === 'Escape') { setAddingAt(null); setNewTitle('') }
              }}
              placeholder={`Nombre de la ${addingAt.level === 'activity' ? 'actividad' : 'tarea'}...`}
              className="flex-1 rounded border border-brand-gold/60 bg-white px-2 py-1 text-sm text-brand-navy outline-none focus:border-brand-gold"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving || !newTitle.trim()}
              className="rounded bg-brand-navy px-3 py-1 text-xs font-medium text-white disabled:opacity-50 hover:bg-brand-navy-light"
            >
              {saving ? '...' : 'Crear'}
            </button>
            <button
              type="button"
              onClick={() => { setAddingAt(null); setNewTitle('') }}
              className="rounded px-2 py-1 text-xs text-gray-500 hover:text-brand-navy"
            >
              Cancelar
            </button>
          </div>,
        )
      }

      if (isExpanded && children.length > 0) {
        rows.push(...renderNodes(children, depth + 1))
      }

      return rows
    })
  }

  return (
    <div className="space-y-0.5">
      {tree.length === 0 && !addingAt ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-brand-stone py-12 text-center">
          <FolderPlus className="mb-3 h-10 w-10 text-brand-stone" />
          <p className="text-sm font-medium text-brand-navy">Sin estructura WBS todavía</p>
          <p className="mt-1 text-xs text-gray-500">Agrega macroactividades para organizar el proyecto</p>
          <button
            type="button"
            onClick={() => { setAddingAt({ parentId: null, level: 'macro' }); setNewTitle('') }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-light"
          >
            <Plus className="h-4 w-4" />
            Nueva macroactividad
          </button>
        </div>
      ) : (
        <>
          {renderNodes(tree)}

          {/* Root-level add form */}
          {addingAt?.parentId === null && (
            <div className="flex items-center gap-2 py-1 pl-2">
              <input
                autoFocus
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') void handleCreate()
                  if (e.key === 'Escape') { setAddingAt(null); setNewTitle('') }
                }}
                placeholder="Nombre de la macroactividad..."
                className="flex-1 rounded border border-brand-gold/60 bg-white px-2 py-1 text-sm text-brand-navy outline-none focus:border-brand-gold"
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={saving || !newTitle.trim()}
                className="rounded bg-brand-navy px-3 py-1 text-xs font-medium text-white disabled:opacity-50 hover:bg-brand-navy-light"
              >
                {saving ? '...' : 'Crear'}
              </button>
              <button
                type="button"
                onClick={() => { setAddingAt(null); setNewTitle('') }}
                className="rounded px-2 py-1 text-xs text-gray-500 hover:text-brand-navy"
              >
                Cancelar
              </button>
            </div>
          )}

          {/* Add macroactivity button */}
          {addingAt?.parentId !== null && (
            <button
              type="button"
              onClick={() => { setAddingAt({ parentId: null, level: 'macro' }); setNewTitle('') }}
              className="mt-1 flex items-center gap-1.5 rounded-lg border border-dashed border-brand-stone px-3 py-2 text-sm text-gray-500 transition-colors hover:border-brand-navy hover:text-brand-navy"
            >
              <Plus className="h-4 w-4" />
              Nueva macroactividad
            </button>
          )}
        </>
      )}
    </div>
  )
}
