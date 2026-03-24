import {
  formatCurrency,
  formatPercent,
} from '../../domain/loanSizer/formatters'
import type { LoanSizerOutputs } from '../../domain/loanSizer/types'
import { tableSectionClass } from './fieldClasses'
import { SectionCard } from './SectionCard'

export interface LoanSizerTablesProps {
  outputs: LoanSizerOutputs
}

const tc = tableSectionClass

export function LoanSizerTables({ outputs }: LoanSizerTablesProps) {
  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        id="loan-amount-summary"
        title="Loan amount summary"
        description="Maximum sizing vs your requested structure."
      >
        <div className={tc.wrap}>
          <table className={tc.table}>
            <caption className="sr-only">
              Comparison of maximum allowed and requested loan amounts
            </caption>
            <thead>
              <tr className={tc.theadRow}>
                <th scope="col" className={tc.th}>
                  Metric
                </th>
                <th scope="col" className={tc.th}>
                  Max
                </th>
                <th scope="col" className={tc.thLast}>
                  Requested
                </th>
              </tr>
            </thead>
            <tbody className="text-text-primary">
              <tr className={tc.tbodyRow}>
                <th scope="row" className={tc.rowHeader}>
                  Day 1 loan
                </th>
                <td className={tc.td}>{formatCurrency(outputs.maxDay1Loan)}</td>
                <td className={tc.tdLast}>
                  {formatCurrency(outputs.requestedDay1LoanAmount)}
                </td>
              </tr>
              <tr className={tc.tbodyRow}>
                <th scope="row" className={tc.rowHeader}>
                  Financed budget
                </th>
                <td className={tc.td}>
                  {formatCurrency(outputs.maxFinancedBudget)}
                </td>
                <td className={tc.tdLast}>
                  {formatCurrency(outputs.requestedFinancedBudget)}
                </td>
              </tr>
              <tr className={tc.tbodyRowLast}>
                <th scope="row" className={tc.rowHeader}>
                  Total loan
                </th>
                <td className={tc.td}>{formatCurrency(outputs.maxTotalLoan)}</td>
                <td className={tc.tdLast}>
                  {formatCurrency(outputs.requestedTotalLoan)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        id="leverage-summary"
        title="Leverage comparison"
        description="Requested ratios vs maximum scenario ratios."
      >
        <div className={tc.wrap}>
          <table className={tc.table}>
            <caption className="sr-only">
              Comparison of maximum and requested leverage ratios
            </caption>
            <thead>
              <tr className={tc.theadRow}>
                <th scope="col" className={tc.th}>
                  Ratio
                </th>
                <th scope="col" className={tc.th}>
                  Max
                </th>
                <th scope="col" className={tc.thLast}>
                  Requested
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className={tc.tbodyRow}>
                <th scope="row" className={tc.rowHeader}>
                  Day 1 / AIV
                </th>
                <td className={tc.td}>{formatPercent(outputs.maxLtv, 1)}</td>
                <td className={tc.tdLast}>
                  {formatPercent(outputs.requestedLtv, 1)}
                </td>
              </tr>
              <tr className={tc.tbodyRow}>
                <th scope="row" className={tc.rowHeader}>
                  Total / (AIV + budget)
                </th>
                <td className={tc.td}>{formatPercent(outputs.maxLtc, 1)}</td>
                <td className={tc.tdLast}>
                  {formatPercent(outputs.requestedLtc, 1)}
                </td>
              </tr>
              <tr className={tc.tbodyRowLast}>
                <th scope="row" className={tc.rowHeader}>
                  Total / ARV
                </th>
                <td className={tc.td}>{formatPercent(outputs.maxLtarv, 1)}</td>
                <td className={tc.tdLast}>
                  {formatPercent(outputs.requestedLtarv, 1)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  )
}
