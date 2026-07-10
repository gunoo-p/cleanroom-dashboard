// 대시보드 상단 헤더: 타이틀·장치 ID 표시.
interface Props {
  isDark: boolean
  deviceId: string
}

export function Header({ isDark, deviceId }: Props) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '0 0 16px',
      flexWrap: 'wrap',
      borderBottom: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
      marginBottom: 16,
    }}>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: isDark ? '#f1f5f9' : '#0f172a' }}>
          스마트 팩토리 환경 모니터
        </div>
        <div style={{ fontSize: '0.78rem', color: isDark ? '#64748b' : '#94a3b8', marginTop: 2 }}>
          {deviceId}
        </div>
      </div>
    </div>
  )
}
