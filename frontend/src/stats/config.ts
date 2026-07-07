// ─────────────────────────────────────────────────────────────────
// "단일 출처(single source of truth)".
// 임계치·색상·라벨·계산 파라미터를 여기 한 곳에서만 관리한다.
// 컴포넌트에는 숫자를 하드코딩하지 말고 이 파일 값을 참조할 것.
// ─────────────────────────────────────────────────────────────────
import type { SensorKey, Severity } from './types'

export const THRESHOLDS = {
  temp: { warning: 35, danger: 45, axisMin: 15, axisMax: 50 },
  gas: { warning: 300, danger: 500, axisMin: 0, axisMax: 500 },
  // ⚠ placeholder: 실측 지표(AQI/VOC 등)·단위·임계가 하드웨어/md로 확정되면 교체.
  air: { warning: 75, danger: 100, axisMin: 0, axisMax: 150 },
  // ⚠ placeholder: 차압(필터 막힘 상한) 임계. 배관 위치·필터 사양이 확정되면 교체.
  // warning=교체 권장 시작, danger=즉시 교체 필요.
  dp: { warning: 150, danger: 250, axisMin: 0, axisMax: 300 },
  humidity: { warning: 80 },
}

export const TREND = {
  movingAverageWindow: 6,
  // 변화율(기울기)을 계산할 때 사용하는 "최근 구간" 길이
  slopeWindowHours: 8,
  // 이 기울기를 넘으면 "상승 추세 감지" / "동반 상승 패턴" 배지 표시
  risingSlopePerHour: { temp: 0.6, gas: 8, air: 3 },
}

// 필터 잔여 수명 추정 — 실제 열화 모델이 준비되기 전까지의 placeholder.
// 모델이 나오면 이 값과 계산 지점(deriveAnalysis.ts의 buildFilterReplacement)만 교체하면 된다.
export const FILTER_MODEL = {
  lifeFloorDp: THRESHOLDS.dp.danger, // 이 차압값에서 잔여 수명 0%로 간주
  warningLifePct: 40,
  dangerLifePct: 20,
}

// ── 차압 센서 용도 ───────────────────────────────────────────────
// 추가된 압력 센서는 범용 차압 센서라 물리적 용도는 배관 연결 위치로 정해진다(하드웨어 미확정).
// 이 프로젝트 목적(불량률 예측)에 맞춰 기본값은 "필터 전후 차압"으로 가정한다.
// 나중에 실내-외 차압(구역 관리용)으로 밝혀지면 이 값만 'room'으로 바꾸면 라벨·문구가 함께 전환된다.
export type PressureUsage = 'filter' | 'room'
export const PRESSURE_USAGE: PressureUsage = 'filter'

export const PRESSURE_USAGE_COPY: Record<PressureUsage, {
  trendTitle: string
  cardTitle: string
  currentLabel: string
  lifeLabel: string
  etaLabel: string
  statusLabels: Record<Severity, string>
}> = {
  filter: {
    trendTitle: '차압 추세 (필터 전후 · 데모)',
    cardTitle: '필터 교체 예측 (데모)',
    currentLabel: '현재 차압',
    lifeLabel: '필터 잔여 수명',
    etaLabel: '교체 예상 시점',
    statusLabels: { normal: '정상', warning: '교체 권장', danger: '즉시 교체 필요' },
  },
  room: {
    trendTitle: '차압 추세 (구역간 · 데모)',
    cardTitle: '압력 관리 현황 (데모)',
    currentLabel: '현재 차압',
    lifeLabel: '기준 대비 여유',
    etaLabel: '기준 도달 예상',
    statusLabels: { normal: '정상', warning: '주의 관찰', danger: '즉시 확인 필요' },
  },
}

export const COLORS = {
  tempRaw: '#94a3b8',
  tempMA: '#3B82F6',
  gasRaw: '#94a3b8',
  gasMA: '#14B8A6',
  airRaw: '#94a3b8',
  airMA: '#14B8A6',
  dpBar: '#F59E0B',
  dpProjected: '#fde3b0',
  regression: '#EC4899',
  danger: '#E0473C',
  warning: '#C77A0A',
  normal: '#1D9E75',
}

export const LABELS = {
  title: '예측 분석 대시보드',
  subtitle: '설비 이상 예측 · 필터 교체 예측 · 수율 상관관계 (SECOM 기반)',
  // ⚠ placeholder: 실측 지표가 확정되면 unit도 함께 교체.
  air: { unit: 'µg/m³' },
  dp: { unit: 'Pa' },
}

// 상관 매트릭스·Top N 카드 등에서 쓰는 센서 라벨/색상(분석 탭 전용 문구 — 실시간 탭 라벨과 다를 수 있다.
// 특히 chart의 'pressure'는 실시간 탭에서 "기압"이지만, 분석 탭에서는 "차압"으로 재해석한다).
export const SENSOR_DISPLAY: Record<SensorKey, { label: string; color: string }> = {
  temp: { label: '온도', color: COLORS.tempMA },
  hum: { label: '습도', color: '#EC4899' },
  gas: { label: '가스', color: COLORS.gasMA },
  pm: { label: '공기질', color: COLORS.airMA },
  pressure: { label: '차압', color: COLORS.dpBar },
}

export const SEVERITY_COLORS: Record<'normal' | 'warning' | 'danger', { bg: string; text: string }> = {
  normal: { bg: '#D1FAE5', text: '#1D9E75' },
  warning: { bg: '#FEF3C7', text: '#C77A0A' },
  danger: { bg: '#FEE2E2', text: '#E0473C' },
}
