// 패널 키 하나로 해당 패널을 그려주는 레지스트리.
// 그리드(작게)·확대 오버레이(크게) 양쪽에서 같은 패널을 재사용한다.
import { TrendPanel } from './TrendPanel'
import { EquipmentAnomalyCard } from './EquipmentAnomalyCard'
import { CorrelationHeatmap } from './CorrelationHeatmap'
import { THRESHOLDS, LABELS, COLORS } from '../config'
import type { AnalysisView, TrendPanelData } from '../deriveAnalysis'

export type PanelKey = 'temp' | 'gas' | 'anomaly' | 'air' | 'pressure' | 'correlation'

// 화면에 놓이는 행 구성(위→아래). 행 1: 설비 이상 예측 / 행 2: 공기질 추세 / 행 3: 환경 안정성
export const PANEL_ROWS: PanelKey[][] = [
  ['temp', 'gas', 'anomaly'],
  ['air'],
  ['pressure', 'correlation'],
]

type TrendKey = 'temp' | 'gas' | 'air' | 'pressure'

interface TrendConfig {
  title: string
  unit: string
  risingLabel: string
  rawColor: string
  maColor: string
  select: (view: AnalysisView) => TrendPanelData
}

const TREND_PANELS: Record<TrendKey, TrendConfig> = {
  temp: {
    title: '온도 이동평균 추세', unit: '°C', risingLabel: '상승 추세 감지',
    rawColor: COLORS.tempRaw, maColor: COLORS.tempMA,
    select: v => v.equipmentAnomaly.temp,
  },
  gas: {
    title: '가스 농도 이동평균 추세', unit: '', risingLabel: '동반 상승 패턴',
    rawColor: COLORS.gasRaw, maColor: COLORS.gasMA,
    select: v => v.equipmentAnomaly.gas,
  },
  air: {
    title: '공기질 이동평균 추세', unit: LABELS.air.unit, risingLabel: '상승 추세 감지',
    rawColor: COLORS.airRaw, maColor: COLORS.airMA,
    select: v => v.trends.air,
  },
  pressure: {
    title: '차압 이동평균 추세', unit: 'Pa', risingLabel: '하락 추세 감지',
    rawColor: COLORS.pressureRaw, maColor: COLORS.pressureMA,
    select: v => v.trends.pressure,
  },
}

interface Props {
  panelKey: PanelKey
  view: AnalysisView
  isDark: boolean
  onClick?: () => void
  expanded?: boolean
}

export function AnalysisPanel({ panelKey, view, isDark, onClick, expanded = false }: Props) {
  if (panelKey === 'anomaly') {
    return <EquipmentAnomalyCard data={view.equipmentAnomaly} onClick={onClick} expanded={expanded} />
  }
  if (panelKey === 'correlation') {
    return <CorrelationHeatmap matrix={view.correlationMatrix} isDark={isDark} onClick={onClick} expanded={expanded} />
  }

  const { select, ...cfg } = TREND_PANELS[panelKey]
  const t = THRESHOLDS[panelKey]
  return (
    <TrendPanel
      {...cfg}
      data={select(view)}
      isDark={isDark}
      warning={t.warning}
      danger={t.danger}
      axisMin={t.axisMin}
      axisMax={t.axisMax}
      onClick={onClick}
      expanded={expanded}
    />
  )
}
