import {
  formatCurrency,
  formatRate,
} from '../../domain/loanSizer/formatters'
import type { LoanSizerOutputs } from '../../domain/loanSizer/types'
import { SectionCard } from './SectionCard'

export interface OutputCardsProps {
  outputs: LoanSizerOutputs
}

function formatWholePercent(value: number | null): string {
  return value !== null ? `${value.toFixed(0)}%` : '-'
}

export function AllowableLeverageCard({ outputs }: OutputCardsProps) {
  return (
    <SectionCard id="allowable-leverage" title="Allowable leverage">
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-text-secondary">Total LTC</dt>
          <dd className="text-lg font-semibold tabular-nums text-text-primary">
            {formatWholePercent(outputs.guideTotalLtcPct)}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-text-secondary">
            Total LTARV
          </dt>
          <dd className="text-lg font-semibold tabular-nums text-text-primary">
            {formatWholePercent(outputs.guideArvLtvPct)}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-text-secondary">
            % of Purchase Price Financed
          </dt>
          <dd className="text-lg font-semibold tabular-nums text-text-primary">
            {formatWholePercent(outputs.guideInitialLtcPct)}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-text-secondary">
            % of Construction Financed
          </dt>
          <dd className="text-lg font-semibold tabular-nums text-text-primary">
            {formatWholePercent(outputs.guideRehabLtcPct)}
          </dd>
        </div>
      </dl>
    </SectionCard>
  )
}

export function MessagesCard({ outputs }: OutputCardsProps) {
  if (outputs.warnings.length === 0) return null

  return (
    <SectionCard
      id="messages"
      title="Messages"
      className="border-danger/35 bg-danger/5"
    >
      <ul
        className="list-inside list-disc space-y-1 text-xs text-danger"
        role="list"
      >
        {outputs.warnings.map((w, i) => (
          <li key={`${i}-${w.slice(0, 48)}`}>{w}</li>
        ))}
      </ul>
    </SectionCard>
  )
}

export function CalculationsCard({ outputs }: OutputCardsProps) {
  return (
    <SectionCard id="calculations" title="Calculations">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-text-secondary">Rate</dt>
          <dd className="text-lg font-semibold tabular-nums text-text-primary">
            {formatRate(outputs.finalRate)}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-text-secondary">
            Project type
          </dt>
          <dd className="text-sm font-semibold text-text-primary">
            {outputs.projectType ?? '-'}
          </dd>
        </div>
      </dl>
    </SectionCard>
  )
}

export function FinancialOutputsCard({ outputs }: OutputCardsProps) {
  return (
    <SectionCard id="financial-outputs" title="Financial outputs">
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-text-secondary">
            Purchase Money Loan
          </dt>
          <dd className="text-lg font-semibold tabular-nums text-text-primary">
            {formatCurrency(outputs.purchaseMoneyLoan)}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-text-secondary">
            Rehab Loan
          </dt>
          <dd className="text-lg font-semibold tabular-nums text-text-primary">
            {formatCurrency(outputs.rehabLoan)}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-text-secondary">Rate</dt>
          <dd className="text-lg font-semibold tabular-nums text-text-primary">
            {formatRate(outputs.finalRate)}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-text-secondary">Term</dt>
          <dd className="text-lg font-semibold tabular-nums text-text-primary">
            {outputs.termMonths !== null ? `${outputs.termMonths} months` : '-'}
          </dd>
        </div>
      </dl>
    </SectionCard>
  )
}

export function BorrowerOutputsCard({ outputs }: OutputCardsProps) {
  return (
    <SectionCard id="borrower-outputs" title="Borrower outputs">
      <dl className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-text-secondary">
            Estimated monthly payment
          </dt>
          <dd className="text-lg font-semibold tabular-nums text-text-primary">
            {formatCurrency(outputs.estimatedMonthlyPayment)}
          </dd>
          <p className="text-xs text-text-secondary">
            Interest-only on the purchase money loan.
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
            Purchase price minus the purchase money loan.
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
      <FinancialOutputsCard outputs={outputs} />
      <BorrowerOutputsCard outputs={outputs} />
      <MessagesCard outputs={outputs} />
    </div>
  )
}
