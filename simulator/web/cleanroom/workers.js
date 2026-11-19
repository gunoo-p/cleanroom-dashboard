// 방진복 작업자 7명 + 동작
//   평소: 각자 장비 앞에서 작업(팔 움직임), 1명은 웨이퍼 트레이를 들고 순회
//   위험: 장비를 피하는 경유지를 거쳐 출입문 앞으로 대피해 모임
//   정상 복귀: 왔던 길을 되짚어 제자리로
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
const HUB = new THREE.Vector2(5.0, -1.6) // 대피 경로가 모이는 지점 (장비 없는 통로)
const SLOTS = [ // 출입문 앞 집결 위치
  [4.4, -4.5], [5.2, -4.5], [6.0, -4.4], [4.4, -3.7], [5.2, -3.7], [6.0, -3.6], [5.2, -2.9],
]
const FACE_DOOR = Math.PI // -z(문 쪽)을 바라봄

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

  root.scale.setScalar(WORKER_SCALE)
  return { root, body, legs, arms, head, eyes, blinkAt: 1 + Math.random() * 3 }
}

function heading(dx, dz) { return Math.atan2(dx, dz) }
function lerpAngle(a, b, t) {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

// 작업 위치 정의: home(서 있는 곳·바라보는 방향) + 대피할 때 먼저 들르는 경유지
const STATIONS = [
  { name: 'worker_bench',  x: -2.85, z: -3.85, face: Math.PI,  out: [] },             // 케미컬 벤치
  { name: 'worker_kiosk',  x: 3.4,   z: -2.45, face: 2.8,      out: [] },             // 노광장비 단말기
  { name: 'worker_tool',   x: -4.15, z: 0.75,  face: -Math.PI / 2, out: [[-2.6, -0.6]] }, // 공정장비 2
  // 검사대 작업자는 옆에 서서 현미경을 봄 (뒤에 서면 키가 작아 책상에 가려짐)
  { name: 'worker_insp1',  x: -0.2,  z: 0.75,  face: -Math.PI / 2, out: [] },          // 검사대 1 오른쪽
  { name: 'worker_insp2',  x: 0.68,  z: 2.85,  face: Math.PI / 2 - 0.15, out: [[0.6, 1.6]] }, // 검사대 2 왼쪽
  { name: 'worker_cart',   x: 5.85,  z: 1.8,   face: -1.92,    out: [[6.2, 0.6]] },   // FOUP 카트
]
// 순회하는 작업자 경로 (장비를 피하는 루프)
const LOOP = [[-2.6, 3.4], [0.0, 4.6], [3.2, 4.4], [3.4, 1.0], [0.3, -0.9], [-2.6, -0.9]]
const LOOP_EXIT = 3 // 대피할 때 이 지점(3.4, 1.0)까지 루프를 따라간 뒤 HUB로

export function buildWorkers() {
  const root = new THREE.Group()
  root.name = 'workers'
  const people = []

  STATIONS.forEach((s, i) => {
    const w = buildWorker(s.name, BADGES[i])
    w.root.position.set(s.x, 0, s.z)
    w.root.rotation.y = s.face
    root.add(w.root)
    people.push({ ...w, station: s, mode: 'work', path: [], phase: i * 1.3, slot: SLOTS[i], walkT: 0 })
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
  people.push({ ...walker, station: null, mode: 'loop', loopIdx: 1, path: [], phase: 9, slot: SLOTS[6], walkT: 0, carrying: true })

  let alarm = false

  function setAlarm(on) {
    if (on === alarm) return
    alarm = on
    for (const p of people) {
      const pos = new THREE.Vector2(p.root.position.x, p.root.position.z)
      if (on) {
        let pts
        if (p.station) {
          pts = [...p.station.out]
        } else {
          // 순회자는 루프를 따라 출구 지점까지 간 뒤 빠진다
          pts = []
          let k = p.mode === 'loop' ? p.loopIdx : LOOP_EXIT
          for (let guard = 0; guard < LOOP.length && k !== (LOOP_EXIT + 1) % LOOP.length; guard++) {
            pts.push(LOOP[k])
            k = (k + 1) % LOOP.length
          }
        }
        p.path = [...pts, [HUB.x, HUB.y], p.slot].map(([x, z]) => new THREE.Vector2(x, z))
        p.returnPath = [[HUB.x, HUB.y], ...(p.station ? [...p.station.out].reverse() : []),
          p.station ? [p.station.x, p.station.z] : LOOP[LOOP_EXIT]].map(([x, z]) => new THREE.Vector2(x, z))
        p.mode = 'evac'
      } else {
        p.path = p.returnPath || []
        p.mode = 'return'
      }
      p.from = pos
    }
  }

  const tmp = new THREE.Vector2()

  // 한 걸음: path의 다음 지점으로 이동. 도착하면 true
  function step(p, dt) {
    const target = p.path[0]
    if (!target) return true
    tmp.set(target.x - p.root.position.x, target.y - p.root.position.z)
    const dist = tmp.length()
    const move = WALK_SPEED * dt
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

  // 통통 튀는 걸음: 발 디딜 때 몸이 살짝 눌리고(squash) 떠오를 때 늘어남(stretch)
  function poseWalk(p, dt, carrying) {
    p.walkT += dt * 9
    const s = Math.sin(p.walkT)
    const bounce = Math.abs(Math.cos(p.walkT))
    p.legs[0].rotation.x = s * 0.7
    p.legs[1].rotation.x = -s * 0.7
    if (carrying) {
      p.arms[0].rotation.x = p.arms[1].rotation.x = -1.25 + bounce * 0.05
    } else {
      p.arms[0].rotation.x = -s * 0.75
      p.arms[1].rotation.x = s * 0.75
    }
    p.body.position.y = bounce * 0.07
    const squash = Math.cos(p.walkT * 2) * 0.045
    p.body.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5)
    p.body.rotation.x = 0.05
    p.body.rotation.z = 0
    p.head.rotation.set(0, 0, s * 0.09) // 걸음에 맞춰 고개가 좌우로 갸웃
  }

  function poseStill(p, t, kind) {
    p.legs[0].rotation.x = p.legs[1].rotation.x = 0
    const breathe = Math.sin(t * 2 + p.phase) * 0.012
    p.body.scale.set(1 - breathe * 0.5, 1 + breathe, 1 - breathe * 0.5) // 숨쉬기
    if (kind === 'work') {
      // 장비를 만지는 손동작 + 화면을 보며 고개 끄덕끄덕
      p.arms[0].rotation.x = -1.3 + Math.sin(t * 3 + p.phase) * 0.2
      p.arms[1].rotation.x = -1.15 + Math.sin(t * 3.4 + p.phase + 1.5) * 0.22
      p.body.position.y = Math.max(0, Math.sin(t * 3 + p.phase)) * 0.015
      p.body.rotation.set(0.08, 0, 0)
      p.head.rotation.set(0.12 + Math.sin(t * 2.2 + p.phase) * 0.08, Math.sin(t * 0.6 + p.phase) * 0.15, 0)
    } else {
      // 대기: 팔 내리고 몸을 좌우로 살랑, 두리번두리번
      p.arms[0].rotation.x = Math.sin(t * 1.6 + p.phase) * 0.08
      p.arms[1].rotation.x = -Math.sin(t * 1.6 + p.phase) * 0.08
      p.body.position.y = 0
      p.body.rotation.set(0, 0, Math.sin(t * 1.4 + p.phase) * 0.05)
      p.head.rotation.set(-0.05, Math.sin(t * 0.8 + p.phase) * 0.55, 0)
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

  function update(dt, t) {
    for (const p of people) {
      blink(p, dt)
      if (p.mode === 'work') {
        poseStill(p, t, 'work')
      } else if (p.mode === 'loop') {
        if (!p.path.length) p.path = [new THREE.Vector2(...LOOP[p.loopIdx])]
        if (step(p, dt)) p.loopIdx = (p.loopIdx + 1) % LOOP.length
        poseWalk(p, dt, true)
      } else if (p.mode === 'evac') {
        if (step(p, dt)) {
          p.mode = 'gathered'
        } else {
          poseWalk(p, dt * 1.3, false)
          p.body.rotation.x = 0
        }
      } else if (p.mode === 'gathered') {
        p.root.rotation.y = lerpAngle(p.root.rotation.y, FACE_DOOR, Math.min(1, dt * 4))
        poseStill(p, t, 'wait')
      } else if (p.mode === 'return') {
        if (step(p, dt)) {
          if (p.station) {
            p.mode = 'work'
          } else {
            p.mode = 'loop'
            p.loopIdx = (LOOP_EXIT + 1) % LOOP.length
          }
        } else {
          poseWalk(p, dt, !p.station)
        }
        if (p.mode === 'work') p.root.rotation.y = p.station.face
      }
      // 대피 중엔 트레이를 내려놓은 것처럼 숨긴다
      if (p.carrying) p.body.getObjectByName('worker_walker_tray').visible = p.mode === 'loop' || p.mode === 'return'
    }
  }

  function summary() {
    const counts = {}
    for (const p of people) counts[p.mode] = (counts[p.mode] || 0) + 1
    return counts
  }

  return { root, update, setAlarm, summary }
}
