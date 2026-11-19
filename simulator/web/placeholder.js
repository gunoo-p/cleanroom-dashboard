// GLB 모델이 없을 때 띄우는 임시 클린룸 모형.
// 부품 이름(process_tool, hvac, gas_cabinet, ffu, door)은 models/model-config.json의 targets와 같은 규칙으로
// 매칭되므로, 실제 GLB도 같은 이름 규칙(또는 config 수정)만 맞추면 똑같이 동작한다.
// 애니메이션도 GLB와 같은 경로(AnimationMixer)로 재생되게 클립을 직접 만들어 넣는다.
import * as THREE from 'three'

const W = 12   // x 폭
const D = 8    // z 깊이
const H = 3.8  // 천장 높이

function std(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...opts })
}

function box(name, w, h, d, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  mesh.name = name
  mesh.position.set(x, y, z)
  return mesh
}

// 축(axis) 기준 회전 각도 목록을 QuaternionKeyframeTrack 값 배열로 바꾼다.
function quatValues(axis, angles) {
  const q = new THREE.Quaternion()
  return angles.flatMap((a) => q.setFromAxisAngle(axis, a).toArray())
}

export function buildPlaceholder() {
  const root = new THREE.Group()
  root.name = 'placeholder_cleanroom'

  // 바닥 (클린룸 그레이팅 바닥 느낌)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std(0x2a3341, { roughness: 0.9 }))
  floor.name = 'floor'
  floor.rotation.x = -Math.PI / 2
  root.add(floor)
  const grid = new THREE.GridHelper(W, 24, 0x3b4a5e, 0x26303e)
  grid.scale.z = D / W
  grid.position.y = 0.002
  root.add(grid)

  // 벽: 뒤·왼쪽만 (카메라가 앞오른쪽에서 보므로)
  const wallMat = std(0xcbd5e1, { transparent: true, opacity: 0.12, side: THREE.DoubleSide })
  root.add(box('wall_back', W, H, 0.05, wallMat, 0, H / 2, -D / 2))
  root.add(box('wall_left', 0.05, H, D, wallMat, -W / 2, H / 2, 0))

  // 천장 FFU(팬 필터 유닛) 패널 3×2 — 공기질 시나리오 대상
  const ffuMat = std(0xe2e8f0, { emissive: 0xdbeafe, emissiveIntensity: 0.35 })
  let n = 1
  for (const x of [-3.5, 0, 3.5]) {
    for (const z of [-1.8, 1.8]) {
      root.add(box(`ffu_${n++}`, 2.4, 0.08, 1.6, ffuMat, x, H, z))
    }
  }

  // 공정 장비 — 온도 시나리오 대상
  const tool = new THREE.Group()
  tool.name = 'process_tool'
  tool.position.set(-1.2, 0, -1.6)
  tool.add(box('process_tool_body', 3.2, 1.8, 1.6, std(0xe5e7eb, { metalness: 0.3 }), 0, 0.9, 0))
  tool.add(box('process_tool_window', 1.4, 0.6, 0.02, std(0x1e3a8a, { emissive: 0x1d4ed8, emissiveIntensity: 0.4 }), -0.5, 1.2, 0.81))
  tool.add(box('process_tool_lamp', 0.12, 0.3, 0.12, std(0x22c55e, { emissive: 0x22c55e, emissiveIntensity: 1 }), 1.4, 1.95, 0.6))
  root.add(tool)

  // 공조기(HVAC) — 온도·습도 시나리오 대상, 안의 팬이 'temperature' 애니메이션으로 돈다
  const hvac = new THREE.Group()
  hvac.name = 'hvac'
  hvac.position.set(3.2, 2.7, -D / 2 + 0.35)
  hvac.add(box('hvac_body', 1.8, 0.9, 0.6, std(0x94a3b8, { metalness: 0.4 }), 0, 0, 0))
  const fan = new THREE.Group()
  fan.name = 'hvac_fan'
  fan.position.set(0, 0, 0.31)
  const bladeMat = std(0x334155)
  for (let i = 0; i < 4; i++) {
    const blade = box(`hvac_fan_blade_${i}`, 0.08, 0.34, 0.02, bladeMat, 0, 0, 0)
    blade.geometry.translate(0, 0.17, 0)
    blade.rotation.z = (i * Math.PI) / 2
    fan.add(blade)
  }
  hvac.add(fan)
  root.add(hvac)

  // 가스 캐비닛 — 가스 시나리오 대상
  const gas = new THREE.Group()
  gas.name = 'gas_cabinet'
  gas.position.set(4.9, 0, -1.2)
  gas.add(box('gas_cabinet_body', 0.9, 2.1, 0.8, std(0x64748b, { metalness: 0.5 }), 0, 1.05, 0))
  gas.add(box('gas_cabinet_stripe', 0.92, 0.12, 0.82, std(0xfacc15, { emissive: 0xfacc15, emissiveIntensity: 0.2 }), 0, 1.7, 0))
  root.add(gas)

  // 출입문(왼쪽 벽) — 차압 시나리오 대상, 경첩 축으로 'pressure' 애니메이션에서 열렸다 닫힌다
  const frameMat = std(0x475569)
  root.add(box('door_frame_left', 0.14, 2.3, 0.1, frameMat, -W / 2, 1.15, 2.2 - 0.65))
  root.add(box('door_frame_right', 0.14, 2.3, 0.1, frameMat, -W / 2, 1.15, 2.2 + 0.65))
  root.add(box('door_frame_top', 0.14, 0.1, 1.4, frameMat, -W / 2, 2.3, 2.2))
  const door = new THREE.Group()
  door.name = 'door'
  door.position.set(-W / 2 + 0.06, 0, 2.2 - 0.6) // 경첩 위치
  const panel = box('door_panel', 0.06, 2.2, 1.2, std(0xcbd5e1, { metalness: 0.2 }), 0, 1.1, 0.6)
  door.add(panel)
  root.add(door)

  // 작업대 (장식)
  root.add(box('bench', 2.4, 0.9, 0.8, std(0x9ca3af), 1.6, 0.45, 1.6))

  // ── 애니메이션 클립: GLB 안에 들어 있는 애니메이션과 같은 방식으로 재생된다 ──
  const zAxis = new THREE.Vector3(0, 0, 1)
  const yAxis = new THREE.Vector3(0, 1, 0)
  const fanClip = new THREE.AnimationClip('temperature', 0.6, [
    new THREE.QuaternionKeyframeTrack('hvac_fan.quaternion', [0, 0.2, 0.4, 0.6],
      quatValues(zAxis, [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3, 2 * Math.PI])),
  ])
  const doorClip = new THREE.AnimationClip('pressure', 2.4, [
    new THREE.QuaternionKeyframeTrack('door.quaternion', [0, 0.8, 1.6, 2.4],
      quatValues(yAxis, [0, 1.1, 1.1, 0])), // +각도 = 방 안쪽으로 열림 (바깥 공기가 밀고 들어오는 연출)
  ])

  return { root, clips: [fanClip, doorClip] }
}
