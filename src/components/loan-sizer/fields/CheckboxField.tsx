import { forwardRef } from 'react'
import { cn } from '../../../lib/cn'

export interface CheckboxFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label: string
  description?: string
  inputId: string
}

export const CheckboxField = forwardRef<HTMLInputElement, CheckboxFieldProps>(
  function CheckboxField(
    { label, description, className, inputId, disabled, ...rest },
    ref,
  ) {
    return (
      <div className={cn('flex gap-3 rounded-lg border border-border bg-surface-muted/60 p-3', className)}>
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          disabled={disabled}
          aria-describedby={description ? `${inputId}-desc` : undefined}
          className="focus-visible:ring-brand mt-0.5 size-4 shrink-0 rounded border-border text-brand outline-none focus-visible:ring-2"
          {...rest}
        />
        <div className="min-w-0">
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-text-primary"
          >
            {label}
          </label>
          {description ? (
            <p id={`${inputId}-desc`} className="mt-0.5 text-xs text-text-secondary">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    )
  },
)
