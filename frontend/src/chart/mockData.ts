// 백엔드 미연결 시 대시보드 탭을 채우는 시드(mock) 데이터 생성기.
import type { DashboardData } from './types'
import type { PeriodOption } from './constants'
import { PERIOD_OPTIONS } from './constants'
import { buildDashboardData, type RawPoint } from './deriveDashboard'
import { ZONES, zoneDeviceId, type Zone } from '../shared/zone'

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

// 매일 반복되는 패턴: 오전 중반(6~10h)에 온도만 올라가고, 오후(14~18h)에 습도·가스 동반 상승
// zone마다 기준치를 조금씩 다르게 둬서, 백엔드 미연결 상태에서도 구역별 차이가 보이게 한다.
export function generateMockData(option: PeriodOption = PERIOD_OPTIONS[0], zone: Zone = 'A'): DashboardData {
  const offset = ZONES.indexOf(zone) * 1.5
  const now = new Date()
  const n = Math.max(2, Math.round((option.days * 24 * 60) / option.intervalMinutes))
  const start = new Date(now.getTime() - (n - 1) * option.intervalMinutes * 60 * 1000)

  const raw: RawPoint[] = []

  for (let i = 0; i < n; i++) {
    const minutesFromStart = i * option.intervalMinutes
    const h = (minutesFromStart / 60) % 24
    const dayIndex = Math.floor(minutesFromStart / 60 / 24)

    // 계절 변동(장기 구간에서만 눈에 띄는 완만한 흐름)
    const seasonal = Math.sin((dayIndex / 365) * Math.PI * 2) * 2

    const tempSpike = h >= 6 && h <= 10 ? 8 * Math.sin(((h - 6) / 4) * Math.PI) : 0
    const temp = 22 + offset + seasonal + tempSpike + Math.sin(i * 0.08) * 1.5 + (Math.random() - 0.5) * 1

    const humSpike = h >= 14 && h <= 18 ? 28 * Math.sin(((h - 14) / 4) * Math.PI) : 0
    const hum = 38 + offset * 2 + humSpike + Math.sin(i * 0.05) * 3 + (Math.random() - 0.5) * 2

    const gasSpike = h >= 14 && h <= 18 ? 90 * Math.sin(((h - 14) / 4) * Math.PI) : 0
    const gas = 45 + offset * 6 + gasSpike + Math.sin(i * 0.06) * 8 + (Math.random() - 0.5) * 5

    const pm = 18 + offset * 3 + Math.sin(i * 0.04) * 12 + (Math.random() - 0.5) * 4

    const t = new Date(start.getTime() + i * option.intervalMinutes * 60 * 1000)
    raw.push({
      t: t.toISOString(),
      temp: clamp(temp, 18, 40),
      hum: clamp(hum, 20, 95),
      gas: clamp(gas, 20, 200),
      pm: clamp(pm, 5, 80),
    })
  }

  return buildDashboardData(zoneDeviceId(zone), raw)
}
