// 조회 기간 선택 버튼 그룹 (대시보드·분석 탭이 각자 자신의 기간 목록을 넘겨 재사용).
interface Option<T extends string> {
  key: T
  label: string
}

interface Props<T extends string> {
  value: T
  options: Option<T>[]
  onChange: (period: T) => void
  isDark: boolean
}

export function PeriodSelector<T extends string>({ value, options, onChange, isDark }: Props<T>) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 4, paddingTop: 8, flexShrink: 0 }}>
      {options.map(opt => {
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
