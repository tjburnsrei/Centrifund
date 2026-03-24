import {
  GLOBAL_ASSUMPTIONS,
  GROUND_UP_LIQUIDITY_CONSTRUCTION_BUDGET_PCT,
  MAX_LOAN_AMOUNT_USD,
} from './constants'
import type {
  LeverageCaps,
  LoanSizerInputs,
  LoanSizerOutputs,
  ProfitabilityResult,
  ProjectType,
} from './types'
import {
  applyFinalRateAdjustments,
  applyLeverageAdjustments,
  deriveProjectType,
  deriveTier,
  getApplicableRateAddOns,
  getBaseLeverage,
  getBaseRate,
  getMostRestrictiveNegativeAdjustment,
  isGroundUpEligibleForTier,
  minFicoForProject,
  negativeAdjustmentLabel,
  selectLenderFeeUsd,
} from './rules'

function safeDiv(n: number, d: number): number | null {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return null
  return n / d
}

function finiteOrNull(n: number): number | null {
  if (!Number.isFinite(n)) return null
  return n
}

export function calculateMaxDay1Loan(
  aiv: number,
  adjustedInitialLtcPct: number | null,
): number | null {
  if (
    adjustedInitialLtcPct === null ||
    !Number.isFinite(aiv) ||
    aiv < 0 ||
    !Number.isFinite(adjustedInitialLtcPct)
  ) {
    return null
  }
  const raw = aiv * (adjustedInitialLtcPct / 100)
  return finiteOrNull(raw)
}

/**
 * Rehab dollars financeable from the rehab LTC cap: Budget * (maxRehabLtc/100).
 */
export function calculateMaxRehabFinancing(
  budget: number,
  adjustedMaxRehabLtcPct: number | null,
): number | null {
  if (
    adjustedMaxRehabLtcPct === null ||
    !Number.isFinite(budget) ||
    budget < 0 ||
    !Number.isFinite(adjustedMaxRehabLtcPct)
  ) {
    return null
  }
  const raw = budget * (adjustedMaxRehabLtcPct / 100)
  return finiteOrNull(Math.max(0, raw))
}

export function calculateMaxTotalLoan(
  aiv: number,
  budget: number,
  arv: number | null,
  caps: LeverageCaps,
  maxDay1Loan: number | null,
  maxRehabFromLtc: number | null,
): number | null {
  if (
    !Number.isFinite(aiv) ||
    aiv < 0 ||
    !Number.isFinite(budget) ||
    budget < 0
  ) {
    return null
  }

  const parts: number[] = []

  if (caps.maxTotalLtcPct !== null) {
    const v = (aiv + budget) * (caps.maxTotalLtcPct / 100)
    if (Number.isFinite(v)) parts.push(v)
  }
  if (
    caps.maxArvLtvPct !== null &&
    arv !== null &&
    Number.isFinite(arv) &&
    arv > 0
  ) {
    const v = arv * (caps.maxArvLtvPct / 100)
    if (Number.isFinite(v)) parts.push(v)
  }
  if (maxDay1Loan !== null && maxRehabFromLtc !== null) {
    const v = maxDay1Loan + maxRehabFromLtc
    if (Number.isFinite(v)) parts.push(v)
  }

  if (parts.length === 0) {
    if (maxDay1Loan !== null) return finiteOrNull(Math.min(maxDay1Loan, MAX_LOAN_AMOUNT_USD))
    return null
  }

  const minConstraint = Math.min(...parts)
  const capped = Math.min(minConstraint, MAX_LOAN_AMOUNT_USD)
  return finiteOrNull(Math.max(0, capped))
}

export function calculateRequestedMetrics(
  aiv: number,
  budget: number,
  arv: number,
  requestedDay1: number,
): {
  requestedFinancedBudget: number
  requestedTotalLoan: number
  requestedLtv: number | null
  requestedLtc: number | null
  requestedLtarv: number | null
} {
  const b = Number.isFinite(budget) ? budget : 0
  const requestedFinancedBudget = Math.max(0, b)
  const requestedTotalLoan = requestedDay1 + requestedFinancedBudget
  const aivOk = Number.isFinite(aiv) && aiv > 0
  const costBasis = aiv + b
  const ltcOk = Number.isFinite(costBasis) && costBasis > 0
  return {
    requestedFinancedBudget,
    requestedTotalLoan,
    requestedLtv: aivOk ? safeDiv(requestedDay1, aiv) : null,
    requestedLtc: ltcOk ? safeDiv(requestedTotalLoan, costBasis) : null,
    requestedLtarv:
      arv > 0 && Number.isFinite(arv)
        ? safeDiv(requestedTotalLoan, arv)
        : null,
  }
}

export function calculateCashToClose(
  aiv: number,
  requestedDay1: number,
  totalPayoffs: number,
): { downPaymentNeeded: number; estimatedCashToCoverClosing: number } {
  const a = Number.isFinite(aiv) ? aiv : 0
  const d1 = Number.isFinite(requestedDay1) ? requestedDay1 : 0
  const po = Number.isFinite(totalPayoffs) ? totalPayoffs : 0
  const downPaymentNeeded = Math.max(0, a - d1)
  const estimatedCashToCoverClosing = downPaymentNeeded + Math.max(0, po)
  return { downPaymentNeeded, estimatedCashToCoverClosing }
}

export function calculateLiquidityRequirement(
  projectType: ProjectType | null,
  estimatedCashToCoverClosing: number,
  constructionBudget: number,
): number | null {
  if (projectType !== 'Ground Up Construction') return null
  const ctc = Number.isFinite(estimatedCashToCoverClosing)
    ? estimatedCashToCoverClosing
    : 0
  const extra =
    Math.max(0, Number.isFinite(constructionBudget) ? constructionBudget : 0) *
    GROUND_UP_LIQUIDITY_CONSTRUCTION_BUDGET_PCT
  return finiteOrNull(ctc + extra)
}

export function calculateProfitability(
  isEligible: boolean,
  arv: number | null,
  requestedTotalLoan: number | null,
): ProfitabilityResult | null {
  if (!isEligible) return 'Ineligible'
  if (
    arv === null ||
    requestedTotalLoan === null ||
    !Number.isFinite(arv) ||
    arv <= 0 ||
    !Number.isFinite(requestedTotalLoan)
  ) {
    return null
  }
  return arv > requestedTotalLoan ? 'Pass' : 'Review'
}

export function calculateLoanSizerOutputs(
  inputs: LoanSizerInputs,
): LoanSizerOutputs {
  const blocking: string[] = []
  const warnings: string[] = []
  const assumptions: string[] = []

  const tier = deriveTier(inputs.guarantorExperience)
  const projectType = deriveProjectType(inputs)

  const aiv = inputs.purchasePriceOrAsIsValue
  const arv = inputs.estimatedArv
  const budget = inputs.projectBudget
  const fico = inputs.qualifyingFico
  const requestedDay1Raw = inputs.requestedDay1LoanAmount
  const payoffs = inputs.totalPayoffs ?? 0
  const permits = inputs.permitsApprovedOrImminent ?? false
  const structural = Boolean(inputs.roofRemoval || inputs.wallRemoval)
  const condo = inputs.nonWarrantableCondo ?? false
  const isMulti = inputs.isTwoToFourUnits ?? false

  const pointsChoice = inputs.pointsOrOriginationChoice ?? 1

  if (projectType === null) {
    blocking.push('Select a project / rehab type to size the loan.')
  }

  if (tier === null) {
    blocking.push('Guarantor experience is required to estimate tier.')
  }

  if (aiv === null || aiv <= 0) {
    blocking.push('Enter a valid purchase price or as-is value.')
  }

  if (
    projectType === 'Ground Up Construction' &&
    tier &&
    !isGroundUpEligibleForTier(tier)
  ) {
    blocking.push(
      'Ground Up Construction is not available for the Silver experience tier per program rules.',
    )
  }

  const minFico = minFicoForProject(projectType)
  if (fico !== null && fico < minFico) {
    blocking.push(
      `Qualifying FICO is below the ${minFico} minimum for this scenario.`,
    )
  }

  const neg = getMostRestrictiveNegativeAdjustment(inputs)
  if (neg.kind !== 'none') {
    assumptions.push(
      `Applied single non-cumulative leverage adjustment: ${negativeAdjustmentLabel(neg.kind)}.`,
    )
  }

  let baseLeverage: LeverageCaps | null = null
  if (tier && projectType) {
    baseLeverage = getBaseLeverage(
      tier,
      projectType,
      permits,
      structural,
    )
    if (
      baseLeverage !== null &&
      baseLeverage.maxInitialLtcPct === null &&
      projectType !== 'Bridge No Rehab'
    ) {
      blocking.push(
        'Leverage row is unavailable for this tier and project type.',
      )
    }
  }

  const adjustedCaps =
    baseLeverage !== null
      ? applyLeverageAdjustments(
          baseLeverage,
          neg.leverageReductionPercentagePoints,
          condo,
        )
      : null

  if (structural && !permits) {
    warnings.push(
      'Structural alterations are indicated without approved/imminent permits; initial LTC uses the lower tier.',
    )
  }

  const budgetNum = budget ?? 0

  const needsArvForSizing =
    adjustedCaps?.maxArvLtvPct !== null &&
    projectType !== null &&
    projectType !== 'Bridge No Rehab'

  if (needsArvForSizing && (arv === null || arv <= 0)) {
    blocking.push(
      'Estimated ARV is required for this project type to apply the ARV/LTV cap.',
    )
  }

  const rehabLike =
    projectType !== null && projectType !== 'Bridge No Rehab'
  if (rehabLike && (budget === null || budget < 0)) {
    blocking.push('Enter a valid project / rehab budget for this product type.')
  }

  if (fico === null) {
    blocking.push('Enter qualifying FICO to confirm eligibility.')
  }

  const maxDay1Loan =
    aiv !== null && aiv > 0 && adjustedCaps
      ? calculateMaxDay1Loan(aiv, adjustedCaps.maxInitialLtcPct)
      : null

  const maxRehabFin =
    adjustedCaps && budget !== null && budget >= 0
      ? calculateMaxRehabFinancing(budget, adjustedCaps.maxRehabLtcPct)
      : null

  const budgetForCalc = budget ?? 0

  const maxTotalLoan =
    aiv !== null && aiv > 0 && budget !== null && adjustedCaps
      ? calculateMaxTotalLoan(
          aiv,
          budgetForCalc,
          arv,
          adjustedCaps,
          maxDay1Loan,
          maxRehabFin,
        )
      : maxDay1Loan !== null
        ? finiteOrNull(Math.min(maxDay1Loan, MAX_LOAN_AMOUNT_USD))
        : null

  const maxFinancedBudget =
    maxTotalLoan !== null && maxDay1Loan !== null
      ? finiteOrNull(Math.max(0, maxTotalLoan - maxDay1Loan))
      : null

  const requestedDay1 = Math.max(0, requestedDay1Raw ?? 0)
  const req =
    aiv !== null && aiv > 0
      ? calculateRequestedMetrics(
          aiv,
          budget ?? 0,
          arv !== null && arv > 0 ? arv : 0,
          requestedDay1,
        )
      : {
          requestedFinancedBudget: Math.max(0, budgetNum),
          requestedTotalLoan: requestedDay1 + Math.max(0, budgetNum),
          requestedLtv: null as number | null,
          requestedLtc: null as number | null,
          requestedLtarv: null as number | null,
        }

  if (
    maxDay1Loan !== null &&
    requestedDay1Raw !== null &&
    requestedDay1Raw > maxDay1Loan
  ) {
    warnings.push(
      'Requested Day 1 loan exceeds the estimated maximum Day 1 loan.',
    )
  }

  if (maxTotalLoan !== null && req.requestedTotalLoan > maxTotalLoan) {
    warnings.push(
      'Requested total loan exceeds the estimated maximum total loan.',
    )
  }

  const { downPaymentNeeded, estimatedCashToCoverClosing } =
    aiv !== null
      ? calculateCashToClose(aiv, requestedDay1, payoffs)
      : {
          downPaymentNeeded: null as number | null,
          estimatedCashToCoverClosing: null as number | null,
        }

  const liquidityRequired =
    downPaymentNeeded !== null && estimatedCashToCoverClosing !== null
      ? calculateLiquidityRequirement(
          projectType,
          estimatedCashToCoverClosing,
          budgetNum,
        )
      : null

  let baseRate: number | null = null
  let finalRate: number | null = null
  if (
    tier &&
    (pointsChoice === 1 || pointsChoice === 0.5 || pointsChoice === 0)
  ) {
    baseRate = getBaseRate(tier, pointsChoice)
    if (baseRate !== null) {
      const addOns = getApplicableRateAddOns(
        inputs.transactionType,
        projectType,
        tier,
      )
      finalRate = applyFinalRateAdjustments(baseRate, addOns)
    }
  }

  if (tier && (baseRate === null || finalRate === null)) {
    blocking.push('Rate could not be determined for the selected options.')
  }

  const lenderFees =
    projectType !== null ? selectLenderFeeUsd(projectType, isMulti) : null

  const isEligible =
    blocking.length === 0 &&
    adjustedCaps !== null &&
    (adjustedCaps.maxInitialLtcPct !== null ||
      projectType === 'Bridge No Rehab')

  const profitabilityResult = calculateProfitability(
    isEligible,
    arv,
    req.requestedTotalLoan,
  )

  const maxLtv =
    maxDay1Loan !== null && aiv !== null && aiv > 0
      ? safeDiv(maxDay1Loan, aiv)
      : null
  const maxLtc =
    maxTotalLoan !== null && aiv !== null && budget !== null && aiv + budget > 0
      ? safeDiv(maxTotalLoan, aiv + budget)
      : null
  const maxLtarv =
    maxTotalLoan !== null && arv !== null && arv > 0
      ? safeDiv(maxTotalLoan, arv)
      : null

  return {
    projectType,
    estimatedTier: tier,
    profitabilityResult,
    baseRate,
    finalRate,
    maxDay1Loan,
    maxFinancedBudget,
    maxTotalLoan,
    requestedDay1LoanAmount: requestedDay1Raw,
    requestedFinancedBudget: req.requestedFinancedBudget,
    requestedTotalLoan: req.requestedTotalLoan,
    maxLtv,
    maxLtc,
    maxLtarv,
    requestedLtv: req.requestedLtv,
    requestedLtc: req.requestedLtc,
    requestedLtarv: req.requestedLtarv,
    downPaymentNeeded,
    estimatedCashToCoverClosing,
    liquidityRequired,
    minFico,
    maxLoanAmount: MAX_LOAN_AMOUNT_USD,
    lenderFees,
    isEligible,
    warnings: [...blocking, ...warnings],
    assumptions: [...assumptions, ...GLOBAL_ASSUMPTIONS],
  }
}
