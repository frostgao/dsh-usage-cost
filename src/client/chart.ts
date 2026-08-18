/**
 * Hand-written SVG trend chart. Four series — input (blue), output (orange),
 * cache-hit (yellow, with a 16% area shadow), cost (green, dashed, top layer) —
 * over a monotone cubic interpolation that never dips below zero. Dual y-axes
 * (left tokens, right yuan) with 0 / mid / peak ticks, and a hover crosshair
 * plus a top info bar.
 * @module @frostgao/dsh-usage-cost/client/chart
 */

import * as React from 'react'
import type { Buckets } from '../types.ts'
import { formatCompact, formatYuan, niceCeil } from './format.ts'

const W = 760
const H = 300
const MARGIN = { top: 22, right: 52, bottom: 30, left: 52 }
const PLOT_W = W - MARGIN.left - MARGIN.right
const PLOT_H = H - MARGIN.top - MARGIN.bottom
const BASELINE_Y = MARGIN.top + PLOT_H

interface SeriesDef {
  key: 'input' | 'cacheHit' | 'output' | 'cost'
  label: string
  color: string
  dashed: boolean
  area: boolean
  axis: 'left' | 'right'
}

const SERIES: SeriesDef[] = [
  { key: 'input', label: '输入', color: '#5B8DEF', dashed: false, area: false, axis: 'left' },
  { key: 'output', label: '输出', color: '#F2994A', dashed: false, area: false, axis: 'left' },
  { key: 'cacheHit', label: '缓存命中', color: '#E3C04B', dashed: false, area: true, axis: 'left' },
  { key: 'cost', label: '成本', color: '#4CC38A', dashed: true, area: false, axis: 'right' },
]

/** Fritsch–Carlson monotone cubic tangents (per x-unit). */
function tangents(x: number[], y: number[]): number[] {
  const n = x.length
  const m: number[] = []
  for (let i = 0; i < n; i++) {
    const a = x[i - 1]
    const c = x[i + 1]
    if (a === undefined) {
      m.push((y[i + 1] - y[i]) / (c - x[i]))
    } else if (c === undefined) {
      m.push((y[i] - y[i - 1]) / (x[i] - a))
    } else {
      const d1 = (y[i] - y[i - 1]) / (x[i] - a)
      const d2 = (y[i + 1] - y[i]) / (c - x[i])
      m.push(d1 * d2 <= 0 ? 0 : (d1 + d2) / 2)
    }
  }
  for (let i = 0; i < n - 1; i++) {
    const d = (y[i + 1] - y[i]) / (x[i + 1] - x[i])
    if (d === 0) {
      m[i] = 0
      m[i + 1] = 0
    } else {
      const a = m[i] / d
      const b = m[i + 1] / d
      const s = a * a + b * b
      if (s > 9) {
        const t = 3 / Math.sqrt(s)
        m[i] = t * a * d
        m[i + 1] = t * b * d
      }
    }
  }
  return m
}

/** SVG path string for one series of [x, y] points. */
function monotonePath(points: ReadonlyArray<readonly [number, number]>): string {
  const n = points.length
  if (n === 0) return ''
  if (n === 1) return `M ${points[0][0]},${points[0][1]}`
  const x = points.map(p => p[0])
  const y = points.map(p => p[1])
  const m = tangents(x, y)
  let d = `M ${x[0]},${y[0]}`
  for (let i = 0; i < n - 1; i++) {
    const dx = x[i + 1] - x[i]
    const t0 = m[i] * dx
    const t1 = m[i + 1] * dx
    d += ` C ${x[i] + dx / 3},${y[i] + t0 / 3} ${x[i + 1] - dx / 3},${y[i + 1] - t1 / 3} ${x[i + 1]},${y[i + 1]}`
  }
  return d
}

function areaPath(points: ReadonlyArray<readonly [number, number]>): string {
  if (points.length === 0) return ''
  const line = monotonePath(points)
  const last = points[points.length - 1]
  const first = points[0]
  return `${line} L ${last[0]},${BASELINE_Y} L ${first[0]},${BASELINE_Y} Z`
}

function valueText(key: SeriesDef['key'], value: number): string {
  if (key === 'cost') return formatYuan(value)
  return formatCompact(value)
}

export function CostTrendChart(props: { buckets: Buckets }): React.ReactNode {
  const { buckets } = props
  const [hover, setHover] = React.useState<number | null>(null)

  const values = buckets.values
  const labels = buckets.labels
  const count = values.length

  const model = React.useMemo(() => {
    if (count === 0) return null
    let leftMax = 0
    let rightMax = 0
    for (const value of values) {
      leftMax = Math.max(leftMax, value.input, value.cacheHit, value.output)
      rightMax = Math.max(rightMax, value.cost)
    }
    const leftPeak = niceCeil(leftMax)
    const rightPeak = niceCeil(rightMax)
    const xFor = (i: number): number =>
      count === 1 ? MARGIN.left + PLOT_W / 2 : MARGIN.left + (i / (count - 1)) * PLOT_W
    const yLeft = (v: number): number => MARGIN.top + PLOT_H * (1 - v / leftPeak)
    const yRight = (v: number): number => MARGIN.top + PLOT_H * (1 - v / rightPeak)

    const series = SERIES.map(def => {
      const yFor = def.axis === 'left' ? yLeft : yRight
      const points: Array<readonly [number, number]> = values.map((value, i) => [
        xFor(i),
        yFor(value[def.key]),
      ])
      const path = monotonePath(points)
      return {
        ...def,
        points,
        path,
        area: def.area ? areaPath(points) : '',
      }
    })

    const leftTicks = [0, leftPeak / 2, leftPeak].map(v => ({ value: v, y: yLeft(v), label: formatCompact(v) }))
    const rightTicks = [0, rightPeak / 2, rightPeak].map(v => ({ value: v, y: yRight(v), label: formatYuan(v) }))

    const labelStep = Math.max(1, Math.ceil(count / 8))
    return { xFor, series, leftTicks, rightTicks, labelStep }
  }, [values, count])

  if (model === null) {
    return React.createElement('div', { className: 'dsh-chart-wrap' },
      React.createElement('div', { className: 'dsh-usage-empty' }, '暂无数据'))
  }

  const onMouseMove = (event: React.MouseEvent<SVGSVGElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * W
    const t = (x - MARGIN.left) / PLOT_W
    const index = count === 1 ? 0 : Math.round(t * (count - 1))
    const clamped = Math.max(0, Math.min(count - 1, index))
    setHover(clamped)
  }

  const gridChildren = model.leftTicks.map((tick, i) =>
    React.createElement('g', { key: `grid-${i}` }, [
      React.createElement('line', {
        className: 'grid-line',
        x1: MARGIN.left, y1: tick.y, x2: MARGIN.left + PLOT_W, y2: tick.y,
      }),
      React.createElement('text', {
        className: 'axis-label',
        x: MARGIN.left - 8, y: tick.y + 3, textAnchor: 'end',
      }, tick.label),
    ]),
  )

  const rightTickChildren = model.rightTicks.map((tick, i) =>
    React.createElement('text', {
      key: `right-${i}`,
      className: 'axis-label',
      x: MARGIN.left + PLOT_W + 8, y: tick.y + 3, textAnchor: 'start',
    }, tick.label),
  )

  const xLabelChildren: React.ReactNode[] = []
  for (let i = 0; i < count; i++) {
    if (i % model.labelStep !== 0 && i !== count - 1) continue
    xLabelChildren.push(React.createElement('text', {
      key: `x-${i}`,
      className: 'x-label',
      x: model.xFor(i), y: H - 8,
    }, labels[i]))
  }

  const lineChildren: React.ReactNode[] = []
  const areaChildren: React.ReactNode[] = []
  for (const series of model.series) {
    if (series.area) {
      areaChildren.push(React.createElement('path', {
        key: `area-${series.key}`,
        d: series.area,
        fill: series.color,
        fillOpacity: 0.16,
        stroke: 'none',
      }))
    }
    lineChildren.push(React.createElement('path', {
      key: `line-${series.key}`,
      d: series.path,
      fill: 'none',
      stroke: series.color,
      strokeWidth: 2,
      ...(series.dashed ? { strokeDasharray: '5 4' } : {}),
    }))
  }

  const hoverChildren: React.ReactNode[] = []
  if (hover !== null) {
    const hx = model.xFor(hover)
    hoverChildren.push(React.createElement('line', {
      key: 'hover-line',
      className: 'hover-line',
      x1: hx, y1: MARGIN.top, x2: hx, y2: BASELINE_Y,
    }))
    for (const series of model.series) {
      const point = series.points[hover]
      hoverChildren.push(React.createElement('circle', {
        key: `hover-${series.key}`,
        cx: point[0], cy: point[1], r: 3.5,
        fill: series.color, stroke: '#ffffff', strokeWidth: 1,
      }))
    }
  }

  const infoChildren: React.ReactNode[] = []
  if (hover !== null) {
    infoChildren.push(React.createElement('b', { key: 'label' }, labels[hover]))
    for (const def of SERIES) {
      infoChildren.push(React.createElement('span', { key: def.key }, [
        React.createElement('span', {
          key: 'dot',
          className: 'dot',
          style: { background: def.color },
        }),
        `${def.label} ${valueText(def.key, values[hover][def.key])}`,
      ]))
    }
  } else {
    infoChildren.push(React.createElement('span', { key: 'hint' }, '移动鼠标查看各时刻数据'))
  }

  const legendChildren = SERIES.map(def =>
    React.createElement('span', {
      key: def.key,
      className: 'dsh-chart-legend-item',
      style: { display: 'inline-flex', alignItems: 'center', gap: 6, margin: '0 10px' },
    }, [
      React.createElement('span', {
        key: 'line',
        style: {
          display: 'inline-block',
          width: 16,
          height: 3,
          borderRadius: 2,
          background: def.color,
        },
      }),
      def.label,
    ]),
  )

  return React.createElement('div', { className: 'dsh-chart-wrap' }, [
    React.createElement('div', { key: 'info', className: 'dsh-chart-info' }, infoChildren),
    React.createElement('svg', {
      key: 'svg',
      className: 'dsh-chart',
      viewBox: `0 0 ${W} ${H}`,
      onMouseMove,
      onMouseLeave: () => { setHover(null) },
    }, [
      ...gridChildren,
      ...rightTickChildren,
      ...areaChildren,
      ...lineChildren,
      ...xLabelChildren,
      ...hoverChildren,
    ]),
    React.createElement('div', {
      key: 'legend',
      style: { display: 'flex', justifyContent: 'center', flexWrap: 'wrap', padding: '6px 0 2px', color: 'var(--dsh-usage-muted)', fontSize: 11 },
    }, legendChildren),
  ])
}
