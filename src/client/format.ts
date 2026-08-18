/**
 * Shared client-side number formatting for the usage/cost surfaces.
 * @module @frostgao/dsh-usage-cost/client/format
 */

/** Cost in yuan, always two decimals (badges, chips, totals). */
export function formatCost(value: number): string {
  if (!Number.isFinite(value)) return '0.00'
  return value.toFixed(2)
}

/** Whole token counts with thousands separators. */
export function formatTokens(value: number): string {
  const rounded = Math.round(Number.isFinite(value) ? value : 0)
  return rounded.toLocaleString()
}

/** Compact tick label (1.2k / 3.4M / 1.0G). */
export function formatCompact(value: number): string {
  const v = Math.abs(value)
  if (v >= 1e9) return `${trim((value / 1e9).toFixed(1))}G`
  if (v >= 1e6) return `${trim((value / 1e6).toFixed(1))}M`
  if (v >= 1e3) return `${trim((value / 1e3).toFixed(1))}k`
  return String(Math.round(value))
}

/** Compact yuan label for the right axis. */
export function formatYuan(value: number): string {
  if (value >= 100) return `¥${Math.round(value)}`
  if (value >= 1) return `¥${value.toFixed(1)}`
  return `¥${value.toFixed(2)}`
}

/** Round a maximum up to a "nice" number for axis peaks. */
export function niceCeil(value: number): number {
  if (!(value > 0)) return 1
  const exp = Math.floor(Math.log10(value))
  const base = Math.pow(10, exp)
  const ratio = value / base
  const nice = ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 5 ? 5 : 10
  return nice * base
}

function trim(value: string): string {
  return value.replace(/\.0$/, '')
}
