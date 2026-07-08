// 대시보드(차트) 탭에서 쓰는 센서 데이터 타입 정의.
export type Status = 'normal' | 'warning' | 'danger'
export type FocusMode = 'sensors' | 'defect'
export type ChartPeriod = '1d' | '7d' | '30d' | '6m' | '1y'

export interface SensorPoint {
  t: string
  temp: number
  hum: number
  gas: number
  pm: number
  pressure: number
  defect_rate: number
}

export interface SensorMeta {
  value: number
  unit: string
  status: Status
  min: number
  max: number
  avg: number
}

export interface DashboardData {
  device_id: string
  points: SensorPoint[]
  current: {
    temp: SensorMeta
    hum: SensorMeta
    gas: SensorMeta
    pm: SensorMeta
    pressure: SensorMeta
  }
  defect_rate_now: number
}

export interface NormalizedPoint {
  t: string
  tempN: number
  humN: number
  gasN: number
  pmN: number
  pressureN: number
  defect_rate: number
  temp: number
  hum: number
  gas: number
  pm: number
  pressure: number
}

export type SensorKey = 'temp' | 'hum' | 'gas' | 'pm' | 'pressure'

export interface SensorConfig {
  key: SensorKey
  label: string
  unit: string
  color: string
}
