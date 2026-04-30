import {
  GLOBAL_ASSUMPTIONS,
  GROUND_UP_LIQUIDITY_CONSTRUCTION_BUDGET_PCT,
  LOAN_TERM_MONTHS,
  MAX_LOAN_AMOUNT_USD,
  RATE_SHEET_CONFIG,
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
  getGucPermitsInitialLtvBonusPp,
  getGuideLeverage,
  getMostRestrictiveNegativeAdjustment,
  getPositiveLeverageBonusPp,
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

function finitePositiveOrNull(n: number): number | null {
  if (!Number.isFinite(n)) return null
  return Math.max(0, n)
}

function minFinite(values: Array<number | null | undefined>): number | null {
  const finite = values.filter(
    (v): v is number => v !== null && v !== undefined && Number.isFinite(v),
  )
  if (finite.length === 0) return null
  return Math.min(...finite)
}

function calculateAmountFromPercent(
  amount: number | null,
  percent: number | null | undefined,
): number | null {
  if (
    amount === null ||
    percent === null ||
    percent === undefined ||
    !Number.isFinite(amount) ||
    !Number.isFinite(percent)
  ) {
    return null
  }
  return finiteOrNull(Math.max(0, amount) * (Math.max(0, percent) / 100))
}

function calculatePercentFromAmount(
  amount: number | null,
  basis: number | null,
): number | null {
  if (
    amount === null ||
    basis === null ||
    !Number.isFinite(amount) ||
    !Number.isFinite(basis) ||
    basis <= 0
  ) {
    return null
  }
  return finitePositiveOrNull((amount / basis) * 100)
}

function calculateFinancedBudget(
  projectType: ProjectType | null,
  budget: number,
): number {
  if (projectType === 'Bridge No Rehab') return 0
  return Math.max(0, Number.isFinite(budget) ? budget : 0)
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
  projectType: ProjectType | null,
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

  const financedBudget =
    projectType === 'Bridge No Rehab'
      ? 0
      : calculateMaxRehabFinancing(budget, caps.maxRehabLtcPct) ?? 0

  if (caps.maxInitialLtcPct !== null) {
    const v = aiv * (caps.maxInitialLtcPct / 100) + financedBudget
    if (Number.isFinite(v)) parts.push(v)
  }
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
  if (parts.length === 0) {
    if (caps.maxInitialLtcPct !== null) {
      const maxDay1 = aiv * (caps.maxInitialLtcPct / 100)
      return finiteOrNull(Math.min(maxDay1, MAX_LOAN_AMOUNT_USD))
    }
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
  projectType: ProjectType | null,
  requestedFinancedBudgetOverride?: number | null,
): {
  requestedFinancedBudget: number
  requestedTotalLoan: number
  requestedLtv: number | null
  requestedLtc: number | null
  requestedLtarv: number | null
} {
  const b = Number.isFinite(budget) ? budget : 0
  const requestedFinancedBudget =
    requestedFinancedBudgetOverride ?? calculateFinancedBudget(projectType, b)
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

export function calculateLiquidityRequirement(
  projectType: ProjectType | null,
  downPaymentNeeded: number,
  constructionBudget: number,
): number | null {
  if (projectType !== 'GUC') return null
  const cash = Number.isFinite(downPaymentNeeded) ? downPaymentNeeded : 0
  const extra =
    Math.max(0, Number.isFinite(constructionBudget) ? constructionBudget : 0) *
    GROUND_UP_LIQUIDITY_CONSTRUCTION_BUDGET_PCT
  return finiteOrNull(cash + extra)
}

export function calculateProfitability(
  projectType: ProjectType | null,
  aiv: number | null,
  budget: number | null,
  arv: number | null,
): Exclude<ProfitabilityResult, 'Ineligible'> | null {
  if (
    projectType === null ||
    aiv === null ||
    budget === null ||
    arv === null ||
    !Number.isFinite(aiv) ||
    aiv <= 0 ||
    !Number.isFinite(budget) ||
    budget < 0 ||
    !Number.isFinite(arv) ||
    arv <= 0
  ) {
    return null
  }
  if (projectType === 'Bridge No Rehab') return 'Pass'
  return arv / (aiv + budget) >= 1.15 ? 'Pass' : 'Fail'
}

function nonNegative(n: number | null | undefined): number {
  if (n === null || n === undefined || !Number.isFinite(n)) return 0
  return Math.max(0, n)
}

/**
 * Estimated monthly interest-only payment on the requested Day 1 loan.
 * Returns `null` when either requested Day 1 or rate is missing.
 */
export function calculateMonthlyPayment(
  requestedDay1Loan: number | null,
  annualRatePct: number | null,
): number | null {
  if (
    requestedDay1Loan === null ||
    annualRatePct === null ||
    !Number.isFinite(requestedDay1Loan) ||
    !Number.isFinite(annualRatePct) ||
    requestedDay1Loan <= 0 ||
    annualRatePct <= 0
  ) {
    return null
  }
  const monthly = (requestedDay1Loan * (annualRatePct / 100)) / 12
  return finiteOrNull(monthly)
}

/**
 * Cash the borrower brings to close on a purchase:
 *   down payment + broker points (as pct of Day 1) + flat fees.
 */
export function calculateCashToCoverClosing(params: {
  aiv: number | null
  requestedDay1: number
  brokerPointsPct: number | null
  underwritingFeeUsd: number | null
  attorneyFeeUsd: number | null
  appraisalFeeUsd: number | null
}): { downPaymentNeeded: number | null; cashToCoverClosing: number | null } {
  const { aiv, requestedDay1 } = params
  if (aiv === null || !Number.isFinite(aiv)) {
    return { downPaymentNeeded: null, cashToCoverClosing: null }
  }
  const downPaymentNeeded = Math.max(0, aiv - requestedDay1)
  const brokerDollars =
    nonNegative(params.brokerPointsPct) > 0
      ? (nonNegative(params.brokerPointsPct) / 100) *
        nonNegative(requestedDay1)
      : 0
  const cashToCoverClosing =
    downPaymentNeeded +
    brokerDollars +
    nonNegative(params.underwritingFeeUsd) +
    nonNegative(params.attorneyFeeUsd) +
    nonNegative(params.appraisalFeeUsd)
  return {
    downPaymentNeeded,
    cashToCoverClosing: finiteOrNull(cashToCoverClosing),
  }
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
  const brokerRateAddOnPct =
    inputs.brokerRateAddOnPct !== null &&
    inputs.brokerRateAddOnPct !== undefined &&
    Number.isFinite(inputs.brokerRateAddOnPct)
      ? Math.max(0, inputs.brokerRateAddOnPct)
      : 0
  const requestedPurchasePriceFinancedPct =
    inputs.requestedPurchasePriceFinancedPct ?? null
  const requestedConstructionFinancedPct =
    inputs.requestedConstructionFinancedPct ?? null
  const permits = inputs.permitsApprovedOrImminent ?? false
  const structural = Boolean(inputs.roofRemoval || inputs.wallRemoval)
  const condo = inputs.nonWarrantableCondo ?? false
  const isMulti = inputs.isTwoToFourUnits ?? false

  const pointsChoice = inputs.pointsOrOriginationChoice ?? 1

  if (projectType === null) {
    blocking.push(
      'Project type could not be auto-classified from rehab ratio and GUC flags.',
    )
  }

  if (tier === null) {
    blocking.push('Guarantor experience is required to estimate tier.')
  }

  if (aiv === null || aiv <= 0) {
    blocking.push('Enter a valid purchase price or as-is value.')
  }

  if (
    projectType === 'GUC' &&
    tier &&
    !isGroundUpEligibleForTier(tier)
  ) {
    blocking.push(
      'GUC is not available for the Silver experience tier per program rules.',
    )
  }

  const propertyState = inputs.propertyState.trim().toUpperCase()
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

  if (RATE_SHEET_CONFIG.adjustments.unavailableStates.includes(propertyState)) {
    blocking.push(`This program is not available in ${propertyState}.`)
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

  const positiveBonusPp = getPositiveLeverageBonusPp(
    inputs,
    tier,
    projectType,
    baseLeverage,
  )
  const gucPermitsInitialLtvBonusPp = getGucPermitsInitialLtvBonusPp(
    projectType,
    tier,
    permits,
  )

  const adjustedCaps =
    baseLeverage !== null
      ? applyLeverageAdjustments(
          baseLeverage,
          positiveBonusPp,
          neg.leverageReductionPercentagePoints,
          gucPermitsInitialLtvBonusPp,
          condo,
        )
      : null
  const guideCaps =
    tier !== null && projectType !== null
      ? getGuideLeverage(tier, projectType)
      : null

  if (projectType === 'GUC' && permits && gucPermitsInitialLtvBonusPp > 0) {
    assumptions.push(
      `Applied GUC permits initial LTC bonus of ${gucPermitsInitialLtvBonusPp}pp.`,
    )
  }

  if (positiveBonusPp > 0) {
    assumptions.push(`Applied purchase leverage bonus of ${positiveBonusPp}pp.`)
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

  const budgetForCalc = budget ?? 0
  const maxTotalLoan =
    aiv !== null && aiv > 0 && budget !== null && adjustedCaps
      ? calculateMaxTotalLoan(
          aiv,
          budgetForCalc,
          arv,
          adjustedCaps,
          projectType,
        )
      : null

  const purchaseComponentCap =
    aiv !== null && aiv > 0 && adjustedCaps
      ? calculateMaxDay1Loan(aiv, adjustedCaps.maxInitialLtcPct)
      : null

  const rehabComponentCap =
    projectType === 'Bridge No Rehab'
      ? 0
      : budget !== null && adjustedCaps
        ? calculateMaxRehabFinancing(
            budgetForCalc,
            adjustedCaps.maxRehabLtcPct,
          )
        : null

  const allowablePurchaseMoneyLoan =
    purchaseComponentCap !== null && maxTotalLoan !== null
      ? Math.min(purchaseComponentCap, maxTotalLoan)
      : purchaseComponentCap

  const allowableRehabLoan =
    rehabComponentCap !== null && maxTotalLoan !== null
      ? Math.min(rehabComponentCap, maxTotalLoan)
      : rehabComponentCap

  const maxFinancedBudget =
    rehabComponentCap !== null && maxTotalLoan !== null
      ? Math.min(rehabComponentCap, maxTotalLoan)
      : rehabComponentCap

  const maxDay1Loan =
    purchaseComponentCap !== null && maxTotalLoan !== null
      ? Math.min(
          purchaseComponentCap,
          Math.max(0, maxTotalLoan - (maxFinancedBudget ?? 0)),
        )
      : purchaseComponentCap

  const derivedPurchaseMoneyLoan = calculateAmountFromPercent(
    aiv,
    requestedPurchasePriceFinancedPct,
  )
  const derivedRehabLoan = calculateAmountFromPercent(
    budgetNum,
    requestedConstructionFinancedPct,
  )

  const desiredPurchaseMoneyLoan = Math.max(
    0,
    derivedPurchaseMoneyLoan ?? requestedDay1Raw ?? 0,
  )
  const desiredRehabLoan =
    projectType === 'Bridge No Rehab'
      ? 0
      : Math.max(
          0,
          derivedRehabLoan ?? calculateFinancedBudget(projectType, budgetNum),
        )

  const costBasis =
    aiv !== null && budget !== null && Number.isFinite(aiv + budgetForCalc)
      ? aiv + budgetForCalc
      : null
  const requestedTotalLoanCap = maxTotalLoan

  const purchaseMoneyLoanCap = minFinite([
    purchaseComponentCap,
    requestedTotalLoanCap,
  ])
  const requestedDay1 = Math.min(
    desiredPurchaseMoneyLoan,
    purchaseMoneyLoanCap ?? desiredPurchaseMoneyLoan,
  )
  const remainingRequestedTotal =
    requestedTotalLoanCap !== null
      ? Math.max(0, requestedTotalLoanCap - requestedDay1)
      : null
  const rehabLoanCap = minFinite([rehabComponentCap, remainingRequestedTotal])
  const requestedRehabLoan = Math.min(
    desiredRehabLoan,
    rehabLoanCap ?? desiredRehabLoan,
  )

  const maxPurchaseForCurrentRequest = minFinite([
    purchaseComponentCap,
    requestedTotalLoanCap !== null
      ? Math.max(
          0,
          requestedTotalLoanCap -
            Math.min(desiredRehabLoan, rehabComponentCap ?? desiredRehabLoan),
        )
      : null,
  ])
  const maxConstructionForCurrentRequest = minFinite([
    rehabComponentCap,
    requestedTotalLoanCap !== null
      ? Math.max(
          0,
          requestedTotalLoanCap -
            Math.min(
              desiredPurchaseMoneyLoan,
              purchaseComponentCap ?? desiredPurchaseMoneyLoan,
            ),
        )
      : null,
  ])

  const allowableTotalLtcPct = calculatePercentFromAmount(
    maxTotalLoan,
    costBasis,
  )
  const allowableTotalLtarvPct = calculatePercentFromAmount(maxTotalLoan, arv)
  const allowablePurchasePriceFinancedPct = calculatePercentFromAmount(
    allowablePurchaseMoneyLoan,
    aiv,
  )
  const allowableConstructionFinancedPct = calculatePercentFromAmount(
    allowableRehabLoan,
    budget !== null && budget > 0 ? budget : null,
  )

  const req =
    aiv !== null && aiv > 0
      ? calculateRequestedMetrics(
          aiv,
          budget ?? 0,
          arv !== null && arv > 0 ? arv : 0,
          requestedDay1,
          projectType,
          requestedRehabLoan,
        )
      : {
          requestedFinancedBudget: requestedRehabLoan,
          requestedTotalLoan: requestedDay1 + requestedRehabLoan,
          requestedLtv: null as number | null,
          requestedLtc: null as number | null,
          requestedLtarv: null as number | null,
        }

  const profitabilityBase = calculateProfitability(
    projectType,
    aiv,
    budget,
    arv,
  )
  if (profitabilityBase === 'Fail') {
    blocking.push('Profitability test failed.')
  }

  if (purchaseMoneyLoanCap !== null && desiredPurchaseMoneyLoan > requestedDay1) {
    warnings.push(
      'Requested purchase price financing exceeds the current maximum.',
    )
  }

  if (rehabLoanCap !== null && desiredRehabLoan > requestedRehabLoan) {
    warnings.push(
      'Requested construction financing exceeds the current maximum.',
    )
  }

  if (maxTotalLoan !== null && req.requestedTotalLoan > maxTotalLoan) {
    warnings.push(
      'Requested total loan exceeds the estimated maximum total loan.',
    )
  }

  const { downPaymentNeeded, cashToCoverClosing } = calculateCashToCoverClosing(
    {
      aiv,
      requestedDay1,
      brokerPointsPct: inputs.brokerPointsPct ?? null,
      underwritingFeeUsd: inputs.underwritingFeeUsd ?? null,
      attorneyFeeUsd: inputs.attorneyFeeUsd ?? null,
      appraisalFeeUsd: inputs.appraisalFeeUsd ?? null,
    },
  )

  const liquidityRequired =
    downPaymentNeeded !== null
      ? calculateLiquidityRequirement(projectType, downPaymentNeeded, budgetNum)
      : null

  let baseRate: number | null = null
  let programRate: number | null = null
  let finalRate: number | null = null
  if (
    tier &&
    (pointsChoice === 1 || pointsChoice === 0.5 || pointsChoice === 0)
  ) {
    baseRate = getBaseRate(tier, pointsChoice)
    if (baseRate !== null) {
      const addOns = getApplicableRateAddOns(projectType, tier)
      programRate = applyFinalRateAdjustments(baseRate, addOns)
      finalRate = programRate + brokerRateAddOnPct
    }
  }

  if (tier && (baseRate === null || finalRate === null)) {
    blocking.push('Rate could not be determined for the selected options.')
  }

  const lenderFees =
    projectType !== null ? selectLenderFeeUsd(projectType, isMulti) : null

  if (req.requestedTotalLoan > 0 && req.requestedTotalLoan < 75_000) {
    warnings.push('Requested loan amount is below the $75,000 guideline.')
  }

  const isEligible =
    blocking.length === 0 &&
    adjustedCaps !== null &&
    (adjustedCaps.maxInitialLtcPct !== null ||
      projectType === 'Bridge No Rehab')

  if (!isEligible) {
    finalRate = null
  }

  const estimatedMonthlyPayment = calculateMonthlyPayment(
    requestedDay1 > 0 ? requestedDay1 : null,
    finalRate,
  )

  const profitabilityResult =
    !isEligible && profitabilityBase !== 'Fail'
      ? 'Ineligible'
      : profitabilityBase

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
    programRate,
    finalRate,
    maxDay1Loan,
    maxFinancedBudget,
    maxTotalLoan,
    requestedDay1LoanAmount: requestedDay1,
    requestedFinancedBudget: req.requestedFinancedBudget,
    requestedTotalLoan: req.requestedTotalLoan,
    maxLtv,
    maxLtc,
    maxLtarv,
    requestedLtv: req.requestedLtv,
    requestedLtc: req.requestedLtc,
    requestedLtarv: req.requestedLtarv,
    requestedTotalLtcPct:
      req.requestedLtc !== null ? req.requestedLtc * 100 : null,
    requestedTotalLtarvPct:
      req.requestedLtarv !== null ? req.requestedLtarv * 100 : null,
    requestedPurchasePriceFinancedPct,
    requestedConstructionFinancedPct,
    requestedMaxTotalLtcPct: allowableTotalLtcPct,
    requestedMaxTotalLtarvPct: allowableTotalLtarvPct,
    requestedMaxPurchasePriceFinancedPct: calculatePercentFromAmount(
      maxPurchaseForCurrentRequest,
      aiv,
    ),
    requestedMaxConstructionFinancedPct: calculatePercentFromAmount(
      maxConstructionForCurrentRequest,
      budget !== null && budget > 0 ? budget : null,
    ),
    maxInitialLtcPct: allowablePurchasePriceFinancedPct,
    maxRehabLtcPct: allowableConstructionFinancedPct,
    maxTotalLtcPct: allowableTotalLtcPct,
    maxArvLtvPct: allowableTotalLtarvPct,
    guideInitialLtcPct: guideCaps?.maxInitialLtcPct ?? null,
    guideRehabLtcPct: guideCaps?.maxRehabLtcPct ?? null,
    guideTotalLtcPct: guideCaps?.maxTotalLtcPct ?? null,
    guideArvLtvPct: guideCaps?.maxArvLtvPct ?? null,
    purchaseMoneyLoan: requestedDay1,
    rehabLoan: req.requestedFinancedBudget,
    termMonths: LOAN_TERM_MONTHS,
    brokerRateAddOnPct,
    downPaymentNeeded,
    estimatedCashToCoverClosing: cashToCoverClosing,
    estimatedMonthlyPayment,
    liquidityRequired,
    minFico,
    maxLoanAmount: MAX_LOAN_AMOUNT_USD,
    lenderFees,
    isEligible,
    warnings: [...blocking, ...warnings],
    assumptions: [...assumptions, ...GLOBAL_ASSUMPTIONS],
  }
}
