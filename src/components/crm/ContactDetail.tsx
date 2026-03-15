'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Mail, Phone, Building2, Tag, Pencil, FileText, ScrollText, CalendarClock, ClipboardList, FolderKanban, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ActivityFeed } from './ActivityFeed'
import { InlineActivityForm } from './InlineActivityForm'
import { EditContactSheet } from './EditContactSheet'
import { useActivities, useCompleteActivity } from '@/hooks/useActivities'
import type { Contact, Deal, Activity, DealStage } from '@/types/crm'

const STAGE_LABELS: Record<DealStage, string> = {
  lead: 'Lead',
  prospect: 'Prospecto',
  proposal: 'Propuesta',
  won: 'Confirmado',
  lost: 'Perdido',
}

const STAGE_COLORS: Record<DealStage, string> = {
  lead: 'bg-slate-100 text-slate-600',
  prospect: 'bg-blue-50 text-blue-700',
  proposal: 'bg-amber-50 text-amber-700',
  won: 'bg-emerald-50 text-emerald-700',
  lost: 'bg-red-50 text-red-600',
}

type TabId = 'budgets' | 'activities' | 'tasks'

const TABS: { id: TabId; label: string }[] = [
  { id: 'budgets', label: 'Presupuestos' },
  { id: 'activities', label: 'Actividades' },
  { id: 'tasks', label: 'Tareas' },
]

type QuoteSummary = {
  id: string
  quote_number: string
  title: string
  status: string
  updated_at: string
  deal_id: string | null
}

type ContractSummary = {
  id: string
  contract_number: string
  title: string
  status: string
  updated_at: string
  quote_id: string | null
}

type UpcomingEvent = {
  id: string
  title: string
  start_at: string
  end_at: string
  status: string
  deal_id: string | null
}

type OpenFollowup = {
  id: string
  event_id: string
  title: string
  status: string
  priority: string
  due_at: string | null
}

type PendingApproval = {
  id: string
  title: string
  status: string
  entity_type: string
  entity_id: string
  updated_at: string
}

type ProjectSummary = {
  id: string
  title: string
  stage: string
  due_date: string | null
  deal_id: string | null
  created_at: string
}

type OpenProjectTask = {
  id: string
  project_id: string
  title: string
  status: string
  priority: string
  due_at: string | null
}

interface ContactDetailProps {
  contact: Contact
  initialDeals: Deal[]
  initialActivities: Activity[]
  activeQuotes: QuoteSummary[]
  contracts: ContractSummary[]
  upcomingEvents: UpcomingEvent[]
  openFollowups: OpenFollowup[]
  pendingApprovals: PendingApproval[]
  projects: ProjectSummary[]
  openProjectTasks: OpenProjectTask[]
  canEditContact: boolean
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
}

function getAvatarColor(name: string): string {
  const colors = ['bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500', 'bg-indigo-500']
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function getQuoteStatusLabel(status: string): string {
  if (status === 'draft') return 'Borrador'
  if (status === 'sent') return 'Enviada'
  if (status === 'viewed') return 'Vista'
  if (status === 'approved') return 'Aprobada'
  if (status === 'rejected') return 'Rechazada'
  if (status === 'expired') return 'Vencida'
  return status
}

function getContractStatusLabel(status: string): string {
  if (status === 'draft') return 'Borrador'
  if (status === 'sent') return 'Enviado'
  if (status === 'viewed') return 'Visto'
  if (status === 'signed') return 'Firmado'
  if (status === 'rejected') return 'Rechazado'
  return status
}

function getApprovalLink(item: PendingApproval): string {
  if (item.entity_type === 'quote') return `/quotes/${item.entity_id}`
  if (item.entity_type === 'contract') return `/contracts/${item.entity_id}`
  return '/approvals'
}

export function ContactDetail({
  contact,
  initialDeals,
  initialActivities,
  activeQuotes,
  contracts,
  upcomingEvents,
  openFollowups,
  pendingApprovals,
  projects,
  openProjectTasks,
  canEditContact,
}: ContactDetailProps) {
  const [activeTab, setActiveTab] = useState<TabId>('budgets')
  const [currentContact, setCurrentContact] = useState<Contact>(contact)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [showActivityForm, setShowActivityForm] = useState(false)

  const { data: activities = initialActivities } = useActivities(currentContact.id, initialActivities)
  const completeActivity = useCompleteActivity()

  const fullName = `${currentContact.first_name} ${currentContact.last_name}`
  const initials = getInitials(currentContact.first_name, currentContact.last_name)
  const avatarColor = getAvatarColor(fullName)
  const activityTasks = activities.filter(activity => activity.type === 'task' && !activity.completed)
  const openProjects = projects.filter(project => project.stage !== 'cerrado')
  const totalTaskCount =
    activityTasks.length
    + upcomingEvents.length
    + openFollowups.length
    + pendingApprovals.length
    + openProjects.length
    + openProjectTasks.length

  function renderBudgetsTab() {
    const hasAnyData = initialDeals.length > 0 || activeQuotes.length > 0 || contracts.length > 0 || projects.length > 0
    if (!hasAnyData) {
      return <p className="py-8 text-center text-sm text-gray-400">Sin presupuestos o documentos asociados</p>
    }

    return (
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Presupuestos (deals legacy)</p>
          {initialDeals.length === 0 ? (
            <p className="rounded-lg border border-brand-stone bg-brand-paper p-3 text-sm text-gray-500">Sin presupuestos registrados.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {initialDeals.map(deal => (
                <div key={deal.id} className="rounded-lg border border-brand-stone bg-brand-paper p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-brand-navy">{deal.title}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        Presupuesto estimado:{' '}
                        <span className="font-semibold text-brand-navy">
                          {deal.value
                            ? `$${Number(deal.value).toLocaleString('es-MX')} ${deal.currency}`
                            : 'Sin definir'}
                        </span>
                      </p>
                    </div>
                    <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', STAGE_COLORS[deal.stage])}>
                      {STAGE_LABELS[deal.stage]}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-gray-600">
                    Necesidades del servicio: {deal.notes?.trim() ? deal.notes : 'Sin declarar'}
                  </p>
                  {deal.expected_close && (
                    <p className="mt-1 text-xs text-gray-400">
                      Cierre estimado: {new Date(deal.expected_close).toLocaleDateString('es-MX')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <div className="rounded-lg border border-brand-stone bg-brand-paper p-4">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <FileText className="h-3.5 w-3.5" />
              Cotizaciones activas
            </p>
            {activeQuotes.length === 0 ? (
              <p className="text-sm text-gray-500">Sin cotizaciones activas.</p>
            ) : (
              <div className="space-y-2">
                {activeQuotes.map(quote => (
                  <div key={quote.id} className="rounded-md border border-brand-stone bg-white p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-brand-navy">{quote.quote_number}</p>
                        <p className="truncate text-xs text-gray-600">{quote.title}</p>
                      </div>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                        {getQuoteStatusLabel(quote.status)}
                      </span>
                    </div>
                    <Link href={`/quotes/${quote.id}`} className="mt-2 inline-flex text-xs font-medium text-brand-navy underline">
                      Ver cotizacion
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-brand-stone bg-brand-paper p-4">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <ScrollText className="h-3.5 w-3.5" />
              Contratos
            </p>
            {contracts.length === 0 ? (
              <p className="text-sm text-gray-500">Sin contratos registrados.</p>
            ) : (
              <div className="space-y-2">
                {contracts.map(contract => (
                  <div key={contract.id} className="rounded-md border border-brand-stone bg-white p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-brand-navy">{contract.contract_number}</p>
                        <p className="truncate text-xs text-gray-600">{contract.title}</p>
                      </div>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">
                        {getContractStatusLabel(contract.status)}
                      </span>
                    </div>
                    <Link href={`/contracts/${contract.id}`} className="mt-2 inline-flex text-xs font-medium text-brand-navy underline">
                      Ver contrato
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  function renderTasksTab() {
    if (totalTaskCount === 0) {
      return <p className="py-8 text-center text-sm text-gray-400">Sin tareas o pendientes activos</p>
    }

    return (
      <div className="space-y-4">
        {activityTasks.length > 0 && (
          <div className="rounded-lg border border-brand-stone bg-brand-paper p-3">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <ClipboardList className="h-3.5 w-3.5" />
              Tareas CRM
            </p>
            <div className="space-y-2">
              {activityTasks.map(task => (
                <div key={task.id} className="rounded-md border border-brand-stone bg-white p-2">
                  <p className="text-sm font-medium text-brand-navy">{task.subject || 'Tarea sin titulo'}</p>
                  {task.body && <p className="text-xs text-gray-600">{task.body}</p>}
                  {task.due_at && <p className="text-xs text-gray-400">Vence: {new Date(task.due_at).toLocaleString('es-MX')}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {upcomingEvents.length > 0 && (
          <div className="rounded-lg border border-brand-stone bg-brand-paper p-3">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <CalendarClock className="h-3.5 w-3.5" />
              Citas abiertas
            </p>
            <div className="space-y-2">
              {upcomingEvents.map(event => (
                <div key={event.id} className="rounded-md border border-brand-stone bg-white p-2">
                  <p className="text-sm font-medium text-brand-navy">{event.title}</p>
                  <p className="text-xs text-gray-600">
                    {new Date(event.start_at).toLocaleString('es-MX')} - {new Date(event.end_at).toLocaleString('es-MX')}
                  </p>
                  <p className="text-xs text-gray-400">Estado: {event.status}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {openFollowups.length > 0 && (
          <div className="rounded-lg border border-brand-stone bg-brand-paper p-3">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <ClipboardList className="h-3.5 w-3.5" />
              Seguimientos abiertos
            </p>
            <div className="space-y-2">
              {openFollowups.map(followup => (
                <div key={followup.id} className="rounded-md border border-brand-stone bg-white p-2">
                  <p className="text-sm font-medium text-brand-navy">{followup.title}</p>
                  <p className="text-xs text-gray-600">Estado: {followup.status} · Prioridad: {followup.priority}</p>
                  {followup.due_at && <p className="text-xs text-gray-400">Vence: {new Date(followup.due_at).toLocaleString('es-MX')}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {pendingApprovals.length > 0 && (
          <div className="rounded-lg border border-brand-stone bg-brand-paper p-3">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <ClipboardList className="h-3.5 w-3.5" />
              WF pendientes por aprobar
            </p>
            <div className="space-y-2">
              {pendingApprovals.map(item => (
                <div key={item.id} className="rounded-md border border-brand-stone bg-white p-2">
                  <p className="text-sm font-medium text-brand-navy">{item.title}</p>
                  <p className="text-xs text-gray-600">Estado: {item.status.replace('_', ' ')} · Tipo: {item.entity_type}</p>
                  <Link href={getApprovalLink(item)} className="mt-1 inline-flex text-xs font-medium text-brand-navy underline">
                    Revisar documento
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {(openProjects.length > 0 || openProjectTasks.length > 0) && (
          <div className="rounded-lg border border-brand-stone bg-brand-paper p-3">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <FolderKanban className="h-3.5 w-3.5" />
              Proyectos y tareas
            </p>
            <div className="space-y-2">
              {openProjects.map(project => (
                <div key={project.id} className="rounded-md border border-brand-stone bg-white p-2">
                  <p className="text-sm font-medium text-brand-navy">{project.title}</p>
                  <p className="text-xs text-gray-600">Etapa: {project.stage}</p>
                  {project.due_date && <p className="text-xs text-gray-400">Entrega estimada: {new Date(project.due_date).toLocaleDateString('es-MX')}</p>}
                </div>
              ))}
              {openProjectTasks.map(task => (
                <div key={task.id} className="rounded-md border border-brand-stone bg-white p-2">
                  <p className="text-sm font-medium text-brand-navy">{task.title}</p>
                  <p className="text-xs text-gray-600">Estado: {task.status} · Prioridad: {task.priority}</p>
                  {task.due_at && <p className="text-xs text-gray-400">Vence: {new Date(task.due_at).toLocaleString('es-MX')}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderActivitiesTab() {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Historial de actividades</p>
          <button
            type="button"
            onClick={() => setShowActivityForm(v => !v)}
            className="inline-flex items-center gap-1 rounded-lg border border-brand-stone bg-white px-2.5 py-1.5 text-xs font-medium text-brand-navy hover:bg-brand-paper transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Nueva nota / actividad
          </button>
        </div>
        {showActivityForm && (
          <InlineActivityForm
            contactId={currentContact.id}
            onDone={() => setShowActivityForm(false)}
          />
        )}
        <ActivityFeed
          activities={activities}
          onComplete={(id) => completeActivity.mutate({ activityId: id, contactId: currentContact.id })}
        />
      </div>
    )
  }

  function renderTabContent() {
    if (activeTab === 'budgets') return renderBudgetsTab()
    if (activeTab === 'activities') return renderActivitiesTab()
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

          <div className="space-y-3 lg:w-[360px]">
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

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-brand-stone bg-white p-3 text-center">
                <p className="text-2xl font-bold text-brand-navy">{initialDeals.length}</p>
                <p className="mt-0.5 text-xs text-gray-500">Presupuestos</p>
              </div>
              <div className="rounded-lg border border-brand-stone bg-white p-3 text-center">
                <p className="text-2xl font-bold text-brand-navy">{activeQuotes.length}</p>
                <p className="mt-0.5 text-xs text-gray-500">Cotizaciones</p>
              </div>
              <div className="rounded-lg border border-brand-stone bg-white p-3 text-center">
                <p className="text-2xl font-bold text-brand-navy">{totalTaskCount}</p>
                <p className="mt-0.5 text-xs text-gray-500">Pendientes</p>
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
