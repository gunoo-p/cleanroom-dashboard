// 대시보드(차트) 탭의 메인 컴포넌트: 실시간 센서값·시계열 차트·구역 선택을 조합한다.
import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { DashboardData, FocusMode, SensorKey, ChartPeriod } from './types'
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
  temperature: number | null
  humidity: number | null
  pressure: number | null
  gas: number | null
  air_quality: number | null
}

interface LiveReading {
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
  return { temp: row.temperature, hum: row.humidity, gas: row.gas, pm: row.air_quality, pressure: row.pressure }
}

interface DashboardProps {
  isDark: boolean
  onToggleDark: () => void
  zone: Zone
  onZoneChange: (zone: Zone) => void
}

export function Dashboard({ isDark, onToggleDark, zone, onZoneChange }: DashboardProps) {
  const [focusMode, setFocusMode] = useState<FocusMode>('sensors')
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

  const liveCurrent = useMemo(() => {
    if (!current) return null
    if (!live) return current.current
    const merge = (key: keyof LiveReading) => ({
      ...current.current[key],
      value: +live[key].toFixed(key === 'gas' ? 0 : 1),
      status: statusFor(key, live[key]),
    })
    return { temp: merge('temp'), hum: merge('hum'), gas: merge('gas'), pm: merge('pm'), pressure: merge('pressure') }
  }, [current, live])

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
        defectRate={current.defect_rate_now}
        focusMode={focusMode}
        onFocusChange={setFocusMode}
        isDark={isDark}
        onToggleDark={onToggleDark}
        deviceId={current.device_id}
      />

      {/* 2열 레이아웃 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(160px,220px) 1fr',
        gridTemplateRows: 'auto',
        gap: 16,
        alignItems: 'stretch',
      }}
        className="dashboard-grid"
      >
        {/* 좌측: 온도·습도·가스·미세입자 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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

        {/* 중앙 차트 */}
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
              focusMode={focusMode}
              highlightedSensors={highlightedSensors}
              isDark={isDark}
              period={period}
            />
          </div>
          <PeriodSelector value={period} onChange={setPeriod} isDark={isDark} />
        </div>
      </div>

      {/* 범례 */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 14,
        fontSize: '0.75rem', color: isDark ? '#64748b' : '#94a3b8',
        justifyContent: 'center',
      }}>
        <span>Y축: 정규화값 (0~100, 구간 min–max 기준)</span>
        <span>·</span>
        <span>점선: 불량률 선</span>
        <span>·</span>
        <span>클릭: 항목 강조(여러 개 선택 가능) / 재클릭: 해제</span>
      </div>
      </>
      )}
    </div>
  )
}
