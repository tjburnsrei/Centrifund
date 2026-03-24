import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { LoanSizer } from '../components/loan-sizer/LoanSizer'

describe('LoanSizer', () => {
  it('renders core form controls', () => {
    render(<LoanSizer />)
    expect(
      screen.getByRole('heading', { name: /fix & flip loan sizer/i }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/purchase price/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/qualifying fico/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/project \/ rehab type/i)).toBeInTheDocument()
  })

  it('updates summary when purchase price changes', async () => {
    const user = userEvent.setup()
    render(<LoanSizer />)
    const price = screen.getByLabelText(/purchase price/i)
    await user.clear(price)
    await user.type(price, '300000')
    expect(screen.getByRole('region', { name: /^deal inputs$/i })).toBeInTheDocument()
    const body = document.body.textContent ?? ''
    expect(body).not.toMatch(/\bNaN\b/)
    expect(body).not.toMatch(/\bInfinity\b/)
  })

  it('shows ineligible messaging for Silver + Ground Up', async () => {
    const user = userEvent.setup()
    render(<LoanSizer />)
    await user.selectOptions(
      screen.getByLabelText(/guarantor experience/i),
      '1-2',
    )
    await user.selectOptions(
      screen.getByLabelText(/project \/ rehab type/i),
      'Ground Up Construction',
    )
    expect(screen.getAllByText(/not eligible/i).length).toBeGreaterThan(0)
    expect(
      screen.getByText(/ground up construction is not available for the silver/i),
    ).toBeInTheDocument()
  })

  it('uses semantic tables for summaries', () => {
    render(<LoanSizer />)
    const tables = screen.getAllByRole('table')
    expect(tables.length).toBeGreaterThanOrEqual(2)
    for (const table of tables) {
      expect(
        within(table).getByRole('columnheader', { name: /max/i }),
      ).toBeInTheDocument()
    }
  })
})
