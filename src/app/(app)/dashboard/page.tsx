import { PageHeader } from '@/components/layout/PageHeader'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createClient()

  const [{ data: profile }, { count: contactsCount }, { count: activeDealsCount }, { count: quotesCount }, { count: contractsCount }] =
    await Promise.all([
      supabase.from('profiles').select('full_name, role').single(),
      supabase.from('contacts').select('*', { count: 'exact', head: true }),
      supabase.from('deals').select('*', { count: 'exact', head: true }).not('stage', 'in', '(won,lost)'),
      supabase.from('quotes').select('*', { count: 'exact', head: true }),
      supabase.from('contracts').select('*', { count: 'exact', head: true }),
    ])

  return (
    <div>
      <PageHeader
        title="Dashboard Operativo"
        subtitle={profile ? `Bienvenido, ${profile.full_name} (${profile.role})` : 'Resumen ejecutivo del estudio'}
        badge="Overview"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Contactos', value: String(contactsCount ?? 0) },
          { label: 'Deals activos', value: String(activeDealsCount ?? 0) },
          { label: 'Cotizaciones', value: String(quotesCount ?? 0) },
          { label: 'Contratos', value: String(contractsCount ?? 0) },
        ].map(stat => (
          <div
            key={stat.label}
            className="rounded-xl border border-brand-stone/80 bg-white/80 p-5 shadow-[0_12px_26px_-20px_rgba(28,43,74,0.45)] backdrop-blur"
          >
            <p className="text-sm font-medium text-gray-500">{stat.label}</p>
            <p className="mt-1 text-3xl font-semibold text-brand-navy">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
