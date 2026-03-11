import { PageHeader } from '@/components/layout/PageHeader'
import { QuoteEditor } from '@/components/quotes/QuoteEditor'

export const dynamic = 'force-dynamic'

export default function NewQuotePage() {
  return (
    <div>
      <PageHeader title="Nueva Cotizacion" subtitle="Define conceptos, impuestos y condiciones comerciales" badge="Ventas" />
      <QuoteEditor />
    </div>
  )
}
