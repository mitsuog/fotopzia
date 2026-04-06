import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SectionCardProps {
  title?: string
  subtitle?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}

export function SectionCard({
  title,
  subtitle,
  actions,
  children,
  className,
  contentClassName,
}: SectionCardProps) {
  return (
    <section className={cn('rounded-2xl border border-brand-stone/80 bg-white/85 shadow-[0_16px_40px_-26px_rgba(28,43,74,0.5)] backdrop-blur', className)}>
      {(title || subtitle || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-brand-stone/60 px-5 py-4">
          <div>
            {title && <h2 className="text-base font-semibold text-brand-navy">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}
      <div className={cn('p-5', contentClassName)}>{children}</div>
    </section>
  )
}
