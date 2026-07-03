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
