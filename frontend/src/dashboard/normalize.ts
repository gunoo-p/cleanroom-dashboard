// 시계열 센서값을 0~100 스케일로 정규화.
import type { SensorPoint, NormalizedPoint, SensorKey } from './types'
import { SENSOR_CONFIGS } from './constants'

export function normalizeSeries(points: SensorPoint[]): NormalizedPoint[] {
  if (points.length === 0) return []

  const ranges = {} as Record<SensorKey, { min: number; max: number }>
  for (const cfg of SENSOR_CONFIGS) {
    const vals = points.map(p => p[cfg.key])
    ranges[cfg.key] = { min: Math.min(...vals), max: Math.max(...vals) }
  }

  const norm = (v: number, k: SensorKey) => {
    const { min, max } = ranges[k]
    if (max === min) return 50
    return ((v - min) / (max - min)) * 100
  }

  return points.map(p => ({
    t: p.t,
    temp: p.temp,
    hum: p.hum,
    gas: p.gas,
    pm: p.pm,
    pressure: p.pressure,
    defect_rate: p.defect_rate,
    tempN:     +norm(p.temp,     'temp').toFixed(1),
    humN:      +norm(p.hum,      'hum').toFixed(1),
    gasN:      +norm(p.gas,      'gas').toFixed(1),
    pmN:       +norm(p.pm,       'pm').toFixed(1),
    pressureN: +norm(p.pressure, 'pressure').toFixed(1),
  }))
}
