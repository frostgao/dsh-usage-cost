/**
 * Shared wire types for the usage/cost Remote service.
 *
 * These shapes cross the Typert strict-codec boundary, so they must remain
 * plain JSON (numbers, strings, booleans, arrays, objects) — no branded types,
 * no Dates, no class instances.
 *
 * @module @frostgao/dsh-usage-cost/types
 */

/** Preset time-range selector (Beijing-local). */
export type UsageRange = '1d' | '24h' | '1w' | '1m' | 'custom'

/** Request for the aggregate `usage` Remote method. */
export interface UsageRequest {
  /** Preset range; `custom` reads `from`/`to`. */
  range: UsageRange
  /** Optional model filter (short name, e.g. `deepseek-v4-pro`). */
  model?: string
  /** Force a synchronous recompute (bypass cache + revalidate). */
  refresh?: boolean
  /** Marks a `custom` query so the Host never caches it. */
  custom?: boolean
  /** Custom range lower bound, epoch ms. */
  from?: number
  /** Custom range upper bound, epoch ms. */
  to?: number
}

/** Request for the per-session `usageSession` Remote method. */
export interface UsageSessionRequest {
  /** Logical session id. */
  sessionId: string
}

/** Token buckets plus cost for one aggregate. */
export interface Totals {
  /** Uncached input tokens. */
  input: number
  /** Cache-read (cache hit) tokens. */
  cacheHit: number
  /** Output tokens. */
  output: number
  /** Billed cost in yuan (RMB). */
  cost: number
}

/** One time-bucket value. */
export interface BucketValue {
  input: number
  cacheHit: number
  output: number
  cost: number
}

/** Time series bucketing (hourly or daily). */
export interface Buckets {
  kind: 'hour' | 'day'
  /** One label per bucket, aligned with `values`. */
  labels: string[]
  values: BucketValue[]
}

/** One session's aggregate within the range. */
export interface SessionUsage {
  id: string
  title: string
  cost: number
  input: number
  cacheHit: number
  output: number
}

/** Aggregate result of the `usage` Remote method. */
export interface UsageResult {
  totals: Totals
  buckets: Buckets
  perSession: SessionUsage[]
  /** Distinct model short names observed in the range. */
  models: string[]
}

/** Result of the `usageSession` Remote method. */
export interface UsageSessionResult {
  cost: number
  input: number
  cacheHit: number
  output: number
}
