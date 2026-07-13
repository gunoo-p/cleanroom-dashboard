// 원시 센서 시계열로부터 대시보드에 필요한 현재값·상태·통계를 계산한다.
import type { DashboardData, SensorKey, SensorPoint, Status } from './types'
import { SENSOR_CONFIGS } from './constants'

function minMax(arr: number[]) {
  return {
    min: +Math.min(...arr).toFixed(1),
    max: +Math.max(...arr).toFixed(1),
    avg: +(arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1),
  }
}

// 기압은 낮을수록 위험(클린룸 양압 붕괴 리스크)하므로 다른 센서와 판정 방향이 반대다.
const LOW_IS_BAD: Partial<Record<SensorKey, true>> = { pressure: true }

// 온도/습도: 반도체 클린룸 실측 기준(중심값 ± 이탈폭, airinnovations.com 참고)으로 4단계 판정.
// 정상: 22.0±0.5℃/45%±2%RH, 주의: ±1℃/±5%RH, 경고: ±2℃/±10%RH, 중단(웨이퍼 파손·ESD 위험): 그 이상.
const DEVIATION_THRESHOLDS: Partial<Record<SensorKey, { center: number; caution: number; warning: number; danger: number }>> = {
  temp: { center: 22.0, caution: 0.5, warning: 1.0, danger: 2.0 },
  hum: { center: 45, caution: 2, warning: 5, danger: 10 },
}

// gas(MQ-2)·pm(MQ135, 공기질)은 보정 안 된 raw ADC값(0~4095)이라 임시 기준치.
// 실측 캘리브레이션 끝나면 조정 필요. 기압도 아직 신뢰할 기준을 못 찾아 기존 값 유지.
const DIRECT_THRESHOLDS: Partial<Record<SensorKey, { warning: number; danger: number }>> = {
  gas: { warning: 2000, danger: 3000 },
  pm: { warning: 2000, danger: 3000 },
  pressure: { warning: 1005, danger: 995 },
}

export function statusFor(key: SensorKey, value: number): Status {
  const dev = DEVIATION_THRESHOLDS[key]
  if (dev) {
    const d = Math.abs(value - dev.center)
    if (d > dev.danger) return 'danger'
    if (d > dev.warning) return 'warning'
    if (d > dev.caution) return 'caution'
    return 'normal'
  }
  const t = DIRECT_THRESHOLDS[key]!
  if (LOW_IS_BAD[key]) {
    return value < t.danger ? 'danger' : value < t.warning ? 'warning' : 'normal'
  }
  return value > t.danger ? 'danger' : value > t.warning ? 'warning' : 'normal'
}

// 대시보드 카드·알림 메시지에 "정상 범위가 어디까지인지" 보여주기 위한 라벨.
export function normalRangeLabel(key: SensorKey): string {
  const unit = SENSOR_CONFIGS.find(c => c.key === key)!.unit
  const dev = DEVIATION_THRESHOLDS[key]
  if (dev) {
    const lo = (dev.center - dev.caution).toFixed(1)
    const hi = (dev.center + dev.caution).toFixed(1)
    return `정상 ${lo}~${hi}${unit}`
  }
  const t = DIRECT_THRESHOLDS[key]!
  return LOW_IS_BAD[key] ? `정상 ${t.warning}${unit} 이상` : `정상 ${t.warning}${unit} 이하`
}

export interface RawPoint {
  t: string
  temp: number
  hum: number
  gas: number
  pm: number
  pressure: number
}

export function buildDashboardData(deviceId: string, raw: RawPoint[]): DashboardData {
  const tempRaw = raw.map(p => p.temp)
  const humRaw = raw.map(p => p.hum)
  const gasRaw = raw.map(p => p.gas)
  const pmRaw = raw.map(p => p.pm)
  const pressureRaw = raw.map(p => p.pressure)

  const points: SensorPoint[] = raw.map((p, i) => ({
    t: p.t,
    temp: +p.temp.toFixed(1),
    hum: +p.hum.toFixed(1),
    gas: +p.gas.toFixed(0),
    pm: +p.pm.toFixed(1),
    pressure: +pressureRaw[i].toFixed(1),
  }))

  const last = points[points.length - 1]

  return {
    device_id: deviceId,
    points,
    current: {
      temp: { value: last.temp, unit: '°C', status: statusFor('temp', last.temp), ...minMax(tempRaw) },
      hum: { value: last.hum, unit: '%', status: statusFor('hum', last.hum), ...minMax(humRaw) },
      gas: { value: last.gas, unit: '', status: statusFor('gas', last.gas), ...minMax(gasRaw) },
      pm: { value: last.pm, unit: '', status: statusFor('pm', last.pm), ...minMax(pmRaw) },
      pressure: { value: last.pressure, unit: 'hPa', status: statusFor('pressure', last.pressure), ...minMax(pressureRaw) },
    },
  }
}
