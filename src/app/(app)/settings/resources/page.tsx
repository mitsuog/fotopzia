import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/layout/PageHeader'
import { ResourcesPageClient } from '@/components/settings/ResourcesPageClient'
import type { StudioResource } from '@/types/inventory'

export const dynamic = 'force-dynamic'

export default async function ResourcesSettingsPage() {
  const supabase = await createClient()

  const [{ data: resources }, { data: equipmentItems }] = await Promise.all([
    supabase
      .from('resources')
      .select('*, equipment_item:equipment_items(id, name, status, condition, is_decommissioned)')
      .order('type')
      .order('name'),
    supabase
      .from('equipment_items')
      .select('id, name, asset_tag, status, is_decommissioned')
      .eq('is_decommissioned', false)
      .neq('status', 'retirado')
      .order('name'),
  ])

  return (
    <div>
      <PageHeader
        title="Recursos del Estudio"
        subtitle="Estudios, equipos y personal disponibles para asignar a sesiones"
        badge="Configuracion"
      />
      <ResourcesPageClient
        initialResources={(resources ?? []) as unknown as StudioResource[]}
        equipmentItems={(equipmentItems ?? []) as { id: string; name: string; asset_tag: string; status: string }[]}
      />
    </div>
  )
}
