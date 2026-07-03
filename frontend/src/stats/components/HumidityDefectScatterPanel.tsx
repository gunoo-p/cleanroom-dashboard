import {
  ComposedChart, Scatter, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell,
} from 'recharts'
import { Panel } from './Panel'
import { COLORS, THRESHOLDS } from '../config'
import type { YieldCorrelationView } from '../deriveAnalysis'

interface Props {
  data: YieldCorrelationView
  isDark: boolean
}

export function HumidityDefectScatterPanel({ data, isDark }: Props) {
  const axisColor = isDark ? '#475569' : '#94a3b8'
  const gridColor = isDark ? '#1e3a5f' : '#e2e8f0'
  const tooltipBg = isDark ? '#1e293b' : '#fff'

  const humRange = data.scatter.length
    ? [Math.min(...data.scatter.map(p => p.humidity)), Math.max(...data.scatter.map(p => p.humidity))]
    : [0, 100]
  const regressionLine = humRange.map(h => ({ humidity: h, fit: data.regression.slope * h + data.regression.intercept }))
  const merged = data.scatter.map(p => ({ ...p, fit: undefined }))

  return (
    <Panel
      title="③ 습도 vs 불량률 (SECOM)"
      isDark={isDark}
      badge={<span style={{ fontSize: '0.72rem', fontWeight: 700, color: isDark ? '#94a3b8' : '#64748b' }}>r = {data.r.toFixed(2)}</span>}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <XAxis
            dataKey="humidity"
            type="number"
            name="습도"
            unit="%"
            domain={['dataMin', 'dataMax']}
            tick={{ fontSize: 10, fill: axisColor }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            dataKey="defectRate"
            type="number"
            name="불량률"
            unit="%"
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: axisColor }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number, name: string) => [`${value.toFixed(1)}${name === '습도' ? '%' : '%'}`, name]}
            contentStyle={{ background: tooltipBg, border: `1px solid ${gridColor}`, fontSize: '0.75rem' }}
            cursor={{ strokeDasharray: '3 3' }}
          />
          <ReferenceLine x={THRESHOLDS.humidity.warning} stroke={COLORS.warning} strokeDasharray="4 4" label={{ value: '경고 습도', position: 'insideTopRight', fontSize: 10, fill: COLORS.warning }} />

          <Scatter data={merged} isAnimationActive={false}>
            {merged.map((p, i) => (
              <Cell key={i} fill={p.humidity > THRESHOLDS.humidity.warning ? COLORS.warning : COLORS.normal} fillOpacity={0.7} />
            ))}
          </Scatter>
          <Line
            data={regressionLine}
            dataKey="fit"
            stroke={COLORS.regression}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            legendType="none"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Panel>
  )
}
