import { createClient } from '@/lib/supabase/server'
import { InventoryPageClient } from '@/components/inventory/InventoryPageClient'
import type { EquipmentItem, EquipmentCategory } from '@/types/inventory'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any

export default async function InventoryPage() {
  const supabase = await createClient()
  const db = supabase as AnyTable

  const [itemsRes, categoriesRes] = await Promise.all([
    db.from('equipment_items').select('*, category:equipment_categories(*)').order('created_at', { ascending: false }),
    db.from('equipment_categories').select('*').order('sort_order'),
  ])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-brand-navy">Inventario de Equipos</h1>
        <p className="text-sm text-gray-400">Activos del estudio</p>
      </div>
      <InventoryPageClient
        initialItems={(itemsRes.data ?? []) as EquipmentItem[]}
        categories={(categoriesRes.data ?? []) as EquipmentCategory[]}
      />
    </div>
  )
}
