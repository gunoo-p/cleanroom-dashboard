// ─────────────────────────────────────────────────────────────────
// "단일 출처(single source of truth)".
// 임계치·색상·라벨·계산 파라미터를 여기 한 곳에서만 관리한다.
// 컴포넌트에는 숫자를 하드코딩하지 말고 이 파일 값을 참조할 것.
// ─────────────────────────────────────────────────────────────────
import type { AnalysisPeriod, SensorKey } from './types'

export const THRESHOLDS = {
  temp: { warning: 35, danger: 45, axisMin: 15, axisMax: 50 },
  gas: { warning: 300, danger: 500, axisMin: 0, axisMax: 500 },
  // ⚠ placeholder: 실측 지표(AQI/VOC 등)·단위·임계가 하드웨어/md로 확정되면 교체.
  air: { warning: 75, danger: 100, axisMin: 0, axisMax: 150 },
  // 기압은 낮을수록 위험(클린룸 양압 붕괴 리스크). 대시보드 탭과 동일한 값 사용.
  pressure: { warning: 1005, danger: 995, axisMin: 990, axisMax: 1030 },
}

export interface AnalysisPeriodOption {
  key: AnalysisPeriod
  label: string
  days: number
  intervalMinutes: number
}

// 조회 기간별 백엔드 요청 범위. 기간이 길어질수록 포인트 수를 억제하려고 간격도 함께 넓힌다.
export const PERIOD_OPTIONS: AnalysisPeriodOption[] = [
  { key: '1d', label: '1일', days: 1, intervalMinutes: 15 },
  { key: '7d', label: '1주일', days: 7, intervalMinutes: 60 },
  { key: '30d', label: '1개월', days: 30, intervalMinutes: 240 },
]

export const TREND = {
  movingAverageWindow: 6,
  // 변화율(기울기)을 계산할 때 사용하는 "최근 구간" 길이
  slopeWindowHours: 8,
  // 이 기울기를 넘으면 "상승 추세 감지" / "동반 상승 패턴" 배지 표시 (기압은 하락 방향 크기)
  risingSlopePerHour: { temp: 0.6, gas: 8, air: 3, pressure: 1 },
}

export const COLORS = {
  tempRaw: '#94a3b8',
  tempMA: '#3B82F6',
  gasRaw: '#94a3b8',
  gasMA: '#14B8A6',
  airRaw: '#94a3b8',
  airMA: '#14B8A6',
  pressureRaw: '#94a3b8',
  pressureMA: '#F59E0B',
  regression: '#EC4899',
  danger: '#E0473C',
  warning: '#C77A0A',
  normal: '#1D9E75',
}

export const LABELS = {
  title: '예측 분석 대시보드',
  subtitle: '설비 이상 예측 · 환경 안정성 추세',
  // ⚠ placeholder: 실측 지표가 확정되면 unit도 함께 교체.
  air: { unit: '' },
}

// 상관 매트릭스·Top N 카드 등에서 쓰는 센서 라벨/색상(분석 탭 전용 문구 — 실시간 탭 라벨과 다를 수 있다).
export const SENSOR_DISPLAY: Record<SensorKey, { label: string; color: string }> = {
  temp: { label: '온도', color: COLORS.tempMA },
  hum: { label: '습도', color: '#EC4899' },
  gas: { label: '가스', color: COLORS.gasMA },
  pm: { label: '공기질', color: COLORS.airMA },
  pressure: { label: '기압', color: '#F59E0B' },
}

export const SEVERITY_COLORS: Record<'normal' | 'warning' | 'danger', { bg: string; text: string }> = {
  normal: { bg: '#D1FAE5', text: '#1D9E75' },
  warning: { bg: '#FEF3C7', text: '#C77A0A' },
  danger: { bg: '#FEE2E2', text: '#E0473C' },
}
