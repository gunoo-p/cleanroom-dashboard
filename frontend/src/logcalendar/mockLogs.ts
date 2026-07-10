// 로그 캘린더 탭이 쓰는 데모용 mock 로그 생성기.
// ⚠ 데모: 아래 SENSORS/THRESHOLDS는 이 탭 전용 mock이며 실제 구역·센서 설정(dashboard/analysis)과는 무관하다.
export type LogStatus = 'normal' | 'warning' | 'danger'

interface SensorDef {
  id: string
  label: string
  unit: string
  zone: string
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
  { id: 'temp1', label: '온도 센서 #1', unit: '°C', zone: '공장동 A-1' },
  { id: 'temp2', label: '온도 센서 #2', unit: '°C', zone: '공장동 B-2' },
  { id: 'temp3', label: '온도 센서 #3', unit: '°C', zone: '공장동 A-1' },
  { id: 'gas1', label: '가스 센서 #1', unit: 'ppm', zone: '공장동 C-3' },
  { id: 'gas2', label: '가스 센서 #2', unit: 'ppm', zone: '공장동 B-1' },
  { id: 'dust1', label: '공기질 센서 #1', unit: 'μg/m³', zone: '공장동 A-2' },
  { id: 'dust2', label: '공기질 센서 #2', unit: 'μg/m³', zone: '공장동 B-2' },
  { id: 'humid1', label: '습도 센서 #1', unit: '%', zone: '공장동 B-2' },
  { id: 'humid2', label: '습도 센서 #2', unit: '%', zone: '공장동 C-2' },
  { id: 'humid3', label: '습도 센서 #3', unit: '%', zone: '공장동 C-3' },
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

// 하루 3분 간격(00:00~23:57, 480슬롯) 로그를 시드 기반으로 생성한다(같은 날짜는 항상 같은 결과).
export function genLogs(year: number, month: number, day: number): LogEntry[] {
  const logs: LogEntry[] = []

  for (let slot = 0; slot < 480; slot++) {
    const totalMin = slot * 3
    const h = Math.floor(totalMin / 60)
    const m = totalMin % 60
    const timeStr = `${pad(h)}:${pad(m)}:00`

    SENSORS.forEach((sensor, sIdx) => {
      const r = seededRng(year * 1_000_000 + month * 10_000 + day * 100 + slot * 10 + sIdx + 1)
      const thr = THRESHOLDS[sensor.id]

      let statusRoll = r()
      // 낮(10~17시)에 위험/경고 확률 높이기
      if (h >= 10 && h <= 17) {
        statusRoll = statusRoll * 0.7
      }

      let status: LogStatus
      let value: string
      let desc: string

      if (statusRoll < 0.06) {
        status = 'danger'
        const [lo, hi] = thr.danger
        value = (lo + r() * (hi - lo)).toFixed(sensor.unit === '°C' ? 1 : 0)
        desc = `${sensor.label.replace(/ #\d/, '')} 위험 임계 초과 · ${sensor.zone}`
      } else if (statusRoll < 0.2) {
        status = 'warning'
        const [lo, hi] = thr.warning
        value = (lo + r() * (hi - lo)).toFixed(sensor.unit === '°C' ? 1 : 0)
        desc = `${sensor.label.replace(/ #\d/, '')} 경고 임계 초과 · ${sensor.zone}`
      } else {
        status = 'normal'
        const [lo, hi] = thr.normal
        value = (lo + r() * (hi - lo)).toFixed(sensor.unit === '°C' ? 1 : 0)
        desc = `정상 범위 측정 · ${sensor.zone}`
      }

      logs.push({ time: timeStr, slot, status, sensor: sensor.label, value: `${value} ${sensor.unit}`, desc, zone: sensor.zone })
    })
  }

  logs.sort((a, b) => a.time.localeCompare(b.time) || a.sensor.localeCompare(b.sensor))
  return logs
}

export function getDotProfile(logs: LogEntry[]) {
  return {
    danger: logs.filter(l => l.status === 'danger').length,
    warning: logs.filter(l => l.status === 'warning').length,
    normal: logs.filter(l => l.status === 'normal').length,
  }
}
