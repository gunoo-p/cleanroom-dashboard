// 클린룸 모형 공통 재질·부품 도우미.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { chamberTexture, screenTexture } from './textures.js'

// 참고 이미지 색감: 흰 장비 + 남색 하부 + 청록 포인트
export const COLOR = {
  white: 0xf3f5f8,
  offWhite: 0xe6ebf0,
  navy: 0x2c5a8a,
  navyDark: 0x23476e,
  teal: 0x2fb3b5,
  tealLight: 0x7fd6d6,
  grey: 0x9aa6b2,
  greyDark: 0x5b6773,
  glass: 0x1e4a5e,
  suit: 0xf7f9fb,
  glove: 0xc4dced,
}

export const MAT = {
  white: new THREE.MeshStandardMaterial({ color: COLOR.white, roughness: 0.42, metalness: 0.05 }),
  offWhite: new THREE.MeshStandardMaterial({ color: COLOR.offWhite, roughness: 0.5, metalness: 0.05 }),
  navy: new THREE.MeshStandardMaterial({ color: COLOR.navy, roughness: 0.45, metalness: 0.15 }),
  navyDark: new THREE.MeshStandardMaterial({ color: COLOR.navyDark, roughness: 0.5, metalness: 0.15 }),
  teal: new THREE.MeshStandardMaterial({ color: COLOR.teal, roughness: 0.4, metalness: 0.1 }),
  tealLight: new THREE.MeshStandardMaterial({ color: COLOR.tealLight, roughness: 0.35, metalness: 0.1 }),
  grey: new THREE.MeshStandardMaterial({ color: COLOR.grey, roughness: 0.4, metalness: 0.5 }),
  greyDark: new THREE.MeshStandardMaterial({ color: COLOR.greyDark, roughness: 0.45, metalness: 0.5 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xc7ced6, roughness: 0.25, metalness: 0.85 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x3b4450, roughness: 0.8 }),
  seam: new THREE.MeshStandardMaterial({ color: 0xc8d1db, roughness: 0.6 }),
  glassBlue: new THREE.MeshStandardMaterial({
    color: 0x5f9fcf, roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.85,
  }),
  glassTeal: new THREE.MeshStandardMaterial({
    color: 0x8fe0e0, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.45, depthWrite: false,
  }),
  chamber: new THREE.MeshStandardMaterial({
    map: chamberTexture(), roughness: 0.15, metalness: 0.1,
    emissive: 0x0e5363, emissiveIntensity: 0.35,
  }),
}

const SCREEN_OK = screenTexture(false)
const SCREEN_ALARM = screenTexture(true)

// 모든 화면 메시: 시나리오에 따라 정상/경보 화면을 바꿔 끼운다.
const screens = []
export function screen(name, w, h) {
  const mat = new THREE.MeshStandardMaterial({
    map: SCREEN_OK, emissiveMap: SCREEN_OK, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.3,
  })
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)
  m.name = name
  m.userData.noShadow = true
  screens.push(m)
  return m
}
export function setScreensAlarm(alarm) {
  const tex = alarm ? SCREEN_ALARM : SCREEN_OK
  for (const m of screens) {
    // 발광 효과가 재질을 복제해 갈아끼울 수 있으므로 매번 '현재' 재질을 고친다.
    const mats = Array.isArray(m.material) ? m.material : [m.material]
    for (const mat of mats) {
      mat.map = tex
      mat.emissiveMap = tex
      mat.needsUpdate = true
    }
  }
}
export function resetScreens() { screens.length = 0 }

// 둥근 모서리 상자. (x,y,z)는 바닥 중심이 아니라 상자 중심.
export function rbox(name, w, h, d, mat, x = 0, y = 0, z = 0, r = 0.06) {
  const radius = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.max(radius, 0.001)), mat)
  m.name = name
  m.position.set(x, y, z)
  return m
}

export function box(name, w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  m.name = name
  m.position.set(x, y, z)
  return m
}

export function cyl(name, rTop, rBot, h, mat, x = 0, y = 0, z = 0, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat)
  m.name = name
  m.position.set(x, y, z)
  return m
}

// 바닥(y=0)에서 시작하는 그룹 생성 도우미
export function group(name, x = 0, z = 0, rotY = 0) {
  const g = new THREE.Group()
  g.name = name
  g.position.set(x, 0, z)
  g.rotation.y = rotY
  return g
}

// 장비 앞면 관찰창: 테두리 + 안쪽 챔버. 장비 앞면(+z)에 붙인다.
export function viewport(name, w, h, x, y, z) {
  const g = new THREE.Group()
  g.name = name
  g.position.set(x, y, z)
  g.add(rbox(`${name}_frame`, w + 0.08, h + 0.08, 0.04, MAT.offWhite, 0, 0, 0, 0.03))
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), MAT.chamber)
  pane.name = `${name}_pane`
  pane.position.z = 0.025
  g.add(pane)
  return g
}
