/**
 * DeepSeek usage/cost — Host half.
 *
 * A Typert Remote service (`usageCost`) that aggregates `assistant/message`
 * session events into token buckets and billed cost, with a 3-hour TTL cache
 * plus stale-while-revalidate. The Client reaches it through the generated
 * `@frostgao/dsh-usage-cost/remote` contribution.
 *
 * @module @frostgao/dsh-usage-cost
 */

import type { Context } from '@deepseek-ai/cordis'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
import type { SessionLogSnapshot } from '@deepseek-ai/dsh-session-query'
import type { SessionEvent, SessionHeader } from '@deepseek-ai/dsh-session'
import { costFor } from './pricing.ts'
import type {
  BucketValue,
  Buckets,
  SessionUsage,
  Totals,
  UsageRange,
  UsageRequest,
  UsageResult,
  UsageSessionRequest,
  UsageSessionResult,
} from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    usageCost: UsageCostService
  }
}

/** Cache freshness window (3 hours). */
const TTL_MS = 3 * 3600 * 1000
/** Revalidate in the background once a cached entry is this old. */
const SWR_MS = TTL_MS / 2

const HOUR_MS = 3600 * 1000
const DAY_MS = 24 * HOUR_MS
const BEIJING_OFFSET_MS = 8 * HOUR_MS

interface Range {
  from: number
  to: number
}

interface BucketPlan {
  kind: 'hour' | 'day'
  count: number
  size: number
  labels: string[]
}

/** Token counters plus billed cost accumulated over a range. */
interface Accumulator {
  input: number
  cacheHit: number
  output: number
  cost: number
}

function emptyAccumulator(): Accumulator {
  return { input: 0, cacheHit: 0, output: 0, cost: 0 }
}

function addAccumulator(target: Accumulator, input: number, cacheHit: number, output: number, cost: number): void {
  target.input += input
  target.cacheHit += cacheHit
  target.output += output
  target.cost += cost
}

/** Beijing (UTC+8) midnight epoch ms for the day containing `ms`. */
function beijingDayStart(ms: number): number {
  const shifted = ms + BEIJING_OFFSET_MS
  const date = new Date(shifted)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - BEIJING_OFFSET_MS
}

/** Resolve a request's inclusive [from, to) window. */
function resolveRange(request: UsageRequest): Range {
  const now = Date.now()
  switch (request.range) {
    case '24h':
      return { from: now - DAY_MS, to: now }
    case '1w': {
      const start = beijingDayStart(now)
      return { from: start - 6 * DAY_MS, to: start + DAY_MS }
    }
    case '1m': {
      const start = beijingDayStart(now)
      return { from: start - 29 * DAY_MS, to: start + DAY_MS }
    }
    case 'custom': {
      const fallbackFrom = now - DAY_MS
      const from = request.from ?? fallbackFrom
      const to = request.to ?? now
      return from <= to ? { from, to } : { from: to, to: from }
    }
    case '1d':
    default: {
      const start = beijingDayStart(now)
      return { from: start, to: start + DAY_MS }
    }
  }
}

function formatHour(ms: number): string {
  const hour = new Date(ms + BEIJING_OFFSET_MS).getUTCHours()
  return `${String(hour)}:00`
}

function formatDay(ms: number): string {
  const date = new Date(ms + BEIJING_OFFSET_MS)
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`
}

/** Plan the time axis: today/24h by hour, week/month by day, custom by span. */
function planBuckets(range: UsageRange, from: number, to: number): BucketPlan {
  const duration = to - from
  if (range === '1d' || range === '24h') {
    const count = 24
    const labels: string[] = []
    for (let i = 0; i < count; i++) labels.push(formatHour(from + i * HOUR_MS))
    return { kind: 'hour', count, size: HOUR_MS, labels }
  }
  if (range === '1w' || range === '1m') {
    const count = range === '1w' ? 7 : 30
    const labels: string[] = []
    for (let i = 0; i < count; i++) labels.push(formatDay(from + i * DAY_MS))
    return { kind: 'day', count, size: DAY_MS, labels }
  }
  // custom: hour under 48h, else day; cap 120 buckets.
  const hourly = duration <= 48 * HOUR_MS
  const unit = hourly ? HOUR_MS : DAY_MS
  const rawCount = Math.ceil(duration / unit)
  const count = Math.min(120, Math.max(1, rawCount))
  const size = duration / count
  const labels: string[] = []
  for (let i = 0; i < count; i++) labels.push(hourly ? formatHour(from + i * size) : formatDay(from + i * size))
  return { kind: hourly ? 'hour' : 'day', count, size, labels }
}

function bucketIndex(time: number, from: number, plan: BucketPlan): number {
  const index = Math.floor((time - from) / plan.size)
  return Math.max(0, Math.min(plan.count - 1, index))
}

/** Extract the token counters that participate in billing. */
function countersOf(usage: { inputTokens: number; outputTokens: number; cacheReadTokens?: number } | undefined): {
  input: number
  cacheHit: number
  output: number
} {
  return {
    input: usage?.inputTokens ?? 0,
    cacheHit: usage?.cacheReadTokens ?? 0,
    output: usage?.outputTokens ?? 0,
  }
}

/** Model short name for one assistant/message event. */
function modelOf(event: SessionEvent): string {
  const data = event.data as {
    message?: { source?: { model?: string } }
    provenance?: { model?: string }
  }
  return data.message?.source?.model ?? data.provenance?.model ?? ''
}

/** Fold a readable session title from its first user message. */
function sessionTitle(events: readonly SessionEvent[], header: SessionHeader): string {
  for (const event of events) {
    if (event.type !== 'user/message') continue
    const text = contentText((event.data as { content?: unknown }).content)
    if (text !== '') return truncate(text, 60)
  }
  return truncate(String(header.id ?? ''), 20) || '会话'
}

function contentText(content: unknown): string {
  if (!Array.isArray(content)) return ''
  return content
    .map((block) => {
      if (block !== null && typeof block === 'object' && typeof (block as { text?: unknown }).text === 'string') {
        return (block as { text: string }).text
      }
      return ''
    })
    .filter(Boolean)
    .join(' ')
    .trim()
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/**
 * Aggregate usage/cost across the live-preferred session corpus.
 * @typert service usageCost
 */
export class UsageCostService extends TypertRemoteService {
  static inject = ['sessionQuery']

  private readonly cache = new Map<string, { at: number; data: UsageResult }>()
  private readonly inflight = new Map<string, Promise<UsageResult>>()

  constructor(ctx: Context) {
    super(ctx, 'usageCost')
  }

  /**
   * Aggregate usage/cost for a preset or custom range.
   * @param request - range selector, optional model filter, and cache controls.
   * @returns totals, time buckets, per-session breakdown, and observed models.
   */
  @Remote('usage')
  async usage(request: UsageRequest): Promise<UsageResult> {
    // `custom` queries are never cached; `refresh` forces a synchronous recompute.
    if (request.custom === true || request.refresh === true) {
      const data = await this.compute(request)
      if (request.custom !== true) this.cache.set(this.cacheKey(request), { at: Date.now(), data })
      return data
    }

    const key = this.cacheKey(request)
    const cached = this.cache.get(key)
    if (cached !== undefined && Date.now() - cached.at < TTL_MS) {
      // stale-while-revalidate: serve the stale copy and refresh in the background.
      if (Date.now() - cached.at >= SWR_MS) void this.revalidate(key, request)
      return cached.data
    }

    const pending = this.inflight.get(key)
    if (pending !== undefined) return pending

    const task = this.compute(request)
    this.inflight.set(key, task)
    try {
      const data = await task
      this.cache.set(key, { at: Date.now(), data })
      return data
    } finally {
      this.inflight.delete(key)
    }
  }

  /**
   * Exact total cost for one session.
   * @param request - the session to total.
   * @returns the billed tokens and cost for that session's assistant messages.
   */
  @Remote('usageSession')
  async usageSession(request: UsageSessionRequest): Promise<UsageSessionResult> {
    const snapshot = await this.ctx.sessionQuery.readSession(request.sessionId as never)
    const total: Accumulator = emptyAccumulator()
    for (const event of snapshot.events) {
      if (event.type !== 'assistant/message') continue
      const data = event.data as { usage?: { inputTokens: number; outputTokens: number; cacheReadTokens?: number } }
      if (data.usage === undefined) continue
      const counters = countersOf(data.usage)
      const cost = costFor(modelOf(event), counters, event.time)
      addAccumulator(total, counters.input, counters.cacheHit, counters.output, cost)
    }
    return { cost: total.cost, input: total.input, cacheHit: total.cacheHit, output: total.output }
  }

  private cacheKey(request: UsageRequest): string {
    return `${request.range}\u0000${request.model ?? ''}`
  }

  private async revalidate(key: string, request: UsageRequest): Promise<void> {
    if (this.inflight.has(key)) return
    const task = this.compute(request)
    this.inflight.set(key, task)
    try {
      const data = await task
      this.cache.set(key, { at: Date.now(), data })
    } finally {
      this.inflight.delete(key)
    }
  }

  private async compute(request: UsageRequest): Promise<UsageResult> {
    const range = resolveRange(request)
    const plan = planBuckets(request.range, range.from, range.to)
    const totals: Accumulator = emptyAccumulator()
    const buckets: Accumulator[] = Array.from({ length: plan.count }, () => emptyAccumulator())
    const perSession = new Map<string, Accumulator & { title: string }>()
    const models = new Set<string>()

    const records = await this.ctx.sessionQuery.listSessions()
    for (const record of records) {
      let snapshot: SessionLogSnapshot
      try {
        snapshot = await this.ctx.sessionQuery.readSession(record.header.id)
      } catch {
        continue
      }

      const sessionTotal: Accumulator = emptyAccumulator()
      for (const event of snapshot.events) {
        if (event.type !== 'assistant/message') continue
        if (event.time < range.from || event.time >= range.to) continue
        const model = modelOf(event)
        // Collect every model seen in the range so the Client dropdown stays complete
        // even while a filter is active.
        if (model !== '') models.add(model)
        if (request.model !== undefined && request.model !== '' && model !== request.model) continue
        const data = event.data as { usage?: { inputTokens: number; outputTokens: number; cacheReadTokens?: number } }
        if (data.usage === undefined) continue
        const counters = countersOf(data.usage)
        const cost = costFor(model, counters, event.time)

        addAccumulator(totals, counters.input, counters.cacheHit, counters.output, cost)
        const index = bucketIndex(event.time, range.from, plan)
        addAccumulator(buckets[index], counters.input, counters.cacheHit, counters.output, cost)
        addAccumulator(sessionTotal, counters.input, counters.cacheHit, counters.output, cost)
      }

      const nonzero = sessionTotal.input > 0 || sessionTotal.cacheHit > 0 || sessionTotal.output > 0 || sessionTotal.cost > 0
      if (nonzero) {
        perSession.set(String(record.header.id), {
          title: sessionTitle(snapshot.events, snapshot.session),
          ...sessionTotal,
        })
      }
    }

    const values: BucketValue[] = buckets.map(bucket => ({
      input: bucket.input,
      cacheHit: bucket.cacheHit,
      output: bucket.output,
      cost: bucket.cost,
    }))
    const bucketResult: Buckets = { kind: plan.kind, labels: plan.labels, values }
    const totalsResult: Totals = {
      input: totals.input,
      cacheHit: totals.cacheHit,
      output: totals.output,
      cost: totals.cost,
    }
    const perSessionResult: SessionUsage[] = [...perSession.entries()]
      .map(([id, entry]) => ({
        id,
        title: entry.title,
        cost: entry.cost,
        input: entry.input,
        cacheHit: entry.cacheHit,
        output: entry.output,
      }))
      .sort((left, right) => right.cost - left.cost)

    return {
      totals: totalsResult,
      buckets: bucketResult,
      perSession: perSessionResult,
      models: [...models].sort(),
    }
  }
}

export default UsageCostService
