import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { EquipmentDetailClient } from '@/components/inventory/EquipmentDetailClient'
import type { EquipmentItem, EquipmentAssignment, EquipmentMaintenance } from '@/types/inventory'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any

export default async function EquipmentDetailPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params
  const supabase = await createClient()
  const db = supabase as AnyTable

  const [itemRes, assignmentsRes, maintenanceRes, projectsRes] = await Promise.all([
    db.from('equipment_items').select('*, category:equipment_categories(*)').eq('id', itemId).single(),
    db.from('equipment_assignments').select('*, project:projects(id,title)').eq('equipment_id', itemId).order('assigned_at', { ascending: false }),
    db.from('equipment_maintenance').select('*').eq('equipment_id', itemId).order('performed_at', { ascending: false }),
    supabase.from('projects').select('id, title').order('title'),
  ])

  if (itemRes.error || !itemRes.data) notFound()

  return (
    <div className="space-y-5">
      <div>
        <Link href="/inventory" className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-brand-navy transition-colors">
          <ChevronLeft className="h-3.5 w-3.5" /> Inventario
        </Link>
      </div>
      <EquipmentDetailClient
        item={itemRes.data as EquipmentItem}
        initialAssignments={(assignmentsRes.data ?? []) as EquipmentAssignment[]}
        initialMaintenance={(maintenanceRes.data ?? []) as EquipmentMaintenance[]}
        projects={(projectsRes.data ?? []) as unknown as { id: string; title: string }[]}
      />
    </div>
  )
}
