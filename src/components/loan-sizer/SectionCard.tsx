import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface SectionCardProps {
  id: string
  title: string
  description?: string
  descriptionInline?: boolean
  children: ReactNode
  className?: string
}

export function SectionCard({
  id,
  title,
  description,
  descriptionInline = false,
  children,
  className,
}: SectionCardProps) {
  const headingId = `${id}-heading`
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-white shadow-sm',
        className,
      )}
      aria-labelledby={headingId}
      role="region"
    >
      <div className="border-b border-border bg-surface-muted/45 px-3 py-2 md:px-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2
            id={headingId}
            className="text-sm font-semibold text-text-primary md:text-base"
          >
            {title}
          </h2>
          {description && descriptionInline ? (
            <p id={`${id}-desc`} className="text-[11px] text-text-secondary">
              {description}
            </p>
          ) : null}
        </div>
        {description && !descriptionInline ? (
          <p id={`${id}-desc`} className="mt-1 text-xs text-text-secondary">
            {description}
          </p>
        ) : null}
      </div>
      <div className="space-y-3 p-3 md:p-4">{children}</div>
    </section>
  )
}
