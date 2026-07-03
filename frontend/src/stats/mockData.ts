import type { AnalysisData } from './types'
import type { SensorPoint } from '../chart/types'

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

// 백엔드 미연결 시 화면을 채우는 시드 데이터. 임의 데이터
// 최근 24시간: 온도·가스가 서서히 상승해 경고/위험 임계에 근접(설비 이상 예측 패널용).
// 최근 30일: 미세입자 베이스라인이 꾸준히 상승(필터 교체 예측 패널용).
// 습도가 오르면 가스·불량률도 함께 오르도록 설계(상관관계 패널용).
export function generateAnalysisMockData(deviceId = 'esp32-A1'): AnalysisData {
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

  for (let i = 0; i < n; i++) {
    const dayIndex = Math.floor(i / hoursPerDay)
    const hourOfDay = i % hoursPerDay
    const isLastDay = dayIndex === days - 1

    const dailyCycle = Math.sin((hourOfDay / 24) * Math.PI * 2)

    // 온도: 평소엔 완만한 일교차, 마지막 하루 동안 서서히 상승(설비 이상 조짐)
    const tempRamp = isLastDay ? (hourOfDay / hoursPerDay) * 14 : 0
    const temp = 25 + dailyCycle * 2 + tempRamp + (Math.random() - 0.5) * 1.2

    // 습도: 30일에 걸쳐 완만히 상승 + 일간 변동
    const humDrift = (dayIndex / days) * 18
    const hum = 38 + humDrift + dailyCycle * 4 + (Math.random() - 0.5) * 3

    // 가스: 습도와 함께 완만히 상승 + 마지막 하루엔 추가로 급상승(동반 상승 패턴)
    const gasRamp = isLastDay ? (hourOfDay / hoursPerDay) * 220 : 0
    const gas = 60 + humDrift * 3 + gasRamp + (Math.random() - 0.5) * 10

    // 미세입자: 30일간 베이스라인이 꾸준히 상승(필터 열화 가정)
    const pmDrift = (dayIndex / (days - 1)) * 28
    const pm = 15 + pmDrift + Math.sin(i * 0.15) * 3 + (Math.random() - 0.5) * 3

    tempRaw.push(clamp(temp, 15, 50))
    humRaw.push(clamp(hum, 20, 95))
    gasRaw.push(clamp(gas, 20, 500))
    pmRaw.push(clamp(pm, 5, 100))
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
      defect_rate: +defectRaw.toFixed(1),
    })
  }

  return { device_id: deviceId, points }
}
