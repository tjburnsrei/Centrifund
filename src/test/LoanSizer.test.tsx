import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { LoanSizer } from '../components/loan-sizer/LoanSizer'

describe('LoanSizer', () => {
  it('renders the single-column section stack', () => {
    render(<LoanSizer />)
    expect(
      screen.getByRole('heading', { name: /fix and flip loan sizer/i }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/^purchase price$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/rehab budget/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/estimated arv/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/qualifying fico/i)).toBeInTheDocument()
    const requestedLeverage = screen.getByRole('region', {
      name: /^requested leverage$/i,
    })
    expect(
      within(requestedLeverage).getByText(/^requested total ltc$/i),
    ).toBeInTheDocument()
    expect(
      within(requestedLeverage).getByText(/^requested total ltarv$/i),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText(/requested total ltc/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/requested total ltarv/i)).not.toBeInTheDocument()
    expect(
      screen.getByLabelText(/requested purchase price financed/i),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText(/requested construction financed/i),
    ).toBeInTheDocument()
    const requestedLeverageText = requestedLeverage.textContent ?? ''
    const purchaseIndex = requestedLeverageText.indexOf(
      'Requested Purchase Price Financed (%)',
    )
    const constructionIndex = requestedLeverageText.indexOf(
      'Requested Construction Financed (%)',
    )
    const totalLtcIndex = requestedLeverageText.indexOf('Requested Total LTC')
    const totalLtarvIndex = requestedLeverageText.indexOf('Requested Total LTARV')
    expect(purchaseIndex).toBeGreaterThanOrEqual(0)
    expect(constructionIndex).toBeGreaterThan(purchaseIndex)
    expect(totalLtcIndex).toBeGreaterThan(constructionIndex)
    expect(totalLtarvIndex).toBeGreaterThan(totalLtcIndex)
    expect(screen.queryByLabelText(/day 1 loan amount/i)).not.toBeInTheDocument()
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
    expect(screen.getByRole('region', { name: /^messages$/i })).toBeInTheDocument()
    expect(
      screen.getByText(/qualifying fico is below the 680 minimum/i),
    ).toBeInTheDocument()
  })

  it('exposes Advanced scenarios without helper copy or a disclosure click', () => {
    render(<LoanSizer />)
    expect(
      screen.getByRole('region', { name: /^advanced scenarios$/i }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/roof line removal/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/^roof removal$/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/load-bearing wall removal/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/permits approved or imminent/i)).toBeDisabled()
    expect(screen.getByLabelText(/non-warrantable condo/i)).toBeInTheDocument()
    expect(
      screen.queryByText(/only needed for structural\/guc deals/i),
    ).not.toBeInTheDocument()
  })

  it('exposes an Allowable leverage card with the revised metrics', () => {
    render(<LoanSizer />)
    const allowable = screen.getByRole('region', {
      name: /^allowable leverage$/i,
    })
    expect(within(allowable).getByText(/^total ltc$/i)).toBeInTheDocument()
    expect(within(allowable).getByText(/^total ltarv$/i)).toBeInTheDocument()
    expect(
      within(allowable).getByText(/% of purchase price financed/i),
    ).toBeInTheDocument()
    expect(
      within(allowable).getByText(/% of construction financed/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/tier and product caps after all adjustments/i),
    ).not.toBeInTheDocument()
    expect(allowable).toHaveTextContent(/Total LTC\s*90%/)
    expect(allowable).toHaveTextContent(/Total LTARV\s*75%/)
    expect(allowable).toHaveTextContent(/% of Purchase Price Financed\s*85%/)
    expect(allowable).not.toHaveTextContent(/95%/)
  })

  it('derives financial outputs from requested purchase and construction percentages', async () => {
    const user = userEvent.setup()
    render(<LoanSizer />)
    const purchasePct = screen.getByLabelText(
      /requested purchase price financed/i,
    )
    const constructionPct = screen.getByLabelText(
      /requested construction financed/i,
    )

    await user.clear(purchasePct)
    await user.type(purchasePct, '80')
    await user.clear(constructionPct)
    await user.type(constructionPct, '50')

    const financialOutputs = screen.getByRole('region', {
      name: /^financial outputs$/i,
    })
    expect(
      within(financialOutputs).getByText(/purchase money loan/i),
    ).toBeInTheDocument()
    expect(within(financialOutputs).getByText('$400,000')).toBeInTheDocument()
    expect(within(financialOutputs).getByText(/rehab loan/i)).toBeInTheDocument()
    expect(within(financialOutputs).getByText('$50,000')).toBeInTheDocument()

    const requestedLeverage = screen.getByRole('region', {
      name: /^requested leverage$/i,
    })
    expect(requestedLeverage).toHaveTextContent(/Requested Total LTC\s*75%/)
    expect(requestedLeverage).toHaveTextContent(/Requested Total LTARV\s*56\.3%/)
  })

  it('applies the computed maximums to requested leverage fields', async () => {
    const user = userEvent.setup()
    render(<LoanSizer />)
    const purchasePct = screen.getByLabelText(
      /requested purchase price financed/i,
    ) as HTMLInputElement
    const constructionPct = screen.getByLabelText(
      /requested construction financed/i,
    ) as HTMLInputElement

    for (const field of [purchasePct, constructionPct]) {
      await user.clear(field)
      await user.type(field, '0')
    }

    await user.click(screen.getByRole('button', { name: /apply max/i }))

    const requestedLeverage = screen.getByRole('region', {
      name: /^requested leverage$/i,
    })
    expect(requestedLeverage).toHaveTextContent(/Requested Total LTC\s*91\.7%/)
    expect(requestedLeverage).toHaveTextContent(/Requested Total LTARV\s*68\.8%/)
    expect(purchasePct.value).toBe('90')
    expect(constructionPct.value).toBe('100')

    const financialOutputs = screen.getByRole('region', {
      name: /^financial outputs$/i,
    })
    expect(within(financialOutputs).getByText('$450,000')).toBeInTheDocument()
    expect(within(financialOutputs).getByText('$100,000')).toBeInTheDocument()
  })

  it('adds broker rate spread to the final rate and payment', async () => {
    const user = userEvent.setup()
    render(<LoanSizer />)
    const brokerAddOn = screen.getByLabelText(/broker ysp/i)
    expect(screen.queryByLabelText(/broker rate add-on/i)).not.toBeInTheDocument()

    await user.clear(brokerAddOn)
    await user.type(brokerAddOn, '1.25')

    const financialOutputs = screen.getByRole('region', {
      name: /^financial outputs$/i,
    })
    expect(within(financialOutputs).getByText('10.00%')).toBeInTheDocument()

    const borrowerOutputs = screen.getByRole('region', {
      name: /^borrower outputs$/i,
    })
    expect(within(borrowerOutputs).getByText('$3,750')).toBeInTheDocument()
  })

  it('renders closing cost inputs and secondary borrower outputs without helper copy', () => {
    render(<LoanSizer />)
    expect(screen.getByLabelText(/broker points/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/broker ysp/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/broker rate add-on/i)).not.toBeInTheDocument()
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
    expect(
      screen.queryByText(/estimated monthly obligation and cash needed/i),
    ).not.toBeInTheDocument()
  })

  it('submits private deal logs without rendering a public log list', async () => {
    const user = userEvent.setup()
    const originalFetch = globalThis.fetch
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, log: { id: 'log_123' } }),
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    render(<LoanSizer />)
    expect(screen.queryByLabelText(/log type/i)).not.toBeInTheDocument()
    await user.type(screen.getByLabelText(/street address/i), '123 Test St')
    await user.type(
      screen.getByLabelText(/notes/i),
      'Construction funding should be reviewed.',
    )
    await user.click(
      screen.getByRole('button', { name: /log deal \/ send feedback/i }),
    )

    expect(
      await screen.findByText(/deal log saved for internal review/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/recent submissions/i)).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/deal-logs',
      expect.objectContaining({ method: 'POST' }),
    )
    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse(String((init as RequestInit).body))
    expect(body.logType).toBeUndefined()
    expect(body.streetAddress).toBe('123 Test St')
    expect(body.notes).toBe('Construction funding should be reviewed.')
    expect(body.inputs.purchasePriceOrAsIsValue).toBe(500_000)
    expect(body.outputs.purchaseMoneyLoan).toBe(450_000)

    globalThis.fetch = originalFetch
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
    await user.click(screen.getByLabelText(/roof line removal/i))
    const messages = screen.getByRole('region', { name: /^messages$/i })
    expect(
      within(messages).getByText(/guc is not available for the silver/i),
    ).toBeInTheDocument()
  })
})
