import type { SensorPoint, NormalizedPoint } from './types'

export function normalizeSeries(points: SensorPoint[]): NormalizedPoint[] {
  if (points.length === 0) return []

  const keys = ['temp', 'hum', 'gas', 'pm'] as const

  const ranges = {} as Record<typeof keys[number], { min: number; max: number }>
  for (const k of keys) {
    const vals = points.map(p => p[k])
    ranges[k] = { min: Math.min(...vals), max: Math.max(...vals) }
  }

  const norm = (v: number, k: typeof keys[number]) => {
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
    defect_rate: p.defect_rate,
    tempN: +norm(p.temp, 'temp').toFixed(1),
    humN:  +norm(p.hum,  'hum').toFixed(1),
    gasN:  +norm(p.gas,  'gas').toFixed(1),
    pmN:   +norm(p.pm,   'pm').toFixed(1),
  }))
}
