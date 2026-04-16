import { forwardRef } from 'react'
import { cn } from '../../../lib/cn'
import { textLikeInputClassName } from '../fieldClasses'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectInputProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label: string
  description?: string
  inlineDescription?: string
  error?: string
  options: readonly SelectOption[]
  inputId: string
}

export const SelectInput = forwardRef<HTMLSelectElement, SelectInputProps>(
  function SelectInput(
    {
      label,
      description,
      inlineDescription,
      error,
      options,
      className,
      inputId,
      disabled,
      ...rest
    },
    ref,
  ) {
    return (
      <div className={cn('flex flex-col gap-1', className)}>
        <label
          htmlFor={inputId}
          className="flex items-baseline gap-2 text-sm font-medium text-text-primary"
        >
          {label}
          {inlineDescription ? (
            <span className="text-[11px] font-normal text-text-secondary">
              {inlineDescription}
            </span>
          ) : null}
        </label>
        {description ? (
          <p id={`${inputId}-desc`} className="text-xs text-text-secondary">
            {description}
          </p>
        ) : null}
        <select
          ref={ref}
          id={inputId}
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
          {...rest}
        >
          {options.map((o) => (
            <option key={o.value || '__empty'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {error ? (
          <p id={`${inputId}-err`} className="text-xs text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    )
  },
)
