// 습도 vs 불량률 산점도와 회귀선을 보여주는 차트 패널(SECOM 데이터 기반 수율 상관관계).
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

  // 회귀선은 불량률(Y) 도메인이 [0,100]으로 고정돼 있는데, humRange 양 끝의 예측값이
  // 그 범위를 벗어나면(직선을 그대로 연장한 값이라 음수/100 초과 가능) recharts의 <Line>은
  // 기본적으로 클리핑되지 않아 축 밖으로 삐져나온다. 불량률이 0~100%를 유지하는
  // humidity 구간만 계산해서 그 구간만 그린다.
  const { slope, intercept } = data.regression
  let regressionLine: { humidity: number; fit: number }[] = []
  if (slope === 0) {
    if (intercept >= 0 && intercept <= 100) {
      regressionLine = humRange.map(h => ({ humidity: h, fit: intercept }))
    }
  } else {
    const hAtZero = -intercept / slope
    const hAtHundred = (100 - intercept) / slope
    const loH = Math.max(humRange[0], Math.min(hAtZero, hAtHundred))
    const hiH = Math.min(humRange[1], Math.max(hAtZero, hAtHundred))
    if (loH <= hiH) {
      regressionLine = [loH, hiH].map(h => ({ humidity: h, fit: slope * h + intercept }))
    }
  }

  const merged = data.scatter.map(p => ({ ...p, fit: undefined }))

  return (
    <Panel
      title="습도 vs 불량률 (SECOM)"
      isDark={isDark}
      badge={<span style={{ fontSize: '0.72rem', fontWeight: 700, color: isDark ? '#94a3b8' : '#64748b' }}>r = {data.r.toFixed(2)}</span>}
    >
      <ResponsiveContainer width="100%" height="100%" debounce={200}>
        <ComposedChart margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <XAxis
            dataKey="humidity"
            type="number"
            name="습도"
            unit="%"
            domain={['dataMin', (max: number) => max + Math.max((max - humRange[0]) * 0.08, 3)]}
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
          <ReferenceLine
            x={THRESHOLDS.humidity.warning}
            stroke={COLORS.warning}
            strokeDasharray="4 4"
            ifOverflow="hidden"
            label={{ value: '경고 습도', position: 'insideTopRight', fontSize: 10, fill: COLORS.warning }}
          />

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
