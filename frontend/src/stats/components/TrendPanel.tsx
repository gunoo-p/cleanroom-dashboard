import {
  ComposedChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea,
} from 'recharts'
import { Panel } from './Panel'
import { Badge } from './Badge'
import { COLORS } from '../config'
import type { TrendPanelData } from '../deriveAnalysis'

interface Props {
  title: string
  unit: string
  data: TrendPanelData
  isDark: boolean
  rawColor: string
  maColor: string
  warning: number
  danger: number
  axisMin: number
  axisMax: number
  risingLabel: string
}

function formatHour(iso: string) {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}시`
}

export function TrendPanel({ title, unit, data, isDark, rawColor, maColor, warning, danger, axisMin, axisMax, risingLabel }: Props) {
  const axisColor = isDark ? '#475569' : '#94a3b8'
  const gridColor = isDark ? '#1e3a5f' : '#e2e8f0'
  const tooltipBg = isDark ? '#1e293b' : '#fff'

  const riseAreaStart = data.isRising && data.points.length > 8
    ? data.points[data.points.length - 8].t
    : null
  const lastT = data.points[data.points.length - 1]?.t

  return (
    <Panel
      title={title}
      isDark={isDark}
      badge={data.isRising ? <Badge label={risingLabel} severity="danger" isDark={isDark} /> : undefined}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data.points} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <XAxis
            dataKey="t"
            tickFormatter={formatHour}
            tick={{ fontSize: 10, fill: axisColor }}
            axisLine={false}
            tickLine={false}
            interval={Math.max(0, Math.floor(data.points.length / 6))}
          />
          <YAxis
            domain={[axisMin, axisMax]}
            tick={{ fontSize: 10, fill: axisColor }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            labelFormatter={formatHour}
            formatter={(value: number, name: string) => [`${value.toFixed(1)}${unit}`, name === 'raw' ? '실측' : '이동평균']}
            contentStyle={{ background: tooltipBg, border: `1px solid ${gridColor}`, fontSize: '0.75rem' }}
          />

          {riseAreaStart && lastT && (
            <ReferenceArea x1={riseAreaStart} x2={lastT} fill={COLORS.danger} fillOpacity={0.08} />
          )}

          <ReferenceLine y={warning} stroke={COLORS.warning} strokeDasharray="4 4" label={{ value: '경고', position: 'insideTopLeft', fontSize: 10, fill: COLORS.warning }} />
          <ReferenceLine y={danger} stroke={COLORS.danger} strokeDasharray="4 4" label={{ value: '위험', position: 'insideTopLeft', fontSize: 10, fill: COLORS.danger }} />

          <Line type="monotone" dataKey="raw" name="raw" stroke={rawColor} strokeWidth={1} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="ma" name="ma" stroke={maColor} strokeWidth={2.2} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </Panel>
  )
}
