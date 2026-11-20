// 위험 시나리오 우선순위 — 여러 위험이 동시에 켜졌을 때 '하나만 고를 수 있는 요소'
// (작업자 대형의 기준, 공기 커튼 색, 바닥 입자 종류, 안개 색 등)는 가장 앞의 상황을 따른다.
// 사람 안전(가스 대피) → 클린룸 오염(차압) → 설비(온도) → 환경(공기질·습도) 순.
export const PRIORITY = ['gas', 'pressure', 'temperature', 'air_quality', 'humidity']

// 켜진 위험 목록을 우선순위 순으로 정렬 (모르는 키·'normal'은 제외)
export function sortByPriority(keys) {
  return PRIORITY.filter((k) => keys.includes(k))
}

// 가장 우선인 상황 (없으면 'normal')
export function primaryOf(keys) {
  return sortByPriority(keys)[0] || 'normal'
}

// 'normal' / 문자열 하나 / 배열 어느 것이 와도 켜진 위험 목록(배열)으로
export function toKeys(arg) {
  if (Array.isArray(arg)) return sortByPriority(arg)
  if (!arg || arg === 'normal') return []
  return sortByPriority([arg])
}
