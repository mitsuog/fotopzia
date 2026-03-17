'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import type { WBSNode, Dependency, WBSLevel, NodeStatus, NodePriority } from '@/types/wbs'

export type { WBSNode, Dependency }

// ----------------------------------------------------------------
// Tree builder — converts flat list into nested structure
// ----------------------------------------------------------------
export function buildTree(nodes: WBSNode[]): WBSNode[] {
  const map = new Map<string, WBSNode>()
  const roots: WBSNode[] = []

  // Clone all nodes and reset children
  for (const node of nodes) {
    map.set(node.id, { ...node, children: [] })
  }

  // Sort nodes by position within the same parent
  const sorted = [...map.values()].sort((a, b) => a.position - b.position)

  for (const node of sorted) {
    if (node.parent_id && map.has(node.parent_id)) {
      const parent = map.get(node.parent_id)!
      parent.children = parent.children ?? []
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots.sort((a, b) => a.position - b.position)
}

// ----------------------------------------------------------------
// Progress computation — recursive roll-up from task-level leaves
// ----------------------------------------------------------------
export function computeProgress(node: WBSNode, allNodes: WBSNode[]): number {
  if (node.progress_mode === 'manual' && node.progress_pct !== null) {
    return node.progress_pct
  }
  // Find all task-level descendants
  const taskLeaves = getDescendantTasks(node.id, allNodes)
  if (taskLeaves.length === 0) {
    // Leaf task with no children — use its own status
    if (node.level === 'task') {
      return node.status === 'done' ? 100 : 0
    }
    return 0
  }
  const done = taskLeaves.filter(t => t.status === 'done').length
  return Math.round((done / taskLeaves.length) * 100)
}

function getDescendantTasks(nodeId: string, allNodes: WBSNode[]): WBSNode[] {
  const children = allNodes.filter(n => n.parent_id === nodeId)
  if (children.length === 0) return []
  const result: WBSNode[] = []
  for (const child of children) {
    if (child.level === 'task' && child.children?.length === 0) {
      result.push(child)
    } else {
      result.push(...getDescendantTasks(child.id, allNodes))
    }
  }
  // Also include direct task children
  result.push(...children.filter(c => c.level === 'task'))
  return [...new Set(result)]
}

// ----------------------------------------------------------------
// useWBS hook
// ----------------------------------------------------------------
export function useWBS(projectId: string, initialNodes: WBSNode[] = [], initialDeps: Dependency[] = []) {
  const [nodes, setNodes] = useState<WBSNode[]>(initialNodes)
  const [deps, setDeps] = useState<Dependency[]>(initialDeps)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const snapshotRef = useRef<{ nodes: WBSNode[]; deps: Dependency[] }>({ nodes: initialNodes, deps: initialDeps })

  const tree = useMemo(() => buildTree(nodes), [nodes])

  const getNodeProgress = useCallback(
    (nodeId: string): number => {
      const node = nodes.find(n => n.id === nodeId)
      if (!node) return 0
      return computeProgress(node, nodes)
    },
    [nodes],
  )

  // ---- CRUD: nodes ----

  const createNode = useCallback(
    async (payload: { title: string; level: WBSLevel; parent_id?: string | null; position?: number; is_milestone?: boolean; priority?: NodePriority; start_at?: string | null; due_at?: string | null; assigned_to?: string | null; description?: string | null }) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/projects/${projectId}/wbs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Error al crear nodo WBS')
        setNodes(prev => [...prev, json.data as WBSNode])
        return json.data as WBSNode
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error'
        setError(msg)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [projectId],
  )

  const updateNode = useCallback(
    async (nodeId: string, updates: Partial<Pick<WBSNode, 'title' | 'description' | 'status' | 'priority' | 'start_at' | 'due_at' | 'assigned_to' | 'is_milestone' | 'progress_mode' | 'progress_pct' | 'completed_at' | 'position'>>) => {
      snapshotRef.current = { nodes, deps }
      setNodes(prev => prev.map(n => (n.id === nodeId ? { ...n, ...updates } : n)))
      try {
        const res = await fetch(`/api/projects/${projectId}/wbs/${nodeId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        const json = await res.json()
        if (!res.ok) {
          setNodes(snapshotRef.current.nodes)
          throw new Error(json.error ?? 'Error al actualizar nodo WBS')
        }
        setNodes(prev => prev.map(n => (n.id === nodeId ? json.data : n)))
        return json.data as WBSNode
      } catch (err) {
        setNodes(snapshotRef.current.nodes)
        throw err
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, nodes, deps],
  )

  const deleteNode = useCallback(
    async (nodeId: string) => {
      snapshotRef.current = { nodes, deps }
      // Remove node and all its descendants from local state
      const idsToRemove = new Set<string>()
      function collectIds(id: string) {
        idsToRemove.add(id)
        nodes.filter(n => n.parent_id === id).forEach(child => collectIds(child.id))
      }
      collectIds(nodeId)
      setNodes(prev => prev.filter(n => !idsToRemove.has(n.id)))
      setDeps(prev => prev.filter(d => !idsToRemove.has(d.predecessor_id) && !idsToRemove.has(d.successor_id)))
      try {
        const res = await fetch(`/api/projects/${projectId}/wbs/${nodeId}`, { method: 'DELETE' })
        if (!res.ok) {
          setNodes(snapshotRef.current.nodes)
          setDeps(snapshotRef.current.deps)
          const json = await res.json()
          throw new Error(json.error ?? 'Error al eliminar nodo WBS')
        }
      } catch (err) {
        setNodes(snapshotRef.current.nodes)
        setDeps(snapshotRef.current.deps)
        throw err
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, nodes, deps],
  )

  const moveNode = useCallback(
    async (nodeId: string, parentId: string | null, position: number) => {
      snapshotRef.current = { nodes, deps }
      setNodes(prev => prev.map(n => (n.id === nodeId ? { ...n, parent_id: parentId, position } : n)))
      try {
        const res = await fetch(`/api/projects/${projectId}/wbs/${nodeId}/move`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parent_id: parentId, position }),
        })
        const json = await res.json()
        if (!res.ok) {
          setNodes(snapshotRef.current.nodes)
          throw new Error(json.error ?? 'Error al mover nodo WBS')
        }
        setNodes(prev => prev.map(n => (n.id === nodeId ? json.data : n)))
      } catch (err) {
        setNodes(snapshotRef.current.nodes)
        throw err
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, nodes, deps],
  )

  // ---- CRUD: dependencies ----

  const createDependency = useCallback(
    async (payload: { predecessor_id: string; successor_id: string; dep_type?: string; lag_days?: number }) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/projects/${projectId}/dependencies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Error al crear dependencia')
        setDeps(prev => [...prev, json.data as Dependency])
        return json.data as Dependency
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error'
        setError(msg)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [projectId],
  )

  const deleteDependency = useCallback(
    async (depId: string) => {
      snapshotRef.current = { nodes, deps }
      setDeps(prev => prev.filter(d => d.id !== depId))
      try {
        const res = await fetch(`/api/projects/${projectId}/dependencies/${depId}`, { method: 'DELETE' })
        if (!res.ok) {
          setDeps(snapshotRef.current.deps)
          const json = await res.json()
          throw new Error(json.error ?? 'Error al eliminar dependencia')
        }
      } catch (err) {
        setDeps(snapshotRef.current.deps)
        throw err
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, nodes, deps],
  )

  return {
    nodes,
    setNodes,
    tree,
    deps,
    loading,
    error,
    getNodeProgress,
    createNode,
    updateNode,
    deleteNode,
    moveNode,
    createDependency,
    deleteDependency,
  }
}
