// 통계 탭 카드들의 공통 레이아웃(제목·배지·남은 높이를 채우는 콘텐츠 영역).
// 클릭 가능한 패널은 키보드(Enter/Space)로도 확대할 수 있다.
import type { KeyboardEvent, ReactNode } from 'react'

interface Props {
  title: string
  badge?: ReactNode
  onClick?: () => void
  // 확대 오버레이 안에서 렌더링될 때 true — 제목을 가운데·크게, 여백도 넉넉하게.
  expanded?: boolean
  children: ReactNode
}

export function Panel({ title, badge, onClick, expanded, children }: Props) {
  const className = [
    'analysis-panel',
    onClick && 'is-clickable',
    expanded && 'is-expanded',
  ].filter(Boolean).join(' ')

  const onKeyDown = onClick
    ? (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }
    : undefined

  return (
    <section
      className={className}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `${title} 크게 보기` : undefined}
    >
      <header className="analysis-panel__head">
        <h3 className="analysis-panel__title" title={title}>{title}</h3>
        {badge && <span className="analysis-panel__badge">{badge}</span>}
      </header>
      <div className="analysis-panel__body">{children}</div>
    </section>
  )
}
