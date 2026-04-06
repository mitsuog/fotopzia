'use client'

import { ErrorState } from '@/components/ui/ErrorState'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="No pudimos cargar contratos"
      description="Intenta nuevamente. Si el problema continua, verifica permisos del flujo legal."
      actionLabel="Recargar contratos"
      onAction={reset}
    />
  )
}
