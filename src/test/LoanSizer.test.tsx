import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { LoanSizer } from '../components/loan-sizer/LoanSizer'

describe('LoanSizer', () => {
  it('renders the single-column section stack', () => {
    render(<LoanSizer />)
    expect(
      screen.getByRole('heading', { name: /fix and flip loan sizer/i }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/purchase price/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/rehab budget/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/estimated arv/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/qualifying fico/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/day 1 loan amount/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/transaction type/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/origination points/i)).not.toBeInTheDocument()
  })

  it('enables the NY county dropdown only when state is NY', async () => {
    const user = userEvent.setup()
    render(<LoanSizer />)
    const countySelect = screen.getByLabelText(
      /property county/i,
    ) as HTMLSelectElement
    expect(countySelect.disabled).toBe(false)
    expect(
      within(countySelect).getByRole('option', { name: /kings/i }),
    ).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/property state/i), 'CA')
    expect(
      (screen.getByLabelText(/property county/i) as HTMLSelectElement).disabled,
    ).toBe(true)
  })

  it('blocks Below 680 FICO', async () => {
    const user = userEvent.setup()
    render(<LoanSizer />)
    await user.selectOptions(
      screen.getByLabelText(/qualifying fico/i),
      'below680',
    )
    expect(screen.getAllByText(/not eligible/i).length).toBeGreaterThan(0)
    expect(
      screen.getByText(/qualifying fico is below the 680 minimum/i),
    ).toBeInTheDocument()
  })

  it('clamps the requested loan slider to the max Day 1 loan', () => {
    render(<LoanSizer />)
    const slider = screen.getByLabelText(
      /day 1 loan amount/i,
    ) as HTMLInputElement
    const max = Number.parseFloat(slider.max)
    expect(Number.isFinite(max)).toBe(true)
    expect(Number.parseFloat(slider.value)).toBeLessThanOrEqual(max)
  })

  it('exposes an Allowable leverage card', () => {
    render(<LoanSizer />)
    expect(
      screen.getByRole('region', { name: /^allowable leverage$/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(/max initial ltc/i)).toBeInTheDocument()
    expect(screen.getByText(/max total ltc/i)).toBeInTheDocument()
    expect(screen.getByText(/max ltv \(arv\)/i)).toBeInTheDocument()
  })

  it('renders closing cost inputs and borrower outputs', () => {
    render(<LoanSizer />)
    expect(screen.getByLabelText(/broker points/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/underwriting fee/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/attorney fee/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/appraisal fee/i)).toBeInTheDocument()
    const borrowerOutputs = screen.getByRole('region', {
      name: /^borrower outputs$/i,
    })
    expect(
      within(borrowerOutputs).getByText(/estimated monthly payment/i),
    ).toBeInTheDocument()
    expect(
      within(borrowerOutputs).getByText(/down payment needed/i),
    ).toBeInTheDocument()
    expect(
      within(borrowerOutputs).getByText(/cash to cover closing/i),
    ).toBeInTheDocument()
  })

  it('has a disabled Generate term sheet button', () => {
    render(<LoanSizer />)
    const btn = screen.getByRole('button', { name: /generate term sheet/i })
    expect(btn).toBeDisabled()
  })

  it('renders assumptions section and hides messages when no alerts', () => {
    render(<LoanSizer />)
    expect(screen.queryByRole('region', { name: /^messages$/i })).toBeNull()
    expect(
      screen.getByRole('heading', { name: /^assumptions$/i }),
    ).toBeInTheDocument()
  })

  it('shows ineligible messaging for Silver + GUC', async () => {
    const user = userEvent.setup()
    render(<LoanSizer />)
    await user.selectOptions(
      screen.getByLabelText(/guarantor experience/i),
      '0-2',
    )
    await user.click(screen.getByText(/advanced scenarios/i, { selector: 'p' }))
    await user.click(screen.getByLabelText(/roof removal/i))
    expect(screen.getAllByText(/not eligible/i).length).toBeGreaterThan(0)
    const messages = screen.getByRole('region', { name: /^messages$/i })
    expect(
      within(messages).getByText(/guc is not available for the silver/i),
    ).toBeInTheDocument()
  })
})
