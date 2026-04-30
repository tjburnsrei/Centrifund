import { useState } from 'react'
import {
  type LoanSizerFormValues,
  type LoanSizerOutputs,
} from '../../domain/loanSizer'
import { textLikeInputClassName } from './fieldClasses'

export interface LoanSizerDealLogFormProps {
  values: LoanSizerFormValues
  outputs: LoanSizerOutputs
}

type SubmitState = 'idle' | 'submitting' | 'success' | 'error'

export function LoanSizerDealLogForm({
  values,
  outputs,
}: LoanSizerDealLogFormProps) {
  const [notes, setNotes] = useState('')
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const submitLabel =
    submitState === 'submitting' ? 'Logging deal...' : 'Log deal / send feedback'

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitState('submitting')
    setMessage(null)

    try {
      const response = await fetch('/api/deal-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notes,
          inputs: values,
          outputs,
        }),
      })

      if (!response.ok) {
        throw new Error('Unable to save this deal log.')
      }

      setNotes('')
      setSubmitState('success')
      setMessage('Deal log saved for internal review.')
    } catch {
      setSubmitState('error')
      setMessage(
        'Deal logging is not available yet. Confirm the database is configured and try again.',
      )
    }
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div className="grid gap-4">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="dealLogNotes"
            className="text-sm font-medium text-text-primary"
          >
            Notes
          </label>
          <textarea
            id="dealLogNotes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Optional notes about the scenario, pricing issue, or expected output."
            className={textLikeInputClassName('min-h-20 px-3 py-2')}
          />
        </div>
      </div>
      <p className="text-xs text-text-secondary">
        Do not include borrower names, emails, phone numbers, addresses, or
        other sensitive personal information.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        {message ? (
          <p
            className={
              submitState === 'success'
                ? 'text-xs font-medium text-success'
                : 'text-xs font-medium text-danger'
            }
            role="status"
          >
            {message}
          </p>
        ) : (
          <span aria-hidden="true" />
        )}
        <button
          type="submit"
          disabled={submitState === 'submitting'}
          className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  )
}
