# Centrifund — Fix & Flip loan sizer

Production-style **React + TypeScript + Tailwind** loan sizing calculator. Business rules live in pure domain modules; the UI is a thin layer over `calculateLoanSizerOutputs()`.

## Install & run

```bash
npm install
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`).

## Test

```bash
npm test
npm run test:watch
```

- Domain: `src/test/loanSizer.rules.test.ts`, `src/test/loanSizer.calculations.test.ts`
- Config: `src/test/rateSheet.config.test.ts`
- UI smoke: `src/test/LoanSizer.test.tsx`

## Build

```bash
npm run build
npm run preview
```

## Deal logging

Deal / feedback logging is POST-only and private to the database. Public users
can submit scenarios, but there is no public log viewer in the app.

To enable it in production:

1. Add a Neon Postgres database through the Vercel Marketplace.
2. Add the provided `DATABASE_URL` environment variable to the Vercel project.
3. Deploy the app. The API creates `deal_logs` automatically if it is missing.

The reference schema lives in `database/deal_logs.sql`.

## File structure

```text
src/
  components/loan-sizer/     # Presentation only (form, summary, tables, fields)
  domain/loanSizer/          # Types, constants, rules, calculations, validators, formatters
  hooks/useLoanSizer.ts      # React Hook Form + live domain outputs
  lib/cn.ts                  # Class merging (tailwind-merge + clsx)
  test/                      # Vitest + Testing Library
```

## Where business rules live

| Concern | Location |
|--------|-----------|
| **Normalized rate sheet** (`RATE_SHEET_CONFIG`: tiers, origination, base rates, add-ons, project types, leverage matrix w/ starred flags, FICO, limits, fees, adjustments) | `src/domain/loanSizer/constants.ts` |
| Tier, adjustments, rate add-ons, leverage resolution (reads config) | `src/domain/loanSizer/rules.ts` |
| Loan math orchestration | `src/domain/loanSizer/calculations.ts` |
| Zod form schema (allowlists, bounds) | `src/domain/loanSizer/validators.ts` |
| Display formatting (currency, %, rate) | `src/domain/loanSizer/formatters.ts` |
| Config integrity & rule smoke tests | `src/test/rateSheet.config.test.ts` |

## Branding & theme

- **Colors / surfaces**: `src/index.css` (`@theme` tokens: `brand`, `surface`, `border`, `success`, `warning`, `danger`, `text-primary`, `text-secondary`).
- **Layout & copy**: `src/components/loan-sizer/LoanSizer.tsx` (header, grid).

## Known assumptions (see also `GLOBAL_ASSUMPTIONS` in `constants.ts`)

1. **PDF not loaded in-repo**: The Wholesale Fix & Flip rate sheet **v10.3.2025** could not be fetched here. Explicit brief values (base rates by tier/origination, add-ons, min FICO, max loan, fees, Bridge initial 75% LTC, Silver excluded from Ground Up) are implemented; **other leverage cells are placeholders** and are flagged in `constants.ts` for reconciliation with the PDF.
2. **New York counties**: The −15pp list is a configurable allowlist in `NEW_YORK_ADJUSTMENT_COUNTIES`.
3. **Non-warrantable condo**: Implemented as subtract **10pp** then cap at **65%** per cap (documented in `constants.ts`); confirm against the sheet’s exact wording.
4. **Negative adjustments**: Only the **single most restrictive** geographic/product adjustment applies; condo logic runs **after** that. Cash-out/foreign/FL/TX are **not cumulative** with each other.
5. **Profitability (v1)**: If eligible and ARV &gt; requested total loan → **Pass**; else **Review**; if not eligible → **Ineligible**.
6. **Ground Up liquidity**: When project type is Ground Up, `liquidityRequired = estimatedCashToCoverClosing + 20% × construction budget` (see `GROUND_UP_LIQUIDITY_CONSTRUCTION_BUDGET_PCT`).
7. **`useChange`**: Checkbox only; **no pricing effect** in v1 (operational flag).

## Public calculator vs this app

- **UI**: Inspired by common RTL / fix-and-flip calculator patterns (two-column form + summary, tables); **no** logos or third-party assets; **Centrifund** naming only. Layout uses a slightly wider input column and a sticky results column on large screens to mirror dashboard-style tools.
- **Taxonomy**: This app uses rate-sheet rehab types (**Bridge / Light / Heavy / Ground Up**), not “Standard / Super Rehab” labels from some public tools. Any future UI alias layer should map explicitly in `constants.ts` / README.
- **Rates & caps**: If a public webpage disagrees with the Wholesale PDF, **`RATE_SHEET_CONFIG` and PDF win**; reconcile the config after each sheet revision.

## Audit checklist (maintainers)

| Area | Status |
|------|--------|
| PDF alignment | Config documents version `10.3.2025`; leverage beyond brief excerpts must be re-keyed from PDF. |
| TS strictness | Domain uses explicit types; no `any`; `switch` on adjustment matchType is exhaustively checked via `unreachableNegativeMatch`. |
| A11y | Labels on controls; `aside` + `aria-live="polite"` on results; tables use `scope`; checkboxes link `aria-describedby` to help text; section cards use `aria-labelledby` only (no duplicate `aria-label`). |
| Math | `calculateMaxDay1Loan` / `calculateMaxTotalLoan` / requested metrics guard non-finite and invalid denominators. |
| Duplication | NY county set is single-sourced (`NEW_YORK_ADJUSTMENT_COUNTIES`); shared `textLikeInputClassName` / `tableSectionClass`. |
| Tests | Domain + config integrity + RTL smoke; extend `loanSizer.calculations.test.ts` when adding new caps. |

## Future improvements

- **Backend-driven rules**: Serve `RATE_SHEET_CONFIG` (or JSON with the same shape), rates, and geo lists from an API; version per rate sheet date.
- **Persistence**: Save scenarios (localStorage or CRM) and deep-link presets.
- **CRM / LOS integration**: POST structured `LoanSizerInputs` + outputs to underwriting queues.
- **PDF reconciliation job**: Diff `constants.ts` against each published rate sheet and fail CI if checksums drift.
- **County UX**: Autocomplete + validation against a definitive county database for NY (and other states if the sheet expands).

## Implementation checklist

- [x] Domain-first: types, constants, rules, calculations, validators, formatters, barrel `index.ts`
- [x] Vitest coverage for rules, calculations, and key UI behaviors
- [x] React 18+, RHF + Zod resolver, live `useWatch` outputs
- [x] Responsive two-column layout; semantic tables; focus rings; labels / regions
- [x] No `NaN` / `Infinity` in formatters; em dash for unavailable values
- [x] Warnings for ineligible / over-limit scenarios; global assumptions listed
- [x] Configurable knobs documented in `constants.ts` (`CONFIGURABLE_ADDITIONAL_RATE_PP`, fee assumptions, NY list, leverage matrix)

---

_Estimates are indicative only and not a credit decision._
