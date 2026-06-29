import type { FocusMode } from '../types'
import { DEFECT_COLOR } from '../constants'

interface Props {
  defectRate: number
  focusMode: FocusMode
  onFocusChange: (mode: FocusMode) => void
  isDark: boolean
  onToggleDark: () => void
  deviceId: string
}

export function Header({ defectRate, focusMode, onFocusChange, isDark, onToggleDark, deviceId }: Props) {
  const defectColor =
    defectRate >= 70 ? DEFECT_COLOR :
    defectRate >= 40 ? '#C77A0A' : '#1D9E75'

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

      {/* 현재 불량률 */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '0.72rem', color: isDark ? '#64748b' : '#94a3b8', marginBottom: 2 }}>현재 불량률</div>
        <div style={{ fontSize: '2rem', fontWeight: 900, color: defectColor, lineHeight: 1 }}>
          {defectRate.toFixed(1)}
          <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>%</span>
        </div>
      </div>

      {/* 세그먼트 토글 */}
      <div style={{
        display: 'flex',
        background: isDark ? '#0f172a' : '#f1f5f9',
        borderRadius: 8,
        padding: 3,
        gap: 2,
      }}>
        {(['sensors', 'defect'] as FocusMode[]).map(mode => (
          <button
            key={mode}
            onClick={() => onFocusChange(mode)}
            style={{
              padding: '6px 16px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontWeight: focusMode === mode ? 700 : 500,
              fontSize: '0.82rem',
              background: focusMode === mode
                ? (isDark ? '#1e3a5f' : '#fff')
                : 'transparent',
              color: focusMode === mode
                ? (isDark ? '#f1f5f9' : '#0f172a')
                : (isDark ? '#64748b' : '#94a3b8'),
              boxShadow: focusMode === mode ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {mode === 'sensors' ? '측정값' : '불량률'}
          </button>
        ))}
      </div>

      {/* 다크모드 토글 */}
      <button
        onClick={onToggleDark}
        style={{
          border: 'none',
          background: isDark ? '#1e293b' : '#f1f5f9',
          color: isDark ? '#f1f5f9' : '#0f172a',
          borderRadius: 8,
          padding: '7px 12px',
          cursor: 'pointer',
          fontSize: '1rem',
        }}
        title="다크/라이트 모드 전환"
      >
        {isDark ? '☀️' : '🌙'}
      </button>
    </div>
  )
}
