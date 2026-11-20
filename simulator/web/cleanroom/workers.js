// 방진복 작업자 7명 + 동작
//   평소: 각자 장비 앞에서 작업, 1명은 웨이퍼 트레이를 들고 순회
//   위험: 시나리오마다 다른 행동(PLANS) + 머리 위 말풍선
//     온도 부채질·뒷걸음 / 습도 우산 / 가스 입 막고 문 앞 대피 / 공기질 기침·먼지 휘젓기 / 차압 3명이 문 밀어 막기
//   위험마다 7명 모두 새 자리로 이동(PLANS 대형). 이동 경로는 nav.js 격자 길찾기로 장비·벽을 피함
//   걷는 사람끼리·장비와 겹치지 않게 매 프레임 밀어냄
//   정상 복귀: 제자리로 돌아가 작업 재개 (♪ 말풍선)
import * as THREE from 'three'
import { COLOR, MAT, rbox, cyl } from './parts.js'
import { sortByPriority } from '../scenarios.js'

// 둥글둥글한 캐릭터용 재질 (살짝 크림빛 흰색 + 부드러운 광택)
const SUIT = new THREE.MeshStandardMaterial({ color: 0xfbfcfd, roughness: 0.62 })
const SUIT_SHADE = new THREE.MeshStandardMaterial({ color: 0xe9eef4, roughness: 0.7 })
const GLOVE = new THREE.MeshStandardMaterial({ color: COLOR.glove, roughness: 0.5 })
const PUPIL = new THREE.MeshStandardMaterial({ color: 0x1b2430, roughness: 0.3 })
const SHINE = new THREE.MeshBasicMaterial({ color: 0xffffff })
const BLUSH = new THREE.MeshBasicMaterial({ color: 0xffa8b8, transparent: true, opacity: 0.75 })
const SEAM = new THREE.MeshStandardMaterial({ color: 0xd6dee6, roughness: 0.8 })
// 사람마다 다른 가슴 배지 색
const BADGES = [0x2fb3b5, 0xff8a65, 0xffc947, 0x9b7bff, 0x4f9dff, 0x5cc977, 0xff7fb0]
const WORKER_SCALE = 1.15

const WALK_SPEED = 1.5
const ARRIVE = 0.25 // 목표점 이만큼 안이면 도착으로 침

function capsule(name, r, len, mat) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat)
  m.name = name
  return m
}

function sphere(name, r, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), mat)
  m.name = name
  m.position.set(x, y, z)
  m.scale.set(sx, sy, sz)
  return m
}

// 서양배 모양 몸통 (아래가 통통하고 위로 갈수록 좁아짐)
const BODY_GEO = new THREE.LatheGeometry([
  [0.0, 0.0], [0.2, 0.01], [0.29, 0.07], [0.315, 0.18], [0.3, 0.3],
  [0.26, 0.42], [0.2, 0.5], [0.1, 0.55], [0.0, 0.56],
].map(([r, y]) => new THREE.Vector2(r, y)), 32)

// 발 위치(y=0)가 원점, 정면이 +z인 2.5등신 캐릭터
//   root ─ legs(엉덩이 축) / body(통통 튀는 상체) ─ arms(어깨 축) / head(끄덕이는 머리) ─ eyes
function buildWorker(name, badgeColor = BADGES[0]) {
  const root = new THREE.Group()
  root.name = name
  const body = new THREE.Group() // 걸을 때 눌렸다 늘어나며 튀는 상체
  root.add(body)

  // 짧고 뭉툭한 다리 + 동그란 신발
  const legs = []
  for (const side of [-1, 1]) {
    const hip = new THREE.Group()
    hip.position.set(0.12 * side, 0.34, 0)
    const leg = capsule(`${name}_leg`, 0.09, 0.12, SUIT)
    leg.position.y = -0.13
    hip.add(leg)
    hip.add(sphere(`${name}_boot`, 0.1, SUIT_SHADE, 0, -0.27, 0.04, 1.05, 0.72, 1.35))
    root.add(hip)
    legs.push(hip)
  }

  // 몸통 + 지퍼 + 배지
  const torso = new THREE.Mesh(BODY_GEO, SUIT)
  torso.name = `${name}_torso`
  torso.position.y = 0.26
  torso.scale.z = 0.88
  body.add(torso)
  body.add(rbox(`${name}_zip`, 0.016, 0.3, 0.01, SEAM, 0, 0.5, 0.27, 0.005))
  const badgeMat = new THREE.MeshStandardMaterial({ color: badgeColor, roughness: 0.4 })
  const badge = cyl(`${name}_badge`, 0.05, 0.05, 0.015, badgeMat, 0.12, 0.58, 0.23, 20)
  badge.rotation.x = Math.PI / 2 - 0.35
  body.add(badge)
  // 등 배지 (뒤에서 봐도 누군지 구분되게)
  const back = cyl(`${name}_back_badge`, 0.085, 0.085, 0.015, badgeMat, 0, 0.42, -0.27, 24)
  back.rotation.x = Math.PI / 2 + 0.2
  body.add(back)

  // 짧은 팔 + 동그란 장갑 (어깨 축으로 회전)
  const arms = []
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group()
    shoulder.position.set(0.24 * side, 0.68, 0)
    const arm = capsule(`${name}_arm`, 0.075, 0.16, SUIT)
    arm.position.y = -0.13
    shoulder.add(arm)
    shoulder.add(sphere(`${name}_glove`, 0.085, GLOVE, 0, -0.28, 0))
    shoulder.rotation.z = 0.28 * side // 몸에서 살짝 벌어진 팔
    body.add(shoulder)
    arms.push(shoulder)
  }

  // 큰 머리(후드) — 머리만 따로 끄덕이거나 두리번거릴 수 있게 그룹으로
  const head = new THREE.Group()
  head.position.y = 0.98
  body.add(head)
  head.add(sphere(`${name}_hood`, 0.31, SUIT, 0, 0, 0, 1.0, 0.94, 0.98))
  // 머리띠: 한쪽 귀에서 정수리를 지나 반대쪽 귀까지 배지색 띠 (뒷모습이 밋밋하지 않게, 얼굴은 안 가림)
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.305, 0.02, 8, 40, Math.PI), badgeMat)
  rim.name = `${name}_hood_rim`
  rim.position.z = -0.04
  rim.scale.set(1.0, 0.94, 1.0)
  head.add(rim)
  // 얼굴은 작업복과 같은 흰색 그대로 두고, 까만 동그란 눈 + 작은 반짝임 점
  // (깜빡일 때 eyes 그룹을 납작하게)
  const eyes = new THREE.Group()
  eyes.position.set(0, 0.04, 0.278) // 후드 표면에 살짝 박히게
  for (const side of [-1, 1]) {
    const eye = new THREE.Group()
    eye.position.set(0.095 * side, 0, 0)
    eye.add(sphere(`${name}_eye`, 0.042, PUPIL, 0, 0, 0, 1, 1.25, 0.55))
    eye.add(sphere(`${name}_shine`, 0.012, SHINE, 0.013, 0.02, 0.022))
    eye.rotation.y = 0.32 * side // 둥근 얼굴을 따라 바깥으로 살짝 돌림
    eyes.add(eye)
  }
  head.add(eyes)
  // 마스크 + 볼 터치
  head.add(sphere(`${name}_mask`, 0.12, SUIT_SHADE, 0, -0.13, 0.22, 1.25, 0.62, 0.7))
  for (const side of [-1, 1]) {
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), BLUSH)
    blush.name = `${name}_blush`
    blush.position.set(0.17 * side, -0.07, 0.262)
    blush.rotation.y = 0.6 * side
    blush.userData.noShadow = true
    head.add(blush)
  }

  // 우산 (습도 시나리오에서 펼침, 평소엔 숨김) — 오른손 앞쪽에 손잡이, 머리 위에 우산 천
  const umbrella = new THREE.Group()
  umbrella.name = `${name}_umbrella`
  umbrella.position.set(0.2, 0.62, 0.28)
  const canopyMat = new THREE.MeshStandardMaterial({ color: badgeColor, roughness: 0.5, side: THREE.DoubleSide })
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), canopyMat)
  canopy.name = `${name}_umbrella_canopy`
  canopy.position.y = 0.62
  canopy.scale.y = 0.55
  umbrella.add(canopy)
  umbrella.add(cyl(`${name}_umbrella_tip`, 0.015, 0.015, 0.1, MAT.greyDark, 0, 0.92, 0, 8))
  umbrella.add(cyl(`${name}_umbrella_stick`, 0.012, 0.012, 0.9, MAT.greyDark, 0, 0.42, 0, 8))
  umbrella.visible = false
  body.add(umbrella)

  root.scale.setScalar(WORKER_SCALE)
  return { root, body, legs, arms, head, eyes, umbrella, blinkAt: 1 + Math.random() * 3 }
}

function heading(dx, dz) { return Math.atan2(dx, dz) }
function lerpAngle(a, b, t) {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

// ── 작업 위치 ─────────────────────────────────
// home(x, z, face): 평소 서 있는 곳·바라보는 방향
const STATIONS = [
  { name: 'worker_bench', x: -2.85, z: -3.85, face: Math.PI },          // 케미컬 벤치
  { name: 'worker_kiosk', x: 3.4, z: -2.45, face: 2.8 },                // 노광장비 단말기
  { name: 'worker_tool', x: -4.15, z: 0.75, face: -Math.PI / 2 },       // 공정장비 2
  // 검사대 작업자는 옆에 서서 현미경을 봄 (뒤에 서면 키가 작아 책상에 가려짐)
  { name: 'worker_insp1', x: -0.2, z: 0.75, face: -Math.PI / 2 },       // 검사대 1 오른쪽
  { name: 'worker_insp2', x: 0.68, z: 2.85, face: Math.PI / 2 - 0.15 }, // 검사대 2 왼쪽
  { name: 'worker_cart', x: 5.85, z: 1.8, face: -1.92 },                // FOUP 카트
]
// 순회 작업자가 도는 지점 (사이 경로는 길찾기로 장비를 피해 이어 붙임)
const LOOP = [[-2.6, 3.4], [0.0, 4.6], [3.2, 4.4], [3.4, 1.0], [0.3, -0.9], [-2.6, -0.9]]

// 바라볼 대상
const LOOK = {
  door: [4.6, -5.7],     // 출입문
  hot: [-5.8, 2.0],      // 뜨거워진 공정장비 쪽
  gauge: [5.45, -5.7],   // 차압계
  kiosk1: [-4.35, 4.85], // 공정장비 단말기
}

// ── 시나리오별 대형 ────────────────────────────
// 위험마다 7명 모두 새 자리(at)로 이동해 행동(act). 위험이 바뀌면 지금 위치에서 다음 대형으로 바로 이동.
// 작업자 순서: 0 벤치, 1 단말기, 2 공정장비, 3 검사대1, 4 검사대2, 5 카트, 6 순회
// face: 숫자(각도) | 'door' | 'hot' | 'gauge' | 'kiosk1' | [x, z](그 점을 봄)
const G1 = [0.5, 1.7], G2 = [-2.7, 0.4], G3 = [5.4, -0.25] // 습도 때 우산 쓰고 모이는 무리 중심
const PLANS = {
  // 뜨거운 장비 반대편(오른쪽 앞) 시원한 곳으로 피신해 부채질, 단말기 담당만 뜨거운 장비 단말기로 달려가 조작
  temperature: [
    { act: 'fan', bubble: '💦', at: [3.0, 4.6], face: 'hot' },
    { act: 'work_fast', bubble: '❗', at: [-3.78, 4.55], face: 'kiosk1' },
    { act: 'fan', bubble: '🔥', at: [3.9, 3.7], face: 'hot' },
    { act: 'worried', bubble: '🥵', at: [4.7, 4.3], face: 'hot' },
    { act: 'fan', bubble: '💦', at: [5.5, 3.0], face: 'hot' },
    { act: 'fan', bubble: '💦', at: [6.1, 2.1], face: 'hot' },
    { act: 'worried', bubble: '🔥', at: [2.9, 0.4], face: 'hot' },
  ],
  // 우산 쓰고 2~3명씩 웅덩이 없는 곳에 모여 웅크림
  humidity: [
    { act: 'umbrella', bubble: '💧', at: [0.15, 1.55], face: G1 },
    { act: 'umbrella', bubble: '☔', at: [5.1, -0.45], face: G3 },
    { act: 'umbrella', bubble: '💧', at: [-3.1, 0.3], face: G2 },
    { act: 'umbrella', bubble: '☔', at: [0.85, 1.85], face: G1 },
    { act: 'umbrella', bubble: '💧', at: [5.75, -0.05], face: G3 },
    { act: 'umbrella', bubble: '☔', at: [-2.45, 0.05], face: G2 },
    { act: 'umbrella', bubble: '💧', at: [-2.5, 0.8], face: G2 },
  ],
  // 입 막고 출입문 앞으로 대피
  gas: [[4.4, -4.5], [5.2, -4.5], [6.0, -4.4], [4.4, -3.7], [5.2, -3.7], [6.0, -3.6], [5.2, -2.9]]
    .map((at, i) => ({ act: 'cover', bubble: i % 2 ? '😷' : '❗', at, face: 'door', walk: 'cover' })),
  // 천장 필터(FFU) 아래를 피해 앞쪽으로 나와 기침·먼지 휘젓기
  air_quality: [[-2.8, 4.4], [-1.8, 5.0], [-0.8, 4.3], [0.2, 5.0], [1.2, 4.3], [2.2, 5.0], [-1.3, 3.5]]
    .map((at, i) => (i % 2
      ? { act: 'swat', bubble: '훠이!', at, face: 0.3 }
      : { act: 'cough', bubble: '콜록', at, face: -0.3 })),
  // 문에 가까운 3명이 문을 밀어 막고, 나머지는 차압계 앞에 모여 걱정
  pressure: [
    { act: 'worried', bubble: '⚠️', at: [5.9, -4.2], face: 'gauge' },
    { act: 'push', bubble: '끙!', at: [4.0, -5.0], face: Math.PI },
    { act: 'worried', bubble: '⚠️', at: [6.35, -3.5], face: 'gauge' },
    { act: 'worried', bubble: '😨', at: [5.4, -3.6], face: 'gauge' },
    { act: 'push', bubble: '끙!', at: [4.6, -4.95], face: Math.PI },
    { act: 'push', bubble: '끙!', at: [5.2, -5.0], face: Math.PI },
    { act: 'worried', bubble: '😨', at: [4.55, -3.8], face: 'gauge' },
  ],
}

// ── 여러 위험이 동시에 켜졌을 때 대형 조합 ─────────
// 우선순위: 가스 > 차압 > 온도 > 공기질 > 습도 (scenarios.js)
//   가스 포함        → 7명 모두 입 막고 문 앞 대피 (대피와 부딪히는 차압 '문 밀기'는 뺌)
//   차압 포함(가스X) → 3명은 문 밀기, 나머지는 다음 우선 상황의 대형 (없으면 차압계 앞)
//   그 밖            → 가장 우선인 상황의 대형 + 하위 상황 동작 덧붙이기
//     습도: 한 손만 쓰는 동작(부채질·기침)이면 왼손에 우산 / 공기질: 입을 막고 있지 않으면 가끔 콜록
//   말풍선은 켜진 상황들의 아이콘이 번갈아 뜸
const UMBRELLA_OK = ['fan', 'cough'] // 오른손만 쓰는 동작 → 왼손으로 우산을 들 수 있음
const COUGH_SKIP = ['cough', 'swat', 'cover'] // 이미 기침·먼지 쫓기·입 막기 중이면 덧붙이지 않음
// 대형을 따르지 않는(덧붙이기·뺀) 상황은 그 상황을 나타내는 대표 아이콘으로 말풍선에 표시
const SCENARIO_ICON = { gas: '😷', pressure: '⚠️', temperature: '🔥', air_quality: '콜록', humidity: '💧' }
function composePlan(keys, i) {
  const sorted = sortByPriority(keys)
  let baseKey
  if (sorted.includes('gas')) {
    baseKey = 'gas'
  } else if (sorted.includes('pressure')) {
    const next = sorted.find((k) => k !== 'pressure')
    baseKey = PLANS.pressure[i].act === 'push' || !next ? 'pressure' : next
  } else {
    baseKey = sorted[0]
  }
  const base = PLANS[baseKey][i]
  const bubbles = [...new Set([base.bubble, ...sorted.filter((k) => k !== baseKey).map((k) => SCENARIO_ICON[k])])]
  return {
    ...base,
    umbrella: sorted.includes('humidity') && UMBRELLA_OK.includes(base.act),
    cough: sorted.includes('air_quality') && !COUGH_SKIP.includes(base.act),
    bubbles,
  }
}

// ── 말풍선 ────────────────────────────────────
const bubbleCache = new Map()
function bubbleTexture(text) {
  if (bubbleCache.has(text)) return bubbleCache.get(text)
  const c = document.createElement('canvas')
  c.width = 160
  c.height = 132
  const g = c.getContext('2d')
  g.fillStyle = '#ffffff'
  g.strokeStyle = '#94a3b8'
  g.lineWidth = 5
  g.beginPath()
  g.moveTo(30, 8)
  g.arcTo(152, 8, 152, 100, 26)
  g.arcTo(152, 100, 8, 100, 26)
  g.lineTo(92, 100)
  g.lineTo(80, 126) // 꼬리
  g.lineTo(68, 100)
  g.arcTo(8, 100, 8, 8, 26)
  g.arcTo(8, 8, 152, 8, 26)
  g.closePath()
  g.fill()
  g.stroke()
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  const emoji = /\p{Extended_Pictographic}/u.test(text)
  g.font = emoji ? '58px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'
    : 'bold 44px "Malgun Gothic", "Apple SD Gothic Neo", sans-serif'
  g.fillStyle = '#1e293b'
  g.fillText(text, 80, 57)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  bubbleCache.set(text, tex)
  return tex
}

export function buildWorkers(nav) {
  const root = new THREE.Group()
  root.name = 'workers'
  const people = []
  const V = (x, z) => new THREE.Vector2(x, z)
  const toV = (pts) => pts.map(([x, z]) => V(x, z))

  function addPerson(w, extra) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }))
    sprite.name = `${w.root.name}_bubble`
    sprite.position.y = 1.72
    sprite.visible = false
    sprite.renderOrder = 10
    w.root.add(sprite)
    const p = { ...w, bubble: sprite, bubbleT: 0, bubbleHideAt: Infinity, path: [], walkT: 0, act: null, actFace: null, umbrellaT: 0, ...extra }
    people.push(p)
    return p
  }

  STATIONS.forEach((s, i) => {
    const w = buildWorker(s.name, BADGES[i])
    w.root.position.set(s.x, 0, s.z)
    w.root.rotation.y = s.face
    root.add(w.root)
    addPerson(w, { station: s, mode: 'work', phase: i * 1.3, target: [s.x, s.z] })
  })

  // 순회 경로: 루프 지점 사이를 길찾기로 이어 붙여 장비를 피함
  const loopPts = []
  LOOP.forEach((pt, i) => {
    const next = LOOP[(i + 1) % LOOP.length]
    loopPts.push(...nav.path(pt, next))
  })

  // 순회 작업자 + 웨이퍼 트레이
  const walker = buildWorker('worker_walker', BADGES[6])
  const tray = new THREE.Group()
  tray.name = 'worker_walker_tray'
  tray.position.set(0, 0.56, 0.4) // 앞으로 내민 두 손 위
  tray.add(rbox('worker_walker_tray_box', 0.4, 0.045, 0.32, new THREE.MeshStandardMaterial({ color: 0x3aa9ad, roughness: 0.35 }), 0, 0, 0, 0.02))
  tray.add(cyl('worker_walker_tray_wafer', 0.13, 0.13, 0.012, new THREE.MeshStandardMaterial({ color: 0x5fd0dc, metalness: 0.7, roughness: 0.2 }), 0, 0.03, 0, 32))
  walker.body.add(tray)
  walker.root.position.set(LOOP[0][0], 0, LOOP[0][1])
  root.add(walker.root)
  addPerson(walker, { station: null, mode: 'loop', loopIdx: 0, phase: 9, carrying: true, tray })

  let current = '' // 켜진 위험 목록을 문자열로 (같은 조합이면 다시 배치하지 않음)
  let lastMoved = 0

  function showBubble(p, text, holdSec = Infinity) {
    if (!text) { p.bubble.visible = false; return }
    p.bubble.material.map = bubbleTexture(text)
    p.bubble.material.needsUpdate = true
    p.bubble.visible = true
    p.bubbleT = 0
    p.bubbleHideAt = holdSec
  }

  function nearestLoopIdx(x, z) {
    let best = 0, bd = Infinity
    loopPts.forEach(([lx, lz], k) => {
      const d = Math.hypot(lx - x, lz - z)
      if (d < bd) { bd = d; best = k }
    })
    return best
  }

  // keys: 켜진 위험 목록 (여러 개 가능, 빈 목록 = 정상)
  function setScenarios(keys) {
    keys = sortByPriority(keys)
    const sig = keys.join(',')
    if (sig === current) return
    current = sig
    lastMoved = 0
    people.forEach((p, i) => {
      p.umbrella.visible = false
      p.umbrellaT = 0
      p.umbrellaOverlay = false
      p.coughOverlay = false
      p.bubbles = []
      const pos = [p.root.position.x, p.root.position.z]
      let target
      if (keys.length === 0) {
        // 정상 복귀: 제자리(순회자는 가까운 순회 지점)로 걸어 돌아감
        p.act = null
        if (p.station) {
          target = [p.station.x, p.station.z]
        } else {
          p.loopIdx = nearestLoopIdx(...pos)
          target = loopPts[p.loopIdx]
        }
        p.mode = 'return'
        showBubble(p, '♪', 2.5)
      } else {
        const plan = composePlan(keys, i)
        p.act = plan.act
        p.actWalk = plan.walk || 'swing'
        p.actFace = plan.face ?? null
        p.umbrellaOverlay = plan.umbrella
        p.coughOverlay = plan.cough
        p.bubbles = plan.bubbles
        p.bubbleIdx = 0
        p.bubbleCycleT = 0
        target = plan.at
        p.mode = 'move'
        showBubble(p, plan.bubbles[0])
      }
      p.path = toV(nav.path(pos, target))
      // '이동함' = 직전 목표 자리와 다른 곳으로 배정됨 (순회자는 늘 걷고 있으므로 항상 이동으로 침)
      const prev = p.target
      if (!prev || Math.hypot(target[0] - prev[0], target[1] - prev[1]) > 0.3) lastMoved++
      p.target = target
    })
  }

  const tmp = new THREE.Vector2()

  // 한 걸음: path의 다음 지점으로 이동. 도착하면 true
  function step(p, dt, speed = WALK_SPEED) {
    const target = p.path[0]
    if (!target) return true
    tmp.set(target.x - p.root.position.x, target.y - p.root.position.z)
    const dist = tmp.length()
    const move = speed * dt
    if (dist <= move) {
      p.root.position.x = target.x
      p.root.position.z = target.y
      p.path.shift()
      return p.path.length === 0
    }
    // 마지막 지점에 거의 다 왔으면 도착으로 침 (옆 사람에게 살짝 밀려 정확히 못 닿아도 멈추지 않게)
    if (p.path.length === 1 && dist < ARRIVE) {
      p.path.shift()
      return true
    }
    tmp.multiplyScalar(move / dist)
    p.root.position.x += tmp.x
    p.root.position.z += tmp.y
    p.root.rotation.y = lerpAngle(p.root.rotation.y, heading(tmp.x, tmp.y), Math.min(1, dt * 8))
    return false
  }

  function resetBody(p) {
    p.body.position.y = 0
    p.body.rotation.set(0, 0, 0)
    p.arms[0].rotation.z = -0.28
    p.arms[1].rotation.z = 0.28
  }

  // 통통 튀는 걸음: 발 디딜 때 몸이 살짝 눌리고(squash) 떠오를 때 늘어남(stretch)
  function poseWalk(p, dt, style) {
    p.walkT += dt * 9
    const s = Math.sin(p.walkT)
    const bounce = Math.abs(Math.cos(p.walkT))
    resetBody(p)
    p.legs[0].rotation.x = s * 0.7
    p.legs[1].rotation.x = -s * 0.7
    if (style === 'carry') {
      p.arms[0].rotation.x = p.arms[1].rotation.x = -1.25 + bounce * 0.05
    } else if (style === 'cover') {
      // 두 손으로 입 막고 종종걸음
      p.arms[0].rotation.set(-2.35, 0, 0.55)
      p.arms[1].rotation.set(-2.35, 0, -0.55)
    } else {
      p.arms[0].rotation.x = -s * 0.75
      p.arms[1].rotation.x = s * 0.75
    }
    p.body.position.y = bounce * 0.07
    const squash = Math.cos(p.walkT * 2) * 0.045
    p.body.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5)
    p.body.rotation.x = 0.05
    p.head.rotation.set(0, 0, s * 0.09) // 걸음에 맞춰 고개가 좌우로 갸웃
  }

  // 제자리 동작들
  function poseAct(p, t, dt, act) {
    p.legs[0].rotation.x = p.legs[1].rotation.x = 0
    resetBody(p)
    const ph = p.phase
    const breathe = Math.sin(t * 2 + ph) * 0.012
    p.body.scale.set(1 - breathe * 0.5, 1 + breathe, 1 - breathe * 0.5) // 숨쉬기
    const [L, R] = p.arms
    switch (act) {
      case 'work':
      case 'work_fast': {
        // 장비를 만지는 손동작 + 고개 끄덕끄덕 (work_fast는 다급하게 빨리)
        const k = act === 'work_fast' ? 2.6 : 1
        L.rotation.x = -1.3 + Math.sin(t * 3 * k + ph) * 0.2
        R.rotation.x = -1.15 + Math.sin(t * 3.4 * k + ph + 1.5) * 0.22
        p.body.position.y = Math.max(0, Math.sin(t * 3 * k + ph)) * 0.015 * k
        p.body.rotation.x = 0.08
        p.head.rotation.set(0.12 + Math.sin(t * 2.2 * k + ph) * 0.08, Math.sin(t * 0.6 + ph) * 0.15, 0)
        break
      }
      case 'fan': {
        // 오른손으로 얼굴 앞 부채질, 왼손은 허리에
        R.rotation.set(-2.0, 0, -0.1 + Math.sin(t * 14 + ph) * 0.45)
        L.rotation.set(-0.3, 0, -0.9)
        p.body.rotation.z = Math.sin(t * 2 + ph) * 0.04
        p.head.rotation.set(-0.15, 0, Math.sin(t * 3 + ph) * 0.1) // 고개 젖히고 헥헥
        p.body.position.y = Math.abs(Math.sin(t * 4 + ph)) * 0.012
        break
      }
      case 'worried': {
        // 두 손으로 머리 감싸고 발 동동
        L.rotation.set(-2.7, 0, 0.75)
        R.rotation.set(-2.7, 0, -0.75)
        p.body.position.y = Math.max(0, Math.sin(t * 9 + ph)) * 0.04
        p.legs[0].rotation.x = Math.max(0, Math.sin(t * 9 + ph)) * 0.35
        p.legs[1].rotation.x = Math.max(0, -Math.sin(t * 9 + ph)) * 0.35
        p.head.rotation.set(0, Math.sin(t * 5 + ph) * 0.35, 0)
        break
      }
      case 'umbrella': {
        // 오른손으로 우산 들고 왼손은 몸에 붙여 움츠림, 살짝 떨림
        p.umbrellaT = Math.min(1, p.umbrellaT + dt * 4)
        const pop = p.umbrellaT < 1 ? Math.sin(p.umbrellaT * Math.PI * 0.75) / Math.sin(Math.PI * 0.75) : 1
        p.umbrella.visible = true
        p.umbrella.position.x = 0.2 // 오른손
        p.umbrella.scale.setScalar(Math.max(0.01, pop))
        R.rotation.set(-1.25, 0, 0.1)
        L.rotation.set(-0.6, 0, -0.5)
        p.body.rotation.z = Math.sin(t * 25 + ph) * 0.012 // 오들오들
        p.head.rotation.set(0.1, Math.sin(t * 0.9 + ph) * 0.4, 0) // 위를 살피며 두리번
        break
      }
      case 'cover': {
        // 입 막고 웅크림
        L.rotation.set(-2.35, 0, 0.55)
        R.rotation.set(-2.35, 0, -0.55)
        p.body.rotation.x = 0.18
        p.body.position.y = -0.02
        p.head.rotation.set(0.2, Math.sin(t * 1.5 + ph) * 0.2, 0)
        break
      }
      case 'cough': {
        // 콜록콜록: 1.2초마다 두세 번 몸을 숙였다 폄, 한 손은 입에
        const c = (t + ph) % 1.2
        const hit = c < 0.5 ? Math.abs(Math.sin(c * Math.PI * 6)) : 0
        R.rotation.set(-2.3, 0, -0.5)
        L.rotation.set(-0.2 - hit * 0.4, 0, -0.35)
        p.body.rotation.x = 0.05 + hit * 0.3
        p.body.position.y = hit * 0.02
        p.head.rotation.set(hit * 0.35, 0, 0)
        break
      }
      case 'swat': {
        // 두 팔을 머리 위로 휘휘 저어 먼지 쫓기
        L.rotation.set(-2.6, 0, 0.3 + Math.sin(t * 11 + ph) * 0.5)
        R.rotation.set(-2.6, 0, -0.3 + Math.sin(t * 11 + ph + 1) * 0.5)
        p.body.rotation.z = Math.sin(t * 5.5 + ph) * 0.08
        p.head.rotation.set(-0.1, Math.sin(t * 5.5 + ph) * 0.3, 0)
        break
      }
      case 'push': {
        // 문을 두 팔로 밀며 버팀: 몸을 앞으로 기울이고 다리를 뒤로, 부들부들
        L.rotation.set(-1.55, 0, 0.15)
        R.rotation.set(-1.55, 0, -0.15)
        p.body.rotation.x = 0.3
        p.legs[0].rotation.x = 0.45
        p.legs[1].rotation.x = -0.1
        p.body.position.y = Math.sin(t * 30 + ph) * 0.006
        p.head.rotation.set(-0.1, 0, Math.sin(t * 20 + ph) * 0.03)
        break
      }
      default: {
        // 대기: 팔 내리고 몸을 좌우로 살랑, 두리번두리번
        L.rotation.x = Math.sin(t * 1.6 + ph) * 0.08
        R.rotation.x = -Math.sin(t * 1.6 + ph) * 0.08
        p.body.rotation.z = Math.sin(t * 1.4 + ph) * 0.05
        p.head.rotation.set(-0.05, Math.sin(t * 0.8 + ph) * 0.55, 0)
      }
    }

    // ── 하위 상황 동작 덧붙이기 (여러 위험 동시) ──
    if (p.umbrellaOverlay && UMBRELLA_OK.includes(act)) {
      // 습도: 오른손은 하던 동작, 왼손으로 우산
      p.umbrellaT = Math.min(1, p.umbrellaT + dt * 4)
      const pop = p.umbrellaT < 1 ? Math.sin(p.umbrellaT * Math.PI * 0.75) / Math.sin(Math.PI * 0.75) : 1
      p.umbrella.visible = true
      p.umbrella.position.x = -0.2 // 왼손
      p.umbrella.scale.setScalar(Math.max(0.01, pop))
      L.rotation.set(-1.25, 0, -0.1)
    }
    if (p.coughOverlay) {
      // 공기질: 하던 동작 중 2.6초마다 '콜록'
      const c = (t + ph * 1.7) % 2.6
      if (c < 0.5) {
        const hit = Math.abs(Math.sin(c * Math.PI * 6))
        p.body.rotation.x += hit * 0.25
        p.head.rotation.x += hit * 0.3
      }
    }
  }

  // 2~5초마다 눈 깜빡임
  function blink(p, dt) {
    p.blinkAt -= dt
    if (p.blinkAt < 0) {
      p.eyes.scale.y = 0.12
      if (p.blinkAt < -0.12) {
        p.eyes.scale.y = 1
        p.blinkAt = 2 + Math.random() * 3
      }
    }
  }

  // 말풍선: 나타날 때 '퐁' 커졌다 돌아오고, 떠 있는 동안 둥실둥실
  function updateBubble(p, dt, t) {
    if (!p.bubble.visible) return
    // 켜진 위험이 여러 개면 아이콘을 1.6초마다 번갈아 (바뀔 때 다시 '퐁')
    if (p.bubbles?.length > 1) {
      p.bubbleCycleT += dt
      if (p.bubbleCycleT > 1.6) {
        p.bubbleCycleT = 0
        p.bubbleIdx = (p.bubbleIdx + 1) % p.bubbles.length
        p.bubble.material.map = bubbleTexture(p.bubbles[p.bubbleIdx])
        p.bubble.material.needsUpdate = true
        p.bubbleT = 0
      }
    }
    p.bubbleT += dt
    if (p.bubbleT > p.bubbleHideAt) { p.bubble.visible = false; return }
    const k = Math.min(1, p.bubbleT / 0.35)
    const pop = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.35 : 1
    const s = 0.6 * Math.min(1, k * 1.6) * pop
    p.bubble.scale.set(s, s * 0.825, 1)
    p.bubble.position.y = 1.72 + Math.sin(t * 2.5 + p.phase) * 0.04
  }

  function faceToward(p, dt) {
    let f = p.actFace
    if (typeof f === 'string') f = LOOK[f]
    if (Array.isArray(f)) f = heading(f[0] - p.root.position.x, f[1] - p.root.position.z)
    if (typeof f === 'number') p.root.rotation.y = lerpAngle(p.root.rotation.y, f, Math.min(1, dt * 5))
  }

  // 서로 겹치지 않게 밀어내기 + 걷다가 장비에 파고들면 밖으로 밀어내기
  // 장비 앞에서 작업 중인 사람은 고정, 위험 대형 자리에 선 사람은 살짝만 밀림(걷는 사람이 비집고 지나갈 수 있게)
  const SPACING = 0.58 // 서 있는 사람끼리 간격
  const PASS_GAP = 0.42 // 걷는 사람이 지나갈 때 간격
  const fixed = (p) => p.mode === 'work' || p.mode === 'act'
  const weight = (p) => (p.mode === 'work' ? 0 : p.mode === 'act' ? 0.2 : 1)
  function separate() {
    for (let a = 0; a < people.length; a++) {
      for (let b = a + 1; b < people.length; b++) {
        const A = people[a].root.position, B = people[b].root.position
        const dx = B.x - A.x, dz = B.z - A.z
        const d = Math.hypot(dx, dz)
        if (d >= SPACING || d < 1e-4) continue
        const ka = weight(people[a]), kb = weight(people[b])
        if (ka + kb === 0) continue // 둘 다 장비 앞에서 작업 중
        // 걷는 사람이 끼면 간격 기준을 줄여 살짝 스치며 비집고 지나갈 수 있게
        const gap = fixed(people[a]) && fixed(people[b]) ? SPACING : PASS_GAP
        if (d >= gap) continue
        const push = gap - d
        const wa = ka / (ka + kb)
        const wb = kb / (ka + kb)
        A.x -= (dx / d) * push * wa; A.z -= (dz / d) * push * wa
        B.x += (dx / d) * push * wb; B.z += (dz / d) * push * wb
      }
    }
    const pad = 0.12
    for (const p of people) {
      if (fixed(p)) continue
      const P = p.root.position
      const o = nav.insideObstacle(P.x, P.z, pad)
      if (!o) continue
      const [x0, z0, x1, z1] = o.r
      const gaps = [P.x - (x0 - pad), (x1 + pad) - P.x, P.z - (z0 - pad), (z1 + pad) - P.z]
      const m = Math.min(...gaps)
      if (m === gaps[0]) P.x = x0 - pad
      else if (m === gaps[1]) P.x = x1 + pad
      else if (m === gaps[2]) P.z = z0 - pad
      else P.z = z1 + pad
    }
  }

  function update(dt, t) {
    for (const p of people) {
      blink(p, dt)
      updateBubble(p, dt, t)
      if (p.tray) p.tray.visible = p.mode === 'loop' || (p.mode === 'return' && !p.station)

      if (p.mode === 'work') {
        poseAct(p, t, dt, 'work')
      } else if (p.mode === 'loop') {
        if (!p.path.length) p.path = [V(...loopPts[p.loopIdx])]
        if (step(p, dt)) p.loopIdx = (p.loopIdx + 1) % loopPts.length
        poseWalk(p, dt, 'carry')
      } else if (p.mode === 'move') {
        // 위험 상황으로 이동: 평소보다 빠른 종종걸음
        if (step(p, dt, WALK_SPEED * 1.3)) p.mode = 'act'
        else poseWalk(p, dt * 1.3, p.actWalk)
      } else if (p.mode === 'act') {
        faceToward(p, dt)
        poseAct(p, t, dt, p.act)
      } else if (p.mode === 'return') {
        if (step(p, dt)) {
          if (p.station) {
            p.mode = 'work'
            p.root.rotation.y = p.station.face
          } else {
            p.mode = 'loop'
            p.loopIdx = (p.loopIdx + 1) % loopPts.length
          }
        } else {
          poseWalk(p, dt, p.station ? 'swing' : 'carry')
        }
      }
    }
    separate()
  }

  function summary() {
    const modes = {}
    const acts = {}
    for (const p of people) {
      modes[p.mode] = (modes[p.mode] || 0) + 1
      if (p.mode === 'act') acts[p.act] = (acts[p.act] || 0) + 1
    }
    // 겹침(0.4 미만으로 붙은 쌍) · 장비 안에 들어간 사람 수 — 자가진단용
    let overlaps = 0
    for (let a = 0; a < people.length; a++) {
      for (let b = a + 1; b < people.length; b++) {
        const A = people[a].root.position, B = people[b].root.position
        if (Math.hypot(A.x - B.x, A.z - B.z) < 0.4) overlaps++
      }
    }
    const inObstacle = people.filter((p) => nav.insideObstacle(p.root.position.x, p.root.position.z, 0)).length
    const umbrellas = people.filter((p) => p.umbrella.visible).length
    const coughing = people.filter((p) => p.coughOverlay && p.mode === 'act').length
    const bubbleCounts = people.map((p) => (p.bubbles || []).length) // 번갈아 뜨는 말풍선 아이콘 수
    return { modes, acts, moved: lastMoved, overlaps, inObstacle, umbrellas, coughing, bubbleCounts }
  }

  return { root, update, setScenarios, setScenario: (k) => setScenarios(k === 'normal' ? [] : [k]), summary }
}
