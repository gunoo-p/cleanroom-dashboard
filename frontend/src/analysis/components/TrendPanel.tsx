// 센서 이동평균 추세를 보여주는 라인 차트 패널(설비 이상/공기질 예측용).
import {
  ComposedChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
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
  onClick?: () => void
  expanded?: boolean
}

function formatHour(iso: string) {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}시`
}

function formatRate(v: number, unit: string) {
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}${unit}/h`
}

function formatEta(hours: number | null) {
  if (hours == null) return '해당 없음'
  if (hours < 1) return `약 ${Math.round(hours * 60)}분 후`
  return `약 ${hours.toFixed(1)}시간 후`
}

export function TrendPanel({ title, unit, data, isDark, rawColor, maColor, warning, danger, axisMin, axisMax, risingLabel, onClick, expanded }: Props) {
  const axisColor = isDark ? '#475569' : '#94a3b8'
  const gridColor = isDark ? '#1e3a5f' : '#e2e8f0'
  const tooltipBg = isDark ? '#1e293b' : '#fff'
  const textMuted = isDark ? '#94a3b8' : '#64748b'
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a'

  const tickFontSize = expanded ? 13 : 10
  const labelFontSize = expanded ? 12 : 10

  const riseAreaStart = data.isRising && data.points.length > 8
    ? data.points[data.points.length - 8].t
    : null
  const lastT = data.points[data.points.length - 1]?.t

  const chart = (
    <ResponsiveContainer width="100%" height="100%" debounce={200}>
      <ComposedChart data={data.points} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <XAxis
          dataKey="t"
          tickFormatter={formatHour}
          tick={{ fontSize: tickFontSize, fill: axisColor }}
          axisLine={false}
          tickLine={false}
          interval={Math.max(0, Math.floor(data.points.length / 6))}
        />
        <YAxis
          domain={[axisMin, axisMax]}
          tick={{ fontSize: tickFontSize, fill: axisColor }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          labelFormatter={(label) => formatHour(String(label))}
          formatter={(value, name) => [`${Number(value).toFixed(1)}${unit}`, name === 'raw' ? '실측' : '이동평균']}
          contentStyle={{ background: tooltipBg, border: `1px solid ${gridColor}`, fontSize: '0.75rem' }}
        />
        {expanded && (
          <Legend
            formatter={(name) => name === 'raw' ? '실측' : '이동평균'}
            wrapperStyle={{ fontSize: '0.8rem', color: textMuted }}
          />
        )}

        {riseAreaStart && lastT && (
          <ReferenceArea x1={riseAreaStart} x2={lastT} fill={COLORS.danger} fillOpacity={0.08} />
        )}

        <ReferenceLine y={warning} stroke={COLORS.warning} strokeDasharray="4 4" label={{ value: '경고', position: 'insideTopLeft', fontSize: labelFontSize, fill: COLORS.warning }} />
        <ReferenceLine y={danger} stroke={COLORS.danger} strokeDasharray="4 4" label={{ value: '위험', position: 'insideTopLeft', fontSize: labelFontSize, fill: COLORS.danger }} />

        <Line type="monotone" dataKey="raw" name="raw" stroke={rawColor} strokeWidth={expanded ? 1.5 : 1} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="ma" name="ma" stroke={maColor} strokeWidth={expanded ? 3 : 2.2} dot={false} isAnimationActive={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )

  return (
    <Panel
      title={title}
      isDark={isDark}
      badge={data.isRising ? <Badge label={risingLabel} severity="danger" isDark={isDark} /> : undefined}
      onClick={onClick}
      expanded={expanded}
    >
      {expanded ? (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
          <div style={{ flex: 1, minHeight: 0 }}>{chart}</div>
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 32,
            flexShrink: 0, paddingTop: 8, borderTop: `1px solid ${gridColor}`,
          }}>
            <Stat label="현재값" value={`${data.latestValue.toFixed(1)}${unit}`} isDark={isDark} textMuted={textMuted} textPrimary={textPrimary} />
            <Stat label="변화율" value={formatRate(data.ratePerHour, unit)} isDark={isDark} textMuted={textMuted} textPrimary={textPrimary} />
            <Stat label="위험임계 도달 예상" value={formatEta(data.etaHours)} isDark={isDark} textMuted={textMuted} textPrimary={textPrimary} />
          </div>
        </div>
      ) : chart}
    </Panel>
  )
}

function Stat({ label, value, textMuted, textPrimary }: { label: string; value: string; isDark: boolean; textMuted: string; textPrimary: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '0.75rem', color: textMuted, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: '1rem', fontWeight: 700, color: textPrimary }}>{value}</div>
    </div>
  )
}
