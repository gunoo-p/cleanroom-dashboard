import type { SensorConfig } from './types'

export const SENSOR_CONFIGS: SensorConfig[] = [
  { key: 'temp', label: '온도',    unit: '°C',   color: '#3B82F6' },
  { key: 'hum',  label: '습도',    unit: '%',    color: '#EC4899' },
  { key: 'gas',  label: '가스',    unit: 'ppm',  color: '#8B5CF6' },
  { key: 'pm',   label: '미세입자', unit: 'µg/m³', color: '#14B8A6' },
]

export const DEFECT_COLOR = '#E0473C'

export const STATUS_COLORS = {
  normal:  { bg: '#D1FAE5', text: '#1D9E75' },
  warning: { bg: '#FEF3C7', text: '#C77A0A' },
  danger:  { bg: '#FEE2E2', text: '#E0473C' },
}

export const STATUS_LABELS = {
  normal:  '정상',
  warning: '경고',
  danger:  '위험',
}
