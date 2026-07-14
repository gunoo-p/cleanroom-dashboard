// 통계 탭 카드들의 공통 레이아웃(제목·배지·부모 높이에 맞춰 늘어나는 콘텐츠 영역).
import { useState, type ReactNode } from 'react'

interface Props {
  title: string
  isDark: boolean
  badge?: ReactNode
  onClick?: () => void
  // 확대 오버레이 안에서 렌더링될 때 true — 제목을 가운데·크게, 여백도 넉넉하게.
  expanded?: boolean
  children: ReactNode
}

export function Panel({ title, isDark, badge, onClick, expanded, children }: Props) {
  const cardBg = isDark ? '#1e293b' : '#ffffff'
  const border = isDark ? '#334155' : '#e2e8f0'
  const [hover, setHover] = useState(false)

  return (
    <div
      className="analysis-panel"
      onClick={onClick}
      onMouseEnter={() => onClick && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: cardBg,
        border: `1px solid ${border}`,
        borderRadius: 12,
        padding: expanded ? '20px 24px 16px' : '14px 16px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: expanded ? 14 : 8,
        minWidth: 0,
        height: '100%',
        minHeight: 0,
        boxSizing: 'border-box',
        cursor: onClick ? 'pointer' : undefined,
        ...(onClick && {
          boxShadow: hover ? '0 4px 16px rgba(0,0,0,0.15)' : 'none',
          transform: hover ? 'translateY(-2px)' : 'none',
          transition: 'box-shadow 0.15s, transform 0.15s',
        }),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: expanded ? 'center' : 'space-between', gap: 10, minWidth: 0, flexShrink: 0 }}>
        <span
          title={title}
          style={{
            fontWeight: 700,
            fontSize: expanded ? '1.3rem' : '0.85rem',
            color: isDark ? '#f1f5f9' : '#0f172a',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
            flex: expanded ? 'none' : 1,
            textAlign: expanded ? 'center' : 'left',
          }}
        >
          {title}
        </span>
        {badge && <span style={{ flexShrink: 0 }}>{badge}</span>}
      </div>
      <div className="analysis-panel-body" style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
        {children}
      </div>
    </div>
  )
}
