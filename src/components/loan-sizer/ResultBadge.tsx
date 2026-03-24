import { cva, type VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

const badge = cva(
  'inline-flex max-w-full items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-muted text-text-primary ring-border',
        success: 'bg-success/15 text-text-primary ring-success/40',
        warning: 'bg-warning/20 text-text-primary ring-warning/50',
        danger: 'bg-danger/15 text-text-primary ring-danger/40',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

export interface ResultBadgeProps
  extends VariantProps<typeof badge> {
  children: ReactNode
  className?: string
  /** Shorter text for colorblind-friendly context (prepended visually). */
  statusPrefix?: string
}

export function ResultBadge({
  children,
  className,
  tone,
  statusPrefix,
}: ResultBadgeProps) {
  return (
    <span className={cn(badge({ tone }), className)}>
      {statusPrefix ? (
        <span className="sr-only">{statusPrefix} </span>
      ) : null}
      {children}
    </span>
  )
}
