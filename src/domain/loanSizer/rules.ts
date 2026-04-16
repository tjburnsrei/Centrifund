import {
  leverageMatrixCellToRowConfig,
  NEGATIVE_ADJUSTMENT_LABELS,
  NEW_YORK_HEAVY_COUNTIES,
  NEW_YORK_MODERATE_COUNTIES,
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
} from './types'

export function deriveTier(
  guarantorExperience: GuarantorExperience,
): Tier | null {
  const t =
    RATE_SHEET_CONFIG.tiers.experienceToTier[guarantorExperience]
  return t ?? null
}

export function deriveProjectType(
  inputs: Pick<
    LoanSizerInputs,
    | 'purchasePriceOrAsIsValue'
    | 'projectBudget'
    | 'roofRemoval'
    | 'wallRemoval'
    | 'projectTypeOverride'
  >,
): ProjectType | null {
  const isGuc = Boolean(inputs.roofRemoval || inputs.wallRemoval)
  if (isGuc) return 'GUC'

  const value = inputs.purchasePriceOrAsIsValue
  const budget = inputs.projectBudget

  if (
    value === null ||
    budget === null ||
    !Number.isFinite(value) ||
    !Number.isFinite(budget) ||
    value <= 0 ||
    budget < 0
  ) {
    return inputs.projectTypeOverride ?? null
  }

  const rehabRatio = budget / value
  if (budget < value * 0.05) return 'Bridge No Rehab'
  if (rehabRatio < 0.25) return 'Light Rehab'
  if (rehabRatio < 0.5) return 'Standard Rehab'
  if (rehabRatio < 2.5) return 'Super Rehab'
  return null
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
    'citizenship' | 'propertyState' | 'propertyCounty'
  >,
): boolean {
  const { stateCodes } = RATE_SHEET_CONFIG.adjustments

  switch (matchType) {
    case 'citizenshipForeignNational':
      return inputs.citizenship === 'foreignNational'
    case 'stateFloridaTexasOrNassauSuffolk': {
      const st = inputs.propertyState.trim().toUpperCase()
      if (st === stateCodes.florida || st === stateCodes.texas) return true
      if (st !== stateCodes.newYork) return false
      const c = normalizeCounty(inputs.propertyCounty)
      return c.length > 0 && NEW_YORK_MODERATE_COUNTIES.has(c)
    }
    case 'newYorkHeavyCounty': {
      const st = inputs.propertyState.trim().toUpperCase()
      if (st !== stateCodes.newYork) return false
      const c = normalizeCounty(inputs.propertyCounty)
      return c.length > 0 && NEW_YORK_HEAVY_COUNTIES.has(c)
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
    'citizenship' | 'propertyState' | 'propertyCounty'
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
  projectType: ProjectType | null,
  tier: Tier | null,
): number {
  if (projectType === 'GUC') {
    if (tier !== null && RATE_SHEET_CONFIG.groundUp.allowedTierSet.has(tier)) {
      return RATE_SHEET_CONFIG.rates.projectAddOns[0]?.addRatePp ?? 0
    }
    return 0
  }
  return 0
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

export function getPositiveLeverageBonusPp(
  inputs: Pick<
    LoanSizerInputs,
    | 'qualifyingFico'
    | 'nonWarrantableCondo'
    | 'purchasePriceOrAsIsValue'
    | 'projectBudget'
    | 'estimatedArv'
  >,
  tier: Tier | null,
  projectType: ProjectType | null,
  baseCaps: LeverageCaps | null,
): number {
  if (
    tier === null ||
    projectType === null ||
    baseCaps === null ||
    baseCaps.maxArvLtvPct === null ||
    projectType === 'Bridge No Rehab' ||
    projectType === 'GUC'
  ) {
    return 0
  }

  const ficoOk = (inputs.qualifyingFico ?? 0) >= 720
  const tierOk = tier !== 'Silver'
  const condoOk = !(inputs.nonWarrantableCondo ?? false)

  const value = inputs.purchasePriceOrAsIsValue
  const budget = inputs.projectBudget
  if (
    value === null ||
    budget === null ||
    !Number.isFinite(value) ||
    !Number.isFinite(budget) ||
    value <= 0 ||
    budget < 0
  ) {
    return 0
  }

  const rehabRatio = budget / value
  const ltarvDollarCap =
    inputs.estimatedArv !== null && Number.isFinite(inputs.estimatedArv)
      ? (baseCaps.maxArvLtvPct / 100) * inputs.estimatedArv
      : Number.POSITIVE_INFINITY

  const lowRehabCheck =
    rehabRatio <= RATE_SHEET_CONFIG.leverage.lowRehabRatioThreshold ||
    (ltarvDollarCap <= RATE_SHEET_CONFIG.leverage.smallDealLtarvDollarThreshold &&
      rehabRatio <= RATE_SHEET_CONFIG.leverage.smallDealLowRehabRatioThreshold)

  return ficoOk && tierOk && condoOk && lowRehabCheck
    ? RATE_SHEET_CONFIG.leverage.purchaseBonusPp
    : 0
}

export function getGucPermitsInitialLtvBonusPp(
  projectType: ProjectType | null,
  tier: Tier | null,
  permitsApprovedOrImminent: boolean,
): number {
  if (projectType !== 'GUC' || tier === null || !permitsApprovedOrImminent) {
    return 0
  }
  return RATE_SHEET_CONFIG.leverage.gucPermitsInitialLtvBonusByTier[tier] ?? 0
}

export function applyLeverageAdjustments(
  caps: LeverageCaps,
  positiveBonusPp: number,
  negativeAdjustmentPp: number,
  gucPermitsInitialLtvBonusPp: number,
  nonWarrantableCondo: boolean,
): LeverageCaps {
  const condo = RATE_SHEET_CONFIG.adjustments.nonWarrantableCondo

  let next: LeverageCaps = {
    maxInitialLtcPct:
      caps.maxInitialLtcPct === null
        ? null
        : Math.max(
            0,
            caps.maxInitialLtcPct +
              positiveBonusPp -
              negativeAdjustmentPp +
              gucPermitsInitialLtvBonusPp,
          ),
    maxRehabLtcPct: caps.maxRehabLtcPct,
    maxTotalLtcPct:
      caps.maxTotalLtcPct === null
        ? null
        : Math.max(0, caps.maxTotalLtcPct + positiveBonusPp - negativeAdjustmentPp),
    maxArvLtvPct:
      caps.maxArvLtvPct === null
        ? null
        : Math.max(0, caps.maxArvLtvPct - negativeAdjustmentPp),
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
  const groundUpConstruction = projectType === 'GUC'
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
