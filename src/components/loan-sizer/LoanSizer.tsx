import { Controller } from 'react-hook-form'
import { useLoanSizer } from '../../hooks/useLoanSizer'
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-6">
      <header className="mb-8 border-b border-border pb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">
          Centrifund
        </p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary md:text-3xl">
          Fix &amp; Flip loan sizer
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          Indicative sizing from program rules configured for Wholesale
          (Tier 1) Fix &amp; Flip.
        </p>
      </header>

      <div
        className="flex flex-col gap-6"
        aria-live="polite"
        aria-relevant="text"
      >
        <LoanSizerForm form={form} />

        <AllowableLeverageCard outputs={outputs} />

        <SectionCard
          id="requested-loan"
          title="Requested purchase loan"
          description="Slide to your desired Day 1 loan. The slider is capped at the maximum allowed by your inputs."
        >
          <Controller
            name="requestedDay1LoanAmount"
            control={form.control}
            render={({ field }) => (
              <RequestedLoanSlider
                label="Day 1 loan amount"
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

        <MessagesCard outputs={outputs} />

        <CalculationsCard outputs={outputs} />

        <SectionCard
          id="closing-costs"
          title="Closing costs"
          description="Broker points and third-party fees used in cash to cover closing."
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
