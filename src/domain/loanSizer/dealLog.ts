import { z } from 'zod'

export const DEAL_LOG_TYPES = [
  'deal',
  'pricing_issue',
  'test_scenario',
] as const

export type DealLogType = (typeof DEAL_LOG_TYPES)[number]

export const DEAL_LOG_TYPE_OPTIONS: ReadonlyArray<{
  value: DealLogType
  label: string
}> = [
  { value: 'deal', label: 'Deal' },
  { value: 'pricing_issue', label: 'Pricing issue' },
  { value: 'test_scenario', label: 'Test scenario' },
]

export const dealLogRequestSchema = z.object({
  logType: z.enum(DEAL_LOG_TYPES).optional().default('deal'),
  streetAddress: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v ?? '').trim())
    .refine(
      (v) => v.length <= 300,
      'Street address must be 300 characters or less',
    ),
  notes: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v ?? '').trim())
    .refine((v) => v.length <= 2000, 'Notes must be 2,000 characters or less'),
  inputs: z.record(z.string(), z.unknown()),
  outputs: z.record(z.string(), z.unknown()),
})

export type DealLogRequest = z.infer<typeof dealLogRequestSchema>

export interface DealLogRecord {
  logType: DealLogType
  streetAddress: string
  notes: string
  inputsJson: string
  outputsJson: string
  purchasePrice: number | null
  rehabBudget: number | null
  estimatedArv: number | null
  requestedPurchasePct: number | null
  requestedConstructionPct: number | null
  purchaseMoneyLoan: number | null
  rehabLoan: number | null
  finalRate: number | null
  projectType: string | null
  tier: string | null
}

function numberFromRecord(
  record: Record<string, unknown>,
  key: string,
): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function stringFromRecord(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function buildDealLogRecord(payload: DealLogRequest): DealLogRecord {
  return {
    logType: payload.logType,
    streetAddress: payload.streetAddress,
    notes: payload.notes,
    inputsJson: JSON.stringify(payload.inputs),
    outputsJson: JSON.stringify(payload.outputs),
    purchasePrice: numberFromRecord(payload.inputs, 'purchasePriceOrAsIsValue'),
    rehabBudget: numberFromRecord(payload.inputs, 'projectBudget'),
    estimatedArv: numberFromRecord(payload.inputs, 'estimatedArv'),
    requestedPurchasePct: numberFromRecord(
      payload.inputs,
      'requestedPurchasePriceFinancedPct',
    ),
    requestedConstructionPct: numberFromRecord(
      payload.inputs,
      'requestedConstructionFinancedPct',
    ),
    purchaseMoneyLoan: numberFromRecord(payload.outputs, 'purchaseMoneyLoan'),
    rehabLoan: numberFromRecord(payload.outputs, 'rehabLoan'),
    finalRate: numberFromRecord(payload.outputs, 'finalRate'),
    projectType: stringFromRecord(payload.outputs, 'projectType'),
    tier: stringFromRecord(payload.outputs, 'estimatedTier'),
  }
}
