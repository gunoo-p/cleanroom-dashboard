// 대시보드(차트) 탭의 메인 컴포넌트: 실시간 센서값·시계열 차트·구역 선택을 조합한다.
import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { DashboardData, SensorKey, ChartPeriod } from './types'
import { normalizeSeries } from './normalize'
import { buildDashboardData, statusFor, type RawPoint } from './deriveDashboard'
import { PERIOD_OPTIONS, SENSOR_CONFIGS, type PeriodOption } from './constants'
import { Header } from './components/Header'
import { SensorBox } from './components/SensorBox'
import { SensorChart } from './components/SensorChart'
import { PeriodSelector } from './components/PeriodSelector'
import { ZoneSelector } from '../shared/ZoneSelector'
import { zoneDeviceId, type Zone } from '../shared/zone'

interface HistoryRow {
  time: string
  temperature: number | null
  humidity: number | null
  pressure: number | null
  gas: number | null
  air_quality: number | null
}

async function fetchDashboard(deviceId: string, option: PeriodOption): Promise<DashboardData> {
  const to = new Date()
  const from = new Date(to)
  from.setDate(from.getDate() - option.days)

  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
    interval_minutes: String(option.intervalMinutes),
  })
  const url = `/api/sensors/${deviceId}/history?${params}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('API error')
  const rows: HistoryRow[] = await res.json()

  const raw: RawPoint[] = rows
    .filter((r): r is HistoryRow & Record<'temperature' | 'humidity' | 'pressure' | 'gas' | 'air_quality', number> =>
      r.temperature != null && r.humidity != null && r.pressure != null && r.gas != null && r.air_quality != null)
    .map(r => ({ t: r.time, temp: r.temperature, hum: r.humidity, gas: r.gas, pm: r.air_quality, pressure: r.pressure }))

  if (raw.length === 0) throw new Error('no data')

  return buildDashboardData(deviceId, raw)
}

interface LatestRow {
  time: string
  temperature: number | null
  humidity: number | null
  pressure: number | null
  gas: number | null
  air_quality: number | null
}

interface LiveReading {
  time: string
  temp: number
  hum: number
  gas: number
  pm: number
  pressure: number
}

async function fetchLatest(deviceId: string): Promise<LiveReading> {
  const res = await fetch(`/api/sensors/${deviceId}/latest`)
  if (!res.ok) throw new Error('API error')
  const row: LatestRow = await res.json()
  if (row.temperature == null || row.humidity == null || row.pressure == null || row.gas == null || row.air_quality == null) {
    throw new Error('incomplete data')
  }
  return { time: row.time, temp: row.temperature, hum: row.humidity, gas: row.gas, pm: row.air_quality, pressure: row.pressure }
}

// 장치가 멈춰도 /latest는 DB에 남아있는 마지막 값을 계속 정상 응답하므로(에러가 안 남),
// 응답 성공 여부가 아니라 그 값의 시각이 얼마나 오래됐는지로 온라인/오프라인을 판단해야 한다.
// 실기기(1초)·시뮬레이터(3초) 모두 감안해 여유 있게 15초를 기준으로 잡는다.
const STALE_MS = 15_000

function offlineLabel(lastSeenMs: number): string {
  const sec = Math.floor((Date.now() - lastSeenMs) / 1000)
  return sec < 60 ? `${sec}초째 데이터 없음` : `${Math.floor(sec / 60)}분째 데이터 없음`
}

interface DashboardProps {
  isDark: boolean
  zone: Zone
  onZoneChange: (zone: Zone) => void
}

export function Dashboard({ isDark, zone, onZoneChange }: DashboardProps) {
  const [highlightedSensors, setHighlightedSensors] = useState<SensorKey[]>([])
  const [period, setPeriod] = useState<ChartPeriod>('1d')

  const periodOption = PERIOD_OPTIONS.find(o => o.key === period)!
  const deviceId = zoneDeviceId(zone)

  const { data: current, isError } = useQuery<DashboardData>({
    queryKey: ['dashboard', deviceId, period],
    queryFn: () => fetchDashboard(deviceId, periodOption),
    refetchInterval: 10_000,
    retry: false,
  })

  // 차트(시계열)는 위 쿼리로 느긋하게 갱신하고, 상단 실시간 수치만 짧은 주기로 따로 폴링한다.
  // 데이터 폭을 늘리지 않고도(=차트가 무거워지지 않고도) 체감 실시간성을 확보하기 위함.
  const { data: live } = useQuery<LiveReading>({
    queryKey: ['latest', deviceId],
    queryFn: () => fetchLatest(deviceId),
    refetchInterval: 3_000,
    retry: false,
    enabled: current != null,
  })

  // react-query는 폴링 응답 내용이 이전과 동일하면(=센서가 멈춰서 같은 마지막 값만 반복 수신)
  // 구조적으로 같은 데이터로 보고 리렌더링을 생략한다(structuralSharing). 그러면 이 컴포넌트가
  // 다시 렌더링될 일이 없어져서 "지금 시각 - 마지막 수신 시각" 계산이 멈춘 시점에 얼어붙어버리고,
  // 실제로는 오프라인인데 화면엔 계속 "온라인"으로 남는 문제가 생긴다. 그래서 데이터 변화와
  // 무관하게 일정 주기로 강제 리렌더링을 트리거해 신선도 계산이 항상 현재 시각 기준으로 돌게 한다.
  const [, forceTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => forceTick(t => t + 1), 1_000)
    return () => clearInterval(id)
  }, [])

  const liveCurrent = useMemo(() => {
    if (!current) return null
    if (!live) return current.current
    const merge = (key: SensorKey) => ({
      ...current.current[key],
      value: +live[key].toFixed(key === 'gas' ? 0 : 1),
      status: statusFor(key, live[key]),
    })
    return { temp: merge('temp'), hum: merge('hum'), gas: merge('gas'), pm: merge('pm'), pressure: merge('pressure') }
  }, [current, live])

  const lastSeenMs = live ? new Date(live.time).getTime() : null
  const isOnline = lastSeenMs != null ? Date.now() - lastSeenMs < STALE_MS : null

  const normalized = useMemo(() => current ? normalizeSeries(current.points) : [], [current])

  const sparkData = (key: SensorKey) =>
    current ? current.points.slice(-48).map(p => p[key]) : []

  const handleSensorClick = (key: SensorKey) => {
    setHighlightedSensors(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const bg = isDark ? '#0f172a' : '#f8fafc'
  const cardBg = isDark ? '#1e293b' : '#ffffff'
  const textMuted = isDark ? '#64748b' : '#94a3b8'

  return (
    <div style={{
      minHeight: '100vh',
      background: bg,
      color: isDark ? '#f1f5f9' : '#0f172a',
      fontFamily: "'Pretendard', 'Apple SD Gothic Neo', sans-serif",
      padding: '20px 24px',
      boxSizing: 'border-box',
      transition: 'background 0.3s, color 0.3s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
        <ZoneSelector value={zone} onChange={onZoneChange} isDark={isDark} />
      </div>

      {!current || !liveCurrent ? (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '60vh', color: textMuted, fontSize: '0.95rem', flexDirection: 'column', gap: 8,
        }}>
          <span>{isError ? '⚠ 연결 실패' : '불러오는 중...'}</span>
          {isError && <span style={{ fontSize: '0.78rem' }}>{deviceId} 장치의 데이터를 가져올 수 없습니다.</span>}
        </div>
      ) : (
      <>
      <Header
        isDark={isDark}
        deviceId={current.device_id}
        isOnline={isOnline}
        offlineLabel={lastSeenMs != null ? offlineLabel(lastSeenMs) : ''}
      />

      {/* 센서값 5개: 차트 위에 가로로 배열(좁아지면 자동 줄바꿈) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 12,
        marginBottom: 16,
      }}>
        {SENSOR_CONFIGS.map(cfg => (
          <SensorBox
            key={cfg.key}
            sensorKey={cfg.key}
            meta={liveCurrent[cfg.key]}
            sparkData={sparkData(cfg.key)}
            highlighted={highlightedSensors.length === 0 || highlightedSensors.includes(cfg.key)}
            onClick={handleSensorClick}
            isDark={isDark}
          />
        ))}
      </div>

      {/* 차트 */}
      <div style={{
        background: cardBg,
        borderRadius: 12,
        padding: '16px 8px 4px 0',
        height: 420,
        border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <SensorChart
            data={normalized}
            highlightedSensors={highlightedSensors}
            isDark={isDark}
            period={period}
          />
        </div>
        <PeriodSelector value={period} options={PERIOD_OPTIONS} onChange={setPeriod} isDark={isDark} />
      </div>

      {/* 범례 */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 14,
        fontSize: '0.75rem', color: isDark ? '#64748b' : '#94a3b8',
        justifyContent: 'center',
      }}>
        <span>Y축: 정규화값 (0~100, 구간 min–max 기준)</span>
        <span>·</span>
        <span>클릭: 항목 강조(여러 개 선택 가능) / 재클릭: 해제</span>
      </div>
      </>
      )}
    </div>
  )
}
