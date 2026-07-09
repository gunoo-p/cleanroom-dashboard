// 구역(A/B/C/D) 선택 버튼 그룹(대시보드·통계 탭 공용).
import { ZONES, type Zone } from './zone'

interface Props {
  value: Zone
  onChange: (zone: Zone) => void
  isDark: boolean
}

export function ZoneSelector({ value, onChange, isDark }: Props) {
  return (
    <div style={{
      display: 'flex',
      background: isDark ? '#0f172a' : '#f1f5f9',
      borderRadius: 8,
      padding: 3,
      gap: 2,
    }}>
      {ZONES.map(zone => {
        const active = zone === value
        return (
          <button
            key={zone}
            onClick={() => onChange(zone)}
            title={`${zone} 구역`}
            style={{
              padding: '6px 16px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontWeight: active ? 700 : 500,
              fontSize: '0.82rem',
              background: active ? (isDark ? '#1e3a5f' : '#fff') : 'transparent',
              color: active ? (isDark ? '#f1f5f9' : '#0f172a') : (isDark ? '#64748b' : '#94a3b8'),
              boxShadow: active ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {zone} 구역
          </button>
        )
      })}
    </div>
  )
}
