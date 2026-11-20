// 코드로 만든 클린룸 모형 (참고 이미지 기반). scene.js가 GLB 대신 이걸 띄운다.
// 반환값:
//   root    — 장면에 넣을 그룹
//   clips   — 애니메이션 클립 (GLB 애니메이션과 같은 경로로 재생)
//   hooks   — setScenario(key) / update(dt, t) / info() : 화면·커튼·작업자 등 모형 고유 연출
//   anchors — 경광등 위치 등
//   view    — 처음 카메라 시점 (참고 이미지와 같은 비스듬한 위쪽 시점)
import * as THREE from 'three'
import { buildRoom, ROOM } from './room.js'
import { buildEquipment, curtainMaterial, flowCurtains } from './equipment.js'
import { buildWorkers } from './workers.js'
import { createNav, obstaclesFrom } from './nav.js'
import { buildEffects } from './effects.js'
import { setScreensAlarm, resetScreens } from './parts.js'

// 시나리오별 공기 커튼 색·흐름 속도
const CURTAIN = {
  normal:      { color: 0x3fcfd2, speed: 1.0, opacity: 0.6 },
  temperature: { color: 0xffb08a, speed: 1.0, opacity: 0.5 },
  humidity:    { color: 0x6aa8ff, speed: 1.8, opacity: 0.65 },
  gas:         { color: 0xa6e07a, speed: 1.0, opacity: 0.5 },
  air_quality: { color: 0xa08b6c, speed: 0.35, opacity: 0.7 }, // 필터 막힘: 흐름 약해지고 탁해짐
  pressure:    { color: 0xff9b9b, speed: -0.6, opacity: 0.45 }, // 양압 붕괴: 흐름이 역류
}

export function buildCleanroom() {
  resetScreens()
  const root = new THREE.Group()
  root.name = 'cleanroom'
  root.add(buildRoom())
  const equipment = buildEquipment()
  root.add(equipment)
  // 장비 배치에서 걸을 수 없는 영역을 자동 계산해 작업자 길찾기에 사용
  const nav = createNav(obstaclesFrom(equipment))
  const workers = buildWorkers(nav)
  root.add(workers.root)

  // 장비 상태등 (*_lamp)
  const lamps = []
  root.traverse((o) => { if (o.isMesh && o.name.endsWith('_lamp')) lamps.push(o) })

  // 시나리오별 효과 (연기·물방울·웅덩이·먼지·화살표·계기 등). 차압 때 문은 열지 않고 덜컹거리기만 한다.
  const effects = buildEffects(root)

  let scenario = 'normal'
  let curtain = CURTAIN.normal
  const targetColor = new THREE.Color(curtain.color)

  const hooks = {
    setScenario(key) {
      scenario = CURTAIN[key] ? key : 'normal'
      curtain = CURTAIN[scenario]
      targetColor.setHex(curtain.color)
      const alarm = scenario !== 'normal'
      setScreensAlarm(alarm)
      workers.setScenario(scenario)
      effects.setScenario(scenario)
    },
    update(dt, t) {
      effects.update(dt, t)
      flowCurtains(dt, curtain.speed)
      curtainMaterial.color.lerp(targetColor, Math.min(1, dt * 3))
      curtainMaterial.opacity += (curtain.opacity - curtainMaterial.opacity) * Math.min(1, dt * 3)
      workers.update(dt, t)
      const alarm = scenario !== 'normal'
      const blink = alarm ? (Math.sin(t * 10) > 0 ? 1 : 0.15) : 1
      for (const l of lamps) {
        const mats = Array.isArray(l.material) ? l.material : [l.material]
        for (const m of mats) {
          const c = alarm ? 0xef4444 : 0x22c55e
          m.color.setHex(c)
          m.emissive.setHex(c)
          m.emissiveIntensity = blink
        }
      }
    },
    info() {
      return { workers: workers.summary(), effects: effects.summary(), curtainSpeed: curtain.speed }
    },
  }

  return {
    root,
    clips: [],
    hooks,
    anchors: { beacon: new THREE.Vector3(ROOM.door.x, ROOM.door.h + 0.55, ROOM.minZ + ROOM.wallT + 0.12) },
    view: { azimuth: 40, elevation: 33, fov: 30, fit: 1.0 },
  }
}
