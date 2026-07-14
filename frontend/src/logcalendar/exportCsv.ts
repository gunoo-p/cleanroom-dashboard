// 로그 목록을 CSV 파일로 내보낸다(클라이언트에서 바로 생성 — 백엔드 변경 없음).
import { STATUS_LABEL } from './constants'
import type { LogEntry } from './types'

const HEADERS = ['시간', '상태', '센서', '측정값', '내용']
const BOM = '﻿' // 엑셀에서 UTF-8 한글이 안 깨지고 열리도록 붙이는 바이트 순서 표시.

function escapeCell(value: string): string {
  // 쉼표·따옴표·줄바꿈이 있으면 큰따옴표로 감싸고 내부 따옴표는 두 번 써서 이스케이프한다(CSV 표준).
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function toCsv(logs: LogEntry[]): string {
  const rows = logs.map(l => [l.time, STATUS_LABEL[l.status], l.sensor, l.value, l.desc])
  return [HEADERS, ...rows].map(row => row.map(escapeCell).join(',')).join('\r\n')
}

export function downloadLogsCsv(logs: LogEntry[], filename: string) {
  const csv = BOM + toCsv(logs)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
