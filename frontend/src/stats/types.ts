// 통계(분석) 탭에서 쓰는 센서 데이터 타입 정의 (chart 모듈과 별개로 관리).
import type { SensorPoint as ChartSensorPoint, SensorKey as ChartSensorKey } from '../chart/types'

// 분석 탭은 기압(대시보드 차트 전용 파생값)을 다루지 않으므로 chart의 센서 종류에서 제외한다.
export type SensorKey = Exclude<ChartSensorKey, 'pressure'>
export type SensorPoint = Omit<ChartSensorPoint, 'pressure'>

// 서버에서 원시 시계열만 내려주고, 파생 지표(이동평균·변화율·상관계수 등)는
// 프론트에서 계산한다. 백엔드 연동 후 값이 바뀌어도 이 계약은 유지된다.
export interface AnalysisData {
  device_id: string
  points: SensorPoint[]
}

export type Severity = 'normal' | 'warning' | 'danger'
