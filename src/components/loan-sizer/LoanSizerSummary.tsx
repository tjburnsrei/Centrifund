import {
  formatCurrency,
  formatRate,
} from '../../domain/loanSizer/formatters'
import type { LoanSizerOutputs } from '../../domain/loanSizer/types'
import { ResultBadge } from './ResultBadge'
import { SectionCard } from './SectionCard'

export interface OutputCardsProps {
  outputs: LoanSizerOutputs
}

export function AllowableLeverageCard({ outputs }: OutputCardsProps) {
  return (
    <SectionCard
      id="allowable-leverage"
      title="Allowable leverage"
      description="Tier and product caps after all adjustments. Rehab is assumed 100% funded."
    >
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-text-secondary">
            Max initial LTC
          </dt>
          <dd className="text-lg font-semibold tabular-nums text-text-primary">
            {outputs.maxInitialLtcPct !== null
              ? `${outputs.maxInitialLtcPct.toFixed(0)}%`
              : '—'}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-text-secondary">
            Max total LTC
          </dt>
          <dd className="text-lg font-semibold tabular-nums text-text-primary">
            {outputs.maxTotalLtcPct !== null
              ? `${outputs.maxTotalLtcPct.toFixed(0)}%`
              : '—'}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-text-secondary">
            Max LTV (ARV)
          </dt>
          <dd className="text-lg font-semibold tabular-nums text-text-primary">
            {outputs.maxArvLtvPct !== null
              ? `${outputs.maxArvLtvPct.toFixed(0)}%`
              : '—'}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-text-secondary">
        Rehab is assumed to be 100% funded.
      </p>
    </SectionCard>
  )
}

export function MessagesCard({ outputs }: OutputCardsProps) {
  return (
    <SectionCard id="messages" title="Messages">
      {outputs.warnings.length > 0 ? (
        <ul
          className="list-inside list-disc space-y-1 text-sm text-danger"
          role="list"
        >
          {outputs.warnings.map((w, i) => (
            <li key={`${i}-${w.slice(0, 48)}`}>{w}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-secondary">No alerts.</p>
      )}
    </SectionCard>
  )
}

export function CalculationsCard({ outputs }: OutputCardsProps) {
  const eligLabel = outputs.isEligible ? 'Eligible (indicative)' : 'Not eligible'
  const eligTone = outputs.isEligible ? 'success' : 'danger'
  const eligPrefix = outputs.isEligible
    ? 'Status: eligible.'
    : 'Status: not eligible.'

  return (
    <SectionCard
      id="calculations"
      title="Calculations"
      description="Indicative pricing and sizing—not a credit decision."
    >
      <dl className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-text-secondary">Rate</dt>
          <dd className="text-lg font-semibold tabular-nums text-text-primary">
            {formatRate(outputs.finalRate)}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-text-secondary">
            Max loan amount
          </dt>
          <dd className="text-lg font-semibold tabular-nums text-text-primary">
            {formatCurrency(outputs.maxLoanAmount)}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-text-secondary">
            Project type
          </dt>
          <dd className="text-sm font-semibold text-text-primary">
            {outputs.projectType ?? '—'}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-text-secondary">Tier</dt>
          <dd className="text-sm font-semibold text-text-primary">
            {outputs.estimatedTier ?? '—'}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-text-secondary">
            Eligibility
          </dt>
          <dd>
            <ResultBadge tone={eligTone} statusPrefix={eligPrefix}>
              {eligLabel}
            </ResultBadge>
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-text-secondary">
            Max Day 1 loan
          </dt>
          <dd className="text-sm font-semibold tabular-nums text-text-primary">
            {formatCurrency(outputs.maxDay1Loan)}
          </dd>
        </div>
      </dl>
    </SectionCard>
  )
}

export function BorrowerOutputsCard({ outputs }: OutputCardsProps) {
  return (
    <SectionCard
      id="borrower-outputs"
      title="Borrower outputs"
      description="Estimated monthly obligation and cash needed to close."
    >
      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-text-secondary">
            Estimated monthly payment
          </dt>
          <dd className="text-lg font-semibold tabular-nums text-text-primary">
            {formatCurrency(outputs.estimatedMonthlyPayment)}
          </dd>
          <p className="text-xs text-text-secondary">
            Interest-only on the requested Day 1 loan.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-text-secondary">
            Down payment needed
          </dt>
          <dd className="text-lg font-semibold tabular-nums text-text-primary">
            {formatCurrency(outputs.downPaymentNeeded)}
          </dd>
          <p className="text-xs text-text-secondary">
            Purchase price minus the requested Day 1 loan.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-text-secondary">
            Cash to cover closing
          </dt>
          <dd className="text-lg font-semibold tabular-nums text-text-primary">
            {formatCurrency(outputs.estimatedCashToCoverClosing)}
          </dd>
          <p className="text-xs text-text-secondary">
            Down payment plus broker points and fees entered below.
          </p>
        </div>
      </dl>
    </SectionCard>
  )
}

export function AssumptionsCard({ outputs }: OutputCardsProps) {
  return (
    <details className="group overflow-hidden rounded-xl border border-border bg-white shadow-sm">
      <summary className="cursor-pointer list-none px-4 py-3 md:px-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              Assumptions
            </h2>
            <p className="mt-1 text-xs text-text-secondary">
              Methodology notes and workbook mapping assumptions.
            </p>
          </div>
          <span className="text-xs font-medium text-text-secondary group-open:hidden">
            Show
          </span>
          <span className="hidden text-xs font-medium text-text-secondary group-open:inline">
            Hide
          </span>
        </div>
      </summary>
      <div className="border-t border-border px-4 py-4 md:px-5">
        <ul
          className="list-inside list-disc space-y-1 text-xs text-text-secondary"
          role="list"
        >
          {outputs.assumptions.map((a, i) => (
            <li key={`${i}-${a.slice(0, 48)}`}>{a}</li>
          ))}
        </ul>
      </div>
    </details>
  )
}

// Re-export the shape that external consumers (tests) may still need.
export type { LoanSizerOutputs }

// Legacy aggregate export used by potential external consumers.
export interface LoanSizerSummaryProps {
  outputs: LoanSizerOutputs
}

export function LoanSizerSummary({ outputs }: LoanSizerSummaryProps) {
  return (
    <div className="flex flex-col gap-4">
      <CalculationsCard outputs={outputs} />
      <BorrowerOutputsCard outputs={outputs} />
      <MessagesCard outputs={outputs} />
    </div>
  )
}
