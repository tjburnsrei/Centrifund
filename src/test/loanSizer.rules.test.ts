import { describe, expect, it } from 'vitest'
import {
  applyFinalRateAdjustments,
  applyLeverageAdjustments,
  deriveProjectType,
  deriveTier,
  getApplicableRateAddOns,
  getBaseRate,
  getGucPermitsInitialLtvBonusPp,
  getMostRestrictiveNegativeAdjustment,
  getPositiveLeverageBonusPp,
  isGroundUpEligibleForTier,
  resolveInitialLtcPct,
} from '../domain/loanSizer/rules'
import type { LeverageRowConfig } from '../domain/loanSizer/types'

describe('deriveTier', () => {
  it('maps experience to tiers', () => {
    expect(deriveTier('0-2')).toBe('Silver')
    expect(deriveTier('3-4')).toBe('Gold')
    expect(deriveTier('5+')).toBe('Platinum')
  })
})

describe('deriveProjectType', () => {
  it('auto-classifies by rehab ratio', () => {
    expect(
      deriveProjectType({
        purchasePriceOrAsIsValue: 100_000,
        projectBudget: 4_000,
        roofRemoval: false,
        wallRemoval: false,
        projectTypeOverride: null,
      }),
    ).toBe('Bridge No Rehab')
    expect(
      deriveProjectType({
        purchasePriceOrAsIsValue: 100_000,
        projectBudget: 20_000,
        roofRemoval: false,
        wallRemoval: false,
        projectTypeOverride: null,
      }),
    ).toBe('Light Rehab')
    expect(
      deriveProjectType({
        purchasePriceOrAsIsValue: 100_000,
        projectBudget: 40_000,
        roofRemoval: false,
        wallRemoval: false,
        projectTypeOverride: null,
      }),
    ).toBe('Standard Rehab')
    expect(
      deriveProjectType({
        purchasePriceOrAsIsValue: 100_000,
        projectBudget: 60_000,
        roofRemoval: false,
        wallRemoval: false,
        projectTypeOverride: null,
      }),
    ).toBe('Super Rehab')
  })

  it('forces GUC when roof or wall removal is checked', () => {
    expect(
      deriveProjectType({
        purchasePriceOrAsIsValue: 100_000,
        projectBudget: 10_000,
        roofRemoval: true,
        wallRemoval: false,
        projectTypeOverride: null,
      }),
    ).toBe('GUC')
  })

  it('falls back to override when numeric inputs are incomplete', () => {
    expect(
      deriveProjectType({
        purchasePriceOrAsIsValue: null,
        projectBudget: 10_000,
        roofRemoval: false,
        wallRemoval: false,
        projectTypeOverride: 'Light Rehab',
      }),
    ).toBe('Light Rehab')
  })

  it('returns null when rehab ratio exceeds supported bands', () => {
    expect(
      deriveProjectType({
        purchasePriceOrAsIsValue: 100_000,
        projectBudget: 300_000,
        roofRemoval: false,
        wallRemoval: false,
        projectTypeOverride: null,
      }),
    ).toBeNull()
  })
})

describe('getMostRestrictiveNegativeAdjustment', () => {
  it('picks the largest single reduction (NY heavy over FL)', () => {
    const r = getMostRestrictiveNegativeAdjustment({
      citizenship: 'domestic',
      propertyState: 'NY',
      propertyCounty: 'Kings',
    })
    expect(r.leverageReductionPercentagePoints).toBe(15)
    expect(r.kind).toBe('newYorkHeavyCounties')
  })

  it('does not stack foreign national with Florida', () => {
    const r = getMostRestrictiveNegativeAdjustment({
      citizenship: 'foreignNational',
      propertyState: 'FL',
      propertyCounty: null,
    })
    expect(r.leverageReductionPercentagePoints).toBe(5)
  })

  it('applies Florida state rule without county', () => {
    const r = getMostRestrictiveNegativeAdjustment({
      citizenship: 'domestic',
      propertyState: 'FL',
      propertyCounty: null,
    })
    expect(r.kind).toBe('floridaTexasOrNassauSuffolk')
    expect(r.leverageReductionPercentagePoints).toBe(5)
  })

  it('applies Nassau county as -5 not -15', () => {
    const r = getMostRestrictiveNegativeAdjustment({
      citizenship: 'domestic',
      propertyState: 'NY',
      propertyCounty: 'Nassau',
    })
    expect(r.kind).toBe('floridaTexasOrNassauSuffolk')
    expect(r.leverageReductionPercentagePoints).toBe(5)
  })
})

describe('getBaseRate and add-ons', () => {
  it('returns configured base rate', () => {
    expect(getBaseRate('Gold', 1)).toBe(9.49)
    expect(getBaseRate('Silver', 0.5)).toBe(10.99)
  })

  it('adds Ground Up add-on for allowed tiers', () => {
    expect(getApplicableRateAddOns('GUC', 'Platinum')).toBe(0.75)
    expect(getApplicableRateAddOns('GUC', 'Gold')).toBe(0.75)
  })

  it('adds no rate add-on for Silver GUC', () => {
    expect(getApplicableRateAddOns('GUC', 'Silver')).toBe(0)
  })

  it('adds no rate add-on for rehab projects', () => {
    expect(getApplicableRateAddOns('Light Rehab', 'Gold')).toBe(0)
    expect(getApplicableRateAddOns('Standard Rehab', 'Platinum')).toBe(0)
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
    const out = applyLeverageAdjustments(base, 0, 5, 0, false)
    expect(out.maxInitialLtcPct).toBe(85)
  })

  it('applies non-warrantable condo post-process', () => {
    const out = applyLeverageAdjustments(base, 0, 0, 0, true)
    expect(out.maxInitialLtcPct).toBe(65)
  })

  it('adds purchase and permits bonuses before condo logic', () => {
    const out = applyLeverageAdjustments(base, 5, 0, 15, false)
    expect(out.maxInitialLtcPct).toBe(110)
    expect(out.maxTotalLtcPct).toBe(95)
    expect(out.maxRehabLtcPct).toBe(100)
    expect(out.maxArvLtvPct).toBe(75)
  })
})

describe('workbook leverage bonuses', () => {
  it('applies +5pp purchase bonus only when all flags pass', () => {
    const bonus = getPositiveLeverageBonusPp(
      {
        qualifyingFico: 720,
        nonWarrantableCondo: false,
        purchasePriceOrAsIsValue: 200_000,
        projectBudget: 40_000,
        estimatedArv: 300_000,
      },
      'Gold',
      'Standard Rehab',
      {
        maxInitialLtcPct: 85,
        maxRehabLtcPct: 100,
        maxTotalLtcPct: 90,
        maxArvLtvPct: 75,
      },
    )
    expect(bonus).toBe(5)
  })

  it('applies the small-deal 35% rehab bonus path', () => {
    const bonus = getPositiveLeverageBonusPp(
      {
        qualifyingFico: 720,
        nonWarrantableCondo: false,
        purchasePriceOrAsIsValue: 100_000,
        projectBudget: 30_000,
        estimatedArv: 400_000,
      },
      'Gold',
      'Standard Rehab',
      {
        maxInitialLtcPct: 85,
        maxRehabLtcPct: 100,
        maxTotalLtcPct: 90,
        maxArvLtvPct: 75,
      },
    )
    expect(bonus).toBe(5)
  })

  it('does not apply purchase bonus for Silver or condos', () => {
    const caps = {
      maxInitialLtcPct: 85,
      maxRehabLtcPct: 100,
      maxTotalLtcPct: 90,
      maxArvLtvPct: 75,
    }
    expect(
      getPositiveLeverageBonusPp(
        {
          qualifyingFico: 740,
          nonWarrantableCondo: false,
          purchasePriceOrAsIsValue: 200_000,
          projectBudget: 20_000,
          estimatedArv: 300_000,
        },
        'Silver',
        'Light Rehab',
        caps,
      ),
    ).toBe(0)
    expect(
      getPositiveLeverageBonusPp(
        {
          qualifyingFico: 740,
          nonWarrantableCondo: true,
          purchasePriceOrAsIsValue: 200_000,
          projectBudget: 20_000,
          estimatedArv: 300_000,
        },
        'Gold',
        'Light Rehab',
        caps,
      ),
    ).toBe(0)
  })

  it('applies GUC permits bonus only for Gold and Platinum', () => {
    expect(getGucPermitsInitialLtvBonusPp('GUC', 'Gold', true)).toBe(15)
    expect(getGucPermitsInitialLtvBonusPp('GUC', 'Platinum', true)).toBe(20)
    expect(getGucPermitsInitialLtvBonusPp('GUC', 'Silver', true)).toBe(0)
  })

  it('does not apply GUC permits bonus without permits', () => {
    expect(getGucPermitsInitialLtvBonusPp('GUC', 'Gold', false)).toBe(0)
  })
})
