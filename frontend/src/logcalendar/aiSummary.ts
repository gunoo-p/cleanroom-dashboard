// 로그 캘린더 하루치 로그를 Claude API로 자연어 요약하는 백엔드 호출(API 키는 서버에서만 사용).
export interface DaySummaryRequest {
  date: string
  zoneLabel: string
  danger: number
  warning: number
  normal: number
  bySensor: { sensor: string; danger: number; warning: number }[]
}

export async function fetchDaySummary(req: DaySummaryRequest): Promise<string> {
  const res = await fetch('/api/logs/summary', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: req.date,
      zone_label: req.zoneLabel,
      danger: req.danger,
      warning: req.warning,
      normal: req.normal,
      by_sensor: req.bySensor,
    }),
  })
  if (!res.ok) throw new Error('AI 요약 생성 실패')
  const data = await res.json()
  return data.summary as string
}
