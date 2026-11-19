// 심각도(정상/경고/위험)를 표시하는 작은 배지. 다크 모드 배경은 analysis.css에서 글자색 기반으로 처리.
import type { CSSProperties } from 'react'
import type { Severity } from '../types'
import { SEVERITY_COLORS } from '../config'

interface Props {
  label: string
  severity: Severity
}

export function Badge({ label, severity }: Props) {
  const { bg, text } = SEVERITY_COLORS[severity]
  const style = { '--badge-bg': bg, '--badge-fg': text } as CSSProperties
  return <span className="analysis-badge" style={style}>{label}</span>
}
