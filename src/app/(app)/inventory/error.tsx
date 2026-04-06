'use client'

import { ErrorState } from '@/components/ui/ErrorState'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="No pudimos cargar inventario"
      description="Intenta nuevamente. Si el problema continua, valida permisos o filtros de inventario."
      actionLabel="Recargar inventario"
      onAction={reset}
    />
  )
}
