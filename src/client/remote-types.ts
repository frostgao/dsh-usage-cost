/**
 * Client remote contracts shared by the three UI surfaces.
 * @module @frostgao/dsh-usage-cost/client/remote-types
 */

import type { UsageRequest, UsageResult, UsageSessionRequest, UsageSessionResult } from '../types.ts'

export interface RemoteFailure {
  code: string
  message: string
  details: object
}

export type RemoteResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: RemoteFailure }

export interface UsageCostNamespace {
  usage(request: UsageRequest): Promise<RemoteResult<UsageResult>>
  usageSession(request: UsageSessionRequest): Promise<RemoteResult<UsageSessionResult>>
}

export interface UsageCostRemote {
  $mount(contribution: unknown): Promise<() => Promise<void>>
  usageCost: UsageCostNamespace
}

export interface TimerService {
  timeout(callback: () => void, delay: number): () => void
  timeout(delay: number): Promise<void>
}
