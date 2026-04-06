'use client'

import { ErrorState } from '@/components/ui/ErrorState'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      title="No pudimos cargar cotizaciones"
      description="Intenta nuevamente. Si el problema continua, revisa tu acceso al modulo de ventas."
      actionLabel="Recargar cotizaciones"
      onAction={reset}
    />
  )
}
