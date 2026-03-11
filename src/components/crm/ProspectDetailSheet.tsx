'use client'

import Link from 'next/link'
import { X, Mail, Building2, CalendarClock, Tag, Briefcase } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { Deal } from '@/types/crm'

interface ProspectDetailSheetProps {
  open: boolean
  deal: Deal | null
  onClose: () => void
}

const STAGE_LABELS: Record<Deal['stage'], string> = {
  lead: 'Lead',
  prospect: 'Prospecto',
  qualified: 'Calificado',
  proposal: 'Propuesta',
  negotiation: 'Negociacion',
  won: 'Confirmado',
  lost: 'Perdido',
}

const STAGE_COLORS: Record<Deal['stage'], string> = {
  lead: 'bg-slate-100 text-slate-600',
  prospect: 'bg-blue-50 text-blue-700',
  qualified: 'bg-violet-50 text-violet-700',
  proposal: 'bg-amber-50 text-amber-700',
  negotiation: 'bg-orange-50 text-orange-700',
  won: 'bg-emerald-50 text-emerald-700',
  lost: 'bg-red-50 text-red-700',
}

function getInitials(firstName: string | undefined, lastName: string | undefined): string {
  const a = firstName?.[0] ?? '?'
  const b = lastName?.[0] ?? ''
  return `${a}${b}`.toUpperCase()
}

export function ProspectDetailSheet({ open, deal, onClose }: ProspectDetailSheetProps) {
  if (!open || !deal) return null

  const contact = deal.contact
  const fullName = contact ? `${contact.first_name} ${contact.last_name}` : 'Sin contacto'
  const initials = getInitials(contact?.first_name, contact?.last_name)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/35" onClick={onClose} />

      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-brand-stone bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-brand-stone px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cliente Prospecto</p>
            <h2 className="text-base font-semibold text-brand-navy">Detalle rapido</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
            aria-label="Cerrar panel"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          <section className="rounded-xl border border-brand-stone bg-brand-paper p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-navy text-sm font-bold text-white">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-brand-navy">{fullName}</p>
                <p className="truncate text-sm text-gray-500">{contact?.company_name || 'Sin empresa registrada'}</p>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              {contact?.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-brand-navy hover:underline">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="truncate">{contact.email}</span>
                </a>
              )}

              {contact?.source && (
                <p className="flex items-center gap-2 text-gray-700">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  Fuente: <span className="font-medium">{contact.source}</span>
                </p>
              )}

              {contact?.tags && contact.tags.length > 0 && (
                <div className="pt-1">
                  <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                    <Tag className="h-3.5 w-3.5" />
                    Etiquetas
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {contact.tags.map(tag => (
                      <span key={tag} className="rounded-full border border-brand-stone bg-white px-2 py-0.5 text-[11px] text-gray-600">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-brand-stone bg-white p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-brand-navy">Deal</p>
              <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STAGE_COLORS[deal.stage])}>
                {STAGE_LABELS[deal.stage]}
              </span>
            </div>

            <p className="text-sm font-medium text-gray-800">{deal.title}</p>

            <div className="mt-3 space-y-2 text-sm text-gray-600">
              <p className="flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-gray-400" />
                Valor: {deal.value ? `$${Number(deal.value).toLocaleString('es-MX')} ${deal.currency}` : 'Sin valor definido'}
              </p>
              {deal.expected_close && (
                <p className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-gray-400" />
                  Cierre esperado: {format(new Date(deal.expected_close), 'd MMMM yyyy', { locale: es })}
                </p>
              )}
            </div>

            {deal.notes && (
              <div className="mt-3 rounded-lg bg-brand-paper p-3 text-sm text-gray-700">
                {deal.notes}
              </div>
            )}
          </section>
        </div>

        <footer className="border-t border-brand-stone p-4">
          <div className="flex gap-2">
            <Link
              href={`/crm/${deal.contact_id}`}
              className="inline-flex flex-1 items-center justify-center rounded-lg bg-brand-navy px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-navy-light"
              onClick={onClose}
            >
              Ver perfil completo
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-lg border border-brand-stone bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cerrar
            </button>
          </div>
        </footer>
      </aside>
    </>
  )
}
