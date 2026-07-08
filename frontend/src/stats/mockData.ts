// 백엔드 미연결 시 통계 탭을 채우는 시드(mock) 데이터 생성기.
import type { AnalysisData, SensorPoint } from './types'
import { ZONES, zoneDeviceId, type Zone } from '../shared/zone'

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

// 백엔드 미연결 시 화면을 채우는 시드 데이터. 임의 데이터
// 최근 24시간: 온도·가스가 서서히 상승해 경고/위험 임계에 근접(설비 이상 예측 패널용).
// 공기질은 완만한 변동만 준다(예측 대상이지만 급변 시나리오는 아님).
// 차압(pressure 필드)은 30일간 베이스라인이 꾸준히 상승(필터 막힘 가정, 필터 교체 예측 패널용).
// ⚠ 데모용 값 — 실제 배관을 필터 전후에 연결하지 않으면 이 숫자는 필터 상태와 무관하다.
// 습도가 오르면 가스·불량률도 함께 오르도록 설계(상관관계 패널용).
// zone마다 기준치를 조금씩 다르게 둬서, 백엔드 미연결 상태에서도 구역별 차이가 보이게 한다.
export function generateAnalysisMockData(zone: Zone = 'A'): AnalysisData {
  const offset = ZONES.indexOf(zone) * 1.5
  const days = 30
  const hoursPerDay = 24
  const n = days * hoursPerDay
  const now = new Date()
  const start = new Date(now)
  start.setMinutes(0, 0, 0)
  start.setHours(start.getHours() - (n - 1))

  const points: SensorPoint[] = []
  const tempRaw: number[] = []
  const humRaw: number[] = []
  const gasRaw: number[] = []
  const pmRaw: number[] = []
  const pressureRaw: number[] = []

  for (let i = 0; i < n; i++) {
    const dayIndex = Math.floor(i / hoursPerDay)
    const hourOfDay = i % hoursPerDay
    const isLastDay = dayIndex === days - 1

    const dailyCycle = Math.sin((hourOfDay / 24) * Math.PI * 2)

    // 온도: 평소엔 완만한 일교차, 마지막 하루 동안 서서히 상승(설비 이상 조짐)
    const tempRamp = isLastDay ? (hourOfDay / hoursPerDay) * 14 : 0
    const temp = 25 + offset + dailyCycle * 2 + tempRamp + (Math.random() - 0.5) * 1.2

    // 습도: 30일에 걸쳐 완만히 상승 + 일간 변동
    const humDrift = (dayIndex / days) * 18
    const hum = 38 + offset * 2 + humDrift + dailyCycle * 4 + (Math.random() - 0.5) * 3

    // 가스: 습도와 함께 완만히 상승 + 마지막 하루엔 추가로 급상승(동반 상승 패턴)
    const gasRamp = isLastDay ? (hourOfDay / hoursPerDay) * 220 : 0
    const gas = 60 + offset * 6 + humDrift * 3 + gasRamp + (Math.random() - 0.5) * 10

    // 공기질: 뚜렷한 추세 없이 완만한 변동만
    const pm = 30 + offset * 2 + Math.sin(i * 0.05) * 8 + (Math.random() - 0.5) * 4

    // 차압: 30일간 베이스라인이 꾸준히 상승(필터 열화 가정)
    const dpDrift = (dayIndex / (days - 1)) * 90
    const pressure = 40 + offset * 6 + dpDrift + Math.sin(i * 0.15) * 6 + (Math.random() - 0.5) * 6

    tempRaw.push(clamp(temp, 15, 50))
    humRaw.push(clamp(hum, 20, 95))
    gasRaw.push(clamp(gas, 20, 500))
    pmRaw.push(clamp(pm, 0, 150))
    pressureRaw.push(clamp(pressure, 0, 300))
  }

  // 불량률: 습도 비중을 크게 둬 "습도 vs 불량률" 상관관계가 뚜렷하게 나타나도록 구성
  const humMin = Math.min(...humRaw)
  const humMax = Math.max(...humRaw)
  const humN = humRaw.map(v => ((v - humMin) / (humMax - humMin || 1)) * 100)
  const gasMin = Math.min(...gasRaw)
  const gasMax = Math.max(...gasRaw)
  const gasN = gasRaw.map(v => ((v - gasMin) / (gasMax - gasMin || 1)) * 100)

  for (let i = 0; i < n; i++) {
    const t = new Date(start.getTime() + i * 60 * 60 * 1000)
    const defectRaw = clamp(humN[i] * 0.8 + gasN[i] * 0.15 - 25 + (Math.random() - 0.5) * 18, 0, 100)
    points.push({
      t: t.toISOString(),
      temp: +tempRaw[i].toFixed(1),
      hum: +humRaw[i].toFixed(1),
      gas: +gasRaw[i].toFixed(0),
      pm: +pmRaw[i].toFixed(1),
      pressure: +pressureRaw[i].toFixed(1),
      defect_rate: +defectRaw.toFixed(1),
    })
  }

  return { device_id: zoneDeviceId(zone), points }
}
