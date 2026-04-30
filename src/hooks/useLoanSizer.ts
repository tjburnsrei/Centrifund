import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import {
  calculateLoanSizerOutputs,
  loanSizerFormSchema,
  type FicoBand,
  type LoanSizerFormValues,
  type LoanSizerInputs,
  type LoanSizerOutputs,
} from '../domain/loanSizer'

/**
 * Map a qualifying FICO band to the numeric value the engine consumes for
 * min-FICO gating. "Below 680" is forced to 679 so the engine blocks it.
 */
export const FICO_BAND_TO_NUMERIC: Record<FicoBand, number> = {
  below680: 679,
  '680-699': 680,
  '700-719': 700,
  '720-739': 720,
  '740+': 740,
}

export const FICO_BAND_OPTIONS: ReadonlyArray<{
  value: FicoBand
  label: string
  description: string
}> = [
  {
    value: 'below680',
    label: 'Below 680',
    description: 'Generally ineligible.',
  },
  {
    value: '680-699',
    label: '680 – 699',
    description: 'Eligible for standard Bridge, Light, and Standard Rehab loans.',
  },
  {
    value: '700-719',
    label: '700 – 719',
    description: 'Unlocks eligibility for Ground-Up Construction loans.',
  },
  {
    value: '720-739',
    label: '720 – 739',
    description: 'Exempt from the rehab-budget size cap per the rate sheet.',
  },
  {
    value: '740+',
    label: '740 or higher',
    description:
      'Strongest borrower profile for the published leverage and rate tiers.',
  },
]

export const loanSizerDefaultValues: LoanSizerFormValues = {
  estimatedArv: 800_000,
  guarantorExperience: '5+',
  useChange: false,
  propertyState: 'NY',
  propertyCounty: null as string | null,
  ficoBand: '740+',
  purchasePriceOrAsIsValue: 500_000,
  citizenship: 'domestic',
  projectBudget: 100_000,
  pointsOrOriginationChoice: 1,
  requestedTotalLtcPct: null,
  requestedTotalLtarvPct: null,
  requestedPurchasePriceFinancedPct: 90,
  requestedConstructionFinancedPct: 100,
  requestedDay1LoanAmount: 450_000,
  brokerRateAddOnPct: 0,
  permitsApprovedOrImminent: false,
  roofRemoval: false,
  wallRemoval: false,
  nonWarrantableCondo: false,
  projectTypeOverride: null,
  isTwoToFourUnits: false,
  brokerPointsPct: 0,
  underwritingFeeUsd: 1_995,
  attorneyFeeUsd: 0,
  appraisalFeeUsd: 0,
}

function formValuesToInputs(values: LoanSizerFormValues): LoanSizerInputs {
  return {
    estimatedArv: values.estimatedArv,
    guarantorExperience: values.guarantorExperience,
    useChange: values.useChange,
    propertyState: values.propertyState,
    propertyCounty: values.propertyCounty,
    qualifyingFico: FICO_BAND_TO_NUMERIC[values.ficoBand],
    purchasePriceOrAsIsValue: values.purchasePriceOrAsIsValue,
    citizenship: values.citizenship,
    projectBudget: values.projectBudget,
    pointsOrOriginationChoice: values.pointsOrOriginationChoice,
    requestedTotalLtcPct: values.requestedTotalLtcPct,
    requestedTotalLtarvPct: values.requestedTotalLtarvPct,
    requestedPurchasePriceFinancedPct: values.requestedPurchasePriceFinancedPct,
    requestedConstructionFinancedPct: values.requestedConstructionFinancedPct,
    requestedDay1LoanAmount: values.requestedDay1LoanAmount,
    brokerRateAddOnPct: values.brokerRateAddOnPct,
    permitsApprovedOrImminent: values.permitsApprovedOrImminent ?? false,
    roofRemoval: values.roofRemoval ?? false,
    wallRemoval: values.wallRemoval ?? false,
    nonWarrantableCondo: values.nonWarrantableCondo ?? false,
    projectTypeOverride: values.projectTypeOverride,
    isTwoToFourUnits: values.isTwoToFourUnits ?? false,
    brokerPointsPct: values.brokerPointsPct,
    underwritingFeeUsd: values.underwritingFeeUsd,
    attorneyFeeUsd: values.attorneyFeeUsd,
    appraisalFeeUsd: values.appraisalFeeUsd,
  }
}

export function useLoanSizer(): {
  form: ReturnType<typeof useForm<LoanSizerFormValues>>
  outputs: LoanSizerOutputs
  values: LoanSizerFormValues
} {
  const form = useForm<LoanSizerFormValues>({
    resolver: zodResolver(
      loanSizerFormSchema,
    ) as Resolver<LoanSizerFormValues>,
    defaultValues: loanSizerDefaultValues,
    mode: 'onChange',
  })

  const values = useWatch({ control: form.control }) as Partial<LoanSizerFormValues>

  const merged: LoanSizerFormValues = useMemo(
    () => ({ ...loanSizerDefaultValues, ...values }),
    [values],
  )

  const outputs = useMemo(
    () => calculateLoanSizerOutputs(formValuesToInputs(merged)),
    [merged],
  )

  return {
    form,
    outputs,
    values: merged,
  }
}
