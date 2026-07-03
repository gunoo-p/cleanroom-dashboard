// ─────────────────────────────────────────────────────────────────
// "단일 출처(single source of truth)".
// 임계치·색상·라벨·계산 파라미터를 여기 한 곳에서만 관리한다.
// 컴포넌트에는 숫자를 하드코딩하지 말고 이 파일 값을 참조할 것.
// ─────────────────────────────────────────────────────────────────

export const THRESHOLDS = {
  temp: { warning: 35, danger: 45, axisMin: 15, axisMax: 50 },
  gas: { warning: 300, danger: 500, axisMin: 0, axisMax: 500 },
  pm: { warning: 75, axisMax: 100 },
  humidity: { warning: 80 },
}

export const TREND = {
  movingAverageWindow: 6,
  // 변화율(기울기)을 계산할 때 사용하는 "최근 구간" 길이
  slopeWindowHours: 8,
  // 이 기울기를 넘으면 "상승 추세 감지" / "동반 상승 패턴" 배지 표시
  risingSlopePerHour: { temp: 0.6, gas: 8 },
}

// 필터 잔여 수명 추정 — 실제 열화 모델이 준비되기 전까지의 placeholder.
// 모델이 나오면 이 값과 계산 지점(deriveAnalysis.ts의 buildFilterReplacement)만 교체하면 된다.
export const FILTER_MODEL = {
  lifeFloorPm: 90, // 이 PM 평균값에서 잔여 수명 0%로 간주
  warningLifePct: 40,
  dangerLifePct: 20,
}

export const COLORS = {
  tempRaw: '#94a3b8',
  tempMA: '#3B82F6',
  gasRaw: '#94a3b8',
  gasMA: '#14B8A6',
  pmBar: '#8B5CF6',
  pmProjected: '#c4b5fd',
  regression: '#EC4899',
  danger: '#E0473C',
  warning: '#C77A0A',
  normal: '#1D9E75',
}

export const LABELS = {
  title: '예측 분석 대시보드',
  subtitle: 'esp32-A1 · 설비 이상 예측 · 필터 교체 예측 · 수율 상관관계 (SECOM 기반)',
}

export const SEVERITY_COLORS: Record<'normal' | 'warning' | 'danger', { bg: string; text: string }> = {
  normal: { bg: '#D1FAE5', text: '#1D9E75' },
  warning: { bg: '#FEF3C7', text: '#C77A0A' },
  danger: { bg: '#FEE2E2', text: '#E0473C' },
}
