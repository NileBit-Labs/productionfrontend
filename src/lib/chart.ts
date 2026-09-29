/** "1.2M", "45K", "980" — short money for chart axes and tight spaces. */
export function compactUgx(amount: number): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}${trim(abs / 1_000_000)}M`
  if (abs >= 1_000) return `${sign}${trim(abs / 1_000)}K`
  return `${sign}${abs}`
}

function trim(n: number): string {
  return n >= 100 ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, '')
}

/** A "nice" ceiling for an axis: 1, 2, 2.5, 5 or 10 times a power of ten. */
export function niceCeiling(value: number): number {
  if (value <= 0) return 1
  const power = Math.pow(10, Math.floor(Math.log10(value)))
  const fraction = value / power
  const step = [1, 2, 2.5, 5, 10].find((s) => fraction <= s) ?? 10
  return step * power
}

/**
 * Axis limits on round steps (…, 2K, 2.5K, 5K, 10K …) that include zero and
 * every value, so gridlines always fall on numbers people can read.
 */
export function niceScale(
  min: number,
  max: number,
  ticks = 4,
): { bottom: number; top: number; step: number } {
  const high = Math.max(0, max)
  const low = Math.min(0, min)
  if (high === 0 && low === 0) return { bottom: 0, top: 4, step: 1 }
  const step = niceCeiling((high - low) / ticks)
  return { bottom: Math.floor(low / step) * step, top: Math.ceil(high / step) * step, step }
}

/** Percentage change, or null when there is nothing to compare against. */
export function percentChange(now: number, before: number): number | null {
  if (before <= 0) return null
  return Math.round(((now - before) / before) * 100)
}

export const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  MOBILE_MONEY: 'Mobile money',
  CARD: 'Card',
  BANK: 'Bank',
  OTHER: 'Other',
}

// Ordered so neighbouring slices stay distinguishable in both themes.
export const METHOD_COLORS: Record<string, string> = {
  CASH: 'var(--chart-1)',
  MOBILE_MONEY: 'var(--chart-2)',
  CARD: 'var(--chart-3)',
  BANK: 'var(--chart-4)',
  OTHER: 'var(--chart-5)',
}
