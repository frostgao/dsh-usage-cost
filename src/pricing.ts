/**
 * Pricing table and cost math shared by the Host (aggregation) and the Client
 * (per-message chip). Pure, environment-agnostic, JSON-free runtime helpers.
 *
 * Prices are RMB yuan per million tokens, per model × peak/off-peak.
 *
 * Peak = Beijing time (UTC+8) 09:00–12:00 and 14:00–18:00; everything else is
 * off-peak (half price). `isPeak` shifts the epoch by +8h and reads the UTC
 * hour, so the result is the Beijing wall-clock hour.
 *
 * @module @frostgao/dsh-usage-cost/pricing
 */

export interface PriceBucket {
  offpeak: number
  peak: number
}

export interface ModelPricing {
  cacheHit: PriceBucket
  input: PriceBucket
  output: PriceBucket
}

/** Price table (元 / 百万 tokens). Off-peak = half of peak. */
export const PRICING: Record<string, ModelPricing> = {
  'deepseek-v4-flash': {
    cacheHit: { offpeak: 0.05, peak: 0.10 },
    input: { offpeak: 1.50, peak: 3.00 },
    output: { offpeak: 4.50, peak: 9.00 },
  },
  'deepseek-v4-pro': {
    cacheHit: { offpeak: 0.15, peak: 0.30 },
    input: { offpeak: 4.50, peak: 9.00 },
    output: { offpeak: 13.50, peak: 27.00 },
  },
}

/** Fallback pricing for unknown model ids. */
export const DEFAULT_MODEL = 'deepseek-v4-pro'

const BEIJING_OFFSET_MS = 8 * 3600 * 1000

/** Whether `ms` falls in a Beijing peak window. */
export function isPeak(ms: number): boolean {
  const hour = new Date(ms + BEIJING_OFFSET_MS).getUTCHours()
  return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18)
}

/** Resolve a model id to a pricing row, defaulting to `deepseek-v4-pro`. */
export function pricingFor(model: string | null | undefined): ModelPricing {
  if (model != null && model !== '') {
    if (model.includes('flash')) return PRICING['deepseek-v4-flash']
    if (model.includes('pro')) return PRICING['deepseek-v4-pro']
    const exact = PRICING[model]
    if (exact !== undefined) return exact
  }
  return PRICING[DEFAULT_MODEL]
}

/** Disjoint token counters (billed input = uncached input + cache read). */
export interface UsageCounters {
  input: number
  cacheHit: number
  output: number
}

/** Cost in yuan for one model call's token counters at a timestamp. */
export function costFor(model: string | null | undefined, counters: UsageCounters, timeMs: number): number {
  const pricing = pricingFor(model)
  const peak = isPeak(timeMs)
  const inputPrice = peak ? pricing.input.peak : pricing.input.offpeak
  const cachePrice = peak ? pricing.cacheHit.peak : pricing.cacheHit.offpeak
  const outputPrice = peak ? pricing.output.peak : pricing.output.offpeak
  return (counters.input * inputPrice + counters.cacheHit * cachePrice + counters.output * outputPrice) / 1e6
}
