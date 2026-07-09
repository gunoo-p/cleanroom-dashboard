// 통계 탭 카드들의 공통 레이아웃(제목·배지·고정 높이 콘텐츠 영역).
import type { ReactNode } from 'react'

interface Props {
  title: string
  isDark: boolean
  badge?: ReactNode
  height?: number
  children: ReactNode
}

export function Panel({ title, isDark, badge, height = 240, children }: Props) {
  const cardBg = isDark ? '#1e293b' : '#ffffff'
  const border = isDark ? '#334155' : '#e2e8f0'

  return (
    <div style={{
      background: cardBg,
      border: `1px solid ${border}`,
      borderRadius: 12,
      padding: '14px 16px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minWidth: 0 }}>
        <span
          title={title}
          style={{
            fontWeight: 700,
            fontSize: '0.85rem',
            color: isDark ? '#f1f5f9' : '#0f172a',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
            flex: 1,
          }}
        >
          {title}
        </span>
        {badge && <span style={{ flexShrink: 0 }}>{badge}</span>}
      </div>
      <div style={{ height, minWidth: 0 }}>
        {children}
      </div>
    </div>
  )
}
