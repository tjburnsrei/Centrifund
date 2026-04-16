import { useId } from 'react'
import { cn } from '../../../lib/cn'
import { formatCurrency, formatPercent } from '../../../domain/loanSizer'

export interface RequestedLoanSliderProps {
  label: string
  description?: string
  value: number | null
  onValueChange: (value: number) => void
  min: number
  max: number | null
  step?: number
  disabled?: boolean
  disabledReason?: string
  purchasePrice?: number | null
}

const SLIDER_STEP_USD = 1_000

export function RequestedLoanSlider({
  label,
  description,
  value,
  onValueChange,
  min,
  max,
  step = SLIDER_STEP_USD,
  disabled,
  disabledReason,
  purchasePrice,
}: RequestedLoanSliderProps) {
  const id = useId()
  const effectiveMax = max ?? 0
  const normalizedMin = Math.max(0, Math.min(min, effectiveMax))
  const normalizedValue =
    value === null || !Number.isFinite(value)
      ? normalizedMin
      : Math.min(effectiveMax, Math.max(normalizedMin, value))

  const isDisabled = Boolean(disabled) || max === null || effectiveMax <= 0
  const percentOfPurchase =
    purchasePrice && purchasePrice > 0
      ? normalizedValue / purchasePrice
      : null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label
          htmlFor={id}
          className="text-sm font-medium text-text-primary"
        >
          {label}
        </label>
        <span
          className="text-base font-semibold tabular-nums text-text-primary"
          aria-live="polite"
        >
          {formatCurrency(normalizedValue)}
          {percentOfPurchase !== null ? (
            <span className="ml-2 text-xs font-medium text-text-secondary">
              {formatPercent(percentOfPurchase, 1)} of purchase
            </span>
          ) : null}
        </span>
      </div>
      {description ? (
        <p className="text-xs text-text-secondary">{description}</p>
      ) : null}
      <input
        id={id}
        type="range"
        min={normalizedMin}
        max={effectiveMax}
        step={step}
        value={normalizedValue}
        disabled={isDisabled}
        aria-valuemin={normalizedMin}
        aria-valuemax={effectiveMax}
        aria-valuenow={normalizedValue}
        onChange={(e) => {
          const next = Number.parseFloat(e.target.value)
          if (!Number.isFinite(next)) return
          const clamped = Math.min(effectiveMax, Math.max(normalizedMin, next))
          onValueChange(clamped)
        }}
        className={cn(
          'h-2 w-full cursor-pointer appearance-none rounded-full bg-surface-muted accent-brand',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      />
      <div className="flex items-center justify-between text-xs text-text-secondary">
        <span className="tabular-nums">{formatCurrency(normalizedMin)}</span>
        <span className="tabular-nums">
          {max !== null ? formatCurrency(effectiveMax) : '—'}
        </span>
      </div>
      {isDisabled && disabledReason ? (
        <p className="text-xs text-text-secondary">{disabledReason}</p>
      ) : null}
    </div>
  )
}
