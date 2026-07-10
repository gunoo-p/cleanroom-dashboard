// 통계(분석) 탭의 메인 컴포넌트: 설비 이상·공기질 추세·환경 안정성(기압/상관관계) 행을 조합한다.
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { TabProps } from '../tabs'
import type { AnalysisData, AnalysisPeriod } from './types'
import { fetchAnalysis } from './api'
import { deriveAnalysis, type AnalysisView } from './deriveAnalysis'
import { THRESHOLDS, LABELS, COLORS, PERIOD_OPTIONS } from './config'
import { TrendPanel } from './components/TrendPanel'
import { EquipmentAnomalyCard } from './components/EquipmentAnomalyCard'
import { CorrelationHeatmap } from './components/CorrelationHeatmap'
import { PanelExpandOverlay } from './components/PanelExpandOverlay'
import { PeriodSelector } from '../dashboard/components/PeriodSelector'
import { ZoneSelector } from '../shared/ZoneSelector'
import { zoneDeviceId } from '../shared/zone'

function AnalysisRow({ columns, children }: { columns: string; children: ReactNode }) {
  return (
    <div className="stats-row" style={{
      display: 'grid',
      gridTemplateColumns: columns,
      gap: 16,
      alignItems: 'stretch',
      flex: 1,
      minHeight: 0,
    }}>
      {children}
    </div>
  )
}

type PanelKey = 'temp' | 'gas' | 'anomaly' | 'air' | 'pressure' | 'correlation'

// 그리드(작게)·확대 오버레이(크게) 양쪽에서 같은 패널을 재사용하기 위한 렌더 함수.
function renderPanel(key: PanelKey, view: AnalysisView, isDark: boolean, onClick?: () => void, expanded = false) {
  switch (key) {
    case 'temp':
      return (
        <TrendPanel
          title="온도 이동평균 추세"
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
          onClick={onClick}
          expanded={expanded}
        />
      )
    case 'gas':
      return (
        <TrendPanel
          title="가스 농도 이동평균 추세"
          unit=""
          data={view.equipmentAnomaly.gas}
          isDark={isDark}
          rawColor={COLORS.gasRaw}
          maColor={COLORS.gasMA}
          warning={THRESHOLDS.gas.warning}
          danger={THRESHOLDS.gas.danger}
          axisMin={THRESHOLDS.gas.axisMin}
          axisMax={THRESHOLDS.gas.axisMax}
          risingLabel="동반 상승 패턴"
          onClick={onClick}
          expanded={expanded}
        />
      )
    case 'anomaly':
      return <EquipmentAnomalyCard data={view.equipmentAnomaly} isDark={isDark} onClick={onClick} expanded={expanded} />
    case 'air':
      return (
        <TrendPanel
          title="공기질 이동평균 추세"
          unit={LABELS.air.unit}
          data={view.trends.air}
          isDark={isDark}
          rawColor={COLORS.airRaw}
          maColor={COLORS.airMA}
          warning={THRESHOLDS.air.warning}
          danger={THRESHOLDS.air.danger}
          axisMin={THRESHOLDS.air.axisMin}
          axisMax={THRESHOLDS.air.axisMax}
          risingLabel="상승 추세 감지"
          onClick={onClick}
          expanded={expanded}
        />
      )
    case 'pressure':
      return (
        <TrendPanel
          title="기압 이동평균 추세"
          unit="hPa"
          data={view.trends.pressure}
          isDark={isDark}
          rawColor={COLORS.pressureRaw}
          maColor={COLORS.pressureMA}
          warning={THRESHOLDS.pressure.warning}
          danger={THRESHOLDS.pressure.danger}
          axisMin={THRESHOLDS.pressure.axisMin}
          axisMax={THRESHOLDS.pressure.axisMax}
          risingLabel="하락 추세 감지"
          onClick={onClick}
          expanded={expanded}
        />
      )
    case 'correlation':
      return <CorrelationHeatmap matrix={view.correlationMatrix} isDark={isDark} onClick={onClick} expanded={expanded} />
  }
}

export function AnalysisTab({ isDark, zone, onZoneChange }: TabProps) {
  const deviceId = zoneDeviceId(zone)
  const [period, setPeriod] = useState<AnalysisPeriod>('1d')
  const periodOption = PERIOD_OPTIONS.find(o => o.key === period)!
  const [expanded, setExpanded] = useState<{ key: PanelKey; rect: DOMRect; containerRect: DOMRect } | null>(null)
  const panelRefs = useRef<Partial<Record<PanelKey, HTMLDivElement | null>>>({})
  const contentRef = useRef<HTMLDivElement | null>(null)

  const { data: current, isError } = useQuery<AnalysisData>({
    queryKey: ['analysis', deviceId, period],
    queryFn: () => fetchAnalysis(deviceId, periodOption),
    refetchInterval: 60_000,
    retry: false,
  })

  const view = useMemo(() => current ? deriveAnalysis(current) : null, [current])

  const bg = isDark ? '#0f172a' : '#f8fafc'
  const textMuted = isDark ? '#64748b' : '#94a3b8'

  function openPanel(key: PanelKey) {
    const el = panelRefs.current[key]
    const container = contentRef.current
    if (!el || !container) return
    setExpanded({ key, rect: el.getBoundingClientRect(), containerRect: container.getBoundingClientRect() })
  }

  // 그리드 안의 패널 하나를 감싸서, ref로 위치를 재고 확대 중엔 자리만 남기고 숨긴다
  // (같은 패널의 확대 오버레이가 그 위에서 자라나는 동안 원본이 겹쳐 보이지 않게).
  function gridSlot(key: PanelKey) {
    return (
      <div
        ref={el => { panelRefs.current[key] = el }}
        style={{ height: '100%', minWidth: 0, minHeight: 0, visibility: expanded?.key === key ? 'hidden' : 'visible' }}
      >
        {view && renderPanel(key, view, isDark, expanded ? undefined : () => openPanel(key))}
      </div>
    )
  }

  return (
    <div className="analysis-tab" style={{
      height: '100vh',
      background: bg,
      color: isDark ? '#f1f5f9' : '#0f172a',
      fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
      padding: '20px 24px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexShrink: 0 }}>
        <ZoneSelector value={zone} onChange={onZoneChange} isDark={isDark} />
        <PeriodSelector value={period} options={PERIOD_OPTIONS} onChange={setPeriod} isDark={isDark} />
      </div>

      <div style={{ marginBottom: 16, flexShrink: 0 }}>
        <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{LABELS.title}</div>
        <div style={{ fontSize: '0.78rem', color: textMuted, marginTop: 2 }}>
          {current ? `${current.device_id} · ` : ''}{LABELS.subtitle}
        </div>
      </div>

      {!current || !view ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flex: 1, color: textMuted, fontSize: '0.95rem', flexDirection: 'column', gap: 8,
        }}>
          <span>{isError ? '⚠ 연결 실패' : '불러오는 중...'}</span>
          {isError && <span style={{ fontSize: '0.78rem' }}>{deviceId} 장치의 데이터를 가져올 수 없습니다.</span>}
        </div>
      ) : (
      <div ref={contentRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 행 1: 설비 이상 예측 */}
      <AnalysisRow columns="1fr 1fr 1fr">
        {gridSlot('temp')}
        {gridSlot('gas')}
        {gridSlot('anomaly')}
      </AnalysisRow>

      {/* 행 2: 공기질 추세 */}
      <AnalysisRow columns="1fr">
        {gridSlot('air')}
      </AnalysisRow>

      {/* 행 3: 환경 안정성 (기압 추세 + 센서 간 상관관계) */}
      <AnalysisRow columns="1fr 1fr">
        {gridSlot('pressure')}
        {gridSlot('correlation')}
      </AnalysisRow>
      </div>
      )}

      {expanded && view && (
        <PanelExpandOverlay
          sourceRect={expanded.rect}
          containerRect={expanded.containerRect}
          isDark={isDark}
          onClosed={() => setExpanded(null)}
        >
          {renderPanel(expanded.key, view, isDark, undefined, true)}
        </PanelExpandOverlay>
      )}
    </div>
  )
}
