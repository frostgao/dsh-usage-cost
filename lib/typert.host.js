/*
 * Typert Host-face artifact for @frostgao/dsh-usage-cost.
 *
 * This file is committed rather than emitted at build time because the upstream
 * typert generator (`typertPlugin({ mode: 'package' })`) requires a full
 * workspace (`tsconfig.host.json` + a `packages/` tree) to analyze; a standalone
 * npm package cannot run it. The content below matches the generator's output
 * format exactly (zod v4 schemas + the TYPERT manifest), so the Host typert
 * loader accepts it unchanged.
 */
import { z } from 'zod'

const _usage_parameter_0$schema = z.object({
  'range': z.union([z.literal('1d'), z.literal('24h'), z.literal('1w'), z.literal('1m'), z.literal('custom')]),
  'model': z.string().optional(),
  'refresh': z.boolean().optional(),
  'custom': z.boolean().optional(),
  'from': z.number().optional(),
  'to': z.number().optional(),
})

const _usage_result$schema = z.object({
  'totals': z.object({
    'input': z.number(),
    'cacheHit': z.number(),
    'output': z.number(),
    'cost': z.number(),
  }),
  'buckets': z.object({
    'kind': z.union([z.literal('hour'), z.literal('day')]),
    'labels': z.array(z.string()),
    'values': z.array(z.object({
      'input': z.number(),
      'cacheHit': z.number(),
      'output': z.number(),
      'cost': z.number(),
    })),
  }),
  'perSession': z.array(z.object({
    'id': z.string(),
    'title': z.string(),
    'cost': z.number(),
    'input': z.number(),
    'cacheHit': z.number(),
    'output': z.number(),
  })),
  'models': z.array(z.string()),
})

const _usageSession_parameter_0$schema = z.object({
  'sessionId': z.string(),
})

const _usageSession_result$schema = z.object({
  'cost': z.number(),
  'input': z.number(),
  'cacheHit': z.number(),
  'output': z.number(),
})

export const TYPERT = {
  package: '@frostgao/dsh-usage-cost',
  face: 'host',
  schemas: [],
  invocations: [
    {
      id: '@frostgao/dsh-usage-cost#usageCost/usage',
      service: 'usageCost',
      namespace: 'usageCost',
      method: 'usage',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'request',
          wire: 'request',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: '@frostgao/dsh-usage-cost/types#UsageRequest',
            schema: _usage_parameter_0$schema,
          },
        },
      ],
      result: {
        mode: 'strict',
        typeSymbol: '@frostgao/dsh-usage-cost/types#UsageResult',
        schema: _usage_result$schema,
      },
      sourceLocation: { file: 'src/index.ts', line: 115, column: 3 },
    },
    {
      id: '@frostgao/dsh-usage-cost#usageCost/usageSession',
      service: 'usageCost',
      namespace: 'usageCost',
      method: 'usageSession',
      invocation: { kind: 'direct' },
      parameters: [
        {
          name: 'request',
          wire: 'request',
          source: 'json',
          codec: {
            mode: 'strict',
            typeSymbol: '@frostgao/dsh-usage-cost/types#UsageSessionRequest',
            schema: _usageSession_parameter_0$schema,
          },
        },
      ],
      result: {
        mode: 'strict',
        typeSymbol: '@frostgao/dsh-usage-cost/types#UsageSessionResult',
        schema: _usageSession_result$schema,
      },
      sourceLocation: { file: 'src/index.ts', line: 153, column: 3 },
    },
  ],
  model: {
    services: [
      {
        tags: [],
        description: 'Aggregate usage/cost across the live-preferred session corpus.',
        summary: 'Aggregate usage/cost across the live-preferred session corpus.',
        jsDoc: '/** Aggregate usage/cost across the live-preferred session corpus. */',
        key: 'usageCost',
        exportName: 'UsageCostService',
        members: [
          {
            kind: 'method',
            name: 'usage',
            signature: "@Remote('usage') async usage(request: UsageRequest): Promise<UsageResult>",
            summary: 'Aggregate usage/cost for a preset or custom range.',
          },
          {
            kind: 'method',
            name: 'usageSession',
            signature: "@Remote('usageSession') async usageSession(request: UsageSessionRequest): Promise<UsageSessionResult>",
            summary: 'Exact total cost for one session.',
          },
        ],
        types: [
          { name: 'UsageRange', declaration: "export type UsageRange = '1d' | '24h' | '1w' | '1m' | 'custom'" },
          { name: 'UsageRequest', declaration: 'export interface UsageRequest { range: UsageRange; model?: string; refresh?: boolean; custom?: boolean; from?: number; to?: number }' },
          { name: 'UsageSessionRequest', declaration: 'export interface UsageSessionRequest { sessionId: string }' },
          { name: 'Totals', declaration: 'export interface Totals { input: number; cacheHit: number; output: number; cost: number }' },
          { name: 'BucketValue', declaration: 'export interface BucketValue { input: number; cacheHit: number; output: number; cost: number }' },
          { name: 'Buckets', declaration: "export interface Buckets { kind: 'hour' | 'day'; labels: string[]; values: BucketValue[] }" },
          { name: 'SessionUsage', declaration: 'export interface SessionUsage { id: string; title: string; cost: number; input: number; cacheHit: number; output: number }' },
          { name: 'UsageResult', declaration: 'export interface UsageResult { totals: Totals; buckets: Buckets; perSession: SessionUsage[]; models: string[] }' },
          { name: 'UsageSessionResult', declaration: 'export interface UsageSessionResult { cost: number; input: number; cacheHit: number; output: number }' },
        ],
      },
    ],
    events: [],
    objects: [],
  },
}
