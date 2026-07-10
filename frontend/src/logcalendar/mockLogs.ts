// 로그 캘린더 탭이 쓰는 데모용 mock 로그 생성기.
// ⚠ 데모: 아래 SENSORS/THRESHOLDS는 이 탭 전용 mock이며 실제 구역·센서 설정(dashboard/analysis)과는 무관하다.
import { ZONES, type Zone } from '../shared/zone'

export type LogStatus = 'normal' | 'warning' | 'danger'

interface SensorDef {
  id: string
  label: string
  unit: string
}

interface ThresholdRange {
  normal: [number, number]
  warning: [number, number]
  danger: [number, number]
}

export interface LogEntry {
  time: string
  slot: number
  status: LogStatus
  sensor: string
  value: string
  desc: string
  zone: string
}

const SENSORS: SensorDef[] = [
  { id: 'temp1', label: '온도 센서 #1', unit: '°C' },
  { id: 'temp2', label: '온도 센서 #2', unit: '°C' },
  { id: 'temp3', label: '온도 센서 #3', unit: '°C' },
  { id: 'gas1', label: '가스 센서 #1', unit: 'ppm' },
  { id: 'gas2', label: '가스 센서 #2', unit: 'ppm' },
  { id: 'dust1', label: '공기질 센서 #1', unit: 'μg/m³' },
  { id: 'dust2', label: '공기질 센서 #2', unit: 'μg/m³' },
  { id: 'humid1', label: '습도 센서 #1', unit: '%' },
  { id: 'humid2', label: '습도 센서 #2', unit: '%' },
  { id: 'humid3', label: '습도 센서 #3', unit: '%' },
]

const THRESHOLDS: Record<string, ThresholdRange> = {
  temp1: { normal: [15, 30], warning: [30, 35], danger: [35, 50] },
  temp2: { normal: [15, 30], warning: [30, 35], danger: [35, 50] },
  temp3: { normal: [15, 30], warning: [30, 35], danger: [35, 50] },
  gas1: { normal: [0, 100], warning: [100, 150], danger: [150, 300] },
  gas2: { normal: [0, 100], warning: [100, 150], danger: [150, 300] },
  dust1: { normal: [0, 35], warning: [35, 75], danger: [75, 150] },
  dust2: { normal: [0, 35], warning: [35, 75], danger: [75, 150] },
  humid1: { normal: [30, 60], warning: [60, 70], danger: [70, 100] },
  humid2: { normal: [30, 60], warning: [60, 70], danger: [70, 100] },
  humid3: { normal: [30, 60], warning: [60, 70], danger: [70, 100] },
}

export const DOW = ['일', '월', '화', '수', '목', '금', '토']
export const STATUS_LABEL: Record<LogStatus, string> = { danger: '위험', warning: '경고', normal: '정상' }

type DayProfile = 'normal' | 'warning' | 'danger'

// 하루 단위로 그날의 "성격"을 먼저 정한다(월 30일 기준 위험 ~2일 · 경고 ~5일 · 나머지 정상을 노림).
// 샘플(슬롯×센서) 단위로만 확률을 굴리면 하루 4800개 샘플 중 하나라도 걸릴 확률이 사실상 100%가 돼서
// 매일이 위험으로 보이는 문제가 있었다 — 그래서 날짜 단위로 먼저 프로필을 정하고, 정상 날은
// 위험/경고 샘플이 전혀 안 나오게 막는다.
const DAY_PROFILE_CUTOFF = { danger: 2 / 30, warning: 7 / 30 }

const DAY_PROFILE_RATES: Record<DayProfile, { danger: number; warning: number }> = {
  normal: { danger: 0, warning: 0 },
  warning: { danger: 0, warning: 0.05 },
  danger: { danger: 0.012, warning: 0.06 },
}

function seededRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b)
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b)
    s ^= s >>> 16
    return (s >>> 0) / 0xffffffff
  }
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function pickDayProfile(year: number, month: number, day: number, zoneIdx: number): DayProfile {
  const roll = seededRng(year * 1_000_000 + month * 10_000 + day * 100 + zoneIdx * 13 + 999)()
  if (roll < DAY_PROFILE_CUTOFF.danger) return 'danger'
  if (roll < DAY_PROFILE_CUTOFF.warning) return 'warning'
  return 'normal'
}

// 하루 3분 간격(00:00~23:57, 480슬롯) 로그를 시드 기반으로 생성한다(같은 날짜·구역은 항상 같은 결과).
export function genLogs(year: number, month: number, day: number, zone: Zone): LogEntry[] {
  const logs: LogEntry[] = []
  const zoneIdx = ZONES.indexOf(zone)
  const zoneLabel = `${zone} 구역`
  const dayProfile = pickDayProfile(year, month, day, zoneIdx)
  const rates = DAY_PROFILE_RATES[dayProfile]

  for (let slot = 0; slot < 480; slot++) {
    const totalMin = slot * 3
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    const timeStr = `${pad(h)}:${pad(m)}:00`

    // 낮(10~17시)에는 이상 징후가 몰리도록 가중치를 준다(정상 날은 rate가 0이라 영향 없음).
    const peakBoost = h >= 10 && h <= 17 ? 1.6 : 1
    const dangerP = rates.danger * peakBoost
    const warningP = rates.warning * peakBoost

    SENSORS.forEach((sensor, sIdx) => {
      const r = seededRng(year * 1_000_000 + month * 10_000 + day * 100 + slot * 10 + sIdx + 1 + zoneIdx * 97)
      const thr = THRESHOLDS[sensor.id]
      const roll = r()

      let status: LogStatus
      let value: string
      let desc: string

      if (roll < dangerP) {
        status = 'danger'
        const [lo, hi] = thr.danger
        value = (lo + r() * (hi - lo)).toFixed(sensor.unit === '°C' ? 1 : 0)
        desc = `${sensor.label.replace(/ #\d/, '')} 위험 임계 초과 · ${zoneLabel}`
      } else if (roll < dangerP + warningP) {
        status = 'warning'
        const [lo, hi] = thr.warning
        value = (lo + r() * (hi - lo)).toFixed(sensor.unit === '°C' ? 1 : 0)
        desc = `${sensor.label.replace(/ #\d/, '')} 경고 임계 초과 · ${zoneLabel}`
      } else {
        status = 'normal'
        const [lo, hi] = thr.normal
        value = (lo + r() * (hi - lo)).toFixed(sensor.unit === '°C' ? 1 : 0)
        desc = `정상 범위 측정 · ${zoneLabel}`
      }

      logs.push({ time: timeStr, slot, status, sensor: sensor.label, value: `${value} ${sensor.unit}`, desc, zone: zoneLabel })
    })
  }

  logs.sort((a, b) => a.time.localeCompare(b.time) || a.sensor.localeCompare(b.sensor))
  return logs
}

// 캘린더 셀은 위험/경고 "개수"만 필요하므로, genLogs처럼 4800개 로그 객체를 만들고 정렬할 필요가 없다.
// 같은 시드 로직으로 카운트만 세어 월 단위 렌더링(최대 31일)에서도 가볍게 계산한다.
export function getDayCounts(year: number, month: number, day: number, zone: Zone): { danger: number; warning: number } {
  const zoneIdx = ZONES.indexOf(zone)
  const dayProfile = pickDayProfile(year, month, day, zoneIdx)
  const rates = DAY_PROFILE_RATES[dayProfile]

  // 정상 날은 위험/경고 rate가 항상 0이라 4800번 굴려봐도 결과가 뻔하다 — 바로 반환.
  if (rates.danger === 0 && rates.warning === 0) {
    return { danger: 0, warning: 0 }
  }

  let danger = 0
  let warning = 0

  for (let slot = 0; slot < 480; slot++) {
    const h = Math.floor((slot * 3) / 60)
    const peakBoost = h >= 10 && h <= 17 ? 1.6 : 1
    const dangerP = rates.danger * peakBoost
    const warningP = rates.warning * peakBoost

    for (let sIdx = 0; sIdx < SENSORS.length; sIdx++) {
      const roll = seededRng(year * 1_000_000 + month * 10_000 + day * 100 + slot * 10 + sIdx + 1 + zoneIdx * 97)()
      if (roll < dangerP) danger++
      else if (roll < dangerP + warningP) warning++
    }
  }

  return { danger, warning }
}
