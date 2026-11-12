// 통계(분석) 탭의 메인 컴포넌트: 데이터 조회 + 헤더 + 패널 그리드 + 확대 오버레이를 조합한다.
// 각 패널의 구성은 components/AnalysisPanel.tsx, 스타일은 analysis.css에서 관리한다.
import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { TabProps } from '../tabs'
import type { AnalysisData, AnalysisPeriod } from './types'
import { fetchAnalysis } from './api'
import { deriveAnalysis } from './deriveAnalysis'
import { PERIOD_OPTIONS } from './config'
import { AnalysisHeader } from './components/AnalysisHeader'
import { AnalysisPanel, PANEL_ROWS, type PanelKey } from './components/AnalysisPanel'
import { PanelExpandOverlay } from './components/PanelExpandOverlay'
import { zoneDeviceId } from '../shared/zone'
import './analysis.css'

interface ExpandedState {
  key: PanelKey
  sourceRect: DOMRect
  targetRect: { top: number; left: number; width: number; height: number }
}

// 그리드가 스크롤로 화면 밖까지 이어질 수 있으므로, 확대 영역은 그리드 중 "지금 화면에 보이는 부분"으로 자른다.
// 잘린 쪽에는 여백을 둬서 확대 패널의 닫기 버튼(모서리 바깥으로 살짝 튀어나옴)이 화면 밖으로 나가지 않게 한다.
const CLIP_MARGIN = 20

function visiblePart(el: HTMLElement) {
  const r = el.getBoundingClientRect()
  const scroller = el.closest('main')?.getBoundingClientRect()
  const viewTop = Math.max(scroller?.top ?? 0, 0)
  const viewBottom = Math.min(scroller?.bottom ?? window.innerHeight, window.innerHeight)
  const top = r.top < viewTop + CLIP_MARGIN ? viewTop + CLIP_MARGIN : r.top
  const bottom = r.bottom > viewBottom - CLIP_MARGIN ? viewBottom - CLIP_MARGIN : r.bottom
  return { top, left: r.left, width: r.width, height: Math.max(0, bottom - top) }
}

export function AnalysisTab({ isDark, zone, onZoneChange }: TabProps) {
  const deviceId = zoneDeviceId(zone)
  const [period, setPeriod] = useState<AnalysisPeriod>('1d')
  const periodOption = PERIOD_OPTIONS.find(o => o.key === period)!
  const [expanded, setExpanded] = useState<ExpandedState | null>(null)
  const panelRefs = useRef<Partial<Record<PanelKey, HTMLDivElement | null>>>({})
  const gridRef = useRef<HTMLDivElement | null>(null)

  const { data: current, isError } = useQuery<AnalysisData>({
    queryKey: ['analysis', deviceId, period],
    queryFn: () => fetchAnalysis(deviceId, periodOption),
    refetchInterval: 60_000,
    retry: false,
  })

  const view = useMemo(() => current ? deriveAnalysis(current) : null, [current])

  function openPanel(key: PanelKey) {
    const el = panelRefs.current[key]
    const grid = gridRef.current
    if (!el || !grid) return
    setExpanded({ key, sourceRect: el.getBoundingClientRect(), targetRect: visiblePart(grid) })
  }

  const closePanel = useCallback(() => setExpanded(null), [])

  return (
    <div className="analysis-tab" data-theme={isDark ? 'dark' : 'light'}>
      <AnalysisHeader
        zone={zone}
        onZoneChange={onZoneChange}
        period={period}
        onPeriodChange={setPeriod}
        deviceId={current?.device_id}
        isDark={isDark}
      />

      {!view ? (
        <div className="analysis-status" role="status">
          <span>{isError ? '⚠ 연결 실패' : '불러오는 중...'}</span>
          {isError && <span className="analysis-status__detail">{deviceId} 장치의 데이터를 가져올 수 없습니다.</span>}
        </div>
      ) : (
        <div ref={gridRef} className="analysis-grid">
          {PANEL_ROWS.map(row => (
            <div key={row.join('-')} className="analysis-row" style={{ '--an-cols': row.length } as CSSProperties}>
              {row.map(key => (
                // 위치 측정용 래퍼. 확대 중엔 자리만 남기고 숨겨서, 그 위에서 자라나는
                // 같은 패널의 확대 오버레이와 원본이 겹쳐 보이지 않게 한다.
                <div
                  key={key}
                  ref={el => { panelRefs.current[key] = el }}
                  className={`analysis-slot${expanded?.key === key ? ' is-hidden' : ''}`}
                >
                  <AnalysisPanel
                    panelKey={key}
                    view={view}
                    isDark={isDark}
                    onClick={expanded ? undefined : () => openPanel(key)}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {expanded && view && (
        <PanelExpandOverlay sourceRect={expanded.sourceRect} targetRect={expanded.targetRect} onClosed={closePanel}>
          <AnalysisPanel panelKey={expanded.key} view={view} isDark={isDark} expanded />
        </PanelExpandOverlay>
      )}
    </div>
  )
}
