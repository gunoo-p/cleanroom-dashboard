// 달력 셀의 상태 점 표시기(Dots)와 특정 날짜의 로그 목록을 보여주는 모달(LogModal).
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { LogStatus } from '../types'
import { DOW, STATUS_LABEL } from '../constants'
import { SENSOR_CONFIGS } from '../../dashboard/constants'
import { fetchDayHistory } from '../api'
import { buildLogEntries, summarizeBySensor } from '../deriveLogs'
import { downloadLogsCsv } from '../exportCsv'
import { fetchDaySummary } from '../aiSummary'

// 하루 로그가 (1분 간격 × 5센서 기준) 최대 7200개까지 나올 수 있어서, "전체" 탭을 그대로 다 그리면 무거워진다.
// 실제 화면에 보이는 행(+오버스캔)만 렌더링하는 고정 행높이 가상 스크롤.
const ROW_HEIGHT = 34
const OVERSCAN = 8

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
}

// 위험/경고가 하나도 없는(=정상만 있는) 날은 점을 아예 그리지 않는다.
export function Dots({ danger, warning }: DotsProps) {
  if (danger === 0 && warning === 0) return null

  const items: LogStatus[] = [
    ...Array(Math.min(danger, MAX_DOTS)).fill('danger' as const),
    ...Array(Math.min(warning, MAX_DOTS)).fill('warning' as const),
  ]
  const visible = items.slice(0, MAX_DOTS)
  const overflow = danger + warning - visible.length

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
      {visible.map((s, i) => (
        <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: DOT_COLOR[s], flexShrink: 0 }} />
      ))}
      {overflow > 0 && (
        <span style={{ fontSize: '0.58rem', color: '#999', fontWeight: 500 }}>+{overflow}</span>
      )}
    </div>
  )
}

interface LogModalProps {
  date: { year: number; month: number; day: number }
  deviceId: string
  zoneLabel: string
  onClose: () => void
  isDark: boolean
}

export function LogModal({ date, deviceId, zoneLabel, onClose, isDark }: LogModalProps) {
  const [tab, setTab] = useState<'all' | LogStatus>('all')
  const [sensorFilter, setSensorFilter] = useState<'all' | string>('all')
  const [wantSummary, setWantSummary] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)

  const { data: logs, isLoading, isError } = useQuery({
    queryKey: ['log-calendar-day', deviceId, date.year, date.month, date.day],
    queryFn: () => fetchDayHistory(deviceId, date.year, date.month, date.day).then(rows => buildLogEntries(rows)),
    retry: false,
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const observer = new ResizeObserver(() => setViewportHeight(el.clientHeight))
    observer.observe(el)
    setViewportHeight(el.clientHeight)
    return () => observer.disconnect()
  }, [])

  // 탭/센서 필터를 바꾸면 이전 스크롤 위치가 새 목록과 안 맞으니 맨 위로 되돌린다.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0
    setScrollTop(0)
  }, [tab, sensorFilter])

  const allLogs = logs ?? []
  // 센서 필터(온도/습도/가스/공기질/기압)를 먼저 적용하고, 그 위에 상태 탭(전체/위험/경고/정상)을 적용한다.
  const sensorScoped = sensorFilter === 'all' ? allLogs : allLogs.filter(l => l.sensor === sensorFilter)
  const filtered = tab === 'all' ? sensorScoped : sensorScoped.filter(l => l.status === tab)
  // 헤더의 총계는 센서 필터와 무관하게 그 날 전체 기준(항상 동일하게 유지되는 요약).
  const danger = allLogs.filter(l => l.status === 'danger').length
  const warning = allLogs.filter(l => l.status === 'warning').length
  const normal = allLogs.filter(l => l.status === 'normal').length
  // 탭 버튼에 표기되는 개수는 현재 센서 필터가 적용된 기준(탭을 눌렀을 때 실제 보일 개수와 일치시킴).
  const dangerScoped = sensorScoped.filter(l => l.status === 'danger').length
  const warningScoped = sensorScoped.filter(l => l.status === 'warning').length
  const normalScoped = sensorScoped.filter(l => l.status === 'normal').length
  const dow = DOW[new Date(date.year, date.month - 1, date.day).getDay()]
  const dateStr = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`

  // 열 때마다 자동 호출하면 비용이 나가므로, 버튼을 눌렀을 때만 생성한다(같은 날짜는 세션 내 재사용).
  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useQuery({
    queryKey: ['log-ai-summary', deviceId, dateStr],
    queryFn: () => fetchDaySummary({ date: dateStr, zoneLabel, danger, warning, normal, bySensor: summarizeBySensor(allLogs) }),
    enabled: wantSummary && allLogs.length > 0,
    staleTime: Infinity,
    retry: false,
  })

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN)
  const endIndex = Math.min(filtered.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN)
  const visibleRows = filtered.slice(startIndex, endIndex)

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

        {/* AI 요약: 열 때 자동 호출하지 않고, 버튼을 눌러야 생성한다(불필요한 API 비용 방지) */}
        {allLogs.length > 0 && (
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
            {!wantSummary ? (
              <button
                onClick={() => setWantSummary(true)}
                style={{
                  background: 'none', border: `1px solid ${border}`, borderRadius: 6,
                  padding: '5px 12px', fontSize: '0.75rem', color: textMuted, cursor: 'pointer',
                }}
              >
                ✨ AI로 하루 요약 보기
              </button>
            ) : (
              <div style={{
                background: isDark ? '#0f172a' : '#f8fafc', borderRadius: 8,
                borderLeft: '3px solid #3B82F6', padding: '8px 12px',
              }}>
                <p style={{ fontSize: '0.68rem', fontWeight: 600, color: '#3B82F6', marginBottom: 4 }}>✨ AI 요약</p>
                {summaryLoading ? (
                  <p style={{ fontSize: '0.8rem', color: textMuted }}>요약 생성 중...</p>
                ) : summaryError ? (
                  <p style={{ fontSize: '0.8rem', color: textMuted }}>⚠ AI 요약을 생성하지 못했습니다.</p>
                ) : (
                  <p style={{ fontSize: '0.8rem', color: textPrimary, lineHeight: 1.5 }}>{summary}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* 탭 + 센서 필터 + CSV 내보내기(현재 탭/센서에 보이는 목록 기준) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', borderBottom: `1px solid ${border}`, flexShrink: 0, gap: 8 }}>
          <div style={{ display: 'flex' }}>
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
                {t === 'all' ? `전체 (${sensorScoped.length})` : `${STATUS_LABEL[t]} (${t === 'danger' ? dangerScoped : t === 'warning' ? warningScoped : normalScoped})`}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <select
              value={sensorFilter}
              onChange={e => setSensorFilter(e.target.value)}
              style={{
                background: cardBg, border: `1px solid ${border}`, borderRadius: 6,
                padding: '5px 8px', fontSize: '0.75rem', color: textPrimary, cursor: 'pointer',
              }}
            >
              <option value="all">전체 센서</option>
              {SENSOR_CONFIGS.map(cfg => (
                <option key={cfg.key} value={cfg.label}>{cfg.label}</option>
              ))}
            </select>
            <button
              onClick={() => {
                const dateStr = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
                const tabLabel = tab === 'all' ? '전체' : STATUS_LABEL[tab]
                const sensorLabel = sensorFilter === 'all' ? '' : `_${sensorFilter}`
                downloadLogsCsv(filtered, `로그_${dateStr}_${tabLabel}${sensorLabel}.csv`)
              }}
              disabled={filtered.length === 0}
              style={{
                background: 'none', border: `1px solid ${border}`, borderRadius: 6,
                padding: '5px 12px', fontSize: '0.75rem', color: textMuted,
                cursor: filtered.length === 0 ? 'default' : 'pointer',
                opacity: filtered.length === 0 ? 0.5 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              CSV 내보내기
            </button>
          </div>
        </div>

        {/* 로그 테이블 헤더 */}
        <div style={{
          display: 'grid', gridTemplateColumns: '72px 52px 130px 100px 1fr', gap: 8,
          padding: '8px 20px', background: headerBg, borderBottom: `1px solid ${border}`,
          fontSize: '0.68rem', fontWeight: 600, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0,
        }}>
          <span>시간</span><span>상태</span><span>센서</span><span>측정값</span><span>내용</span>
        </div>

        {/* 로그 목록: 실제로는 filtered.length까지 있을 수 있지만(최대 7200), 화면에 보이는 행(+오버스캔)만 그린다. */}
        <div
          ref={listRef}
          onScroll={e => setScrollTop(e.currentTarget.scrollTop)}
          style={{ overflowY: 'auto', flex: 1, position: 'relative' }}
        >
          {isLoading ? (
            <p style={{ padding: '48px 20px', textAlign: 'center', color: textMuted, fontSize: '0.85rem' }}>
              불러오는 중...
            </p>
          ) : isError ? (
            <p style={{ padding: '48px 20px', textAlign: 'center', color: textMuted, fontSize: '0.85rem' }}>
              ⚠ 데이터를 가져올 수 없습니다.
            </p>
          ) : filtered.length === 0 ? (
            <p style={{ padding: '48px 20px', textAlign: 'center', color: textMuted, fontSize: '0.85rem' }}>
              조건에 맞는 이벤트가 없습니다.
            </p>
          ) : (
            <div style={{ height: filtered.length * ROW_HEIGHT, position: 'relative' }}>
              {visibleRows.map((log, i) => {
                const index = startIndex + i
                // 같은 시각의 센서 5개가 연달아 나오는데, 매 줄 시간을 반복 표시하면 눈이 계속
                // 같은 값을 다시 읽게 돼 산만해진다 — 그룹의 첫 줄에만 시간을 보여주고, 새 시각이
                // 시작되는 줄은 구분선을 진하게 줘서 "한 시점의 센서 묶음"으로 스캔되게 한다.
                const isNewGroup = index === 0 || filtered[index - 1].time !== log.time
                const rowBg = log.status === 'danger' ? (isDark ? '#7f1d1d22' : '#fff8f8')
                  : log.status === 'warning' ? (isDark ? '#78350f22' : '#fffdf3')
                  : 'transparent'
                const badge = SEVERITY_BADGE[log.status]
                return (
                  <div key={index} style={{
                    position: 'absolute', top: index * ROW_HEIGHT, left: 0, right: 0, height: ROW_HEIGHT,
                    boxSizing: 'border-box',
                    display: 'grid', gridTemplateColumns: '72px 52px 130px 100px 1fr', gap: 8,
                    alignItems: 'center', padding: '0 20px',
                    borderBottom: `1px solid ${rowBorder}`,
                    borderTop: isNewGroup ? `1px solid ${border}` : 'none',
                    fontSize: '0.8rem', background: rowBg,
                  }}>
                    <span style={{ fontSize: '0.72rem', color: textMuted, fontFamily: "'SF Mono', 'Fira Code', monospace", whiteSpace: 'nowrap' }}>
                      {isNewGroup ? log.time : ''}
                    </span>
                    <span style={{
                      display: 'inline-block', padding: '2px 7px', borderRadius: 20, fontSize: '0.65rem', fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap',
                      background: isDark ? `${badge.text}22` : badge.bg, color: badge.text,
                    }}>
                      {STATUS_LABEL[log.status]}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.sensor}</span>
                    <span style={{ fontWeight: 600, color: textPrimary, whiteSpace: 'nowrap' }}>{log.value}</span>
                    <span style={{ fontSize: '0.72rem', color: textMuted, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.desc}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
