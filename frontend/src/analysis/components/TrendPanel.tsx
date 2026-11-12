// 센서 이동평균 추세를 보여주는 차트 패널(설비 이상/공기질/차압 추세용).
// 확대 상태에서는 차트 아래에 현재값·변화율·위험임계 도달 예상을 함께 보여준다.
import { Panel } from './Panel'
import { Badge } from './Badge'
import { TrendChart, type TrendChartProps } from './TrendChart'
import { StatStrip } from './StatStrip'
import { formatEta, formatRate } from '../format'

interface Props extends TrendChartProps {
  title: string
  risingLabel: string
  onClick?: () => void
}

export function TrendPanel({ title, risingLabel, onClick, ...chart }: Props) {
  const { data, unit, expanded } = chart

  return (
    <Panel
      title={title}
      badge={data.isRising ? <Badge label={risingLabel} severity="danger" /> : undefined}
      onClick={onClick}
      expanded={expanded}
    >
      <div className="trend-chart">
        <TrendChart {...chart} />
      </div>
      {expanded && (
        <StatStrip
          items={[
            { label: '현재값', value: `${data.latestValue.toFixed(1)}${unit}` },
            { label: '변화율', value: formatRate(data.ratePerHour, unit) },
            { label: '위험임계 도달 예상', value: formatEta(data.etaHours) },
          ]}
        />
      )}
    </Panel>
  )
}
