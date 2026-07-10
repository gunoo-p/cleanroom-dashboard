// 센서 간 상관계수를 색상 매트릭스로 보여주는 히트맵.
import { Fragment } from 'react'
import { Panel } from './Panel'
import { SENSOR_DISPLAY } from '../config'
import type { CorrelationCell } from '../deriveAnalysis'
import type { SensorKey } from '../types'

const KEYS: SensorKey[] = ['temp', 'hum', 'gas', 'pm', 'pressure']

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
  onClick?: () => void
  expanded?: boolean
}

// 대각선(자기 자신)과 대칭쌍 중복을 제외하고, |r|이 큰 순서로 상위 n개.
function topPairs(matrix: CorrelationCell[], n: number) {
  const seen = new Set<string>()
  const pairs: CorrelationCell[] = []
  for (const c of matrix) {
    if (c.row === c.col) continue
    const key = [c.row, c.col].sort().join('-')
    if (seen.has(key)) continue
    seen.add(key)
    pairs.push(c)
  }
  return pairs.sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).slice(0, n)
}

export function CorrelationHeatmap({ matrix, isDark, onClick, expanded }: Props) {
  const labelOf = (k: SensorKey) => SENSOR_DISPLAY[k].label
  const cellOf = (row: SensorKey, col: SensorKey) => matrix.find(c => c.row === row && c.col === col)!.r
  const textMuted = isDark ? '#94a3b8' : '#64748b'
  const labelFontSize = expanded ? '0.85rem' : '0.68rem'
  const cellFontSize = expanded ? '1.05rem' : '0.7rem'

  return (
    <Panel title="센서 간 상관계수 매트릭스" isDark={isDark} onClick={onClick} expanded={expanded}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 0 }}>
        {/* 셀 높이는 컬럼 폭에서 파생되는 aspect-ratio 대신, 부모 높이를 벗어날 수 없는
            grid의 1fr 행으로 고정한다(브라우저 확대/축소 배율에 따라 aspect-ratio 반올림이
            누적되어 박스 높이를 넘어서는 문제 방지). */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `56px repeat(${KEYS.length}, 1fr)`,
          gridTemplateRows: `auto repeat(${KEYS.length}, 1fr)`,
          gap: 4,
          flex: 1,
          height: '100%',
          minHeight: 0,
        }}>
          <div />
          {KEYS.map(k => (
            <div key={k} style={{ fontSize: labelFontSize, color: textMuted, textAlign: 'center' }}>{labelOf(k)}</div>
          ))}
          {KEYS.map(row => (
            <Fragment key={row}>
              <div style={{ fontSize: labelFontSize, color: textMuted, display: 'flex', alignItems: 'center' }}>{labelOf(row)}</div>
              {KEYS.map(col => {
                const r = cellOf(row, col)
                return (
                  <div
                    key={`${row}-${col}`}
                    title={`${labelOf(row)} × ${labelOf(col)}: ${r.toFixed(2)}`}
                    style={{
                      height: '100%',
                      width: '100%',
                      background: cellColor(r, isDark),
                      color: cellTextColor(r, isDark),
                      borderRadius: 6,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: cellFontSize,
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '80%', fontSize: expanded ? '0.78rem' : '0.65rem', color: textMuted }}>
          <span>1.00</span>
          <div style={{ flex: 1, width: expanded ? 16 : 10, borderRadius: 6, margin: '4px 0', background: `linear-gradient(to bottom, ${cellColor(1, isDark)}, ${cellColor(0, isDark)}, ${cellColor(-1, isDark)})` }} />
          <span>-1.00</span>
        </div>
      </div>

      {expanded && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 28, flexShrink: 0, paddingTop: 4, borderTop: `1px solid ${isDark ? '#334155' : '#e2e8f0'}` }}>
          {topPairs(matrix, 3).map(c => (
            <div key={`${c.row}-${c.col}`} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.78rem', color: textMuted, marginBottom: 2 }}>{labelOf(c.row)} × {labelOf(c.col)}</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: c.r >= 0 ? '#1D9E75' : '#E0473C' }}>
                r = {c.r.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </Panel>
  )
}
