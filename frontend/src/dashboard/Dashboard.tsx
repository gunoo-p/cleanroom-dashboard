// 대시보드(차트) 탭의 메인 컴포넌트: 실시간 센서값·시계열 차트·구역 선택을 조합한다.
import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { DashboardData, SensorKey, SensorMeta, ChartPeriod } from './types'
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
  pressure_outside: number | null
  gas: number | null
  air_quality: number | null
}

// 실내-실외 절대기압(hPa) 차이를 Pa 단위 차압으로 변환. 날씨에 따라 둘 다 같이 오르내리는
// 공통 성분이 빼기 과정에서 상쇄되고, 실제 클린룸 양압 상태만 남는다.
function pressureDiffPa(inside: number, outside: number): number {
  return (inside - outside) * 100
}

// 선택한 기간에 데이터가 그냥 없는 것(백엔드 404)과 진짜 연결 실패를 구분하기 위한 에러 타입.
// 예전엔 둘 다 "⚠ 연결 실패"로 뭉뚱그려 보여줘서, 기간을 길게 잡으면 정상인데도 오류처럼 보였다.
class NoDataError extends Error {}

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
  if (res.status === 404) throw new NoDataError('no data')
  if (!res.ok) throw new Error('API error')
  const rows: HistoryRow[] = await res.json()

  const raw: RawPoint[] = rows
    .filter((r): r is HistoryRow & Record<'temperature' | 'humidity' | 'pressure' | 'pressure_outside' | 'gas' | 'air_quality', number> =>
      r.temperature != null && r.humidity != null && r.pressure != null && r.pressure_outside != null && r.gas != null && r.air_quality != null)
    .map(r => ({ t: r.time, temp: r.temperature, hum: r.humidity, gas: r.gas, pm: r.air_quality, pressure: pressureDiffPa(r.pressure, r.pressure_outside) }))

  if (raw.length === 0) throw new NoDataError('no data')

  return buildDashboardData(deviceId, raw)
}

interface LatestRow {
  time: string
  temperature: number | null
  humidity: number | null
  pressure: number | null
  pressure_outside: number | null
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
  if (row.temperature == null || row.humidity == null || row.pressure == null || row.pressure_outside == null || row.gas == null || row.air_quality == null) {
    throw new Error('incomplete data')
  }
  return { time: row.time, temp: row.temperature, hum: row.humidity, gas: row.gas, pm: row.air_quality, pressure: pressureDiffPa(row.pressure, row.pressure_outside) }
}

// 장치가 멈춰도 /latest는 DB에 남아있는 마지막 값을 계속 정상 응답하므로(에러가 안 남),
// 응답 성공 여부가 아니라 그 값의 시각이 얼마나 오래됐는지로 온라인/오프라인을 판단해야 한다.
// 실기기(1초)·시뮬레이터(3초) 모두 감안해 여유 있게 15초를 기준으로 잡는다.
const STALE_MS = 15_000

function offlineLabel(lastSeenMs: number): string {
  const sec = Math.floor((Date.now() - lastSeenMs) / 1000)
  if (sec < 60) return `${sec}초째 데이터 없음`

  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}분째 데이터 없음`

  const hour = Math.floor(min / 60)
  const remMin = min % 60
  if (hour < 24) return remMin > 0 ? `${hour}시간 ${remMin}분동안 데이터 없음` : `${hour}시간동안 데이터 없음`

  const day = Math.floor(hour / 24)
  const remHour = hour % 24
  return remHour > 0 ? `${day}일 ${remHour}시간동안 데이터 없음` : `${day}일동안 데이터 없음`
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

  const { data: current, isError, error } = useQuery<DashboardData>({
    queryKey: ['dashboard', deviceId, period],
    queryFn: () => fetchDashboard(deviceId, periodOption),
    refetchInterval: 10_000,
    retry: false,
  })
  const noDataForPeriod = error instanceof NoDataError

  // 차트(시계열)는 위 쿼리로 느긋하게 갱신하고, 상단 실시간 수치만 짧은 주기로 따로 폴링한다.
  // 데이터 폭을 늘리지 않고도(=차트가 무거워지지 않고도) 체감 실시간성을 확보하기 위함.
  // current(선택 기간 히스토리)가 없어도(예: "1일"인데 기기가 하루 넘게 멈춤) 연결 상태 배지는
  // 계속 보여줘야 하므로, current 존재 여부와 무관하게 항상 폴링한다.
  const { data: live, isError: liveIsError } = useQuery<LiveReading>({
    queryKey: ['latest', deviceId],
    queryFn: () => fetchLatest(deviceId),
    refetchInterval: 3_000,
    retry: false,
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

  // 선택한 기간엔 히스토리가 없어도(current == null) /latest는 성공한 경우, 차트에 쓸 최소/최대/평균은
  // 없지만 현재값만이라도 보여줄 수 있게 하는 대체 표시용 데이터(최소/최대/평균은 현재값으로 채움).
  const liveOnlyCurrent = useMemo((): Record<SensorKey, SensorMeta> | null => {
    if (!live) return null
    const build = (key: SensorKey): SensorMeta => {
      const value = +live[key].toFixed(key === 'gas' ? 0 : 1)
      const unit = SENSOR_CONFIGS.find(c => c.key === key)!.unit
      return { value, unit, status: statusFor(key, live[key]), min: value, max: value, avg: value }
    }
    return { temp: build('temp'), hum: build('hum'), gas: build('gas'), pm: build('pm'), pressure: build('pressure') }
  }, [live])

  const displayCurrent = liveCurrent ?? liveOnlyCurrent

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

      {live == null && !liveIsError && current == null && !isError ? (
        // 아직 아무 응답도 안 온 최초 로딩
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '60vh', color: textMuted, fontSize: '0.95rem',
        }}>
          불러오는 중...
        </div>
      ) : live == null ? (
        // /latest조차 한 번도 성공한 적 없음 — 이 장치에서 데이터를 받은 적이 아예 없거나 백엔드 문제
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '60vh', color: textMuted, fontSize: '0.95rem', flexDirection: 'column', gap: 8,
        }}>
          <span>⚠ 연결 실패</span>
          <span style={{ fontSize: '0.78rem' }}>{deviceId} 장치의 데이터를 가져올 수 없습니다.</span>
        </div>
      ) : (
      <>
      <Header
        isDark={isDark}
        deviceId={deviceId}
        isOnline={isOnline}
        offlineLabel={lastSeenMs != null ? offlineLabel(lastSeenMs) : ''}
      />

      {/* 센서값 5개: 차트 위에 가로로 배열(좁아지면 자동 줄바꿈). current(선택 기간 히스토리)가 없어도
          /latest만 있으면 현재값은 보여준다(이때 최소/최대/평균·스파크라인은 현재값 하나뿐이라 밋밋함) */}
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
            meta={displayCurrent![cfg.key]}
            sparkData={sparkData(cfg.key)}
            highlighted={highlightedSensors.length === 0 || highlightedSensors.includes(cfg.key)}
            onClick={handleSensorClick}
            isDark={isDark}
          />
        ))}
      </div>

      {/* 차트 카드: 선택한 기간에 히스토리가 없어도 카드·기간 선택기는 항상 보여줘야 다른 기간으로
          바꿔볼 수 있다 — 안쪽 내용(차트 vs 안내 문구)만 바뀐다. */}
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
          {current ? (
            <SensorChart
              data={normalized}
              highlightedSensors={highlightedSensors}
              isDark={isDark}
              period={period}
            />
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', color: textMuted, fontSize: '0.9rem', flexDirection: 'column', gap: 6,
            }}>
              <span>{noDataForPeriod ? `선택한 기간(${periodOption.label})에는 표시할 데이터가 없습니다` : '불러오는 중...'}</span>
              {noDataForPeriod && <span style={{ fontSize: '0.78rem' }}>기간을 늘려서 다시 확인해보세요.</span>}
            </div>
          )}
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
