'use client'

import { ErrorState } from '@/components/ui/ErrorState'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="No pudimos cargar proyectos"
      description="Intenta nuevamente. Si el problema continua, valida permisos o filtros."
      actionLabel="Recargar proyectos"
      onAction={reset}
    />
  )
}
