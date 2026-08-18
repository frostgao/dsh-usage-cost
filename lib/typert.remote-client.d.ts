/*
 * Typert Host-for-Client Remote contribution type declarations for
 * @frostgao/dsh-usage-cost. Merges the `usageCost` namespace into the generated
 * Remote map so consumers read a typed `ctx.remote.usageCost`.
 */
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'

export type UsageRange = '1d' | '24h' | '1w' | '1m' | 'custom'
export interface UsageRequest {
  range: UsageRange
  model?: string
  refresh?: boolean
  custom?: boolean
  from?: number
  to?: number
}
export interface UsageSessionRequest {
  sessionId: string
}
export interface Totals {
  input: number
  cacheHit: number
  output: number
  cost: number
}
export interface BucketValue {
  input: number
  cacheHit: number
  output: number
  cost: number
}
export interface Buckets {
  kind: 'hour' | 'day'
  labels: string[]
  values: BucketValue[]
}
export interface SessionUsage {
  id: string
  title: string
  cost: number
  input: number
  cacheHit: number
  output: number
}
export interface UsageResult {
  totals: Totals
  buckets: Buckets
  perSession: SessionUsage[]
  models: string[]
}
export interface UsageSessionResult {
  cost: number
  input: number
  cacheHit: number
  output: number
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface TypertRemoteNamespace$7573616765436f7374 {
    usage: (request: UsageRequest) => Promise<RemoteResult<UsageResult>>
    usageSession: (request: UsageSessionRequest) => Promise<RemoteResult<UsageSessionResult>>
  }
  interface TypertRemoteMap {
    'usageCost/usage': (request: UsageRequest) => Promise<RemoteResult<UsageResult>>
    'usageCost/usageSession': (request: UsageSessionRequest) => Promise<RemoteResult<UsageSessionResult>>
  }
  interface TypertRemoteNamespaceMap {
    'usageCost': TypertRemoteNamespace$7573616765436f7374
  }
}

export declare const TYPERT_REMOTE: TypertRemoteContribution
export default TYPERT_REMOTE
