export type Status = 'normal' | 'warning' | 'danger'
export type FocusMode = 'sensors' | 'defect'

export interface SensorPoint {
  t: string
  temp: number
  hum: number
  gas: number
  pm: number
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
  }
  defect_rate_now: number
}

export interface NormalizedPoint {
  t: string
  tempN: number
  humN: number
  gasN: number
  pmN: number
  defect_rate: number
  temp: number
  hum: number
  gas: number
  pm: number
}

export type SensorKey = 'temp' | 'hum' | 'gas' | 'pm'

export interface SensorConfig {
  key: SensorKey
  label: string
  unit: string
  color: string
}
