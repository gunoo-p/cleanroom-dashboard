// 실측값 + 이동평균 라인과 경고/위험 기준선을 그리는 추세 차트 (TrendPanel 내부용).
import {
  ComposedChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine, ReferenceArea,
} from 'recharts'
import { COLORS } from '../config'
import { formatHour } from '../format'
import { chartTheme } from '../chartTheme'
import type { TrendPanelData } from '../deriveAnalysis'

export interface TrendChartProps {
  data: TrendPanelData
  unit: string
  isDark: boolean
  rawColor: string
  maColor: string
  warning: number
  danger: number
  axisMin: number
  axisMax: number
  expanded?: boolean
}

const SERIES_LABEL: Record<string, string> = { raw: '실측', ma: '이동평균' }

export function TrendChart({ data, unit, isDark, rawColor, maColor, warning, danger, axisMin, axisMax, expanded }: TrendChartProps) {
  const theme = chartTheme(isDark)
  const tickFontSize = expanded ? 13 : 10
  const labelFontSize = expanded ? 12 : 10

  const riseAreaStart = data.isRising && data.points.length > 8
    ? data.points[data.points.length - 8].t
    : null
  const lastT = data.points[data.points.length - 1]?.t

  // 경고/위험 기준선이 가까우면 두 라벨이 같은 자리에 겹친다 — 위쪽 기준선의 라벨은 선 위에,
  // 아래쪽 기준선의 라벨은 선 아래에 붙여서 항상 서로 반대 방향으로 벌어지게 한다.
  // (온도·가스·공기질은 위험선이 위, 차압은 위험선이 아래)
  // recharts의 ReferenceLine 라벨은 'insideBottom*'이 선 위쪽, 'insideTop*'이 선 아래쪽에 붙는다.
  const upperIsDanger = danger >= warning
  const ABOVE = 'insideBottomLeft'
  const BELOW = 'insideTopLeft'
  const dangerLabelPos = upperIsDanger ? ABOVE : BELOW
  const warningLabelPos = upperIsDanger ? BELOW : ABOVE

  return (
    <ResponsiveContainer width="100%" height="100%" debounce={200}>
      <ComposedChart data={data.points} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
        <XAxis
          dataKey="t"
          tickFormatter={formatHour}
          tick={{ fontSize: tickFontSize, fill: theme.axis }}
          axisLine={false}
          tickLine={false}
          interval={Math.max(0, Math.floor(data.points.length / 6))}
        />
        <YAxis
          domain={[axisMin, axisMax]}
          tick={{ fontSize: tickFontSize, fill: theme.axis }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip
          labelFormatter={(label) => formatHour(String(label))}
          formatter={(value, name) => [`${Number(value).toFixed(1)}${unit}`, SERIES_LABEL[String(name)] ?? name]}
          contentStyle={{ background: theme.tooltipBg, border: `1px solid ${theme.grid}`, fontSize: '0.75rem' }}
        />
        {expanded && (
          <Legend
            formatter={(name) => SERIES_LABEL[String(name)] ?? name}
            wrapperStyle={{ fontSize: '0.8rem', color: theme.textMuted }}
          />
        )}

        {riseAreaStart && lastT && (
          <ReferenceArea x1={riseAreaStart} x2={lastT} fill={COLORS.danger} fillOpacity={0.08} />
        )}

        <ReferenceLine
          y={warning}
          stroke={COLORS.warning}
          strokeDasharray="4 4"
          label={{ value: '경고', position: warningLabelPos, fontSize: labelFontSize, fill: COLORS.warning }}
        />
        <ReferenceLine
          y={danger}
          stroke={COLORS.danger}
          strokeDasharray="4 4"
          label={{ value: '위험', position: dangerLabelPos, fontSize: labelFontSize, fill: COLORS.danger }}
        />

        <Line type="monotone" dataKey="raw" name="raw" stroke={rawColor} strokeWidth={expanded ? 1.5 : 1} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="ma" name="ma" stroke={maColor} strokeWidth={expanded ? 3 : 2.2} dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
