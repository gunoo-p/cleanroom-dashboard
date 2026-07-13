// 로그 캘린더 탭에서 쓰는 타입 정의.
export type LogStatus = 'normal' | 'warning' | 'danger'

export interface LogEntry {
  time: string
  status: LogStatus
  sensor: string
  value: string
  desc: string
}
