import {
  leverageMatrixCellToRowConfig,
  NEGATIVE_ADJUSTMENT_LABELS,
  NEW_YORK_ADJUSTMENT_COUNTIES,
  RATE_SHEET_CONFIG,
} from './constants'
import type {
  GuarantorExperience,
  LeverageCaps,
  LeverageRowConfig,
  LoanSizerInputs,
  NegativeAdjustmentKind,
  NegativeAdjustmentSelection,
  OriginationPointsChoice,
  ProjectType,
  Tier,
  TransactionType,
} from './types'

export function deriveTier(
  guarantorExperience: GuarantorExperience,
): Tier | null {
  const t =
    RATE_SHEET_CONFIG.tiers.experienceToTier[guarantorExperience]
  return t ?? null
}

export function deriveProjectType(
  inputs: Pick<LoanSizerInputs, 'projectTypeOverride'>,
): ProjectType | null {
  return inputs.projectTypeOverride ?? null
}

function normalizeCounty(county: string | null | undefined): string {
  return (county ?? '').trim().toUpperCase()
}

function unreachableNegativeMatch(value: never): boolean {
  void value
  return false
}

function negativeRuleApplies(
  matchType: (typeof RATE_SHEET_CONFIG.adjustments.negativeLeverageRules)[number]['matchType'],
  inputs: Pick<
    LoanSizerInputs,
    'transactionType' | 'citizenship' | 'propertyState' | 'propertyCounty'
  >,
): boolean {
  const { stateCodes } = RATE_SHEET_CONFIG.adjustments

  switch (matchType) {
    case 'transactionCashOut':
      return inputs.transactionType === 'cashOutRefi'
    case 'citizenshipForeignNational':
      return inputs.citizenship === 'foreignNational'
    case 'stateFloridaOrTexas': {
      const st = inputs.propertyState.trim().toUpperCase()
      return st === stateCodes.florida || st === stateCodes.texas
    }
    case 'newYorkAllowlistCounty': {
      const st = inputs.propertyState.trim().toUpperCase()
      if (st !== stateCodes.newYork) return false
      const c = normalizeCounty(inputs.propertyCounty)
      return c.length > 0 && NEW_YORK_ADJUSTMENT_COUNTIES.has(c)
    }
    default:
      return unreachableNegativeMatch(matchType)
  }
}

/**
 * Collects applicable geographic / product negative adjustments (non-cumulative)
 * and returns the single largest leverage reduction in percentage points.
 * Non-warrantable condo is handled separately in `applyLeverageAdjustments`.
 */
export function getMostRestrictiveNegativeAdjustment(
  inputs: Pick<
    LoanSizerInputs,
    | 'transactionType'
    | 'citizenship'
    | 'propertyState'
    | 'propertyCounty'
  >,
): NegativeAdjustmentSelection {
  const candidates: NegativeAdjustmentSelection[] = [
    { kind: 'none', leverageReductionPercentagePoints: 0 },
  ]

  for (const rule of RATE_SHEET_CONFIG.adjustments.negativeLeverageRules) {
    if (negativeRuleApplies(rule.matchType, inputs)) {
      candidates.push({
        kind: rule.kind,
        leverageReductionPercentagePoints: rule.reductionPp,
      })
    }
  }

  return candidates.reduce((best, cur) =>
    cur.leverageReductionPercentagePoints >
    best.leverageReductionPercentagePoints
      ? cur
      : best,
  )
}

export function getBaseRate(
  tier: Tier,
  pointsChoice: OriginationPointsChoice,
): number | null {
  const row = RATE_SHEET_CONFIG.rates.baseRateRows.find(
    (r) => r.points === pointsChoice,
  )
  return row?.byTier[tier] ?? null
}

export function getApplicableRateAddOns(
  transactionType: TransactionType,
  projectType: ProjectType | null,
  tier: Tier | null,
): number {
  let add = 0
  for (const addon of RATE_SHEET_CONFIG.rates.transactionAddOns) {
    if (addon.when.transactionType === transactionType) {
      add += addon.addRatePp
    }
  }
  for (const addon of RATE_SHEET_CONFIG.rates.projectAddOns) {
    if (projectType !== addon.when.projectType) continue
    if (addon.allowedTiers === null) {
      add += addon.addRatePp
      continue
    }
    if (tier !== null && addon.allowedTiers.includes(tier)) {
      add += addon.addRatePp
    }
  }
  return add
}

export function applyFinalRateAdjustments(
  baseRate: number,
  addOnsPp: number,
): number {
  return (
    baseRate +
    addOnsPp +
    RATE_SHEET_CONFIG.rates.configurableAdditionalSpreadPp
  )
}

export function resolveInitialLtcPct(
  row: LeverageRowConfig,
  permitsApprovedOrImminent: boolean,
  structuralAlterations: boolean,
): number | null {
  if (
    row.initialLtcBasePct === null &&
    row.initialLtcWithPermitsPct === null
  ) {
    return null
  }
  if (row.initialLtcWithPermitsPct === null) {
    return row.initialLtcBasePct
  }
  if (structuralAlterations && !permitsApprovedOrImminent) {
    return row.initialLtcBasePct
  }
  if (permitsApprovedOrImminent) {
    return row.initialLtcWithPermitsPct
  }
  return row.initialLtcBasePct
}

export function getBaseLeverage(
  tier: Tier,
  projectType: ProjectType,
  permitsApprovedOrImminent: boolean,
  structuralAlterations: boolean,
): LeverageCaps | null {
  const cell = RATE_SHEET_CONFIG.leverage.matrix[tier][projectType]
  if (!cell) return null

  const row = leverageMatrixCellToRowConfig(cell)

  const initial = resolveInitialLtcPct(
    row,
    permitsApprovedOrImminent,
    structuralAlterations,
  )

  return {
    maxInitialLtcPct: initial,
    maxRehabLtcPct: row.maxRehabLtcPct,
    maxTotalLtcPct: row.maxTotalLtcPct,
    maxArvLtvPct: row.maxArvLtvPct,
  }
}

function subtractPp(value: number | null, pp: number): number | null {
  if (value === null) return null
  return Math.max(0, value - pp)
}

export function applyLeverageAdjustments(
  caps: LeverageCaps,
  negativeAdjustmentPp: number,
  nonWarrantableCondo: boolean,
): LeverageCaps {
  const condo = RATE_SHEET_CONFIG.adjustments.nonWarrantableCondo

  let next: LeverageCaps = {
    maxInitialLtcPct: subtractPp(caps.maxInitialLtcPct, negativeAdjustmentPp),
    maxRehabLtcPct: subtractPp(caps.maxRehabLtcPct, negativeAdjustmentPp),
    maxTotalLtcPct: subtractPp(caps.maxTotalLtcPct, negativeAdjustmentPp),
    maxArvLtvPct: subtractPp(caps.maxArvLtvPct, negativeAdjustmentPp),
  }

  if (nonWarrantableCondo) {
    const applyCondo = (v: number | null): number | null => {
      if (v === null) return null
      const reduced = v - condo.reductionPp
      return Math.min(reduced, condo.absoluteCapPct)
    }
    next = {
      maxInitialLtcPct: applyCondo(next.maxInitialLtcPct),
      maxRehabLtcPct: applyCondo(next.maxRehabLtcPct),
      maxTotalLtcPct: applyCondo(next.maxTotalLtcPct),
      maxArvLtvPct: applyCondo(next.maxArvLtvPct),
    }
  }

  return next
}

export function minFicoForProject(projectType: ProjectType | null): number {
  if (!projectType) return RATE_SHEET_CONFIG.fico.defaultMinimum
  const o =
    RATE_SHEET_CONFIG.fico.minimumByProjectType[projectType]
  return o ?? RATE_SHEET_CONFIG.fico.defaultMinimum
}

export function selectLenderFeeUsd(
  projectType: ProjectType | null,
  isTwoToFourUnits: boolean,
): number | null {
  const groundUpConstruction = projectType === 'Ground Up Construction'
  for (const rule of RATE_SHEET_CONFIG.fees.selectionRules) {
    if (
      rule.match.groundUpConstruction === groundUpConstruction &&
      rule.match.twoToFourUnits === isTwoToFourUnits
    ) {
      return rule.amountUsd
    }
  }
  return null
}

export function isGroundUpEligibleForTier(tier: Tier): boolean {
  return RATE_SHEET_CONFIG.groundUp.allowedTierSet.has(tier)
}

export function negativeAdjustmentLabel(kind: NegativeAdjustmentKind): string {
  if (kind === 'none') return 'None'
  return NEGATIVE_ADJUSTMENT_LABELS[kind] ?? kind
}
