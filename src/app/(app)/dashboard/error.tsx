'use client'

import { ErrorState } from '@/components/ui/ErrorState'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="No pudimos cargar el dashboard"
      description="Intenta nuevamente. Si el problema continua, revisa conexion o permisos."
      actionLabel="Recargar dashboard"
      onAction={reset}
    />
  )
}
