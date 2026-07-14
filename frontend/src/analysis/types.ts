// 통계(분석) 탭에서 쓰는 센서 데이터 타입 정의 (dashboard 모듈과 별개로 관리).
import type { SensorPoint as ChartSensorPoint, SensorKey as ChartSensorKey } from '../dashboard/types'

// 분석 탭은 온도·습도·가스·공기질(dashboard의 'pm' 키)·차압(dashboard의 'pressure' 키)까지 dashboard와 동일한 5종 센서를 그대로 쓴다.
export type SensorKey = ChartSensorKey
export type SensorPoint = ChartSensorPoint

// 서버에서 원시 시계열만 내려주고, 파생 지표(이동평균·변화율·상관계수 등)는
// 프론트에서 계산한다. 백엔드 연동 후 값이 바뀌어도 이 계약은 유지된다.
export interface AnalysisData {
  device_id: string
  points: SensorPoint[]
}

export type Severity = 'normal' | 'warning' | 'danger'

// 분석 탭 조회 기간 — 대시보드 탭과 달리 이동평균·회귀 계산에 의미 있는 범위만 제공한다.
export type AnalysisPeriod = '1d' | '7d' | '30d'
