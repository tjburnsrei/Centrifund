import { useEffect } from 'react'
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form'
import {
  NEW_YORK_CODE,
  RATE_SHEET_CONFIG,
  US_STATE_CODES,
  type LoanSizerFormValues,
  type LoanSizerOutputs,
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
  const [roofRemoval, wallRemoval, propertyState, permitsApprovedOrImminent] =
    useWatch({
    control,
    name: [
      'roofRemoval',
      'wallRemoval',
      'propertyState',
      'permitsApprovedOrImminent',
    ],
  })
  const showPermits = Boolean(roofRemoval || wallRemoval)
  const countyEnabled = propertyState === NEW_YORK_CODE

  useEffect(() => {
    if (!showPermits && permitsApprovedOrImminent) {
      setValue('permitsApprovedOrImminent', false, {
        shouldDirty: true,
        shouldValidate: true,
      })
    }
  }, [permitsApprovedOrImminent, setValue, showPermits])

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

      <SectionCard id="advanced-scenarios" title="Advanced scenarios">
        <div className="grid gap-3 md:grid-cols-2">
          <Controller
            name="roofRemoval"
            control={control}
            render={({ field }) => (
              <CheckboxField
                inputId="roofRemoval"
                label="Roof line removal"
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
          <Controller
            name="permitsApprovedOrImminent"
            control={control}
            render={({ field }) => (
              <CheckboxField
                inputId="permits"
                label="Permits approved or imminent"
                description="Applies the GUC initial LTC permits bonus when the project auto-classifies as GUC."
                disabled={!showPermits}
                checked={showPermits ? field.value ?? false : false}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
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
      </SectionCard>
    </div>
  )
}

export interface LoanSizerClosingCostsFormProps {
  form: UseFormReturn<LoanSizerFormValues>
}

function formatMaxPercent(value: number | null): string | undefined {
  if (value === null || !Number.isFinite(value)) return undefined
  const display = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)
  return `Max ${display}% based on current constraints.`
}

function formatCalculatedPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-'
  const display = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)
  return `${display}%`
}

function clampPercentToMax(
  value: number | null,
  max: number | null,
): number | null {
  if (value === null || !Number.isFinite(value)) return null
  const nonNegative = Math.max(0, value)
  if (max === null || !Number.isFinite(max)) return nonNegative
  return Number(Math.min(nonNegative, Math.max(0, max)).toFixed(2))
}

export interface LoanSizerRequestedLeverageFormProps
  extends LoanSizerClosingCostsFormProps {
  outputs: Pick<
    LoanSizerOutputs,
    | 'requestedTotalLtcPct'
    | 'requestedTotalLtarvPct'
    | 'requestedMaxPurchasePriceFinancedPct'
    | 'requestedMaxConstructionFinancedPct'
  >
}

function CalculatedLeverageMetric({
  label,
  value,
}: {
  label: string
  value: number | null
}) {
  return (
    <div className="flex min-h-[72px] flex-col justify-end gap-1">
      <p className="text-sm font-medium text-text-primary">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-text-primary">
        {formatCalculatedPercent(value)}
      </p>
    </div>
  )
}

export function LoanSizerRequestedLeverageForm({
  form,
  outputs,
}: LoanSizerRequestedLeverageFormProps) {
  const { control, formState, setValue } = form
  const e = formState.errors
  const [requestedPurchasePriceFinancedPct, requestedConstructionFinancedPct] =
    useWatch({
    control,
    name: [
      'requestedPurchasePriceFinancedPct',
      'requestedConstructionFinancedPct',
    ],
  })

  useEffect(() => {
    const caps = [
      [
        'requestedPurchasePriceFinancedPct',
        requestedPurchasePriceFinancedPct,
        outputs.requestedMaxPurchasePriceFinancedPct,
      ],
      [
        'requestedConstructionFinancedPct',
        requestedConstructionFinancedPct,
        outputs.requestedMaxConstructionFinancedPct,
      ],
    ] as const

    for (const [name, value, max] of caps) {
      const clamped = clampPercentToMax(value ?? null, max)
      if (
        value !== null &&
        value !== undefined &&
        clamped !== null &&
        clamped !== value
      ) {
        setValue(name, clamped, {
          shouldDirty: true,
          shouldValidate: true,
        })
      }
    }
  }, [
    outputs.requestedMaxConstructionFinancedPct,
    outputs.requestedMaxPurchasePriceFinancedPct,
    requestedConstructionFinancedPct,
    requestedPurchasePriceFinancedPct,
    setValue,
  ])

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Controller
        name="requestedPurchasePriceFinancedPct"
        control={control}
        render={({ field }) => (
          <NumberInput
            inputId="requestedPurchasePriceFinancedPct"
            label="Requested Purchase Price Financed (%)"
            description={formatMaxPercent(
              outputs.requestedMaxPurchasePriceFinancedPct,
            )}
            error={e.requestedPurchasePriceFinancedPct?.message}
            value={field.value ?? null}
            onValueChange={(value) =>
              field.onChange(
                clampPercentToMax(
                  value,
                  outputs.requestedMaxPurchasePriceFinancedPct,
                ),
              )
            }
            onBlur={field.onBlur}
            name={field.name}
            ref={field.ref}
          />
        )}
      />
      <Controller
        name="requestedConstructionFinancedPct"
        control={control}
        render={({ field }) => (
          <NumberInput
            inputId="requestedConstructionFinancedPct"
            label="Requested Construction Financed (%)"
            description={formatMaxPercent(
              outputs.requestedMaxConstructionFinancedPct,
            )}
            error={e.requestedConstructionFinancedPct?.message}
            value={field.value ?? null}
            onValueChange={(value) =>
              field.onChange(
                clampPercentToMax(
                  value,
                  outputs.requestedMaxConstructionFinancedPct,
                ),
              )
            }
            onBlur={field.onBlur}
            name={field.name}
            ref={field.ref}
          />
        )}
      />
      <CalculatedLeverageMetric
        label="Requested Total LTC"
        value={outputs.requestedTotalLtcPct}
      />
      <CalculatedLeverageMetric
        label="Requested Total LTARV"
        value={outputs.requestedTotalLtarvPct}
      />
    </div>
  )
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
        name="brokerRateAddOnPct"
        control={control}
        render={({ field }) => (
          <NumberInput
            inputId="brokerRateAddOnPct"
            label="Broker YSP (%)"
            error={e.brokerRateAddOnPct?.message}
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
