// 통계(분석) 탭이 백엔드에서 원시 시계열 데이터를 가져오는 API 호출.
import type { AnalysisData } from './types'

export async function fetchAnalysis(deviceId: string, days = 30): Promise<AnalysisData> {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - days)

  const url = `/api/analysis?device_id=${deviceId}&from=${from.toISOString()}&to=${to.toISOString()}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('API error')
  return res.json()
}
