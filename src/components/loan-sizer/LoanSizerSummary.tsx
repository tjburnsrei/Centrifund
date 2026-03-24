import { LOAN_TERM_MONTHS } from '../../domain/loanSizer'
import {
  formatCurrency,
  formatPercent,
  formatRate,
} from '../../domain/loanSizer/formatters'
import type { LoanSizerOutputs } from '../../domain/loanSizer/types'
import { ResultBadge } from './ResultBadge'
import { SectionCard } from './SectionCard'

export interface LoanSizerSummaryProps {
  outputs: LoanSizerOutputs
}

function profitabilityTone(
  p: LoanSizerOutputs['profitabilityResult'],
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (p === 'Pass') return 'success'
  if (p === 'Review') return 'warning'
  if (p === 'Ineligible') return 'danger'
  return 'neutral'
}

export function LoanSizerSummary({ outputs }: LoanSizerSummaryProps) {
  const eligLabel = outputs.isEligible ? 'Eligible (indicative)' : 'Not eligible'
  const eligTone = outputs.isEligible ? 'success' : 'danger'
  const eligPrefix = outputs.isEligible ? 'Status: eligible.' : 'Status: not eligible.'

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        id="auto-results"
        title="Auto-calculated results"
        description="Figures are indicative sizing only—not a credit decision."
      >
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium text-text-secondary">
              Project type
            </dt>
            <dd className="text-sm font-semibold text-text-primary">
              {outputs.projectType ?? '—'}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium text-text-secondary">
              Estimated tier
            </dt>
            <dd className="text-sm font-semibold text-text-primary">
              {outputs.estimatedTier ?? '—'}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium text-text-secondary">
              Profitability (v1 rule)
            </dt>
            <dd>
              <ResultBadge
                tone={profitabilityTone(outputs.profitabilityResult)}
                statusPrefix="Profitability result:"
              >
                {outputs.profitabilityResult ?? '—'}
              </ResultBadge>
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium text-text-secondary">
              Eligibility (indicative)
            </dt>
            <dd>
              <ResultBadge tone={eligTone} statusPrefix={eligPrefix}>
                {eligLabel}
              </ResultBadge>
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium text-text-secondary">Base rate</dt>
            <dd className="text-sm font-semibold text-text-primary">
              {formatRate(outputs.baseRate)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium text-text-secondary">Final rate</dt>
            <dd className="text-sm font-semibold text-text-primary">
              {formatRate(outputs.finalRate)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium text-text-secondary">
              Min FICO (scenario)
            </dt>
            <dd className="text-sm font-semibold text-text-primary">
              {outputs.minFico !== null ? String(outputs.minFico) : '—'}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium text-text-secondary">
              Max loan amount
            </dt>
            <dd className="text-sm font-semibold text-text-primary">
              {formatCurrency(outputs.maxLoanAmount)}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium text-text-secondary">Term</dt>
            <dd className="text-sm font-semibold text-text-primary">
              {LOAN_TERM_MONTHS} months
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs font-medium text-text-secondary">
              Lender fees (est.)
            </dt>
            <dd className="text-sm font-semibold text-text-primary">
              {formatCurrency(outputs.lenderFees)}
            </dd>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <dt className="text-xs font-medium text-text-secondary">
              Down payment needed
            </dt>
            <dd className="text-sm font-semibold text-text-primary">
              {formatCurrency(outputs.downPaymentNeeded)}
            </dd>
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <dt className="text-xs font-medium text-text-secondary">
              Est. cash to cover closing
            </dt>
            <dd className="text-sm font-semibold text-text-primary">
              {formatCurrency(outputs.estimatedCashToCoverClosing)}
            </dd>
          </div>
          {outputs.liquidityRequired !== null ? (
            <div className="flex flex-col gap-1 sm:col-span-2">
              <dt className="text-xs font-medium text-text-secondary">
                Liquidity required (Ground Up)
              </dt>
              <dd className="text-sm font-semibold text-text-primary">
                {formatCurrency(outputs.liquidityRequired)}
              </dd>
            </div>
          ) : null}
        </dl>
      </SectionCard>

      <SectionCard
        id="caps"
        title="Realized leverage (max scenario)"
        description="Ratios implied by max loan amounts vs your inputs."
      >
        <dl className="grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-text-secondary">Max Day 1 / AIV</dt>
            <dd className="text-sm font-medium">
              {outputs.maxLtv !== null
                ? formatPercent(outputs.maxLtv, 1)
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">
              Max total / (AIV + budget)
            </dt>
            <dd className="text-sm font-medium">
              {outputs.maxLtc !== null
                ? formatPercent(outputs.maxLtc, 1)
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-secondary">Max total / ARV</dt>
            <dd className="text-sm font-medium">
              {outputs.maxLtarv !== null
                ? formatPercent(outputs.maxLtarv, 1)
                : '—'}
            </dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard id="warnings" title="Messages & assumptions">
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
        <h3
          id="warnings-assumptions-subheading"
          className="mt-4 text-sm font-semibold text-text-primary"
        >
          Assumptions
        </h3>
        <ul
          className="mt-1 list-inside list-disc space-y-1 text-xs text-text-secondary"
          aria-labelledby="warnings-assumptions-subheading"
          role="list"
        >
          {outputs.assumptions.map((a, i) => (
            <li key={`${i}-${a.slice(0, 48)}`}>{a}</li>
          ))}
        </ul>
      </SectionCard>
    </div>
  )
}
