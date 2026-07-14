// 원시 시계열 → 로그 캘린더용 날짜별 집계·상세 로그 목록.
// 상태 판정은 dashboard/deriveDashboard.ts의 statusFor를 그대로 재사용한다 — 같은 값이면
// 대시보드 탭에서 "위험"으로 뜨는 게 여기서도 "위험"으로 뜬다(임계치를 중복 정의하지 않음).
import { statusFor } from '../dashboard/deriveDashboard'
import { SENSOR_CONFIGS } from '../dashboard/constants'
import type { Status } from '../dashboard/types'
import type { HistoryRow } from './api'
import type { LogEntry, LogStatus } from './types'

interface CleanRow {
  t: string
  temp: number
  hum: number
  gas: number
  pm: number
  pressure: number
}

// 실내-실외 절대기압(hPa) 차이를 Pa 단위 차압으로 변환(dashboard/Dashboard.tsx와 동일 계산).
function pressureDiffPa(inside: number, outside: number): number {
  return (inside - outside) * 100
}

function cleanRows(rows: HistoryRow[]): CleanRow[] {
  return rows
    .filter((r): r is HistoryRow & Record<'temperature' | 'humidity' | 'pressure' | 'pressure_outside' | 'gas' | 'air_quality', number> =>
      r.temperature != null && r.humidity != null && r.pressure != null && r.pressure_outside != null && r.gas != null && r.air_quality != null)
    .map(r => ({ t: r.time, temp: r.temperature, hum: r.humidity, gas: r.gas, pm: r.air_quality, pressure: pressureDiffPa(r.pressure, r.pressure_outside) }))
}

// caution(주의)은 경고보다 약한 신호라 로그 캘린더의 3단계(정상/경고/위험) 집계에서는 정상으로 취급한다.
function toLogStatus(status: Status): LogStatus {
  return status === 'danger' || status === 'warning' ? status : 'normal'
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// 월간 히스토리(여러 날짜가 섞인 시계열)를 날짜별로 묶어서 각 날의 위험/경고 개수를 센다.
export function computeMonthDayCounts(rows: HistoryRow[]): Record<number, { danger: number; warning: number }> {
  const byDay: Record<number, { danger: number; warning: number }> = {}
  for (const p of cleanRows(rows)) {
    const day = new Date(p.t).getDate()
    const bucket = byDay[day] ?? (byDay[day] = { danger: 0, warning: 0 })
    for (const cfg of SENSOR_CONFIGS) {
      const s = toLogStatus(statusFor(cfg.key, p[cfg.key]))
      if (s === 'danger') bucket.danger++
      else if (s === 'warning') bucket.warning++
    }
  }
  return byDay
}

export function buildLogEntries(rows: HistoryRow[]): LogEntry[] {
  const logs: LogEntry[] = []

  for (const p of cleanRows(rows)) {
    const d = new Date(p.t)
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

    for (const cfg of SENSOR_CONFIGS) {
      const value = p[cfg.key]
      const status = toLogStatus(statusFor(cfg.key, value))
      // 모달 자체가 이미 구역 하나로 범위가 고정돼 있어서(같은 값이 매 줄 반복되면 노이즈만
      // 됨), 내용 문구에는 구역을 다시 붙이지 않는다.
      const desc = status === 'danger'
        ? `${cfg.label} 위험 임계 초과`
        : status === 'warning'
          ? `${cfg.label} 경고 임계 초과`
          : '정상 범위 측정'

      logs.push({
        time,
        status,
        sensor: cfg.label,
        value: `${value.toFixed(cfg.key === 'gas' ? 0 : 1)}${cfg.unit}`,
        desc,
      })
    }
  }

  logs.sort((a, b) => a.time.localeCompare(b.time) || a.sensor.localeCompare(b.sensor))
  return logs
}

// AI 요약 프롬프트에 넘길 센서별 위험/경고 집계(정상 로그는 요약에 의미가 없어 제외).
export function summarizeBySensor(logs: LogEntry[]): { sensor: string; danger: number; warning: number }[] {
  const bySensor = new Map<string, { danger: number; warning: number }>()
  for (const log of logs) {
    if (log.status === 'normal') continue
    const bucket = bySensor.get(log.sensor) ?? { danger: 0, warning: 0 }
    if (log.status === 'danger') bucket.danger++
    else bucket.warning++
    bySensor.set(log.sensor, bucket)
  }
  return Array.from(bySensor, ([sensor, counts]) => ({ sensor, ...counts }))
}
