'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import { useCreateContact } from '@/hooks/useContacts'

const SOURCE_OPTIONS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'referral', label: 'Referido' },
  { value: 'website', label: 'Sitio web' },
  { value: 'cold', label: 'Prospección fría' },
  { value: 'event', label: 'Evento' },
]

const schema = z.object({
  first_name: z.string().min(1, 'El nombre es requerido'),
  last_name: z.string().min(1, 'El apellido es requerido'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  company_name: z.string().optional(),
  source: z.string().optional(),
  tags: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface NewContactSheetProps {
  open: boolean
  onClose: () => void
}

export function NewContactSheet({ open, onClose }: NewContactSheetProps) {
  const createContact = useCreateContact()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {},
  })

  async function onSubmit(data: FormData) {
    const tags = data.tags
      ? data.tags.split(',').map(t => t.trim()).filter(Boolean)
      : []

    await createContact.mutateAsync({
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email || undefined,
      phone: data.phone || undefined,
      company_name: data.company_name || undefined,
      source: data.source || undefined,
      tags,
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
          <h2 className="text-lg font-semibold text-brand-navy">Nuevo Contacto</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                {...register('first_name')}
                type="text"
                placeholder="Juan"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              />
              {errors.first_name && <p className="text-xs text-red-500 mt-1">{errors.first_name.message}</p>}
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Apellido *</label>
              <input
                {...register('last_name')}
                type="text"
                placeholder="García"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              />
              {errors.last_name && <p className="text-xs text-red-500 mt-1">{errors.last_name.message}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              {...register('email')}
              type="email"
              placeholder="juan@ejemplo.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
            <input
              {...register('phone')}
              type="tel"
              placeholder="+52 55 1234 5678"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
            <input
              {...register('company_name')}
              type="text"
              placeholder="Nombre de la empresa"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fuente</label>
            <select
              {...register('source')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            >
              <option value="">Seleccionar fuente...</option>
              {SOURCE_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Etiquetas
              <span className="text-gray-400 font-normal ml-1">(separadas por coma)</span>
            </label>
            <input
              {...register('tags')}
              type="text"
              placeholder="boda, quinceañera, corporativo"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-brand-navy text-white py-2.5 rounded-lg text-sm font-medium hover:bg-brand-navy-light transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Guardando...' : 'Crear Contacto'}
          </button>
        </form>
      </div>
    </>
  )
}
