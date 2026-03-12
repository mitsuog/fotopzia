'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray, useWatch, FormProvider } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, ChevronDown, ChevronUp, Settings, CheckCircle2, Printer, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { LineItemRow } from './LineItemRow'
import { QuoteTotals } from './QuoteTotals'
import { useActiveServices } from '@/hooks/useServiceCatalog'
import { cn } from '@/lib/utils'
import type { Contact } from '@/types/crm'

const lineItemSchema = z.object({
  description: z.string().min(1, 'Descripcion requerida'),
  quantity: z.coerce.number().positive(),
  unit_price: z.coerce.number().min(0),
  discount_pct: z.coerce.number().min(0).max(100).default(0),
  category: z.string().optional(),
})

const quoteSchema = z
  .object({
    contact_id: z.string().min(1, 'Selecciona un contacto'),
    deal_id: z.string().optional(),
    title: z.string().min(1, 'El titulo es requerido'),
    valid_until: z.string().optional(),
    notes: z.string().optional(),
    internal_notes: z.string().optional(),
    tax_rate: z.coerce.number().default(16),
    currency: z.string().default('MXN'),
    client_entity_type: z.enum(['persona_fisica', 'persona_moral']),
    client_legal_name: z.string().min(1, 'El nombre legal del cliente es requerido'),
    client_representative_name: z.string().optional(),
    client_representative_role: z.string().optional(),
    client_legal_address: z.string().min(1, 'El domicilio legal es requerido'),
    service_type: z.string().min(1, 'El tipo de servicio es requerido'),
    service_description: z.string().min(1, 'La descripcion del servicio es requerida'),
    service_date: z.string().optional(),
    service_location: z.string().min(1, 'La ubicacion del servicio es requerida'),
    line_items: z.array(lineItemSchema).min(1, 'Agrega al menos un concepto'),
  })
  .superRefine((value, ctx) => {
    if (value.client_entity_type === 'persona_moral') {
      if (!value.client_representative_name?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['client_representative_name'],
          message: 'El representante legal es obligatorio para persona moral',
        })
      }
      if (!value.client_representative_role?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['client_representative_role'],
          message: 'El cargo del representante es obligatorio para persona moral',
        })
      }
    }
  })

type QuoteFormInput = z.input<typeof quoteSchema>
type QuoteFormOutput = z.output<typeof quoteSchema>

interface DealSummary {
  id: string
  title: string
  contact_id: string
}

interface QuoteEditorProps {
  contacts: Contact[]
  deals: DealSummary[]
  defaultContactId?: string
  defaultDealId?: string
}

export function QuoteEditor({ contacts, deals, defaultContactId, defaultDealId }: QuoteEditorProps) {
  const router = useRouter()
  const { data: quickServices = [], isLoading: servicesLoading } = useActiveServices()
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showQuickServices, setShowQuickServices] = useState(false)
  const [savedQuote, setSavedQuote] = useState<{ id: string; folio: string; title: string } | null>(null)

  const methods = useForm<QuoteFormInput, unknown, QuoteFormOutput>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      contact_id: defaultContactId ?? '',
      deal_id: defaultDealId ?? '',
      title: 'Cotizacion de servicios Fotopzia',
      valid_until: '',
      notes: '',
      internal_notes: '',
      tax_rate: 16,
      currency: 'MXN',
      client_entity_type: 'persona_fisica',
      client_legal_name: '',
      client_representative_name: '',
      client_representative_role: '',
      client_legal_address: '',
      service_type: '',
      service_description: '',
      service_date: '',
      service_location: '',
      line_items: [{ description: '', quantity: 1, unit_price: 0, discount_pct: 0, category: '' }],
    },
  })

  const {
    register,
    control,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = methods
  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' })

  const selectedContactId = useWatch({ control, name: 'contact_id' })
  const entityType = useWatch({ control, name: 'client_entity_type' })
  const lineItems = useWatch({ control, name: 'line_items' })
  const taxRate = useWatch({ control, name: 'tax_rate' }) ?? 16

  const filteredDeals = useMemo(
    () => deals.filter(d => !selectedContactId || d.contact_id === selectedContactId),
    [deals, selectedContactId],
  )

  useEffect(() => {
    const currentDealId = getValues('deal_id')
    if (currentDealId) {
      const deal = deals.find(d => d.id === currentDealId)
      if (deal && selectedContactId && deal.contact_id !== selectedContactId) {
        setValue('deal_id', '')
      }
    }

    if (!selectedContactId) return
    const selectedContact = contacts.find(contact => contact.id === selectedContactId)
    if (!selectedContact) return

    const fullName = `${selectedContact.first_name} ${selectedContact.last_name}`.trim()
    const contactEntityType = selectedContact.legal_entity_type === 'persona_moral' ? 'persona_moral' : 'persona_fisica'
    const isMoral = contactEntityType === 'persona_moral'

    setValue('client_entity_type', contactEntityType)
    setValue(
      'client_legal_name',
      selectedContact.legal_name?.trim()
        || (isMoral ? (selectedContact.company_name ?? fullName) : fullName),
    )

    if (!isMoral) {
      setValue('client_representative_name', selectedContact.legal_representative_name?.trim() || fullName)
      setValue('client_representative_role', '')
    } else {
      setValue(
        'client_representative_name',
        selectedContact.legal_representative_name?.trim()
          || getValues('client_representative_name')
          || fullName,
      )
      setValue(
        'client_representative_role',
        selectedContact.legal_representative_role?.trim()
          || getValues('client_representative_role')
          || '',
      )
    }
    setValue('client_legal_address', selectedContact.legal_address?.trim() || getValues('client_legal_address') || '')
  }, [selectedContactId, contacts, deals, getValues, setValue])

  const subtotal = (lineItems ?? []).reduce((acc, item) => {
    const q = Number(item?.quantity ?? 0)
    const p = Number(item?.unit_price ?? 0)
    const d = Number(item?.discount_pct ?? 0)
    return acc + q * p * (1 - d / 100)
  }, 0)
  const taxAmount = subtotal * (Number(taxRate) / 100)
  const total = subtotal + taxAmount

  function addQuickService(svc: { description: string; unit_price: number; category: string | null }) {
    append({
      description: svc.description,
      quantity: 1,
      unit_price: svc.unit_price,
      discount_pct: 0,
      category: svc.category ?? '',
    })
  }

  async function onSubmit(formData: QuoteFormOutput) {
    setSaving(true)
    setErrorMsg(null)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const normalizedRepresentativeName =
        formData.client_entity_type === 'persona_moral'
          ? (formData.client_representative_name?.trim() || null)
          : formData.client_legal_name.trim()

      const normalizedRepresentativeRole =
        formData.client_entity_type === 'persona_moral'
          ? (formData.client_representative_role?.trim() || null)
          : null

      const { data: newQuote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          contact_id: formData.contact_id,
          deal_id: formData.deal_id || null,
          title: formData.title,
          status: 'draft',
          subtotal,
          tax_rate: Number(formData.tax_rate),
          tax_amount: taxAmount,
          total,
          currency: formData.currency,
          valid_until: formData.valid_until || null,
          notes: formData.notes || null,
          internal_notes: formData.internal_notes || null,
          created_by: user.id,
          client_entity_type: formData.client_entity_type,
          client_legal_name: formData.client_legal_name.trim(),
          client_representative_name: normalizedRepresentativeName,
          client_representative_role: normalizedRepresentativeRole,
          client_legal_address: formData.client_legal_address.trim(),
          service_type: formData.service_type.trim(),
          service_description: formData.service_description.trim(),
          service_date: formData.service_date || null,
          service_location: formData.service_location.trim(),
        })
        .select()
        .single()

      if (quoteError || !newQuote) throw new Error(quoteError?.message ?? 'Error creando cotizacion')

      const { error: itemsError } = await supabase.from('quote_line_items').insert(
        formData.line_items.map((item, idx) => ({
          quote_id: newQuote.id,
          sort_order: idx,
          description: item.description,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          discount_pct: Number(item.discount_pct ?? 0),
          total: Number(item.quantity) * Number(item.unit_price) * (1 - Number(item.discount_pct ?? 0) / 100),
          category: item.category || null,
        })),
      )

      if (itemsError) throw new Error(itemsError.message)

      const record = newQuote as Record<string, unknown>
      const quoteFolio = (record.quote_number as string) ?? newQuote.id.slice(0, 8).toUpperCase()
      const formattedTotal = Number(total).toLocaleString('es-MX', {
        style: 'currency',
        currency: formData.currency,
      })

      const { error: activityError } = await supabase.from('activities').insert({
        type: 'stage_change',
        contact_id: formData.contact_id,
        deal_id: formData.deal_id || null,
        subject: 'Cotizacion elaborada',
        body: `Se creo la cotizacion "${formData.title}" (folio ${quoteFolio}) por ${formattedTotal}.`,
        created_by: user.id,
      })

      if (activityError) {
        console.error('[quotes] No se pudo registrar actividad de creacion:', activityError.message)
      }

      setSavedQuote({
        id: newQuote.id,
        folio: quoteFolio,
        title: formData.title,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setErrorMsg(
        msg.toLowerCase().includes('row-level security')
          ? 'Sin permisos para crear cotizaciones. Contacta al administrador.'
          : msg,
      )
      setSaving(false)
      return
    }

    setSaving(false)
  }

  if (savedQuote) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-8 py-16 text-center">
        <CheckCircle2 className="h-14 w-14 text-emerald-500" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Cotizacion creada</p>
          <p className="mt-1 text-2xl font-bold text-brand-navy">{savedQuote.title}</p>
          <p className="mt-1 text-sm text-gray-500">
            Folio: <span className="font-mono font-semibold text-brand-navy">{savedQuote.folio}</span>
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => window.open(`/quotes/${savedQuote.id}/print`, '_blank')}
            className="inline-flex items-center gap-2 rounded-lg border border-brand-stone bg-white px-4 py-2 text-sm font-medium text-brand-navy hover:bg-brand-canvas transition-colors"
          >
            <Printer className="h-4 w-4" />
            Imprimir / PDF
          </button>
          <button
            type="button"
            onClick={() => router.push(`/quotes/${savedQuote.id}`)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-navy px-5 py-2 text-sm font-medium text-white hover:bg-brand-navy-light transition-colors"
          >
            Ver cotizacion
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="rounded-xl border border-brand-stone bg-brand-paper p-5">
          <h2 className="mb-4 text-sm font-semibold text-brand-navy">Informacion general</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-brand-navy">
                Contacto <span className="text-red-500">*</span>
              </label>
              <select
                {...register('contact_id')}
                className="w-full rounded-lg border border-brand-stone bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              >
                <option value="">Seleccionar contacto...</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                    {c.company_name ? ` - ${c.company_name}` : ''}
                  </option>
                ))}
              </select>
              {errors.contact_id && <p className="mt-1 text-xs text-red-500">{errors.contact_id.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-brand-navy">
                Deal asociado <span className="ml-1 font-normal text-gray-400">(opcional)</span>
              </label>
              <select
                {...register('deal_id')}
                className="w-full rounded-lg border border-brand-stone bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              >
                <option value="">Sin deal asociado</option>
                {filteredDeals.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-brand-navy">
                Titulo <span className="text-red-500">*</span>
              </label>
              <input
                {...register('title')}
                type="text"
                className="w-full rounded-lg border border-brand-stone bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              />
              {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-brand-navy">Valida hasta</label>
              <input
                {...register('valid_until')}
                type="date"
                className="w-full rounded-lg border border-brand-stone bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-semibold text-brand-navy">Moneda</label>
                <select
                  {...register('currency')}
                  className="w-full rounded-lg border border-brand-stone bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                >
                  <option value="MXN">MXN - Peso Mexicano</option>
                  <option value="USD">USD - Dolar Americano</option>
                </select>
              </div>
              <div className="w-28">
                <label className="mb-1 block text-xs font-semibold text-brand-navy">IVA %</label>
                <input
                  {...register('tax_rate')}
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  className="w-full rounded-lg border border-brand-stone bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-brand-stone bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-brand-navy">Datos legales del cliente (para contrato)</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Tipo de cliente</label>
              <select
                {...register('client_entity_type')}
                className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm"
              >
                <option value="persona_fisica">Persona fisica</option>
                <option value="persona_moral">Persona moral</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Nombre legal cliente</label>
              <input
                {...register('client_legal_name')}
                className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm"
              />
              {errors.client_legal_name && <p className="mt-1 text-xs text-red-500">{errors.client_legal_name.message}</p>}
            </div>

            {entityType === 'persona_moral' && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Representante legal</label>
                  <input
                    {...register('client_representative_name')}
                    className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm"
                  />
                  {errors.client_representative_name && (
                    <p className="mt-1 text-xs text-red-500">{errors.client_representative_name.message}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Cargo representante</label>
                  <input
                    {...register('client_representative_role')}
                    className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm"
                  />
                  {errors.client_representative_role && (
                    <p className="mt-1 text-xs text-red-500">{errors.client_representative_role.message}</p>
                  )}
                </div>
              </>
            )}

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Domicilio legal cliente</label>
              <input
                {...register('client_legal_address')}
                className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm"
              />
              {errors.client_legal_address && (
                <p className="mt-1 text-xs text-red-500">{errors.client_legal_address.message}</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-brand-stone bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-brand-navy">Datos del servicio (para contrato)</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Tipo de servicio</label>
              <input
                {...register('service_type')}
                className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm"
              />
              {errors.service_type && <p className="mt-1 text-xs text-red-500">{errors.service_type.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Fecha del servicio</label>
              <input
                {...register('service_date')}
                type="date"
                className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Ubicacion del servicio</label>
              <input
                {...register('service_location')}
                className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm"
              />
              {errors.service_location && (
                <p className="mt-1 text-xs text-red-500">{errors.service_location.message}</p>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Descripcion del servicio</label>
              <textarea
                {...register('service_description')}
                rows={3}
                className="w-full rounded-lg border border-brand-stone px-3 py-2 text-sm leading-6"
              />
              {errors.service_description && (
                <p className="mt-1 text-xs text-red-500">{errors.service_description.message}</p>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-brand-stone bg-brand-paper">
          <div className="flex items-center justify-between border-b border-brand-stone bg-brand-canvas px-4 py-3">
            <h2 className="text-sm font-semibold text-brand-navy">Conceptos</h2>
            <button
              type="button"
              onClick={() => append({ description: '', quantity: 1, unit_price: 0, discount_pct: 0, category: '' })}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-navy hover:text-brand-gold transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar linea
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-brand-stone/60 text-xs text-gray-500">
                  <th className="px-3 py-2 text-left font-medium">Descripcion</th>
                  <th className="px-3 py-2 text-right font-medium w-20">Cant.</th>
                  <th className="px-3 py-2 text-right font-medium w-32">Precio unit.</th>
                  <th className="px-3 py-2 text-right font-medium w-20">Desc. %</th>
                  <th className="px-3 py-2 text-right font-medium w-28">Total</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {fields.map((field, idx) => (
                  <LineItemRow key={field.id} index={idx} onRemove={() => remove(idx)} />
                ))}
                {fields.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-xs italic text-gray-400">
                      Sin conceptos - agrega una linea o usa Servicios rapidos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {errors.line_items && typeof errors.line_items.message === 'string' && (
            <p className="px-4 pb-2 text-xs text-red-500">{errors.line_items.message}</p>
          )}

          <div className="border-t border-brand-stone/50 px-4 py-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowQuickServices(v => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-brand-navy transition-colors"
              >
                {showQuickServices ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                Servicios rapidos
                {quickServices.length > 0 && <span className="text-gray-400">({quickServices.length})</span>}
              </button>
              <Link
                href="/settings/catalogo"
                target="_blank"
                className="inline-flex items-center gap-1 text-[10px] text-gray-400 hover:text-brand-navy transition-colors"
                title="Gestionar catalogo"
              >
                <Settings className="h-3 w-3" /> Gestionar
              </Link>
            </div>
            {showQuickServices && (
              <div className="mt-3">
                {servicesLoading ? (
                  <div className="flex gap-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-7 w-24 animate-pulse rounded-full bg-brand-stone/30" />
                    ))}
                  </div>
                ) : quickServices.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">
                    Sin servicios configurados.{' '}
                    <Link href="/settings/catalogo" target="_blank" className="underline hover:text-brand-navy">
                      Agrega servicios desde el catalogo
                    </Link>
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {quickServices.map(svc => (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => addQuickService(svc)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border border-brand-stone bg-white px-3 py-1.5',
                          'text-xs font-medium text-brand-navy transition-colors hover:border-brand-gold hover:bg-brand-canvas',
                        )}
                      >
                        <span>{svc.icon}</span>
                        <span>{svc.label}</span>
                        <span className="text-gray-400">
                          ${Number(svc.unit_price).toLocaleString('es-MX', { maximumFractionDigits: 0 })}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end border-t border-brand-stone px-4 py-4">
            <QuoteTotals subtotal={subtotal} taxRate={Number(taxRate)} taxAmount={taxAmount} total={total} />
          </div>
        </div>

        <div className="rounded-xl border border-brand-stone bg-brand-paper p-5">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-brand-navy">
                Notas para el cliente <span className="font-normal text-gray-400">(aparecen en el PDF)</span>
              </label>
              <textarea
                {...register('notes')}
                rows={3}
                className="w-full resize-none rounded-lg border border-brand-stone bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-brand-navy">
                Notas internas <span className="font-normal text-gray-400">(solo equipo)</span>
              </label>
              <textarea
                {...register('internal_notes')}
                rows={2}
                className="w-full resize-none rounded-lg border border-brand-stone bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              />
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{errorMsg}</div>
        )}

        {Object.keys(errors).length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <p className="font-semibold">Revisa los campos requeridos:</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
              {errors.contact_id && <li>{errors.contact_id.message}</li>}
              {errors.title && <li>{errors.title.message}</li>}
              {errors.client_legal_name && <li>{errors.client_legal_name.message}</li>}
              {errors.client_representative_name && <li>{errors.client_representative_name.message}</li>}
              {errors.client_representative_role && <li>{errors.client_representative_role.message}</li>}
              {errors.client_legal_address && <li>{errors.client_legal_address.message}</li>}
              {errors.service_type && <li>{errors.service_type.message}</li>}
              {errors.service_description && <li>{errors.service_description.message}</li>}
              {errors.service_location && <li>{errors.service_location.message}</li>}
              {errors.line_items?.message && <li>{errors.line_items.message as string}</li>}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg border border-brand-stone px-4 py-2 text-sm text-brand-navy hover:bg-brand-canvas transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-navy px-6 py-2 text-sm font-medium text-white hover:bg-brand-navy-light transition-colors disabled:opacity-60"
          >
            {saving ? 'Guardando...' : 'Crear cotizacion'}
          </button>
        </div>
      </form>
    </FormProvider>
  )
}
