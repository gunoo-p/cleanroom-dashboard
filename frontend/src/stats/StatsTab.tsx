import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { TabProps } from '../tabs'
import type { AnalysisData } from './types'
import { fetchAnalysis } from './api'
import { generateAnalysisMockData } from './mockData'
import { deriveAnalysis } from './deriveAnalysis'
import { THRESHOLDS, LABELS, COLORS } from './config'
import { TrendPanel } from './components/TrendPanel'
import { EquipmentAnomalyCard } from './components/EquipmentAnomalyCard'
import { PmDailyPanel } from './components/PmDailyPanel'
import { PmWeeklyPanel } from './components/PmWeeklyPanel'
import { FilterReplacementCard } from './components/FilterReplacementCard'
import { HumidityDefectScatterPanel } from './components/HumidityDefectScatterPanel'
import { CorrelationHeatmap } from './components/CorrelationHeatmap'
import { YieldCorrelationCard } from './components/YieldCorrelationCard'

const MOCK_DATA: AnalysisData = generateAnalysisMockData()

function AnalysisRow({ children }: { children: ReactNode }) {
  return (
    <div className="stats-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16, alignItems: 'stretch' }}>
      {children}
    </div>
  )
}

export function StatsTab({ isDark }: TabProps) {
  const { data: current = MOCK_DATA } = useQuery<AnalysisData>({
    queryKey: ['analysis'],
    queryFn: () => fetchAnalysis(MOCK_DATA.device_id),
    refetchInterval: 60_000,
    retry: false,
    placeholderData: MOCK_DATA,
  })

  const view = useMemo(() => deriveAnalysis(current), [current])

  const bg = isDark ? '#0f172a' : '#f8fafc'
  const textMuted = isDark ? '#64748b' : '#94a3b8'

  return (
    <div style={{
      minHeight: '100vh',
      background: bg,
      color: isDark ? '#f1f5f9' : '#0f172a',
      fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
      padding: '20px 24px',
      boxSizing: 'border-box',
    }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{LABELS.title}</div>
        <div style={{ fontSize: '0.78rem', color: textMuted, marginTop: 2 }}>{LABELS.subtitle}</div>
      </div>

      {/* 행 1: 설비 이상 예측 */}
      <AnalysisRow>
        <TrendPanel
          title="① 온도 이동평균 추세"
          unit="°C"
          data={view.equipmentAnomaly.temp}
          isDark={isDark}
          rawColor={COLORS.tempRaw}
          maColor={COLORS.tempMA}
          warning={THRESHOLDS.temp.warning}
          danger={THRESHOLDS.temp.danger}
          axisMin={THRESHOLDS.temp.axisMin}
          axisMax={THRESHOLDS.temp.axisMax}
          risingLabel="상승 추세 감지"
        />
        <TrendPanel
          title="가스 농도 이동평균 추세"
          unit="ppm"
          data={view.equipmentAnomaly.gas}
          isDark={isDark}
          rawColor={COLORS.gasRaw}
          maColor={COLORS.gasMA}
          warning={THRESHOLDS.gas.warning}
          danger={THRESHOLDS.gas.danger}
          axisMin={THRESHOLDS.gas.axisMin}
          axisMax={THRESHOLDS.gas.axisMax}
          risingLabel="동반 상승 패턴"
        />
        <EquipmentAnomalyCard data={view.equipmentAnomaly} isDark={isDark} />
      </AnalysisRow>

      {/* 행 2: 필터 교체 예측 */}
      <AnalysisRow>
        <PmDailyPanel daily={view.filterReplacement.daily} isDark={isDark} />
        <PmWeeklyPanel weekly={view.filterReplacement.weekly} isDark={isDark} />
        <FilterReplacementCard data={view.filterReplacement} isDark={isDark} />
      </AnalysisRow>

      {/* 행 3: 수율 상관관계 */}
      <AnalysisRow>
        <HumidityDefectScatterPanel data={view.yieldCorrelation} isDark={isDark} />
        <CorrelationHeatmap matrix={view.yieldCorrelation.matrix} isDark={isDark} />
        <YieldCorrelationCard data={view.yieldCorrelation} isDark={isDark} />
      </AnalysisRow>
    </div>
  )
}
