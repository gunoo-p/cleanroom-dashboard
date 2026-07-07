// 구역(Zone) 목록과 zone → deviceId 변환 유틸.
export const ZONES = ['A', 'B', 'C', 'D'] as const
export type Zone = typeof ZONES[number]

export function zoneDeviceId(zone: Zone): string {
  return `esp32-${zone}1`
}
