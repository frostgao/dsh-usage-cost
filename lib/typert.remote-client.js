/*
 * Typert Host-for-Client Remote contribution for @frostgao/dsh-usage-cost.
 *
 * Committed rather than generated (see lib/typert.host.js for why). Consumed by
 * the Client half, which mounts it via `ctx.remote.$mount(TYPERT_REMOTE)`.
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

export const TYPERT_REMOTE = {
  package: '@frostgao/dsh-usage-cost',
  descriptors: [
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
}

export default TYPERT_REMOTE
