// 로그 캘린더 탭 전용 상수(요일 라벨·상태 라벨). 센서 라벨/단위·임계치는
// dashboard/constants.ts·dashboard/deriveDashboard.ts를 그대로 재사용해 실제 대시보드와 일치시킨다.
import type { LogStatus } from './types'

export const DOW = ['일', '월', '화', '수', '목', '금', '토']
export const STATUS_LABEL: Record<LogStatus, string> = { danger: '위험', warning: '경고', normal: '정상' }
