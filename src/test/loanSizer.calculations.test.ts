import { describe, expect, it } from 'vitest'
import {
  calculateCashToClose,
  calculateLoanSizerOutputs,
  calculateMaxDay1Loan,
  calculateMaxRehabFinancing,
  calculateMaxTotalLoan,
  calculateProfitability,
  calculateRequestedMetrics,
} from '../domain/loanSizer/calculations'
import type { LoanSizerInputs } from '../domain/loanSizer/types'

function baseInputs(
  overrides: Partial<LoanSizerInputs> = {},
): LoanSizerInputs {
  return {
    transactionType: 'purchase',
    estimatedArv: 400_000,
    guarantorExperience: '3-4',
    useChange: false,
    propertyState: 'FL',
    propertyCounty: null,
    qualifyingFico: 720,
    purchasePriceOrAsIsValue: 250_000,
    citizenship: 'domestic',
    projectBudget: 50_000,
    pointsOrOriginationChoice: 1,
    requestedDay1LoanAmount: 200_000,
    totalPayoffs: 0,
    permitsApprovedOrImminent: false,
    roofRemoval: false,
    wallRemoval: false,
    nonWarrantableCondo: false,
    projectTypeOverride: 'Light Rehab',
    isTwoToFourUnits: false,
    ...overrides,
  }
}

describe('calculateMaxDay1Loan', () => {
  it('is null-safe', () => {
    expect(calculateMaxDay1Loan(100_000, null)).toBeNull()
  })

  it('rejects non-finite or negative AIV', () => {
    expect(calculateMaxDay1Loan(Number.NaN, 75)).toBeNull()
    expect(calculateMaxDay1Loan(-1, 75)).toBeNull()
  })

  it('computes AIV × initial LTC', () => {
    expect(calculateMaxDay1Loan(200_000, 75)).toBe(150_000)
  })
})

describe('calculateMaxRehabFinancing', () => {
  it('returns null when rehab cap missing', () => {
    expect(calculateMaxRehabFinancing(40_000, null)).toBeNull()
  })
})

describe('calculateMaxTotalLoan', () => {
  it('returns null for invalid cost basis', () => {
    const caps = {
      maxInitialLtcPct: 80,
      maxRehabLtcPct: 100,
      maxTotalLtcPct: 90,
      maxArvLtvPct: 75,
    }
    expect(
      calculateMaxTotalLoan(-100, 50_000, 400_000, caps, 0, 0),
    ).toBeNull()
  })

  it('takes minimum of constraints', () => {
    const caps = {
      maxInitialLtcPct: 80,
      maxRehabLtcPct: 100,
      maxTotalLtcPct: 90,
      maxArvLtvPct: 75,
    }
    const day1 = 200_000
    const rehab = 50_000
    const total = calculateMaxTotalLoan(
      250_000,
      50_000,
      400_000,
      caps,
      day1,
      rehab,
    )
    expect(total).not.toBeNull()
    expect(total).toBeLessThanOrEqual(400_000 * 0.75)
    expect(total).toBeLessThanOrEqual(300_000 * 0.9)
  })
})

describe('calculateRequestedMetrics', () => {
  it('omits LTV when AIV is not positive', () => {
    const r = calculateRequestedMetrics(0, 50_000, 400_000, 100_000)
    expect(r.requestedLtv).toBeNull()
    expect(r.requestedLtc).not.toBeNull()
  })

  it('omits LTC when AIV + budget is zero', () => {
    const r = calculateRequestedMetrics(0, 0, 100_000, 0)
    expect(r.requestedLtc).toBeNull()
  })
})

describe('calculateCashToClose', () => {
  it('treats non-finite payoffs as zero', () => {
    const { estimatedCashToCoverClosing } = calculateCashToClose(
      100_000,
      80_000,
      Number.NaN,
    )
    expect(estimatedCashToCoverClosing).toBe(20_000)
  })
})

describe('calculateProfitability', () => {
  it('returns Ineligible when not eligible', () => {
    expect(calculateProfitability(false, 500_000, 400_000)).toBe('Ineligible')
  })

  it('returns null when ARV missing', () => {
    expect(calculateProfitability(true, null, 400_000)).toBeNull()
  })
})

describe('calculateLoanSizerOutputs', () => {
  it('flags Silver + Ground Up as ineligible', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({
        guarantorExperience: '1-2',
        projectTypeOverride: 'Ground Up Construction',
        estimatedArv: 600_000,
        projectBudget: 100_000,
      }),
    )
    expect(out.isEligible).toBe(false)
    expect(out.profitabilityResult).toBe('Ineligible')
    expect(out.warnings.some((w) => w.includes('Silver'))).toBe(true)
  })

  it('flags FICO below 680 for non–Ground Up', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({ qualifyingFico: 660 }),
    )
    expect(out.isEligible).toBe(false)
    expect(out.warnings.some((w) => w.includes('680'))).toBe(true)
  })

  it('flags Ground Up FICO below 700', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({
        projectTypeOverride: 'Ground Up Construction',
        guarantorExperience: '5+',
        qualifyingFico: 690,
        estimatedArv: 800_000,
        projectBudget: 200_000,
      }),
    )
    expect(out.isEligible).toBe(false)
    expect(out.warnings.some((w) => w.includes('700'))).toBe(true)
  })

  it('warns when requested Day 1 exceeds max', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({ requestedDay1LoanAmount: 500_000 }),
    )
    expect(out.warnings.some((w) => w.includes('Day 1'))).toBe(true)
  })

  it('handles null ARV with blocking for rehab types', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({ estimatedArv: null }),
    )
    expect(out.isEligible).toBe(false)
    expect(out.warnings.some((w) => w.includes('ARV'))).toBe(true)
  })

  it('handles missing project budget for rehab types', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({ projectBudget: null }),
    )
    expect(out.isEligible).toBe(false)
  })

  it('never produces NaN or Infinity in numeric outputs', () => {
    const out = calculateLoanSizerOutputs(baseInputs())
    const nums: (number | null)[] = [
      out.baseRate,
      out.finalRate,
      out.maxDay1Loan,
      out.maxTotalLoan,
      out.maxLtv,
      out.maxLtc,
      out.maxLtarv,
      out.requestedLtv,
      out.requestedLtc,
      out.requestedLtarv,
    ]
    for (const n of nums) {
      if (n !== null) {
        expect(Number.isFinite(n)).toBe(true)
      }
    }
  })

  it('includes liquidity for Ground Up', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({
        projectTypeOverride: 'Ground Up Construction',
        guarantorExperience: '5+',
        qualifyingFico: 720,
        estimatedArv: 900_000,
        projectBudget: 150_000,
      }),
    )
    expect(out.liquidityRequired).not.toBeNull()
    expect(out.liquidityRequired).toBeGreaterThan(0)
  })
})
