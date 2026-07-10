// 로그 캘린더 탭: 날짜별 센서 이벤트 발생 현황을 달력으로 보여주고, 클릭하면 상세 로그 모달을 띈다.
// ⚠ 데모: mockLogs.ts의 센서/임계값은 이 탭 전용이며 실제 구역·센서 설정과는 무관하다.
import { useCallback, useState } from 'react'
import type { TabProps } from '../tabs'
import { DOW, genLogs, getDotProfile } from './mockLogs'
import { Dots, LogModal } from './components/LogModal'

interface SelectedDay {
  year: number
  month: number
  day: number
  logs: ReturnType<typeof genLogs>
}

export function LogCalendarTab({ isDark }: TabProps) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [selected, setSelected] = useState<SelectedDay | null>(null)

  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1)
  }

  const openDay = useCallback((day: number) => {
    setSelected({ year, month, day, logs: genLogs(year, month, day) })
  }, [year, month])

  const bg = isDark ? '#0f172a' : '#f8fafc'
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a'
  const textMuted = isDark ? '#64748b' : '#94a3b8'
  const cellBg = isDark ? '#1e293b' : '#f7f5f0'
  const cellHoverBorder = isDark ? '#475569' : '#cccccc'

  return (
    <div style={{
      minHeight: '100vh',
      background: bg,
      color: textPrimary,
      fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
      padding: '20px 24px',
      boxSizing: 'border-box',
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <button
            onClick={prevMonth}
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: '8px 16px', color: textMuted, borderRadius: 8 }}
          >
            ‹
          </button>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: textPrimary }}>{year}년 {month}월</h2>
          <button
            onClick={nextMonth}
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: '8px 16px', color: textMuted, borderRadius: 8 }}
          >
            ›
          </button>
        </div>

        {/* 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12 }}>
          {DOW.map((d, i) => (
            <div
              key={d}
              style={{
                textAlign: 'center', fontSize: '0.85rem', fontWeight: 500, padding: '12px 0',
                color: i === 0 ? '#E0473C' : i === 6 ? '#3a8de0' : textMuted,
              }}
            >
              {d}
            </div>
          ))}

          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} style={{ aspectRatio: '1 / 1' }} />
          ))}

          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const day = idx + 1
            const dow = (firstDay + idx) % 7
            const logs = genLogs(year, month, day)
            const { danger, warning, normal } = getDotProfile(logs)
            const cellTint = danger > 0
              ? (isDark ? '#7f1d1d22' : '#fef0f0')
              : warning > 0
                ? (isDark ? '#78350f22' : '#fdf7e3')
                : cellBg
            const dayColor = dow === 0 ? '#E0473C' : dow === 6 ? '#3a8de0' : textPrimary

            return (
              <div
                key={day}
                onClick={() => openDay(day)}
                style={{
                  aspectRatio: '1 / 1',
                  borderRadius: 14,
                  padding: '12px 10px 10px',
                  cursor: 'pointer',
                  background: cellTint,
                  border: '2px solid transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = cellHoverBorder }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent' }}
              >
                <span style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 10, color: dayColor }}>{day}</span>
                <Dots danger={danger} warning={warning} normal={normal} />
              </div>
            )
          })}
        </div>

        {/* 범례 */}
        <div style={{ display: 'flex', gap: 18, marginTop: 16, fontSize: '0.85rem', color: textMuted }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#E0473C', display: 'inline-block' }} />위험
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#C77A0A', display: 'inline-block' }} />경고
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#94a3b8', display: 'inline-block' }} />정상
          </span>
        </div>

        {/* 모달 */}
        {selected && (
          <LogModal date={selected} logs={selected.logs} onClose={() => setSelected(null)} isDark={isDark} />
        )}
      </div>
    </div>
  )
}
