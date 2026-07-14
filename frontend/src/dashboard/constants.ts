// 대시보드 탭의 센서 설정·상태 색상·기간 옵션 등 상수 모음.
import type { SensorConfig, ChartPeriod } from './types'

export const SENSOR_CONFIGS: SensorConfig[] = [
  { key: 'temp',     label: '온도',    unit: '°C',   color: '#3B82F6' },
  { key: 'hum',      label: '습도',    unit: '%',    color: '#EC4899' },
  { key: 'gas',      label: '가스',    unit: '',  color: '#8B5CF6' },
  { key: 'pm',       label: '공기질', unit: '', color: '#14B8A6' },
  { key: 'pressure', label: '차압',    unit: 'Pa',   color: '#F59E0B' },
]

export const STATUS_COLORS = {
  normal:  { bg: '#D1FAE5', text: '#1D9E75' },
  caution: { bg: '#FEF9C3', text: '#A16207' },
  warning: { bg: '#FEF3C7', text: '#C77A0A' },
  danger:  { bg: '#FEE2E2', text: '#E0473C' },
}

export const STATUS_LABELS = {
  normal:  '정상',
  caution: '주의',
  warning: '경고',
  danger:  '중단',
}

export interface PeriodOption {
  key: ChartPeriod
  label: string
  days: number
  intervalMinutes: number
}

export const PERIOD_OPTIONS: PeriodOption[] = [
  { key: '1d',  label: '1일',   days: 1,   intervalMinutes: 1 },
  { key: '7d',  label: '1주일', days: 7,   intervalMinutes: 60 },
  { key: '30d', label: '1개월', days: 30,  intervalMinutes: 240 },
  { key: '6m',  label: '6개월', days: 182, intervalMinutes: 1440 },
  { key: '1y',  label: '1년',   days: 365, intervalMinutes: 1440 },
]
