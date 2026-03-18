import { createClient } from '@/lib/supabase/server'
import { InventoryCategoriesClient } from '@/components/inventory/InventoryCategoriesClient'
import type { EquipmentCategory } from '@/types/inventory'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyTable = any

export default async function InventoryCategoriesPage() {
  const supabase = await createClient()
  const db = supabase as AnyTable

  const { data: categories } = await db.from('equipment_categories').select('*').order('sort_order')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-brand-navy">Categorías de Equipo</h1>
        <p className="text-sm text-gray-400">Organiza tu inventario por tipo de equipo</p>
      </div>
      <InventoryCategoriesClient initialCategories={(categories ?? []) as EquipmentCategory[]} />
    </div>
  )
}
