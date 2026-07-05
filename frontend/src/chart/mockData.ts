import type { DashboardData, SensorPoint } from './types'
import type { PeriodOption } from './constants'
import { PERIOD_OPTIONS } from './constants'

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

// 매일 반복되는 패턴: 오전 중반(6~10h)에 온도만 올라가고, 오후(14~18h)에 습도·가스 동반 상승
export function generateMockData(option: PeriodOption = PERIOD_OPTIONS[0]): DashboardData {
  const now = new Date()
  const n = Math.max(2, Math.round((option.days * 24 * 60) / option.intervalMinutes))
  const start = new Date(now.getTime() - (n - 1) * option.intervalMinutes * 60 * 1000)

  const points: SensorPoint[] = []
  const tempRaw: number[] = []
  const humRaw: number[] = []
  const gasRaw: number[] = []
  const pmRaw: number[] = []

  for (let i = 0; i < n; i++) {
    const minutesFromStart = i * option.intervalMinutes
    const h = (minutesFromStart / 60) % 24
    const dayIndex = Math.floor(minutesFromStart / 60 / 24)

    // 계절 변동(장기 구간에서만 눈에 띄는 완만한 흐름)
    const seasonal = Math.sin((dayIndex / 365) * Math.PI * 2) * 2

    const tempSpike = h >= 6 && h <= 10 ? 8 * Math.sin(((h - 6) / 4) * Math.PI) : 0
    const temp = 22 + seasonal + tempSpike + Math.sin(i * 0.08) * 1.5 + (Math.random() - 0.5) * 1

    const humSpike = h >= 14 && h <= 18 ? 28 * Math.sin(((h - 14) / 4) * Math.PI) : 0
    const hum = 38 + humSpike + Math.sin(i * 0.05) * 3 + (Math.random() - 0.5) * 2

    const gasSpike = h >= 14 && h <= 18 ? 90 * Math.sin(((h - 14) / 4) * Math.PI) : 0
    const gas = 45 + gasSpike + Math.sin(i * 0.06) * 8 + (Math.random() - 0.5) * 5

    const pm = 18 + Math.sin(i * 0.04) * 12 + (Math.random() - 0.5) * 4

    tempRaw.push(clamp(temp, 18, 40))
    humRaw.push(clamp(hum, 20, 95))
    gasRaw.push(clamp(gas, 20, 200))
    pmRaw.push(clamp(pm, 5, 80))
  }

  const humN = normalize(humRaw)
  const gasN = normalize(gasRaw)

  const defectRaw = humN.map((h, i) => computeDefectRate(h, gasN[i]))
  const defectSmooth = movingAvg3(defectRaw)

  for (let i = 0; i < n; i++) {
    const t = new Date(start.getTime() + i * option.intervalMinutes * 60 * 1000)
    points.push({
      t: t.toISOString(),
      temp: +tempRaw[i].toFixed(1),
      hum:  +humRaw[i].toFixed(1),
      gas:  +gasRaw[i].toFixed(0),
      pm:   +pmRaw[i].toFixed(1),
      defect_rate: +defectSmooth[i].toFixed(1),
    })
  }

  const last = points[points.length - 1]
  const defectNow = +defectSmooth[defectSmooth.length - 1].toFixed(1)

  const minMax = (arr: number[]) => ({
    min: +Math.min(...arr).toFixed(1),
    max: +Math.max(...arr).toFixed(1),
    avg: +(arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(1),
  })

  const gasStatus = last.gas > 150 ? 'danger' : last.gas > 100 ? 'warning' : 'normal'
  const humStatus = last.hum > 80 ? 'danger' : last.hum > 60 ? 'warning' : 'normal'
  const tempStatus = last.temp > 35 ? 'danger' : last.temp > 30 ? 'warning' : 'normal'
  const pmStatus = last.pm > 50 ? 'danger' : last.pm > 30 ? 'warning' : 'normal'

  return {
    device_id: 'esp32-A1',
    points,
    current: {
      temp: { value: last.temp, unit: '°C',   status: tempStatus, ...minMax(tempRaw) },
      hum:  { value: last.hum,  unit: '%',    status: humStatus,  ...minMax(humRaw)  },
      gas:  { value: last.gas,  unit: 'ppm',  status: gasStatus,  ...minMax(gasRaw)  },
      pm:   { value: last.pm,   unit: 'µg/m³', status: pmStatus,  ...minMax(pmRaw)   },
    },
    defect_rate_now: defectNow,
  }
}
