// 차압(dp) 일별 평균 추세와 향후 예측을 보여주는 차트 패널(필터 교체 예측용).
// ⚠ 데모: 하드웨어 배관이 실제 필터 전후에 연결되기 전까지 이 값은 필터 상태와 무관한 목업이다.
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, ReferenceArea,
} from 'recharts'
import { Panel } from './Panel'
import { COLORS, THRESHOLDS, LABELS, PRESSURE_USAGE, PRESSURE_USAGE_COPY } from '../config'
import type { DailyDpPoint } from '../deriveAnalysis'

interface Props {
  daily: DailyDpPoint[]
  isDark: boolean
}

export function DpTrendPanel({ daily, isDark }: Props) {
  const axisColor = isDark ? '#475569' : '#94a3b8'
  const gridColor = isDark ? '#1e3a5f' : '#e2e8f0'
  const tooltipBg = isDark ? '#1e293b' : '#fff'
  const copy = PRESSURE_USAGE_COPY[PRESSURE_USAGE]

  const historyLen = daily.filter(d => !d.projected).length
  const todayDay = daily[historyLen - 1]?.day
  const firstProjectedDay = daily.find(d => d.projected)?.day
  const lastDay = daily[daily.length - 1]?.day

  return (
    <Panel title={copy.trendTitle} isDark={isDark}>
      <ResponsiveContainer width="100%" height="100%" debounce={200}>
        <ComposedChart data={daily} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <XAxis
            dataKey="day"
            tickFormatter={(d: number) => `${d}일`}
            tick={{ fontSize: 10, fill: axisColor }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis domain={[0, THRESHOLDS.dp.axisMax]} tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} />
          <Tooltip
            labelFormatter={(label) => { const d = Number(label); return `${d}일${d === todayDay ? ' (오늘)' : ''}` }}
            formatter={(value, name) => value == null ? ['-', name] : [`${Number(value).toFixed(1)}${LABELS.dp.unit}`, name === 'value' ? '실측 평균' : '추세']}
            contentStyle={{ background: tooltipBg, border: `1px solid ${gridColor}`, fontSize: '0.75rem' }}
          />

          {firstProjectedDay != null && lastDay != null && (
            <ReferenceArea x1={firstProjectedDay} x2={lastDay} fill={COLORS.dpProjected} fillOpacity={0.15} />
          )}

          <ReferenceLine y={THRESHOLDS.dp.warning} stroke={COLORS.warning} strokeDasharray="4 4" label={{ value: '경고', position: 'insideTopLeft', fontSize: 10, fill: COLORS.warning }} />
          {todayDay != null && (
            <ReferenceLine x={todayDay} stroke={axisColor} strokeDasharray="2 2" label={{ value: '오늘', position: 'top', fontSize: 10, fill: axisColor }} />
          )}

          <Bar dataKey="value" name="value" fill={COLORS.dpBar} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Line type="monotone" dataKey="trend" name="trend" stroke={COLORS.regression} strokeDasharray="5 3" strokeWidth={1.8} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </Panel>
  )
}
