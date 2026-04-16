export type Tier = 'Silver' | 'Gold' | 'Platinum'

export type ProjectType =
  | 'Bridge No Rehab'
  | 'Light Rehab'
  | 'Standard Rehab'
  | 'Super Rehab'
  | 'GUC'

export type GuarantorExperience = '0-2' | '3-4' | '5+'

export type Citizenship = 'domestic' | 'foreignNational'

export type OriginationPointsChoice = 1 | 0.5 | 0

export type FicoBand =
  | 'below680'
  | '680-699'
  | '700-719'
  | '720-739'
  | '740+'

export interface LoanSizerInputs {
  estimatedArv: number | null
  guarantorExperience: GuarantorExperience
  useChange: boolean
  propertyState: string
  propertyCounty?: string | null
  qualifyingFico: number | null
  purchasePriceOrAsIsValue: number | null
  citizenship: Citizenship
  projectBudget: number | null
  pointsOrOriginationChoice?: OriginationPointsChoice | null
  requestedDay1LoanAmount: number | null
  permitsApprovedOrImminent?: boolean
  roofRemoval?: boolean
  wallRemoval?: boolean
  nonWarrantableCondo?: boolean
  projectTypeOverride?: ProjectType | null
  /** Optional; defaults false. Used only for lender fee selection assumptions. */
  isTwoToFourUnits?: boolean
  /** Broker points (percentage of Day 1 loan) used in cash-to-close only. */
  brokerPointsPct?: number | null
  /** Underwriting, attorney, appraisal fees in USD; feed cash-to-close only. */
  underwritingFeeUsd?: number | null
  attorneyFeeUsd?: number | null
  appraisalFeeUsd?: number | null
}

export type ProfitabilityResult = 'Pass' | 'Fail' | 'Ineligible'

export interface LoanSizerOutputs {
  projectType: ProjectType | null
  estimatedTier: Tier | null
  profitabilityResult: ProfitabilityResult | null
  baseRate: number | null
  finalRate: number | null
  maxDay1Loan: number | null
  maxFinancedBudget: number | null
  maxTotalLoan: number | null
  requestedDay1LoanAmount: number | null
  requestedFinancedBudget: number | null
  requestedTotalLoan: number | null
  maxLtv: number | null
  maxLtc: number | null
  maxLtarv: number | null
  requestedLtv: number | null
  requestedLtc: number | null
  requestedLtarv: number | null
  /** Adjusted leverage caps (post all bonuses, adjustments, condo) exposed for the UI. */
  maxInitialLtcPct: number | null
  maxTotalLtcPct: number | null
  maxArvLtvPct: number | null
  downPaymentNeeded: number | null
  estimatedCashToCoverClosing: number | null
  /** Interest-only monthly payment on the requested Day 1 loan. */
  estimatedMonthlyPayment: number | null
  liquidityRequired: number | null
  minFico: number | null
  maxLoanAmount: number | null
  lenderFees: number | null
  isEligible: boolean
  warnings: string[]
  assumptions: string[]
}

export type NegativeAdjustmentKind =
  | 'none'
  | 'foreignNational'
  | 'floridaTexasOrNassauSuffolk'
  | 'newYorkHeavyCounties'

export interface NegativeAdjustmentSelection {
  kind: NegativeAdjustmentKind
  /** Percentage points to subtract from leverage caps (e.g. 5 means −5pp). */
  leverageReductionPercentagePoints: number
}

export interface LeverageCaps {
  maxInitialLtcPct: number | null
  maxRehabLtcPct: number | null
  maxTotalLtcPct: number | null
  maxArvLtvPct: number | null
}

export interface LeverageRowConfig {
  /** Primary initial LTC when permits path does not apply or lower tier is required. */
  initialLtcBasePct: number | null
  /** Higher initial LTC when permits are approved/imminent (rate sheet starred values). */
  initialLtcWithPermitsPct: number | null
  maxRehabLtcPct: number | null
  maxTotalLtcPct: number | null
  maxArvLtvPct: number | null
}

/** Initial LTC with optional starred / permits-elevated tier (rate sheet asterisk). */
export interface InitialLtcConditionalConfig {
  /** Standard (unstarred / lower) initial LTC cap. */
  basePct: number | null
  /**
   * Elevated cap when permits are approved or imminent—maps to starred sheet values.
   * `null` when this cell has no second tier on the sheet.
   */
  elevatedWithPermitsApprovedPct: number | null
  /** True when the published sheet shows a conditional/starred initial LTC band. */
  sheetShowsStarredInitialLtc: boolean
  /** Cross-reference key for PDF footnotes (optional). */
  rateSheetConditionKey?: string
}

/** One cell in the tier × project-type leverage matrix (normalized). */
export interface LeverageMatrixCellConfig {
  initialLtc: InitialLtcConditionalConfig
  maxRehabLtcPct: number | null
  maxTotalLtcPct: number | null
  maxArvLtvPct: number | null
}

export interface RateSheetMeta {
  productLabel: string
  rateSheetVersion: string
  sourceNote: string
}

export interface OriginationOptionConfig {
  points: OriginationPointsChoice
  label: string
  sortOrder: number
}

export interface ProjectRateAddOnConfig {
  id: string
  addRatePp: number
  when: { projectType: ProjectType }
  /** `null` = all tiers; otherwise only these tiers receive the add-on. */
  allowedTiers: readonly Tier[] | null
}

export interface BaseRateRowConfig {
  points: OriginationPointsChoice
  byTier: Record<Tier, number>
}

export interface ProjectTypeConfig {
  id: ProjectType
  /** UI-facing label (may differ from rate sheet punctuation). */
  displayLabel: string
  sortOrder: number
}

export interface NegativeLeverageRuleConfig {
  id: string
  kind: NegativeAdjustmentKind
  reductionPp: number
  /** Discriminator for matcher in rules layer. */
  matchType:
    | 'citizenshipForeignNational'
    | 'stateFloridaTexasOrNassauSuffolk'
    | 'newYorkHeavyCounty'
  /** Human-readable description for UI / assumptions. */
  summaryLabel: string
}

export interface FeeRuleConfig {
  id: string
  amountUsd: number
  match: {
    groundUpConstruction: boolean
    twoToFourUnits: boolean
  }
}

/** Full normalized rate sheet model (single source of truth for program constants). */
export interface RateSheetConfig {
  meta: RateSheetMeta
  documentation: { globalAssumptions: readonly string[] }
  tiers: {
    experienceToTier: Record<GuarantorExperience, Tier>
    displayOrder: readonly Tier[]
  }
  origination: { options: readonly OriginationOptionConfig[] }
  rates: {
    baseRateRows: readonly BaseRateRowConfig[]
    configurableAdditionalSpreadPp: number
    projectAddOns: readonly ProjectRateAddOnConfig[]
  }
  projectTypes: readonly ProjectTypeConfig[]
  groundUp: {
    allowedTiers: readonly Tier[]
    /** Set of tier for fast membership checks. */
    allowedTierSet: ReadonlySet<Tier>
  }
  leverage: {
    matrix: Record<Tier, Record<ProjectType, LeverageMatrixCellConfig>>
    purchaseBonusPp: number
    lowRehabRatioThreshold: number
    smallDealLowRehabRatioThreshold: number
    smallDealLtarvDollarThreshold: number
    gucPermitsInitialLtvBonusByTier: Partial<Record<Tier, number>>
  }
  fico: {
    defaultMinimum: number
    /** Overrides by project type when stricter than default. */
    minimumByProjectType: Partial<Record<ProjectType, number>>
  }
  limits: {
    maxLoanAmountUsd: number
    termMonths: number
  }
  fees: {
    /** First matching rule wins (order is specific → general). */
    selectionRules: readonly FeeRuleConfig[]
  }
  adjustments: {
    /**
     * Geographic / product leverage haircuts; engine picks single max `reductionPp`
     * (non-cumulative). Condo handled separately.
     */
    negativeLeverageRules: readonly NegativeLeverageRuleConfig[]
    newYorkHeavyCounties: readonly string[]
    newYorkModerateCounties: readonly string[]
    unavailableStates: readonly string[]
    entityOnlyStates: readonly string[]
    stateCodes: {
      florida: string
      texas: string
      newYork: string
    }
    nonWarrantableCondo: {
      reductionPp: number
      absoluteCapPct: number
    }
  }
  liquidity: {
    /** Ground Up: extra liquidity as fraction of construction budget (e.g. 0.2 = 20%). */
    groundUpConstructionBudgetFraction: number
  }
}
