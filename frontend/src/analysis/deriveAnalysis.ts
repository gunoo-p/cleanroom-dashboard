// 원시 시계열로부터 설비 이상·환경 안정성 추세 등 분석 지표를 계산한다.
import type { AnalysisData, Severity, SensorKey } from './types'
import { THRESHOLDS, TREND } from './config'
import { movingAverage, linearRegression, pearsonCorrelation, etaToThreshold } from './calc'

// ── 설비 이상 예측 (행 1) ───────────────────────────────────────────
export interface TrendPanelPoint { t: string; raw: number; ma: number }
export interface TrendPanelData {
  points: TrendPanelPoint[]
  ratePerHour: number
  etaHours: number | null
  isRising: boolean
  latestValue: number
}

// direction: 'rising'이면 값이 오를수록 위험(온도/가스/공기질), 'falling'이면 내려갈수록
// 위험(기압 — 클린룸 양압 붕괴 리스크). 어느 쪽이든 "위험 방향으로 가는 기울기"를 감지한다.
function buildTrendPanel(
  series: { t: string; value: number }[],
  danger: number,
  slopeThresholdPerHour: number,
  direction: 'rising' | 'falling' = 'rising',
): TrendPanelData {
  if (series.length === 0) {
    return { points: [], ratePerHour: 0, etaHours: null, isRising: false, latestValue: 0 }
  }
  const raw = series.map(p => p.value)
  const ma = movingAverage(raw, TREND.movingAverageWindow)
  const t0 = new Date(series[0].t).getTime()
  const hours = series.map(p => (new Date(p.t).getTime() - t0) / 36e5)

  const recentFromHour = hours[hours.length - 1] - TREND.slopeWindowHours
  const recentHours = hours.filter(h => h >= recentFromHour)
  const recentValues = raw.filter((_, i) => hours[i] >= recentFromHour)
  const { slope } = linearRegression(recentHours, recentValues)

  const latestValue = raw[raw.length - 1]
  const isRising = direction === 'rising' ? slope >= slopeThresholdPerHour : slope <= -slopeThresholdPerHour
  return {
    points: series.map((p, i) => ({ t: p.t, raw: raw[i], ma: ma[i] })),
    ratePerHour: slope,
    etaHours: etaToThreshold(latestValue, danger, slope),
    isRising,
    latestValue,
  }
}

export interface EquipmentAnomalyView {
  temp: TrendPanelData
  gas: TrendPanelData
  status: Severity
}

function buildEquipmentAnomaly(data: AnalysisData): EquipmentAnomalyView {
  const temp = buildTrendPanel(
    data.points.map(p => ({ t: p.t, value: p.temp })),
    THRESHOLDS.temp.danger,
    TREND.risingSlopePerHour.temp,
  )
  const gas = buildTrendPanel(
    data.points.map(p => ({ t: p.t, value: p.gas })),
    THRESHOLDS.gas.danger,
    TREND.risingSlopePerHour.gas,
  )

  const status: Severity =
    temp.latestValue >= THRESHOLDS.temp.danger || gas.latestValue >= THRESHOLDS.gas.danger ? 'danger' :
    temp.latestValue >= THRESHOLDS.temp.warning || gas.latestValue >= THRESHOLDS.gas.warning || temp.isRising || gas.isRising ? 'warning' :
    'normal'

  return { temp, gas, status }
}

// ── 공기질 추세 (행 2) ───────────────────────────────────────────
function buildAirTrend(data: AnalysisData): TrendPanelData {
  return buildTrendPanel(
    data.points.map(p => ({ t: p.t, value: p.pm })),
    THRESHOLDS.air.danger,
    TREND.risingSlopePerHour.air,
  )
}

// ── 기압(환경 안정성) 추세 (행 3) ───────────────────────────────────
// 기압은 낮을수록 위험(클린룸 양압 붕괴로 오염물질 유입 리스크, ISO 14644-4 차압 개념 참고).
function buildPressureTrend(data: AnalysisData): TrendPanelData {
  return buildTrendPanel(
    data.points.map(p => ({ t: p.t, value: p.pressure })),
    THRESHOLDS.pressure.danger,
    TREND.risingSlopePerHour.pressure,
    'falling',
  )
}

// ── 센서 간 상관계수 매트릭스 (행 3) ──────────────────────────────
// 불량률(defect_rate)은 실측이 아니라 지어낸 값이라 여기서는 다루지 않는다.
// 센서끼리의 상관관계(예: 온도-가스 동반 상승)만 본다 — 이건 실측값 기반이라 그대로 신뢰 가능.
export interface CorrelationCell { row: SensorKey; col: SensorKey; r: number }

const SENSOR_KEYS: SensorKey[] = ['temp', 'hum', 'gas', 'pm', 'pressure']

function buildCorrelationMatrix(data: AnalysisData): CorrelationCell[] {
  const pts = data.points
  const series: Record<SensorKey, number[]> = {
    temp: pts.map(p => p.temp),
    hum: pts.map(p => p.hum),
    gas: pts.map(p => p.gas),
    pm: pts.map(p => p.pm),
    pressure: pts.map(p => p.pressure),
  }

  const matrix: CorrelationCell[] = []
  for (const row of SENSOR_KEYS) {
    for (const col of SENSOR_KEYS) {
      matrix.push({ row, col, r: row === col ? 1 : pearsonCorrelation(series[row], series[col]) })
    }
  }
  return matrix
}

export interface AnalysisView {
  equipmentAnomaly: EquipmentAnomalyView
  trends: { air: TrendPanelData; pressure: TrendPanelData }
  correlationMatrix: CorrelationCell[]
}

export function deriveAnalysis(data: AnalysisData): AnalysisView {
  return {
    equipmentAnomaly: buildEquipmentAnomaly(data),
    trends: { air: buildAirTrend(data), pressure: buildPressureTrend(data) },
    correlationMatrix: buildCorrelationMatrix(data),
  }
}
