// 로그 캘린더 탭이 백엔드에서 원시 시계열 데이터를 가져오는 API 호출.
// 전용 엔드포인트는 없어서, 대시보드·분석 탭과 같은 /api/sensors/{id}/history를 재사용한다.
export interface HistoryRow {
  time: string
  temperature: number | null
  humidity: number | null
  pressure: number | null
  gas: number | null
  air_quality: number | null
}

async function fetchHistory(deviceId: string, from: Date, to: Date, intervalMinutes: number): Promise<HistoryRow[]> {
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
    interval_minutes: String(intervalMinutes),
  })
  const res = await fetch(`/api/sensors/${deviceId}/history?${params}`)
  // 백엔드는 해당 기간에 데이터가 하나도 없으면 404("데이터 없음")를 준다 — 이건 진짜 오류가
  // 아니라 "그 달/그 날은 기록이 없다"는 정상적인 상태라, 던지지 않고 빈 배열로 취급한다.
  if (res.status === 404) return []
  if (!res.ok) throw new Error('API error')
  return res.json()
}

// 캘린더 셀(날짜별 위험/경고 개수)은 한 달 전체를 한 번에 30분 간격으로 받아 집계한다.
export function fetchMonthHistory(deviceId: string, year: number, month: number): Promise<HistoryRow[]> {
  const from = new Date(year, month - 1, 1)
  const to = new Date(year, month, 1)
  return fetchHistory(deviceId, from, to, 30)
}

// 날짜를 클릭해 상세 로그를 볼 때는 그 하루만 1분 간격으로 더 촘촘하게 받는다.
// 실제 센서는 3초마다 값을 보내므로(simulator.py INTERVAL=3), 5분 평균은 짧게 스쳐가는
// 위험/경고를 뭉개버릴 수 있다 — 1분(하루 1440포인트×5센서=7200줄)이 무겁지 않으면서도
// 대시보드 탭의 "1일" 해상도와 맞는 절충점.
export function fetchDayHistory(deviceId: string, year: number, month: number, day: number): Promise<HistoryRow[]> {
  const from = new Date(year, month - 1, day)
  const to = new Date(year, month - 1, day + 1)
  return fetchHistory(deviceId, from, to, 1)
}
