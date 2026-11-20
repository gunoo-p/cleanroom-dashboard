// 시뮬레이터 화면: 버튼·카드·로그 + 파이썬(simulator_3d.py) 연결.
//
// 파이썬 → 화면: window.sim.onData / onLog / onScenario 를 evaluate_js로 호출
// 화면 → 파이썬: pywebview.api.toggle() / set_scenarios([key, ...])
// 위험 버튼은 켜고 끄는 방식(여러 개 동시 선택), '정상'은 전부 끔.
// pywebview 없이 브라우저로 열면 '미리보기 모드'(서버 전송 없이 가짜 값만 표시)로 동작한다.
import { createScene } from './scene.js'
import { createSensorCards } from './sensorCards.js'
import { toKeys, sortByPriority } from './scenarios.js'

const $ = (id) => document.getElementById(id)

const CARD_KEYS = ['temperature', 'humidity', 'gas', 'air_quality', 'pressure']
const LOG_LIMIT = 300
let cards = null // 대시보드 SensorBox와 같은 구성의 센서 카드

// 미리보기 모드에서 쓰는 설정 (실제 값은 파이썬 get_config()가 simulator.py에서 가져와 준다)
const PREVIEW_CONFIG = {
  deviceId: 'esp32-B1',
  apiUrl: '(미리보기: 전송 안 함)',
  interval: 3,
  scenarios: [
    { key: 'normal', label: '정상' },
    { key: 'temperature', label: '온도 위험' },
    { key: 'humidity', label: '습도 위험' },
    { key: 'gas', label: '가스 위험' },
    { key: 'air_quality', label: '공기질 위험' },
    { key: 'pressure', label: '차압 위험' },
  ],
  sensors: {
    temperature: { label: '온도', unit: '°C' },
    humidity: { label: '습도', unit: '%' },
    gas: { label: '가스', unit: '' },
    air_quality: { label: '공기질', unit: '' },
  },
}

const ui = {
  connected: false, // 파이썬(또는 미리보기) 연결 + 화면 구성 완료
  running: false,
  scenarios: [], // 켜진 위험 목록 (우선순위 순). 비어 있으면 정상
  preview: false,
  labels: {},
}

// ── 로그 ─────────────────────────────────────
function addLog(msg, tag = 'data') {
  const box = $('log')
  const line = document.createElement('div')
  line.className = tag
  const ts = new Date().toLocaleTimeString('ko-KR', { hour12: false })
  line.textContent = `[${ts}] ${msg}`
  box.appendChild(line)
  while (box.children.length > LOG_LIMIT) box.firstChild.remove()
  box.scrollTop = box.scrollHeight
}

const scene3d = createScene($('scene'), $('viewport'), { onLog: addLog })

// ── 화면 구성 ────────────────────────────────
function buildUI(cfg) {
  $('config').textContent = `device: ${cfg.deviceId}   api: ${cfg.apiUrl}   interval: ${cfg.interval}s`

  const row = $('scenario-row')
  row.innerHTML = ''
  for (const s of cfg.scenarios) {
    ui.labels[s.key] = s.label
    const b = document.createElement('button')
    b.type = 'button'
    b.className = `scenario-btn${s.key === 'normal' ? ' normal' : ''}`
    b.dataset.scenario = s.key
    b.textContent = s.label
    b.addEventListener('click', () => onScenarioClick(s.key))
    row.appendChild(b)
  }

  cards = createSensorCards($('cards'))

  renderScenarios(ui.scenarios)
}

// 켜진 위험 목록을 화면에 반영 (버튼·배지·카드 강조·3D)
function renderScenarios(arg) {
  const keys = toKeys(arg)
  ui.scenarios = keys
  document.querySelectorAll('.scenario-btn').forEach((b) => {
    const k = b.dataset.scenario
    b.classList.toggle('active', k === 'normal' ? keys.length === 0 : keys.includes(k))
  })
  cards?.highlight(keys)
  const badge = $('status-badge')
  const danger = keys.length > 0
  // 예: '⚠ 온도 · 가스 위험'
  const names = keys.map((k) => (ui.labels[k] ?? k).replace(/\s*위험$/, ''))
  badge.textContent = danger ? `⚠ ${names.join(' · ')} 위험` : '정상 운전'
  badge.classList.toggle('danger', danger)
  $('alarm-vignette').classList.toggle('on', keys.includes('temperature')) // 온도 위험: 화면 테두리 사이렌
  scene3d.setScenarios(keys)
}

function renderRunning(running) {
  ui.running = running
  const btn = $('run-btn')
  btn.textContent = running ? '⏹  정지' : '▶  실행'
  btn.classList.toggle('running', running)
}

// ── 파이썬에서 부르는 함수 ───────────────────
window.sim = {
  onData({ values, ok, sent, failed }) {
    cards?.update(values)
    $('stats').textContent = `전송: ${sent}  실패: ${failed}`
    const data = Object.fromEntries(Object.entries(values).filter(([k]) => k !== 'device_id'))
    addLog(`${ok ? '✓' : '✗'} ${JSON.stringify(data)}`, ok ? 'ok' : 'fail')
  },
  onLog({ msg, tag }) {
    addLog(msg, tag)
  },
  // 파이썬이 확정한 켜진 위험 목록. { keys, seq } — 더 최근에 누른 버튼이 있으면(오래된 응답) 무시
  onScenario(arg) {
    if (arg && !Array.isArray(arg) && typeof arg === 'object') {
      if (arg.seq != null && arg.seq < scenarioSeq) return
      return renderScenarios(arg.keys)
    }
    renderScenarios(arg)
  },
  // 자가진단(--selftest)·디버그용
  debug: {
    ready: () => ui.connected && scene3d.isReady(),
    // 자가진단용: 버튼을 누르는 것과 같은 경로로 켜진 위험 목록을 한 번에 지정
    select: (keys) => applyScenarios(keys),
    info: () => ({
      ...scene3d.info(),
      connected: ui.connected,
      uiScenarios: ui.scenarios,
      running: ui.running,
      preview: ui.preview,
      badge: $('status-badge').textContent,
      stats: $('stats').textContent,
      cards: Object.fromEntries(CARD_KEYS.map((k) => [k, $(`val-${k}`)?.textContent])),
      cardStatus: cards?.statuses() ?? null,
      vignette: $('alarm-vignette').classList.contains('on'),
      logLines: $('log').children.length,
    }),
  },
}

// ── 버튼 ─────────────────────────────────────
let api = null

// 위험 버튼: 켜고 끄기(여러 개 가능) / 정상: 전부 끄기
async function onScenarioClick(key) {
  if (key === 'normal') return applyScenarios([])
  const set = new Set(ui.scenarios)
  if (set.has(key)) set.delete(key)
  else set.add(key)
  return applyScenarios([...set])
}

// 버튼을 누를 때마다 번호를 붙여, 빠르게 연달아 눌러도 마지막 상태가 이기게 한다.
let scenarioSeq = 0
async function applyScenarios(keys) {
  const list = sortByPriority(keys)
  const seq = ++scenarioSeq
  renderScenarios(list) // 화면은 바로 바꾸고, 파이썬도 같은 값으로 맞춘다.
  await api?.set_scenarios(list, seq)
}

$('run-btn').addEventListener('click', async () => {
  if (!api) return // 연결 전 클릭 무시
  renderRunning(await api.toggle())
})

// ── 미리보기 모드 (pywebview 없이 브라우저로 열었을 때) ──
function previewApi() {
  let timer = null
  let sent = 0
  const base = { temperature: 22, humidity: 45, gas: 800, air_quality: 300, pressure: 15 }
  const danger = { temperature: 26, humidity: 60, gas: 3500, air_quality: 3500, pressure: -10 }
  const range = { temperature: 0.6, humidity: 2, gas: 200, air_quality: 150, pressure: 3 }
  const tick = () => {
    const values = {}
    for (const k of CARD_KEYS) {
      const b = ui.scenarios.includes(k) ? danger[k] : base[k]
      values[k] = Math.round((b + (Math.random() - 0.5) * range[k]) * 10) / 10
    }
    window.sim.onData({ values, ok: true, sent: ++sent, failed: 0 })
  }
  return {
    get_config: async () => PREVIEW_CONFIG,
    set_scenarios: async (keys) => {
      const names = keys.map((k) => ui.labels[k] ?? k)
      window.sim.onLog({ msg: `시나리오 전환 → ${names.length ? names.join(' + ') : '정상'}`, tag: 'info' })
      window.sim.onScenario(keys)
    },
    toggle: async () => {
      if (timer) {
        clearInterval(timer); timer = null
        window.sim.onLog({ msg: '정지.', tag: 'info' })
        return false
      }
      sent = 0
      window.sim.onLog({ msg: '시작! (미리보기 — 서버로 전송하지 않음)', tag: 'ok' })
      tick()
      timer = setInterval(tick, PREVIEW_CONFIG.interval * 1000)
      return true
    },
  }
}

function waitForPywebview(timeoutMs = 1500) {
  return new Promise((resolve) => {
    if (window.pywebview?.api?.get_config) return resolve(window.pywebview.api)
    const timer = setTimeout(() => resolve(null), timeoutMs)
    window.addEventListener('pywebviewready', () => {
      clearTimeout(timer)
      resolve(window.pywebview.api)
    }, { once: true })
  })
}

async function init() {
  api = await waitForPywebview()
  if (!api) {
    ui.preview = true
    api = previewApi()
  }
  const cfg = await api.get_config()
  buildUI(cfg)
  ui.connected = true
  addLog(ui.preview
    ? '미리보기 모드입니다 (pywebview 없이 열림). 서버로 전송하지 않습니다.'
    : '준비 완료. ▶ 실행 버튼을 눌러 시작하세요.', 'info')

  try {
    const info = await scene3d.ready
    // 코드로 만든 기본 클린룸이면 안내 없음, GLB로 교체했을 때만 파일명 표시
    $('model-hint').textContent = info.source === 'glb' ? `모델: ${info.file}` : ''
  } catch { /* scene.js가 로그로 알림 */ }
}

init()
