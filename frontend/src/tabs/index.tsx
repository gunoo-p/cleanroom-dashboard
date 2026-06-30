import { lazy, type ComponentType } from 'react'

export interface TabProps {
  isDark: boolean
  onToggleDark: () => void
}

export interface TabDef {
  id: string
  label: string
  component: ComponentType<TabProps>
}

// ──────────────────────────────────────────────────────────────
// 팀원이 새 탭을 추가할 때는 이 배열에만 항목을 추가하세요.
//
// 예시:
//   {
//     id: 'my-feature',
//     label: '내 기능',
//     component: lazy(() =>
//       import('../my-feature/MyTab').then(m => ({ default: m.MyTab }))
//     ) as ComponentType<TabProps>,
//   },
// ──────────────────────────────────────────────────────────────
export const TABS: TabDef[] = [
  {
    id: 'chart',
    label: '환경 센서',
    component: lazy(() =>
      import('../chart/Dashboard').then(m => ({ default: m.Dashboard }))
    ) as ComponentType<TabProps>,
  },
  // 팀원 탭을 여기에 추가하세요 ↓
]
