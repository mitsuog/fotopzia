'use client'

import { useEffect, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { Mail, Phone, Building2, Tag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ActivityFeed } from './ActivityFeed'
import type { Contact, Deal, Activity, DealStage } from '@/types/crm'

const STAGE_LABELS: Record<DealStage, string> = {
  lead: 'Lead',
  prospect: 'Prospecto',
  qualified: 'Calificado',
  proposal: 'Propuesta',
  negotiation: 'Negociacion',
  won: 'Ganado',
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
}

export function ContactDetail({ contact, initialDeals, initialActivities }: ContactDetailProps) {
  const [activeTab, setActiveTab] = useState<TabId>('deals')
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)')
    const update = () => setIsDesktop(mediaQuery.matches)

    update()
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  const fullName = `${contact.first_name} ${contact.last_name}`
  const initials = getInitials(contact.first_name, contact.last_name)
  const avatarColor = getAvatarColor(fullName)
  const tasks = initialActivities.filter(a => a.type === 'task' && !a.completed)

  function renderDealsTab() {
    if (initialDeals.length === 0) {
      return <p className="py-8 text-center text-sm text-gray-400">Sin deals asociados</p>
    }

    return (
      <div className="space-y-3">
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

  const contactMeta = (
    <>
      <div className="mb-6 flex flex-col items-center text-center">
        <div className={cn('mb-3 flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white', avatarColor)}>
          {initials}
        </div>
        <h1 className="text-xl font-bold text-brand-navy">{fullName}</h1>
        {contact.company_name && <p className="mt-0.5 text-sm text-gray-500">{contact.company_name}</p>}
        {contact.source && <span className="mt-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{contact.source}</span>}
      </div>

      <div className="space-y-3">
        {contact.email && (
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 shrink-0 text-gray-400" />
            <a href={`mailto:${contact.email}`} className="truncate text-sm text-brand-navy hover:underline">
              {contact.email}
            </a>
          </div>
        )}
        {contact.phone && (
          <div className="flex items-center gap-3">
            <Phone className="h-4 w-4 shrink-0 text-gray-400" />
            <a href={`tel:${contact.phone}`} className="text-sm text-brand-navy hover:underline">
              {contact.phone}
            </a>
          </div>
        )}
        {contact.company_name && (
          <div className="flex items-center gap-3">
            <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
            <span className="text-sm text-gray-700">{contact.company_name}</span>
          </div>
        )}
      </div>

      {contact.tags && contact.tags.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex items-center gap-2">
            <Tag className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Etiquetas</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {contact.tags.map(tag => (
              <span key={tag} className="rounded-full border border-brand-stone bg-brand-canvas px-2 py-0.5 text-xs text-gray-600">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-brand-stone bg-white p-3 text-center">
          <p className="text-2xl font-bold text-brand-navy">{initialDeals.length}</p>
          <p className="mt-0.5 text-xs text-gray-500">Deals</p>
        </div>
        <div className="rounded-lg border border-brand-stone bg-white p-3 text-center">
          <p className="text-2xl font-bold text-brand-navy">{initialActivities.length}</p>
          <p className="mt-0.5 text-xs text-gray-500">Actividades</p>
        </div>
      </div>
    </>
  )

  const tabs = (
    <div className="flex border-b border-brand-stone">
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
  )

  if (!isDesktop) {
    return (
      <div className="space-y-4">
        <section className="rounded-xl border border-brand-stone bg-brand-paper p-4 sm:p-6">{contactMeta}</section>

        <section className="rounded-xl border border-brand-stone bg-white">
          <div className="overflow-x-auto">
            <div className="min-w-max">{tabs}</div>
          </div>
          <div className="p-4 sm:p-5">{renderTabContent()}</div>
        </section>
      </div>
    )
  }

  return (
    <Group orientation="horizontal" className="h-[calc(100dvh-132px)] overflow-hidden rounded-lg border border-brand-stone">
      <Panel defaultSize={38} minSize={28} maxSize={50}>
        <div className="h-full overflow-y-auto bg-brand-paper p-6">{contactMeta}</div>
      </Panel>

      <Separator className="w-1 cursor-col-resize bg-brand-stone transition-colors hover:bg-brand-gold/40" />

      <Panel defaultSize={62} minSize={40}>
        <div className="flex h-full flex-col bg-white">
          <div className="shrink-0">{tabs}</div>
          <div className="flex-1 overflow-y-auto p-5">{renderTabContent()}</div>
        </div>
      </Panel>
    </Group>
  )
}
