// 방진복 작업자 7명 + 동작
//   평소: 각자 장비 앞에서 작업(팔 움직임), 1명은 웨이퍼 트레이를 들고 순회
//   위험: 장비를 피하는 경유지를 거쳐 출입문 앞으로 대피해 모임
//   정상 복귀: 왔던 길을 되짚어 제자리로
import * as THREE from 'three'
import { COLOR, MAT, rbox, cyl } from './parts.js'

const SUIT = new THREE.MeshStandardMaterial({ color: COLOR.suit, roughness: 0.85 })
const GLOVE = new THREE.MeshStandardMaterial({ color: COLOR.glove, roughness: 0.6 })
const GOGGLE = new THREE.MeshStandardMaterial({ color: 0x1d3a4f, roughness: 0.15, metalness: 0.4 })
const SEAM = new THREE.MeshStandardMaterial({ color: 0xd6dee6, roughness: 0.8 })

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

// 발 위치(y=0)가 원점, 정면이 +z인 작업자 인형
function buildWorker(name) {
  const root = new THREE.Group()
  root.name = name
  const body = new THREE.Group() // 걸을 때 위아래로 흔들리는 상체
  root.add(body)

  const legs = []
  for (const side of [-1, 1]) {
    const hip = new THREE.Group()
    hip.position.set(0.11 * side, 0.9, 0)
    const leg = capsule(`${name}_leg`, 0.085, 0.62, SUIT)
    leg.position.y = -0.42
    hip.add(leg)
    hip.add(rbox(`${name}_boot`, 0.16, 0.13, 0.28, SUIT, 0, -0.84, 0.04, 0.05))
    root.add(hip)
    legs.push(hip)
  }

  const torso = capsule(`${name}_torso`, 0.2, 0.42, SUIT)
  torso.position.y = 1.2
  torso.scale.z = 0.78
  body.add(torso)
  body.add(rbox(`${name}_zip`, 0.02, 0.5, 0.01, SEAM, 0, 1.2, 0.158, 0.005))
  body.add(rbox(`${name}_belt`, 0.4, 0.04, 0.32, SEAM, 0, 0.98, 0, 0.02))

  const arms = []
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group()
    shoulder.position.set(0.27 * side, 1.42, 0)
    const arm = capsule(`${name}_arm`, 0.065, 0.46, SUIT)
    arm.position.y = -0.27
    shoulder.add(arm)
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), GLOVE)
    glove.name = `${name}_glove`
    glove.position.y = -0.56
    shoulder.add(glove)
    shoulder.rotation.z = 0.08 * side
    body.add(shoulder)
    arms.push(shoulder)
  }

  // 후드 + 고글 + 마스크
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.155, 20, 16), SUIT)
  hood.name = `${name}_hood`
  hood.position.y = 1.7
  hood.scale.set(1, 1.12, 1.02)
  body.add(hood)
  body.add(cyl(`${name}_neck`, 0.1, 0.13, 0.12, SUIT, 0, 1.55, 0, 16))
  body.add(rbox(`${name}_goggle`, 0.2, 0.07, 0.07, GOGGLE, 0, 1.72, 0.125, 0.03))
  body.add(rbox(`${name}_mask`, 0.15, 0.08, 0.05, SEAM, 0, 1.63, 0.135, 0.03))

  return { root, body, legs, arms }
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
  { name: 'worker_insp1',  x: -1.2,  z: -0.2,  face: 0,        out: [] },             // 검사대 1(뒤에 서서 앞을 봄)
  { name: 'worker_insp2',  x: 1.85,  z: 1.95,  face: -0.15,    out: [] },             // 검사대 2
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
    const w = buildWorker(s.name)
    w.root.position.set(s.x, 0, s.z)
    w.root.rotation.y = s.face
    root.add(w.root)
    people.push({ ...w, station: s, mode: 'work', path: [], phase: i * 1.3, slot: SLOTS[i], walkT: 0 })
  })

  // 순회 작업자 + 웨이퍼 트레이
  const walker = buildWorker('worker_walker')
  const tray = new THREE.Group()
  tray.name = 'worker_walker_tray'
  tray.position.set(0, 1.12, 0.38)
  tray.add(rbox('worker_walker_tray_box', 0.42, 0.05, 0.36, new THREE.MeshStandardMaterial({ color: 0x3aa9ad, roughness: 0.35 }), 0, 0, 0, 0.02))
  tray.add(cyl('worker_walker_tray_wafer', 0.14, 0.14, 0.012, new THREE.MeshStandardMaterial({ color: 0x5fd0dc, metalness: 0.7, roughness: 0.2 }), 0, 0.032, 0, 32))
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

  function poseWalk(p, dt, carrying) {
    p.walkT += dt * 7
    const s = Math.sin(p.walkT)
    p.legs[0].rotation.x = s * 0.5
    p.legs[1].rotation.x = -s * 0.5
    if (carrying) {
      p.arms[0].rotation.x = p.arms[1].rotation.x = -0.95
    } else {
      p.arms[0].rotation.x = -s * 0.45
      p.arms[1].rotation.x = s * 0.45
    }
    p.body.position.y = Math.abs(Math.cos(p.walkT)) * 0.03
  }

  function poseStill(p, t, kind) {
    p.legs[0].rotation.x = p.legs[1].rotation.x = 0
    p.body.position.y = 0
    if (kind === 'work') {
      // 장비를 만지는 손동작
      p.arms[0].rotation.x = -0.95 + Math.sin(t * 2.2 + p.phase) * 0.15
      p.arms[1].rotation.x = -0.8 + Math.sin(t * 2.7 + p.phase + 1) * 0.18
      p.body.rotation.x = 0.06
    } else {
      // 대기: 팔 내리고 살짝 흔들림
      p.arms[0].rotation.x = Math.sin(t * 1.3 + p.phase) * 0.05
      p.arms[1].rotation.x = -Math.sin(t * 1.3 + p.phase) * 0.05
      p.body.rotation.x = 0
    }
  }

  function update(dt, t) {
    for (const p of people) {
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
