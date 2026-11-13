// recharts는 SVG 속성으로 색을 받기 때문에 CSS 변수를 쓸 수 없다 — 차트에 넘길 색만 여기서 JS 값으로 관리한다.
// (그 외 카드·텍스트 색은 analysis.css의 CSS 변수가 담당)
export interface ChartTheme {
  axis: string
  grid: string
  tooltipBg: string
  textMuted: string
}

export function chartTheme(isDark: boolean): ChartTheme {
  return isDark
    ? { axis: '#64748b', grid: '#1e3a5f', tooltipBg: '#1e293b', textMuted: '#94a3b8' }
    : { axis: '#94a3b8', grid: '#e2e8f0', tooltipBg: '#ffffff', textMuted: '#64748b' }
}
