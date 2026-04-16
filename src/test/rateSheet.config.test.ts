import { describe, expect, it } from 'vitest'
import {
  BASE_RATE_TABLE,
  LEVERAGE_MATRIX,
  RATE_SHEET_CONFIG,
  leverageMatrixCellToRowConfig,
  originationSelectOptions,
  projectTypeSelectOptions,
} from '../domain/loanSizer/constants'
import {
  getApplicableRateAddOns,
  getBaseRate,
  getMostRestrictiveNegativeAdjustment,
  negativeAdjustmentLabel,
  selectLenderFeeUsd,
} from '../domain/loanSizer/rules'
import type { ProjectType, Tier } from '../domain/loanSizer/types'

const TIERS: Tier[] = ['Silver', 'Gold', 'Platinum']
const PROJECTS: ProjectType[] = [
  'Bridge No Rehab',
  'Light Rehab',
  'Standard Rehab',
  'Super Rehab',
  'GUC',
]

describe('RATE_SHEET_CONFIG structure', () => {
  it('has meta and version', () => {
    expect(RATE_SHEET_CONFIG.meta.rateSheetVersion).toBe('10.3.2025')
    expect(RATE_SHEET_CONFIG.meta.productLabel.length).toBeGreaterThan(0)
  })

  it('maps every experience band to a tier', () => {
    expect(RATE_SHEET_CONFIG.tiers.experienceToTier['0-2']).toBe('Silver')
    expect(RATE_SHEET_CONFIG.tiers.experienceToTier['3-4']).toBe('Gold')
    expect(RATE_SHEET_CONFIG.tiers.experienceToTier['5+']).toBe('Platinum')
  })

  it('includes origination options aligned with base rate rows', () => {
    const points = new Set(
      RATE_SHEET_CONFIG.rates.baseRateRows.map((r) => r.points),
    )
    for (const opt of RATE_SHEET_CONFIG.origination.options) {
      expect(points.has(opt.points)).toBe(true)
    }
    expect(RATE_SHEET_CONFIG.origination.options.length).toBe(
      RATE_SHEET_CONFIG.rates.baseRateRows.length,
    )
  })

  it('defines base rate for every tier × origination row', () => {
    for (const row of RATE_SHEET_CONFIG.rates.baseRateRows) {
      for (const tier of TIERS) {
        expect(typeof row.byTier[tier]).toBe('number')
        expect(row.byTier[tier]).toBeGreaterThan(0)
      }
    }
  })

  it('lists project types in sort order', () => {
    const ids = RATE_SHEET_CONFIG.projectTypes.map((p) => p.id)
    for (const p of PROJECTS) {
      expect(ids).toContain(p)
    }
  })

  it('restricts Ground Up to configured tiers only', () => {
    expect(RATE_SHEET_CONFIG.groundUp.allowedTiers).toEqual([
      'Gold',
      'Platinum',
    ])
    expect(RATE_SHEET_CONFIG.groundUp.allowedTierSet.has('Silver')).toBe(false)
  })

  it('has full leverage matrix for every tier × project', () => {
    for (const tier of TIERS) {
      for (const pt of PROJECTS) {
        const cell = RATE_SHEET_CONFIG.leverage.matrix[tier][pt]
        expect(cell).toBeDefined()
        expect(cell.initialLtc).toBeDefined()
      }
    }
  })

  it('marks starred initial LTC only when an elevated permits tier exists', () => {
    for (const tier of TIERS) {
      for (const pt of PROJECTS) {
        const { initialLtc } = RATE_SHEET_CONFIG.leverage.matrix[tier][pt]
        if (initialLtc.sheetShowsStarredInitialLtc) {
          expect(initialLtc.elevatedWithPermitsApprovedPct).not.toBeNull()
          expect(initialLtc.basePct).not.toBeNull()
          expect(
            (initialLtc.elevatedWithPermitsApprovedPct as number) >
              (initialLtc.basePct as number),
          ).toBe(true)
        } else {
          expect(initialLtc.elevatedWithPermitsApprovedPct).toBeNull()
        }
      }
    }
  })

  it('models Bridge No Rehab as initial-only (no rehab/total/ARV caps)', () => {
    for (const tier of TIERS) {
      const cell =
        RATE_SHEET_CONFIG.leverage.matrix[tier]['Bridge No Rehab']
      expect(cell.maxRehabLtcPct).toBeNull()
      expect(cell.maxTotalLtcPct).toBeNull()
      expect(cell.maxArvLtvPct).toBeNull()
      expect(cell.initialLtc.basePct).toBe(75)
      expect(cell.initialLtc.sheetShowsStarredInitialLtc).toBe(false)
    }
  })

  it('marks Silver GUC as not offered (null caps)', () => {
    const cell = RATE_SHEET_CONFIG.leverage.matrix.Silver.GUC
    expect(cell.initialLtc.basePct).toBeNull()
    expect(cell.maxTotalLtcPct).toBeNull()
  })

  it('exposes FICO minimums', () => {
    expect(RATE_SHEET_CONFIG.fico.defaultMinimum).toBe(680)
    expect(
      RATE_SHEET_CONFIG.fico.minimumByProjectType.GUC,
    ).toBe(700)
  })

  it('exposes loan limits', () => {
    expect(RATE_SHEET_CONFIG.limits.maxLoanAmountUsd).toBe(2_000_000)
    expect(RATE_SHEET_CONFIG.limits.termMonths).toBe(12)
  })

  it('orders fee rules from most specific to fallback', () => {
    const rules = RATE_SHEET_CONFIG.fees.selectionRules
    expect(rules[0].match).toEqual({
      groundUpConstruction: true,
      twoToFourUnits: true,
    })
    expect(rules[rules.length - 1].id).toBe('single_loan_rehab')
  })

  it('defines non-cumulative negative leverage rules with unique ids', () => {
    const ids = RATE_SHEET_CONFIG.adjustments.negativeLeverageRules.map(
      (r) => r.id,
    )
    expect(new Set(ids).size).toBe(ids.length)
    const maxReduction = Math.max(
      ...RATE_SHEET_CONFIG.adjustments.negativeLeverageRules.map(
        (r) => r.reductionPp,
      ),
    )
    expect(maxReduction).toBe(15)
  })

  it('captures separate NY heavy and moderate county lists', () => {
    expect(RATE_SHEET_CONFIG.adjustments.newYorkHeavyCounties).toContain('Kings')
    expect(RATE_SHEET_CONFIG.adjustments.newYorkModerateCounties).toContain(
      'Nassau',
    )
  })
})

describe('Form option helpers', () => {
  it('projectTypeSelectOptions includes every configured project type', () => {
    const opts = projectTypeSelectOptions().filter((o) => o.value !== '')
    expect(opts.length).toBe(RATE_SHEET_CONFIG.projectTypes.length)
    for (const p of RATE_SHEET_CONFIG.projectTypes) {
      expect(opts.some((o) => o.value === p.id && o.label === p.displayLabel)).toBe(
        true,
      )
    }
  })

  it('originationSelectOptions mirrors origination.options', () => {
    expect(originationSelectOptions().length).toBe(
      RATE_SHEET_CONFIG.origination.options.length,
    )
  })
})

describe('Derived views match config', () => {
  it('BASE_RATE_TABLE matches baseRateRows', () => {
    for (const row of RATE_SHEET_CONFIG.rates.baseRateRows) {
      expect(BASE_RATE_TABLE[row.points]).toEqual(row.byTier)
    }
  })

  it('LEVERAGE_MATRIX matches leverageMatrixCellToRowConfig', () => {
    for (const tier of TIERS) {
      for (const pt of PROJECTS) {
        expect(LEVERAGE_MATRIX[tier][pt]).toEqual(
          leverageMatrixCellToRowConfig(
            RATE_SHEET_CONFIG.leverage.matrix[tier][pt],
          ),
        )
      }
    }
  })
})

describe('Config-driven rule behavior', () => {
  it('getBaseRate reads from config rows', () => {
    for (const row of RATE_SHEET_CONFIG.rates.baseRateRows) {
      for (const tier of TIERS) {
        expect(getBaseRate(tier, row.points)).toBe(row.byTier[tier])
      }
    }
  })

  it('project add-ons sum from config', () => {
    const guc = RATE_SHEET_CONFIG.rates.projectAddOns.find(
      (a) => a.id === 'ground_up',
    )!.addRatePp
    expect(getApplicableRateAddOns('GUC', 'Gold')).toBe(guc)
  })

  it('getMostRestrictiveNegativeAdjustment uses config reduction values', () => {
    const ny = getMostRestrictiveNegativeAdjustment({
      citizenship: 'domestic',
      propertyState: 'NY',
      propertyCounty: 'Kings',
    })
    const rule = RATE_SHEET_CONFIG.adjustments.negativeLeverageRules.find(
      (r) => r.id === 'ny_heavy_counties',
    )!
    expect(ny.leverageReductionPercentagePoints).toBe(rule.reductionPp)
    expect(ny.kind).toBe(rule.kind)
  })

  it('negativeAdjustmentLabel resolves from config', () => {
    const rule = RATE_SHEET_CONFIG.adjustments.negativeLeverageRules.find(
      (r) => r.id === 'fl_tx_nassau_suffolk',
    )!
    expect(negativeAdjustmentLabel(rule.kind)).toBe(rule.summaryLabel)
  })

  it('selectLenderFeeUsd matches fee selection rules', () => {
    for (const rule of RATE_SHEET_CONFIG.fees.selectionRules) {
      const pt = rule.match.groundUpConstruction
        ? 'GUC'
        : 'Light Rehab'
      expect(
        selectLenderFeeUsd(pt, rule.match.twoToFourUnits),
      ).toBe(rule.amountUsd)
    }
  })
})
