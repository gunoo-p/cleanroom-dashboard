import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { DashboardData, FocusMode, SensorKey } from './types'
import { generateMockData } from './mockData'
import { normalizeSeries } from './normalize'
import { Header } from './components/Header'
import { SensorBox } from './components/SensorBox'
import { SensorChart } from './components/SensorChart'

const MOCK_DATA: DashboardData = generateMockData()

async function fetchDashboard(): Promise<DashboardData> {
  const today = new Date()
  const from = new Date(today); from.setHours(0, 0, 0, 0)
  const to = new Date(today); to.setHours(23, 59, 59, 999)

  const url = `/api/dashboard/series?device_id=esp32-A1&from=${from.toISOString()}&to=${to.toISOString()}`
  const res = await fetch(url)
  if (!res.ok) throw new Error('API error')
  return res.json()
}

export function Dashboard() {
  const [isDark, setIsDark] = useState(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
  const [focusMode, setFocusMode] = useState<FocusMode>('sensors')
  const [highlightedSensor, setHighlightedSensor] = useState<SensorKey | null>(null)

  const { data: current = MOCK_DATA } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: 10_000,
    retry: false,
    placeholderData: MOCK_DATA,
  })

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
        onToggleDark={() => setIsDark(d => !d)}
        deviceId={current.device_id}
      />

      {/* 3열 레이아웃 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(160px,220px) 1fr minmax(160px,220px)',
        gridTemplateRows: 'auto',
        gap: 16,
        alignItems: 'stretch',
      }}
        className="dashboard-grid"
      >
        {/* 좌측: 온도·습도 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(['temp', 'hum'] as SensorKey[]).map(key => (
            <SensorBox
              key={key}
              sensorKey={key}
              meta={current.current[key]}
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
          padding: '16px 8px 12px 0',
          height: 420,
          border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
        }}>
          <SensorChart
            data={normalized}
            focusMode={focusMode}
            highlightedSensor={highlightedSensor}
            isDark={isDark}
          />
        </div>

        {/* 우측: 가스·미세입자 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(['gas', 'pm'] as SensorKey[]).map(key => (
            <SensorBox
              key={key}
              sensorKey={key}
              meta={current.current[key]}
              sparkData={sparkData(key)}
              highlighted={highlightedSensor === null || highlightedSensor === key}
              onClick={handleSensorClick}
              isDark={isDark}
            />
          ))}
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
