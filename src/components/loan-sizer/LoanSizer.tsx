import { useLoanSizer } from '../../hooks/useLoanSizer'
import { LoanSizerForm } from './LoanSizerForm'
import { LoanSizerSummary } from './LoanSizerSummary'
import { LoanSizerTables } from './LoanSizerTables'

export function LoanSizer() {
  const { form, outputs } = useLoanSizer()

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <header className="mb-8 border-b border-border pb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">
          Centrifund
        </p>
        <h1 className="mt-1 text-2xl font-bold text-text-primary md:text-3xl">
          Fix &amp; Flip loan sizer
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-text-secondary">
          Indicative sizing from program rules configured for Wholesale (Tier 1)
          Fix &amp; Flip. Outputs update live as you edit the deal.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-start">
        <LoanSizerForm form={form} />
        <aside
          className="flex flex-col gap-4 lg:sticky lg:top-4"
          aria-label="Calculated loan results"
          aria-live="polite"
          aria-relevant="text"
        >
          <LoanSizerSummary outputs={outputs} />
          <LoanSizerTables outputs={outputs} />
        </aside>
      </div>
    </div>
  )
}
