// 센서 현재값 카드 — 웹 대시보드의 SensorBox(frontend/src/dashboard/components/SensorBox.tsx)와 같은 구성.
// 판정 기준·색·정상 범위 문구는 frontend/src/dashboard/deriveDashboard.ts, constants.ts 값을 그대로 옮겼다.
// (대시보드 기준이 바뀌면 여기도 같이 바꿔야 한다)
//
// 대시보드와 다른 점:
// - 3D 화면을 넓게 쓰려고 그래프 아래 최저/최고/평균·정상 범위 줄은 뺐다 (정상 범위는 카드에 마우스를 올리면 표시).
// - 그래프는 조회 기간이 아니라 이번 실행 중 보낸 최근 HISTORY개 값으로 그린다.

const HISTORY = 30

// 시뮬레이터 키 → 대시보드 표시 설정 (constants.ts SENSOR_CONFIGS)
export const CARD_CONFIGS = [
  { key: 'temperature', label: '온도', unit: '°C', color: '#3B82F6' },
  { key: 'humidity', label: '습도', unit: '%', color: '#EC4899' },
  { key: 'gas', label: '가스', unit: '', color: '#8B5CF6' },
  { key: 'air_quality', label: '공기질', unit: '', color: '#14B8A6' },
  { key: 'pressure', label: '차압', unit: 'Pa', color: '#F59E0B' },
]

const STATUS_COLORS = {
  normal: '#1D9E75',
  caution: '#A16207',
  warning: '#C77A0A',
  danger: '#E0473C',
}
const STATUS_LABELS = { normal: '정상', caution: '주의', warning: '경고', danger: '중단' }

// deriveDashboard.ts와 같은 기준
const DEVIATION_THRESHOLDS = {
  temperature: { center: 22.0, caution: 0.5, warning: 1.0, danger: 2.0 },
  humidity: { center: 45, caution: 2, warning: 5, danger: 10 },
}
const DIRECT_THRESHOLDS = {
  gas: { warning: 2000, danger: 3000 },
  air_quality: { warning: 2000, danger: 3000 },
  pressure: { warning: 10, danger: 5 },
}
const LOW_IS_BAD = { pressure: true } // 차압은 낮을수록 위험

export function statusFor(key, value) {
  const dev = DEVIATION_THRESHOLDS[key]
  if (dev) {
    const d = Math.abs(value - dev.center)
    if (d > dev.danger) return 'danger'
    if (d > dev.warning) return 'warning'
    if (d > dev.caution) return 'caution'
    return 'normal'
  }
  const t = DIRECT_THRESHOLDS[key]
  if (LOW_IS_BAD[key]) return value < t.danger ? 'danger' : value < t.warning ? 'warning' : 'normal'
  return value > t.danger ? 'danger' : value > t.warning ? 'warning' : 'normal'
}

export function normalRangeLabel(key, unit) {
  const dev = DEVIATION_THRESHOLDS[key]
  if (dev) return `정상 ${(dev.center - dev.caution).toFixed(1)}~${(dev.center + dev.caution).toFixed(1)}${unit}`
  const t = DIRECT_THRESHOLDS[key]
  return LOW_IS_BAD[key] ? `정상 ${t.warning}${unit} 이상` : `정상 ${t.warning}${unit} 이하`
}

const SVG_NS = 'http://www.w3.org/2000/svg'

export function createSensorCards(container) {
  const history = Object.fromEntries(CARD_CONFIGS.map((c) => [c.key, []]))
  const els = {}
  container.innerHTML = ''

  for (const cfg of CARD_CONFIGS) {
    const card = document.createElement('div')
    card.className = 'card'
    card.dataset.sensor = cfg.key
    card.innerHTML = `
      <div class="card-head">
        <span class="card-dot"></span>
        <span class="card-label"></span>
        <span class="status-pill waiting">대기</span>
      </div>
      <div class="card-value"><span class="card-num" id="val-${cfg.key}">-</span><span class="card-unit"></span></div>
      <svg class="spark" viewBox="0 0 100 40" preserveAspectRatio="none"><polyline fill="none" stroke-width="1.5" vector-effect="non-scaling-stroke" /></svg>`
    card.querySelector('.card-dot').style.background = cfg.color
    card.querySelector('.card-label').textContent = cfg.label
    card.querySelector('.card-unit').textContent = cfg.unit
    card.title = normalRangeLabel(cfg.key, cfg.unit) // 정상 범위는 마우스를 올리면 보이게
    card.querySelector('polyline').setAttribute('stroke', cfg.color)
    container.appendChild(card)
    els[cfg.key] = {
      card,
      num: card.querySelector('.card-num'),
      pill: card.querySelector('.status-pill'),
      line: card.querySelector('polyline'),
    }
  }

  function drawSpark(line, data) {
    if (data.length < 2) { line.setAttribute('points', ''); return }
    const lo = Math.min(...data)
    const hi = Math.max(...data)
    const mid = (lo + hi) / 2
    // 작은 노이즈가 크게 출렁여 보이지 않도록 최소 높이 폭(값 크기의 4%)을 둔다.
    const span = Math.max(hi - lo, Math.abs(mid) * 0.04, 0.5)
    const pts = data.map((v, i) => {
      const x = (i / (data.length - 1)) * 100 // 대시보드처럼 항상 카드 폭 전체에
      const y = 20 - ((v - mid) / span) * 32
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    line.setAttribute('points', pts.join(' '))
  }

  // values: { temperature, humidity, gas, air_quality, pressure }
  function update(values) {
    for (const cfg of CARD_CONFIGS) {
      const v = values[cfg.key]
      if (typeof v !== 'number') continue
      const h = history[cfg.key]
      h.push(v)
      if (h.length > HISTORY) h.shift()
      const e = els[cfg.key]
      e.num.textContent = String(v)
      const status = statusFor(cfg.key, v)
      e.pill.className = `status-pill ${status}`
      e.pill.textContent = STATUS_LABELS[status]
      e.pill.style.color = STATUS_COLORS[status]
      e.pill.style.background = `${STATUS_COLORS[status]}22`
      e.card.dataset.status = status
      e.card.style.borderColor = status === 'normal' ? '' : STATUS_COLORS[status]
      drawSpark(e.line, h)
    }
  }

  // 시나리오로 '위험 예정'인 센서 카드를 강조 (값이 아직 안 바뀌었어도 어떤 센서인지 보이게)
  function highlight(keys) {
    const list = Array.isArray(keys) ? keys : [keys]
    for (const cfg of CARD_CONFIGS) els[cfg.key].card.classList.toggle('focus', list.includes(cfg.key))
  }

  function statuses() {
    return Object.fromEntries(CARD_CONFIGS.map((c) => [c.key, els[c.key].card.dataset.status || 'waiting']))
  }

  return { update, highlight, statuses }
}
