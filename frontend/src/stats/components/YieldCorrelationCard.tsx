// 불량률과 상관관계가 높은 센서 top3와 습도 임계 배너를 보여주는 카드.
import { Panel } from './Panel'
import { COLORS } from '../config'
import type { YieldCorrelationView } from '../deriveAnalysis'

interface Props {
  data: YieldCorrelationView
  isDark: boolean
}

export function YieldCorrelationCard({ data, isDark }: Props) {
  const textMuted = isDark ? '#94a3b8' : '#64748b'
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a'
  const trackBg = isDark ? '#0f172a' : '#f1f5f9'

  return (
    <Panel title="수율 상관관계" isDark={isDark}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%', justifyContent: 'center' }}>
        <div>
          <div style={{ color: textMuted, fontSize: '0.72rem', marginBottom: 8 }}>불량률 상관 Top 3</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.top3.map(item => (
              <div key={item.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 3 }}>
                  <span style={{ color: textPrimary }}>{item.label}</span>
                  <span style={{ fontWeight: 700, color: item.color }}>r = {item.r.toFixed(2)}</span>
                </div>
                <div style={{ height: 6, borderRadius: 999, background: trackBg, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, Math.abs(item.r) * 100)}%`, background: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {data.bannerMultiplier != null && (
          <div style={{
            background: isDark ? `${COLORS.normal}22` : '#D1FAE5',
            color: COLORS.normal,
            borderRadius: 8,
            padding: '10px 12px',
            fontSize: '0.78rem',
            fontWeight: 600,
            lineHeight: 1.5,
          }}>
            습도 임계치 초과 시 불량률 평균 {data.bannerMultiplier.toFixed(1)}배 증가
          </div>
        )}
      </div>
    </Panel>
  )
}
