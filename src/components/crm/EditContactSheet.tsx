'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X } from 'lucide-react'
import { useUpdateContact } from '@/hooks/useContacts'
import type { Contact } from '@/types/crm'

const SOURCE_OPTIONS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'referral', label: 'Referido' },
  { value: 'website', label: 'Sitio web' },
  { value: 'cold', label: 'Prospeccion fria' },
  { value: 'event', label: 'Evento' },
]

const schema = z.object({
  first_name: z.string().min(1, 'El nombre es requerido'),
  last_name: z.string().min(1, 'El apellido es requerido'),
  email: z.string().email('Email invalido').optional().or(z.literal('')),
  phone: z.string().optional(),
  company_name: z.string().optional(),
  source: z.string().optional(),
  tags: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface EditContactSheetProps {
  open: boolean
  contact: Contact
  onClose: () => void
  onUpdated: (contact: Contact) => void
}

export function EditContactSheet({ open, contact, onClose, onUpdated }: EditContactSheetProps) {
  const updateContact = useUpdateContact()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      company_name: contact.company_name ?? '',
      source: contact.source ?? '',
      tags: (contact.tags ?? []).join(', '),
    },
  })

  useEffect(() => {
    if (!open) return
    reset({
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email ?? '',
      phone: contact.phone ?? '',
      company_name: contact.company_name ?? '',
      source: contact.source ?? '',
      tags: (contact.tags ?? []).join(', '),
    })
  }, [open, contact, reset])

  async function onSubmit(data: FormData) {
    const tags = data.tags
      ? data.tags.split(',').map(item => item.trim()).filter(Boolean)
      : []

    const updated = await updateContact.mutateAsync({
      id: contact.id,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email || undefined,
      phone: data.phone || undefined,
      company_name: data.company_name || undefined,
      source: data.source || undefined,
      tags,
    })

    onUpdated(updated)
    onClose()
  }

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-brand-stone px-6 py-4">
          <h2 className="text-lg font-semibold text-brand-navy">Editar contacto</h2>
          <button onClick={onClose} className="rounded p-1 hover:bg-gray-100" aria-label="Cerrar editor">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 space-y-4 overflow-y-auto p-6">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">Nombre *</label>
              <input
                {...register('first_name')}
                type="text"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              />
              {errors.first_name && <p className="mt-1 text-xs text-red-500">{errors.first_name.message}</p>}
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">Apellido *</label>
              <input
                {...register('last_name')}
                type="text"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              />
              {errors.last_name && <p className="mt-1 text-xs text-red-500">{errors.last_name.message}</p>}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              {...register('email')}
              type="email"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            />
            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Telefono</label>
            <input
              {...register('phone')}
              type="tel"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Empresa</label>
            <input
              {...register('company_name')}
              type="text"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Fuente</label>
            <select
              {...register('source')}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            >
              <option value="">Seleccionar fuente...</option>
              {SOURCE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Etiquetas
              <span className="ml-1 font-normal text-gray-400">(separadas por coma)</span>
            </label>
            <input
              {...register('tags')}
              type="text"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-brand-navy py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-navy-light disabled:opacity-50"
          >
            {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    </>
  )
}
