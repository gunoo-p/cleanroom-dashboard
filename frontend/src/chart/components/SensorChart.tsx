import {
  ComposedChart, Line, Area, XAxis, YAxis,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { NormalizedPoint, FocusMode, SensorKey } from '../types'
import { SENSOR_CONFIGS, DEFECT_COLOR } from '../constants'

interface Props {
  data: NormalizedPoint[]
  focusMode: FocusMode
  highlightedSensor: SensorKey | null
  isDark: boolean
}

function formatTime(isoStr: string) {
  const d = new Date(isoStr)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

const CHART_KEYS: Record<SensorKey, keyof NormalizedPoint> = {
  temp: 'tempN',
  hum:  'humN',
  gas:  'gasN',
  pm:   'pmN',
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ payload: NormalizedPoint }>
  isDark: boolean
}

function CustomTooltip({ active, payload, isDark }: CustomTooltipProps) {
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
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{formatTime(d.t)}</div>
      {SENSOR_CONFIGS.map(cfg => (
        <div key={cfg.key} style={{ color: cfg.color }}>
          {cfg.label}: <b>{d[cfg.key]}{cfg.unit}</b>
        </div>
      ))}
      <div style={{ color: DEFECT_COLOR, marginTop: 4 }}>
        불량률: <b>{d.defect_rate.toFixed(1)}%</b>
      </div>
    </div>
  )
}

export function SensorChart({ data, focusMode, highlightedSensor, isDark }: Props) {
  const sensorOpacity = focusMode === 'sensors' ? 1 : 0.16
  const defectOpacity = focusMode === 'defect' ? 1 : 0.3
  const defectStroke = focusMode === 'defect' ? 3 : 1.5
  const showDefectFill = focusMode === 'defect'

  const gridColor = isDark ? '#1e3a5f' : '#e2e8f0'
  const axisColor = isDark ? '#475569' : '#94a3b8'

  // thin data for performance (show every 3rd point = 30-min intervals)
  const thinned = data.filter((_, i) => i % 3 === 0)

  const getSensorLineOpacity = (key: SensorKey) => {
    if (highlightedSensor && highlightedSensor !== key) return sensorOpacity * 0.25
    return sensorOpacity
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={thinned} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
        {[0, 25, 50, 75, 100].map(v => (
          <ReferenceLine key={v} y={v} stroke={gridColor} strokeDasharray="4 4" />
        ))}

        <XAxis
          dataKey="t"
          tickFormatter={formatTime}
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
              payload={props.payload as Array<{ payload: NormalizedPoint }>}
              isDark={isDark}
            />
          )}
        />

        {/* 불량률 위험대 (70% 이상) 면 */}
        {showDefectFill && (
          <ReferenceLine y={70} stroke={DEFECT_COLOR} strokeOpacity={0.4} strokeDasharray="6 3" />
        )}

        {/* 불량률 Area + Line */}
        <Area
          type="monotone"
          dataKey="defect_rate"
          stroke={DEFECT_COLOR}
          strokeWidth={defectStroke}
          strokeDasharray={focusMode === 'sensors' ? '6 3' : '0'}
          fill={DEFECT_COLOR}
          fillOpacity={showDefectFill ? 0.12 : 0}
          opacity={defectOpacity}
          style={{ transition: 'opacity 0.25s, stroke-width 0.25s' }}
          dot={false}
          isAnimationActive={false}
        />

        {/* 4개 측정값 정규화 선 */}
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
