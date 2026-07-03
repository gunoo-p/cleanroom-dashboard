import type { SensorPoint, SensorKey } from '../chart/types'

export type { SensorKey }

// 서버에서 원시 시계열만 내려주고, 파생 지표(이동평균·변화율·상관계수 등)는
// 프론트에서 계산한다. 백엔드 연동 후 값이 바뀌어도 이 계약은 유지된다.
export interface AnalysisData {
  device_id: string
  points: SensorPoint[]
}

export type Severity = 'normal' | 'warning' | 'danger'
