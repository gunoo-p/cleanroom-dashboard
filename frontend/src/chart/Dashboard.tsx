import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { DashboardData, FocusMode, SensorKey, ChartPeriod } from './types'
import { generateMockData } from './mockData'
import { normalizeSeries } from './normalize'
import { buildDashboardData, statusFor, type RawPoint } from './deriveDashboard'
import { PERIOD_OPTIONS, type PeriodOption } from './constants'
import { Header } from './components/Header'
import { SensorBox } from './components/SensorBox'
import { SensorChart } from './components/SensorChart'
import { PeriodSelector } from './components/PeriodSelector'

const FALLBACK_DEVICE_ID = 'esp32-A1'

async function fetchDevices(): Promise<string[]> {
  const res = await fetch('/api/devices')
  if (!res.ok) throw new Error('API error')
  return res.json()
}

const mockCache = new Map<ChartPeriod, DashboardData>()
function getMockData(period: ChartPeriod): DashboardData {
  if (!mockCache.has(period)) {
    const option = PERIOD_OPTIONS.find(o => o.key === period)!
    mockCache.set(period, generateMockData(option))
  }
  return mockCache.get(period)!
}

interface HistoryRow {
  time: string
  temperature: number | null
  humidity: number | null
  pm25: number | null
  gas: number | null
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
    .filter((r): r is HistoryRow & Record<'temperature' | 'humidity' | 'pm25' | 'gas', number> =>
      r.temperature != null && r.humidity != null && r.pm25 != null && r.gas != null)
    .map(r => ({ t: r.time, temp: r.temperature, hum: r.humidity, gas: r.gas, pm: r.pm25 }))

  if (raw.length === 0) throw new Error('no data')

  return buildDashboardData(deviceId, raw)
}

interface LatestRow {
  temperature: number | null
  humidity: number | null
  pm25: number | null
  gas: number | null
}

interface LiveReading {
  temp: number
  hum: number
  gas: number
  pm: number
}

async function fetchLatest(deviceId: string): Promise<LiveReading> {
  const res = await fetch(`/api/sensors/${deviceId}/latest`)
  if (!res.ok) throw new Error('API error')
  const row: LatestRow = await res.json()
  if (row.temperature == null || row.humidity == null || row.pm25 == null || row.gas == null) {
    throw new Error('incomplete data')
  }
  return { temp: row.temperature, hum: row.humidity, gas: row.gas, pm: row.pm25 }
}

interface DashboardProps {
  isDark: boolean
  onToggleDark: () => void
}

export function Dashboard({ isDark, onToggleDark }: DashboardProps) {
  const [focusMode, setFocusMode] = useState<FocusMode>('sensors')
  const [highlightedSensor, setHighlightedSensor] = useState<SensorKey | null>(null)
  const [period, setPeriod] = useState<ChartPeriod>('1d')

  const periodOption = PERIOD_OPTIONS.find(o => o.key === period)!
  const fallbackData = getMockData(period)

  const { data: devices } = useQuery<string[]>({
    queryKey: ['devices'],
    queryFn: fetchDevices,
    refetchInterval: 30_000,
    retry: false,
  })
  const deviceId = devices?.[0] ?? FALLBACK_DEVICE_ID

  const { data: current = fallbackData } = useQuery<DashboardData>({
    queryKey: ['dashboard', deviceId, period],
    queryFn: () => fetchDashboard(deviceId, periodOption),
    refetchInterval: 10_000,
    retry: false,
    placeholderData: fallbackData,
  })

  // 차트(시계열)는 위 쿼리로 느긋하게 갱신하고, 상단 실시간 수치만 짧은 주기로 따로 폴링한다.
  // 데이터 폭을 늘리지 않고도(=차트가 무거워지지 않고도) 체감 실시간성을 확보하기 위함.
  const { data: live } = useQuery<LiveReading>({
    queryKey: ['latest', deviceId],
    queryFn: () => fetchLatest(deviceId),
    refetchInterval: 3_000,
    retry: false,
  })

  const liveCurrent = useMemo(() => {
    if (!live) return current.current
    const merge = (key: SensorKey) => ({
      ...current.current[key],
      value: +live[key].toFixed(key === 'gas' ? 0 : 1),
      status: statusFor(key, live[key]),
    })
    return { temp: merge('temp'), hum: merge('hum'), gas: merge('gas'), pm: merge('pm') }
  }, [current.current, live])

  const normalized = useMemo(() => normalizeSeries(current.points), [current.points])

  const sparkData = (key: SensorKey) =>
    current.points.slice(-48).map(p => p[key])

  const handleSensorClick = (key: SensorKey) => {
    setHighlightedSensor(prev => prev === key ? null : key)
  }

  const bg = isDark ? '#0f172a' : '#f8fafc'
  const cardBg = isDark ? '#1e293b' : '#ffffff'

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
          {(['temp', 'hum', 'gas', 'pm'] as SensorKey[]).map(key => (
            <SensorBox
              key={key}
              sensorKey={key}
              meta={liveCurrent[key]}
              sparkData={sparkData(key)}
              highlighted={highlightedSensor === null || highlightedSensor === key}
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
              highlightedSensor={highlightedSensor}
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
        <span>클릭: 항목 강조 / 재클릭: 해제</span>
      </div>
    </div>
  )
}
