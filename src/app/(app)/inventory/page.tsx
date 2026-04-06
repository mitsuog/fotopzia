import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { InventoryPageClient } from '@/components/inventory/InventoryPageClient'
import type { EquipmentItem, EquipmentCategory, EquipmentActivityLogEntry, EquipmentCondition } from '@/types/inventory'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
 type AnyTable = any

type ProfileOption = {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
}

type AssignmentWorkspaceRow = {
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

type ProjectOption = { id: string; title: string }

export default async function InventoryPage() {
  const supabase = await createClient()
  const db = supabase as AnyTable

  const { data: auth } = await supabase.auth.getUser()
  const viewerId = auth.user?.id ?? null

  const [itemsRes, categoriesRes, profilesRes, assignmentsRes, activityRes, projectsRes, viewerRes] = await Promise.all([
    db.from('equipment_items').select('*, category:equipment_categories(*)').order('created_at', { ascending: false }),
    db.from('equipment_categories').select('*').order('sort_order'),
    db.from('profiles').select('id, full_name, email, role').eq('is_active', true).order('full_name'),
    db
      .from('equipment_assignments')
      .select('id, equipment_id, calendar_event_id, project_id, assigned_to, returned_at, assigned_at, expected_return_at, condition_out, condition_in, notes, created_by, created_at, equipment:equipment_items(id,name,asset_tag,status,is_decommissioned), project:projects(id,title), assignee:profiles!assigned_to(id,full_name)')
      .is('returned_at', null)
      .order('assigned_at', { ascending: false }),
    db
      .from('equipment_activity_log')
      .select('*, equipment:equipment_items(id,name,asset_tag), actor:profiles(id,full_name,email)')
      .order('created_at', { ascending: false })
      .limit(120),
    db.from('projects').select('id, title').neq('is_archived', true).order('title'),
    viewerId ? db.from('profiles').select('role').eq('id', viewerId).single() : Promise.resolve({ data: null }),
  ])

  const viewerRole = viewerRes?.data?.role ?? null

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventario operativo"
        subtitle="Administra catalogo, asignaciones y trazabilidad del equipo con control administrativo."
        badge="Studio Ops"
      />

      <InventoryPageClient
        initialItems={(itemsRes.data ?? []) as EquipmentItem[]}
        categories={(categoriesRes.data ?? []) as EquipmentCategory[]}
        profiles={(profilesRes.data ?? []) as ProfileOption[]}
        projects={(projectsRes.data ?? []) as ProjectOption[]}
        initialAssignments={(assignmentsRes.data ?? []) as AssignmentWorkspaceRow[]}
        initialActivity={(activityRes.data ?? []) as EquipmentActivityLogEntry[]}
        viewerRole={viewerRole}
      />
    </div>
  )
}
