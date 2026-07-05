import { useState, Suspense } from 'react'
import { TABS } from '../tabs'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const [isDark, setIsDark] = useState(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTabId, setActiveTabId] = useState(TABS[0].id)

  const activeTab = TABS.find(t => t.id === activeTabId) ?? TABS[0]
  const ActiveComponent = activeTab.component

  const bg = isDark ? '#0f172a' : '#f8fafc'

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: bg,
        color: isDark ? '#f1f5f9' : '#0f172a',
        fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
        transition: 'background 0.3s, color 0.3s',
      }}
    >
      <Sidebar
        tabs={TABS}
        activeId={activeTabId}
        onSelect={setActiveTabId}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(p => !p)}
        isDark={isDark}
      />

      <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
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
          <ActiveComponent isDark={isDark} onToggleDark={() => setIsDark(d => !d)} />
        </Suspense>
      </main>
    </div>
  )
}
