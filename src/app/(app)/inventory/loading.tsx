import { LoadingState } from '@/components/ui/LoadingState'

export default function Loading() {
  return (
    <LoadingState
      title="Cargando inventario..."
      description="Estamos preparando catalogo, asignaciones y trazabilidad de equipo."
    />
  )
}
