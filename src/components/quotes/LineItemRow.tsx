'use client'
import { useFormContext, useWatch } from 'react-hook-form'
import { Trash2 } from 'lucide-react'

interface LineItemRowProps {
  index: number
  onRemove: () => void
}

export function LineItemRow({ index, onRemove }: LineItemRowProps) {
  const { register, control, formState: { errors } } = useFormContext()
  const quantity    = useWatch({ control, name: `line_items.${index}.quantity` })    || 0
  const unit_price  = useWatch({ control, name: `line_items.${index}.unit_price` })  || 0
  const discount_pct = useWatch({ control, name: `line_items.${index}.discount_pct` }) || 0

  const total =
    Number(quantity) * Number(unit_price) * (1 - Number(discount_pct) / 100)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rowErrors = (errors.line_items as any)?.[index]
  const descError = rowErrors?.description?.message as string | undefined
  const qtyError  = rowErrors?.quantity?.message  as string | undefined

  return (
    <tr className="border-b border-gray-100">
      <td className="px-3 py-2">
        <input
          {...register(`line_items.${index}.description`)}
          type="text"
          placeholder="Descripción del servicio"
          className={`w-full text-sm border-0 focus:outline-none bg-transparent placeholder:text-gray-300 ${descError ? 'placeholder:text-red-400' : ''}`}
        />
        {descError && <p className="text-[10px] text-red-500 mt-0.5">{descError}</p>}
      </td>
      <td className="px-3 py-2 w-20">
        <input
          {...register(`line_items.${index}.quantity`, { valueAsNumber: true })}
          type="number"
          step="0.01"
          min="0"
          className={`w-full text-sm border-0 focus:outline-none bg-transparent text-right ${qtyError ? 'text-red-500' : ''}`}
        />
      </td>
      <td className="px-3 py-2 w-28">
        <input
          {...register(`line_items.${index}.unit_price`, { valueAsNumber: true })}
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          className="w-full text-sm border-0 focus:outline-none bg-transparent text-right"
        />
      </td>
      <td className="px-3 py-2 w-20">
        <input
          {...register(`line_items.${index}.discount_pct`, { valueAsNumber: true })}
          type="number"
          step="0.01"
          min="0"
          max="100"
          placeholder="0"
          className="w-full text-sm border-0 focus:outline-none bg-transparent text-right"
        />
      </td>
      <td className="px-3 py-2 w-28 text-right text-sm font-medium text-brand-navy">
        ${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
      </td>
      <td className="px-3 py-2 w-10">
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-400 hover:text-red-500 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  )
}
