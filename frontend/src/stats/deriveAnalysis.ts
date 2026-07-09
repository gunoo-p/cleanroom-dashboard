// 원시 시계열로부터 설비 이상·수율 상관관계 등 분석 지표를 계산한다.
import type { AnalysisData, Severity, SensorKey } from './types'
import { THRESHOLDS, TREND, SENSOR_DISPLAY } from './config'
import { movingAverage, linearRegression, pearsonCorrelation, etaToThreshold, mean } from './calc'

// ── 설비 이상 예측 (행 1) ───────────────────────────────────────────
export interface TrendPanelPoint { t: string; raw: number; ma: number }
export interface TrendPanelData {
  points: TrendPanelPoint[]
  ratePerHour: number
  etaHours: number | null
  isRising: boolean
  latestValue: number
}

function last24h(data: AnalysisData) {
  const pts = data.points
  if (pts.length === 0) return []
  const lastT = new Date(pts[pts.length - 1].t).getTime()
  return pts.filter(p => lastT - new Date(p.t).getTime() <= 24 * 36e5)
}

function buildTrendPanel(
  series: { t: string; value: number }[],
  danger: number,
  riseSlopePerHour: number,
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
  return {
    points: series.map((p, i) => ({ t: p.t, raw: raw[i], ma: ma[i] })),
    ratePerHour: slope,
    etaHours: etaToThreshold(latestValue, danger, slope),
    isRising: slope >= riseSlopePerHour,
    latestValue,
  }
}

export interface EquipmentAnomalyView {
  temp: TrendPanelData
  gas: TrendPanelData
  status: Severity
}

function buildEquipmentAnomaly(data: AnalysisData): EquipmentAnomalyView {
  const recent = last24h(data)
  const temp = buildTrendPanel(
    recent.map(p => ({ t: p.t, value: p.temp })),
    THRESHOLDS.temp.danger,
    TREND.risingSlopePerHour.temp,
  )
  const gas = buildTrendPanel(
    recent.map(p => ({ t: p.t, value: p.gas })),
    THRESHOLDS.gas.danger,
    TREND.risingSlopePerHour.gas,
  )

  const status: Severity =
    temp.latestValue >= THRESHOLDS.temp.danger || gas.latestValue >= THRESHOLDS.gas.danger ? 'danger' :
    temp.latestValue >= THRESHOLDS.temp.warning || gas.latestValue >= THRESHOLDS.gas.warning || temp.isRising || gas.isRising ? 'warning' :
    'normal'

  return { temp, gas, status }
}

// ── 공기질 추세 (행 2 좌1) ───────────────────────────────────────────
function buildAirTrend(data: AnalysisData): TrendPanelData {
  const recent = last24h(data)
  return buildTrendPanel(
    recent.map(p => ({ t: p.t, value: p.pm })),
    THRESHOLDS.air.danger,
    TREND.risingSlopePerHour.air,
  )
}

// ── 수율 상관관계 (행 3) ────────────────────────────────────────────
export interface CorrelationCell { row: SensorKey; col: SensorKey; r: number }
export interface TopCorrelation { key: SensorKey; label: string; color: string; r: number }
export interface YieldCorrelationView {
  scatter: { humidity: number; defectRate: number }[]
  regression: { slope: number; intercept: number }
  r: number
  matrix: CorrelationCell[]
  top3: TopCorrelation[]
  bannerMultiplier: number | null
}

const SENSOR_KEYS: SensorKey[] = ['temp', 'hum', 'gas', 'pm', 'pressure']

function buildYieldCorrelation(data: AnalysisData): YieldCorrelationView {
  const pts = data.points
  const series: Record<SensorKey, number[]> = {
    temp: pts.map(p => p.temp),
    hum: pts.map(p => p.hum),
    gas: pts.map(p => p.gas),
    pm: pts.map(p => p.pm),
    pressure: pts.map(p => p.pressure),
  }
  const defect = pts.map(p => p.defect_rate)

  const r = pearsonCorrelation(series.hum, defect)
  const regression = linearRegression(series.hum, defect)

  const step = Math.max(1, Math.floor(pts.length / 120))
  const scatter = pts.filter((_, i) => i % step === 0).map(p => ({ humidity: p.hum, defectRate: p.defect_rate }))

  const matrix: CorrelationCell[] = []
  for (const row of SENSOR_KEYS) {
    for (const col of SENSOR_KEYS) {
      matrix.push({ row, col, r: row === col ? 1 : pearsonCorrelation(series[row], series[col]) })
    }
  }

  const top3 = SENSOR_KEYS
    .map(key => ({ key, r: pearsonCorrelation(series[key], defect) }))
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
    .slice(0, 3)
    .map(({ key, r: cr }) => {
      const cfg = SENSOR_DISPLAY[key]
      return { key, label: cfg.label, color: cfg.color, r: cr }
    })

  const above = defect.filter((_, i) => series.hum[i] > THRESHOLDS.humidity.warning)
  const below = defect.filter((_, i) => series.hum[i] <= THRESHOLDS.humidity.warning)
  const belowAvg = mean(below)
  const bannerMultiplier = above.length > 0 && below.length > 0 && belowAvg > 0 ? mean(above) / belowAvg : null

  return { scatter, regression, r, matrix, top3, bannerMultiplier }
}

export interface AnalysisView {
  equipmentAnomaly: EquipmentAnomalyView
  trends: { air: TrendPanelData }
  yieldCorrelation: YieldCorrelationView
}

export function deriveAnalysis(data: AnalysisData): AnalysisView {
  return {
    equipmentAnomaly: buildEquipmentAnomaly(data),
    trends: { air: buildAirTrend(data) },
    yieldCorrelation: buildYieldCorrelation(data),
  }
}
