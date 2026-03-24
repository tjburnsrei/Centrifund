const EM_DASH = '\u2014'

function sanitizeNumber(n: number): number | null {
  if (!Number.isFinite(n)) return null
  return n
}

export function formatCurrency(value: number | null): string {
  if (value === null) return EM_DASH
  const n = sanitizeNumber(value)
  if (n === null) return EM_DASH
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.round(n))
}

export function formatPercent(value: number | null, decimals = 1): string {
  if (value === null) return EM_DASH
  const n = sanitizeNumber(value)
  if (n === null) return EM_DASH
  return `${(n * 100).toFixed(decimals)}%`
}

/** Display interest rate as percent with 2 decimals (e.g. 9.49%). */
export function formatRate(value: number | null): string {
  if (value === null) return EM_DASH
  const n = sanitizeNumber(value)
  if (n === null) return EM_DASH
  return `${n.toFixed(2)}%`
}
