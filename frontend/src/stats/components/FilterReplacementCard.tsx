// 필터 잔여 수명·교체 예상 시점을 요약하는 카드. 신호원: 차압(dp).
// ⚠ 데모: 하드웨어 배관이 실제 필터 전후에 연결되기 전까지 이 값은 필터 상태와 무관한 목업이다.
import { Panel } from './Panel'
import { Badge } from './Badge'
import { COLORS, LABELS, PRESSURE_USAGE, PRESSURE_USAGE_COPY } from '../config'
import type { FilterReplacementView } from '../deriveAnalysis'

interface Props {
  data: FilterReplacementView
  isDark: boolean
}

export function FilterReplacementCard({ data, isDark }: Props) {
  const copy = PRESSURE_USAGE_COPY[PRESSURE_USAGE]
  const textMuted = isDark ? '#94a3b8' : '#64748b'
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a'
  const trackBg = isDark ? '#0f172a' : '#f1f5f9'
  const barColor = data.status === 'danger' ? COLORS.danger : data.status === 'warning' ? COLORS.warning : COLORS.normal
  const changeSign = data.changeVsLastWeek >= 0 ? '+' : ''
  const changeArrow = data.changeVsLastWeek >= 0 ? '↑' : '↓'

  return (
    <Panel
      title={copy.cardTitle}
      isDark={isDark}
      badge={<Badge label={copy.statusLabels[data.status]} severity={data.status} isDark={isDark} />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', justifyContent: 'center' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: textMuted, marginBottom: 4 }}>
            <span>{copy.lifeLabel}</span>
            <span>{data.remainingLifePct.toFixed(0)}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: trackBg, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${data.remainingLifePct}%`, background: barColor, transition: 'width 0.3s' }} />
          </div>
        </div>

        <div>
          <div style={{ color: textMuted, fontSize: '0.72rem', marginBottom: 2 }}>{copy.currentLabel}</div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: textPrimary }}>
            {data.currentAvg.toFixed(1)} {LABELS.dp.unit}
            <span style={{ fontSize: '0.78rem', fontWeight: 600, marginLeft: 8, color: data.changeVsLastWeek >= 0 ? COLORS.danger : COLORS.normal }}>
              1주전 대비 {changeSign}{data.changeVsLastWeek.toFixed(1)} {changeArrow}
            </span>
          </div>
        </div>

        <div>
          <div style={{ color: textMuted, fontSize: '0.72rem', marginBottom: 2 }}>{copy.etaLabel}</div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: textPrimary }}>
            {data.etaDays != null ? `약 D+${Math.ceil(data.etaDays)}일` : '해당 없음'}
          </div>
        </div>

        <div style={{ fontSize: '0.66rem', color: textMuted, lineHeight: 1.4 }}>
          ⚠ 데모 데이터 · 배관 위치 미확정(현재 가정: {PRESSURE_USAGE === 'filter' ? '필터 전후' : '구역간'})
        </div>
      </div>
    </Panel>
  )
}
