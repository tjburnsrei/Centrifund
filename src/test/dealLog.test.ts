import { describe, expect, it } from 'vitest'
import {
  buildDealLogRecord,
  dealLogRequestSchema,
} from '../domain/loanSizer/dealLog'

describe('deal log helpers', () => {
  it('accepts a valid private deal log payload', () => {
    const parsed = dealLogRequestSchema.safeParse({
      streetAddress: ' 123 Test St ',
      notes: ' Review total leverage. ',
      inputs: {
        purchasePriceOrAsIsValue: 500_000,
        projectBudget: 100_000,
        estimatedArv: 800_000,
        requestedPurchasePriceFinancedPct: 90,
        requestedConstructionFinancedPct: 100,
      },
      outputs: {
        purchaseMoneyLoan: 450_000,
        rehabLoan: 100_000,
        finalRate: 8.75,
        projectType: 'Light Rehab',
        estimatedTier: 'Platinum',
      },
    })

    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.logType).toBe('deal')
    expect(parsed.data.streetAddress).toBe('123 Test St')
    expect(parsed.data.notes).toBe('Review total leverage.')
  })

  it('rejects invalid log type and overly long notes', () => {
    const parsed = dealLogRequestSchema.safeParse({
      logType: 'public_log',
      notes: 'x'.repeat(2001),
      streetAddress: 'x'.repeat(301),
      inputs: {},
      outputs: {},
    })

    expect(parsed.success).toBe(false)
  })

  it('builds summary columns without requiring sensitive personal fields', () => {
    const parsed = dealLogRequestSchema.parse({
      logType: 'deal',
      streetAddress: '123 Test St',
      notes: '',
      inputs: {
        purchasePriceOrAsIsValue: 500_000,
        projectBudget: 100_000,
        estimatedArv: 800_000,
        requestedPurchasePriceFinancedPct: 90,
        requestedConstructionFinancedPct: 100,
      },
      outputs: {
        purchaseMoneyLoan: 450_000,
        rehabLoan: 100_000,
        finalRate: 8.75,
        projectType: 'Light Rehab',
        estimatedTier: 'Platinum',
      },
    })

    const record = buildDealLogRecord(parsed)

    expect(record.streetAddress).toBe('123 Test St')
    expect(record.purchasePrice).toBe(500_000)
    expect(record.rehabBudget).toBe(100_000)
    expect(record.estimatedArv).toBe(800_000)
    expect(record.requestedPurchasePct).toBe(90)
    expect(record.requestedConstructionPct).toBe(100)
    expect(record.purchaseMoneyLoan).toBe(450_000)
    expect(record.rehabLoan).toBe(100_000)
    expect(record.finalRate).toBe(8.75)
    expect(record.projectType).toBe('Light Rehab')
    expect(record.tier).toBe('Platinum')
  })
})
