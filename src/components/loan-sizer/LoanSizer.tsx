import { Controller } from 'react-hook-form'
import { useLoanSizer } from '../../hooks/useLoanSizer'
import { formatCurrency } from '../../domain/loanSizer/formatters'
import {
  LoanSizerClosingCostsForm,
  LoanSizerForm,
} from './LoanSizerForm'
import {
  AllowableLeverageCard,
  AssumptionsCard,
  BorrowerOutputsCard,
  CalculationsCard,
  MessagesCard,
} from './LoanSizerSummary'
import { RequestedLoanSlider } from './fields/RequestedLoanSlider'
import { SectionCard } from './SectionCard'

const SLIDER_MIN_PERCENT_OF_PURCHASE = 0.1

export function LoanSizer() {
  const { form, outputs, values } = useLoanSizer()
  const purchasePrice = values.purchasePriceOrAsIsValue ?? 0
  const sliderMin = Math.max(
    0,
    Math.round(purchasePrice * SLIDER_MIN_PERCENT_OF_PURCHASE),
  )
  const sliderMax = outputs.maxDay1Loan
  const sliderDisabledReason =
    outputs.maxDay1Loan === null
      ? outputs.warnings[0] ??
        'Complete the deal inputs above to see your max Day 1 loan.'
      : undefined
  const hasAlerts = outputs.warnings.length > 0
  const requestedLoanTitle = `Requested purchase loan - ${formatCurrency(
    values.requestedDay1LoanAmount,
  )}`

  return (
    <div className="mx-auto w-full max-w-[1500px] px-3 py-5 md:px-4">
      <header className="mb-5 border-b border-border pb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">
          Centrifund
        </p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary md:text-3xl">
          Fix and Flip Loan Sizer
        </h1>
      </header>

      <div
        className="flex flex-col gap-4"
        aria-live="polite"
        aria-relevant="text"
      >
        <LoanSizerForm form={form} />

        <AllowableLeverageCard outputs={outputs} />

        <SectionCard
          id="requested-loan"
          title={requestedLoanTitle}
        >
          <Controller
            name="requestedDay1LoanAmount"
            control={form.control}
            render={({ field }) => (
              <RequestedLoanSlider
                label="Day 1 loan amount"
                showHeader={false}
                value={field.value}
                onValueChange={(v) => field.onChange(v)}
                min={sliderMin}
                max={sliderMax}
                purchasePrice={purchasePrice > 0 ? purchasePrice : null}
                disabledReason={sliderDisabledReason}
              />
            )}
          />
        </SectionCard>

        {hasAlerts ? <MessagesCard outputs={outputs} /> : null}

        <CalculationsCard outputs={outputs} />

        <SectionCard
          id="closing-costs"
          title="Closing costs"
        >
          <LoanSizerClosingCostsForm form={form} />
        </SectionCard>

        <BorrowerOutputsCard outputs={outputs} />

        <div className="flex justify-end">
          <button
            type="button"
            disabled
            title="Coming soon"
            aria-disabled="true"
            className="inline-flex items-center justify-center rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            Generate term sheet
          </button>
        </div>

        <AssumptionsCard outputs={outputs} />
      </div>
    </div>
  )
}
