// 방진복 작업자 7명 + 동작
//   평소: 각자 장비 앞에서 작업, 1명은 웨이퍼 트레이를 들고 순회
//   위험: 시나리오마다 다른 행동(PLANS) + 머리 위 말풍선
//     온도 부채질·뒷걸음 / 습도 우산 / 가스 입 막고 문 앞 대피 / 공기질 기침·먼지 휘젓기 / 차압 3명이 문 밀어 막기
//   위험이 연달아 바뀌면 지금 위치에서 바로 다음 행동으로 (통로 지점 NODES를 따라 장비를 피해 이동)
//   정상 복귀: 제자리로 돌아가 작업 재개 (♪ 말풍선)
import * as THREE from 'three'
import { COLOR, MAT, rbox, cyl } from './parts.js'

// 둥글둥글한 캐릭터용 재질 (살짝 크림빛 흰색 + 부드러운 광택)
const SUIT = new THREE.MeshStandardMaterial({ color: 0xfbfcfd, roughness: 0.62 })
const SUIT_SHADE = new THREE.MeshStandardMaterial({ color: 0xe9eef4, roughness: 0.7 })
const GLOVE = new THREE.MeshStandardMaterial({ color: COLOR.glove, roughness: 0.5 })
const VISOR = new THREE.MeshStandardMaterial({ color: 0x24506a, roughness: 0.08, metalness: 0.35 })
const EYE_WHITE = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, emissive: 0xffffff, emissiveIntensity: 0.25 })
const PUPIL = new THREE.MeshStandardMaterial({ color: 0x1b2430, roughness: 0.3 })
const SHINE = new THREE.MeshBasicMaterial({ color: 0xffffff })
const BLUSH = new THREE.MeshBasicMaterial({ color: 0xffa8b8, transparent: true, opacity: 0.75 })
const SEAM = new THREE.MeshStandardMaterial({ color: 0xd6dee6, roughness: 0.8 })
// 사람마다 다른 가슴 배지 색
const BADGES = [0x2fb3b5, 0xff8a65, 0xffc947, 0x9b7bff, 0x4f9dff, 0x5cc977, 0xff7fb0]
const WORKER_SCALE = 1.15

const WALK_SPEED = 1.5

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
  // 고글(얼굴 앞 둥근 창): 구의 앞쪽 일부만 잘라 쓴다
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.312, 32, 16, Math.PI * 0.5 - 0.62, 1.24, Math.PI * 0.5 - 0.42, 0.62),
    VISOR,
  )
  visor.name = `${name}_visor`
  visor.scale.set(1.0, 0.94, 0.98)
  head.add(visor)
  // 동그란 눈 (흰자 + 눈동자 + 반짝임) — 깜빡일 때 eyes 그룹을 납작하게
  const eyes = new THREE.Group()
  eyes.position.set(0, 0.04, 0.3) // 고글 표면보다 살짝 앞에
  for (const side of [-1, 1]) {
    const eye = new THREE.Group()
    eye.position.set(0.095 * side, 0, 0)
    eye.add(sphere(`${name}_eye`, 0.055, EYE_WHITE, 0, 0, 0, 1, 1.15, 0.5))
    eye.add(sphere(`${name}_pupil`, 0.032, PUPIL, 0, -0.004, 0.022, 1, 1.15, 0.5))
    eye.add(sphere(`${name}_shine`, 0.011, SHINE, 0.012, 0.018, 0.04))
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

// ── 통로 길찾기 ────────────────────────────────
// 장비 사이 통로의 지점들. 어디서 어디로 가든 이 지점들을 따라 걸어 장비를 피한다.
const NODES = {
  n0: [-2.6, 3.4], n1: [0.0, 4.6], n2: [3.2, 4.4], n3: [3.4, 1.0], n4: [0.3, -0.9], n5: [-2.6, -0.9],
  hub: [5.0, -1.6], e1: [6.2, 0.6], b1: [-2.85, -2.9],
}
const EDGES = [
  ['n0', 'n1'], ['n1', 'n2'], ['n2', 'n3'], ['n3', 'n4'], ['n4', 'n5'], ['n5', 'n0'],
  ['n3', 'hub'], ['n4', 'hub'], ['hub', 'e1'], ['b1', 'n5'], ['b1', 'n4'],
]
const ADJ = {}
for (const [a, b] of EDGES) {
  const d = Math.hypot(NODES[a][0] - NODES[b][0], NODES[a][1] - NODES[b][1])
  ;(ADJ[a] ||= []).push([b, d])
  ;(ADJ[b] ||= []).push([a, d])
}
function route(from, to) { // 가장 짧은 지점 경로 (다익스트라)
  const dist = { [from]: 0 }
  const prev = {}
  const left = new Set(Object.keys(NODES))
  while (left.size) {
    let u = null
    for (const k of left) if (dist[k] !== undefined && (u === null || dist[k] < dist[u])) u = k
    if (u === null || u === to) break
    left.delete(u)
    for (const [v, w] of ADJ[u] || []) {
      if (dist[u] + w < (dist[v] ?? Infinity)) { dist[v] = dist[u] + w; prev[v] = u }
    }
  }
  const path = [to]
  while (path[0] !== from && prev[path[0]]) path.unshift(prev[path[0]])
  return path
}
function nearestNode(x, z) {
  let best = null
  let bd = Infinity
  for (const [k, [nx, nz]] of Object.entries(NODES)) {
    const d = Math.hypot(nx - x, nz - z)
    if (d < bd) { bd = d; best = k }
  }
  return best
}

// ── 작업 위치 ─────────────────────────────────
// home: 평소 서 있는 곳·방향 / node: 통로로 나갈 때 들르는 지점 / entry: home과 node 사이 경유지
const STATIONS = [
  { name: 'worker_bench', x: -2.85, z: -3.85, face: Math.PI, node: 'b1', entry: [] },          // 케미컬 벤치
  { name: 'worker_kiosk', x: 3.4, z: -2.45, face: 2.8, node: 'hub', entry: [] },                // 노광장비 단말기
  { name: 'worker_tool', x: -4.15, z: 0.75, face: -Math.PI / 2, node: 'n5', entry: [] },        // 공정장비 2
  // 검사대 작업자는 옆에 서서 현미경을 봄 (뒤에 서면 키가 작아 책상에 가려짐)
  { name: 'worker_insp1', x: -0.2, z: 0.75, face: -Math.PI / 2, node: 'n4', entry: [] },        // 검사대 1 오른쪽
  { name: 'worker_insp2', x: 0.68, z: 2.85, face: Math.PI / 2 - 0.15, node: 'n4', entry: [[0.6, 1.6]] }, // 검사대 2 왼쪽
  { name: 'worker_cart', x: 5.85, z: 1.8, face: -1.92, node: 'e1', entry: [] },                 // FOUP 카트
]
// 순회 작업자 루프 = 통로 지점 n0→n5
const LOOP = ['n0', 'n1', 'n2', 'n3', 'n4', 'n5']

const DOOR = [4.6, -5.7]
const SLOTS = [ // 가스 대피 때 출입문 앞 집결 위치
  [4.4, -4.5], [5.2, -4.5], [6.0, -4.4], [4.4, -3.7], [5.2, -3.7], [6.0, -3.6], [5.2, -2.9],
]
const PUSH_SPOTS = [[4.2, -5.0], [4.65, -4.95], [5.1, -5.0]] // 차압 때 문을 밀어 막는 자리

// ── 시나리오별 행동표 ──────────────────────────
// 작업자 순서: 0 벤치, 1 단말기, 2 공정장비, 3 검사대1, 4 검사대2, 5 카트, 6 순회
// go: 'stay'(그 자리) | 'slot'(문 앞 집결) | 'push'(문 밀기 자리) | {x, z, face?, direct?}
// face: 'door'면 문 쪽을 봄
const PLANS = {
  temperature: [
    { act: 'fan', bubble: '💦' },
    { act: 'work_fast', bubble: '❗' },
    { act: 'fan', bubble: '🔥', go: { x: -2.5, z: 1.0, face: -Math.PI / 2, direct: true } }, // 뜨거운 장비에서 뒷걸음질
    { act: 'worried', bubble: '🥵' },
    { act: 'fan', bubble: '💦' },
    { act: 'fan', bubble: '💦' },
    { act: 'worried', bubble: '🔥' },
  ],
  humidity: [
    { act: 'umbrella', bubble: '💧' }, { act: 'umbrella', bubble: '☔' }, { act: 'umbrella', bubble: '💧' },
    { act: 'umbrella', bubble: '☔' }, { act: 'umbrella', bubble: '💧' }, { act: 'umbrella', bubble: '☔' },
    { act: 'umbrella', bubble: '💧' },
  ],
  gas: Array.from({ length: 7 }, (_, i) => ({ act: 'cover', bubble: i % 2 ? '😷' : '❗', go: 'slot', walk: 'cover' })),
  air_quality: [
    { act: 'cough', bubble: '콜록' }, { act: 'swat', bubble: '훠이!' }, { act: 'cough', bubble: '콜록' },
    { act: 'swat', bubble: '훠이!' }, { act: 'cough', bubble: '콜록' }, { act: 'swat', bubble: '훠이!' },
    { act: 'cough', bubble: '콜록' },
  ],
  pressure: [
    { act: 'worried', bubble: '⚠️', face: 'door' },
    { act: 'push', bubble: '끙!', go: 'push', pushIdx: 0 },
    { act: 'worried', bubble: '⚠️', face: 'door' },
    { act: 'worried', bubble: '😨', face: 'door' },
    { act: 'push', bubble: '끙!', go: 'push', pushIdx: 1 },
    { act: 'push', bubble: '끙!', go: 'push', pushIdx: 2 },
    { act: 'worried', bubble: '😨', face: 'door' },
  ],
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

export function buildWorkers() {
  const root = new THREE.Group()
  root.name = 'workers'
  const people = []

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
    addPerson(w, { station: s, mode: 'work', atHome: true, phase: i * 1.3, slot: SLOTS[i] })
  })

  // 순회 작업자 + 웨이퍼 트레이
  const walker = buildWorker('worker_walker', BADGES[6])
  const tray = new THREE.Group()
  tray.name = 'worker_walker_tray'
  tray.position.set(0, 0.56, 0.4) // 앞으로 내민 두 손 위
  tray.add(rbox('worker_walker_tray_box', 0.4, 0.045, 0.32, new THREE.MeshStandardMaterial({ color: 0x3aa9ad, roughness: 0.35 }), 0, 0, 0, 0.02))
  tray.add(cyl('worker_walker_tray_wafer', 0.13, 0.13, 0.012, new THREE.MeshStandardMaterial({ color: 0x5fd0dc, metalness: 0.7, roughness: 0.2 }), 0, 0.03, 0, 32))
  walker.body.add(tray)
  walker.root.position.set(NODES.n0[0], 0, NODES.n0[1])
  root.add(walker.root)
  addPerson(walker, { station: null, mode: 'loop', loopIdx: 1, phase: 9, slot: SLOTS[6], carrying: true, tray })

  let scenario = 'normal'

  // ── 이동 경로 만들기 ──
  const V = (x, z) => new THREE.Vector2(x, z)
  function pathTo(p, target, targetNode, direct) {
    const pos = p.root.position
    if (direct) return [V(target[0], target[1])]
    const pts = []
    let startNode
    if (p.station && p.atHome) {
      // 제자리에서 출발: 경유지 → 통로 지점
      pts.push(...p.station.entry)
      startNode = p.station.node
    } else {
      startNode = nearestNode(pos.x, pos.z)
    }
    const nodes = route(startNode, targetNode)
    pts.push(...nodes.map((k) => NODES[k]))
    pts.push(target)
    return pts.map(([x, z]) => V(x, z))
  }

  function showBubble(p, text, holdSec = Infinity) {
    if (!text) { p.bubble.visible = false; return }
    p.bubble.material.map = bubbleTexture(text)
    p.bubble.material.needsUpdate = true
    p.bubble.visible = true
    p.bubbleT = 0
    p.bubbleHideAt = holdSec
  }

  function setScenario(key) {
    if (key === scenario) return
    scenario = key
    people.forEach((p, i) => {
      p.umbrella.visible = false
      p.umbrellaT = 0
      if (key === 'normal' || !PLANS[key]) {
        // 정상 복귀: 제자리(순회자는 가까운 루프 지점)로 돌아감
        p.act = null
        if (p.station) {
          const s = p.station
          if (p.atHome) {
            // 제자리에서 행동하던 사람은 그 자리에서 바로 작업 재개
            p.mode = 'work'
            p.path = []
            showBubble(p, '♪', 2.5)
            return
          }
          const back = [...s.entry].reverse()
          const pts = p.directHome
            ? [[s.x, s.z]]
            : [...route(nearestNode(p.root.position.x, p.root.position.z), s.node).map((k) => NODES[k]), ...back, [s.x, s.z]]
          p.path = pts.map(([x, z]) => V(x, z))
        } else {
          const k = nearestNode(p.root.position.x, p.root.position.z)
          p.loopIdx = Math.max(0, LOOP.indexOf(k))
          p.path = [V(...NODES[LOOP[p.loopIdx]])]
        }
        p.mode = 'return'
        showBubble(p, '♪', 2.5)
        return
      }

      const plan = PLANS[key][i]
      p.act = plan.act
      p.actWalk = plan.walk || 'swing'
      p.actFace = plan.face ?? null
      showBubble(p, plan.bubble)
      const go = plan.go || 'stay'
      if (go === 'stay') {
        // 그 자리(이동 중이었으면 지금 위치)에서 바로 행동. atHome은 제자리였는지 그대로 유지
        p.path = []
        p.mode = 'act'
        return
      }
      const fromHome = p.atHome
      if (go === 'slot') {
        p.path = pathTo(p, p.slot, 'hub')
        p.actFace = Math.PI
      } else if (go === 'push') {
        p.path = pathTo(p, PUSH_SPOTS[plan.pushIdx], 'hub')
        p.actFace = Math.PI
      } else {
        p.path = pathTo(p, [go.x, go.z], nearestNode(go.x, go.z), go.direct && fromHome)
        p.actFace = go.face ?? null
      }
      p.mode = 'move'
      p.atHome = false
      // 제자리에서 바로 옆으로 비켜선 경우(direct)는 정상 복귀 때도 곧장 돌아오게
      p.directHome = go.direct && fromHome
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
    p.bubbleT += dt
    if (p.bubbleT > p.bubbleHideAt) { p.bubble.visible = false; return }
    const k = Math.min(1, p.bubbleT / 0.35)
    const pop = k < 1 ? 1 + Math.sin(k * Math.PI) * 0.35 : 1
    const s = 0.6 * Math.min(1, k * 1.6) * pop
    p.bubble.scale.set(s, s * 0.825, 1)
    p.bubble.position.y = 1.72 + Math.sin(t * 2.5 + p.phase) * 0.04
  }

  function faceToward(p, dt) {
    let target = p.actFace
    if (target === 'door') target = heading(DOOR[0] - p.root.position.x, DOOR[1] - p.root.position.z)
    if (typeof target === 'number') p.root.rotation.y = lerpAngle(p.root.rotation.y, target, Math.min(1, dt * 5))
  }

  function update(dt, t) {
    for (const p of people) {
      blink(p, dt)
      updateBubble(p, dt, t)
      if (p.tray) p.tray.visible = p.mode === 'loop' || (p.mode === 'return' && !p.station)

      if (p.mode === 'work') {
        poseAct(p, t, dt, 'work')
      } else if (p.mode === 'loop') {
        if (!p.path.length) p.path = [V(...NODES[LOOP[p.loopIdx]])]
        if (step(p, dt)) p.loopIdx = (p.loopIdx + 1) % LOOP.length
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
            p.atHome = true
            p.directHome = false
            p.root.rotation.y = p.station.face
          } else {
            p.mode = 'loop'
            p.loopIdx = (p.loopIdx + 1) % LOOP.length
          }
        } else {
          poseWalk(p, dt, p.station ? 'swing' : 'carry')
        }
      }
    }
  }

  function summary() {
    const modes = {}
    const acts = {}
    for (const p of people) {
      modes[p.mode] = (modes[p.mode] || 0) + 1
      if (p.mode === 'act') acts[p.act] = (acts[p.act] || 0) + 1
    }
    return { modes, acts }
  }

  return { root, update, setScenario, summary }
}
