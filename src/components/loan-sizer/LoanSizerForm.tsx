import { Controller, type UseFormReturn, useWatch } from 'react-hook-form'
import {
  NEW_YORK_CODE,
  RATE_SHEET_CONFIG,
  US_STATE_CODES,
  type LoanSizerFormValues,
} from '../../domain/loanSizer'
import { FICO_BAND_OPTIONS } from '../../hooks/useLoanSizer'
import { CheckboxField } from './fields/CheckboxField'
import { CurrencyInput } from './fields/CurrencyInput'
import { NumberInput } from './fields/NumberInput'
import { SelectInput } from './fields/SelectInput'
import { SectionCard } from './SectionCard'

const STATE_OPTIONS = US_STATE_CODES.map((code) => ({
  value: code,
  label: code,
}))

const FICO_SELECT_OPTIONS = FICO_BAND_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}))

const NY_COUNTY_OPTIONS = [
  ...RATE_SHEET_CONFIG.adjustments.newYorkHeavyCounties,
  ...RATE_SHEET_CONFIG.adjustments.newYorkModerateCounties,
]
  .slice()
  .sort((a, b) => a.localeCompare(b))
  .map((c) => ({ value: c, label: c }))

export interface LoanSizerFormProps {
  form: UseFormReturn<LoanSizerFormValues>
}

export function LoanSizerForm({ form }: LoanSizerFormProps) {
  const { control, formState, setValue } = form
  const e = formState.errors
  const [roofRemoval, wallRemoval, propertyState] = useWatch({
    control,
    name: ['roofRemoval', 'wallRemoval', 'propertyState'],
  })
  const showPermits = Boolean(roofRemoval || wallRemoval)
  const countyEnabled = propertyState === NEW_YORK_CODE

  return (
    <div className="flex flex-col gap-4">
      <SectionCard id="deal-metrics" title="Deal metrics">
        <fieldset className="space-y-4">
          <legend className="sr-only">Property location</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              name="propertyState"
              control={control}
              render={({ field }) => (
                <SelectInput
                  inputId="propertyState"
                  label="Property state"
                  error={e.propertyState?.message}
                  options={STATE_OPTIONS}
                  {...field}
                  onChange={(ev) => {
                    field.onChange(ev)
                    if (ev.target.value !== NEW_YORK_CODE) {
                      setValue('propertyCounty', null, { shouldDirty: true })
                    }
                  }}
                />
              )}
            />
            <Controller
              name="propertyCounty"
              control={control}
              render={({ field }) => (
                <SelectInput
                  inputId="propertyCounty"
                  label="Property county"
                  inlineDescription={
                    countyEnabled
                      ? 'Required for New York select-county leverage adjustments.'
                      : 'Not required for this state.'
                  }
                  disabled={!countyEnabled}
                  options={[
                    { value: '', label: countyEnabled ? 'Select county…' : '—' },
                    ...NY_COUNTY_OPTIONS,
                  ]}
                  value={field.value ?? ''}
                  onChange={(ev) =>
                    field.onChange(ev.target.value === '' ? null : ev.target.value)
                  }
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              )}
            />
          </div>
        </fieldset>

        <fieldset className="space-y-4 border-t border-border pt-4">
          <legend className="sr-only">Borrower profile</legend>
          <div className="grid gap-4 md:grid-cols-3">
            <Controller
              name="guarantorExperience"
              control={control}
              render={({ field }) => (
                <SelectInput
                  inputId="experience"
                  label="Guarantor experience"
                  options={[
                    { value: '0-2', label: '0–2 (Silver tier)' },
                    { value: '3-4', label: '3–4 (Gold tier)' },
                    { value: '5+', label: '5+ (Platinum tier)' },
                  ]}
                  {...field}
                />
              )}
            />
            <Controller
              name="ficoBand"
              control={control}
              render={({ field }) => (
                <SelectInput
                  inputId="ficoBand"
                  label="Qualifying FICO"
                  options={FICO_SELECT_OPTIONS}
                  {...field}
                />
              )}
            />
            <Controller
              name="citizenship"
              control={control}
              render={({ field }) => (
                <SelectInput
                  inputId="citizenship"
                  label="Citizenship"
                  options={[
                    { value: 'domestic', label: 'Domestic' },
                    { value: 'foreignNational', label: 'Foreign national' },
                  ]}
                  {...field}
                />
              )}
            />
          </div>
        </fieldset>
      </SectionCard>

      <SectionCard id="financial-inputs" title="Financial inputs">
        <div className="grid gap-4 md:grid-cols-3">
          <Controller
            name="purchasePriceOrAsIsValue"
            control={control}
            render={({ field }) => (
              <CurrencyInput
                inputId="purchasePrice"
                label="Purchase price"
                error={e.purchasePriceOrAsIsValue?.message}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
          <Controller
            name="projectBudget"
            control={control}
            render={({ field }) => (
              <CurrencyInput
                inputId="projectBudget"
                label="Rehab budget"
                error={e.projectBudget?.message}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
          <Controller
            name="estimatedArv"
            control={control}
            render={({ field }) => (
              <CurrencyInput
                inputId="estimatedArv"
                label="Estimated ARV"
                error={e.estimatedArv?.message}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
        </div>
      </SectionCard>

      <details className="group rounded-lg border border-border/80 bg-white shadow-sm">
        <summary className="cursor-pointer list-none px-3 py-2 md:px-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <p className="text-sm font-semibold text-text-primary">
                Advanced scenarios
              </p>
              <p className="text-[11px] text-text-secondary">
                Only needed for structural/GUC deals and condo adjustments.
              </p>
            </div>
            <span className="text-[11px] font-medium text-text-secondary group-open:hidden">
              Show
            </span>
            <span className="hidden text-[11px] font-medium text-text-secondary group-open:inline">
              Hide
            </span>
          </div>
        </summary>
        <div className="space-y-3 border-t border-border px-3 py-3 md:px-4">
          <Controller
            name="roofRemoval"
            control={control}
            render={({ field }) => (
              <CheckboxField
                inputId="roofRemoval"
                label="Roof removal"
                checked={field.value ?? false}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
          <Controller
            name="wallRemoval"
            control={control}
            render={({ field }) => (
              <CheckboxField
                inputId="wallRemoval"
                label="Load-bearing wall removal"
                checked={field.value ?? false}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
          {showPermits ? (
            <Controller
              name="permitsApprovedOrImminent"
              control={control}
              render={({ field }) => (
                <CheckboxField
                  inputId="permits"
                  label="Permits approved or imminent"
                  description="Applies the GUC initial LTC permits bonus when the project auto-classifies as GUC."
                  checked={field.value ?? false}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              )}
            />
          ) : null}
          <Controller
            name="nonWarrantableCondo"
            control={control}
            render={({ field }) => (
              <CheckboxField
                inputId="condo"
                label="Non-warrantable condo"
                description="Applies condo leverage adjustment after other geographic adjustments."
                checked={field.value ?? false}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
        </div>
      </details>
    </div>
  )
}

export interface LoanSizerClosingCostsFormProps {
  form: UseFormReturn<LoanSizerFormValues>
}

export function LoanSizerClosingCostsForm({
  form,
}: LoanSizerClosingCostsFormProps) {
  const { control, formState } = form
  const e = formState.errors
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Controller
        name="brokerPointsPct"
        control={control}
        render={({ field }) => (
          <NumberInput
            inputId="brokerPoints"
            label="Broker points (%)"
            error={e.brokerPointsPct?.message}
            value={field.value ?? null}
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
            ref={field.ref}
          />
        )}
      />
      <Controller
        name="underwritingFeeUsd"
        control={control}
        render={({ field }) => (
          <CurrencyInput
            inputId="underwritingFee"
            label="Underwriting fee"
            error={e.underwritingFeeUsd?.message}
            value={field.value ?? null}
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
            ref={field.ref}
          />
        )}
      />
      <Controller
        name="attorneyFeeUsd"
        control={control}
        render={({ field }) => (
          <CurrencyInput
            inputId="attorneyFee"
            label="Attorney fee"
            error={e.attorneyFeeUsd?.message}
            value={field.value ?? null}
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
            ref={field.ref}
          />
        )}
      />
      <Controller
        name="appraisalFeeUsd"
        control={control}
        render={({ field }) => (
          <CurrencyInput
            inputId="appraisalFee"
            label="Appraisal fee"
            error={e.appraisalFeeUsd?.message}
            value={field.value ?? null}
            onValueChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
            ref={field.ref}
          />
        )}
      />
    </div>
  )
}
