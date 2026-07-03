import { Fragment } from 'react'
import { Panel } from './Panel'
import { SENSOR_CONFIGS } from '../../chart/constants'
import type { CorrelationCell } from '../deriveAnalysis'
import type { SensorKey } from '../types'

const KEYS: SensorKey[] = ['temp', 'hum', 'gas', 'pm']

function cellColor(r: number, isDark: boolean) {
  const intensity = Math.min(1, Math.abs(r))
  const hue = r >= 0 ? 152 : 4
  const light = isDark ? 22 + (1 - intensity) * 18 : 96 - intensity * 46
  return `hsl(${hue}, 55%, ${light}%)`
}

function cellTextColor(r: number, isDark: boolean) {
  return Math.abs(r) > 0.55 ? '#ffffff' : (isDark ? '#f1f5f9' : '#0f172a')
}

interface Props {
  matrix: CorrelationCell[]
  isDark: boolean
}

export function CorrelationHeatmap({ matrix, isDark }: Props) {
  const labelOf = (k: SensorKey) => SENSOR_CONFIGS.find(c => c.key === k)!.label
  const cellOf = (row: SensorKey, col: SensorKey) => matrix.find(c => c.row === row && c.col === col)!.r
  const textMuted = isDark ? '#94a3b8' : '#64748b'

  return (
    <Panel title="센서-불량률 상관계수 매트릭스" isDark={isDark}>
      <div style={{ display: 'flex', gap: 12, height: '100%', alignItems: 'center' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `56px repeat(${KEYS.length}, 1fr)`, gap: 4, flex: 1 }}>
          <div />
          {KEYS.map(k => (
            <div key={k} style={{ fontSize: '0.68rem', color: textMuted, textAlign: 'center' }}>{labelOf(k)}</div>
          ))}
          {KEYS.map(row => (
            <Fragment key={row}>
              <div style={{ fontSize: '0.68rem', color: textMuted, display: 'flex', alignItems: 'center' }}>{labelOf(row)}</div>
              {KEYS.map(col => {
                const r = cellOf(row, col)
                return (
                  <div
                    key={`${row}-${col}`}
                    title={`${labelOf(row)} × ${labelOf(col)}: ${r.toFixed(2)}`}
                    style={{
                      aspectRatio: '1 / 1',
                      background: cellColor(r, isDark),
                      color: cellTextColor(r, isDark),
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                    }}
                  >
                    {r.toFixed(2)}
                  </div>
                )
              })}
            </Fragment>
          ))}
        </div>

        {/* 컬러바 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '80%', fontSize: '0.65rem', color: textMuted }}>
          <span>1.00</span>
          <div style={{ flex: 1, width: 10, borderRadius: 6, margin: '4px 0', background: `linear-gradient(to bottom, ${cellColor(1, isDark)}, ${cellColor(0, isDark)}, ${cellColor(-1, isDark)})` }} />
          <span>-1.00</span>
        </div>
      </div>
    </Panel>
  )
}
