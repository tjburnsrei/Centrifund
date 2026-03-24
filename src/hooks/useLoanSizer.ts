import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo } from 'react'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import {
  calculateLoanSizerOutputs,
  loanSizerFormSchema,
  type LoanSizerFormValues,
  type LoanSizerInputs,
  type LoanSizerOutputs,
} from '../domain/loanSizer'

export const loanSizerDefaultValues: LoanSizerFormValues = {
  transactionType: 'purchase',
  estimatedArv: null,
  guarantorExperience: '3-4',
  useChange: false,
  propertyState: 'FL',
  propertyCounty: null as string | null,
  qualifyingFico: 720,
  purchasePriceOrAsIsValue: 250_000,
  citizenship: 'domestic',
  projectBudget: 50_000,
  pointsOrOriginationChoice: 1,
  requestedDay1LoanAmount: 200_000,
  totalPayoffs: null,
  permitsApprovedOrImminent: false,
  roofRemoval: false,
  wallRemoval: false,
  nonWarrantableCondo: false,
  projectTypeOverride: 'Light Rehab',
  isTwoToFourUnits: false,
}

function formValuesToInputs(values: LoanSizerFormValues): LoanSizerInputs {
  return {
    transactionType: values.transactionType,
    estimatedArv: values.estimatedArv,
    guarantorExperience: values.guarantorExperience,
    useChange: values.useChange,
    propertyState: values.propertyState,
    propertyCounty: values.propertyCounty,
    qualifyingFico: values.qualifyingFico,
    purchasePriceOrAsIsValue: values.purchasePriceOrAsIsValue,
    citizenship: values.citizenship,
    projectBudget: values.projectBudget,
    pointsOrOriginationChoice: values.pointsOrOriginationChoice,
    requestedDay1LoanAmount: values.requestedDay1LoanAmount,
    totalPayoffs: values.totalPayoffs,
    permitsApprovedOrImminent: values.permitsApprovedOrImminent ?? false,
    roofRemoval: values.roofRemoval ?? false,
    wallRemoval: values.wallRemoval ?? false,
    nonWarrantableCondo: values.nonWarrantableCondo ?? false,
    projectTypeOverride: values.projectTypeOverride,
    isTwoToFourUnits: values.isTwoToFourUnits ?? false,
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

  const outputs = useMemo(() => {
    const merged: LoanSizerFormValues = {
      ...loanSizerDefaultValues,
      ...values,
    }
    return calculateLoanSizerOutputs(formValuesToInputs(merged))
  }, [values])

  return {
    form,
    outputs,
    values: { ...loanSizerDefaultValues, ...values },
  }
}
