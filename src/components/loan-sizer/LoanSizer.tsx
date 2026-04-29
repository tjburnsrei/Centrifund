import { useLoanSizer } from '../../hooks/useLoanSizer'
import {
  LoanSizerClosingCostsForm,
  LoanSizerForm,
  LoanSizerRequestedLeverageForm,
} from './LoanSizerForm'
import {
  AllowableLeverageCard,
  AssumptionsCard,
  BorrowerOutputsCard,
  FinancialOutputsCard,
  MessagesCard,
} from './LoanSizerSummary'
import { SectionCard } from './SectionCard'

function roundedPercent(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null
  return Number(Math.max(0, value).toFixed(2))
}

export function LoanSizer() {
  const { form, outputs } = useLoanSizer()
  const hasAlerts = outputs.warnings.length > 0
  const applyMaxRequestedLeverage = () => {
    const updates = [
      ['requestedPurchasePriceFinancedPct', outputs.maxInitialLtcPct],
      ['requestedConstructionFinancedPct', outputs.maxRehabLtcPct],
    ] as const

    for (const [field, value] of updates) {
      form.setValue(field, roundedPercent(value), {
        shouldDirty: true,
        shouldValidate: true,
      })
    }
  }

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
          id="requested-leverage"
          title="Requested leverage"
        >
          <div className="flex justify-end">
            <button
              type="button"
              onClick={applyMaxRequestedLeverage}
              className="inline-flex items-center justify-center rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-semibold text-text-primary shadow-sm transition hover:border-brand hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              Apply max
            </button>
          </div>
          <LoanSizerRequestedLeverageForm form={form} outputs={outputs} />
        </SectionCard>

        {hasAlerts ? <MessagesCard outputs={outputs} /> : null}

        <FinancialOutputsCard outputs={outputs} />

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
