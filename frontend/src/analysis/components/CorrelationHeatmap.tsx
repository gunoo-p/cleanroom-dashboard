// 센서 간 상관계수를 색상 매트릭스로 보여주는 히트맵.
import { Panel } from './Panel'
import { COLORS, SENSOR_DISPLAY } from '../config'
import type { CorrelationCell } from '../deriveAnalysis'
import type { SensorKey } from '../types'

const KEYS: SensorKey[] = ['temp', 'hum', 'gas', 'pm', 'pressure']
// 대각선(항상 1)과 대칭 중복을 빼고 아래 삼각형만 그린다.
const ROWS = KEYS.slice(1)
const COLS = KEYS.slice(0, -1)
// |r|이 이보다 작으면 사실상 무관계로 보고 회색 처리.
const WEAK_R = 0.3

// r²(결정계수)를 %로: 한쪽 변동의 몇 %를 다른 쪽으로 설명하는지. 방향(±)은 색으로만 구분.
const pct = (r: number) => `${Math.round(r * r * 100)}%`

function cellColor(r: number, isDark: boolean) {
  if (Math.abs(r) < WEAK_R) return isDark ? 'hsl(215, 15%, 22%)' : 'hsl(215, 15%, 94%)'
  const intensity = Math.min(1, Math.abs(r))
  const hue = r >= 0 ? 152 : 4
  const light = isDark ? 22 + (1 - intensity) * 18 : 96 - intensity * 46
  return `hsl(${hue}, 55%, ${light}%)`
}

function cellTextColor(r: number, isDark: boolean) {
  if (Math.abs(r) < WEAK_R) return isDark ? '#64748b' : '#94a3b8'
  return Math.abs(r) > 0.55 ? '#ffffff' : (isDark ? '#f1f5f9' : '#0f172a')
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

const labelOf = (k: SensorKey) => SENSOR_DISPLAY[k].label

interface Props {
  matrix: CorrelationCell[]
  isDark: boolean
  onClick?: () => void
  expanded?: boolean
}

export function CorrelationHeatmap({ matrix, isDark, onClick, expanded }: Props) {
  const cellOf = (row: SensorKey, col: SensorKey) => matrix.find(c => c.row === row && c.col === col)?.r ?? 0

  return (
    <Panel title="센서 간 상관계수 매트릭스" onClick={onClick} expanded={expanded}>
      <div className="heatmap">
        <div className="heatmap__main">
          <div className="heatmap__grid" role="table" aria-label="센서 간 상관계수">
            <div className="heatmap__row" role="row">
              <div role="columnheader" />
              {COLS.map(k => (
                <div key={k} className="heatmap__label heatmap__label--col" role="columnheader">{labelOf(k)}</div>
              ))}
            </div>
            {ROWS.map((row, ri) => (
              <div key={row} className="heatmap__row" role="row">
                <div className="heatmap__label" role="rowheader">{labelOf(row)}</div>
                {COLS.map((col, ci) => {
                  if (ci === ri + 1) {
                    return (
                      <div
                        key={`${row}-${col}`}
                        className="heatmap__cell"
                        role="cell"
                        title={`${labelOf(row)} × ${labelOf(col)}: 자기 자신(항상 100%)`}
                        style={{ color: isDark ? '#475569' : '#cbd5e1' }}
                      >
                        —
                      </div>
                    )
                  }
                  if (ci > ri) return <div key={`${row}-${col}`} role="cell" />
                  const r = cellOf(row, col)
                  return (
                    <div
                      key={`${row}-${col}`}
                      className="heatmap__cell"
                      role="cell"
                      title={`${labelOf(row)} × ${labelOf(col)}: 설명력 ${pct(r)} (r = ${r.toFixed(2)})`}
                      style={{ background: cellColor(r, isDark), color: cellTextColor(r, isDark) }}
                    >
                      {pct(r)}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          <div className="heatmap__scale" aria-hidden>
            <span>양(+)</span>
            <div
              className="heatmap__scale-bar"
              style={{ background: `linear-gradient(to bottom, ${cellColor(1, isDark)}, ${cellColor(0, isDark)}, ${cellColor(-1, isDark)})` }}
            />
            <span>음(−)</span>
          </div>
        </div>

        {expanded && (
          <div className="heatmap__top-pairs">
            {topPairs(matrix, 3).map(c => (
              <div key={`${c.row}-${c.col}`} className="heatmap__pair">
                <div className="heatmap__pair-label">{labelOf(c.row)} × {labelOf(c.col)}</div>
                <div className="heatmap__pair-value" style={{ color: c.r >= 0 ? COLORS.normal : COLORS.danger }}>
                  {pct(c.r)} <small>(r = {c.r.toFixed(2)})</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Panel>
  )
}
