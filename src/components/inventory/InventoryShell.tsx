'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Layers, Package, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { InventoryPageClient } from './InventoryPageClient'
import { InventoryCategoriesClient } from './InventoryCategoriesClient'
import { ResourcesPageClient } from '@/components/settings/ResourcesPageClient'
import type {
  EquipmentActivityLogEntry,
  EquipmentCategory,
  EquipmentCondition,
  EquipmentItem,
  StudioResource,
} from '@/types/inventory'

type Section = 'equipos' | 'categorias' | 'recursos'

type ProfileOption = { id: string; full_name: string | null; email: string | null; role: string | null }
type ProjectOption = { id: string; title: string }
type AssignmentRow = {
  id: string
  equipment_id: string
  calendar_event_id: string | null
  project_id: string | null
  assigned_to: string | null
  returned_at: string | null
  assigned_at: string
  expected_return_at: string | null
  condition_out: EquipmentCondition | null
  condition_in: EquipmentCondition | null
  notes: string | null
  created_by: string | null
  created_at: string
  equipment: { id: string; name: string; asset_tag: string; status: string; is_decommissioned?: boolean | null } | null
  project: { id: string; title: string } | null
  assignee: { id: string; full_name: string | null } | null
}
type EquipmentItemOption = { id: string; name: string; asset_tag: string; status: string }

interface InventoryShellProps {
  initialItems: EquipmentItem[]
  categories: EquipmentCategory[]
  profiles: ProfileOption[]
  projects: ProjectOption[]
  initialAssignments: AssignmentRow[]
  initialActivity: EquipmentActivityLogEntry[]
  viewerRole: string | null
  initialResources: StudioResource[]
  equipmentItemOptions: EquipmentItemOption[]
}

const TABS = [
  { id: 'equipos', label: 'Equipos', icon: Package },
  { id: 'categorias', label: 'Categorías', icon: Tag },
  { id: 'recursos', label: 'Recursos', icon: Layers },
] as const

export function InventoryShell({
  initialItems,
  categories,
  profiles,
  projects,
  initialAssignments,
  initialActivity,
  viewerRole,
  initialResources,
  equipmentItemOptions,
}: InventoryShellProps) {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const rawSeccion = params.get('seccion')
  const seccion: Section =
    rawSeccion === 'categorias' || rawSeccion === 'recursos' ? rawSeccion : 'equipos'

  function setSeccion(s: Section) {
    const next = new URLSearchParams()
    next.set('seccion', s)
    router.replace(`${pathname}?${next.toString()}`)
  }

  return (
    <div className="space-y-4">
      <div className="inline-flex overflow-hidden rounded-lg border border-brand-stone bg-white text-xs">
        {TABS.map(tab => {
          const Icon = tab.icon
          const active = seccion === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSeccion(tab.id)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 font-medium transition-colors',
                active ? 'bg-brand-navy text-white' : 'text-brand-navy hover:bg-brand-canvas',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {seccion === 'equipos' && (
        <InventoryPageClient
          initialItems={initialItems}
          categories={categories}
          profiles={profiles}
          projects={projects}
          initialAssignments={initialAssignments}
          initialActivity={initialActivity}
          viewerRole={viewerRole}
        />
      )}

      {seccion === 'categorias' && (
        <InventoryCategoriesClient initialCategories={categories} />
      )}

      {seccion === 'recursos' && (
        <ResourcesPageClient
          initialResources={initialResources}
          equipmentItems={equipmentItemOptions}
        />
      )}
    </div>
  )
}
