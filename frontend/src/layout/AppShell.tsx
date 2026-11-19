// 앱 전체 레이아웃: 사이드바 + 활성 탭 콘텐츠를 조합하는 최상위 셸.
import { useState, Suspense } from 'react'
import { TABS } from '../tabs'
import { Sidebar } from './Sidebar'
import type { Zone } from '../shared/zone'

export function AppShell() {
  const [isDark, setIsDark] = useState(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
  // 모바일(index.css의 640px 기준)에선 사이드바가 본문을 덮는 오버레이라 닫힌 채로 시작하고, 탭을 고르면 닫는다.
  const isMobile = () => window.matchMedia('(max-width: 640px)').matches
  const [sidebarOpen, setSidebarOpen] = useState(() => !isMobile())
  const [activeTabId, setActiveTabId] = useState(TABS[0].id)
  const [zone, setZone] = useState<Zone>('A')

  const activeTab = TABS.find(t => t.id === activeTabId) ?? TABS[0]
  const ActiveComponent = activeTab.component

  const bg = isDark ? '#0f172a' : '#f8fafc'

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: bg,
        color: isDark ? '#f1f5f9' : '#0f172a',
        fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
        transition: 'background 0.3s, color 0.3s',
      }}
    >
      <Sidebar
        tabs={TABS}
        activeId={activeTabId}
        onSelect={id => {
          setActiveTabId(id)
          if (isMobile()) setSidebarOpen(false)
        }}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(p => !p)}
        isDark={isDark}
        onToggleDark={() => setIsDark(d => !d)}
      />

      <main style={{ flex: 1, minWidth: 0, height: '100%', overflowY: 'auto' }}>
        <Suspense
          fallback={
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100vh',
              color: isDark ? '#64748b' : '#94a3b8',
              fontSize: '0.9rem',
            }}>
              로딩 중...
            </div>
          }
        >
          <ActiveComponent
            isDark={isDark}
            zone={zone}
            onZoneChange={setZone}
          />
        </Suspense>
      </main>
    </div>
  )
}
