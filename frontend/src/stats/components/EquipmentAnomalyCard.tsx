// 설비 이상 조짐(온도·가스 변화율, 위험임계 도달 예상 시간)을 요약하는 카드.
import { Panel } from './Panel'
import { Badge } from './Badge'
import type { EquipmentAnomalyView } from '../deriveAnalysis'

function formatRate(v: number, unit: string) {
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}${unit}`
}

function formatEta(hours: number | null) {
  if (hours == null) return '해당 없음'
  if (hours < 1) return `약 ${Math.round(hours * 60)}분 후`
  return `약 ${hours.toFixed(1)}시간 후`
}

const STATUS_LABELS = { normal: '정상', warning: '주의 관찰', danger: '이상 조짐 감지' } as const

interface Props {
  data: EquipmentAnomalyView
  isDark: boolean
}

export function EquipmentAnomalyCard({ data, isDark }: Props) {
  const textMuted = isDark ? '#94a3b8' : '#64748b'
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a'

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div>
      <div style={{ color: textMuted, fontSize: '0.72rem', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: textPrimary }}>{value}</div>
    </div>
  )

  return (
    <Panel
      title="설비 이상 조짐"
      isDark={isDark}
      badge={<Badge label={STATUS_LABELS[data.status]} severity={data.status} isDark={isDark} />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%', justifyContent: 'center' }}>
        <Row label="온도 변화율" value={formatRate(data.temp.ratePerHour, '°C/h')} />
        <Row label="가스 변화율" value={formatRate(data.gas.ratePerHour, 'ppm/h')} />
        <Row
          label="위험임계 도달 예상"
          value={`온도 ${formatEta(data.temp.etaHours)} · 가스 ${formatEta(data.gas.etaHours)}`}
        />
      </div>
    </Panel>
  )
}
