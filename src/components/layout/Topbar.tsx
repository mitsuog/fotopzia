'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'
import { ChevronRight, Command, FilePlus2, Handshake, Menu, UserPlus, BriefcaseBusiness } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { getNavConfigForRole } from '@/lib/navigation/config'
import { resolveAppRole } from '@/lib/utils/permissions'

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  crm: 'CRM',
  'crm-calendar': 'Agenda CRM',
  quotes: 'Cotizaciones',
  contracts: 'Contratos',
  approvals: 'Aprobaciones',
  projects: 'Proyectos',
  calendar: 'Calendario',
  portfolios: 'Portafolios',
  settings: 'Configuracion',
  kanban: 'Kanban',
  list: 'Lista',
  new: 'Nuevo',
}

function isOpaqueId(segment: string): boolean {
  const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  const longId = /^[a-z0-9_-]{20,}$/i
  return uuidV4.test(segment) || longId.test(segment)
}

function getLabel(segment: string, index: number, segments: string[]): string {
  if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment]

  if (isOpaqueId(segment)) {
    const parent = segments[index - 1]
    if (parent === 'crm') return 'Detalle contacto'
    if (parent === 'quotes') return 'Detalle cotizacion'
    if (parent === 'projects') return 'Detalle proyecto'
    if (parent === 'contracts') return 'Detalle contrato'
    return 'Detalle'
  }

  return segment
}

function getInitials(fullName: string | null | undefined, email: string): string {
  if (!fullName) return email.slice(0, 1).toUpperCase()
  const parts = fullName.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return email.slice(0, 1).toUpperCase()
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface TopbarProps {
  user: {
    email: string
    profile?: {
      full_name: string | null
      role: string | null
      avatar_url?: string | null
    }
  }
  onMenuClick?: () => void
  onCommandPalette?: () => void
}

export function Topbar({ user, onMenuClick, onCommandPalette }: TopbarProps) {
  const pathname = usePathname()
  const [avatarFailed, setAvatarFailed] = useState(false)
  const fullName = user.profile?.full_name
  const avatarUrl = user.profile?.avatar_url ?? null
  const initials = getInitials(fullName, user.email)

  const role = resolveAppRole(user.profile?.role)
  const navConfig = getNavConfigForRole(role)

  const segments = pathname.split('/').filter(Boolean)
  const currentLabel = segments.length > 0 ? getLabel(segments[segments.length - 1], segments.length - 1, segments) : 'Dashboard'

  const breadcrumbs = segments.map((seg, idx) => ({
    label: getLabel(seg, idx, segments),
    href: '/' + segments.slice(0, idx + 1).join('/'),
    isLast: idx === segments.length - 1,
  }))

  const can = (action: string) => navConfig.actions.includes(action as typeof navConfig.actions[number])

  let actionButton: ReactNode = null

  if (pathname.startsWith('/crm')) {
    actionButton = (
      <div className="flex items-center gap-2">
        {can('new_contact') && (
          <Link
            href="/crm/list?newContact=1"
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-stone bg-white px-3 py-1.5 text-xs font-medium text-brand-navy transition-colors hover:border-brand-gold/60 hover:bg-brand-paper"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Crear contacto
          </Link>
        )}
        {can('new_deal') && (
          <Link
            href="/crm?newDeal=1"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-navy-light"
          >
            <Handshake className="h-3.5 w-3.5" />
            Crear deal
          </Link>
        )}
      </div>
    )
  } else if (pathname.startsWith('/quotes') && can('new_quote')) {
    actionButton = (
      <Link
        href="/quotes/new"
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-navy-light"
      >
        <FilePlus2 className="h-3.5 w-3.5" />
        Crear cotizacion
      </Link>
    )
  } else if (pathname.startsWith('/contracts') && can('new_contract')) {
    actionButton = (
      <Link
        href="/contracts/new"
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-navy-light"
      >
        <FilePlus2 className="h-3.5 w-3.5" />
        Crear contrato
      </Link>
    )
  } else if (pathname.startsWith('/projects') && can('new_project')) {
    actionButton = (
      <Link
        href="/projects/new"
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-navy-light"
      >
        <BriefcaseBusiness className="h-3.5 w-3.5" />
        Crear proyecto
      </Link>
    )
  }

  return (
    <header className="shrink-0 border-b border-brand-stone/70 bg-white/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-white/65 sm:px-5 md:px-6">
      <div className="flex min-h-16 w-full items-center justify-between gap-3 py-2">
        <div className="min-w-0 flex items-center gap-2 sm:gap-3">
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-brand-stone bg-white text-brand-navy transition-colors hover:bg-brand-canvas"
              aria-label="Abrir menu"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}

          <p className="truncate text-sm font-semibold text-brand-navy sm:hidden">{currentLabel}</p>

          <nav className="hidden items-center gap-1 text-sm sm:flex">
            {breadcrumbs.map((crumb, idx) => (
              <span key={crumb.href} className="flex items-center gap-1">
                {idx > 0 && <ChevronRight className="h-3.5 w-3.5 text-gray-400" />}
                {crumb.isLast ? (
                  <span className="rounded-md bg-brand-canvas px-2 py-1 font-semibold text-brand-navy">{crumb.label}</span>
                ) : (
                  <Link href={crumb.href} className="rounded-md px-1.5 py-1 text-gray-500 transition-colors hover:text-brand-navy">
                    {crumb.label}
                  </Link>
                )}
              </span>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {onCommandPalette && (
            <button
              type="button"
              onClick={onCommandPalette}
              className="hidden items-center gap-1.5 rounded-lg border border-brand-stone bg-white px-2 py-1.5 text-xs text-gray-600 transition-colors hover:bg-brand-paper sm:inline-flex"
              aria-label="Abrir comando rapido"
              title="Comando rapido (Ctrl+K)"
            >
              <Command className="h-3.5 w-3.5" />
              Ctrl+K
            </button>
          )}

          {actionButton && <div className="hidden sm:flex sm:items-center">{actionButton}</div>}
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 rounded-lg border border-brand-stone bg-white px-2 py-1.5 text-brand-navy transition-colors hover:bg-brand-paper"
            title="Ir a mi perfil"
          >
            {avatarUrl && !avatarFailed ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={fullName || user.email}
                className="h-7 w-7 rounded-full object-cover ring-1 ring-brand-stone/60"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-navy text-[11px] font-semibold text-white">
                {initials}
              </span>
            )}
            <span className="hidden max-w-36 truncate text-xs font-medium text-brand-navy lg:block">{fullName || user.email}</span>
          </Link>
        </div>
      </div>
    </header>
  )
}

