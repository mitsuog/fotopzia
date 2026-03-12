'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { LostDetails } from '@/types/crm'

const schema = z.object({
  lost_reason: z.enum(['precio', 'competencia', 'sin_presupuesto', 'sin_respuesta', 'otro']),
  lost_stage: z.enum(['lead', 'prospect', 'proposal']),
  lost_notes: z.string().optional(),
})

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

interface LostReasonDialogProps {
  open: boolean
  onConfirm: (details: LostDetails) => void
  onCancel: () => void
}

export function LostReasonDialog({ open, onConfirm, onCancel }: LostReasonDialogProps) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { lost_reason: 'precio', lost_stage: 'prospect' },
  })

  if (!open) return null

  function onSubmit(data: FormOutput) {
    onConfirm({ lost_reason: data.lost_reason, lost_stage: data.lost_stage, lost_notes: data.lost_notes })
    reset()
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50" onClick={onCancel} />
      <div className="fixed left-1/2 top-1/2 z-[60] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-brand-stone bg-white p-6 shadow-2xl">
        <h2 className="mb-1 text-base font-semibold text-brand-navy">Registrar pérdida</h2>
        <p className="mb-4 text-xs text-gray-500">Indica el motivo por el que se perdió este deal.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Motivo *</label>
            <select
              {...register('lost_reason')}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            >
              <option value="precio">Precio</option>
              <option value="competencia">Competencia</option>
              <option value="sin_presupuesto">Sin presupuesto</option>
              <option value="sin_respuesta">Sin respuesta</option>
              <option value="otro">Otro</option>
            </select>
            {errors.lost_reason && <p className="mt-1 text-xs text-red-500">{errors.lost_reason.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Etapa donde se perdió *</label>
            <select
              {...register('lost_stage')}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            >
              <option value="lead">Lead</option>
              <option value="prospect">Prospecto</option>
              <option value="proposal">Propuesta</option>
            </select>
            {errors.lost_stage && <p className="mt-1 text-xs text-red-500">{errors.lost_stage.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notas adicionales</label>
            <textarea
              {...register('lost_notes')}
              rows={3}
              placeholder="Contexto adicional (opcional)..."
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              Registrar pérdida
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
