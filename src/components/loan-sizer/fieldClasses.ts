import { cn } from '../../lib/cn'

/** Shared focus ring for form controls (Tailwind token cleanup). */
export const controlFocusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-surface'

export function textLikeInputClassName(extra?: string): string {
  return cn(
    'w-full rounded-lg border border-border bg-white text-sm text-text-primary shadow-sm',
    controlFocusRing,
    extra,
  )
}

export const tableSectionClass = {
  wrap: 'overflow-x-auto',
  table: 'w-full min-w-[320px] border-collapse text-left text-sm',
  theadRow: 'border-b border-border',
  th: 'py-2 pr-4 font-semibold text-text-primary',
  thLast: 'py-2 font-semibold text-text-primary',
  tbodyRow: 'border-b border-border/80',
  tbodyRowLast: '',
  td: 'py-2 pr-4 tabular-nums',
  tdLast: 'py-2 tabular-nums',
  rowHeader:
    'py-2 pr-4 font-medium text-text-secondary',
} as const
