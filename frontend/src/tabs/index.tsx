// 탭 정의 레지스트리: 사이드바와 라우팅에 쓰이는 탭 목록.
import { lazy, type ComponentType, type ReactNode } from 'react'
import type { Zone } from '../shared/zone'
import { DashboardIcon, StatsIcon, CalendarIcon } from '../layout/icons'

export interface TabProps {
  isDark: boolean
  onToggleDark: () => void
  zone: Zone
  onZoneChange: (zone: Zone) => void
}

export interface TabDef {
  id: string
  label: string
  icon: ReactNode
  component: ComponentType<TabProps>
}

// ──────────────────────────────────────────────────────────────
// 팀원이 새 탭을 추가할 때는 이 배열에만 항목을 추가하세요.
//
// 예시:
//   {
//     id: 'my-feature',
//     label: '내 기능',
//     icon: <MyFeatureIcon />,
//     component: lazy(() =>
//       import('../my-feature/MyTab').then(m => ({ default: m.MyTab }))
//     ) as ComponentType<TabProps>,
//   },
// ──────────────────────────────────────────────────────────────
export const TABS: TabDef[] = [
  {
    id: 'dashboard',
    label: '대시보드',
    icon: <DashboardIcon />,
    component: lazy(() =>
      import('../dashboard/Dashboard').then(m => ({ default: m.Dashboard }))
    ) as ComponentType<TabProps>,
  },
  {
    id: 'analysis',
    label: '통계',
    icon: <StatsIcon />,
    component: lazy(() =>
      import('../analysis/AnalysisTab').then(m => ({ default: m.AnalysisTab }))
    ) as ComponentType<TabProps>,
  },
  {
    id: 'log-calendar',
    label: '로그 캘린더',
    icon: <CalendarIcon />,
    component: lazy(() =>
      import('../logcalendar/LogCalendarTab').then(m => ({ default: m.LogCalendarTab }))
    ) as ComponentType<TabProps>,
  },
  // 팀원 탭 여기에 추가하세용 ↓
]
