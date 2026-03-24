import { describe, expect, it } from 'vitest'
import {
  applyFinalRateAdjustments,
  applyLeverageAdjustments,
  deriveTier,
  getApplicableRateAddOns,
  getBaseRate,
  getMostRestrictiveNegativeAdjustment,
  isGroundUpEligibleForTier,
  resolveInitialLtcPct,
} from '../domain/loanSizer/rules'
import type { LeverageRowConfig } from '../domain/loanSizer/types'

describe('deriveTier', () => {
  it('maps experience to tiers', () => {
    expect(deriveTier('1-2')).toBe('Silver')
    expect(deriveTier('3-4')).toBe('Gold')
    expect(deriveTier('5+')).toBe('Platinum')
  })
})

describe('getMostRestrictiveNegativeAdjustment', () => {
  it('picks the largest single reduction (NY over FL)', () => {
    const r = getMostRestrictiveNegativeAdjustment({
      transactionType: 'purchase',
      citizenship: 'domestic',
      propertyState: 'NY',
      propertyCounty: 'Kings',
    })
    expect(r.leverageReductionPercentagePoints).toBe(15)
    expect(r.kind).toBe('newYorkSelectCounties')
  })

  it('does not stack cash-out and foreign national', () => {
    const r = getMostRestrictiveNegativeAdjustment({
      transactionType: 'cashOutRefi',
      citizenship: 'foreignNational',
      propertyState: 'CA',
      propertyCounty: null,
    })
    expect(r.leverageReductionPercentagePoints).toBe(5)
  })

  it('applies Florida state rule without county', () => {
    const r = getMostRestrictiveNegativeAdjustment({
      transactionType: 'purchase',
      citizenship: 'domestic',
      propertyState: 'FL',
      propertyCounty: null,
    })
    expect(r.kind).toBe('floridaOrTexas')
    expect(r.leverageReductionPercentagePoints).toBe(5)
  })
})

describe('getBaseRate and add-ons', () => {
  it('returns configured base rate', () => {
    expect(getBaseRate('Gold', 1)).toBe(9.49)
    expect(getBaseRate('Silver', 0.5)).toBe(10.99)
  })

  it('adds transaction and Ground Up add-ons for allowed tiers', () => {
    const add = getApplicableRateAddOns(
      'cashOutRefi',
      'Ground Up Construction',
      'Platinum',
    )
    expect(add).toBe(1 + 0.75)
  })

  it('does not add Ground Up for Silver', () => {
    const add = getApplicableRateAddOns(
      'purchase',
      'Ground Up Construction',
      'Silver',
    )
    expect(add).toBe(0)
  })

  it('applies final configurable adjustment', () => {
    expect(applyFinalRateAdjustments(9, 1)).toBe(10)
  })
})

describe('Ground Up tier gate', () => {
  it('disallows Silver', () => {
    expect(isGroundUpEligibleForTier('Silver')).toBe(false)
    expect(isGroundUpEligibleForTier('Gold')).toBe(true)
  })
})

describe('resolveInitialLtcPct', () => {
  const row: LeverageRowConfig = {
    initialLtcBasePct: 85,
    initialLtcWithPermitsPct: 90,
    maxRehabLtcPct: 100,
    maxTotalLtcPct: 90,
    maxArvLtvPct: 75,
  }

  it('uses permits path when approved and no structural conflict', () => {
    expect(resolveInitialLtcPct(row, true, false)).toBe(90)
  })

  it('uses base when structural work without permits', () => {
    expect(resolveInitialLtcPct(row, false, true)).toBe(85)
  })
})

describe('applyLeverageAdjustments', () => {
  const base = {
    maxInitialLtcPct: 90,
    maxRehabLtcPct: 100,
    maxTotalLtcPct: 90,
    maxArvLtvPct: 75,
  }

  it('subtracts single negative adjustment in pp', () => {
    const out = applyLeverageAdjustments(base, 5, false)
    expect(out.maxInitialLtcPct).toBe(85)
  })

  it('applies non-warrantable condo post-process', () => {
    const out = applyLeverageAdjustments(base, 0, true)
    expect(out.maxInitialLtcPct).toBe(65)
  })
})
