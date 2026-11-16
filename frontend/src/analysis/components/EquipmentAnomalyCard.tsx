// 설비 이상 조짐(온도·가스 변화율, 위험임계 도달 예상 시간)을 요약하는 카드.
import { Panel } from './Panel'
import { Badge } from './Badge'
import { formatEta, formatRate } from '../format'
import type { EquipmentAnomalyView } from '../deriveAnalysis'

const STATUS_LABELS = { normal: '정상', warning: '주의 관찰', danger: '이상 조짐 감지' } as const

interface Props {
  data: EquipmentAnomalyView
  onClick?: () => void
  expanded?: boolean
}

// 값이 여러 줄일 때(예: 온도/가스 ETA) 한 줄에 이어 붙이지 않고 줄 단위로 쌓아서
// 좁은 카드에서도 문장 중간이 잘리거나 박스 밖으로 넘치지 않게 한다.
function Metric({ label, lines }: { label: string; lines: string[] }) {
  return (
    <div className="anomaly-metric">
      <dt className="anomaly-metric__label">{label}</dt>
      <dd className="anomaly-metric__value">
        {lines.length === 1 ? lines[0] : (
          <span className="anomaly-metric__lines">
            {lines.map(line => <span key={line}>{line}</span>)}
          </span>
        )}
      </dd>
    </div>
  )
}

export function EquipmentAnomalyCard({ data, onClick, expanded }: Props) {
  return (
    <Panel
      title="설비 이상 조짐"
      badge={<Badge label={STATUS_LABELS[data.status]} severity={data.status} />}
      onClick={onClick}
      expanded={expanded}
    >
      <dl className="anomaly-metrics">
        <Metric label="온도 변화율" lines={[formatRate(data.temp.ratePerHour, '°C')]} />
        <Metric label="가스 변화율" lines={[formatRate(data.gas.ratePerHour, 'ppm')]} />
        <Metric
          label="위험임계 도달 예상"
          lines={[`온도 ${formatEta(data.temp.etaHours)}`, `가스 ${formatEta(data.gas.etaHours)}`]}
        />
      </dl>
    </Panel>
  )
}
