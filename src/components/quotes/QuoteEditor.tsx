'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  useForm,
  useFieldArray,
  useWatch,
  FormProvider,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { LineItemRow } from './LineItemRow'
import { QuoteTotals } from './QuoteTotals'
import type { Contact, Deal } from '@/types/crm'

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------
const lineItemSchema = z.object({
  description:   z.string().min(1, 'Descripción requerida'),
  quantity:      z.coerce.number().positive('Cantidad debe ser mayor a 0'),
  unit_price:    z.coerce.number().min(0, 'Precio no puede ser negativo'),
  discount_pct:  z.coerce.number().min(0).max(100).default(0),
  category:      z.string().optional(),
})

const quoteSchema = z.object({
  contact_id:     z.string().min(1, 'Selecciona un contacto'),
  deal_id:        z.string().optional(),
  title:          z.string().min(1, 'El título es requerido'),
  valid_until:    z.string().optional(),
  notes:          z.string().optional(),
  internal_notes: z.string().optional(),
  tax_rate:       z.coerce.number().default(16),
  currency:       z.string().default('MXN'),
  line_items:     z.array(lineItemSchema).min(1, 'Agrega al menos una línea'),
})

type QuoteFormInput = z.input<typeof quoteSchema>
type QuoteFormOutput = z.output<typeof quoteSchema>

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function QuoteEditor() {
  const router = useRouter()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [deals, setDeals]       = useState<Deal[]>([])
  const [saving, setSaving]     = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const methods = useForm<QuoteFormInput, unknown, QuoteFormOutput>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      contact_id:     '',
      deal_id:        '',
      title:          '',
      valid_until:    '',
      notes:          '',
      internal_notes: '',
      tax_rate:       16,
      currency:       'MXN',
      line_items: [
        { description: '', quantity: 1, unit_price: 0, discount_pct: 0, category: '' },
      ],
    },
  })

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = methods

  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' })

  // Watch line items + tax_rate for live totals
  const lineItems = useWatch({ control, name: 'line_items' })
  const taxRate   = useWatch({ control, name: 'tax_rate' }) ?? 16

  const subtotal = (lineItems ?? []).reduce((acc, item) => {
    const q = Number(item?.quantity  ?? 0)
    const p = Number(item?.unit_price ?? 0)
    const d = Number(item?.discount_pct ?? 0)
    return acc + q * p * (1 - d / 100)
  }, 0)
  const taxAmount = subtotal * (Number(taxRate) / 100)
  const total     = subtotal + taxAmount

  // Load contacts + deals once
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('contacts')
      .select('id, first_name, last_name, company_name')
      .order('first_name')
      .then(({ data }) => setContacts((data ?? []) as Contact[]))

    supabase
      .from('deals')
      .select('id, title, contact_id')
      .order('title')
      .then(({ data }) => setDeals((data ?? []) as Deal[]))
  }, [])

  // Submit handler
  const onSubmit = async (formData: QuoteFormOutput) => {
    setSaving(true)
    setErrorMsg(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const computedSubtotal  = subtotal
      const computedTaxAmount = taxAmount
      const computedTotal     = total

      // Insert quote
      const { data: newQuote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          contact_id:     formData.contact_id,
          deal_id:        formData.deal_id || null,
          title:          formData.title,
          status:         'draft',
          subtotal:       computedSubtotal,
          tax_rate:       Number(formData.tax_rate),
          tax_amount:     computedTaxAmount,
          total:          computedTotal,
          currency:       formData.currency,
          valid_until:    formData.valid_until || null,
          notes:          formData.notes          || null,
          internal_notes: formData.internal_notes || null,
          created_by:     user.id,
        })
        .select()
        .single()

      if (quoteError || !newQuote) {
        throw new Error(quoteError?.message ?? 'Error creando cotización')
      }

      // Insert line items
      const lineItemsPayload = formData.line_items.map((item, idx) => {
        const q = Number(item.quantity)
        const p = Number(item.unit_price)
        const d = Number(item.discount_pct ?? 0)
        return {
          quote_id:     newQuote.id,
          sort_order:   idx,
          description:  item.description,
          quantity:     q,
          unit_price:   p,
          discount_pct: d,
          total:        q * p * (1 - d / 100),
          category:     item.category || null,
        }
      })

      const { error: itemsError } = await supabase
        .from('quote_line_items')
        .insert(lineItemsPayload)

      if (itemsError) throw new Error(itemsError.message)

      router.push(`/quotes/${newQuote.id}`)
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Error desconocido')
      setSaving(false)
    }
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Header fields */}
        <div className="bg-brand-paper border border-brand-stone rounded-xl p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Contact */}
          <div>
            <label className="block text-xs font-semibold text-brand-navy mb-1">
              Contacto <span className="text-red-500">*</span>
            </label>
            <select
              {...register('contact_id')}
              className="w-full border border-brand-stone rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            >
              <option value="">Seleccionar contacto…</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name}
                  {c.company_name ? ` (${c.company_name})` : ''}
                </option>
              ))}
            </select>
            {errors.contact_id && (
              <p className="text-xs text-red-500 mt-1">{errors.contact_id.message}</p>
            )}
          </div>

          {/* Deal (optional) */}
          <div>
            <label className="block text-xs font-semibold text-brand-navy mb-1">
              Negocio (opcional)
            </label>
            <select
              {...register('deal_id')}
              className="w-full border border-brand-stone rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            >
              <option value="">Sin negocio asociado</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-brand-navy mb-1">
              Título <span className="text-red-500">*</span>
            </label>
            <input
              {...register('title')}
              type="text"
              placeholder="Ej. Cobertura fotográfica boda García"
              className="w-full border border-brand-stone rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            />
            {errors.title && (
              <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>
            )}
          </div>

          {/* Valid until */}
          <div>
            <label className="block text-xs font-semibold text-brand-navy mb-1">
              Válida hasta
            </label>
            <input
              {...register('valid_until')}
              type="date"
              className="w-full border border-brand-stone rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            />
          </div>

          {/* Currency */}
          <div>
            <label className="block text-xs font-semibold text-brand-navy mb-1">
              Moneda
            </label>
            <select
              {...register('currency')}
              className="w-full border border-brand-stone rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
            >
              <option value="MXN">MXN — Peso Mexicano</option>
              <option value="USD">USD — Dólar Americano</option>
            </select>
          </div>

          {/* Notes */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-brand-navy mb-1">
              Notas para el cliente
            </label>
            <textarea
              {...register('notes')}
              rows={3}
              placeholder="Condiciones, vigencia, detalles del servicio…"
              className="w-full border border-brand-stone rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-gold/40 resize-none"
            />
          </div>

          {/* Internal notes */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-brand-navy mb-1">
              Notas internas
            </label>
            <textarea
              {...register('internal_notes')}
              rows={2}
              placeholder="Solo visible para el equipo…"
              className="w-full border border-brand-stone rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-gold/40 resize-none"
            />
          </div>
        </div>

        {/* Line items */}
        <div className="bg-brand-paper border border-brand-stone rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-stone bg-brand-canvas flex items-center justify-between">
            <h2 className="font-semibold text-brand-navy text-sm">Conceptos</h2>
            <button
              type="button"
              onClick={() =>
                append({ description: '', quantity: 1, unit_price: 0, discount_pct: 0, category: '' })
              }
              className="inline-flex items-center gap-1 text-xs text-brand-navy hover:text-brand-gold font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar línea
            </button>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b border-brand-stone/60 text-xs text-gray-500">
                <th className="text-left px-3 py-2 font-medium">Descripción</th>
                <th className="text-right px-3 py-2 font-medium w-20">Cant.</th>
                <th className="text-right px-3 py-2 font-medium w-28">Precio unit.</th>
                <th className="text-right px-3 py-2 font-medium w-20">Desc. %</th>
                <th className="text-right px-3 py-2 font-medium w-28">Total</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field, idx) => (
                <LineItemRow
                  key={field.id}
                  index={idx}
                  onRemove={() => remove(idx)}
                />
              ))}
              {fields.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-400 italic text-sm">
                    Sin conceptos — agrega una línea
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {errors.line_items && (
            <p className="text-xs text-red-500 px-4 pb-3">
              {typeof errors.line_items.message === 'string'
                ? errors.line_items.message
                : 'Verifica los conceptos'}
            </p>
          )}

          <div className="px-4 py-4 border-t border-brand-stone flex justify-end">
            <QuoteTotals
              subtotal={subtotal}
              taxRate={Number(taxRate)}
              taxAmount={taxAmount}
              total={total}
            />
          </div>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
            {errorMsg}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm border border-brand-stone rounded-lg text-brand-navy hover:bg-brand-canvas transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 text-sm bg-brand-navy text-white rounded-lg hover:bg-brand-navy-light transition-colors disabled:opacity-60"
          >
            {saving ? 'Guardando…' : 'Crear Cotización'}
          </button>
        </div>
      </form>
    </FormProvider>
  )
}
