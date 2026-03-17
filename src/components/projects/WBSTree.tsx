'use client'

import { useState, useCallback, useRef } from 'react'
import { Plus, FolderPlus, HelpCircle } from 'lucide-react'
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
  onMoveNode?: (nodeId: string, parentId: string | null, position: number) => Promise<unknown>
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
  onMoveNode,
}: WBSTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    // Auto-expand macro and activity nodes on initial render
    () => new Set(nodes.filter(n => n.level !== 'task').map(n => n.id)),
  )
  const [addingAt, setAddingAt] = useState<{ parentId: string | null; level: WBSLevel } | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [saving, setSaving] = useState(false)

  // Drag state
  const dragNodeIdRef = useRef<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [dropPosition, setDropPosition] = useState<'before' | 'inside' | 'after'>('after')

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

  // Check if targetId is an ancestor of nodeId (to prevent illegal moves)
  function isAncestor(nodeId: string, targetId: string): boolean {
    const target = nodes.find(n => n.id === targetId)
    if (!target) return false
    if (target.parent_id === nodeId) return true
    if (target.parent_id) return isAncestor(nodeId, target.parent_id)
    return false
  }

  function handleDragStart(nodeId: string) {
    dragNodeIdRef.current = nodeId
  }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    if (!dragNodeIdRef.current || dragNodeIdRef.current === targetId) return
    if (isAncestor(dragNodeIdRef.current, targetId)) return
    setDropTargetId(targetId)

    // Determine position based on pointer Y within target element
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const relY = e.clientY - rect.top
    const pct = relY / rect.height
    if (pct < 0.25) setDropPosition('before')
    else if (pct > 0.75) setDropPosition('after')
    else setDropPosition('inside')
  }

  async function handleDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    const nodeId = dragNodeIdRef.current
    dragNodeIdRef.current = null
    setDropTargetId(null)

    if (!nodeId || nodeId === targetId || !onMoveNode) return
    if (isAncestor(nodeId, targetId)) return

    const targetNode = nodes.find(n => n.id === targetId)
    if (!targetNode) return

    let newParentId: string | null
    let newPosition: number

    if (dropPosition === 'inside') {
      // Drop inside: make it a child of targetNode
      newParentId = targetId
      newPosition = 0
    } else {
      // Drop before/after: sibling of targetNode
      newParentId = targetNode.parent_id ?? null
      const siblings = nodes.filter(n => n.parent_id === newParentId).sort((a, b) => a.position - b.position)
      const targetIdx = siblings.findIndex(s => s.id === targetId)
      newPosition = dropPosition === 'before' ? Math.max(0, targetIdx) : targetIdx + 1
    }

    await onMoveNode(nodeId, newParentId, newPosition)
  }

  function handleDragEnd() {
    dragNodeIdRef.current = null
    setDropTargetId(null)
  }

  function renderNodes(items: WBSNode[], depth = 0): React.ReactNode[] {
    return items.flatMap(node => {
      const children = node.children ?? []
      const isExpanded = expandedIds.has(node.id)
      const progress = getNodeProgress(node.id)
      const isDropTarget = dropTargetId === node.id
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
          isDragTarget={isDropTarget}
          dropPosition={isDropTarget ? dropPosition : undefined}
          onDragStart={() => handleDragStart(node.id)}
          onDragOver={e => handleDragOver(e, node.id)}
          onDrop={e => handleDrop(e, node.id)}
          onDragEnd={handleDragEnd}
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
          <p className="text-sm font-medium text-brand-navy">Sin estructura todavía</p>
          <p className="mt-1 text-xs text-gray-500">Divide tu proyecto en fases, actividades y tareas</p>
          <button
            type="button"
            onClick={() => { setAddingAt({ parentId: null, level: 'macro' }); setNewTitle('') }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:bg-brand-navy-light"
          >
            <Plus className="h-4 w-4" />
            Nueva fase
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
                placeholder="Nombre de la fase o etapa..."
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

          {/* Add phase button */}
          {addingAt?.parentId !== null && (
            <button
              type="button"
              onClick={() => { setAddingAt({ parentId: null, level: 'macro' }); setNewTitle('') }}
              className="mt-1 flex items-center gap-1.5 rounded-lg border border-dashed border-brand-stone px-3 py-2 text-sm text-gray-500 transition-colors hover:border-brand-navy hover:text-brand-navy"
            >
              <Plus className="h-4 w-4" />
              Nueva fase
            </button>
          )}
        </>
      )}
    </div>
  )
}
