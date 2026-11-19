// 시계열 센서값을 0~100 스케일로 정규화.
import type { SensorPoint, NormalizedPoint, SensorKey } from './types'

// 데이터 min/max로 늘리면 정상 범위 안의 작은 흔들림이 차트 전체 높이로 부풀려져 이상처럼 보여서,
// 센서별 고정 범위로 정규화한다. 온도·습도는 center ± danger, 가스·공기질은 raw ADC 전체, 차압은 정상 기준 10Pa에 여유.
const FIXED_RANGES: Record<SensorKey, { min: number; max: number }> = {
  temp:     { min: 20,  max: 24 },
  hum:      { min: 35,  max: 55 },
  gas:      { min: 0,   max: 4095 },
  pm:       { min: 0,   max: 4095 },
  pressure: { min: 0,   max: 30 },
}

const norm = (v: number, k: SensorKey) => {
  const { min, max } = FIXED_RANGES[k]
  return Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100))
}

export function normalizeSeries(points: SensorPoint[]): NormalizedPoint[] {
  return points.map(p => ({
    t: p.t,
    temp: p.temp,
    hum: p.hum,
    gas: p.gas,
    pm: p.pm,
    pressure: p.pressure,
    tempN:     +norm(p.temp,     'temp').toFixed(1),
    humN:      +norm(p.hum,      'hum').toFixed(1),
    gasN:      +norm(p.gas,      'gas').toFixed(1),
    pmN:       +norm(p.pm,       'pm').toFixed(1),
    pressureN: +norm(p.pressure, 'pressure').toFixed(1),
  }))
}
