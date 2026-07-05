import type { SensorMeta, SensorKey } from '../types'
import { SENSOR_CONFIGS } from '../constants'
import { StatusPill } from './StatusPill'
import { Sparkline } from './Sparkline'

interface Props {
  sensorKey: SensorKey
  meta: SensorMeta
  sparkData: number[]
  highlighted: boolean
  onClick: (key: SensorKey) => void
  isDark: boolean
}

export function SensorBox({ sensorKey, meta, sparkData, highlighted, onClick, isDark }: Props) {
  const cfg = SENSOR_CONFIGS.find(c => c.key === sensorKey)!
  const dimmed = !highlighted

  return (
    <div
      onClick={() => onClick(sensorKey)}
      style={{
        background: isDark ? '#1e293b' : '#ffffff',
        border: `1.5px solid ${highlighted ? cfg.color : (isDark ? '#334155' : '#e2e8f0')}`,
        borderRadius: 12,
        padding: '14px 16px',
        cursor: 'pointer',
        opacity: dimmed ? 0.55 : 1,
        transition: 'opacity 0.25s, border-color 0.25s',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          style={{
            width: 10, height: 10, borderRadius: '50%',
            background: cfg.color, flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 600, fontSize: '0.85rem', color: isDark ? '#94a3b8' : '#64748b' }}>
          {cfg.label}
        </span>
        <StatusPill status={meta.status} isDark={isDark} />
      </div>

      <div style={{ fontSize: '1.9rem', fontWeight: 800, lineHeight: 1, marginBottom: 4, color: isDark ? '#f1f5f9' : '#0f172a' }}>
        {meta.value}
        <span style={{ fontSize: '0.9rem', fontWeight: 500, marginLeft: 4, color: isDark ? '#94a3b8' : '#64748b' }}>
          {meta.unit}
        </span>
      </div>

      <Sparkline data={sparkData} color={cfg.color} />

      <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: '0.72rem', color: isDark ? '#64748b' : '#94a3b8' }}>
        <span>최저 {meta.min}</span>
        <span>최고 {meta.max}</span>
        <span>평균 {meta.avg}</span>
      </div>
    </div>
  )
}
