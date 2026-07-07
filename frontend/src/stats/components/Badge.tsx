// 심각도(정상/경고/위험)를 표시하는 작은 배지.
import type { Severity } from '../types'
import { SEVERITY_COLORS } from '../config'

interface Props {
  label: string
  severity: Severity
  isDark: boolean
}

export function Badge({ label, severity, isDark }: Props) {
  const { bg, text } = SEVERITY_COLORS[severity]
  return (
    <span style={{
      background: isDark ? `${text}22` : bg,
      color: text,
      fontSize: '0.7rem',
      fontWeight: 700,
      padding: '2px 8px',
      borderRadius: 999,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}
