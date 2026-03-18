import { ReportsPageClient } from '@/components/finances/ReportsPageClient'

export const dynamic = 'force-dynamic'

export default function ReportsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-brand-navy">Reportes Financieros</h1>
        <p className="text-sm text-gray-400">Estado de resultados y análisis por proyecto</p>
      </div>
      <ReportsPageClient />
    </div>
  )
}
