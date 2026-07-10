// 로그 캘린더 탭: 날짜별 센서 이벤트 발생 현황을 달력으로 보여주고, 클릭하면 상세 로그 모달을 띈다.
// ⚠ 데모: mockLogs.ts의 센서/임계값은 이 탭 전용이며 실제 구역·센서 설정과는 무관하다.
import { useCallback, useMemo, useState } from 'react'
import type { TabProps } from '../tabs'
import { ZoneSelector } from '../shared/ZoneSelector'
import { DOW, genLogs, getDayCounts, type LogStatus } from './mockLogs'
import { Dots, LogModal } from './components/LogModal'

interface SelectedDay {
  year: number
  month: number
  day: number
  logs: ReturnType<typeof genLogs>
}

interface DayCell {
  day: number
  danger: number
  warning: number
}

const SUMMARY_ITEMS: { status: LogStatus; label: string; color: string; bg: string }[] = [
  { status: 'danger', label: '위험', color: '#E0473C', bg: '#FEE2E2' },
  { status: 'warning', label: '경고', color: '#C77A0A', bg: '#FEF3C7' },
  { status: 'normal', label: '정상', color: '#1D9E75', bg: '#D1FAE5' },
]

export function LogCalendarTab({ isDark, zone, onZoneChange }: TabProps) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [selected, setSelected] = useState<SelectedDay | null>(null)

  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  // 리딩 빈 칸까지 포함한 총 칸 수를 7로 나눠 그 달에 필요한 행 수를 구한다(4~6행).
  const rowCount = Math.ceil((firstDay + daysInMonth) / 7)

  // 날짜별 위험/경고/정상 집계를 한 번만 계산해서, 셀 색상과 사이드 요약 카드가 같은 데이터를 공유한다.
  const monthDays: DayCell[] = useMemo(() => {
    const days: DayCell[] = []
    for (let day = 1; day <= daysInMonth; day++) {
      const { danger, warning } = getDayCounts(year, month, day, zone)
      days.push({ day, danger, warning })
    }
    return days
  }, [year, month, zone, daysInMonth])

  const monthSummary = useMemo(() => {
    const counts: Record<LogStatus, number> = { danger: 0, warning: 0, normal: 0 }
    for (const d of monthDays) {
      if (d.danger > 0) counts.danger++
      else if (d.warning > 0) counts.warning++
      else counts.normal++
    }
    return counts
  }, [monthDays])

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1)
  }

  const openDay = useCallback((day: number) => {
    setSelected({ year, month, day, logs: genLogs(year, month, day, zone) })
  }, [year, month, zone])

  const bg = isDark ? '#0f172a' : '#f8fafc'
  const cardBg = isDark ? '#1e293b' : '#ffffff'
  const border = isDark ? '#334155' : '#e2e8f0'
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a'
  const textMuted = isDark ? '#64748b' : '#94a3b8'

  const navBtnStyle = {
    background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer',
    padding: '4px 10px', color: textMuted, borderRadius: 6,
  } as const

  const cardStyle = {
    background: cardBg,
    border: `1px solid ${border}`,
    borderRadius: 12,
    minHeight: 0,
    boxSizing: 'border-box' as const,
  }

  return (
    <div style={{
      height: '100vh',
      overflow: 'hidden',
      background: bg,
      color: textPrimary,
      fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
      padding: '20px 24px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* 구역 선택 */}
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12, flexShrink: 0 }}>
        <ZoneSelector value={zone} onChange={onZoneChange} isDark={isDark} />
      </div>

      {/* 캘린더 카드 + 이번 달 요약 카드 */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16 }}>
        {/* 캘린더 카드 */}
        <div style={{ ...cardStyle, padding: '16px 16px 14px', display: 'flex', flexDirection: 'column' }}>
          {/* 헤더 */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
            borderBottom: `1px solid ${isDark ? '#1e3a5f' : '#e2e8f0'}`,
            paddingBottom: 14, marginBottom: 14, flexShrink: 0,
          }}>
            <div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: textPrimary }}>로그 캘린더</div>
              <div style={{ fontSize: '0.75rem', color: textMuted, marginTop: 2 }}>{zone} 구역 · 날짜별 센서 이벤트 발생 현황</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button onClick={prevMonth} style={navBtnStyle}>‹</button>
              <span style={{ fontSize: '0.9rem', fontWeight: 700, minWidth: 88, textAlign: 'center' }}>{year}년 {month}월</span>
              <button onClick={nextMonth} style={navBtnStyle}>›</button>
            </div>
          </div>

          {/* 요일 헤더 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', flexShrink: 0, marginBottom: 6 }}>
            {DOW.map((d, i) => (
              <div
                key={d}
                style={{
                  textAlign: 'center', fontSize: '0.72rem', fontWeight: 600, padding: '4px 0',
                  color: i === 0 ? '#E0473C' : i === 6 ? '#3B82F6' : textMuted,
                }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* 날짜 그리드: 남은 세로 공간을 행 개수로 균등 분배해서 달의 행 수(4~6)와 무관하게 스크롤이 생기지 않는다. */}
          <div style={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gridTemplateRows: `repeat(${rowCount}, 1fr)`,
            gap: 8,
          }}>
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {monthDays.map(({ day, danger, warning }) => {
              const dow = (firstDay + day - 1) % 7
              const cellBg = danger > 0
                ? (isDark ? '#7f1d1d26' : '#fef0f0')
                : warning > 0
                  ? (isDark ? '#78350f26' : '#fdf7e3')
                  : cardBg
              const cellBorder = danger > 0 ? '#E0473C55' : warning > 0 ? '#C77A0A55' : border
              const dayColor = dow === 0 ? '#E0473C' : dow === 6 ? '#3B82F6' : textPrimary

              return (
                <div
                  key={day}
                  onClick={() => openDay(day)}
                  style={{
                    borderRadius: 8,
                    padding: '7px 9px',
                    cursor: 'pointer',
                    background: cellBg,
                    border: `1px solid ${cellBorder}`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: 0,
                    transition: 'box-shadow 0.15s, transform 0.15s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.boxShadow = isDark ? '0 2px 10px rgba(0,0,0,0.4)' : '0 2px 10px rgba(0,0,0,0.1)'
                    e.currentTarget.style.transform = 'translateY(-1px)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = 'none'
                    e.currentTarget.style.transform = 'none'
                  }}
                >
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: dayColor }}>{day}</span>
                  <Dots danger={danger} warning={warning} />
                </div>
              )
            })}
          </div>
        </div>

        {/* 이번 달 요약 카드 */}
        <div style={{ ...cardStyle, padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: textPrimary }}>이번 달 요약</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SUMMARY_ITEMS.map(item => (
              <div key={item.status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', color: textMuted }}>{item.label}</span>
                <span style={{
                  background: isDark ? `${item.color}22` : item.bg,
                  color: item.color,
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  padding: '3px 10px',
                  borderRadius: 999,
                }}>
                  {monthSummary[item.status]}일
                </span>
              </div>
            ))}
          </div>

          <div style={{ borderTop: `1px solid ${border}`, paddingTop: 12, fontSize: '0.72rem', color: textMuted, lineHeight: 1.6 }}>
            날짜를 클릭하면 그날의 전체 이벤트 로그를 볼 수 있습니다.
          </div>

          <div style={{ marginTop: 'auto', fontSize: '0.66rem', color: textMuted, lineHeight: 1.4 }}>
            ⚠ 데모 데이터 · 실제 구역·센서 값과는 무관합니다.
          </div>
        </div>
      </div>

      {/* 모달 */}
      {selected && (
        <LogModal date={selected} logs={selected.logs} onClose={() => setSelected(null)} isDark={isDark} />
      )}
    </div>
  )
}
