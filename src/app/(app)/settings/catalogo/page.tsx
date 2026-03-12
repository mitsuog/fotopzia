import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ServiceCatalogManager } from '@/components/settings/ServiceCatalogManager'

export const dynamic = 'force-dynamic'

export default async function ServiceCatalogPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role
  const canManage = role === 'admin' || role === 'project_manager'
  if (!canManage) redirect('/settings')

  return (
    <div className="space-y-5 pb-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-brand-navy transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Configuración
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-xs text-gray-500">Catálogo de servicios</span>
      </div>

      <div>
        <h1 className="text-xl font-bold text-brand-navy">Catálogo de Servicios</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Gestiona los servicios rápidos disponibles al crear cotizaciones. Administra íconos, descripciones, precios sugeridos y orden de aparición.
        </p>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-brand-stone/60 bg-brand-paper px-4 py-3 text-xs text-gray-600">
        <strong className="text-brand-navy">¿Cómo funciona?</strong> Los servicios activos aparecen como accesos rápidos en el editor de cotizaciones. Al hacer clic, se agrega una línea con la descripción y precio sugerido — el usuario siempre puede editarlo antes de guardar.
      </div>

      <ServiceCatalogManager />
    </div>
  )
}
