interface QuoteTotalsProps {
  subtotal: number
  taxRate: number
  taxAmount: number
  total: number
  currency?: string
}

export function QuoteTotals({
  subtotal,
  taxRate,
  taxAmount,
  total,
  currency = 'MXN',
}: QuoteTotalsProps) {
  const fmt = (n: number) =>
    `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${currency}`

  return (
    <div className="flex flex-col items-end gap-1 text-sm">
      <div className="flex justify-between w-48 text-gray-500">
        <span>Subtotal</span>
        <span>{fmt(subtotal)}</span>
      </div>
      <div className="flex justify-between w-48 text-gray-500">
        <span>IVA ({taxRate}%)</span>
        <span>{fmt(taxAmount)}</span>
      </div>
      <div className="flex justify-between w-48 font-bold text-brand-navy border-t border-brand-stone pt-1 mt-1">
        <span>Total</span>
        <span>{fmt(total)}</span>
      </div>
    </div>
  )
}
