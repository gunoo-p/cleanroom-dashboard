// 필터 잔여 수명·교체 예상 시점을 요약하는 카드.
import { Panel } from './Panel'
import { Badge } from './Badge'
import { COLORS } from '../config'
import type { FilterReplacementView } from '../deriveAnalysis'

const STATUS_LABELS = { normal: '정상', warning: '교체 권장', danger: '즉시 교체 필요' } as const

interface Props {
  data: FilterReplacementView
  isDark: boolean
}

export function FilterReplacementCard({ data, isDark }: Props) {
  const textMuted = isDark ? '#94a3b8' : '#64748b'
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a'
  const trackBg = isDark ? '#0f172a' : '#f1f5f9'
  const barColor = data.status === 'danger' ? COLORS.danger : data.status === 'warning' ? COLORS.warning : COLORS.normal
  const changeSign = data.changeVsLastWeek >= 0 ? '+' : ''
  const changeArrow = data.changeVsLastWeek >= 0 ? '↑' : '↓'

  return (
    <Panel
      title="필터 교체 예측"
      isDark={isDark}
      badge={<Badge label={STATUS_LABELS[data.status]} severity={data.status} isDark={isDark} />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%', justifyContent: 'center' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: textMuted, marginBottom: 4 }}>
            <span>필터 잔여 수명</span>
            <span>{data.remainingLifePct.toFixed(0)}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 999, background: trackBg, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${data.remainingLifePct}%`, background: barColor, transition: 'width 0.3s' }} />
          </div>
        </div>

        <div>
          <div style={{ color: textMuted, fontSize: '0.72rem', marginBottom: 2 }}>현재 PM 평균</div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: textPrimary }}>
            {data.currentAvg.toFixed(1)} µg/m³
            <span style={{ fontSize: '0.78rem', fontWeight: 600, marginLeft: 8, color: data.changeVsLastWeek >= 0 ? COLORS.danger : COLORS.normal }}>
              1주전 대비 {changeSign}{data.changeVsLastWeek.toFixed(1)} {changeArrow}
            </span>
          </div>
        </div>

        <div>
          <div style={{ color: textMuted, fontSize: '0.72rem', marginBottom: 2 }}>교체 예상 시점</div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: textPrimary }}>
            {data.etaDays != null ? `약 D+${Math.ceil(data.etaDays)}일` : '해당 없음'}
          </div>
        </div>
      </div>
    </Panel>
  )
}
