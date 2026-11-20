// 방 구조: 8각 받침 + 타공 바닥 + 벽 2면(창문·걸레받이) + 출입문
import * as THREE from 'three'
import { MAT, COLOR, rbox, box, cyl } from './parts.js'
import { floorTexture, windowViewTexture } from './textures.js'

export const ROOM = {
  minX: -7, maxX: 7, minZ: -6, maxZ: 6,
  wallH: 4.2,
  wallT: 0.32,
  // 받침 모서리 깎기 (앞쪽 모서리가 크게, 좌·우 모서리는 작게)
  cutFront: 3.2,
  cutSide: 1.1,
  door: { x: 4.6, w: 1.3, h: 2.3 }, // 뒤(z=minZ) 벽의 문 중심 x
}

// 바닥 외곽선 (위에서 본 x,z). 벽이 있는 두 변(x=minX, z=minZ)은 곧게 두고 나머지 세 모서리를 깎는다.
function outline(inset = 0) {
  const { minX, maxX, minZ, maxZ, cutFront, cutSide } = ROOM
  const a = minX + inset, b = maxX - inset, c = minZ + inset, d = maxZ - inset
  return [
    [a, c],
    [b - cutSide, c],
    [b, c + cutSide],
    [b, d - cutFront],
    [b - cutFront, d],
    [a + cutSide, d],
    [a, d - cutSide],
  ]
}

// Shape는 XY 평면 → 바닥으로 눕히면 y가 -z가 되므로 z 부호를 뒤집어 넣는다.
function shapeOf(points) {
  const s = new THREE.Shape()
  points.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)))
  s.closePath()
  return s
}

export function buildRoom() {
  const root = new THREE.Group()
  root.name = 'room'

  // ── 받침(남색 테두리) ──
  const plinthH = 0.55
  const plinth = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shapeOf(outline(-0.25)), {
      depth: plinthH, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3,
    }),
    MAT.navy,
  )
  plinth.name = 'plinth'
  plinth.rotation.x = -Math.PI / 2
  plinth.position.y = -plinthH - 0.06
  root.add(plinth)

  // 받침 윗테두리(흰 띠)
  const rim = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shapeOf(outline(-0.12)), { depth: 0.1, bevelEnabled: false }),
    MAT.offWhite,
  )
  rim.name = 'plinth_rim'
  rim.rotation.x = -Math.PI / 2
  rim.position.y = -0.1
  root.add(rim)

  // ── 타공 바닥 ──
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTexture(1.5), roughness: 0.7, metalness: 0.02 })
  const floor = new THREE.Mesh(new THREE.ShapeGeometry(shapeOf(outline(0))), floorMat)
  floor.name = 'floor'
  floor.rotation.x = -Math.PI / 2
  floor.position.y = 0.001
  floor.userData.receiveOnly = true
  root.add(floor)

  // ── 벽 ──
  const { minX, maxX, minZ, maxZ, wallH, wallT, cutSide, door } = ROOM
  const leftLen = (maxZ - cutSide) - minZ
  const backLen = (maxX - cutSide) - minX
  const leftWall = buildWall('wall_left', leftLen, {
    windows: [{ at: 7.4, w: 2.4, h: 1.5, y: 2.7 }], // at = 앞쪽 끝(z=maxZ쪽)부터의 거리
  })
  leftWall.position.set(minX + wallT / 2, 0, minZ + leftLen / 2)
  leftWall.rotation.y = Math.PI / 2
  root.add(leftWall)

  const backWall = buildWall('wall_back', backLen, {
    windows: [{ at: 9.4, w: 2.6, h: 1.5, y: 2.7 }], // at = 벽 시작(x=minX)부터의 거리
    door: { at: door.x - minX, w: door.w, h: door.h },
  })
  backWall.position.set(minX + backLen / 2, 0, minZ + wallT / 2)
  root.add(backWall)

  // 벽이 만나는 모서리 기둥
  // (바닥을 축으로 하는 그룹 — 차압 때 벽과 함께 안쪽으로 기울어짐)
  const corner = new THREE.Group()
  corner.name = 'wall_corner_group'
  corner.position.set(minX + wallT / 2, 0, minZ + wallT / 2)
  corner.add(cyl('wall_corner', wallT / 2, wallT / 2, wallH, MAT.white, 0, wallH / 2, 0))
  const cap = new THREE.Mesh(new THREE.SphereGeometry(wallT / 2 + 0.01, 16, 12), MAT.white)
  cap.name = 'wall_corner_cap'
  cap.position.y = wallH
  corner.add(cap)
  root.add(corner)

  // ── 출입문 (차압 시나리오: 경첩 축으로 방 안쪽으로 열림) ──
  root.add(buildDoor())

  return root
}

// 벽 하나: 길이 len, 로컬 x축 방향으로 놓이고 안쪽 면이 +z.
// 창문·문 자리는 구멍 없이 앞에 붙이는 방식(벽 뒤는 보이지 않으므로)으로 처리한다.
function buildWall(name, len, { windows = [], door = null }) {
  const { wallH, wallT } = ROOM
  const g = new THREE.Group()
  g.name = name
  const half = len / 2

  // 벽체 + 둥근 윗마감 + 끝단 둥근 기둥
  g.add(box(`${name}_body`, len, wallH, wallT, MAT.white, 0, wallH / 2, 0))
  const cap = cyl(`${name}_cap`, wallT / 2 + 0.02, wallT / 2 + 0.02, len, MAT.white, 0, wallH, 0)
  cap.rotation.z = Math.PI / 2
  g.add(cap)
  g.add(cyl(`${name}_end`, wallT / 2 + 0.02, wallT / 2 + 0.02, wallH, MAT.white, half, wallH / 2, 0))
  g.add(new THREE.Mesh(new THREE.SphereGeometry(wallT / 2 + 0.02, 16, 12), MAT.white).translateX(half).translateY(wallH))

  // 안쪽 면 패널 이음매(세로 홈)
  for (let x = -half + 2.2; x < half - 0.5; x += 2.2) {
    g.add(box(`${name}_seam`, 0.025, wallH - 0.9, 0.012, MAT.seam, x, wallH / 2 + 0.25, wallT / 2 + 0.006))
  }
  // 청록 걸레받이 띠 (문 자리는 건너뜀)
  const bandH = 0.55
  const segs = door
    ? [[-half, door.at - half - door.w / 2 - 0.12], [door.at - half + door.w / 2 + 0.12, half]]
    : [[-half, half]]
  for (const [a, b] of segs) {
    if (b - a < 0.05) continue
    g.add(box(`${name}_band`, b - a, bandH, 0.04, MAT.teal, (a + b) / 2, 0.42, wallT / 2 + 0.02))
    g.add(box(`${name}_band_top`, b - a, 0.05, 0.06, MAT.navy, (a + b) / 2, 0.42 + bandH / 2, wallT / 2 + 0.03))
  }

  // 창문: 둥근 테두리 + 옆 베이 풍경
  const viewMat = new THREE.MeshStandardMaterial({
    map: windowViewTexture(), roughness: 0.1, metalness: 0.1, emissive: 0x9fd3de, emissiveIntensity: 0.15,
  })
  windows.forEach((w, i) => {
    const x = w.at - half
    g.add(rbox(`${name}_window_${i}_frame`, w.w + 0.22, w.h + 0.22, 0.08, MAT.offWhite, x, w.y, wallT / 2 + 0.03, 0.12))
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w.w, w.h), viewMat)
    pane.name = `${name}_window_${i}_pane`
    pane.position.set(x, w.y, wallT / 2 + 0.075)
    g.add(pane)
    g.add(box(`${name}_window_${i}_mullion`, 0.05, w.h, 0.03, MAT.offWhite, x, w.y, wallT / 2 + 0.09))
    // 유리 반사 하이라이트
    const glare = new THREE.Mesh(new THREE.PlaneGeometry(w.w * 0.18, w.h), new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false,
    }))
    glare.position.set(x - w.w * 0.28, w.y, wallT / 2 + 0.095)
    glare.rotation.z = -0.25
    glare.scale.y = 0.95
    g.add(glare)
  })

  // 문틀 자리 (문 자체는 buildDoor에서 따로 — 애니메이션 대상)
  if (door) {
    const x = door.at - half
    const fm = MAT.offWhite
    g.add(box(`${name}_doorframe_l`, 0.1, door.h + 0.1, 0.14, fm, x - door.w / 2 - 0.05, (door.h + 0.1) / 2, wallT / 2 + 0.05))
    g.add(box(`${name}_doorframe_r`, 0.1, door.h + 0.1, 0.14, fm, x + door.w / 2 + 0.05, (door.h + 0.1) / 2, wallT / 2 + 0.05))
    g.add(box(`${name}_doorframe_t`, door.w + 0.2, 0.1, 0.14, fm, x, door.h + 0.05, wallT / 2 + 0.05))
    // 문이 열렸을 때 보이는 바깥(어두운 통로)
    g.add(box(`${name}_doorway`, door.w, door.h, 0.01, new THREE.MeshStandardMaterial({ color: 0x5d7a8c }), x, door.h / 2, wallT / 2 + 0.005))
  }
  return g
}

function buildDoor() {
  const { minZ, wallT, door } = ROOM
  const hinge = new THREE.Group()
  hinge.name = 'door'
  hinge.position.set(door.x - door.w / 2, 0, minZ + wallT + 0.03)
  const doorMat = new THREE.MeshStandardMaterial({ color: COLOR.teal, roughness: 0.45, metalness: 0.15 })
  hinge.add(rbox('door_leaf', door.w, door.h, 0.06, doorMat, door.w / 2, door.h / 2, 0, 0.03))
  // 문 창 + 손잡이 + 하단 킥플레이트
  hinge.add(rbox('door_window', 0.42, 0.62, 0.02, MAT.glassBlue, door.w / 2 + 0.12, door.h * 0.68, 0.035, 0.05))
  hinge.add(cyl('door_handle', 0.025, 0.025, 0.22, MAT.metal, door.w - 0.14, door.h * 0.46, 0.07, 10).rotateX(Math.PI / 2))
  hinge.add(box('door_kick', door.w - 0.1, 0.25, 0.01, new THREE.MeshStandardMaterial({ color: 0x2a9a9c, roughness: 0.5 }), door.w / 2, 0.16, 0.035))
  return hinge
}
