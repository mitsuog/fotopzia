'use client'

import { ErrorState } from '@/components/ui/ErrorState'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="No pudimos cargar finanzas"
      description="Intenta nuevamente. Si el problema continua, revisa permisos financieros."
      actionLabel="Recargar finanzas"
      onAction={reset}
    />
  )
}
