import { z } from 'zod'
import type { ProjectType } from './types'

export const US_STATE_CODES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
  'DC',
] as const

const projectTypeSchema = z.enum([
  'Bridge No Rehab',
  'Light Rehab',
  'Heavy Rehab',
  'Ground Up Construction',
])

const nullableCurrency = z
  .union([z.number(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === undefined || v === null || Number.isNaN(v)) {
      return null
    }
    return v
  })
  .refine((v) => v === null || v >= 0, 'Must be zero or greater')

const nullableInt = z
  .union([z.number(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === undefined || v === null || Number.isNaN(v)) {
      return null
    }
    return Math.round(v)
  })

export const loanSizerFormSchema = z
  .object({
    transactionType: z.enum(['purchase', 'rateTermRefi', 'cashOutRefi']),
    estimatedArv: nullableCurrency,
    guarantorExperience: z.enum(['1-2', '3-4', '5+']),
    useChange: z.boolean(),
    propertyState: z
      .string()
      .min(1, 'State is required')
      .transform((s) => s.trim().toUpperCase())
      .refine((s) => (US_STATE_CODES as readonly string[]).includes(s), {
        message: 'Select a valid U.S. state or DC',
      }),
    propertyCounty: z
      .union([z.string(), z.null(), z.undefined()])
      .transform((s) => {
        if (s === undefined || s === null) return null
        const t = s.trim()
        return t === '' ? null : t
      }),
    qualifyingFico: nullableInt.refine(
      (v) => v === null || (v >= 300 && v <= 850),
      'FICO must be between 300 and 850',
    ),
    purchasePriceOrAsIsValue: nullableCurrency,
    citizenship: z.enum(['domestic', 'foreignNational']),
    projectBudget: nullableCurrency,
    pointsOrOriginationChoice: z
      .union([z.literal(1), z.literal(0.5), z.literal(0), z.null(), z.undefined()])
      .transform((v) => (v === undefined ? null : v)),
    requestedDay1LoanAmount: nullableCurrency,
    totalPayoffs: nullableCurrency,
    permitsApprovedOrImminent: z.boolean().optional(),
    roofRemoval: z.boolean().optional(),
    wallRemoval: z.boolean().optional(),
    nonWarrantableCondo: z.boolean().optional(),
    projectTypeOverride: z
      .union([projectTypeSchema, z.literal(''), z.null(), z.undefined()])
      .transform((v) => {
        if (v === undefined || v === null || v === '') return null
        return v as ProjectType
      }),
    isTwoToFourUnits: z.boolean().optional(),
  })

export type LoanSizerFormValues = z.infer<typeof loanSizerFormSchema>

export function parseLoanSizerForm(
  raw: unknown,
): { success: true; data: LoanSizerFormValues } | { success: false; error: z.ZodError } {
  const parsed = loanSizerFormSchema.safeParse(raw)
  if (!parsed.success) return { success: false, error: parsed.error }
  return { success: true, data: parsed.data }
}
