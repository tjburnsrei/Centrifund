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
const LOCAL_DEAL_LOGS_KEY = 'centrifundDealLogs'

interface DealLogPayload {
  streetAddress: string
  notes: string
  inputs: LoanSizerFormValues
  outputs: LoanSizerOutputs
}

interface LocalDealLog extends DealLogPayload {
  id: string
  createdAt: string
}

function readLocalDealLogs(): LocalDealLog[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(LOCAL_DEAL_LOGS_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? (parsed as LocalDealLog[]) : []
  } catch {
    return []
  }
}

function saveLocalDealLog(payload: DealLogPayload): LocalDealLog | null {
  if (typeof window === 'undefined') return null
  try {
    const record: LocalDealLog = {
      id: `local_${Date.now()}`,
      createdAt: new Date().toISOString(),
      ...payload,
    }
    const logs = [record, ...readLocalDealLogs()].slice(0, 200)
    window.localStorage.setItem(LOCAL_DEAL_LOGS_KEY, JSON.stringify(logs))
    return record
  } catch {
    return null
  }
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replaceAll('"', '""')}"`
}

function buildLocalCsv(logs: LocalDealLog[]): string {
  const headers = [
    'Created At',
    'Street Address',
    'Notes',
    'Purchase Price',
    'Rehab Budget',
    'Estimated ARV',
    'Requested Purchase %',
    'Requested Construction %',
    'Purchase Money Loan',
    'Rehab Loan',
    'Final Rate',
    'Project Type',
    'Tier',
  ]
  const rows = logs.map((log) => [
    log.createdAt,
    log.streetAddress,
    log.notes,
    log.inputs.purchasePriceOrAsIsValue,
    log.inputs.projectBudget,
    log.inputs.estimatedArv,
    log.inputs.requestedPurchasePriceFinancedPct,
    log.inputs.requestedConstructionFinancedPct,
    log.outputs.purchaseMoneyLoan,
    log.outputs.rehabLoan,
    log.outputs.finalRate,
    log.outputs.projectType,
    log.outputs.estimatedTier,
  ])
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')
}

export function LoanSizerDealLogForm({
  values,
  outputs,
}: LoanSizerDealLogFormProps) {
  const [streetAddress, setStreetAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [localLogCount, setLocalLogCount] = useState(
    () => readLocalDealLogs().length,
  )

  const submitLabel =
    submitState === 'submitting' ? 'Logging deal...' : 'Log deal / send feedback'

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitState('submitting')
    setMessage(null)
    const payload: DealLogPayload = {
      streetAddress,
      notes,
      inputs: values,
      outputs,
    }

    try {
      const response = await fetch('/api/deal-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Unable to save this deal log.')
      }

      const result: unknown = await response.json().catch(() => null)
      const savedToVercelLogs =
        typeof result === 'object' &&
        result !== null &&
        'log' in result &&
        typeof result.log === 'object' &&
        result.log !== null &&
        'storage' in result.log &&
        result.log.storage === 'vercel_logs'

      if (savedToVercelLogs && saveLocalDealLog(payload)) {
        setLocalLogCount(readLocalDealLogs().length)
        setMessage('Deal log saved to Vercel logs and local CSV export.')
      } else {
        setMessage('Deal log saved for internal review.')
      }

      setStreetAddress('')
      setNotes('')
      setSubmitState('success')
    } catch {
      const localRecord = saveLocalDealLog(payload)
      if (localRecord) {
        setStreetAddress('')
        setNotes('')
        setLocalLogCount(readLocalDealLogs().length)
        setSubmitState('success')
        setMessage('Deal log saved locally in this browser. Download the CSV for review.')
      } else {
        setSubmitState('error')
        setMessage('Deal logging is not available yet. Try again later.')
      }
    }
  }

  function handleDownloadCsv() {
    const logs = readLocalDealLogs()
    if (logs.length === 0) {
      setMessage('No local deal logs are available to download.')
      return
    }
    const csv = `\uFEFF${buildLocalCsv(logs)}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `centrifund-deal-logs-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div className="grid gap-4">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="dealLogStreetAddress"
            className="text-sm font-medium text-text-primary"
          >
            Street address
          </label>
          <input
            id="dealLogStreetAddress"
            type="text"
            value={streetAddress}
            onChange={(event) => setStreetAddress(event.target.value)}
            maxLength={300}
            placeholder="Property street address"
            autoComplete="street-address"
            className={textLikeInputClassName('px-3 py-2')}
          />
        </div>
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
        Street address is saved with this log. Do not include borrower names,
        emails, phone numbers, or other sensitive personal information.
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
        <div className="flex flex-wrap items-center justify-end gap-2">
          {localLogCount > 0 ? (
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="inline-flex items-center justify-center rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-text-primary shadow-sm transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              Download local CSV
            </button>
          ) : null}
          <button
            type="submit"
            disabled={submitState === 'submitting'}
            className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </form>
  )
}
