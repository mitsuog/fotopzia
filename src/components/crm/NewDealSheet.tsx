'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useContacts } from '@/hooks/useContacts'
import { useCreateDeal } from '@/hooks/useDeals'
import type { DealStage } from '@/types/crm'

const STAGE_OPTIONS: { value: DealStage; label: string }[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'prospect', label: 'Prospecto' },
  { value: 'qualified', label: 'Calificado' },
  { value: 'proposal', label: 'Propuesta' },
  { value: 'negotiation', label: 'Negociacion' },
  { value: 'won', label: 'Ganado' },
  { value: 'lost', label: 'Perdido' },
]

const schema = z.object({
  contact_id: z.string().min(1, 'Selecciona un contacto'),
  title: z.string().min(1, 'El titulo es requerido'),
  stage: z.enum(['lead', 'prospect', 'qualified', 'proposal', 'negotiation', 'won', 'lost'] as const),
  value: z.preprocess(value => (value === '' || value == null ? undefined : Number(value)), z.number().positive().optional()),
  currency: z.string().default('MXN'),
  expected_close: z.string().optional(),
  notes: z.string().optional(),
})

type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

interface NewDealSheetProps {
  open: boolean
  defaultStage: DealStage
  onClose: () => void
}

export function NewDealSheet({ open, defaultStage, onClose }: NewDealSheetProps) {
  const { data: contacts = [] } = useContacts()
  const createDeal = useCreateDeal()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
    defaultValues: { stage: defaultStage, currency: 'MXN' },
  })

  async function onSubmit(data: FormOutput) {
    await createDeal.mutateAsync({
      contact_id: data.contact_id,
      title: data.title,
      stage: data.stage,
      value: data.value,
      currency: data.currency || 'MXN',
      expected_close: data.expected_close || undefined,
      notes: data.notes || undefined,
    })
    reset()
    onClose()
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-brand-stone">
          <h2 className="text-lg font-semibold text-brand-navy">Nuevo Deal</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contacto *</label>
            <select
              {...register('contact_id')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            >
              <option value="">Seleccionar contacto...</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                  {c.company_name ? ` - ${c.company_name}` : ''}
                </option>
              ))}
            </select>
            {errors.contact_id && <p className="text-xs text-red-500 mt-1">{errors.contact_id.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titulo del deal *</label>
            <input
              {...register('title')}
              type="text"
              placeholder="Ej: Boda Martinez - Foto + Video"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            />
            {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Etapa</label>
            <select
              {...register('stage')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            >
              {STAGE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
              <input
                {...register('value')}
                type="number"
                step="0.01"
                placeholder="0.00"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              />
            </div>
            <div className="w-20">
              <label className="block text-sm font-medium text-gray-700 mb-1">Moneda</label>
              <input
                {...register('currency')}
                type="text"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha esperada de cierre</label>
            <input
              {...register('expected_close')}
              type="date"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              {...register('notes')}
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-brand-navy text-white py-2.5 rounded-lg text-sm font-medium hover:bg-brand-navy-light transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Creando...' : 'Crear Deal'}
          </button>
        </form>
      </div>
    </>
  )
}
