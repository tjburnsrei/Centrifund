import { describe, expect, it } from 'vitest'
import {
  calculateCashToCoverClosing,
  calculateLoanSizerOutputs,
  calculateMaxDay1Loan,
  calculateMaxRehabFinancing,
  calculateMaxTotalLoan,
  calculateMonthlyPayment,
  calculateProfitability,
  calculateRequestedMetrics,
} from '../domain/loanSizer/calculations'
import type { LoanSizerInputs } from '../domain/loanSizer/types'

function baseInputs(
  overrides: Partial<LoanSizerInputs> = {},
): LoanSizerInputs {
  return {
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
    permitsApprovedOrImminent: false,
    roofRemoval: false,
    wallRemoval: false,
    nonWarrantableCondo: false,
    projectTypeOverride: null,
    isTwoToFourUnits: false,
    brokerPointsPct: 0,
    underwritingFeeUsd: 0,
    attorneyFeeUsd: 0,
    appraisalFeeUsd: 0,
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
      calculateMaxTotalLoan(-100, 50_000, 400_000, caps, 'Standard Rehab'),
    ).toBeNull()
  })

  it('takes minimum of constraints', () => {
    const caps = {
      maxInitialLtcPct: 80,
      maxRehabLtcPct: 100,
      maxTotalLtcPct: 90,
      maxArvLtvPct: 75,
    }
    const total = calculateMaxTotalLoan(
      250_000,
      50_000,
      400_000,
      caps,
      'Standard Rehab',
    )
    expect(total).not.toBeNull()
    expect(total).toBeLessThanOrEqual(400_000 * 0.75)
    expect(total).toBeLessThanOrEqual(300_000 * 0.9)
  })
})

describe('calculateRequestedMetrics', () => {
  it('omits LTV when AIV is not positive', () => {
    const r = calculateRequestedMetrics(0, 50_000, 400_000, 100_000, 'Light Rehab')
    expect(r.requestedLtv).toBeNull()
    expect(r.requestedLtc).not.toBeNull()
  })

  it('omits LTC when AIV + budget is zero', () => {
    const r = calculateRequestedMetrics(0, 0, 100_000, 0, 'Bridge No Rehab')
    expect(r.requestedLtc).toBeNull()
  })
})

describe('calculateCashToCoverClosing', () => {
  it('returns null aiv produces null outputs', () => {
    const { downPaymentNeeded, cashToCoverClosing } =
      calculateCashToCoverClosing({
        aiv: null,
        requestedDay1: 100_000,
        brokerPointsPct: 1,
        underwritingFeeUsd: 1_000,
        attorneyFeeUsd: 0,
        appraisalFeeUsd: 0,
      })
    expect(downPaymentNeeded).toBeNull()
    expect(cashToCoverClosing).toBeNull()
  })

  it('sums down payment, broker points, and fees', () => {
    const { downPaymentNeeded, cashToCoverClosing } =
      calculateCashToCoverClosing({
        aiv: 500_000,
        requestedDay1: 450_000,
        brokerPointsPct: 1,
        underwritingFeeUsd: 1_995,
        attorneyFeeUsd: 500,
        appraisalFeeUsd: 750,
      })
    expect(downPaymentNeeded).toBe(50_000)
    expect(cashToCoverClosing).toBe(50_000 + 4_500 + 1_995 + 500 + 750)
  })

  it('treats negative / NaN fees as zero', () => {
    const { cashToCoverClosing } = calculateCashToCoverClosing({
      aiv: 500_000,
      requestedDay1: 450_000,
      brokerPointsPct: -1,
      underwritingFeeUsd: Number.NaN,
      attorneyFeeUsd: null,
      appraisalFeeUsd: null,
    })
    expect(cashToCoverClosing).toBe(50_000)
  })
})

describe('calculateMonthlyPayment', () => {
  it('returns interest-only monthly on Day 1 loan', () => {
    expect(calculateMonthlyPayment(450_000, 9)).toBeCloseTo((450_000 * 0.09) / 12, 2)
  })

  it('returns null when inputs are missing or non-positive', () => {
    expect(calculateMonthlyPayment(null, 9)).toBeNull()
    expect(calculateMonthlyPayment(100_000, null)).toBeNull()
    expect(calculateMonthlyPayment(100_000, 0)).toBeNull()
    expect(calculateMonthlyPayment(0, 9)).toBeNull()
  })
})

describe('calculateProfitability', () => {
  it('returns Fail when below threshold', () => {
    expect(calculateProfitability('Light Rehab', 200_000, 50_000, 150_000)).toBe(
      'Fail',
    )
  })

  it('passes Bridge without a ratio test', () => {
    expect(calculateProfitability('Bridge No Rehab', 200_000, 0, 150_000)).toBe(
      'Pass',
    )
  })

  it('returns null when required inputs are missing', () => {
    expect(calculateProfitability('Light Rehab', null, 50_000, 300_000)).toBeNull()
  })
})

describe('calculateLoanSizerOutputs', () => {
  it('flags Silver + Ground Up as ineligible', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({
        guarantorExperience: '0-2',
        estimatedArv: 600_000,
        projectBudget: 100_000,
        roofRemoval: true,
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

  it('flags a FICO band below 680 (mapped to 679) as ineligible', () => {
    const out = calculateLoanSizerOutputs(baseInputs({ qualifyingFico: 679 }))
    expect(out.isEligible).toBe(false)
    expect(out.finalRate).toBeNull()
    expect(out.warnings.some((w) => w.includes('680'))).toBe(true)
  })

  it('flags Ground Up FICO below 700', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({
        roofRemoval: true,
        guarantorExperience: '5+',
        qualifyingFico: 690,
        estimatedArv: 800_000,
        projectBudget: 200_000,
      }),
    )
    expect(out.isEligible).toBe(false)
    expect(out.warnings.some((w) => w.includes('700'))).toBe(true)
  })

  it('blocks unavailable states from the logic map', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({
        propertyState: 'NV',
      }),
    )
    expect(out.isEligible).toBe(false)
    expect(out.warnings.some((w) => w.includes('not available in NV'))).toBe(true)
    expect(out.finalRate).toBeNull()
  })

  it('warns when requested Day 1 exceeds max', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({ requestedDay1LoanAmount: 500_000 }),
    )
    expect(
      out.warnings.some((w) => w.includes('purchase price financing')),
    ).toBe(true)
  })

  it('handles null ARV with blocking for rehab types', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({ estimatedArv: null }),
    )
    expect(out.isEligible).toBe(false)
    expect(out.warnings.some((w) => w.includes('ARV'))).toBe(true)
  })

  it('blocks profitability failures using the 1.15 ratio', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({
        estimatedArv: 300_000,
        purchasePriceOrAsIsValue: 250_000,
        projectBudget: 50_000,
      }),
    )
    expect(out.isEligible).toBe(false)
    expect(out.profitabilityResult).toBe('Fail')
  })

  it('treats bridge requested financed budget as zero', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({
        projectBudget: 4_000,
      }),
    )
    expect(out.projectType).toBe('Bridge No Rehab')
    expect(out.requestedFinancedBudget).toBe(0)
  })

  it('records the purchase bonus assumption when the scenario qualifies', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({
        propertyState: 'CA',
        propertyCounty: null,
        projectBudget: 20_000,
        purchasePriceOrAsIsValue: 200_000,
        estimatedArv: 300_000,
      }),
    )
    expect(
      out.assumptions.some((a) => a.includes('purchase leverage bonus of 5pp')),
    ).toBe(true)
  })

  it('records the GUC permits assumption when permits are approved', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({
        propertyState: 'CA',
        guarantorExperience: '5+',
        roofRemoval: true,
        permitsApprovedOrImminent: true,
        purchasePriceOrAsIsValue: 300_000,
        projectBudget: 150_000,
        estimatedArv: 700_000,
      }),
    )
    expect(
      out.assumptions.some((a) =>
        a.includes('Applied GUC permits initial LTC bonus of 20pp'),
      ),
    ).toBe(true)
  })

  it('warns for loans below 75k guideline', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({
        requestedDay1LoanAmount: 50_000,
        projectBudget: 0,
      }),
    )
    expect(out.warnings.some((w) => w.includes('$75,000'))).toBe(true)
  })

  it('computes purchase down payment and cash-to-close with fees', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({
        propertyState: 'CA',
        purchasePriceOrAsIsValue: 250_000,
        requestedDay1LoanAmount: 180_000,
        brokerPointsPct: 1,
        underwritingFeeUsd: 1_995,
        attorneyFeeUsd: 500,
        appraisalFeeUsd: 600,
      }),
    )
    expect(out.downPaymentNeeded).toBe(70_000)
    expect(out.estimatedCashToCoverClosing).toBe(
      70_000 + 1_800 + 1_995 + 500 + 600,
    )
  })

  it('computes monthly payment from requested Day 1 and final rate', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({
        propertyState: 'CA',
        requestedDay1LoanAmount: 450_000,
      }),
    )
    expect(out.finalRate).not.toBeNull()
    expect(out.purchaseMoneyLoan).not.toBeNull()
    expect(out.estimatedMonthlyPayment).toBeCloseTo(
      ((out.purchaseMoneyLoan ?? 0) * ((out.finalRate ?? 0) / 100)) / 12,
      2,
    )
  })

  it('adds broker rate add-on to the final rate', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({
        brokerRateAddOnPct: 1.25,
      }),
    )
    expect(out.programRate).toBeCloseTo(9.49, 4)
    expect(out.finalRate).toBeCloseTo(10.74, 4)
    expect(out.brokerRateAddOnPct).toBe(1.25)
  })

  it('derives requested loan dollars from requested leverage percentages', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({
        requestedDay1LoanAmount: 999_999,
        requestedTotalLtcPct: 90,
        requestedTotalLtarvPct: 75,
        requestedPurchasePriceFinancedPct: 80,
        requestedConstructionFinancedPct: 50,
      }),
    )
    expect(out.requestedDay1LoanAmount).toBe(200_000)
    expect(out.purchaseMoneyLoan).toBe(200_000)
    expect(out.requestedFinancedBudget).toBe(25_000)
    expect(out.rehabLoan).toBe(25_000)
    expect(out.requestedTotalLtcPct).toBe(75)
    expect(out.requestedTotalLtarvPct).toBeCloseTo(56.25, 4)
    expect(out.requestedPurchasePriceFinancedPct).toBe(80)
    expect(out.requestedConstructionFinancedPct).toBe(50)
  })

  it('computes allowable leverage percentages from deal dollars and component caps', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({
        propertyState: 'CA',
        guarantorExperience: '5+',
        purchasePriceOrAsIsValue: 500_000,
        projectBudget: 100_000,
        estimatedArv: 800_000,
      }),
    )
    expect(out.maxTotalLoan).not.toBeNull()
    expect(out.maxTotalLtcPct).toBeCloseTo(
      ((out.maxTotalLoan ?? 0) / 600_000) * 100,
      4,
    )
    expect(out.maxArvLtvPct).toBeCloseTo(
      ((out.maxTotalLoan ?? 0) / 800_000) * 100,
      4,
    )
    expect(out.maxTotalLtcPct ?? 0).toBeLessThan(95)
  })

  it('exposes conservative guide leverage without rare conditional total LTC expectations', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({
        propertyState: 'CA',
        guarantorExperience: '5+',
        purchasePriceOrAsIsValue: 500_000,
        projectBudget: 100_000,
        estimatedArv: 800_000,
      }),
    )
    expect(out.guideInitialLtcPct).toBe(85)
    expect(out.guideRehabLtcPct).toBe(100)
    expect(out.guideTotalLtcPct).toBe(90)
    expect(out.guideArvLtvPct).toBe(75)
    expect(out.guideTotalLtcPct).toBeLessThan(95)
  })

  it('caps guide total LTC by borrower tier', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({
        propertyState: 'CA',
        guarantorExperience: '3-4',
        purchasePriceOrAsIsValue: 500_000,
        projectBudget: 100_000,
        estimatedArv: 800_000,
      }),
    )
    expect(out.guideTotalLtcPct).toBe(85)
  })

  it('caps construction financing from total program limits and purchase financing', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({
        propertyState: 'CA',
        guarantorExperience: '5+',
        purchasePriceOrAsIsValue: 500_000,
        projectBudget: 100_000,
        estimatedArv: 700_000,
        requestedPurchasePriceFinancedPct: 90,
        requestedConstructionFinancedPct: 100,
      }),
    )
    expect(out.purchaseMoneyLoan).toBe(450_000)
    expect(out.requestedMaxConstructionFinancedPct).toBeCloseTo(75, 4)
    expect(out.rehabLoan).toBe(75_000)
    expect(out.requestedTotalLtcPct).toBeCloseTo(87.5, 4)
    expect(out.requestedTotalLtarvPct).toBeCloseTo(75, 4)
    expect(
      out.warnings.some((w) => w.includes('construction financing')),
    ).toBe(true)
  })

  it('allows full construction financing when requested purchase financing leaves enough total LTC room', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({
        propertyState: 'CA',
        guarantorExperience: '5+',
        purchasePriceOrAsIsValue: 500_000,
        projectBudget: 100_000,
        estimatedArv: 800_000,
        requestedPurchasePriceFinancedPct: 80,
        requestedConstructionFinancedPct: 100,
      }),
    )
    expect(out.purchaseMoneyLoan).toBe(400_000)
    expect(out.requestedMaxConstructionFinancedPct).toBe(100)
    expect(out.rehabLoan).toBe(100_000)
  })

  it('exposes adjusted leverage caps on outputs', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({
        propertyState: 'CA',
        guarantorExperience: '5+',
        purchasePriceOrAsIsValue: 500_000,
        projectBudget: 100_000,
        estimatedArv: 800_000,
      }),
    )
    expect(out.maxInitialLtcPct).not.toBeNull()
    expect(out.maxRehabLtcPct).not.toBeNull()
    expect(out.maxTotalLtcPct).not.toBeNull()
    expect(out.maxArvLtvPct).not.toBeNull()
    expect(out.termMonths).toBe(12)
  })

  it('applies Nassau county as the moderate negative adjustment', () => {
    const out = calculateLoanSizerOutputs(
      baseInputs({
        propertyState: 'NY',
        propertyCounty: 'Nassau',
      }),
    )
    expect(
      out.assumptions.some((a) =>
        a.includes('Florida / Texas / Nassau / Suffolk'),
      ),
    ).toBe(true)
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
      out.programRate,
      out.finalRate,
      out.maxDay1Loan,
      out.maxFinancedBudget,
      out.maxTotalLoan,
      out.maxLtv,
      out.maxLtc,
      out.maxLtarv,
      out.requestedLtv,
      out.requestedLtc,
      out.requestedLtarv,
      out.maxInitialLtcPct,
      out.maxRehabLtcPct,
      out.maxTotalLtcPct,
      out.maxArvLtvPct,
      out.guideInitialLtcPct,
      out.guideRehabLtcPct,
      out.guideTotalLtcPct,
      out.guideArvLtvPct,
      out.purchaseMoneyLoan,
      out.rehabLoan,
      out.termMonths,
      out.brokerRateAddOnPct,
      out.estimatedMonthlyPayment,
      out.downPaymentNeeded,
      out.estimatedCashToCoverClosing,
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
        guarantorExperience: '5+',
        qualifyingFico: 720,
        estimatedArv: 900_000,
        projectBudget: 150_000,
        roofRemoval: true,
      }),
    )
    expect(out.liquidityRequired).not.toBeNull()
    expect(out.liquidityRequired).toBeGreaterThan(0)
  })
})
