import { Controller, type UseFormReturn } from 'react-hook-form'
import {
  originationSelectOptions,
  projectTypeSelectOptions,
  US_STATE_CODES,
  type LoanSizerFormValues,
} from '../../domain/loanSizer'
import { textLikeInputClassName } from './fieldClasses'
import { CheckboxField } from './fields/CheckboxField'
import { CurrencyInput } from './fields/CurrencyInput'
import { NumberInput } from './fields/NumberInput'
import { SelectInput } from './fields/SelectInput'
import { SectionCard } from './SectionCard'

const STATE_OPTIONS = US_STATE_CODES.map((code) => ({
  value: code,
  label: code,
}))

export interface LoanSizerFormProps {
  form: UseFormReturn<LoanSizerFormValues>
}

export function LoanSizerForm({ form }: LoanSizerFormProps) {
  const { control, formState } = form
  const e = formState.errors

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        id="deal-inputs"
        title="Deal inputs"
        description="All fields update results automatically."
      >
        <fieldset className="space-y-4">
          <legend className="sr-only">Transaction and property</legend>
          <Controller
            name="transactionType"
            control={control}
            render={({ field }) => (
              <SelectInput
                inputId="transactionType"
                label="Transaction type"
                options={[
                  { value: 'purchase', label: 'Purchase' },
                  { value: 'rateTermRefi', label: 'Rate / Term Refinance' },
                  { value: 'cashOutRefi', label: 'Cash-Out Refinance' },
                ]}
                {...field}
              />
            )}
          />
          <Controller
            name="projectTypeOverride"
            control={control}
            render={({ field }) => (
              <SelectInput
                inputId="projectType"
                label="Project / rehab type"
                description="Rate sheet categories (not legacy “Standard/Super Rehab” labels)."
                error={e.projectTypeOverride?.message}
                options={[...projectTypeSelectOptions()]}
                value={field.value ?? ''}
                onChange={(ev) => {
                  const v = ev.target.value
                  field.onChange(v === '' ? null : v)
                }}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
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
                />
              )}
            />
            <Controller
              name="propertyCounty"
              control={control}
              render={({ field }) => (
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="propertyCounty"
                    className="text-sm font-medium text-text-primary"
                  >
                    Property county (optional)
                  </label>
                  <p
                    id="propertyCounty-desc"
                    className="text-xs text-text-secondary"
                  >
                    Required for New York select-county leverage adjustment when
                    applicable.
                  </p>
                  <input
                    id="propertyCounty"
                    type="text"
                    autoComplete="address-level2"
                    aria-describedby="propertyCounty-desc"
                    className={textLikeInputClassName('px-3 py-2')}
                    value={field.value ?? ''}
                    onChange={(ev) =>
                      field.onChange(
                        ev.target.value.trim() === '' ? null : ev.target.value,
                      )
                    }
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </div>
              )}
            />
          </div>
        </fieldset>

        <fieldset className="space-y-4 border-t border-border pt-4">
          <legend className="mb-2 text-sm font-semibold text-text-primary">
            Financial inputs
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              name="purchasePriceOrAsIsValue"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  inputId="purchasePrice"
                  label="Purchase price / As-is value (AIV)"
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
            <Controller
              name="projectBudget"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  inputId="projectBudget"
                  label="Project / rehab budget"
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
              name="requestedDay1LoanAmount"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  inputId="requestedDay1"
                  label="Requested Day 1 loan"
                  error={e.requestedDay1LoanAmount?.message}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              )}
            />
            <Controller
              name="totalPayoffs"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  inputId="totalPayoffs"
                  label="Total payoffs (optional)"
                  description="Included in estimated cash to close when provided."
                  error={e.totalPayoffs?.message}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  ref={field.ref}
                />
              )}
            />
          </div>
        </fieldset>

        <fieldset className="space-y-4 border-t border-border pt-4">
          <legend className="mb-2 text-sm font-semibold text-text-primary">
            Borrower & pricing
          </legend>
          <Controller
            name="guarantorExperience"
            control={control}
            render={({ field }) => (
              <SelectInput
                inputId="experience"
                label="Guarantor experience (completed projects)"
                options={[
                  { value: '1-2', label: '1–2 (Silver tier)' },
                  { value: '3-4', label: '3–4 (Gold tier)' },
                  { value: '5+', label: '5+ (Platinum tier)' },
                ]}
                {...field}
              />
            )}
          />
          <Controller
            name="qualifyingFico"
            control={control}
            render={({ field }) => (
              <NumberInput
                inputId="fico"
                label="Qualifying FICO"
                error={e.qualifyingFico?.message}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
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
          <Controller
            name="pointsOrOriginationChoice"
            control={control}
            render={({ field }) => (
              <SelectInput
                inputId="origination"
                label="Origination points"
                options={[...originationSelectOptions()]}
                value={
                  field.value === null || field.value === undefined
                    ? ''
                    : String(field.value)
                }
                onChange={(ev) => {
                  const v = ev.target.value
                  if (v === '') field.onChange(null)
                  else if (v === '1') field.onChange(1)
                  else if (v === '0.5') field.onChange(0.5)
                  else field.onChange(0)
                }}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
        </fieldset>

        <fieldset className="space-y-3 border-t border-border pt-4">
          <legend className="mb-1 text-sm font-semibold text-text-primary">
            Program options
          </legend>
          <Controller
            name="permitsApprovedOrImminent"
            control={control}
            render={({ field }) => (
              <CheckboxField
                inputId="permits"
                label="Permits approved or imminent"
                description="When applicable, may allow the higher starred initial LTC on the rate sheet."
                checked={field.value ?? false}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
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
          <Controller
            name="isTwoToFourUnits"
            control={control}
            render={({ field }) => (
              <CheckboxField
                inputId="units24"
                label="2–4 unit property"
                description="Used for lender fee selection per rate sheet fee grid."
                checked={field.value ?? false}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
          <Controller
            name="useChange"
            control={control}
            render={({ field }) => (
              <CheckboxField
                inputId="useChange"
                label="Material use-of-proceeds change (flag)"
                description="Operational flag only in v1; does not change pricing math. Document any future mapping in constants."
                checked={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                ref={field.ref}
              />
            )}
          />
        </fieldset>
      </SectionCard>
    </div>
  )
}
