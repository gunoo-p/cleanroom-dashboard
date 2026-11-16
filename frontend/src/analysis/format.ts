// 통계 탭 카드·차트가 공통으로 쓰는 값 포맷터 (여러 컴포넌트에 중복돼 있던 것을 한 곳으로 모음).

// 시간당 변화율. 예: formatRate(0.52, '°C') → "+0.5°C/h"
export function formatRate(v: number, unit: string) {
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}${unit}/h`
}

// 위험임계 도달 예상 시간.
export function formatEta(hours: number | null) {
  if (hours == null) return '해당 없음'
  if (hours < 1) return `약 ${Math.round(hours * 60)}분 후`
  return `약 ${hours.toFixed(1)}시간 후`
}

// 차트 X축 눈금용 "HH시".
export function formatHour(iso: string) {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}시`
}
