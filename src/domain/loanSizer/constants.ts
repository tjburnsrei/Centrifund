/**
 * Centrifund loan sizer — normalized rate sheet configuration.
 *
 * PRIMARY SOURCE OF TRUTH: Wholesale (Tier 1) Fix & Flip rate sheet v10.3.2025
 * (PDF). Cells not confirmed against the PDF are documented in
 * `documentation.globalAssumptions` and in per-cell `rateSheetConditionKey` where
 * applicable.
 *
 * All program constants for sizing should flow from `RATE_SHEET_CONFIG` (or helpers
 * below). Do not duplicate magic numbers in UI or rules.
 */

import type {
  GuarantorExperience,
  LeverageMatrixCellConfig,
  LeverageRowConfig,
  NegativeAdjustmentKind,
  OriginationPointsChoice,
  ProjectType,
  RateSheetConfig,
  Tier,
} from './types'

// —— Matrix cell builders (keep sheet structure explicit) ————————————————

function bridgeNoRehab(
  initialLtcPct: number,
  key: string,
): LeverageMatrixCellConfig {
  return {
    initialLtc: {
      basePct: initialLtcPct,
      elevatedWithPermitsApprovedPct: null,
      sheetShowsStarredInitialLtc: false,
      rateSheetConditionKey: key,
    },
    maxRehabLtcPct: null,
    maxTotalLtcPct: null,
    maxArvLtvPct: null,
  }
}

/** Starred initial LTC: higher cap when permits approved / imminent. */
function rehabCell(
  baseInitial: number,
  starredInitial: number,
  rehabLtc: number,
  totalLtc: number,
  arvLtv: number,
  key: string,
): LeverageMatrixCellConfig {
  return {
    initialLtc: {
      basePct: baseInitial,
      elevatedWithPermitsApprovedPct:
        starredInitial === baseInitial ? null : starredInitial,
      sheetShowsStarredInitialLtc: starredInitial !== baseInitial,
      rateSheetConditionKey: key,
    },
    maxRehabLtcPct: rehabLtc,
    maxTotalLtcPct: totalLtc,
    maxArvLtvPct: arvLtv,
  }
}

function notOfferedCell(key: string): LeverageMatrixCellConfig {
  return {
    initialLtc: {
      basePct: null,
      elevatedWithPermitsApprovedPct: null,
      sheetShowsStarredInitialLtc: false,
      rateSheetConditionKey: key,
    },
    maxRehabLtcPct: null,
    maxTotalLtcPct: null,
    maxArvLtvPct: null,
  }
}

/** Convert normalized matrix cell to the flat row used by leverage resolution. */
export function leverageMatrixCellToRowConfig(
  cell: LeverageMatrixCellConfig,
): LeverageRowConfig {
  return {
    initialLtcBasePct: cell.initialLtc.basePct,
    initialLtcWithPermitsPct: cell.initialLtc.elevatedWithPermitsApprovedPct,
    maxRehabLtcPct: cell.maxRehabLtcPct,
    maxTotalLtcPct: cell.maxTotalLtcPct,
    maxArvLtvPct: cell.maxArvLtvPct,
  }
}

const NY_HEAVY_COUNTIES = [
  'Bronx',
  'Kings',
  'New York',
  'Queens',
  'Richmond',
] as const

const NY_MODERATE_COUNTIES = ['Nassau', 'Suffolk'] as const

/**
 * Single normalized object: tiering, rates, add-ons, leverage (with starred flags),
 * FICO, limits, fees, and adjustments.
 */
export const RATE_SHEET_CONFIG: RateSheetConfig = {
  meta: {
    productLabel: 'Wholesale (Tier 1) Fix & Flip',
    rateSheetVersion: '10.3.2025',
    sourceNote:
      'Transcribed from product brief; reconcile every cell with the official PDF before production.',
  },

  documentation: {
    globalAssumptions: [
      'Loan term displayed as 12 months per rate sheet summary.',
      'Project type is auto-classified from rehab ratio and GUC flags; the UI does not allow manual override.',
      'The logic map uses the 5-type taxonomy: Bridge No Rehab, Light Rehab, Standard Rehab, Super Rehab, and GUC.',
      'Small-deal low-rehab bonus logic uses the LTARV-constrained dollar cap from the logic map text (`base LTARV × ARV <= $350k`) because the original note is phrased ambiguously.',
      'Negative leverage adjustments are non-cumulative; the single most restrictive one applies before condo and GUC permit handling.',
    ],
  },

  tiers: {
    experienceToTier: {
      '0-2': 'Silver',
      '3-4': 'Gold',
      '5+': 'Platinum',
    } satisfies Record<GuarantorExperience, Tier>,
    displayOrder: ['Silver', 'Gold', 'Platinum'],
  },

  origination: {
    options: [
      { points: 1, label: '1.00', sortOrder: 1 },
      { points: 0.5, label: '0.50', sortOrder: 2 },
      { points: 0, label: '0.00', sortOrder: 3 },
    ],
  },

  rates: {
    baseRateRows: [
      {
        points: 1,
        byTier: { Platinum: 8.75, Gold: 9.49, Silver: 9.99 },
      },
      {
        points: 0.5,
        byTier: { Platinum: 9.99, Gold: 10.49, Silver: 10.99 },
      },
      {
        points: 0,
        byTier: { Platinum: 10.99, Gold: 11.49, Silver: 11.99 },
      },
    ],
    configurableAdditionalSpreadPp: 0,
    projectAddOns: [
      {
        id: 'ground_up',
        addRatePp: 0.75,
        when: { projectType: 'GUC' },
        allowedTiers: ['Gold', 'Platinum'],
      },
    ],
  },

  projectTypes: [
    {
      id: 'Bridge No Rehab',
      displayLabel: 'Bridge — No Rehab',
      sortOrder: 1,
    },
    { id: 'Light Rehab', displayLabel: 'Light Rehab', sortOrder: 2 },
    { id: 'Standard Rehab', displayLabel: 'Standard Rehab', sortOrder: 3 },
    {
      id: 'Super Rehab',
      displayLabel: 'Super Rehab',
      sortOrder: 4,
    },
    { id: 'GUC', displayLabel: 'GUC', sortOrder: 5 },
  ],

  groundUp: {
    allowedTiers: ['Gold', 'Platinum'],
    allowedTierSet: new Set<Tier>(['Gold', 'Platinum']),
  },

  leverage: {
    matrix: {
      Platinum: {
        'Bridge No Rehab': bridgeNoRehab(75, 'PLATINUM_BRIDGE_INITIAL_75'),
        'Light Rehab': rehabCell(85, 85, 100, 90, 75, 'PLATINUM_LIGHT'),
        'Standard Rehab': rehabCell(85, 85, 100, 90, 75, 'PLATINUM_STANDARD'),
        'Super Rehab': rehabCell(80, 80, 100, 85, 75, 'PLATINUM_SUPER'),
        GUC: rehabCell(50, 50, 100, 90, 70, 'PLATINUM_GUC'),
      },
      Gold: {
        'Bridge No Rehab': bridgeNoRehab(75, 'GOLD_BRIDGE_INITIAL_75'),
        'Light Rehab': rehabCell(85, 85, 100, 90, 75, 'GOLD_LIGHT'),
        'Standard Rehab': rehabCell(85, 85, 100, 90, 75, 'GOLD_STANDARD'),
        'Super Rehab': rehabCell(75, 75, 100, 85, 70, 'GOLD_SUPER'),
        GUC: rehabCell(50, 50, 100, 85, 70, 'GOLD_GUC'),
      },
      Silver: {
        'Bridge No Rehab': bridgeNoRehab(75, 'SILVER_BRIDGE_INITIAL_75'),
        'Light Rehab': rehabCell(85, 85, 100, 90, 75, 'SILVER_LIGHT'),
        'Standard Rehab': rehabCell(80, 80, 100, 85, 75, 'SILVER_STANDARD'),
        'Super Rehab': notOfferedCell('SILVER_SUPER_NOT_ON_SHEET'),
        GUC: notOfferedCell('SILVER_GUC_NOT_ON_SHEET'),
      },
    },
    purchaseBonusPp: 5,
    lowRehabRatioThreshold: 0.25,
    smallDealLowRehabRatioThreshold: 0.35,
    smallDealLtarvDollarThreshold: 350_000,
    gucPermitsInitialLtvBonusByTier: {
      Gold: 15,
      Platinum: 20,
    },
  },

  fico: {
    defaultMinimum: 680,
    minimumByProjectType: {
      GUC: 700,
    },
  },

  limits: {
    maxLoanAmountUsd: 2_000_000,
    termMonths: 12,
  },

  fees: {
    selectionRules: [
      {
        id: 'guc_2_4',
        amountUsd: 2695,
        match: { groundUpConstruction: true, twoToFourUnits: true },
      },
      {
        id: 'guc_sfr',
        amountUsd: 2195,
        match: { groundUpConstruction: true, twoToFourUnits: false },
      },
      {
        id: 'rehab_multi_2_4',
        amountUsd: 2495,
        match: { groundUpConstruction: false, twoToFourUnits: true },
      },
      {
        id: 'single_loan_rehab',
        amountUsd: 1995,
        match: { groundUpConstruction: false, twoToFourUnits: false },
      },
    ],
  },

  adjustments: {
    negativeLeverageRules: [
      {
        id: 'foreign_national',
        kind: 'foreignNational',
        reductionPp: 5,
        matchType: 'citizenshipForeignNational',
        summaryLabel: 'Foreign national (−5pp leverage)',
      },
      {
        id: 'fl_tx_nassau_suffolk',
        kind: 'floridaTexasOrNassauSuffolk',
        reductionPp: 5,
        matchType: 'stateFloridaTexasOrNassauSuffolk',
        summaryLabel: 'Florida / Texas / Nassau / Suffolk (−5pp leverage)',
      },
      {
        id: 'ny_heavy_counties',
        kind: 'newYorkHeavyCounties',
        reductionPp: 15,
        matchType: 'newYorkHeavyCounty',
        summaryLabel: 'New York heavy counties (−15pp leverage)',
      },
    ],
    newYorkHeavyCounties: [...NY_HEAVY_COUNTIES],
    newYorkModerateCounties: [...NY_MODERATE_COUNTIES],
    unavailableStates: ['ND', 'NV', 'SD'],
    entityOnlyStates: ['CO', 'FL', 'GA', 'NY', 'VA'],
    stateCodes: {
      florida: 'FL',
      texas: 'TX',
      newYork: 'NY',
    },
    nonWarrantableCondo: {
      reductionPp: 10,
      absoluteCapPct: 65,
    },
  },

  liquidity: {
    groundUpConstructionBudgetFraction: 0.2,
  },
}

// —— Typed accessors & legacy-shaped exports (computed from config only) ——————

const PROJECT_TYPE_IDS: readonly ProjectType[] = [
  'Bridge No Rehab',
  'Light Rehab',
  'Standard Rehab',
  'Super Rehab',
  'GUC',
]

function assertConfigIntegrity(cfg: RateSheetConfig): void {
  for (const tier of cfg.tiers.displayOrder) {
    for (const pt of PROJECT_TYPE_IDS) {
      if (!cfg.leverage.matrix[tier]?.[pt]) {
        throw new Error(`Missing leverage cell: ${tier} × ${pt}`)
      }
    }
  }
  const pts = new Set(cfg.rates.baseRateRows.map((r) => r.points))
  for (const o of cfg.origination.options) {
    if (!pts.has(o.points)) {
      throw new Error(`Origination option ${o.points} missing from baseRateRows`)
    }
  }
}

assertConfigIntegrity(RATE_SHEET_CONFIG)

export const GLOBAL_ASSUMPTIONS = RATE_SHEET_CONFIG.documentation.globalAssumptions

export const LOAN_TERM_MONTHS = RATE_SHEET_CONFIG.limits.termMonths

export const MAX_LOAN_AMOUNT_USD = RATE_SHEET_CONFIG.limits.maxLoanAmountUsd

export const MIN_FICO_DEFAULT = RATE_SHEET_CONFIG.fico.defaultMinimum

export const MIN_FICO_GROUND_UP =
  RATE_SHEET_CONFIG.fico.minimumByProjectType.GUC ?? MIN_FICO_DEFAULT

export const CONFIGURABLE_ADDITIONAL_RATE_PP =
  RATE_SHEET_CONFIG.rates.configurableAdditionalSpreadPp

export const NON_WARRANTABLE_CONDO_REDUCTION_PP =
  RATE_SHEET_CONFIG.adjustments.nonWarrantableCondo.reductionPp

export const NON_WARRANTABLE_CONDO_ABSOLUTE_CAP_PCT =
  RATE_SHEET_CONFIG.adjustments.nonWarrantableCondo.absoluteCapPct

export const GROUND_UP_LIQUIDITY_CONSTRUCTION_BUDGET_PCT =
  RATE_SHEET_CONFIG.liquidity.groundUpConstructionBudgetFraction

/** @deprecated Use RATE_SHEET_CONFIG.rates — retained for importers/tests. */
export const BASE_RATE_TABLE = Object.fromEntries(
  RATE_SHEET_CONFIG.rates.baseRateRows.map((r) => [r.points, r.byTier]),
) as Record<OriginationPointsChoice, Record<Tier, number>>

const ALL_TIERS: readonly Tier[] = ['Silver', 'Gold', 'Platinum']

/** @deprecated Use RATE_SHEET_CONFIG.leverage.matrix + leverageMatrixCellToRowConfig */
export const LEVERAGE_MATRIX: Record<Tier, Record<ProjectType, LeverageRowConfig>> =
  {
    Silver: {} as Record<ProjectType, LeverageRowConfig>,
    Gold: {} as Record<ProjectType, LeverageRowConfig>,
    Platinum: {} as Record<ProjectType, LeverageRowConfig>,
  }

for (const tier of ALL_TIERS) {
  for (const pt of PROJECT_TYPE_IDS) {
    LEVERAGE_MATRIX[tier][pt] = leverageMatrixCellToRowConfig(
      RATE_SHEET_CONFIG.leverage.matrix[tier][pt],
    )
  }
}

export const GROUND_UP_ALLOWED_TIERS = RATE_SHEET_CONFIG.groundUp.allowedTierSet

export const NEW_YORK_HEAVY_COUNTIES: ReadonlySet<string> = new Set(
  RATE_SHEET_CONFIG.adjustments.newYorkHeavyCounties.map((c) => c.toUpperCase()),
)

export const NEW_YORK_MODERATE_COUNTIES: ReadonlySet<string> = new Set(
  RATE_SHEET_CONFIG.adjustments.newYorkModerateCounties.map((c) => c.toUpperCase()),
)

export const FLORIDA_CODE = RATE_SHEET_CONFIG.adjustments.stateCodes.florida

export const TEXAS_CODE = RATE_SHEET_CONFIG.adjustments.stateCodes.texas

export const NEW_YORK_CODE = RATE_SHEET_CONFIG.adjustments.stateCodes.newYork

/** Labels for negative adjustment kinds (from config rules; excludes `none`). */
export const NEGATIVE_ADJUSTMENT_LABELS: Readonly<
  Partial<Record<NegativeAdjustmentKind, string>>
> = Object.fromEntries(
  RATE_SHEET_CONFIG.adjustments.negativeLeverageRules.map((r) => [
    r.kind,
    r.summaryLabel,
  ]),
) as Readonly<Partial<Record<NegativeAdjustmentKind, string>>>

/** Select options for project type (empty value = prompt). Pure presentation mapping. */
export function projectTypeSelectOptions(): readonly {
  value: string
  label: string
}[] {
  const fromConfig = [...RATE_SHEET_CONFIG.projectTypes]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => ({ value: p.id, label: p.displayLabel }))
  return [{ value: '', label: 'Select project type…' }, ...fromConfig]
}

/** Select options for origination points from config. */
export function originationSelectOptions(): readonly {
  value: string
  label: string
}[] {
  return [...RATE_SHEET_CONFIG.origination.options]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((o) => ({
      value: String(o.points),
      label: o.label,
    }))
}
