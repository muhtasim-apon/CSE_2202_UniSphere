import type { LucideIcon } from 'lucide-react'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

type ModuleCardProps = {
  title: string
  icon: LucideIcon
  iconBgClassName: string
  iconClassName?: string
  viewAllHref?: string
  viewAllLabel?: string
  children: ReactNode
}

export default function ModuleCard({
  title,
  icon: Icon,
  iconBgClassName,
  iconClassName = 'text-primary',
  viewAllHref,
  viewAllLabel = 'View all',
  children,
}: ModuleCardProps) {
  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-[var(--shadow-card)] transition hover:shadow-md">
      <div className={`mb-4 flex h-24 items-center justify-center rounded-xl md:h-28 ${iconBgClassName}`}>
        <Icon className={`h-8 w-8 ${iconClassName}`} />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base font-semibold text-text-primary">{title}</h3>
        {viewAllHref && (
          <a
            href={viewAllHref}
            className="flex items-center gap-1 text-sm font-medium text-primary transition hover:underline"
          >
            {viewAllLabel}
            <ChevronRight className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {children}
    </div>
  )
}
