// 통계(분석) 탭이 백엔드에서 원시 시계열 데이터를 가져오는 API 호출.
// 전용 /api/analysis 엔드포인트는 없어서, 대시보드와 같은 /api/sensors/{id}/history를 재사용한다.
import type { AnalysisData, ForecastData, InsightRequest } from './types'
import type { AnalysisPeriodOption } from './config'
import { buildDashboardData, type RawPoint } from '../dashboard/deriveDashboard'

interface HistoryRow {
  time: string
  temperature: number | null
  humidity: number | null
  pressure: number | null
  pressure_outside: number | null
  gas: number | null
  air_quality: number | null
}

// 실내-실외 절대기압(hPa) 차이를 Pa 단위 차압으로 변환(dashboard/Dashboard.tsx와 동일 계산).
function pressureDiffPa(inside: number, outside: number): number {
  return (inside - outside) * 100
}

function rangeParams(period: AnalysisPeriodOption): URLSearchParams {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - period.days)
  return new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
    interval_minutes: String(period.intervalMinutes),
  })
}

export async function fetchAnalysis(deviceId: string, period: AnalysisPeriodOption): Promise<AnalysisData> {
  const url = `/api/sensors/${deviceId}/history?${rangeParams(period)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('API error')
  const rows: HistoryRow[] = await res.json()

  const raw: RawPoint[] = rows
    .filter((r): r is HistoryRow & Record<'temperature' | 'humidity' | 'pressure' | 'pressure_outside' | 'gas' | 'air_quality', number> =>
      r.temperature != null && r.humidity != null && r.pressure != null && r.pressure_outside != null && r.gas != null && r.air_quality != null)
    .map(r => ({ t: r.time, temp: r.temperature, hum: r.humidity, gas: r.gas, pm: r.air_quality, pressure: pressureDiffPa(r.pressure, r.pressure_outside) }))

  if (raw.length === 0) throw new Error('no data')

  return { device_id: deviceId, points: buildDashboardData(deviceId, raw).points }
}

export async function fetchForecast(deviceId: string, period: AnalysisPeriodOption): Promise<ForecastData> {
  const res = await fetch(`/api/analysis/${deviceId}/forecast?${rangeParams(period)}`)
  if (!res.ok) throw new Error('AI 예측 실패')
  return res.json()
}

export async function fetchInsight(body: InsightRequest): Promise<string> {
  const res = await fetch('/api/analysis/insight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('AI 해설 생성 실패')
  return (await res.json()).summary
}
