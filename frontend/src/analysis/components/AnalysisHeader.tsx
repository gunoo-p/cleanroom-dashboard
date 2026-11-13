// 통계 탭 상단: 구역·기간 선택 툴바와 탭 제목.
import type { Zone } from '../../shared/zone'
import { ZoneSelector } from '../../shared/ZoneSelector'
import { PeriodSelector } from '../../dashboard/components/PeriodSelector'
import { LABELS, PERIOD_OPTIONS } from '../config'
import type { AnalysisPeriod } from '../types'

interface Props {
  zone: Zone
  onZoneChange: (zone: Zone) => void
  period: AnalysisPeriod
  onPeriodChange: (period: AnalysisPeriod) => void
  deviceId?: string
  isDark: boolean
}

export function AnalysisHeader({ zone, onZoneChange, period, onPeriodChange, deviceId, isDark }: Props) {
  return (
    <header className="analysis-header">
      <div className="analysis-toolbar">
        <div className="analysis-toolbar__zones">
          <ZoneSelector value={zone} onChange={onZoneChange} isDark={isDark} />
        </div>
        <div className="analysis-toolbar__periods">
          <PeriodSelector value={period} options={PERIOD_OPTIONS} onChange={onPeriodChange} isDark={isDark} />
        </div>
      </div>
      <div>
        <h2 className="analysis-title">{LABELS.title}</h2>
        <p className="analysis-subtitle">
          {deviceId ? `${deviceId} · ` : ''}{LABELS.subtitle}
        </p>
      </div>
    </header>
  )
}
