'use client'

import { useState } from 'react'
import { Mail, Phone, Building2, Tag, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ActivityFeed } from './ActivityFeed'
import { EditContactSheet } from './EditContactSheet'
import type { Contact, Deal, Activity, DealStage } from '@/types/crm'

const STAGE_LABELS: Record<DealStage, string> = {
  lead: 'Lead',
  prospect: 'Prospecto',
  qualified: 'Calificado',
  proposal: 'Propuesta',
  negotiation: 'Negociacion',
  won: 'Confirmado',
  lost: 'Perdido',
}

const STAGE_COLORS: Record<DealStage, string> = {
  lead: 'bg-slate-100 text-slate-600',
  prospect: 'bg-blue-50 text-blue-700',
  qualified: 'bg-violet-50 text-violet-700',
  proposal: 'bg-amber-50 text-amber-700',
  negotiation: 'bg-orange-50 text-orange-700',
  won: 'bg-emerald-50 text-emerald-700',
  lost: 'bg-red-50 text-red-600',
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

function getAvatarColor(name: string): string {
  const colors = ['bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500', 'bg-indigo-500']
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

type TabId = 'deals' | 'activities' | 'tasks'

const TABS: { id: TabId; label: string }[] = [
  { id: 'deals', label: 'Deals' },
  { id: 'activities', label: 'Actividades' },
  { id: 'tasks', label: 'Tareas' },
]

interface ContactDetailProps {
  contact: Contact
  initialDeals: Deal[]
  initialActivities: Activity[]
  canEditContact: boolean
}

export function ContactDetail({ contact, initialDeals, initialActivities, canEditContact }: ContactDetailProps) {
  const [activeTab, setActiveTab] = useState<TabId>('deals')
  const [currentContact, setCurrentContact] = useState<Contact>(contact)
  const [isEditOpen, setIsEditOpen] = useState(false)

  const fullName = `${currentContact.first_name} ${currentContact.last_name}`
  const initials = getInitials(currentContact.first_name, currentContact.last_name)
  const avatarColor = getAvatarColor(fullName)
  const tasks = initialActivities.filter(a => a.type === 'task' && !a.completed)

  function renderDealsTab() {
    if (initialDeals.length === 0) {
      return <p className="py-8 text-center text-sm text-gray-400">Sin deals asociados</p>
    }

    return (
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {initialDeals.map(deal => (
          <div key={deal.id} className="rounded-lg border border-brand-stone bg-brand-paper p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-brand-navy">{deal.title}</p>
                {deal.value && (
                  <p className="mt-0.5 text-sm text-gray-600">
                    ${Number(deal.value).toLocaleString('es-MX')} {deal.currency}
                  </p>
                )}
              </div>
              <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', STAGE_COLORS[deal.stage])}>
                {STAGE_LABELS[deal.stage]}
              </span>
            </div>
            {deal.expected_close && (
              <p className="mt-2 text-xs text-gray-400">Cierre: {new Date(deal.expected_close).toLocaleDateString('es-MX')}</p>
            )}
          </div>
        ))}
      </div>
    )
  }

  function renderTasksTab() {
    if (tasks.length === 0) {
      return <p className="py-8 text-center text-sm text-gray-400">Sin tareas pendientes</p>
    }

    return (
      <div className="space-y-3">
        {tasks.map(task => (
          <div key={task.id} className="flex items-start gap-3 rounded-lg border border-brand-stone bg-brand-paper p-3">
            <div className="mt-0.5 h-4 w-4 shrink-0 rounded border border-gray-300" />
            <div>
              <p className="text-sm font-medium text-gray-800">{task.subject || 'Tarea sin titulo'}</p>
              {task.body && <p className="mt-0.5 text-xs text-gray-500">{task.body}</p>}
              {task.due_at && <p className="mt-1 text-xs text-gray-400">Vence: {new Date(task.due_at).toLocaleDateString('es-MX')}</p>}
            </div>
          </div>
        ))}
      </div>
    )
  }

  function renderTabContent() {
    if (activeTab === 'deals') return renderDealsTab()
    if (activeTab === 'activities') return <ActivityFeed activities={initialActivities} />
    return renderTasksTab()
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-brand-stone bg-brand-paper p-4 sm:p-5 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className={cn('flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white sm:h-20 sm:w-20 sm:text-2xl', avatarColor)}>
              {initials}
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-brand-navy sm:text-2xl">{fullName}</h1>
              {currentContact.company_name && <p className="mt-0.5 truncate text-sm text-gray-500">{currentContact.company_name}</p>}
              {currentContact.source && <span className="mt-2 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{currentContact.source}</span>}
            </div>
          </div>

          <div className="space-y-3 lg:w-[340px]">
            {canEditContact && (
              <button
                type="button"
                onClick={() => setIsEditOpen(true)}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-brand-stone bg-white px-3 py-2 text-sm font-medium text-brand-navy transition-colors hover:border-brand-gold/60 hover:bg-brand-canvas/60"
              >
                <Pencil className="h-4 w-4" />
                Editar contacto
              </button>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-brand-stone bg-white p-3 text-center">
                <p className="text-2xl font-bold text-brand-navy">{initialDeals.length}</p>
                <p className="mt-0.5 text-xs text-gray-500">Deals</p>
              </div>
              <div className="rounded-lg border border-brand-stone bg-white p-3 text-center">
                <p className="text-2xl font-bold text-brand-navy">{initialActivities.length}</p>
                <p className="mt-0.5 text-xs text-gray-500">Actividades</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {currentContact.email && (
            <a href={`mailto:${currentContact.email}`} className="flex items-center gap-2 rounded-lg border border-brand-stone bg-white p-3 text-sm text-brand-navy hover:bg-brand-canvas/60">
              <Mail className="h-4 w-4 shrink-0 text-gray-400" />
              <span className="truncate">{currentContact.email}</span>
            </a>
          )}

          {currentContact.phone && (
            <a href={`tel:${currentContact.phone}`} className="flex items-center gap-2 rounded-lg border border-brand-stone bg-white p-3 text-sm text-brand-navy hover:bg-brand-canvas/60">
              <Phone className="h-4 w-4 shrink-0 text-gray-400" />
              <span>{currentContact.phone}</span>
            </a>
          )}

          {currentContact.company_name && (
            <div className="flex items-center gap-2 rounded-lg border border-brand-stone bg-white p-3 text-sm text-gray-700">
              <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
              <span className="truncate">{currentContact.company_name}</span>
            </div>
          )}
        </div>

        {currentContact.tags && currentContact.tags.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center gap-2">
              <Tag className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Etiquetas</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {currentContact.tags.map(tag => (
                <span key={tag} className="rounded-full border border-brand-stone bg-white px-2 py-0.5 text-xs text-gray-600">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-brand-stone bg-white">
        <div className="overflow-x-auto border-b border-brand-stone">
          <div className="flex min-w-max">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'border-b-2 px-5 py-3 text-sm font-medium transition-colors',
                  activeTab === tab.id ? 'border-brand-gold text-brand-navy' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-brand-navy',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-5">{renderTabContent()}</div>
      </section>

      {canEditContact && (
        <EditContactSheet
          open={isEditOpen}
          contact={currentContact}
          onClose={() => setIsEditOpen(false)}
          onUpdated={setCurrentContact}
        />
      )}
    </div>
  )
}
