'use client'

import { ErrorState } from '@/components/ui/ErrorState'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="No pudimos cargar CRM"
      description="Intenta nuevamente. Si el problema continua, revisa permisos de CRM."
      actionLabel="Recargar CRM"
      onAction={reset}
    />
  )
}
