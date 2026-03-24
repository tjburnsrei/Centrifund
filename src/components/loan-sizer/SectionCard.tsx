import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface SectionCardProps {
  id: string
  title: string
  description?: string
  children: ReactNode
  className?: string
}

export function SectionCard({
  id,
  title,
  description,
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
      <div className="border-b border-border bg-surface-muted/50 px-4 py-3 md:px-5">
        <h2
          id={headingId}
          className="text-base font-semibold text-text-primary"
        >
          {title}
        </h2>
        {description ? (
          <p id={`${id}-desc`} className="mt-1 text-xs text-text-secondary">
            {description}
          </p>
        ) : null}
      </div>
      <div className="space-y-4 p-4 md:p-5">{children}</div>
    </section>
  )
}
