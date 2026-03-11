'use client'

import Link from 'next/link'
import { ChevronRight, Menu, UserPlus, Handshake, FilePlus2, ScrollText } from 'lucide-react'
import { usePathname } from 'next/navigation'

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
    if (parent === 'crm') return 'Detalle Contacto'
    if (parent === 'quotes') return 'Detalle Cotizacion'
    if (parent === 'projects') return 'Detalle Proyecto'
    if (parent === 'contracts') return 'Detalle Contrato'
    return 'Detalle'
  }

  return segment
}

interface TopbarProps {
  onMenuClick?: () => void
}

export function Topbar({ onMenuClick }: TopbarProps) {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)
  const currentLabel = segments.length > 0 ? getLabel(segments[segments.length - 1], segments.length - 1, segments) : 'Dashboard'

  const breadcrumbs = segments.map((seg, idx) => ({
    label: getLabel(seg, idx, segments),
    href: '/' + segments.slice(0, idx + 1).join('/'),
    isLast: idx === segments.length - 1,
  }))

  let actionButton: React.ReactNode = null

  if (pathname.startsWith('/crm')) {
    actionButton = (
      <div className="flex items-center gap-2">
        <Link
          href="/crm/list?newContact=1"
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-stone bg-white px-3 py-1.5 text-xs font-medium text-brand-navy transition-colors hover:border-brand-gold/60 hover:bg-brand-paper"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Nuevo Contacto
        </Link>
        <Link
          href="/crm/kanban"
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-navy-light"
        >
          <Handshake className="h-3.5 w-3.5" />
          Nuevo Deal
        </Link>
      </div>
    )
  } else if (pathname.startsWith('/quotes')) {
    actionButton = (
      <Link
        href="/quotes/new"
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-navy-light"
      >
        <FilePlus2 className="h-3.5 w-3.5" />
        Nueva Cotizacion
      </Link>
    )
  } else if (pathname.startsWith('/contracts')) {
    actionButton = (
      <Link
        href="/contracts"
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-navy-light"
      >
        <ScrollText className="h-3.5 w-3.5" />
        Ver Contratos
      </Link>
    )
  }

  return (
    <header className="shrink-0 border-b border-brand-stone/70 bg-white/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-white/65 sm:px-5 md:px-6">
      <div className="mx-auto flex min-h-16 max-w-[1400px] items-center justify-between gap-3 py-2">
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

        {actionButton && <div className="hidden md:flex md:items-center">{actionButton}</div>}
      </div>
    </header>
  )
}
