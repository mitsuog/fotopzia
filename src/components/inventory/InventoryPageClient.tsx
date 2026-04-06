'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  ArchiveRestore,
  ArchiveX,
  ClipboardList,
  Filter,
  History,
  LayoutGrid,
  LayoutList,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SavedViewsBar } from '@/components/workspace/SavedViewsBar'
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { InlineAlert } from '@/components/ui/InlineAlert'
import { SectionCard } from '@/components/ui/SectionCard'
import type { ApiEnvelope } from '@/types/api'
import type {
  EquipmentActivityLogEntry,
  EquipmentAssignment,
  EquipmentCategory,
  EquipmentCondition,
  EquipmentItem,
  EquipmentLocation,
  EquipmentStatus,
} from '@/types/inventory'
import {
  CONDITION_CONFIG,
  EQUIPMENT_EVENT_LABELS,
  LOCATION_LABELS,
  STATUS_CONFIG,
} from '@/types/inventory'
import type { InventoryWorkspaceQuery } from '@/types/workspace'

type ProfileOption = {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
}

type ProjectOption = {
  id: string
  title: string
}

type AssignmentWorkspaceRow = EquipmentAssignment & {
  equipment: { id: string; name: string; asset_tag: string; status: string; is_decommissioned?: boolean | null } | null
}

interface InventoryPageClientProps {
  initialItems: EquipmentItem[]
  categories: EquipmentCategory[]
  profiles: ProfileOption[]
  projects: ProjectOption[]
  initialAssignments: AssignmentWorkspaceRow[]
  initialActivity: EquipmentActivityLogEntry[]
  viewerRole: string | null
}

type ItemForm = {
  name: string
  brand: string
  model: string
  serial_number: string
  category_id: string
  condition: EquipmentCondition
  status: EquipmentStatus
  location: EquipmentLocation
  purchase_date: string
  purchase_cost: string
  currency: string
  depreciation_method: 'linea_recta' | 'ninguno'
  useful_life_years: string
  salvage_value: string
  warranty_expires_at: string
  insurance_policy_number: string
  insurance_expires_at: string
  insurance_provider: string
  photo_url: string
  notes: string
}

type AssignmentForm = {
  project_id: string
  assigned_to: string
  assigned_at: string
  expected_return_at: string
  condition_out: EquipmentCondition
  notes: string
}

type ReturnForm = {
  condition_in: EquipmentCondition
  notes: string
}

function parseQuery(params: URLSearchParams): InventoryWorkspaceQuery {
  const objective = params.get('objective')
  const view = params.get('view')
  const decommissioned = params.get('decommissioned')
  const panel = params.get('panel')

  return {
    objective: objective === 'assignments' || objective === 'traceability' ? objective : 'catalog',
    view: view === 'cards' ? 'cards' : 'list',
    q: params.get('q') ?? undefined,
    status: params.get('status') ?? undefined,
    condition: params.get('condition') ?? undefined,
    location: params.get('location') ?? undefined,
    assignee: params.get('assignee') ?? undefined,
    decommissioned: decommissioned === 'all' || decommissioned === 'decommissioned' ? decommissioned : 'active',
    item: params.get('item') ?? undefined,
    panel: panel === '0' ? '0' : '1',
  }
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function toDateLabel(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value.includes('T') ? value : `${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('es-MX', { dateStyle: 'medium' })
}

function toDateTimeLabel(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
}

function defaultItemForm(): ItemForm {
  return {
    name: '',
    brand: '',
    model: '',
    serial_number: '',
    category_id: '',
    condition: 'bueno',
    status: 'disponible',
    location: 'estudio',
    purchase_date: '',
    purchase_cost: '',
    currency: 'MXN',
    depreciation_method: 'ninguno',
    useful_life_years: '',
    salvage_value: '',
    warranty_expires_at: '',
    insurance_policy_number: '',
    insurance_expires_at: '',
    insurance_provider: '',
    photo_url: '',
    notes: '',
  }
}

function buildItemForm(item: EquipmentItem): ItemForm {
  return {
    name: item.name,
    brand: item.brand ?? '',
    model: item.model ?? '',
    serial_number: item.serial_number ?? '',
    category_id: item.category_id ?? '',
    condition: item.condition,
    status: item.status,
    location: item.location,
    purchase_date: item.purchase_date ?? '',
    purchase_cost: item.purchase_cost != null ? String(item.purchase_cost) : '',
    currency: item.currency ?? 'MXN',
    depreciation_method: item.depreciation_method,
    useful_life_years: item.useful_life_years != null ? String(item.useful_life_years) : '',
    salvage_value: item.salvage_value != null ? String(item.salvage_value) : '',
    warranty_expires_at: item.warranty_expires_at ?? '',
    insurance_policy_number: item.insurance_policy_number ?? '',
    insurance_expires_at: item.insurance_expires_at ?? '',
    insurance_provider: item.insurance_provider ?? '',
    photo_url: item.photo_url ?? '',
    notes: item.notes ?? '',
  }
}

async function parseApiEnvelope<T>(response: Response, fallbackMessage: string): Promise<T> {
  const payload = await response.json().catch(() => null) as ApiEnvelope<T> | null
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? fallbackMessage)
  }
  if (!payload || payload.data == null) {
    throw new Error(fallbackMessage)
  }
  return payload.data
}

export function InventoryPageClient({
  initialItems,
  categories,
  profiles,
  projects,
  initialAssignments,
  initialActivity,
  viewerRole,
}: InventoryPageClientProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQuery = parseQuery(new URLSearchParams(searchParams.toString()))

  const [items, setItems] = useState<EquipmentItem[]>(initialItems)
  const [assignments, setAssignments] = useState<AssignmentWorkspaceRow[]>(initialAssignments)
  const [activity, setActivity] = useState<EquipmentActivityLogEntry[]>(initialActivity)

  const [objective, setObjective] = useState<'catalog' | 'assignments' | 'traceability'>(initialQuery.objective ?? 'catalog')
  const [view, setView] = useState<'list' | 'cards'>(initialQuery.view ?? 'list')
  const [query, setQuery] = useState(initialQuery.q ?? '')
  const [filterStatus, setFilterStatus] = useState(initialQuery.status ?? '')
  const [filterCondition, setFilterCondition] = useState(initialQuery.condition ?? '')
  const [filterLocation, setFilterLocation] = useState(initialQuery.location ?? '')
  const [filterAssignee, setFilterAssignee] = useState(initialQuery.assignee ?? '')
  const [decommissionedFilter, setDecommissionedFilter] = useState<'all' | 'active' | 'decommissioned'>(initialQuery.decommissioned ?? 'active')

  const [selectedItemId, setSelectedItemId] = useState<string | null>(initialQuery.item ?? initialItems[0]?.id ?? null)
  const [panelOpen, setPanelOpen] = useState((initialQuery.panel ?? '1') === '1')

  const [showItemEditor, setShowItemEditor] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [itemForm, setItemForm] = useState<ItemForm>(defaultItemForm())

  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignItemId, setAssignItemId] = useState<string | null>(null)
  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm>({
    project_id: '',
    assigned_to: '',
    assigned_at: todayDate(),
    expected_return_at: '',
    condition_out: 'bueno',
    notes: '',
  })

  const [showReturnModal, setShowReturnModal] = useState(false)
  const [returnAssignment, setReturnAssignment] = useState<AssignmentWorkspaceRow | null>(null)
  const [returnForm, setReturnForm] = useState<ReturnForm>({ condition_in: 'bueno', notes: '' })

  const [decommissionTarget, setDecommissionTarget] = useState<EquipmentItem | null>(null)
  const [decommissionReason, setDecommissionReason] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<EquipmentItem | null>(null)

  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handledNewItemRef = useRef(false)

  useEffect(() => {
    if (handledNewItemRef.current) return
    if (searchParams.get('newItem') !== '1') return

    handledNewItemRef.current = true
    openCreateEditor()
  }, [searchParams])

  const openAssignmentsByEquipment = useMemo(() => {
    const map = new Map<string, AssignmentWorkspaceRow>()
    for (const assignment of assignments) {
      if (assignment.returned_at) continue
      map.set(assignment.equipment_id, assignment)
    }
    return map
  }, [assignments])

  const selectedItem = useMemo(() => {
    if (!selectedItemId) return null
    return items.find(item => item.id === selectedItemId) ?? null
  }, [items, selectedItemId])

  const selectedOpenAssignment = useMemo(() => {
    if (!selectedItem) return null
    return openAssignmentsByEquipment.get(selectedItem.id) ?? null
  }, [openAssignmentsByEquipment, selectedItem])

  const currentQueryString = useMemo(() => {
    const params = new URLSearchParams()
    if (objective !== 'catalog') params.set('objective', objective)
    if (view !== 'list') params.set('view', view)
    if (query.trim()) params.set('q', query.trim())
    if (filterStatus) params.set('status', filterStatus)
    if (filterCondition) params.set('condition', filterCondition)
    if (filterLocation) params.set('location', filterLocation)
    if (filterAssignee) params.set('assignee', filterAssignee)
    if (decommissionedFilter !== 'active') params.set('decommissioned', decommissionedFilter)
    if (selectedItemId) params.set('item', selectedItemId)
    if (!panelOpen) params.set('panel', '0')
    return params.toString()
  }, [objective, view, query, filterStatus, filterCondition, filterLocation, filterAssignee, decommissionedFilter, selectedItemId, panelOpen])

  useEffect(() => {
    const current = searchParams.toString()
    if (current === currentQueryString) return
    router.replace(currentQueryString ? `${pathname}?${currentQueryString}` : pathname, { scroll: false })
  }, [currentQueryString, pathname, router, searchParams])

  function applySavedQuery(savedQuery: string) {
    const parsed = parseQuery(new URLSearchParams(savedQuery))
    setObjective(parsed.objective ?? 'catalog')
    setView(parsed.view ?? 'list')
    setQuery(parsed.q ?? '')
    setFilterStatus(parsed.status ?? '')
    setFilterCondition(parsed.condition ?? '')
    setFilterLocation(parsed.location ?? '')
    setFilterAssignee(parsed.assignee ?? '')
    setDecommissionedFilter(parsed.decommissioned ?? 'active')
    setSelectedItemId(parsed.item ?? items[0]?.id ?? null)
    setPanelOpen((parsed.panel ?? '1') === '1')
  }

  const filteredCatalog = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return items.filter(item => {
      if (decommissionedFilter === 'active' && item.is_decommissioned) return false
      if (decommissionedFilter === 'decommissioned' && !item.is_decommissioned) return false
      if (filterStatus && item.status !== filterStatus) return false
      if (filterCondition && item.condition !== filterCondition) return false
      if (filterLocation && item.location !== filterLocation) return false

      if (filterAssignee) {
        const openAssignment = openAssignmentsByEquipment.get(item.id)
        if (!openAssignment || openAssignment.assigned_to !== filterAssignee) return false
      }

      if (!normalized) return true

      const categoryName = item.category?.name?.toLowerCase() ?? ''
      const joined = [item.name, item.asset_tag, item.brand ?? '', item.model ?? '', item.serial_number ?? '', categoryName]
        .join(' ')
        .toLowerCase()

      return joined.includes(normalized)
    })
  }, [items, query, filterStatus, filterCondition, filterLocation, filterAssignee, decommissionedFilter, openAssignmentsByEquipment])

  const filteredAssignments = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return assignments.filter(assignment => {
      if (assignment.returned_at) return false
      if (filterAssignee && assignment.assigned_to !== filterAssignee) return false
      if (filterStatus && assignment.equipment?.status !== filterStatus) return false

      if (!normalized) return true

      const assigneeName = assignment.assignee?.full_name?.toLowerCase() ?? ''
      const projectTitle = assignment.project?.title?.toLowerCase() ?? ''
      const equipmentName = assignment.equipment?.name?.toLowerCase() ?? ''
      const equipmentTag = assignment.equipment?.asset_tag?.toLowerCase() ?? ''

      return `${assigneeName} ${projectTitle} ${equipmentName} ${equipmentTag}`.includes(normalized)
    })
  }, [assignments, query, filterAssignee, filterStatus])

  const filteredActivity = useMemo(() => {
    const normalized = query.trim().toLowerCase()

    return activity.filter(entry => {
      if (selectedItemId && panelOpen && objective === 'traceability') {
        if (entry.equipment_id !== selectedItemId) return false
      }

      if (filterAssignee && entry.actor_id !== filterAssignee) return false

      if (!normalized) return true

      const eventLabel = EQUIPMENT_EVENT_LABELS[entry.event_type as keyof typeof EQUIPMENT_EVENT_LABELS] ?? entry.event_type
      const equipmentName = entry.equipment?.name ?? ''
      const actorName = entry.actor?.full_name ?? ''
      const tag = entry.equipment?.asset_tag ?? ''

      return `${eventLabel} ${equipmentName} ${actorName} ${tag}`.toLowerCase().includes(normalized)
    })
  }, [activity, query, filterAssignee, selectedItemId, panelOpen, objective])

  const counters = useMemo(() => {
    const catalogVisible = items.filter(item => !item.is_decommissioned).length
    const openAssignments = assignments.filter(assignment => !assignment.returned_at).length
    return {
      catalog: catalogVisible,
      assignments: openAssignments,
      traceability: activity.length,
    }
  }, [items, assignments, activity])

  async function refreshActivity() {
    const response = await fetch('/api/inventory/activity?limit=120')
    const data = await parseApiEnvelope<EquipmentActivityLogEntry[]>(response, 'No se pudo actualizar la trazabilidad.')
    setActivity(data)
  }

  async function refreshItem(itemId: string) {
    const response = await fetch(`/api/inventory/items/${itemId}`)
    const item = await parseApiEnvelope<EquipmentItem>(response, 'No se pudo recargar el equipo.')
    setItems(prev => prev.map(candidate => candidate.id === itemId ? item : candidate))
  }

  async function refreshAssignmentsForItem(itemId: string) {
    const response = await fetch(`/api/inventory/items/${itemId}/assignments`)
    const data = await parseApiEnvelope<AssignmentWorkspaceRow[]>(response, 'No se pudo recargar asignaciones.')
    setAssignments(prev => {
      const withoutItem = prev.filter(entry => entry.equipment_id !== itemId)
      const nextOpen = data.filter(entry => !entry.returned_at)
      return [...nextOpen, ...withoutItem].sort((a, b) => b.assigned_at.localeCompare(a.assigned_at))
    })
  }

  function openCreateEditor() {
    setEditingItemId(null)
    setItemForm(defaultItemForm())
    setShowItemEditor(true)
  }

  function openEditEditor(item: EquipmentItem) {
    setEditingItemId(item.id)
    setItemForm(buildItemForm(item))
    setShowItemEditor(true)
  }

  const selectClass = 'h-9 rounded-lg border border-brand-stone bg-white px-3 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-gold/40'
  const inputClass = 'w-full rounded-lg border border-brand-stone px-3 py-2 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-gold/40'

  async function handleSaveItem(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setActionError(null)
    setActionSuccess(null)

    try {
      const payload = {
        ...itemForm,
        category_id: itemForm.category_id || null,
        purchase_date: itemForm.purchase_date || null,
        purchase_cost: itemForm.purchase_cost ? Number(itemForm.purchase_cost) : null,
        useful_life_years: itemForm.useful_life_years ? Number(itemForm.useful_life_years) : null,
        salvage_value: itemForm.salvage_value ? Number(itemForm.salvage_value) : null,
        warranty_expires_at: itemForm.warranty_expires_at || null,
        insurance_policy_number: itemForm.insurance_policy_number || null,
        insurance_expires_at: itemForm.insurance_expires_at || null,
        insurance_provider: itemForm.insurance_provider || null,
        photo_url: itemForm.photo_url || null,
        notes: itemForm.notes || null,
      }

      const endpoint = editingItemId ? `/api/inventory/items/${editingItemId}` : '/api/inventory/items'
      const method = editingItemId ? 'PATCH' : 'POST'
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const saved = await parseApiEnvelope<EquipmentItem>(response, 'No se pudo guardar el equipo.')

      setItems(prev => {
        if (editingItemId) {
          return prev.map(item => item.id === editingItemId ? saved : item)
        }
        return [saved, ...prev]
      })

      setSelectedItemId(saved.id)
      setPanelOpen(true)
      setShowItemEditor(false)
      setActionSuccess(editingItemId ? 'Equipo actualizado correctamente.' : 'Equipo creado correctamente.')
      await refreshActivity()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo guardar el equipo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateAssignment(event: React.FormEvent) {
    event.preventDefault()
    if (!assignItemId) return

    setSaving(true)
    setActionError(null)
    setActionSuccess(null)

    try {
      const response = await fetch(`/api/inventory/items/${assignItemId}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...assignmentForm,
          project_id: assignmentForm.project_id || null,
          expected_return_at: assignmentForm.expected_return_at || null,
          notes: assignmentForm.notes || null,
        }),
      })

      await parseApiEnvelope<AssignmentWorkspaceRow>(response, 'No se pudo registrar la salida.')

      await Promise.all([
        refreshItem(assignItemId),
        refreshAssignmentsForItem(assignItemId),
        refreshActivity(),
      ])

      setShowAssignModal(false)
      setAssignItemId(null)
      setAssignmentForm({
        project_id: '',
        assigned_to: '',
        assigned_at: todayDate(),
        expected_return_at: '',
        condition_out: 'bueno',
        notes: '',
      })
      setActionSuccess('Salida registrada correctamente.')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo registrar la salida.')
    } finally {
      setSaving(false)
    }
  }

  async function handleReturnAssignment(event: React.FormEvent) {
    event.preventDefault()
    if (!returnAssignment) return

    setSaving(true)
    setActionError(null)
    setActionSuccess(null)

    try {
      const response = await fetch(`/api/inventory/items/${returnAssignment.equipment_id}/assignments/${returnAssignment.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...returnForm,
          notes: returnForm.notes || null,
        }),
      })

      await parseApiEnvelope(response, 'No se pudo registrar la devolucion.')

      await Promise.all([
        refreshItem(returnAssignment.equipment_id),
        refreshAssignmentsForItem(returnAssignment.equipment_id),
        refreshActivity(),
      ])

      setShowReturnModal(false)
      setReturnAssignment(null)
      setReturnForm({ condition_in: 'bueno', notes: '' })
      setActionSuccess('Devolucion registrada correctamente.')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo registrar la devolucion.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDecommission() {
    if (!decommissionTarget) return

    setSaving(true)
    setActionError(null)
    setActionSuccess(null)

    try {
      const response = await fetch(`/api/inventory/items/${decommissionTarget.id}/decommission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: decommissionReason || null }),
      })

      const updated = await parseApiEnvelope<EquipmentItem>(response, 'No se pudo dar de baja el equipo.')
      setItems(prev => prev.map(item => item.id === updated.id ? updated : item))
      setAssignments(prev => prev.filter(assignment => assignment.equipment_id !== updated.id))
      setDecommissionTarget(null)
      setDecommissionReason('')
      setActionSuccess('Equipo dado de baja correctamente.')
      await refreshActivity()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo dar de baja el equipo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleReactivate(item: EquipmentItem) {
    setSaving(true)
    setActionError(null)
    setActionSuccess(null)

    try {
      const response = await fetch(`/api/inventory/items/${item.id}/reactivate`, { method: 'POST' })
      const updated = await parseApiEnvelope<EquipmentItem>(response, 'No se pudo reactivar el equipo.')
      setItems(prev => prev.map(candidate => candidate.id === updated.id ? updated : candidate))
      setActionSuccess('Equipo reactivado correctamente.')
      await refreshActivity()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo reactivar el equipo.')
    } finally {
      setSaving(false)
    }
  }

  async function handleHardDelete(typedText: string) {
    if (!deleteTarget) return

    setSaving(true)
    setActionError(null)
    setActionSuccess(null)

    try {
      const response = await fetch(`/api/inventory/items/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationText: typedText }),
      })

      await parseApiEnvelope(response, 'No se pudo eliminar el equipo.')

      setItems(prev => prev.filter(item => item.id !== deleteTarget.id))
      setAssignments(prev => prev.filter(assignment => assignment.equipment_id !== deleteTarget.id))
      setActivity(prev => prev.filter(entry => entry.equipment_id !== deleteTarget.id))

      if (selectedItemId === deleteTarget.id) {
        setSelectedItemId(items.find(item => item.id !== deleteTarget.id)?.id ?? null)
      }

      setDeleteTarget(null)
      setActionSuccess('Equipo eliminado permanentemente.')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo eliminar el equipo.')
    } finally {
      setSaving(false)
    }
  }

  function selectItem(itemId: string) {
    setSelectedItemId(itemId)
    setPanelOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-brand-stone bg-white text-xs">
            {([
              { id: 'catalog', label: 'Catalogo', icon: ClipboardList, count: counters.catalog },
              { id: 'assignments', label: 'Asignaciones', icon: ShieldAlert, count: counters.assignments },
              { id: 'traceability', label: 'Trazabilidad', icon: History, count: counters.traceability },
            ] as const).map(tab => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setObjective(tab.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-2 font-medium transition-colors',
                    objective === tab.id ? 'bg-brand-navy text-white' : 'text-brand-navy hover:bg-brand-canvas',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', objective === tab.id ? 'bg-white/20' : 'bg-brand-paper')}>{tab.count}</span>
                </button>
              )
            })}
          </div>

          <div className="inline-flex overflow-hidden rounded-lg border border-brand-stone bg-white text-xs">
            <button
              type="button"
              onClick={() => setView('list')}
              className={cn('inline-flex items-center gap-1.5 px-3 py-2 font-medium transition-colors', view === 'list' ? 'bg-brand-navy text-white' : 'text-brand-navy hover:bg-brand-canvas')}
            >
              <LayoutList className="h-3.5 w-3.5" /> Lista
            </button>
            <button
              type="button"
              onClick={() => setView('cards')}
              className={cn('inline-flex items-center gap-1.5 px-3 py-2 font-medium transition-colors', view === 'cards' ? 'bg-brand-navy text-white' : 'text-brand-navy hover:bg-brand-canvas')}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Tarjetas
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPanelOpen(prev => !prev)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-stone bg-white px-3 py-2 text-xs font-semibold text-brand-navy hover:bg-brand-canvas"
          >
            {panelOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
            {panelOpen ? 'Ocultar panel' : 'Mostrar panel'}
          </button>
          <button
            type="button"
            onClick={openCreateEditor}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white hover:bg-brand-navy-light"
          >
            <Plus className="h-4 w-4" /> Crear equipo
          </button>
        </div>
      </div>

      <SavedViewsBar
        module="inventory"
        currentQuery={currentQueryString}
        onApplyQuery={applySavedQuery}
      />
      <SectionCard
        title="Filtros de inventario"
        subtitle="Comparte el estado del workspace por URL y conserva contexto al recargar."
        actions={<Filter className="h-4 w-4 text-gray-400" />}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="xl:col-span-2">
            <span className="mb-1 block text-xs font-semibold text-gray-500">Buscar</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                id="inventory-workspace-search"
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Nombre, codigo o serie"
                className="h-9 w-full rounded-lg border border-brand-stone bg-white pl-9 pr-3 text-sm text-brand-navy focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              />
            </div>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold text-gray-500">Estado</span>
            <select value={filterStatus} onChange={event => setFilterStatus(event.target.value)} className={selectClass}>
              <option value="">Todos</option>
              {(Object.keys(STATUS_CONFIG) as EquipmentStatus[]).map(status => (
                <option key={status} value={status}>{STATUS_CONFIG[status].label}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold text-gray-500">Condicion</span>
            <select value={filterCondition} onChange={event => setFilterCondition(event.target.value)} className={selectClass}>
              <option value="">Todas</option>
              {(Object.keys(CONDITION_CONFIG) as EquipmentCondition[]).map(condition => (
                <option key={condition} value={condition}>{CONDITION_CONFIG[condition].label}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold text-gray-500">Ubicacion</span>
            <select value={filterLocation} onChange={event => setFilterLocation(event.target.value)} className={selectClass}>
              <option value="">Todas</option>
              {(Object.keys(LOCATION_LABELS) as EquipmentLocation[]).map(location => (
                <option key={location} value={location}>{LOCATION_LABELS[location]}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold text-gray-500">Responsable</span>
            <select value={filterAssignee} onChange={event => setFilterAssignee(event.target.value)} className={selectClass}>
              <option value="">Todos</option>
              {profiles.map(profile => (
                <option key={profile.id} value={profile.id}>{profile.full_name ?? profile.email ?? profile.id}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1 block text-xs font-semibold text-gray-500">Baja</span>
            <select value={decommissionedFilter} onChange={event => setDecommissionedFilter(event.target.value as 'all' | 'active' | 'decommissioned')} className={selectClass}>
              <option value="active">Solo activos</option>
              <option value="decommissioned">Solo dados de baja</option>
              <option value="all">Todos</option>
            </select>
          </label>
        </div>
      </SectionCard>

      {actionError && <InlineAlert variant="error" description={actionError} />}
      {actionSuccess && <InlineAlert variant="success" description={actionSuccess} />}

      <div className={cn('grid gap-4', panelOpen && selectedItem ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : '')}>
        <div className="space-y-3">
          {objective === 'catalog' && (
            <>
              {filteredCatalog.length === 0 ? (
                <EmptyState
                  title="No hay equipos visibles"
                  description="Ajusta filtros o crea un equipo nuevo para comenzar a operar el inventario."
                />
              ) : view === 'cards' ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredCatalog.map(item => {
                    const status = STATUS_CONFIG[item.status]
                    const condition = CONDITION_CONFIG[item.condition]
                    const activeAssignment = openAssignmentsByEquipment.get(item.id)

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectItem(item.id)}
                        className={cn(
                          'rounded-xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md',
                          selectedItemId === item.id ? 'border-brand-navy/50 ring-2 ring-brand-navy/15' : 'border-brand-stone/80',
                        )}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="rounded bg-brand-navy px-2 py-0.5 font-mono text-[10px] text-white">{item.asset_tag}</span>
                          {item.is_decommissioned && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-700">Baja</span>}
                        </div>
                        <p className="text-sm font-semibold text-brand-navy">{item.name}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{[item.brand, item.model].filter(Boolean).join(' | ') || item.category?.name || 'Sin categoria'}</p>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', status.badge)}>
                            <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
                            {status.label}
                          </span>
                          <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium', condition.badge)}>
                            {condition.label}
                          </span>
                        </div>

                        <p className="mt-3 text-xs text-gray-500">{LOCATION_LABELS[item.location]}</p>
                        <p className="text-xs text-gray-500">{activeAssignment ? `En uso por ${activeAssignment.assignee?.full_name ?? 'Sin responsable'}` : 'Disponible para salida'}</p>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-brand-stone/80 bg-white shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-brand-stone/70 bg-brand-canvas text-xs font-semibold uppercase tracking-[0.06em] text-gray-500">
                        <th className="px-4 py-3 text-left">Codigo</th>
                        <th className="px-4 py-3 text-left">Equipo</th>
                        <th className="px-4 py-3 text-left">Estado</th>
                        <th className="px-4 py-3 text-left">Condicion</th>
                        <th className="px-4 py-3 text-left">Ubicacion</th>
                        <th className="px-4 py-3 text-left">Responsable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-stone/60">
                      {filteredCatalog.map(item => {
                        const assignment = openAssignmentsByEquipment.get(item.id)
                        return (
                          <tr
                            key={item.id}
                            className={cn('cursor-pointer hover:bg-brand-paper/60', selectedItemId === item.id && 'bg-brand-paper/70')}
                            onClick={() => selectItem(item.id)}
                          >
                            <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.asset_tag}</td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-brand-navy">{item.name}</p>
                              <p className="text-xs text-gray-500">{item.category?.name ?? 'Sin categoria'}</p>
                              {item.is_decommissioned && <p className="text-xs font-medium text-red-600">Dado de baja</p>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_CONFIG[item.status].badge)}>
                                <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_CONFIG[item.status].dot)} />
                                {STATUS_CONFIG[item.status].label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium', CONDITION_CONFIG[item.condition].badge)}>
                                {CONDITION_CONFIG[item.condition].label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-600">{LOCATION_LABELS[item.location]}</td>
                            <td className="px-4 py-3 text-gray-600">{assignment?.assignee?.full_name ?? '-'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {objective === 'assignments' && (
            <>
              {filteredAssignments.length === 0 ? (
                <EmptyState
                  title="No hay asignaciones abiertas"
                  description="Las salidas activas apareceran aqui para registrar devoluciones rapidamente."
                />
              ) : (
                <div className="overflow-hidden rounded-xl border border-brand-stone/80 bg-white shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-brand-stone/70 bg-brand-canvas text-xs font-semibold uppercase tracking-[0.06em] text-gray-500">
                        <th className="px-4 py-3 text-left">Equipo</th>
                        <th className="px-4 py-3 text-left">Responsable</th>
                        <th className="px-4 py-3 text-left">Proyecto</th>
                        <th className="px-4 py-3 text-left">Salida</th>
                        <th className="px-4 py-3 text-left">Retorno estimado</th>
                        <th className="px-4 py-3 text-right">Accion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-stone/60">
                      {filteredAssignments.map(assignment => (
                        <tr key={assignment.id} className="hover:bg-brand-paper/60">
                          <td className="px-4 py-3">
                            <button type="button" onClick={() => assignment.equipment_id && selectItem(assignment.equipment_id)} className="text-left">
                              <p className="font-medium text-brand-navy">{assignment.equipment?.name ?? 'Equipo'}</p>
                              <p className="font-mono text-xs text-gray-500">{assignment.equipment?.asset_tag ?? '-'}</p>
                            </button>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{assignment.assignee?.full_name ?? 'Sin responsable'}</td>
                          <td className="px-4 py-3 text-gray-600">{assignment.project?.title ?? 'Sin proyecto'}</td>
                          <td className="px-4 py-3 text-gray-600">{toDateLabel(assignment.assigned_at)}</td>
                          <td className="px-4 py-3 text-gray-600">{toDateLabel(assignment.expected_return_at)}</td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setReturnAssignment(assignment)
                                setReturnForm({ condition_in: assignment.condition_out ?? 'bueno', notes: '' })
                                setShowReturnModal(true)
                              }}
                              className="rounded-md border border-brand-stone bg-white px-3 py-1.5 text-xs font-semibold text-brand-navy hover:bg-brand-canvas"
                            >
                              Registrar devolucion
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {objective === 'traceability' && (
            <>
              {filteredActivity.length === 0 ? (
                <EmptyState
                  title="Sin eventos para esta busqueda"
                  description="Ajusta filtros o ejecuta acciones sobre equipos para generar trazabilidad."
                />
              ) : (
                <div className="space-y-2">
                  {filteredActivity.map(entry => {
                    const label = EQUIPMENT_EVENT_LABELS[entry.event_type as keyof typeof EQUIPMENT_EVENT_LABELS] ?? entry.event_type
                    return (
                      <article key={entry.id} className="rounded-xl border border-brand-stone/80 bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-brand-navy">{label}</p>
                            <p className="text-xs text-gray-500">
                              {entry.equipment?.name ?? 'Equipo'} {entry.equipment?.asset_tag ? `(${entry.equipment.asset_tag})` : ''}
                            </p>
                          </div>
                          <div className="text-right text-xs text-gray-500">
                            <p>{entry.actor?.full_name ?? 'Sistema'}</p>
                            <p>{toDateTimeLabel(entry.created_at)}</p>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {panelOpen && selectedItem && (
          <aside className="hidden xl:block">
            <SectionCard
              title={selectedItem.name}
              subtitle={`${selectedItem.asset_tag} · ${selectedItem.category?.name ?? 'Sin categoria'}`}
              actions={
                <button type="button" onClick={() => openEditEditor(selectedItem)} className="rounded-md border border-brand-stone bg-white px-2 py-1 text-[11px] font-semibold text-brand-navy hover:bg-brand-canvas">
                  Editar
                </button>
              }
            >
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_CONFIG[selectedItem.status].badge)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_CONFIG[selectedItem.status].dot)} />
                    {STATUS_CONFIG[selectedItem.status].label}
                  </span>
                  <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium', CONDITION_CONFIG[selectedItem.condition].badge)}>
                    {CONDITION_CONFIG[selectedItem.condition].label}
                  </span>
                  {selectedItem.is_decommissioned && (
                    <span className="inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-700">Dado de baja</span>
                  )}
                </div>

                <dl className="space-y-1 text-xs text-gray-600">
                  <div className="flex justify-between gap-2"><dt>Ubicacion</dt><dd>{LOCATION_LABELS[selectedItem.location]}</dd></div>
                  <div className="flex justify-between gap-2"><dt>Serie</dt><dd>{selectedItem.serial_number ?? '-'}</dd></div>
                  <div className="flex justify-between gap-2"><dt>Marca/Modelo</dt><dd>{[selectedItem.brand, selectedItem.model].filter(Boolean).join(' | ') || '-'}</dd></div>
                  <div className="flex justify-between gap-2"><dt>Ultima actualizacion</dt><dd>{toDateTimeLabel(selectedItem.updated_at)}</dd></div>
                </dl>

                {selectedItem.is_decommissioned && (
                  <InlineAlert
                    variant="warning"
                    title="Equipo dado de baja"
                    description={`Motivo: ${selectedItem.decommission_reason ?? 'Sin motivo capturado'} · Fecha: ${toDateLabel(selectedItem.decommissioned_at)}`}
                  />
                )}

                <div className="space-y-2 border-t border-brand-stone/70 pt-3">
                  {!selectedItem.is_decommissioned && !selectedOpenAssignment && (
                    <button
                      type="button"
                      onClick={() => {
                        setAssignItemId(selectedItem.id)
                        setAssignmentForm({
                          project_id: '',
                          assigned_to: '',
                          assigned_at: todayDate(),
                          expected_return_at: '',
                          condition_out: selectedItem.condition,
                          notes: '',
                        })
                        setShowAssignModal(true)
                      }}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white hover:bg-brand-navy-light"
                    >
                      Registrar salida
                    </button>
                  )}

                  {selectedOpenAssignment && (
                    <>
                      <InlineAlert
                        variant="info"
                        title="Asignacion activa"
                        description={`Responsable: ${selectedOpenAssignment.assignee?.full_name ?? 'Sin responsable'} · Salida: ${toDateLabel(selectedOpenAssignment.assigned_at)}`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setReturnAssignment(selectedOpenAssignment)
                          setReturnForm({ condition_in: selectedOpenAssignment.condition_out ?? selectedItem.condition, notes: '' })
                          setShowReturnModal(true)
                        }}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand-navy px-3 py-2 text-xs font-semibold text-brand-navy hover:bg-brand-canvas"
                      >
                        Registrar devolucion
                      </button>
                    </>
                  )}

                  <Link
                    href={`/inventory/${selectedItem.id}`}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand-stone bg-white px-3 py-2 text-xs font-semibold text-brand-navy hover:bg-brand-canvas"
                  >
                    <Wrench className="h-3.5 w-3.5" /> Abrir detalle tecnico
                  </Link>

                  {viewerRole === 'admin' && (
                    <>
                      {!selectedItem.is_decommissioned ? (
                        <button
                          type="button"
                          onClick={() => {
                            setDecommissionTarget(selectedItem)
                            setDecommissionReason('')
                          }}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                        >
                          <ArchiveX className="h-3.5 w-3.5" /> Dar de baja
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleReactivate(selectedItem)}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                        >
                          <ArchiveRestore className="h-3.5 w-3.5" /> Reactivar
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(selectedItem)}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Eliminar permanentemente
                      </button>
                    </>
                  )}
                </div>
              </div>
            </SectionCard>
          </aside>
        )}
      </div>

      {panelOpen && selectedItem && (
        <div className="fixed inset-0 z-40 xl:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setPanelOpen(false)}
            aria-label="Cerrar panel de detalle"
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-brand-stone bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500">Detalle</p>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="rounded-md border border-brand-stone bg-white px-2 py-1 text-xs text-brand-navy"
              >
                Cerrar
              </button>
            </div>

            <SectionCard
              title={selectedItem.name}
              subtitle={`${selectedItem.asset_tag} · ${selectedItem.category?.name ?? 'Sin categoria'}`}
              actions={
                <button type="button" onClick={() => openEditEditor(selectedItem)} className="rounded-md border border-brand-stone bg-white px-2 py-1 text-[11px] font-semibold text-brand-navy hover:bg-brand-canvas">
                  Editar
                </button>
              }
            >
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', STATUS_CONFIG[selectedItem.status].badge)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_CONFIG[selectedItem.status].dot)} />
                    {STATUS_CONFIG[selectedItem.status].label}
                  </span>
                  <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium', CONDITION_CONFIG[selectedItem.condition].badge)}>
                    {CONDITION_CONFIG[selectedItem.condition].label}
                  </span>
                  {selectedItem.is_decommissioned && (
                    <span className="inline-flex rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-700">Dado de baja</span>
                  )}
                </div>

                <dl className="space-y-1 text-xs text-gray-600">
                  <div className="flex justify-between gap-2"><dt>Ubicacion</dt><dd>{LOCATION_LABELS[selectedItem.location]}</dd></div>
                  <div className="flex justify-between gap-2"><dt>Serie</dt><dd>{selectedItem.serial_number ?? '-'}</dd></div>
                  <div className="flex justify-between gap-2"><dt>Marca/Modelo</dt><dd>{[selectedItem.brand, selectedItem.model].filter(Boolean).join(' | ') || '-'}</dd></div>
                  <div className="flex justify-between gap-2"><dt>Ultima actualizacion</dt><dd>{toDateTimeLabel(selectedItem.updated_at)}</dd></div>
                </dl>

                {selectedItem.is_decommissioned && (
                  <InlineAlert
                    variant="warning"
                    title="Equipo dado de baja"
                    description={`Motivo: ${selectedItem.decommission_reason ?? 'Sin motivo capturado'} · Fecha: ${toDateLabel(selectedItem.decommissioned_at)}`}
                  />
                )}

                <div className="space-y-2 border-t border-brand-stone/70 pt-3">
                  {!selectedItem.is_decommissioned && !selectedOpenAssignment && (
                    <button
                      type="button"
                      onClick={() => {
                        setAssignItemId(selectedItem.id)
                        setAssignmentForm({
                          project_id: '',
                          assigned_to: '',
                          assigned_at: todayDate(),
                          expected_return_at: '',
                          condition_out: selectedItem.condition,
                          notes: '',
                        })
                        setShowAssignModal(true)
                      }}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white hover:bg-brand-navy-light"
                    >
                      Registrar salida
                    </button>
                  )}

                  {selectedOpenAssignment && (
                    <>
                      <InlineAlert
                        variant="info"
                        title="Asignacion activa"
                        description={`Responsable: ${selectedOpenAssignment.assignee?.full_name ?? 'Sin responsable'} · Salida: ${toDateLabel(selectedOpenAssignment.assigned_at)}`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setReturnAssignment(selectedOpenAssignment)
                          setReturnForm({ condition_in: selectedOpenAssignment.condition_out ?? selectedItem.condition, notes: '' })
                          setShowReturnModal(true)
                        }}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand-navy px-3 py-2 text-xs font-semibold text-brand-navy hover:bg-brand-canvas"
                      >
                        Registrar devolucion
                      </button>
                    </>
                  )}

                  <Link
                    href={`/inventory/${selectedItem.id}`}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand-stone bg-white px-3 py-2 text-xs font-semibold text-brand-navy hover:bg-brand-canvas"
                  >
                    <Wrench className="h-3.5 w-3.5" /> Abrir detalle tecnico
                  </Link>

                  {viewerRole === 'admin' && (
                    <>
                      {!selectedItem.is_decommissioned ? (
                        <button
                          type="button"
                          onClick={() => {
                            setDecommissionTarget(selectedItem)
                            setDecommissionReason('')
                          }}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
                        >
                          <ArchiveX className="h-3.5 w-3.5" /> Dar de baja
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleReactivate(selectedItem)}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                        >
                          <ArchiveRestore className="h-3.5 w-3.5" /> Reactivar
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setDeleteTarget(selectedItem)}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Eliminar permanentemente
                      </button>
                    </>
                  )}
                </div>
              </div>
            </SectionCard>
          </aside>
        </div>
      )}

      {showItemEditor && (
        <div className="fixed inset-0 z-50">
          <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setShowItemEditor(false)} />
          <aside className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l border-brand-stone bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-brand-navy">{editingItemId ? 'Editar equipo' : 'Crear equipo'}</h2>
              <button type="button" onClick={() => setShowItemEditor(false)} className="rounded-md border border-brand-stone px-2 py-1 text-xs">Cerrar</button>
            </div>
            <form onSubmit={handleSaveItem} className="space-y-3">
              <label><span className="mb-1 block text-xs font-semibold text-gray-500">Nombre *</span><input required value={itemForm.name} onChange={event => setItemForm(prev => ({ ...prev, name: event.target.value }))} className={inputClass} /></label>
              <div className="grid grid-cols-2 gap-3">
                <label><span className="mb-1 block text-xs font-semibold text-gray-500">Categoria</span><select value={itemForm.category_id} onChange={event => setItemForm(prev => ({ ...prev, category_id: event.target.value }))} className={inputClass}><option value="">Sin categoria</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                <label><span className="mb-1 block text-xs font-semibold text-gray-500">Numero serie</span><input value={itemForm.serial_number} onChange={event => setItemForm(prev => ({ ...prev, serial_number: event.target.value }))} className={inputClass} /></label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label><span className="mb-1 block text-xs font-semibold text-gray-500">Estado</span><select value={itemForm.status} onChange={event => setItemForm(prev => ({ ...prev, status: event.target.value as EquipmentStatus }))} className={inputClass}>{(Object.keys(STATUS_CONFIG) as EquipmentStatus[]).map(status => <option key={status} value={status}>{STATUS_CONFIG[status].label}</option>)}</select></label>
                <label><span className="mb-1 block text-xs font-semibold text-gray-500">Condicion</span><select value={itemForm.condition} onChange={event => setItemForm(prev => ({ ...prev, condition: event.target.value as EquipmentCondition }))} className={inputClass}>{(Object.keys(CONDITION_CONFIG) as EquipmentCondition[]).map(condition => <option key={condition} value={condition}>{CONDITION_CONFIG[condition].label}</option>)}</select></label>
                <label><span className="mb-1 block text-xs font-semibold text-gray-500">Ubicacion</span><select value={itemForm.location} onChange={event => setItemForm(prev => ({ ...prev, location: event.target.value as EquipmentLocation }))} className={inputClass}>{(Object.keys(LOCATION_LABELS) as EquipmentLocation[]).map(location => <option key={location} value={location}>{LOCATION_LABELS[location]}</option>)}</select></label>
              </div>
              <label><span className="mb-1 block text-xs font-semibold text-gray-500">Notas</span><textarea rows={3} value={itemForm.notes} onChange={event => setItemForm(prev => ({ ...prev, notes: event.target.value }))} className={inputClass} /></label>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowItemEditor(false)} className="rounded-lg border border-brand-stone px-4 py-2 text-sm text-brand-navy">Cancelar</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Guardando...' : editingItemId ? 'Guardar cambios' : 'Crear equipo'}</button>
              </div>
            </form>
          </aside>
        </div>
      )}

      {showAssignModal && assignItemId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-brand-stone bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand-navy">Registrar salida</h3>
              <button type="button" onClick={() => setShowAssignModal(false)} className="rounded border border-brand-stone px-2 py-1 text-xs">Cerrar</button>
            </div>
            <form onSubmit={handleCreateAssignment} className="space-y-3">
              <label>
                <span className="mb-1 block text-xs font-semibold text-gray-500">Proyecto (opcional)</span>
                <select
                  value={assignmentForm.project_id}
                  onChange={event => setAssignmentForm(prev => ({ ...prev, project_id: event.target.value }))}
                  className={inputClass}
                >
                  <option value="">Sin proyecto</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>{project.title}</option>
                  ))}
                </select>
              </label>
              <label><span className="mb-1 block text-xs font-semibold text-gray-500">Responsable *</span><select required value={assignmentForm.assigned_to} onChange={event => setAssignmentForm(prev => ({ ...prev, assigned_to: event.target.value }))} className={inputClass}><option value="">Selecciona responsable</option>{profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.full_name ?? profile.email ?? profile.id}</option>)}</select></label>
              <div className="grid grid-cols-2 gap-3">
                <label><span className="mb-1 block text-xs font-semibold text-gray-500">Fecha salida *</span><input type="date" required value={assignmentForm.assigned_at} onChange={event => setAssignmentForm(prev => ({ ...prev, assigned_at: event.target.value }))} className={inputClass} /></label>
                <label><span className="mb-1 block text-xs font-semibold text-gray-500">Retorno estimado</span><input type="date" value={assignmentForm.expected_return_at} onChange={event => setAssignmentForm(prev => ({ ...prev, expected_return_at: event.target.value }))} className={inputClass} /></label>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowAssignModal(false)} className="rounded-lg border border-brand-stone px-3 py-2 text-xs text-brand-navy">Cancelar</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Registrar salida</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReturnModal && returnAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-brand-stone bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-brand-navy">Registrar devolucion</h3>
              <button type="button" onClick={() => setShowReturnModal(false)} className="rounded border border-brand-stone px-2 py-1 text-xs">Cerrar</button>
            </div>
            <form onSubmit={handleReturnAssignment} className="space-y-3">
              <label><span className="mb-1 block text-xs font-semibold text-gray-500">Condicion regreso</span><select value={returnForm.condition_in} onChange={event => setReturnForm(prev => ({ ...prev, condition_in: event.target.value as EquipmentCondition }))} className={inputClass}>{(Object.keys(CONDITION_CONFIG) as EquipmentCondition[]).map(condition => <option key={condition} value={condition}>{CONDITION_CONFIG[condition].label}</option>)}</select></label>
              <label><span className="mb-1 block text-xs font-semibold text-gray-500">Notas</span><textarea rows={2} value={returnForm.notes} onChange={event => setReturnForm(prev => ({ ...prev, notes: event.target.value }))} className={inputClass} /></label>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowReturnModal(false)} className="rounded-lg border border-brand-stone px-3 py-2 text-xs text-brand-navy">Cancelar</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-brand-navy px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Registrar devolucion</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {decommissionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-brand-stone bg-white p-5 shadow-xl">
            <h3 className="text-sm font-semibold text-brand-navy">Dar de baja equipo</h3>
            <p className="mt-1 text-xs text-gray-500">Este equipo pasara a estado retirado y quedara fuera de nuevas asignaciones.</p>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-semibold text-gray-500">Motivo de baja</span>
              <textarea rows={3} value={decommissionReason} onChange={event => setDecommissionReason(event.target.value)} className={inputClass} placeholder="Ej. Equipo obsoleto" />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDecommissionTarget(null)} className="rounded-lg border border-brand-stone px-3 py-2 text-xs text-brand-navy">Cancelar</button>
              <button type="button" onClick={handleDecommission} disabled={saving} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">Confirmar baja</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        title="Eliminar equipo permanentemente"
        description="Solo se permite cuando no tiene historial operativo relevante. Esta accion no se puede deshacer."
        confirmLabel="Eliminar permanentemente"
        confirmVariant="danger"
        requireText="ELIMINAR"
        requireTextLabel="Escribe ELIMINAR para confirmar"
        requireTextPlaceholder="ELIMINAR"
        loading={saving}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleHardDelete}
      />
    </div>
  )
}
