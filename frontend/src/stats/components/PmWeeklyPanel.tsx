// 주별 PM 베이스라인 상승을 보여주는 막대 차트 패널.
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, LabelList, Cell,
} from 'recharts'
import { Panel } from './Panel'
import { COLORS, THRESHOLDS } from '../config'
import type { WeeklyPmPoint } from '../deriveAnalysis'

const SEVERITY_BAR_COLOR = { normal: COLORS.normal, warning: COLORS.warning, danger: COLORS.danger }

interface Props {
  weekly: WeeklyPmPoint[]
  isDark: boolean
}

export function PmWeeklyPanel({ weekly, isDark }: Props) {
  const axisColor = isDark ? '#475569' : '#94a3b8'
  const gridColor = isDark ? '#1e3a5f' : '#e2e8f0'
  const tooltipBg = isDark ? '#1e293b' : '#fff'

  return (
    <Panel title="주별 PM 베이스라인 상승" isDark={isDark}>
      <ResponsiveContainer width="100%" height="100%" debounce={200}>
        <BarChart data={weekly} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, THRESHOLDS.pm.axisMax]} tick={{ fontSize: 10, fill: axisColor }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(value: number) => [`${value.toFixed(1)}µg/m³`, '주 평균']}
            contentStyle={{ background: tooltipBg, border: `1px solid ${gridColor}`, fontSize: '0.75rem' }}
          />
          <ReferenceLine y={THRESHOLDS.pm.warning} stroke={COLORS.warning} strokeDasharray="4 4" label={{ value: '경고', position: 'insideTopLeft', fontSize: 10, fill: COLORS.warning }} />
          <Bar dataKey="value" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            <LabelList dataKey="value" position="top" fontSize={10} fill={axisColor} formatter={(v: number) => v.toFixed(1)} />
            {weekly.map((w, i) => (
              <Cell key={i} fill={SEVERITY_BAR_COLOR[w.severity]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Panel>
  )
}
