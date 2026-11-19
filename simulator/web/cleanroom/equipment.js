// 장비: FFU+공기커튼, 공정장비, 케미컬 벤치, 노광장비, 단말기, 검사대, FOUP 카트
// 이름 규칙(models/model-config.json targets와 매칭):
//   process_tool_*  → 온도 / chem_bench → 가스 / ffu_* → 습도·공기질 / door(room.js) → 차압
import * as THREE from 'three'
import { MAT, COLOR, rbox, box, cyl, group, viewport, screen } from './parts.js'
import { grilleTexture, airflowTexture, fadeTexture } from './textures.js'

export const FFU_Y = 4.75

// ── FFU + 공기 커튼 ──────────────────────────
const grille = grilleTexture()
const airMap = airflowTexture()
const airAlpha = fadeTexture()
export const curtainMaterial = new THREE.MeshBasicMaterial({
  color: 0x3fcfd2, map: airMap, alphaMap: airAlpha, transparent: true, opacity: 0.6,
  side: THREE.DoubleSide, depthWrite: false,
})
export function flowCurtains(dt, speed = 1) {
  airMap.offset.y += dt * 0.35 * speed
}

function ffu(name, x, z, w = 1.9, d = 1.6) {
  const g = group(name, x, z)
  g.add(rbox(`${name}_housing`, w, 0.32, d, MAT.white, 0, FFU_Y + 0.12, 0, 0.08))
  g.add(rbox(`${name}_lip`, w - 0.1, 0.06, d - 0.1, MAT.navy, 0, FFU_Y - 0.06, 0, 0.03))
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.3, d - 0.3), new THREE.MeshStandardMaterial({ map: grille, roughness: 0.6 }))
  face.name = `${name}_grille`
  face.rotation.x = Math.PI / 2
  face.position.y = FFU_Y - 0.095
  g.add(face)
  // 윗면 격자 (위에서 내려다보는 시점이라 윗면도 격자로)
  const top = face.clone()
  top.name = `${name}_grille_top`
  top.rotation.x = -Math.PI / 2
  top.position.y = FFU_Y + 0.285
  g.add(top)

  // 공기 커튼: 네 면 스커트
  const H = FFU_Y - 1.0
  const sides = [
    [w - 0.2, 0, (d - 0.2) / 2, 0],
    [w - 0.2, 0, -(d - 0.2) / 2, 0],
    [d - 0.2, (w - 0.2) / 2, 0, Math.PI / 2],
    [d - 0.2, -(w - 0.2) / 2, 0, Math.PI / 2],
  ]
  sides.forEach(([len, cx, cz, ry], i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, H), curtainMaterial)
    m.name = `${name}_curtain_${i}`
    m.position.set(cx, FFU_Y - 0.1 - H / 2, cz)
    m.rotation.y = ry
    m.userData.noShadow = true
    m.renderOrder = 2
    g.add(m)
  })
  return g
}

// ── 공정장비 (왼쪽 벽, 앞면 +z) ─────────────
function processTool(name, x, z, rotY, w, d, h) {
  const g = group(name, x, z, rotY)
  const baseH = 0.5
  g.add(rbox(`${name}_base`, w, baseH, d, MAT.navy, 0, baseH / 2, 0, 0.05))
  g.add(rbox(`${name}_body`, w, h - baseH, d, MAT.white, 0, baseH + (h - baseH) / 2, 0, 0.1))
  g.add(rbox(`${name}_topcap`, w * 0.9, 0.16, d * 0.85, MAT.offWhite, 0, h + 0.07, -d * 0.04, 0.06))
  // 앞면 관찰창 + 측면 패널 이음매 + 상태등
  g.add(viewport(`${name}_view`, w * 0.46, (h - baseH) * 0.42, -w * 0.18, baseH + (h - baseH) * 0.55, d / 2 + 0.01))
  g.add(box(`${name}_seam`, 0.02, h - baseH - 0.2, 0.01, MAT.seam, w * 0.2, baseH + (h - baseH) / 2, d / 2 + 0.005))
  g.add(box(`${name}_louver`, w * 0.25, 0.12, 0.01, MAT.seam, w * 0.33, baseH + 0.25, d / 2 + 0.005))
  const lamp = rbox(`${name}_lamp`, 0.1, 0.32, 0.1, new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.9 }), w / 2 - 0.12, h + 0.3, d / 2 - 0.15, 0.03)
  g.add(lamp)
  // 옆에 붙은 작은 로드포트(웨이퍼 투입구)
  g.add(rbox(`${name}_loadport`, w * 0.32, 0.7, 0.45, MAT.white, w * 0.28, baseH + 0.55, d / 2 + 0.2, 0.05))
  g.add(rbox(`${name}_loadport_top`, w * 0.26, 0.04, 0.35, MAT.teal, w * 0.28, baseH + 0.92, d / 2 + 0.22, 0.02))
  return g
}

// ── 조작 단말기(키오스크) ───────────────────
function kiosk(name, x, z, rotY) {
  const g = group(name, x, z, rotY)
  g.add(rbox(`${name}_foot`, 0.55, 0.12, 0.45, MAT.navy, 0, 0.06, 0, 0.03))
  g.add(rbox(`${name}_column`, 0.36, 1.0, 0.3, MAT.white, 0, 0.62, -0.02, 0.06))
  const head = new THREE.Group()
  head.position.set(0, 1.25, 0.02)
  head.rotation.x = -0.35
  head.add(rbox(`${name}_head`, 0.62, 0.48, 0.1, MAT.white, 0, 0, 0, 0.04))
  const scr = screen(`${name}_screen`, 0.52, 0.38)
  scr.position.z = 0.052
  head.add(scr)
  g.add(head)
  g.add(rbox(`${name}_shelf`, 0.5, 0.04, 0.22, MAT.offWhite, 0, 0.98, 0.16, 0.02))
  return g
}

// ── 케미컬 벤치 6칸 (뒤 벽) — 가스 시나리오 대상 ──
function chemBench(name, x0, z, count = 6, mw = 1.0) {
  const g = group(name, x0 + (count * mw) / 2, z)
  const h = 2.0
  const d = 1.15
  for (let i = 0; i < count; i++) {
    const x = -((count - 1) * mw) / 2 + i * mw
    g.add(rbox(`${name}_${i}_base`, mw - 0.04, 0.42, d, MAT.navy, x, 0.21, 0, 0.04))
    g.add(rbox(`${name}_${i}_body`, mw - 0.04, h - 0.42, d, MAT.white, x, 0.42 + (h - 0.42) / 2, 0, 0.07))
    g.add(viewport(`${name}_${i}_view`, mw * 0.55, 0.62, x, 1.2, d / 2 + 0.01))
    g.add(box(`${name}_${i}_handle`, mw * 0.4, 0.04, 0.04, MAT.metal, x, 0.62, d / 2 + 0.03))
    // 위 투명 후드
    g.add(rbox(`${name}_${i}_hood`, mw - 0.12, 0.42, d - 0.2, MAT.glassTeal, x, h + 0.23, -0.02, 0.05))
  }
  // 상단 배기 덕트
  g.add(rbox(`${name}_exhaust`, count * mw - 0.1, 0.18, 0.35, MAT.offWhite, 0, h + 0.55, -d / 2 + 0.2, 0.06))
  return g
}

// ── 노광장비 (큰 장비, 파란 상판) ────────────
function lithoTool(name, x, z) {
  const g = group(name, x, z)
  const w = 2.6, d = 1.9, h = 2.15
  g.add(rbox(`${name}_base`, w, 0.45, d, MAT.navy, 0, 0.225, 0, 0.05))
  g.add(rbox(`${name}_body`, w, h - 0.45, d, MAT.white, 0, 0.45 + (h - 0.45) / 2, 0, 0.12))
  g.add(rbox(`${name}_top`, w * 0.62, 0.18, d * 0.62, MAT.glassBlue, w * 0.06, h + 0.06, -0.05, 0.05))
  g.add(rbox(`${name}_top_frame`, w * 0.7, 0.08, d * 0.7, MAT.offWhite, w * 0.06, h + 0.01, -0.05, 0.04))
  g.add(viewport(`${name}_view`, 0.95, 0.75, -0.45, 1.25, d / 2 + 0.01))
  // 오른쪽 투입부(움푹 들어간 개구부 느낌)
  g.add(rbox(`${name}_bay`, 0.75, 0.75, 0.05, MAT.greyDark, 0.72, 1.15, d / 2 + 0.005, 0.06))
  g.add(cyl(`${name}_bay_wafer`, 0.22, 0.22, 0.02, new THREE.MeshStandardMaterial({ color: 0x5fd0dc, metalness: 0.6, roughness: 0.2 }), 0.72, 1.0, d / 2 - 0.05, 32))
  g.add(box(`${name}_seam`, w - 0.2, 0.02, 0.01, MAT.seam, 0, 0.75, d / 2 + 0.005))
  g.add(box(`${name}_side_louver`, 0.01, 0.5, d * 0.5, MAT.seam, w / 2 + 0.005, 1.0, 0))
  return g
}

// ── 현미경 검사대 ───────────────────────────
function inspectionStation(name, x, z, rotY, bodyMat) {
  const g = group(name, x, z, rotY)
  const w = 1.5, d = 1.0, h = 0.95
  g.add(rbox(`${name}_base`, w, 0.18, d, MAT.navy, 0, 0.09, 0, 0.04))
  g.add(rbox(`${name}_body`, w, h - 0.18, d, bodyMat, 0, 0.18 + (h - 0.18) / 2, 0, 0.06))
  g.add(box(`${name}_panel_seam`, 0.02, h - 0.4, 0.01, MAT.seam, 0, 0.55, d / 2 + 0.005))
  g.add(rbox(`${name}_top`, w + 0.06, 0.07, d + 0.06, MAT.greyDark, 0, h + 0.035, 0, 0.03))
  // 현미경
  const m = new THREE.Group()
  m.name = `${name}_microscope`
  m.position.set(0.1, h + 0.07, -0.1)
  m.add(rbox(`${name}_mscope_base`, 0.42, 0.06, 0.34, MAT.grey, 0, 0.03, 0, 0.02))
  m.add(cyl(`${name}_mscope_pillar`, 0.045, 0.055, 0.5, MAT.greyDark, 0, 0.3, -0.1, 16))
  const arm = rbox(`${name}_mscope_arm`, 0.12, 0.12, 0.34, MAT.greyDark, 0, 0.52, 0.02, 0.03)
  m.add(arm)
  const eye = cyl(`${name}_mscope_eyepiece`, 0.035, 0.04, 0.2, MAT.rubber, 0, 0.66, 0.16, 12)
  eye.rotation.x = -0.6
  m.add(eye)
  m.add(cyl(`${name}_mscope_objective`, 0.03, 0.04, 0.16, MAT.metal, 0, 0.38, 0.12, 12))
  m.add(rbox(`${name}_mscope_stage`, 0.3, 0.03, 0.26, MAT.grey, 0, 0.2, 0.1, 0.01))
  g.add(m)
  // 웨이퍼
  const wafer = cyl(`${name}_wafer`, 0.16, 0.16, 0.012, new THREE.MeshStandardMaterial({ color: 0x48c7d0, metalness: 0.7, roughness: 0.18 }), -0.42, h + 0.08, 0.15, 40)
  g.add(wafer)
  return g
}

// ── FOUP 카트 ───────────────────────────────
function foupCart(name, x, z, rotY) {
  const g = group(name, x, z, rotY)
  const w = 1.5, d = 0.8
  const tubes = MAT.metal
  for (const [px, pz] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) {
    g.add(cyl(`${name}_post`, 0.025, 0.025, 1.0, tubes, px, 0.62, pz, 10))
    g.add(cyl(`${name}_wheel`, 0.07, 0.07, 0.04, MAT.rubber, px, 0.07, pz, 14).rotateX(Math.PI / 2))
  }
  for (const y of [0.25, 0.7]) {
    g.add(rbox(`${name}_shelf`, w + 0.06, 0.04, d + 0.06, MAT.grey, 0, y, 0, 0.015))
  }
  g.add(rbox(`${name}_rail`, w + 0.06, 0.03, 0.03, tubes, 0, 1.1, d / 2, 0.01))
  g.add(rbox(`${name}_rail_back`, w + 0.06, 0.03, 0.03, tubes, 0, 1.1, -d / 2, 0.01))
  // 손잡이
  const handle = cyl(`${name}_handle`, 0.022, 0.022, d, tubes, w / 2 + 0.18, 1.0, 0, 10)
  handle.rotation.x = Math.PI / 2
  g.add(handle)
  // FOUP 박스 (청록 반투명 + 안쪽 웨이퍼 슬롯)
  const foupMat = new THREE.MeshStandardMaterial({ color: 0x46c2c2, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.75 })
  const slotMat = new THREE.MeshStandardMaterial({ color: 0x1f6f78, roughness: 0.4 })
  for (const [fx, fy] of [[-0.38, 0.27], [0.38, 0.27], [-0.38, 0.72], [0.38, 0.72]]) {
    g.add(rbox(`${name}_foup`, 0.62, 0.38, 0.6, foupMat, fx, fy + 0.2, 0, 0.06))
    for (let i = 0; i < 4; i++) g.add(box(`${name}_foup_slot`, 0.5, 0.012, 0.01, slotMat, fx, fy + 0.1 + i * 0.07, 0.301))
    g.add(rbox(`${name}_foup_lid`, 0.5, 0.04, 0.48, MAT.teal, fx, fy + 0.41, 0, 0.02))
  }
  return g
}

export function buildEquipment() {
  const root = new THREE.Group()
  root.name = 'equipment'

  // FFU 5대 — 왼쪽 벽 2 + 모서리 1 + 뒤 벽 2 (참고 이미지처럼 L자 배치)
  root.add(ffu('ffu_1', -5.0, 3.1))
  root.add(ffu('ffu_2', -5.0, -0.4))
  root.add(ffu('ffu_3', -4.4, -4.6))
  root.add(ffu('ffu_4', -1.0, -4.6))
  root.add(ffu('ffu_5', 2.1, -4.6))

  // 왼쪽 벽 공정장비 2대 (앞면이 방 안쪽 +x를 보게 회전)
  root.add(processTool('process_tool_1', -5.85, 3.3, Math.PI / 2, 2.0, 1.7, 1.95))
  root.add(processTool('process_tool_2', -5.75, 0.55, Math.PI / 2, 2.5, 1.9, 2.35))
  root.add(kiosk('kiosk_1', -4.35, 4.85, Math.PI / 2 + 0.5))

  // 뒤 벽 케미컬 벤치 + 노광장비 + 단말기
  root.add(chemBench('chem_bench', -6.35, -5.05))
  root.add(lithoTool('litho_tool', 1.9, -4.6))
  root.add(kiosk('kiosk_2', 3.65, -3.05, -0.35))

  // 가운데 검사대 2대 + FOUP 카트
  root.add(inspectionStation('inspection_1', -1.2, 0.7, 0, new THREE.MeshStandardMaterial({ color: COLOR.teal, roughness: 0.45, metalness: 0.1 })))
  root.add(inspectionStation('inspection_2', 1.7, 2.8, -0.15, MAT.white))
  root.add(foupCart('foup_cart', 4.7, 1.4, -0.35))

  return root
}
