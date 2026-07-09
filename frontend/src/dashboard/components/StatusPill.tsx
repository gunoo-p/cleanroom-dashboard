// 정상/경고/위험 상태를 표시하는 작은 배지.
import type { Status } from '../types'
import { STATUS_COLORS, STATUS_LABELS } from '../constants'

interface Props {
  status: Status
  isDark: boolean
}

export function StatusPill({ status, isDark }: Props) {
  const { bg, text } = STATUS_COLORS[status]
  return (
    <span
      style={{
        background: isDark ? `${text}22` : bg,
        color: text,
        fontSize: '0.7rem',
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 999,
        letterSpacing: '0.04em',
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
