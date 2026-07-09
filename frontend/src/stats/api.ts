// 통계(분석) 탭이 백엔드에서 원시 시계열 데이터를 가져오는 API 호출.
// 전용 /api/analysis 엔드포인트는 없어서, 대시보드와 같은 /api/sensors/{id}/history를 재사용한다.
import type { AnalysisData } from './types'
import { buildDashboardData, type RawPoint } from '../chart/deriveDashboard'

interface HistoryRow {
  time: string
  temperature: number | null
  humidity: number | null
  pressure: number | null
  gas: number | null
  air_quality: number | null
}

export async function fetchAnalysis(deviceId: string, days = 30): Promise<AnalysisData> {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - days)

  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
    interval_minutes: '60',
  })
  const url = `/api/sensors/${deviceId}/history?${params}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('API error')
  const rows: HistoryRow[] = await res.json()

  const raw: RawPoint[] = rows
    .filter((r): r is HistoryRow & Record<'temperature' | 'humidity' | 'pressure' | 'gas' | 'air_quality', number> =>
      r.temperature != null && r.humidity != null && r.pressure != null && r.gas != null && r.air_quality != null)
    .map(r => ({ t: r.time, temp: r.temperature, hum: r.humidity, gas: r.gas, pm: r.air_quality, pressure: r.pressure }))

  if (raw.length === 0) throw new Error('no data')

  return { device_id: deviceId, points: buildDashboardData(deviceId, raw).points }
}
