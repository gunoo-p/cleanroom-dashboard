// 시나리오별 3D 효과 (코드 모형 전용)
//   가스   : 케미컬 벤치 위로 동글동글한 연두빛 연기 덩어리가 뭉게뭉게
//   습도   : 큰 물방울 + 떨어진 자리 물결, 바닥 물웅덩이, 창문 김서림, 습도계 바늘 상승
//   공기질 : 갈색 먼지 덩어리, FFU 덜덜 떨림, 바닥 먼지 자국
//   차압   : 문은 열리지 않고 덜컹덜컹, 문틈·창틈으로 빨간 화살표 유입, 차압계 바늘 하락
import * as THREE from 'three'
import { MAT, cyl } from './parts.js'
import { ROOM } from './room.js'
import { FFU_Y } from './equipment.js'
import { fadeTexture } from './textures.js'

const rnd = (a, b) => a + Math.random() * (b - a)
const SPHERE = new THREE.SphereGeometry(1, 20, 14)
const WALL_Z = ROOM.minZ + ROOM.wallT // 뒤 벽 안쪽 면
const FADE = 0.6 // 상황이 바뀔 때 남은 연기·먼지·화살표가 사라지는 시간(초)

// ── 뭉게뭉게 덩어리 (가스 연기·먼지 공용) ─────────
// 구 4개를 붙인 구름 덩어리가 커지면서 떠오르고, 출렁이다가 옅어진다.
const PUFF_PARTS = [[0, 0, 0, 1], [0.55, 0.12, 0.1, 0.72], [-0.52, 0.08, -0.08, 0.76], [0.08, 0.48, 0.02, 0.66]]

class PuffSystem {
  constructor(parent, count, color) {
    this.items = []
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group()
      g.visible = false
      const mat = new THREE.MeshStandardMaterial({
        color, roughness: 1, transparent: true, opacity: 0, depthWrite: false,
        emissive: color, emissiveIntensity: 0.18,
      })
      const parts = PUFF_PARTS.map(([x, y, z, s]) => {
        const m = new THREE.Mesh(SPHERE, mat)
        m.position.set(x, y, z)
        m.scale.setScalar(s)
        m.userData.base = s
        m.userData.noShadow = true
        g.add(m)
        return m
      })
      parent.add(g)
      this.items.push({ g, mat, parts, age: 0, life: 0, vel: new THREE.Vector3(), size: 1, spin: 0, alive: false })
    }
    this.next = 0
  }

  emit(pos, vel, size, life, opacity = 0.9) {
    const it = this.items[this.next]
    this.next = (this.next + 1) % this.items.length
    it.g.position.copy(pos)
    it.g.rotation.y = rnd(0, Math.PI * 2)
    it.vel.copy(vel)
    it.size = size
    it.life = life
    it.age = 0
    it.spin = rnd(-0.4, 0.4)
    it.maxOpacity = opacity
    it.fade = null
    it.alive = true
    it.g.visible = true
  }

  // 상황이 바뀌면 남은 덩어리를 FADE초 안에 빠르게 옅어지며 사라지게
  fadeOut() {
    for (const it of this.items) if (it.alive && it.fade === null) it.fade = 0
  }

  update(dt, t) {
    let alive = 0
    for (const it of this.items) {
      if (!it.alive) continue
      it.age += dt
      const k = it.age / it.life
      if (k >= 1) { it.alive = false; it.g.visible = false; continue }
      alive++
      it.g.position.addScaledVector(it.vel, dt)
      it.vel.multiplyScalar(1 - dt * 0.15)
      it.g.rotation.y += it.spin * dt
      // 처음엔 '퐁' 커지고(이징), 끝에서 옅어짐
      const grow = k < 0.25 ? 1 - (1 - k / 0.25) ** 3 : 1 + (k - 0.25) * 0.5
      it.g.scale.setScalar(it.size * Math.max(0.05, grow))
      let op = it.maxOpacity * (k > 0.65 ? 1 - (k - 0.65) / 0.35 : Math.min(1, k * 6))
      if (it.fade !== null) {
        it.fade += dt
        if (it.fade >= FADE) { it.alive = false; it.g.visible = false; alive--; continue }
        op *= 1 - it.fade / FADE
      }
      it.mat.opacity = op
      it.parts.forEach((m, i) => {
        const w = 1 + Math.sin(t * 3 + i * 1.7 + it.spin * 10) * 0.08 // 출렁출렁
        m.scale.set(m.userData.base * w, m.userData.base / w, m.userData.base * w)
      })
    }
    return alive
  }

  clear() { for (const it of this.items) { it.alive = false; it.g.visible = false } }
}

// ── 다이얼 계기 (차압계·습도계) ───────────────
function buildGauge(name, { label, unit, min, max, zones, x, y, z, r = 0.28 }) {
  const g = new THREE.Group()
  g.name = name
  g.position.set(x, y, z)
  const back = cyl(`${name}_case`, r + 0.04, r + 0.04, 0.07, MAT.white, 0, 0, 0, 40)
  back.rotation.x = Math.PI / 2
  g.add(back)
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r + 0.03, 0.018, 8, 48), MAT.navy)
  rim.position.z = 0.04
  g.add(rim)

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 256
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  const face = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshStandardMaterial({
    map: tex, roughness: 0.4, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25,
  }))
  face.name = `${name}_face`
  face.position.z = 0.037
  g.add(face)

  const A0 = (-225 * Math.PI) / 180 // 왼쪽 아래에서 시작해
  const A1 = (45 * Math.PI) / 180 //   오른쪽 아래까지 (캔버스 각도)
  const toA = (v) => A0 + ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * (A1 - A0)

  let shown = null
  function draw(value) {
    const txt = `${value > 0 && min < 0 ? '+' : ''}${value.toFixed(0)}`
    if (txt === shown) return
    shown = txt
    const c = canvas.getContext('2d')
    c.clearRect(0, 0, 256, 256)
    c.fillStyle = '#f8fafc'
    c.beginPath(); c.arc(128, 128, 128, 0, Math.PI * 2); c.fill()
    // 색 구간
    for (const [a, b, color] of zones) {
      c.strokeStyle = color
      c.lineWidth = 22
      c.beginPath(); c.arc(128, 128, 98, toA(a), toA(b)); c.stroke()
    }
    // 눈금
    c.strokeStyle = '#475569'
    c.lineWidth = 3
    for (let i = 0; i <= 10; i++) {
      const a = A0 + (i / 10) * (A1 - A0)
      c.beginPath()
      c.moveTo(128 + Math.cos(a) * 80, 128 + Math.sin(a) * 80)
      c.lineTo(128 + Math.cos(a) * (i % 5 ? 70 : 62), 128 + Math.sin(a) * (i % 5 ? 70 : 62))
      c.stroke()
    }
    c.fillStyle = '#334155'
    c.textAlign = 'center'
    c.font = 'bold 26px "Malgun Gothic", sans-serif'
    c.fillText(label, 128, 108)
    c.font = 'bold 40px "Malgun Gothic", sans-serif'
    const z0 = zones.find(([a, b]) => value >= a && value <= b)
    c.fillStyle = z0 ? z0[2] : '#334155'
    c.fillText(txt, 128, 196)
    c.font = 'bold 20px sans-serif'
    c.fillStyle = '#64748b'
    c.fillText(unit, 128, 222)
    tex.needsUpdate = true
  }

  // 바늘 (캔버스 각도 → 3D: y축 반전)
  const needle = new THREE.Group()
  needle.position.z = 0.05
  const bar = new THREE.Mesh(new THREE.BoxGeometry(r * 0.78, 0.022, 0.012), new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.4 }))
  bar.position.x = r * 0.39
  needle.add(bar)
  needle.add(cyl(`${name}_hub`, 0.03, 0.03, 0.02, MAT.navyDark, 0, 0, 0, 16).rotateX(Math.PI / 2))
  g.add(needle)

  let value = (min + max) / 2
  function set(v) {
    value = v
    needle.rotation.z = -toA(v)
    draw(v)
  }
  set(value)
  return { group: g, set, get: () => value }
}

// ── 온도 위험 사이렌 ───────────────────────────
// 천장 가운데 회전 사이렌(붉은 빛줄기 2개가 바닥·벽을 쓸고 지나감) + 방 전체 붉은 점멸
// + 공정장비 위·벽 모서리의 작은 회전 경광등.
// 조명을 켜고 끄면 재질이 다시 컴파일되며 화면이 잠깐 멈추므로, 조명은 항상 두고 밝기만 0↔최대로 조절한다.
const SIREN_RED = 0xff2a2a

function buildSiren(fx) {
  const g = new THREE.Group()
  g.name = 'siren'
  fx.add(g)

  // 천장 회전 사이렌 (아래를 향한 반구 등)
  const hub = new THREE.Group()
  hub.position.set(0.2, 4.95, -0.3)
  g.add(hub)
  const mount = cyl('siren_mount', 0.34, 0.38, 0.12, MAT.greyDark, 0, 0.06, 0, 28)
  hub.add(mount)
  const domeMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, emissive: SIREN_RED, emissiveIntensity: 0.2, roughness: 0.3 })
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeMat)
  dome.name = 'siren_dome'
  dome.rotation.x = Math.PI
  hub.add(dome)

  const spin = new THREE.Group()
  hub.add(spin)
  // 빛줄기는 사이렌 쪽이 진하고 끝으로 갈수록 옅어짐 (방 밖으로 삐져나와도 안 보이게)
  const beamMat = new THREE.MeshBasicMaterial({
    color: SIREN_RED, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, alphaMap: fadeTexture(),
  })
  const L = 8
  const beamGeo = new THREE.ConeGeometry(L * Math.tan(0.26), L, 28, 1, true)
  beamGeo.translate(0, -L / 2, 0) // 꼭짓점이 사이렌 위치, 바닥 쪽으로 넓어짐
  const lights = []
  for (const side of [0, Math.PI]) {
    const arm = new THREE.Group()
    arm.rotation.y = side
    const tilt = new THREE.Group()
    tilt.rotation.x = 0.95 // 수직에서 약 55° 기울여 바닥·벽을 쓸게
    arm.add(tilt)
    const beam = new THREE.Mesh(beamGeo, beamMat)
    beam.userData.noShadow = true
    beam.renderOrder = 3
    tilt.add(beam)
    const spot = new THREE.SpotLight(SIREN_RED, 0, 24, 0.3, 0.45, 1.1)
    const target = new THREE.Object3D()
    target.position.set(0, -10, 0)
    tilt.add(spot, target)
    spot.target = target
    lights.push(spot)
    spin.add(arm)
  }

  // 방 전체를 붉게 물들이는 점멸광
  const wash = new THREE.HemisphereLight(0xff3b3b, 0x7a0000, 0)
  g.add(wash)

  // 작은 회전 경광등 (공정장비 2대 위 + 벽 모서리)
  const miniBeamGeo = new THREE.ConeGeometry(0.28, 1.3, 16, 1, true)
  miniBeamGeo.translate(0, -0.65, 0)
  miniBeamGeo.rotateZ(Math.PI / 2) // 옆으로 뻗는 빛
  const minis = [[-5.55, 2.22, 3.3], [-5.45, 2.62, 0.55], [-6.72, 4.42, -5.72]].map(([x, y, z], i) => {
    const m = new THREE.Group()
    m.name = `siren_mini_${i}`
    m.position.set(x, y, z)
    m.add(cyl(`siren_mini_${i}_base`, 0.11, 0.12, 0.06, MAT.greyDark, 0, 0.03, 0, 16))
    const mat = domeMat.clone()
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat)
    d.position.y = 0.06
    m.add(d)
    const s = new THREE.Group()
    s.position.y = 0.11
    const b1 = new THREE.Mesh(miniBeamGeo, beamMat)
    const b2 = new THREE.Mesh(miniBeamGeo, beamMat)
    b2.rotation.y = Math.PI
    b1.userData.noShadow = b2.userData.noShadow = true
    s.add(b1, b2)
    m.add(s)
    m.visible = false
    g.add(m)
    return { m, mat, s, phase: i * 1.7 }
  })

  let level = 0
  return {
    update(dt, t, on) {
      level += ((on ? 1 : 0) - level) * Math.min(1, dt * (on ? 6 : 10))
      if (level < 0.002) level = 0
      // 사이렌 본체(마운트·돔)는 온도 위험일 때만 보이게. 조명은 그대로 두고 밝기만 0으로(재컴파일 방지)
      mount.visible = dome.visible = level > 0.01
      spin.rotation.y = t * 3.4
      const pulse = Math.max(0, Math.sin(t * 6.8)) ** 2 // 빛줄기가 두 번 지나갈 때마다 번쩍
      for (const l of lights) l.intensity = level * 260
      beamMat.opacity = level * (0.12 + pulse * 0.08)
      wash.intensity = level * (0.25 + pulse * 0.85)
      domeMat.emissiveIntensity = 0.2 + level * (1.2 + pulse * 1.5)
      for (const mn of minis) {
        mn.m.visible = level > 0.01
        mn.s.rotation.y = t * 4.2 + mn.phase
        mn.mat.emissiveIntensity = 0.3 + level * (1 + Math.max(0, Math.sin(t * 9 + mn.phase)) * 1.5)
      }
    },
    level: () => level,
  }
}

// ── 차압 위험: 방이 쪼그라드는 느낌 ──────────────
// 바깥 압력이 더 세서 방을 꾹꾹 누르는 만화 같은 표현:
//   벽 윗부분이 안쪽으로 기울고(모서리 기둥·문·벽 계기도 함께), 천장 FFU가 내려앉고,
//   벽 위 바깥쪽 큰 화살표가 방 안쪽으로 꾹꾹 민다. 압력이 들어올 때마다 '꾹' 눌렸다 조금 풀리기를 반복.
const X_AXIS = new THREE.Vector3(1, 0, 0)

function buildSqueeze(root, fx, backWallItems) {
  const wallLeft = root.getObjectByName('wall_left')
  const wallBack = root.getObjectByName('wall_back')
  const corner = root.getObjectByName('wall_corner_group')
  const door = root.getObjectByName('door')
  const save = (o) => o && { o, q: o.quaternion.clone(), p: o.position.clone() }
  const walls = [save(wallLeft), save(wallBack)].filter(Boolean)
  const cornerS = save(corner)
  const doorS = save(door)
  const backItems = backWallItems.map(save).filter(Boolean)
  const ffus = []
  root.traverse((o) => { if (/^ffu_\d+$/.test(o.name)) ffus.push(save(o)) })

  // 모서리 기둥은 방 안쪽 대각선(+x,+z) 방향으로 기울임
  const cornerAxis = new THREE.Vector3(1, 0, -1).normalize()

  // 벽 위 바깥쪽에서 안쪽을 향해 미는 큰 화살표 (뒷벽 3개 + 왼쪽 벽 3개)
  const arrowMat = new THREE.MeshStandardMaterial({ color: 0xff4d5e, roughness: 0.4, emissive: 0xff1f35, emissiveIntensity: 0.4, transparent: true, opacity: 0 })
  const pushers = []
  const makeArrow = () => {
    const a = new THREE.Group()
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.55, 20), arrowMat)
    head.rotation.x = Math.PI / 2 // +z를 가리킴
    head.position.z = 0.45
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 14), arrowMat)
    shaft.rotation.x = Math.PI / 2
    head.userData.noShadow = shaft.userData.noShadow = true
    a.add(head, shaft)
    a.visible = false
    fx.add(a)
    return a
  }
  const zBack = ROOM.minZ - 0.9
  const xLeft = ROOM.minX - 0.9
  for (const x of [-4.5, -0.5, 3.5]) {
    const a = makeArrow()
    a.userData.base = new THREE.Vector3(x, 4.9, zBack)
    a.userData.dir = new THREE.Vector3(0, -0.35, 1).normalize() // 안쪽·약간 아래로
    pushers.push(a)
  }
  for (const z of [-3.0, 0.5, 4.0]) {
    const a = makeArrow()
    a.userData.base = new THREE.Vector3(xLeft, 4.9, z)
    a.userData.dir = new THREE.Vector3(1, -0.35, 0).normalize()
    pushers.push(a)
  }
  for (const a of pushers) a.lookAt(a.position.clone().add(a.userData.dir)) // 화살표가 dir 방향을 보게

  const qTilt = new THREE.Quaternion()
  const qKnock = new THREE.Quaternion()
  const v = new THREE.Vector3()
  let level = 0
  let squeeze = 0

  // 바닥(y=0) 뒷벽 면을 축으로 x축 회전: 물체가 벽과 함께 기울어지게 위치·방향을 옮김
  function tiltAboutBackWall(s, angle) {
    qTilt.setFromAxisAngle(X_AXIS, angle)
    v.copy(s.p)
    const pivotZ = ROOM.minZ + ROOM.wallT / 2 // 뒷벽 그룹의 회전 축(두께 가운데, 바닥)
    v.z -= pivotZ
    v.applyQuaternion(qTilt)
    v.z += pivotZ
    s.o.position.copy(v)
    s.o.quaternion.copy(qTilt).multiply(s.q)
  }

  return {
    update(dt, t, on) {
      level += ((on ? 1 : 0) - level) * Math.min(1, dt * (on ? 3 : 6))
      if (level < 0.002) level = 0
      // 1.6초마다 '꾹'(빠르게 눌림) → 천천히 일부 풀림
      const beat = (t % 1.6) / 1.6
      const press = beat < 0.15 ? beat / 0.15 : 1 - ((beat - 0.15) / 0.85) * 0.45
      squeeze = level * press
      const tilt = 0.12 * squeeze

      // 벽: 각 벽 그룹의 '안쪽 면'(로컬 +z) 방향으로 윗부분이 기울어짐 (바닥이 축)
      for (const s of walls) {
        qTilt.setFromAxisAngle(X_AXIS, tilt)
        s.o.quaternion.copy(s.q).multiply(qTilt)
      }
      if (cornerS) {
        qTilt.setFromAxisAngle(cornerAxis, tilt)
        cornerS.o.quaternion.copy(qTilt).multiply(cornerS.q)
      }
      // 뒷벽에 붙은 계기들도 벽과 함께
      for (const s of backItems) tiltAboutBackWall(s, tilt)
      // 문: 벽과 함께 기울고 + 안쪽으로 덜컹덜컹 (열리지는 않음)
      if (doorS) {
        tiltAboutBackWall(doorS, tilt)
        const knock = level * (Math.max(0, Math.sin(t * 7)) ** 6 * 0.06 + Math.sin(t * 40) * 0.006)
        qKnock.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -knock)
        doorS.o.quaternion.multiply(qKnock)
      }
      // 천장 FFU가 눌려 내려앉음
      for (const s of ffus) s.o.position.y = s.p.y - 0.55 * squeeze

      // 바깥 화살표: 눌릴 때 안쪽으로 쑥 들어왔다 물러남
      arrowMat.opacity = Math.min(1, level * 1.2)
      for (const a of pushers) {
        a.visible = level > 0.01
        a.position.copy(a.userData.base).addScaledVector(a.userData.dir, -0.5 + press * 0.9)
        a.scale.setScalar(0.9 + press * 0.25)
      }
    },
    squeeze: () => squeeze,
    level: () => level,
    // 공기질 FFU 떨림 등 다른 효과가 기준 위치를 쓰도록
    ffuOffsetY: () => -0.55 * squeeze,
  }
}

export function buildEffects(root) {
  const fx = new THREE.Group()
  fx.name = 'effects'
  root.add(fx)

  // 온도 위험 사이렌
  const siren = buildSiren(fx)

  // 가스 연기 / 먼지 덩어리
  const gasPuffs = new PuffSystem(fx, 46, 0xa6e87e)
  const dustPuffs = new PuffSystem(fx, 40, 0xb49b7c)

  // 습도: 큰 물방울 (구 + 원뿔 = 물방울 모양)
  const dropMat = new THREE.MeshStandardMaterial({ color: 0x6fb7ff, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85, emissive: 0x3b82f6, emissiveIntensity: 0.2 })
  const drops = []
  for (let i = 0; i < 46; i++) {
    const d = new THREE.Group()
    const ball = new THREE.Mesh(SPHERE, dropMat)
    ball.scale.setScalar(0.065)
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.058, 0.12, 14), dropMat)
    tip.position.y = 0.08
    d.add(ball, tip)
    d.visible = false
    fx.add(d)
    drops.push({ g: d, vy: 0, alive: false })
  }
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x7cc4ff, transparent: true, opacity: 0.8, depthWrite: false })
  const rings = []
  for (let i = 0; i < 24; i++) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 6, 28), ringMat.clone())
    m.rotation.x = Math.PI / 2
    m.visible = false
    fx.add(m)
    rings.push({ m, age: 1 })
  }
  let ringNext = 0

  // 바닥 자국: 물웅덩이(습도) / 먼지 자국(공기질)
  function floorPatches(positions, color, opacity) {
    return positions.map(([x, z, r, sx]) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(r, 36), new THREE.MeshStandardMaterial({
        color, roughness: 0.08, metalness: 0.1, transparent: true, opacity, depthWrite: false,
      }))
      m.rotation.x = -Math.PI / 2
      m.position.set(x, 0.012, z)
      m.scale.set(0.001, sx, 1)
      m.userData.sx = sx
      m.visible = false
      fx.add(m)
      return { m, k: 0 }
    })
  }
  const puddles = floorPatches([[-1.6, 2.4, 0.75, 0.7], [2.3, 0.2, 0.6, 0.8], [-3.3, -2.0, 0.7, 0.65], [3.9, 3.2, 0.55, 0.75], [0.9, -2.3, 0.5, 0.8], [-4.4, 3.9, 0.45, 0.7], [3.1, -1.0, 0.45, 0.8]], 0x7cc4ff, 0.55)
  const dustSpots = floorPatches([[-2.0, 1.8, 0.6, 0.75], [1.4, -0.6, 0.55, 0.7], [-3.6, -2.6, 0.5, 0.8], [3.4, 2.8, 0.55, 0.7], [0.2, 3.9, 0.45, 0.8]], 0x9c8263, 0.35)

  // 창문 김서림: 창 유리 앞에 흰 반투명 막
  const fogPanes = []
  root.traverse((o) => {
    if (!o.isMesh || !/_window_\d+_pane$/.test(o.name)) return
    const m = new THREE.Mesh(o.geometry, new THREE.MeshBasicMaterial({ color: 0xf1f7fb, transparent: true, opacity: 0, depthWrite: false }))
    m.position.copy(o.position)
    m.position.z += 0.012
    o.parent.add(m)
    fogPanes.push(m)
  })

  // 계기: 차압계(문 오른쪽) · 습도계(뒷벽 가운데)
  const pGauge = buildGauge('pressure_gauge', {
    label: '차압', unit: 'Pa', min: -20, max: 30,
    zones: [[-20, 5, '#ef4444'], [5, 10, '#f59e0b'], [10, 30, '#22c55e']],
    x: 5.45, y: 3.15, z: WALL_Z + 0.04, r: 0.34, // 문 오른쪽 위 (경광등 옆)
  })
  const hGauge = buildGauge('humidity_gauge', {
    label: '습도', unit: '%RH', min: 20, max: 80,
    zones: [[20, 35, '#f59e0b'], [35, 50, '#22c55e'], [50, 55, '#f59e0b'], [55, 80, '#ef4444']],
    x: 0.25, y: 3.0, z: WALL_Z + 0.04, r: 0.36,
  })
  fx.add(pGauge.group, hGauge.group)

  // 차압 위험: 방이 쪼그라듦 (뒷벽에 붙은 계기도 함께 기울어짐)
  const squeeze = buildSqueeze(root, fx, [pGauge.group, hGauge.group])

  // 차압: 바깥 공기 유입 화살표
  const arrowMat = new THREE.MeshStandardMaterial({ color: 0xff5f6d, roughness: 0.4, emissive: 0xff2d3d, emissiveIntensity: 0.35, transparent: true, opacity: 0.9 })
  const arrows = []
  for (let i = 0; i < 28; i++) {
    const a = new THREE.Group()
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 14), arrowMat.clone())
    head.rotation.x = Math.PI / 2 // +z 방향을 가리킴
    head.position.z = 0.22
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.28, 10), head.material)
    shaft.rotation.x = Math.PI / 2
    shaft.position.z = 0.0
    a.add(head, shaft)
    a.visible = false
    fx.add(a)
    arrows.push({ g: a, mat: head.material, age: 0, life: 2.2, alive: false, speed: 1.6 })
  }
  let arrowNext = 0
  const door = root.getObjectByName('door')
  const ffus = []
  root.traverse((o) => { if (/^ffu_\d+$/.test(o.name)) ffus.push({ g: o, base: o.position.clone() }) })
  const curtains = []
  root.traverse((o) => { if (o.isMesh && /_curtain_\d$/.test(o.name)) curtains.push(o) })

  let active = new Set() // 켜진 위험들 (여러 개 동시 가능 — 효과는 서로 다른 곳에 나타나 그대로 겹침)
  let gasAcc = 0
  let dustAcc = 0
  let dropAcc = 0
  let arrowAcc = 0
  const v3 = new THREE.Vector3()
  const vel = new THREE.Vector3()

  function setScenarios(keys) {
    const next = new Set(keys)
    // 꺼진 상황의 연기·먼지·화살표는 빨리 정리
    if (active.has('gas') && !next.has('gas')) gasPuffs.fadeOut()
    if (active.has('air_quality') && !next.has('air_quality')) dustPuffs.fadeOut()
    if (active.has('pressure') && !next.has('pressure')) {
      for (const a of arrows) if (a.alive) a.age = Math.max(a.age, a.life - FADE)
    }
    active = next
  }

  function emitDrop() {
    const d = drops.find((x) => !x.alive)
    if (!d) return
    const f = ffus[Math.floor(Math.random() * ffus.length)]
    d.g.position.set(f.base.x + rnd(-0.8, 0.8), FFU_Y - 0.3, f.base.z + rnd(-0.6, 0.6))
    d.vy = -rnd(0.5, 1.2)
    d.alive = true
    d.g.visible = true
  }

  function splash(x, z) {
    const r = rings[ringNext]
    ringNext = (ringNext + 1) % rings.length
    r.m.position.set(x, 0.02, z)
    r.age = 0
    r.m.visible = true
  }

  function emitArrow() {
    const a = arrows[arrowNext]
    arrowNext = (arrowNext + 1) % arrows.length
    // 70%는 문틈, 30%는 창틈에서
    if (Math.random() < 0.7) {
      a.g.position.set(ROOM.door.x + rnd(-0.6, 0.6), rnd(0.25, 2.1), WALL_Z + 0.15)
    } else {
      a.g.position.set(2.4 + rnd(-1.2, 1.2), rnd(1.95, 3.4), WALL_Z + 0.15)
    }
    a.age = 0
    a.speed = rnd(1.3, 2.0)
    a.alive = true
    a.g.visible = true
  }

  function grow(patches, on, dt) {
    for (const p of patches) {
      p.k = on ? Math.min(1, p.k + dt * 0.18) : Math.max(0, p.k - dt * 1.6)
      p.m.visible = p.k > 0.001
      const s = Math.max(0.001, 1 - (1 - p.k) ** 2)
      p.m.scale.set(s, s * p.m.userData.sx, 1)
    }
  }

  function update(dt, t) {
    siren.update(dt, t, active.has('temperature'))
    // 가스 연기와 먼지 덩어리가 함께 켜지면 방이 구름으로 뒤덮이지 않게 둘 다 덜 뿜는다
    const crowd = active.has('gas') && active.has('air_quality') ? 1.7 : 1
    // 가스 연기: 케미컬 벤치 상단(배기부)에서
    if (active.has('gas')) {
      gasAcc += dt
      while (gasAcc > 0.1 * crowd) {
        gasAcc -= 0.1 * crowd
        v3.set(rnd(-6.0, -0.8), 2.65, -5.0)
        vel.set(rnd(-0.15, 0.15), rnd(0.55, 0.9), rnd(0.3, 0.6))
        gasPuffs.emit(v3, vel, rnd(0.36, 0.6), rnd(2, 3), 0.95)
      }
    } else gasAcc = 0
    // 먼지 덩어리: FFU 아래에서 흘러나와 방 안을 떠다님
    if (active.has('air_quality')) {
      dustAcc += dt
      while (dustAcc > 0.13 * crowd) {
        dustAcc -= 0.13 * crowd
        const f = ffus[Math.floor(Math.random() * ffus.length)]
        v3.set(f.base.x + rnd(-0.7, 0.7), rnd(2.2, 3.8), f.base.z + rnd(-0.6, 0.6))
        vel.set(rnd(-0.35, 0.35), rnd(-0.2, 0.05), rnd(-0.1, 0.45))
        dustPuffs.emit(v3, vel, rnd(0.22, 0.42), rnd(2.2, 3.2), 0.8)
      }
    } else dustAcc = 0
    const gasAlive = gasPuffs.update(dt, t)
    const dustAlive = dustPuffs.update(dt, t)

    // 습도: 물방울 + 물결
    if (active.has('humidity')) {
      dropAcc += dt
      while (dropAcc > 0.07) { dropAcc -= 0.07; emitDrop() }
    }
    let dropsAlive = 0
    for (const d of drops) {
      if (!d.alive) continue
      dropsAlive++
      d.vy -= 9 * dt
      d.g.position.y += d.vy * dt
      if (d.g.position.y < 0.05) {
        d.alive = false
        d.g.visible = false
        splash(d.g.position.x, d.g.position.z)
      }
    }
    for (const r of rings) {
      if (r.age >= 1) continue
      r.age += dt / 0.45
      r.m.scale.setScalar(1 + r.age * 2.5)
      r.m.material.opacity = 0.8 * (1 - r.age)
      if (r.age >= 1) r.m.visible = false
    }
    grow(puddles, active.has('humidity'), dt)
    grow(dustSpots, active.has('air_quality'), dt)
    for (const f of fogPanes) {
      const target = active.has('humidity') ? 0.72 : 0
      f.material.opacity += (target - f.material.opacity) * Math.min(1, dt * (target ? 0.8 : 2.5))
    }

    // 공기질: FFU 덜덜 + 커튼 깜빡
    for (const f of ffus) {
      if (active.has('air_quality')) {
        f.g.position.set(f.base.x + Math.sin(t * 47 + f.base.x) * 0.025, f.base.y, f.base.z + Math.cos(t * 53 + f.base.z) * 0.025)
        f.g.rotation.z = Math.sin(t * 41 + f.base.z) * 0.012
      } else {
        f.g.position.copy(f.base)
        f.g.rotation.z = 0
      }
    }
    for (const c of curtains) c.visible = !active.has('air_quality') || Math.sin(t * 9 + c.id) > -0.6

    // 차압: 화살표 유입 + 문 덜컹
    if (active.has('pressure')) {
      arrowAcc += dt
      while (arrowAcc > 0.12) { arrowAcc -= 0.12; emitArrow() }
    }
    let arrowsAlive = 0
    for (const a of arrows) {
      if (!a.alive) continue
      a.age += dt
      const k = a.age / a.life
      if (k >= 1) { a.alive = false; a.g.visible = false; continue }
      arrowsAlive++
      a.g.position.z += a.speed * dt
      a.mat.opacity = 0.9 * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85)
      const s = 0.8 + Math.sin(a.age * 12) * 0.08
      a.g.scale.set(s, s, 1)
    }
    // 문 덜컹·벽 기울기·FFU 내려앉기는 squeeze가 처리
    squeeze.update(dt, t, active.has('pressure'))

    // 계기 바늘: 목표값으로 부드럽게 + 작은 흔들림
    const pTarget = active.has('pressure') ? -10 : 15
    const hTarget = active.has('humidity') ? 61 : 45
    const pv = pGauge.get() + (pTarget - pGauge.get()) * Math.min(1, dt * 1.2)
    const hv = hGauge.get() + (hTarget - hGauge.get()) * Math.min(1, dt * 0.8)
    pGauge.set(pv + Math.sin(t * 6) * 0.15)
    hGauge.set(hv + Math.sin(t * 4) * 0.1)

    return { gasAlive, dustAlive, dropsAlive, arrowsAlive }
  }

  let last = { gasAlive: 0, dustAlive: 0, dropsAlive: 0, arrowsAlive: 0 }
  return {
    setScenarios,
    update(dt, t) { last = update(dt, t) },
    summary: () => ({
      ...last,
      puddle: +(puddles.reduce((s, p) => s + p.k, 0) / puddles.length).toFixed(2),
      windowFog: +(fogPanes[0]?.material.opacity ?? 0).toFixed(2),
      pressureGauge: +pGauge.get().toFixed(1),
      humidityGauge: +hGauge.get().toFixed(1),
      doorAngle: door ? +door.rotation.y.toFixed(3) : 0,
      siren: +siren.level().toFixed(2),
      squeeze: +squeeze.squeeze().toFixed(2),
    }),
  }
}
