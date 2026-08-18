/**
 * React components for the three usage/cost surfaces. Written with
 * `React.createElement` (no JSX) so the plain-JavaScript client bundle needs no
 * transform step.
 * @module @frostgao/dsh-usage-cost/client/components
 */

import * as React from 'react'
import type { UsageRange, UsageRequest, UsageResult } from '../types.ts'
import { costFor } from '../pricing.ts'
import type { TimerService, UsageCostNamespace } from './remote-types.ts'
import { CostTrendChart } from './chart.ts'
import { formatCost, formatTokens } from './format.ts'

const RANGES: Array<{ key: UsageRange; label: string }> = [
  { key: '1d', label: '今天' },
  { key: '24h', label: '24H' },
  { key: '1w', label: '1周' },
  { key: '1m', label: '1月' },
]

function shortModel(model: string): string {
  return model.startsWith('deepseek-') ? model.slice('deepseek-'.length) : model
}

/** Open the settings panel and jump to the "用量" section via the DOM. */
function openUsageSettings(timer: TimerService | undefined): void {
  const later = (fn: () => void): void => {
    if (timer !== undefined) timer.timeout(fn, 100)
    else setTimeout(fn, 100)
  }
  const settingsButton = Array.from(document.querySelectorAll('button[aria-haspopup="dialog"]'))
    .find(button => !button.hasAttribute('aria-label'))
  if (settingsButton instanceof HTMLButtonElement) settingsButton.click()
  later(() => {
    const navButton = Array.from(document.querySelectorAll('nav button'))
      .find(button => (button.textContent ?? '').includes('用量'))
    if (navButton instanceof HTMLButtonElement) navButton.click()
  })
}

function toLocalInput(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Top-right "本会话 ¥" badge in the session header utilities strip. */
export function HeaderCostBadge(props: {
  sessionId: string
  usageCost: UsageCostNamespace
  timer?: TimerService
}): React.ReactNode {
  const { sessionId, usageCost, timer } = props
  const [cost, setCost] = React.useState<number | null>(null)

  React.useEffect(() => {
    let cancelled = false
    usageCost.usageSession({ sessionId }).then((result) => {
      if (cancelled) return
      setCost(result.ok ? result.value.cost : null)
    }, () => {
      if (!cancelled) setCost(null)
    })
    return () => { cancelled = true }
  }, [sessionId, usageCost])

  return React.createElement('button', {
    type: 'button',
    className: 'dsh-header-cost',
    title: '本会话用量',
    onClick: () => { openUsageSettings(timer) },
  }, cost === null ? '本会话 ¥--' : `本会话 ¥${formatCost(cost)}`)
}

/** Per-reply cost chip in the assistant-actions strip. */
export function MessageCostChip(props: {
  messageId: string
  useSession: <T>(selector: (snapshot: any) => T) => T
}): React.ReactNode {
  const nodes = props.useSession((snapshot: any) => snapshot.chat.legacy.nodes) as unknown[]
  const node = (nodes ?? []).find((candidate: any) =>
    candidate?.kind === 'assistant' && candidate?.messageId === props.messageId)

  if (node == null) return null
  const usage = (node as any).usage
  if (usage == null) return null

  const counters = {
    input: usage.inputTokens ?? 0,
    cacheHit: usage.cacheReadTokens ?? 0,
    output: usage.outputTokens ?? 0,
  }
  const cost = costFor((node as any).provenance?.model, counters, (node as any).time)
  return React.createElement('span', {
    className: 'dsh-cost-chip',
    title: '本条回复成本',
  }, `¥${formatCost(cost)}`)
}

/** Settings "用量" section: filters, totals, chart, and per-session list. */
export function UsageSettingsSection(props: {
  close: () => void
  usageCost: UsageCostNamespace
  timer?: TimerService
}): React.ReactNode {
  const { usageCost } = props
  const [range, setRange] = React.useState<UsageRange>('1d')
  const [model, setModel] = React.useState('')
  const [customMode, setCustomMode] = React.useState(false)
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')
  const [data, setData] = React.useState<UsageResult | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async (opts: { refresh?: boolean } = {}) => {
    setLoading(true)
    setError(null)
    if (opts.refresh) setRefreshing(true)
    try {
      let request: UsageRequest
      if (customMode) {
        request = {
          range: 'custom',
          custom: true,
          from: from === '' ? undefined : new Date(from).getTime(),
          to: to === '' ? undefined : new Date(to).getTime(),
          model: model === '' ? undefined : model,
        }
      } else {
        request = { range, model: model === '' ? undefined : model, refresh: opts.refresh }
      }
      const result = await usageCost.usage(request)
      if (result.ok) setData(result.value)
      else setError(`${result.error.code}: ${result.error.message}`)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [usageCost, range, model, customMode, from, to])

  React.useEffect(() => {
    setData(null)
    void load()
  }, [load])

  const toggleCustom = (): void => {
    if (!customMode) {
      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 3600 * 1000)
      setFrom(toLocalInput(yesterday))
      setTo(toLocalInput(now))
    }
    setCustomMode(!customMode)
  }

  const modelOptions = React.useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []
    for (const candidate of ['deepseek-v4-pro', 'deepseek-v4-flash', ...(data?.models ?? [])]) {
      if (candidate !== '' && !seen.has(candidate)) {
        seen.add(candidate)
        list.push(candidate)
      }
    }
    return list
  }, [data])

  const selectRange = (next: UsageRange): void => {
    setRange(next)
    setCustomMode(false)
  }

  const filterRow = React.createElement('div', { className: 'dsh-usage-filter' }, [
    ...RANGES.map(r => React.createElement('button', {
      key: r.key,
      type: 'button',
      className: range === r.key && !customMode ? 'dsh-usage-btn dsh-usage-btn-active' : 'dsh-usage-btn',
      onClick: () => { selectRange(r.key) },
    }, r.label)),
    React.createElement('select', {
      key: 'model',
      className: 'dsh-usage-model',
      value: model,
      onChange: (event: React.ChangeEvent<HTMLSelectElement>) => { setModel(event.target.value) },
    }, [
      React.createElement('option', { key: 'all', value: '' }, '全部模型'),
      ...modelOptions.map(m => React.createElement('option', { key: m, value: m }, shortModel(m))),
    ]),
    React.createElement('button', {
      key: 'custom',
      type: 'button',
      className: customMode ? 'dsh-usage-icon-btn dsh-usage-btn-active' : 'dsh-usage-icon-btn',
      title: '自定义时间段',
      onClick: toggleCustom,
    }, [
      React.createElement('svg', {
        key: 'icon',
        viewBox: '0 0 16 16',
        width: 13,
        height: 13,
        fill: 'currentColor',
      }, React.createElement('path', {
        d: 'M13 2h-1V1a1 1 0 0 0-2 0v1H6V1a1 1 0 0 0-2 0v1H3a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm0 11H3V6h10v7z',
      })),
      '自定义',
    ]),
    React.createElement('button', {
      key: 'refresh',
      type: 'button',
      className: refreshing ? 'dsh-usage-icon-btn dsh-usage-refresh spinning' : 'dsh-usage-icon-btn dsh-usage-refresh',
      title: '刷新',
      onClick: () => { void load({ refresh: true }) },
    }, React.createElement('svg', {
      viewBox: '0 0 16 16',
      width: 13,
      height: 13,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.6,
      strokeLinecap: 'round',
    }, React.createElement('path', { d: 'M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v2.5H11' }))),
  ])

  if (loading && data === null) {
    return React.createElement('div', { className: 'dsh-usage-section' }, [
      filterRow,
      React.createElement('div', { className: 'dsh-usage-loading' }, [
        React.createElement('div', { className: 'dsh-spinner' }),
        React.createElement('div', null, '统计中…'),
      ]),
    ])
  }

  if (error !== null) {
    return React.createElement('div', { className: 'dsh-usage-section' }, [
      filterRow,
      React.createElement('div', { className: 'dsh-usage-empty' }, `读取失败: ${error}`),
    ])
  }

  if (data === null) {
    return React.createElement('div', { className: 'dsh-usage-section' }, [
      filterRow,
      React.createElement('div', { className: 'dsh-usage-empty' }, '暂无数据'),
    ])
  }

  const totalTokens = data.totals.input + data.totals.cacheHit + data.totals.output
  const billedInput = data.totals.input + data.totals.cacheHit
  const hitRate = billedInput > 0 ? data.totals.cacheHit / billedInput : 0

  const blocks: Array<{ key: string; label: string; value: number }> = [
    { key: 'input', label: '输入未命中', value: data.totals.input },
    { key: 'cacheHit', label: '缓存命中', value: data.totals.cacheHit },
    { key: 'output', label: '输出', value: data.totals.output },
  ]

  return React.createElement('div', { className: 'dsh-usage-section' }, [
    filterRow,
    customMode ? React.createElement('div', { key: 'custom', className: 'dsh-usage-custom' }, [
      React.createElement('label', { key: 'from' }, [
        '从',
        React.createElement('input', {
          key: 'input',
          type: 'datetime-local',
          value: from,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => { setFrom(event.target.value) },
        }),
      ]),
      React.createElement('label', { key: 'to' }, [
        '到',
        React.createElement('input', {
          key: 'input',
          type: 'datetime-local',
          value: to,
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => { setTo(event.target.value) },
        }),
      ]),
    ]) : null,
    React.createElement('div', { key: 'totals', className: 'dsh-usage-total-row' }, [
      React.createElement('span', { className: 'dsh-usage-total-cost' }, `¥${formatCost(data.totals.cost)}`),
      React.createElement('span', { className: 'dsh-usage-total-tokens' }, `总 token ${formatTokens(totalTokens)}`),
    ]),
    React.createElement('div', { key: 'blocks', className: 'dsh-usage-blocks' }, blocks.map(block =>
      React.createElement('div', { className: 'dsh-usage-block', key: block.key }, [
        React.createElement('div', { className: 'dsh-usage-block-label' }, block.label),
        React.createElement('div', { className: 'dsh-usage-block-value' }, formatTokens(block.value)),
      ]))),
    React.createElement('div', { key: 'rate', className: 'dsh-usage-progress-row' }, [
      React.createElement('span', null, '缓存命中率'),
      React.createElement('div', { className: 'dsh-usage-progress' },
        React.createElement('div', {
          className: 'dsh-usage-progress-fill',
          style: { width: `${Math.round(hitRate * 100)}%` },
        })),
      React.createElement('span', null, `${(hitRate * 100).toFixed(1)}%`),
    ]),
    React.createElement(CostTrendChart, { key: 'chart', buckets: data.buckets }),
    React.createElement('div', { key: 'sessions', className: 'dsh-usage-sessions' },
      data.perSession.length === 0
        ? React.createElement('div', { className: 'dsh-usage-empty' }, '该时段内暂无对话')
        : data.perSession.map(session =>
          React.createElement('div', { className: 'dsh-usage-session', key: session.id }, [
            React.createElement('span', { className: 'dsh-usage-session-title', title: session.title }, session.title || session.id),
            React.createElement('span', { className: 'dsh-usage-session-tokens' }, `${formatTokens(session.input + session.cacheHit + session.output)} tokens`),
            React.createElement('span', { className: 'dsh-usage-session-cost' }, `¥${formatCost(session.cost)}`),
          ]))),
  ])
}
