import { CrmCalendarWorkspace } from '@/components/crm-calendar/CrmCalendarWorkspace'
import { PageHeader } from '@/components/layout/PageHeader'

export const dynamic = 'force-dynamic'

export default async function CrmCalendarPage() {
  return (
    <div>
      <PageHeader
        title="Agenda CRM"
        subtitle="Planificación comercial avanzada con seguimiento de citas, recordatorios y gestión colaborativa"
        badge="CRM Calendar"
      />
      <CrmCalendarWorkspace />
    </div>
  )
}
