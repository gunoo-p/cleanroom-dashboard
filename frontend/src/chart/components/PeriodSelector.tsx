// 차트 조회 기간(1일/1주일/1개월/6개월/1년) 선택 버튼 그룹.
import type { ChartPeriod } from '../types'
import { PERIOD_OPTIONS } from '../constants'

interface Props {
  value: ChartPeriod
  onChange: (period: ChartPeriod) => void
  isDark: boolean
}

export function PeriodSelector({ value, onChange, isDark }: Props) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 4, paddingTop: 8, flexShrink: 0 }}>
      {PERIOD_OPTIONS.map(opt => {
        const active = opt.key === value
        return (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            style={{
              padding: '5px 14px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: active ? 700 : 500,
              background: active ? (isDark ? '#1e3a5f' : '#eff6ff') : 'transparent',
              color: active ? (isDark ? '#93c5fd' : '#2563eb') : (isDark ? '#64748b' : '#94a3b8'),
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
