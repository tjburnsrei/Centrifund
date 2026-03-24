import { forwardRef } from 'react'
import { cn } from '../../../lib/cn'
import { textLikeInputClassName } from '../fieldClasses'

export interface CurrencyInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange' | 'type' | 'size'
  > {
  label: string
  description?: string
  error?: string
  value: number | null
  onValueChange: (value: number | null) => void
  inputId: string
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  function CurrencyInput(
    { label, description, error, value, onValueChange, className, inputId, disabled, ...rest },
    ref,
  ) {
    const display =
      value === null || Number.isNaN(value) ? '' : String(Math.round(value))

    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-text-primary"
        >
          {label}
        </label>
        {description ? (
          <p id={`${inputId}-desc`} className="text-xs text-text-secondary">
            {description}
          </p>
        ) : null}
        <div className="relative">
          <span
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"
            aria-hidden
          >
            $
          </span>
          <input
            ref={ref}
            id={inputId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={
              [description ? `${inputId}-desc` : '', error ? `${inputId}-err` : '']
                .filter(Boolean)
                .join(' ') || undefined
            }
            className={cn(
              textLikeInputClassName('py-2 pl-7 pr-3'),
              error && 'border-danger',
            )}
            value={display}
            onChange={(e) => {
              const raw = e.target.value.replace(/,/g, '').trim()
              if (raw === '') {
                onValueChange(null)
                return
              }
              const n = Number.parseFloat(raw)
              if (Number.isNaN(n)) {
                onValueChange(null)
                return
              }
              onValueChange(n)
            }}
            {...rest}
          />
        </div>
        {error ? (
          <p id={`${inputId}-err`} className="text-xs text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    )
  },
)
