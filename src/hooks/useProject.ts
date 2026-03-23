'use client'

import { useState, useCallback, useRef } from 'react'

export type ProjectTask = {
  id: string
  project_id: string
  title: string
  description: string | null
  status: 'pending' | 'in_progress' | 'done' | 'blocked'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  due_at: string | null
  start_at: string | null
  assigned_to: string | null
  completed_at: string | null
  created_at: string
}

export type ProjectDeliverable = {
  id: string
  project_id: string
  name: string
  description: string | null
  status: 'pending' | 'in_progress' | 'ready' | 'delivered' | 'approved' | 'rejected'
  due_at: string | null
  delivered_at: string | null
  approved_at: string | null
  notes: string | null
  created_at: string
}

export type ProjectWithAll = {
  id: string
  title: string
  stage: 'preproduccion' | 'primera_revision' | 'produccion' | 'segunda_revision' | 'entrega' | 'cierre'
  contact_id: string
  deal_id: string | null
  start_date: string | null
  due_date: string | null
  description: string | null
  assigned_to: string | null
  created_at: string
  is_archived: boolean
  archived_at: string | null
  contact: { first_name: string; last_name: string; email: string } | null
}

export type TeamProfile = {
  id: string
  full_name: string | null
  role: string
  email: string | null
}

export function useProject(projectId: string, initial?: ProjectWithAll) {
  const [project, setProject] = useState<ProjectWithAll | undefined>(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateProject = useCallback(
    async (updates: Partial<ProjectWithAll>) => {
      setProject(p => (p ? { ...p, ...updates } : p))
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        const json = await res.json()
        if (!res.ok) {
          setProject(initial)
          throw new Error(json.error ?? 'Error al actualizar proyecto')
        }
        setProject(json.data)
        return json.data as ProjectWithAll
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error'
        setError(msg)
        throw err
      } finally {
        setLoading(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId],
  )

  return { project, updateProject, loading, error }
}

export function useProjectTasks(projectId: string, initial: ProjectTask[] = []) {
  const [tasks, setTasks] = useState<ProjectTask[]>(initial)
  const [loading, setLoading] = useState(false)
  const snapshotRef = useRef<ProjectTask[]>(initial)

  const updateTask = useCallback(
    async (taskId: string, updates: Partial<ProjectTask>) => {
      snapshotRef.current = tasks
      setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, ...updates } : t)))
      try {
        const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        const json = await res.json()
        if (!res.ok) {
          setTasks(snapshotRef.current)
          throw new Error(json.error ?? 'Error al actualizar tarea')
        }
        setTasks(prev => prev.map(t => (t.id === taskId ? json.data : t)))
        return json.data as ProjectTask
      } catch (err) {
        setTasks(snapshotRef.current)
        throw err
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, tasks],
  )

  const deleteTask = useCallback(
    async (taskId: string) => {
      snapshotRef.current = tasks
      setTasks(prev => prev.filter(t => t.id !== taskId))
      try {
        const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, { method: 'DELETE' })
        if (!res.ok) {
          setTasks(snapshotRef.current)
          const json = await res.json()
          throw new Error(json.error ?? 'Error al eliminar tarea')
        }
      } catch (err) {
        setTasks(snapshotRef.current)
        throw err
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, tasks],
  )

  const createTask = useCallback(
    async (payload: Partial<ProjectTask> & { title: string }) => {
      setLoading(true)
      try {
        const res = await fetch(`/api/projects/${projectId}/tasks`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Error al crear tarea')
        setTasks(prev => [json.data, ...prev])
        return json.data as ProjectTask
      } finally {
        setLoading(false)
      }
    },
    [projectId],
  )

  return { tasks, setTasks, updateTask, deleteTask, createTask, loading }
}

export function useProjectDeliverables(projectId: string, initial: ProjectDeliverable[] = []) {
  const [deliverables, setDeliverables] = useState<ProjectDeliverable[]>(initial)
  const [loading, setLoading] = useState(false)
  const snapshotRef = useRef<ProjectDeliverable[]>(initial)

  const updateDeliverable = useCallback(
    async (deliverableId: string, updates: Partial<ProjectDeliverable>) => {
      snapshotRef.current = deliverables
      setDeliverables(prev => prev.map(d => (d.id === deliverableId ? { ...d, ...updates } : d)))
      try {
        const res = await fetch(`/api/projects/${projectId}/deliverables/${deliverableId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        })
        const json = await res.json()
        if (!res.ok) {
          setDeliverables(snapshotRef.current)
          throw new Error(json.error ?? 'Error al actualizar entregable')
        }
        setDeliverables(prev => prev.map(d => (d.id === deliverableId ? json.data : d)))
        return json.data as ProjectDeliverable
      } catch (err) {
        setDeliverables(snapshotRef.current)
        throw err
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectId, deliverables],
  )

  const createDeliverable = useCallback(
    async (payload: Partial<ProjectDeliverable> & { name: string }) => {
      setLoading(true)
      try {
        const res = await fetch(`/api/projects/${projectId}/deliverables`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Error al crear entregable')
        setDeliverables(prev => [...prev, json.data])
        return json.data as ProjectDeliverable
      } finally {
        setLoading(false)
      }
    },
    [projectId],
  )

  return { deliverables, setDeliverables, updateDeliverable, createDeliverable, loading }
}

