import { forwardRef, useState } from 'react'
import { cn } from '../../../lib/cn'
import { textLikeInputClassName } from '../fieldClasses'

export interface NumberInputProps
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

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  function NumberInput(
    {
      label,
      description,
      error,
      value,
      onValueChange,
      className,
      inputId,
      disabled,
      onBlur,
      onFocus,
      ...rest
    },
    ref,
  ) {
    const formatValue = (n: number | null) =>
      n === null || Number.isNaN(n) ? '' : String(n)
    const [draft, setDraft] = useState<string | null>(null)
    const display = draft ?? formatValue(value)

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
            textLikeInputClassName('px-3 py-2'),
            error && 'border-danger',
          )}
          value={display}
          onChange={(e) => {
            const raw = e.target.value.trim()
            setDraft(e.target.value)
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
          onFocus={(e) => {
            setDraft(formatValue(value))
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setDraft(null)
            onBlur?.(e)
          }}
          {...rest}
        />
        {error ? (
          <p id={`${inputId}-err`} className="text-xs text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    )
  },
)
