import type { TabDef } from '../tabs'

interface SidebarProps {
  tabs: TabDef[]
  activeId: string
  onSelect: (id: string) => void
  isOpen: boolean
  onToggle: () => void
  isDark: boolean
}

export function Sidebar({ tabs, activeId, onSelect, isOpen, onToggle, isDark }: SidebarProps) {
  const bg = isDark ? '#1e293b' : '#ffffff'
  const border = isDark ? '#334155' : '#e2e8f0'
  const textMuted = isDark ? '#64748b' : '#94a3b8'
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a'
  const activeBg = isDark ? '#1e3a5f' : '#eff6ff'
  const activeColor = isDark ? '#93c5fd' : '#2563eb'
  const hoverBg = isDark ? '#0f172a' : '#f8fafc'

  return (
    <aside
      style={{
        width: isOpen ? 180 : 60,
        minHeight: '100vh',
        background: bg,
        borderRight: `1px solid ${border}`,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.25s ease',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {/* 햄버거 버튼 */}
      <button
        onClick={onToggle}
        title={isOpen ? '메뉴 닫기' : '메뉴 열기'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          padding: '16px 18px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: textPrimary,
          borderBottom: `1px solid ${border}`,
          width: '100%',
          textAlign: 'left',
          flexShrink: 0,
        }}
      >
        <HamburgerIcon />
        {isOpen && (
          <span style={{ fontWeight: 700, fontSize: '0.9rem', whiteSpace: 'nowrap', color: textPrimary }}>
          </span>
        )}
      </button>

      {/* 탭 목록 */}
      <nav style={{ padding: '8px 0', flex: 1 }}>
        {tabs.map(tab => {
          const isActive = tab.id === activeId
          return (
            <button
              key={tab.id}
              onClick={() => onSelect(tab.id)}
              title={!isOpen ? tab.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 0,
                width: '100%',
                padding: '10px 18px',
                background: isActive ? activeBg : 'none',
                border: 'none',
                borderLeft: `3px solid ${isActive ? activeColor : 'transparent'}`,
                cursor: 'pointer',
                color: isActive ? activeColor : textMuted,
                fontWeight: isActive ? 600 : 400,
                fontSize: '0.875rem',
                textAlign: 'left',
                transition: 'background 0.15s, color 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = hoverBg
              }}
              onMouseLeave={e => {
                if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'none'
              }}
            >
              <span style={{ fontSize: '1.1rem', flexShrink: 0 }}></span>
              {isOpen && <span>{tab.label}</span>}
            </button>
          )
        })}
      </nav>

      {/* 다크모드 토글 */}
      <div style={{ padding: '12px 0', borderTop: `1px solid ${border}` }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 18px',
            fontSize: '0.8rem',
            color: textMuted,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ fontSize: '1rem', flexShrink: 0 }}>
            {isDark ? '🌙' : '☀️'}
          </span>
          {isOpen && <span>{isDark ? '다크 모드' : '라이트 모드'}</span>}
        </div>
      </div>
    </aside>
  )
}

function HamburgerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
      <rect y="2" width="18" height="2" rx="1" />
      <rect y="8" width="18" height="2" rx="1" />
      <rect y="14" width="18" height="2" rx="1" />
    </svg>
  )
}
