'use client'

interface PrintToolbarProps {
  contractNumber: string
}

export function PrintToolbar({ contractNumber }: PrintToolbarProps) {
  return (
    <div className="no-print toolbar">
      <span>Contrato {contractNumber}</span>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn-print" onClick={() => window.print()}>
          Imprimir / Guardar PDF
        </button>
        <button className="btn-close" onClick={() => window.close()}>
          Cerrar
        </button>
      </div>
    </div>
  )
}
