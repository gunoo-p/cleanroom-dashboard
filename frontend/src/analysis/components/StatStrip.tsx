// 확대된 패널 하단의 "라벨 + 값" 요약 줄. 공간이 모자라면 줄바꿈된다.
export interface StatItem {
  label: string
  value: string
}

export function StatStrip({ items }: { items: StatItem[] }) {
  return (
    <dl className="stat-strip">
      {items.map(item => (
        <div key={item.label} className="stat-strip__item">
          <dt className="stat-strip__label">{item.label}</dt>
          <dd className="stat-strip__value">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
