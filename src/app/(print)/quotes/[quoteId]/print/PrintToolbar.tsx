'use client'

interface PrintToolbarProps {
  quoteNumber: string
}

export function PrintToolbar({ quoteNumber }: PrintToolbarProps) {
  return (
    <div className="no-print toolbar">
      <div className="toolbar-left">
        <span>Cotizacion {quoteNumber}</span>
      </div>
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