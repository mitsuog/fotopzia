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

// ─── Zod schema ───────────────────────────────────────────────────────────────
const lineItemSchema = z.object({
  description:  z.string().min(1, 'Descripción requerida'),
  quantity:     z.coerce.number().positive(),
  unit_price:   z.coerce.number().min(0),
  discount_pct: z.coerce.number().min(0).max(100).default(0),
  category:     z.string().optional(),
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
  line_items:     z.array(lineItemSchema).min(1, 'Agrega al menos un concepto'),
})

type QuoteFormInput  = z.input<typeof quoteSchema>
type QuoteFormOutput = z.output<typeof quoteSchema>

interface DealSummary { id: string; title: string; contact_id: string }

interface QuoteEditorProps {
  contacts: Contact[]
  deals: DealSummary[]
  defaultContactId?: string
  defaultDealId?: string
}

// ─── Component ────────────────────────────────────────────────────────────────
export function QuoteEditor({ contacts, deals, defaultContactId, defaultDealId }: QuoteEditorProps) {
  const router = useRouter()
  const { data: quickServices = [], isLoading: servicesLoading } = useActiveServices()
  const [saving, setSaving]               = useState(false)
  const [errorMsg, setErrorMsg]           = useState<string | null>(null)
  const [showQuickServices, setShowQuickServices] = useState(false)
  const [savedQuote, setSavedQuote]       = useState<{ id: string; folio: string; title: string } | null>(null)

  const methods = useForm<QuoteFormInput, unknown, QuoteFormOutput>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      contact_id:     defaultContactId ?? '',
      deal_id:        defaultDealId    ?? '',
      title:          '',
      valid_until:    '',
      notes:          '',
      internal_notes: '',
      tax_rate:       16,
      currency:       'MXN',
      line_items: [{ description: '', quantity: 1, unit_price: 0, discount_pct: 0, category: '' }],
    },
  })

  const { register, control, handleSubmit, setValue, getValues, formState: { errors } } = methods
  const { fields, append, remove } = useFieldArray({ control, name: 'line_items' })

  const selectedContactId = useWatch({ control, name: 'contact_id' })
  const lineItems         = useWatch({ control, name: 'line_items' })
  const taxRate           = useWatch({ control, name: 'tax_rate' }) ?? 16

  // Filter deals by selected contact
  const filteredDeals = useMemo(
    () => deals.filter(d => !selectedContactId || d.contact_id === selectedContactId),
    [deals, selectedContactId],
  )

  // Clear deal when contact changes to one that doesn't own the current deal
  useEffect(() => {
    const currentDealId = getValues('deal_id')
    if (currentDealId) {
      const deal = deals.find(d => d.id === currentDealId)
      if (deal && selectedContactId && deal.contact_id !== selectedContactId) {
        setValue('deal_id', '')
      }
    }
  }, [selectedContactId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live totals
  const subtotal  = (lineItems ?? []).reduce((acc, item) => {
    const q = Number(item?.quantity  ?? 0)
    const p = Number(item?.unit_price ?? 0)
    const d = Number(item?.discount_pct ?? 0)
    return acc + q * p * (1 - d / 100)
  }, 0)
  const taxAmount = subtotal * (Number(taxRate) / 100)
  const total     = subtotal + taxAmount

  function addQuickService(svc: { description: string; unit_price: number; category: string | null }) {
    append({ description: svc.description, quantity: 1, unit_price: svc.unit_price, discount_pct: 0, category: svc.category ?? '' })
  }

  async function onSubmit(formData: QuoteFormOutput) {
    setSaving(true)
    setErrorMsg(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No autenticado')

      const { data: newQuote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          contact_id:     formData.contact_id,
          deal_id:        formData.deal_id || null,
          title:          formData.title,
          status:         'draft',
          subtotal,
          tax_rate:       Number(formData.tax_rate),
          tax_amount:     taxAmount,
          total,
          currency:       formData.currency,
          valid_until:    formData.valid_until || null,
          notes:          formData.notes          || null,
          internal_notes: formData.internal_notes || null,
          created_by:     user.id,
        })
        .select()
        .single()

      if (quoteError || !newQuote) throw new Error(quoteError?.message ?? 'Error creando cotización')

      const { error: itemsError } = await supabase
        .from('quote_line_items')
        .insert(
          formData.line_items.map((item, idx) => ({
            quote_id:     newQuote.id,
            sort_order:   idx,
            description:  item.description,
            quantity:     Number(item.quantity),
            unit_price:   Number(item.unit_price),
            discount_pct: Number(item.discount_pct ?? 0),
            total:        Number(item.quantity) * Number(item.unit_price) * (1 - Number(item.discount_pct ?? 0) / 100),
            category:     item.category || null,
          }))
        )

      if (itemsError) throw new Error(itemsError.message)

      const record = newQuote as Record<string, unknown>
      const quoteFolio = (record.quote_number as string) ?? newQuote.id.slice(0, 8).toUpperCase()
      const formattedTotal = Number(total).toLocaleString('es-MX', {
        style: 'currency',
        currency: formData.currency,
      })

      const { error: activityError } = await supabase
        .from('activities')
        .insert({
          type: 'stage_change',
          contact_id: formData.contact_id,
          deal_id: formData.deal_id || null,
          subject: 'Cotización elaborada',
          body: `Se creó la cotización "${formData.title}" (folio ${quoteFolio}) por ${formattedTotal}.`,
          created_by: user.id,
        })

      if (activityError) {
        console.error('[quotes] No se pudo registrar actividad de creación:', activityError.message)
      }

      setSavedQuote({
        id:    newQuote.id,
        folio: quoteFolio,
        title: formData.title,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setErrorMsg(
        msg.toLowerCase().includes('row-level security')
          ? 'Sin permisos para crear cotizaciones. Contacta al administrador.'
          : msg
      )
      setSaving(false)
    }
  }

  // ── Success state ───────────────────────────────────────────────────────────
  if (savedQuote) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-8 py-16 text-center">
        <CheckCircle2 className="h-14 w-14 text-emerald-500" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Cotización creada</p>
          <p className="mt-1 text-2xl font-bold text-brand-navy">{savedQuote.title}</p>
          <p className="mt-1 text-sm text-gray-500">Folio: <span className="font-mono font-semibold text-brand-navy">{savedQuote.folio}</span></p>
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
            Ver cotización
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* ── Información general ── */}
        <div className="rounded-xl border border-brand-stone bg-brand-paper p-5">
          <h2 className="mb-4 text-sm font-semibold text-brand-navy">Información general</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

            <div>
              <label className="mb-1 block text-xs font-semibold text-brand-navy">
                Contacto <span className="text-red-500">*</span>
              </label>
              <select
                {...register('contact_id')}
                className="w-full rounded-lg border border-brand-stone bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              >
                <option value="">Seleccionar contacto…</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}{c.company_name ? ` · ${c.company_name}` : ''}
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
                  <option key={d.id} value={d.id}>{d.title}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-brand-navy">
                Título <span className="text-red-500">*</span>
              </label>
              <input
                {...register('title')}
                type="text"
                placeholder="Ej. Cobertura fotográfica boda García — junio 2026"
                className="w-full rounded-lg border border-brand-stone bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              />
              {errors.title && <p className="mt-1 text-xs text-red-500">{errors.title.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-brand-navy">Válida hasta</label>
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
                  <option value="MXN">MXN — Peso Mexicano</option>
                  <option value="USD">USD — Dólar Americano</option>
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

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-brand-navy">
                Notas para el cliente{' '}
                <span className="font-normal text-gray-400">(aparecen en el PDF)</span>
              </label>
              <textarea
                {...register('notes')}
                rows={3}
                placeholder="Condiciones, forma de pago, anticipo requerido, vigencia de la oferta…"
                className="w-full resize-none rounded-lg border border-brand-stone bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-brand-navy">
                Notas internas{' '}
                <span className="font-normal text-gray-400">(solo equipo, no aparecen en PDF)</span>
              </label>
              <textarea
                {...register('internal_notes')}
                rows={2}
                placeholder="Contexto interno, observaciones de la negociación…"
                className="w-full resize-none rounded-lg border border-brand-stone bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-gold/40"
              />
            </div>
          </div>
        </div>

        {/* ── Conceptos ── */}
        <div className="overflow-hidden rounded-xl border border-brand-stone bg-brand-paper">
          <div className="flex items-center justify-between border-b border-brand-stone bg-brand-canvas px-4 py-3">
            <h2 className="text-sm font-semibold text-brand-navy">Conceptos</h2>
            <button
              type="button"
              onClick={() => append({ description: '', quantity: 1, unit_price: 0, discount_pct: 0, category: '' })}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-navy hover:text-brand-gold transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar línea
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-brand-stone/60 text-xs text-gray-500">
                  <th className="px-3 py-2 text-left font-medium">Descripción</th>
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
                      Sin conceptos — agrega una línea o usa Servicios rápidos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {errors.line_items && typeof errors.line_items.message === 'string' && (
            <p className="px-4 pb-2 text-xs text-red-500">{errors.line_items.message}</p>
          )}

          {/* Quick services */}
          <div className="border-t border-brand-stone/50 px-4 py-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowQuickServices(v => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-brand-navy transition-colors"
              >
                {showQuickServices ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                Servicios rápidos
                {quickServices.length > 0 && (
                  <span className="text-gray-400">({quickServices.length})</span>
                )}
              </button>
              <Link
                href="/settings/catalogo"
                target="_blank"
                className="inline-flex items-center gap-1 text-[10px] text-gray-400 hover:text-brand-navy transition-colors"
                title="Gestionar catálogo"
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
                      Agrega servicios desde el catálogo
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
                          'text-xs font-medium text-brand-navy transition-colors hover:border-brand-gold hover:bg-brand-canvas'
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

        {errorMsg && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {errorMsg}
          </div>
        )}

        {/* Validation error summary (shown when user tries to submit with errors) */}
        {Object.keys(errors).length > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <p className="font-semibold">Revisa los campos requeridos:</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs">
              {errors.contact_id && <li>{errors.contact_id.message}</li>}
              {errors.title && <li>{errors.title.message}</li>}
              {errors.line_items?.message && <li>{errors.line_items.message as string}</li>}
              {!errors.contact_id && !errors.title && !errors.line_items?.message && (
                <li>Verifica que todos los conceptos tengan descripción y cantidad válida</li>
              )}
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
            {saving ? 'Guardando…' : 'Crear cotización'}
          </button>
        </div>
      </form>
    </FormProvider>
  )
}
