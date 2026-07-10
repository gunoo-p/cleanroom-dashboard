// 달력 셀의 상태 점 표시기(Dots)와 특정 날짜의 로그 목록을 보여주는 모달(LogModal).
import { useEffect, useState } from 'react'
import type { LogEntry, LogStatus } from '../mockLogs'
import { DOW, STATUS_LABEL } from '../mockLogs'

const DOT_COLOR: Record<LogStatus, string> = {
  danger: '#E0473C',
  warning: '#C77A0A',
  normal: '#94a3b8',
}

const SEVERITY_BADGE: Record<LogStatus, { bg: string; text: string }> = {
  danger: { bg: '#FEE2E2', text: '#E0473C' },
  warning: { bg: '#FEF3C7', text: '#C77A0A' },
  normal: { bg: '#D1FAE5', text: '#1D9E75' },
}

const MAX_DOTS = 4

interface DotsProps {
  danger: number
  warning: number
  normal: number
}

export function Dots({ danger, warning, normal }: DotsProps) {
  const items: LogStatus[] = [
    ...Array(Math.min(danger, MAX_DOTS)).fill('danger' as const),
    ...Array(Math.min(warning, MAX_DOTS)).fill('warning' as const),
    ...Array(Math.min(normal, MAX_DOTS)).fill('normal' as const),
  ]
  const visible = items.slice(0, MAX_DOTS)
  const overflow = danger + warning + normal - visible.length

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
      {visible.map((s, i) => (
        <span key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: DOT_COLOR[s], flexShrink: 0 }} />
      ))}
      {overflow > 0 && (
        <span style={{ fontSize: '0.65rem', color: '#999', fontWeight: 500 }}>+{overflow}</span>
      )}
    </div>
  )
}

interface LogModalProps {
  date: { year: number; month: number; day: number }
  logs: LogEntry[]
  onClose: () => void
  isDark: boolean
}

export function LogModal({ date, logs, onClose, isDark }: LogModalProps) {
  const [tab, setTab] = useState<'all' | LogStatus>('all')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const filtered = tab === 'all' ? logs : logs.filter(l => l.status === tab)
  const danger = logs.filter(l => l.status === 'danger').length
  const warning = logs.filter(l => l.status === 'warning').length
  const normal = logs.filter(l => l.status === 'normal').length
  const dow = DOW[new Date(date.year, date.month - 1, date.day).getDay()]

  const cardBg = isDark ? '#1e293b' : '#ffffff'
  const border = isDark ? '#334155' : '#e8e8e8'
  const textPrimary = isDark ? '#f1f5f9' : '#0f172a'
  const textMuted = isDark ? '#94a3b8' : '#666666'
  const headerBg = isDark ? '#0f172a' : '#fafafa'
  const rowBorder = isDark ? '#334155' : '#f5f5f5'

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div style={{
        background: cardBg, borderRadius: 14, border: `1px solid ${border}`,
        width: 'min(720px, 94vw)', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4, color: textPrimary }}>
              {date.year}년 {date.month}월 {date.day}일 ({dow})
            </h3>
            <p style={{ fontSize: '0.8rem', color: textMuted }}>
              <span style={{ color: '#E0473C', fontWeight: 500 }}>위험 {danger}</span>
              {' · '}
              <span style={{ color: '#C77A0A', fontWeight: 500 }}>경고 {warning}</span>
              {' · '}
              <span>정상 {normal}</span>
              {' · '}총 {danger + warning + normal}건
            </p>
          </div>
          <button onClick={onClose} aria-label="닫기" style={{ background: 'none', border: 'none', fontSize: '1rem', cursor: 'pointer', color: textMuted, padding: '2px 6px', borderRadius: 6 }}>
            ✕
          </button>
        </div>

        {/* 탭 */}
        <div style={{ display: 'flex', padding: '0 20px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
          {(['all', 'danger', 'warning', 'normal'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: 'none', border: 'none',
                borderBottom: `2px solid ${tab === t ? '#3B82F6' : 'transparent'}`,
                padding: '10px 14px', fontSize: '0.8rem', cursor: 'pointer',
                color: tab === t ? '#3B82F6' : textMuted,
                fontWeight: tab === t ? 600 : 400, whiteSpace: 'nowrap',
              }}
            >
              {t === 'all' ? `전체 (${logs.length})` : `${STATUS_LABEL[t]} (${t === 'danger' ? danger : t === 'warning' ? warning : normal})`}
            </button>
          ))}
        </div>

        {/* 로그 테이블 헤더 */}
        <div style={{
          display: 'grid', gridTemplateColumns: '72px 52px 130px 100px 1fr', gap: 8,
          padding: '8px 20px', background: headerBg, borderBottom: `1px solid ${border}`,
          fontSize: '0.68rem', fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0,
        }}>
          <span>시간</span><span>상태</span><span>센서</span><span>측정값</span><span>내용</span>
        </div>

        {/* 로그 목록 */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.length === 0 ? (
            <p style={{ padding: '48px 20px', textAlign: 'center', color: textMuted, fontSize: '0.85rem' }}>
              해당 상태의 이벤트가 없습니다.
            </p>
          ) : (
            filtered.map((log, i) => {
              const rowBg = log.status === 'danger' ? (isDark ? '#7f1d1d22' : '#fff8f8')
                : log.status === 'warning' ? (isDark ? '#78350f22' : '#fffdf3')
                : 'transparent'
              const badge = SEVERITY_BADGE[log.status]
              return (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '72px 52px 130px 100px 1fr', gap: 8,
                  alignItems: 'center', padding: '8px 20px', borderBottom: `1px solid ${rowBorder}`,
                  fontSize: '0.8rem', background: rowBg,
                }}>
                  <span style={{ fontSize: '0.72rem', color: textMuted, fontFamily: "'SF Mono', 'Fira Code', monospace", whiteSpace: 'nowrap' }}>{log.time}</span>
                  <span style={{
                    display: 'inline-block', padding: '2px 7px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap',
                    background: isDark ? `${badge.text}22` : badge.bg, color: badge.text,
                  }}>
                    {STATUS_LABEL[log.status]}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.sensor}</span>
                  <span style={{ fontWeight: 600, color: textPrimary, whiteSpace: 'nowrap' }}>{log.value}</span>
                  <span style={{ fontSize: '0.72rem', color: textMuted, lineHeight: 1.4 }}>{log.desc}</span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
