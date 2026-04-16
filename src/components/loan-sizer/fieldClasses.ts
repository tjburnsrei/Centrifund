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
