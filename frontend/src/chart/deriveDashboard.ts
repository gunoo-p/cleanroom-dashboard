import type { DashboardData, SensorKey, SensorPoint, Status } from './types'

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

// ── 교체 지점: 이 함수를 학습된 모델 점수로 대체한다 ──────────────────────
function computeDefectRate(humN: number, gasN: number): number {
  const raw = (humN / 100) * (gasN / 100) * 135 - 18
  return clamp(raw, 0, 100)
}
// ─────────────────────────────────────────────────────────────────────────────

function movingAvg3(arr: number[]): number[] {
  return arr.map((v, i) => {
    const prev = arr[i - 1] ?? v
    const next = arr[i + 1] ?? v
    return (prev + v + next) / 3
  })
}

function normalize(arr: number[]): number[] {
  const lo = Math.min(...arr)
  const hi = Math.max(...arr)
  if (hi === lo) return arr.map(() => 50)
  return arr.map(v => ((v - lo) / (hi - lo)) * 100)
}

function minMax(arr: number[]) {
  return {
    min: +Math.min(...arr).toFixed(1),
    max: +Math.max(...arr).toFixed(1),
    avg: +(arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1),
  }
}

const SENSOR_THRESHOLDS: Record<SensorKey, { warning: number; danger: number }> = {
  temp: { warning: 30, danger: 35 },
  hum: { warning: 60, danger: 80 },
  gas: { warning: 100, danger: 150 },
  pm: { warning: 30, danger: 50 },
}

export function statusFor(key: SensorKey, value: number): Status {
  const t = SENSOR_THRESHOLDS[key]
  return value > t.danger ? 'danger' : value > t.warning ? 'warning' : 'normal'
}

export interface RawPoint {
  t: string
  temp: number
  hum: number
  gas: number
  pm: number
}

export function buildDashboardData(deviceId: string, raw: RawPoint[]): DashboardData {
  const tempRaw = raw.map(p => p.temp)
  const humRaw = raw.map(p => p.hum)
  const gasRaw = raw.map(p => p.gas)
  const pmRaw = raw.map(p => p.pm)

  const humN = normalize(humRaw)
  const gasN = normalize(gasRaw)
  const defectRaw = humN.map((h, i) => computeDefectRate(h, gasN[i]))
  const defectSmooth = movingAvg3(defectRaw)

  const points: SensorPoint[] = raw.map((p, i) => ({
    t: p.t,
    temp: +p.temp.toFixed(1),
    hum: +p.hum.toFixed(1),
    gas: +p.gas.toFixed(0),
    pm: +p.pm.toFixed(1),
    defect_rate: +defectSmooth[i].toFixed(1),
  }))

  const last = points[points.length - 1]
  const defectNow = +defectSmooth[defectSmooth.length - 1].toFixed(1)

  return {
    device_id: deviceId,
    points,
    current: {
      temp: { value: last.temp, unit: '°C', status: statusFor('temp', last.temp), ...minMax(tempRaw) },
      hum: { value: last.hum, unit: '%', status: statusFor('hum', last.hum), ...minMax(humRaw) },
      gas: { value: last.gas, unit: 'ppm', status: statusFor('gas', last.gas), ...minMax(gasRaw) },
      pm: { value: last.pm, unit: 'µg/m³', status: statusFor('pm', last.pm), ...minMax(pmRaw) },
    },
    defect_rate_now: defectNow,
  }
}
