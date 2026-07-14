// 정규화된 센서값을 보여주는 대시보드 메인 시계열 차트.
import {
  ComposedChart, Line, XAxis, YAxis,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { NormalizedPoint, SensorKey, ChartPeriod } from '../types'
import { SENSOR_CONFIGS } from '../constants'

interface Props {
  data: NormalizedPoint[]
  highlightedSensors: SensorKey[]
  isDark: boolean
  period: ChartPeriod
}

function formatTime(isoStr: string, period: ChartPeriod = '1d') {
  const d = new Date(isoStr)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  const mo = (d.getMonth() + 1).toString().padStart(2, '0')
  const day = d.getDate().toString().padStart(2, '0')

  if (period === '1d') return `${h}:${m}`
  if (period === '7d') return `${mo}/${day} ${h}시`
  return `${mo}/${day}`
}

const CHART_KEYS: Record<SensorKey, keyof NormalizedPoint> = {
  temp:     'tempN',
  hum:      'humN',
  gas:      'gasN',
  pm:       'pmN',
  pressure: 'pressureN',
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ payload: NormalizedPoint }>
  isDark: boolean
  period: ChartPeriod
}

function CustomTooltip({ active, payload, isDark, period }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{
      background: isDark ? '#1e293b' : '#fff',
      border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
      borderRadius: 8,
      padding: '10px 14px',
      fontSize: '0.8rem',
      lineHeight: 1.8,
      color: isDark ? '#f1f5f9' : '#0f172a',
      boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{formatTime(d.t, period)}</div>
      {SENSOR_CONFIGS.map(cfg => (
        <div key={cfg.key} style={{ color: cfg.color }}>
          {cfg.label}: <b>{d[cfg.key]}{cfg.unit}</b>
        </div>
      ))}
    </div>
  )
}

export function SensorChart({ data, highlightedSensors, isDark, period }: Props) {
  const gridColor = isDark ? '#1e3a5f' : '#e2e8f0'
  const axisColor = isDark ? '#475569' : '#94a3b8'

  // thin data for performance/readability (target ~60 rendered points regardless of period)
  const thinFactor = Math.max(1, Math.floor(data.length / 60))
  const thinned = data.filter((_, i) => i % thinFactor === 0)

  const getSensorLineOpacity = (key: SensorKey) => {
    if (highlightedSensors.length > 0 && !highlightedSensors.includes(key)) return 0.25
    return 1
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={thinned} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
        {[0, 25, 50, 75, 100].map(v => (
          <ReferenceLine key={v} y={v} stroke={gridColor} strokeDasharray="4 4" />
        ))}

        <XAxis
          dataKey="t"
          tickFormatter={(t: string) => formatTime(t, period)}
          interval={Math.floor(thinned.length / 6)}
          tick={{ fontSize: 11, fill: axisColor }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tick={{ fontSize: 11, fill: axisColor }}
          axisLine={false}
          tickLine={false}
        />

        <Tooltip
          content={(props) => (
            <CustomTooltip
              active={props.active}
              payload={props.payload as unknown as Array<{ payload: NormalizedPoint }>}
              isDark={isDark}
              period={period}
            />
          )}
        />

        {/* 5개 측정값 정규화 선 */}
        {SENSOR_CONFIGS.map(cfg => (
          <Line
            key={cfg.key}
            type="monotone"
            dataKey={CHART_KEYS[cfg.key]}
            stroke={cfg.color}
            strokeWidth={1.8}
            opacity={getSensorLineOpacity(cfg.key)}
            dot={false}
            isAnimationActive={false}
            style={{ transition: 'opacity 0.25s' }}
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
