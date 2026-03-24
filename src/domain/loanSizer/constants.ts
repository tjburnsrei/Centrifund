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
      elevatedWithPermitsApprovedPct: starredInitial,
      sheetShowsStarredInitialLtc: true,
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

const NY_COUNTIES = [
  'Albany',
  'Bronx',
  'Dutchess',
  'Kings',
  'Nassau',
  'New York',
  'Orange',
  'Putnam',
  'Queens',
  'Richmond',
  'Rockland',
  'Suffolk',
  'Ulster',
  'Westchester',
] as const

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
      'Product / rehab labels follow the PDF (Bridge — No Rehab, Light Rehab, Heavy Rehab, Ground Up). Public RTL-style calculators may use different names (e.g. Standard/Super Rehab); this tool does not—map any external labels explicitly if needed.',
      'Leverage matrix cells must be verified against the official rate sheet PDF.',
      'New York county list for the −15pp adjustment is an allowlist assumption; confirm against underwriting guidelines.',
      'Profitability uses ARV vs requested total loan (configurable rule); not a credit decision.',
      'Lender fee selection follows ordered rules in config (first match wins).',
      'Negative leverage adjustments in config are non-cumulative; engine selects the single largest reduction.',
      'Non-warrantable condo applies after geographic/product adjustment (separate post-process).',
      'Negative sheet notes referencing “initial LTC” are applied uniformly to all leverage caps unless underwriting narrows scope.',
    ],
  },

  tiers: {
    experienceToTier: {
      '1-2': 'Silver',
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
    transactionAddOns: [
      {
        id: 'rate_term_refi',
        addRatePp: 0.5,
        when: { transactionType: 'rateTermRefi' },
      },
      {
        id: 'cash_out_refi',
        addRatePp: 1.0,
        when: { transactionType: 'cashOutRefi' },
      },
    ],
    projectAddOns: [
      {
        id: 'ground_up',
        addRatePp: 0.75,
        when: { projectType: 'Ground Up Construction' },
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
    { id: 'Heavy Rehab', displayLabel: 'Heavy Rehab', sortOrder: 3 },
    {
      id: 'Ground Up Construction',
      displayLabel: 'Ground Up Construction',
      sortOrder: 4,
    },
  ],

  groundUp: {
    allowedTiers: ['Gold', 'Platinum'],
    allowedTierSet: new Set<Tier>(['Gold', 'Platinum']),
  },

  leverage: {
    matrix: {
      Platinum: {
        'Bridge No Rehab': bridgeNoRehab(75, 'PLATINUM_BRIDGE_INITIAL_75'),
        'Light Rehab': rehabCell(85, 90, 100, 90, 75, 'PLATINUM_LIGHT_STARRED_INITIAL'),
        'Heavy Rehab': rehabCell(80, 85, 100, 85, 72.5, 'PLATINUM_HEAVY_STARRED_INITIAL'),
        'Ground Up Construction': rehabCell(
          80,
          85,
          100,
          90,
          75,
          'PLATINUM_GUC_STARRED_INITIAL',
        ),
      },
      Gold: {
        'Bridge No Rehab': bridgeNoRehab(75, 'GOLD_BRIDGE_INITIAL_75'),
        'Light Rehab': rehabCell(80, 85, 100, 85, 72.5, 'GOLD_LIGHT_STARRED_INITIAL'),
        'Heavy Rehab': rehabCell(75, 80, 100, 80, 70, 'GOLD_HEAVY_STARRED_INITIAL'),
        'Ground Up Construction': rehabCell(
          75,
          80,
          100,
          85,
          72.5,
          'GOLD_GUC_STARRED_INITIAL',
        ),
      },
      Silver: {
        'Bridge No Rehab': bridgeNoRehab(75, 'SILVER_BRIDGE_INITIAL_75'),
        'Light Rehab': rehabCell(75, 80, 100, 80, 70, 'SILVER_LIGHT_STARRED_INITIAL'),
        'Heavy Rehab': rehabCell(70, 75, 100, 75, 67.5, 'SILVER_HEAVY_STARRED_INITIAL'),
        'Ground Up Construction': notOfferedCell('SILVER_GUC_NOT_ON_SHEET'),
      },
    },
  },

  fico: {
    defaultMinimum: 680,
    minimumByProjectType: {
      'Ground Up Construction': 700,
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
        id: 'cash_out_refi',
        kind: 'cashOutRefi',
        reductionPp: 5,
        matchType: 'transactionCashOut',
        summaryLabel: 'Cash-out refinance (−5pp leverage)',
      },
      {
        id: 'foreign_national',
        kind: 'foreignNational',
        reductionPp: 5,
        matchType: 'citizenshipForeignNational',
        summaryLabel: 'Foreign national (−5pp leverage)',
      },
      {
        id: 'fl_tx',
        kind: 'floridaOrTexas',
        reductionPp: 5,
        matchType: 'stateFloridaOrTexas',
        summaryLabel: 'Florida / Texas (−5pp leverage)',
      },
      {
        id: 'ny_select_counties',
        kind: 'newYorkSelectCounties',
        reductionPp: 15,
        matchType: 'newYorkAllowlistCounty',
        summaryLabel: 'New York (select counties) (−15pp leverage)',
      },
    ],
    newYorkSelectCounties: [...NY_COUNTIES],
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
  'Heavy Rehab',
  'Ground Up Construction',
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
  RATE_SHEET_CONFIG.fico.minimumByProjectType['Ground Up Construction'] ?? MIN_FICO_DEFAULT

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

export const NEW_YORK_ADJUSTMENT_COUNTIES: ReadonlySet<string> = new Set(
  RATE_SHEET_CONFIG.adjustments.newYorkSelectCounties.map((c) => c.toUpperCase()),
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
