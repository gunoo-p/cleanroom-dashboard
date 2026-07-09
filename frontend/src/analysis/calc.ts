// 통계 분석 탭에서 쓰는 순수 계산 함수 모음 (이동평균/회귀/상관계수/ETA).
// 데이터가 실측값으로 바뀌어도 그대로 재사용된다.

export function movingAverage(values: number[], window: number): number[] {
  return values.map((_, i) => {
    const start = Math.max(0, i - window + 1)
    const slice = values.slice(start, i + 1)
    return slice.reduce((s, v) => s + v, 0) / slice.length
  })
}

export function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number } {
  const n = xs.length
  if (n === 0) return { slope: 0, intercept: 0 }
  const meanX = xs.reduce((s, v) => s + v, 0) / n
  const meanY = ys.reduce((s, v) => s + v, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY)
    den += (xs[i] - meanX) ** 2
  }
  const slope = den === 0 ? 0 : num / den
  return { slope, intercept: meanY - slope * meanX }
}

export function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length
  if (n === 0) return 0
  const meanX = xs.reduce((s, v) => s + v, 0) / n
  const meanY = ys.reduce((s, v) => s + v, 0) / n
  let num = 0
  let denX = 0
  let denY = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX
    const dy = ys[i] - meanY
    num += dx * dy
    denX += dx * dx
    denY += dy * dy
  }
  const den = Math.sqrt(denX * denY)
  return den === 0 ? 0 : num / den
}

// 현재값이 rate(단위/시간 또는 단위/일) 속도로 threshold에 도달하기까지 걸리는 시간.
// threshold가 현재값보다 높든 낮든(예: 기압처럼 낮을수록 위험한 경우) 방향에 상관없이 계산하고,
// 그 방향으로 가고 있지 않으면(eta<=0) null("해당 없음")을 반환한다.
export function etaToThreshold(current: number, threshold: number, rate: number): number | null {
  if (rate === 0) return null
  const eta = (threshold - current) / rate
  return eta > 0 ? eta : null
}
