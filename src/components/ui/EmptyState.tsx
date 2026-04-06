import type { ReactNode } from 'react'
import Link from 'next/link'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description?: string
  ctaLabel?: string
  ctaHref?: string
  icon?: ReactNode
}

export function EmptyState({
  title,
  description,
  ctaLabel,
  ctaHref,
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-brand-stone/90 bg-white/70 px-5 py-12 text-center">
      <div className="mb-3 rounded-full border border-brand-stone/70 bg-brand-paper p-3 text-brand-navy/70">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <p className="text-sm font-semibold text-brand-navy">{title}</p>
      {description && <p className="mt-1 max-w-md text-xs text-gray-500">{description}</p>}
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="mt-4 inline-flex items-center rounded-lg bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-navy-light"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  )
}
