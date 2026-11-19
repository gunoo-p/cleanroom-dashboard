// 3D 클린룸 장면. models/model.glb가 있으면 그걸, 없으면 코드로 만든 클린룸 모형(cleanroom/)을 띄우고
// 시나리오에 따라 효과(부품 발광 · 입자 · 안개 · 경광등 · 모델 애니메이션)를 바꾼다.
//
// GLB와 코드 모형은 같은 코드 경로를 탄다 (코드 모형은 hooks로 화면·커튼·작업자 연출을 추가):
//   부품 찾기  → models/model-config.json의 targets 키워드로 이름 매칭
//   애니메이션 → config의 animations에 적힌 클립, 비어 있으면 시나리오 이름이 들어간 클립 자동 선택
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { buildCleanroom } from './cleanroom/index.js'

export const SCENARIO_KEYS = ['normal', 'temperature', 'humidity', 'gas', 'air_quality', 'pressure']

// config 파일이 없거나 일부 항목이 빠졌을 때 쓰는 기본값 (models/model-config.json과 같은 내용)
const DEFAULT_CONFIG = {
  file: 'model.glb',
  targets: {
    temperature: ['process_tool', 'hvac', 'heater', 'chiller'],
    humidity: ['ffu', 'hvac', 'humid'],
    gas: ['chem_bench', 'gas'],
    air_quality: ['ffu', 'filter', 'vent', 'duct'],
    pressure: ['door', 'gate', 'airlock'],
  },
  animations: {},
  transform: { fitSize: 12, rotationY: 0 },
}

// 시나리오별 연출. particle은 아래 PARTICLE_MODES의 키.
// 3D 영역은 참고 이미지처럼 밝은 배경 — 입자·안개 색도 밝은 배경에서 보이는 톤으로.
const PRESETS = {
  normal:      { particle: 'downflow', color: 0x4fbfc8, fogColor: 0x05070a, fog: 0.0,   glow: null,     beacon: false },
  temperature: { particle: 'rise',     color: 0xff6a1f, fogColor: 0xffd9c7, fog: 0.008, glow: 0xff3b1f, beacon: true },
  humidity:    { particle: 'rain',     color: 0x3b82f6, fogColor: 0xcfe0ff, fog: 0.018, glow: 0x3b82f6, beacon: true },
  gas:         { particle: 'leak',     color: 0x46b946, fogColor: 0xdff5cc, fog: 0.01,  glow: 0xc6e021, beacon: true },
  air_quality: { particle: 'dust',     color: 0x8a7356, fogColor: 0xd9cdb8, fog: 0.02,  glow: 0xf59e0b, beacon: true },
  pressure:    { particle: 'inflow',   color: 0x56677a, fogColor: 0xffe3e3, fog: 0.006, glow: 0xef4444, beacon: true },
}

const PARTICLE_COUNT = 700
const BG = 0x05070a // 방 바깥 배경: 검정

// 이름 비교용: 소문자 + 영숫자만 남긴다 ("Gas_Cabinet-01" → "gascabinet01")
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

function mergeConfig(cfg) {
  return {
    ...DEFAULT_CONFIG,
    ...cfg,
    targets: { ...DEFAULT_CONFIG.targets, ...(cfg?.targets || {}) },
    animations: { ...DEFAULT_CONFIG.animations, ...(cfg?.animations || {}) },
    transform: { ...DEFAULT_CONFIG.transform, ...(cfg?.transform || {}) },
  }
}

function dotTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.4, 'rgba(255,255,255,0.6)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

export function createScene(canvas, container, { onLog = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(BG)
  scene.fog = new THREE.FogExp2(BG, 0)
  // GLB의 PBR 재질(금속·거칠기)이 제 색으로 보이려면 환경광이 필요하다.
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd5dee8, 0.9))
  // 부드러운 그림자를 만드는 주광 — 그림자 범위는 모델 크기에 맞춰 아래에서 조정
  const sun = new THREE.DirectionalLight(0xffffff, 1.6)
  sun.position.set(8, 16, 10)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.02
  sun.shadow.radius = 4
  scene.add(sun, sun.target)
  const fill = new THREE.DirectionalLight(0xe8f4ff, 0.5)
  fill.position.set(-10, 8, 6)
  scene.add(fill)

  const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 500)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.08

  // ── 상태 ─────────────────────────────────────
  const state = {
    ready: false,
    source: null,       // 'placeholder' | 'glb'
    file: null,
    config: DEFAULT_CONFIG,
    scenario: 'normal',
    bounds: new THREE.Box3(new THREE.Vector3(-6, 0, -4), new THREE.Vector3(6, 3.8, 4)),
    targets: {},        // scenario → { names, meshes, box }
    clips: [],
    activeClip: null,
    pendingScenario: null,
    hooks: null,        // 코드 모형 고유 연출 (setScenario / update / info)
    view: null,         // 처음 카메라 시점
  }
  let mixer = null
  let currentAction = null
  let glowMeshes = []
  const tmpColor = new THREE.Color()

  // ── 입자 ─────────────────────────────────────
  const pos = new Float32Array(PARTICLE_COUNT * 3)
  const vel = new Float32Array(PARTICLE_COUNT * 3)
  const pGeo = new THREE.BufferGeometry()
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const pMat = new THREE.PointsMaterial({
    size: 0.08, map: dotTexture(), transparent: true, opacity: 0.8,
    depthWrite: false, color: PRESETS.normal.color,
  })
  const points = new THREE.Points(pGeo, pMat)
  points.frustumCulled = false
  scene.add(points)

  const rnd = (a, b) => a + Math.random() * (b - a)
  const emitterOf = (key) => state.targets[key]?.box || null

  // 각 모드: spawn(i) = 새 위치·속도, done(i) = 다시 태어나야 하는지
  const PARTICLE_MODES = {
    downflow: { // 정상: 천장 필터에서 바닥으로 내려오는 깨끗한 층류
      spawn(i, b) {
        set(i, rnd(b.min.x, b.max.x), b.max.y - rnd(0, 0.2), rnd(b.min.z, b.max.z))
        setV(i, 0, -rnd(0.4, 0.7), 0)
      },
      done: (i, b) => pos[i * 3 + 1] < b.min.y,
      spread: (b) => b.max.y - b.min.y,
    },
    rise: { // 온도: 대상 장비 위로 열기가 올라감
      spawn(i, b) {
        const e = emitterOf('temperature') || b
        const s = e.getSize(v3a)
        set(i, rnd(e.min.x, e.max.x), e.max.y - s.y * 0.1, rnd(e.min.z, e.max.z))
        setV(i, rnd(-0.1, 0.1), rnd(0.6, 1.3), rnd(-0.1, 0.1))
      },
      update(i, dt, t) { vel[i * 3] += Math.sin(t * 3 + i) * 0.4 * dt },
      done: (i, b) => pos[i * 3 + 1] > b.max.y,
      spread: (b) => b.max.y - b.min.y,
    },
    rain: { // 습도: 방 전체에 물방울
      spawn(i, b) {
        set(i, rnd(b.min.x, b.max.x), b.max.y, rnd(b.min.z, b.max.z))
        setV(i, 0, -rnd(2.2, 3.2), 0)
      },
      done: (i, b) => pos[i * 3 + 1] < b.min.y,
      spread: (b) => b.max.y - b.min.y,
    },
    leak: { // 가스: 대상 캐비닛에서 사방으로 퍼짐
      spawn(i, b) {
        const e = emitterOf('gas') || b
        e.getCenter(v3a)
        set(i, v3a.x + rnd(-0.15, 0.15), v3a.y + rnd(-0.3, 0.3), v3a.z + rnd(-0.15, 0.15))
        const a = rnd(0, Math.PI * 2)
        const sp = rnd(0.4, 1.2)
        setV(i, Math.cos(a) * sp, rnd(-0.05, 0.25), Math.sin(a) * sp)
        life[i] = rnd(2.5, 5)
      },
      done: (i) => life[i] <= 0,
      spread: () => 3,
    },
    dust: { // 공기질: 방 안을 무작위로 떠다니는 먼지
      spawn(i, b) {
        set(i, rnd(b.min.x, b.max.x), rnd(b.min.y, b.max.y), rnd(b.min.z, b.max.z))
        setV(i, rnd(-0.2, 0.2), rnd(-0.1, 0.1), rnd(-0.2, 0.2))
      },
      update(i, dt) {
        vel[i * 3] += rnd(-1, 1) * dt
        vel[i * 3 + 1] += rnd(-0.5, 0.5) * dt
        vel[i * 3 + 2] += rnd(-1, 1) * dt
      },
      done: (i, b) => !b.containsPoint(v3b.fromArray(pos, i * 3)),
      spread: () => 0,
    },
    inflow: { // 차압: 문으로 바깥 공기가 방 안쪽을 향해 밀려 들어옴
      spawn(i, b) {
        const e = emitterOf('pressure') || b
        e.getCenter(v3a)
        b.getCenter(v3b)
        const dir = v3b.sub(v3a).setY(0).normalize()
        set(i, v3a.x + rnd(-0.1, 0.1), rnd(e.min.y, e.max.y), v3a.z + rnd(-0.5, 0.5))
        const sp = rnd(1.2, 2.2)
        setV(i, dir.x * sp + rnd(-0.3, 0.3), rnd(-0.1, 0.1), dir.z * sp + rnd(-0.3, 0.3))
        life[i] = rnd(2, 4)
      },
      done: (i, b) => life[i] <= 0 || !b.containsPoint(v3b.fromArray(pos, i * 3)),
      spread: () => 3,
    },
  }
  const life = new Float32Array(PARTICLE_COUNT)
  const v3a = new THREE.Vector3()
  const v3b = new THREE.Vector3()
  function set(i, x, y, z) { pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z }
  function setV(i, x, y, z) { vel[i * 3] = x; vel[i * 3 + 1] = y; vel[i * 3 + 2] = z }

  let mode = PARTICLE_MODES.downflow
  let modeName = 'downflow'
  function setParticleMode(name) {
    mode = PARTICLE_MODES[name]
    modeName = name
    const b = state.bounds
    // 한꺼번에 터져 나오지 않도록 각 입자를 진행 중간 지점으로 미리 보내 둔다.
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      mode.spawn(i, b)
      const adv = Math.random() * 2.5
      for (let k = 0; k < 3; k++) pos[i * 3 + k] += vel[i * 3 + k] * adv
      life[i] -= adv
      if (mode.done(i, b)) mode.spawn(i, b)
    }
    pGeo.attributes.position.needsUpdate = true
  }

  function updateParticles(dt, t) {
    const b = state.bounds
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      mode.update?.(i, dt, t)
      pos[i * 3] += vel[i * 3] * dt
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt
      life[i] -= dt
      if (mode.done(i, b)) mode.spawn(i, b)
    }
    pGeo.attributes.position.needsUpdate = true
  }

  // ── 경광등 ───────────────────────────────────
  const beacon = new THREE.Group()
  beacon.visible = false
  const beaconBulb = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.2, 0.26, 20),
    new THREE.MeshStandardMaterial({ color: 0x7f1d1d, emissive: 0xef4444, emissiveIntensity: 2 }),
  )
  beacon.add(beaconBulb)
  const beaconSpin = new THREE.Group()
  const spot = new THREE.SpotLight(0xff3030, 40, 20, 0.5, 0.6, 1.2)
  spot.position.set(0, 0, 0)
  const spotTarget = new THREE.Object3D()
  spotTarget.position.set(4, -3, 0)
  beaconSpin.add(spot, spotTarget)
  spot.target = spotTarget
  beacon.add(beaconSpin)
  const wash = new THREE.PointLight(0xff2020, 0, 30, 1.5)
  beacon.add(wash)
  scene.add(beacon)

  // ── 부품 발광 ────────────────────────────────
  function materialsOf(mesh) {
    return Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  }
  // 재질은 여러 부품이 공유하는 경우가 많아, 발광시킬 부품만 재질을 복제해 원래 값을 기억해 둔다.
  function prepareGlow(mesh) {
    if (mesh.userData.glowReady) return
    const cloned = materialsOf(mesh).map((m) => m.clone())
    mesh.material = Array.isArray(mesh.material) ? cloned : cloned[0]
    mesh.userData.glowOrig = cloned.map((m) => (m.emissive
      ? { color: m.emissive.clone(), intensity: m.emissiveIntensity }
      : null))
    mesh.userData.glowReady = true
  }
  function resetGlow() {
    for (const mesh of glowMeshes) {
      materialsOf(mesh).forEach((m, k) => {
        const o = mesh.userData.glowOrig[k]
        if (o) { m.emissive.copy(o.color); m.emissiveIntensity = o.intensity }
      })
    }
    glowMeshes = []
  }
  function updateGlow(t) {
    const p = PRESETS[state.scenario]
    if (!p.glow) return
    const k = 0.5 + 0.5 * Math.sin(t * 6)
    tmpColor.setHex(p.glow)
    for (const mesh of glowMeshes) {
      for (const m of materialsOf(mesh)) {
        if (!m.emissive) continue
        m.emissive.copy(tmpColor)
        m.emissiveIntensity = 0.3 + 1.7 * k
      }
    }
  }

  // ── 부품 매칭 ────────────────────────────────
  function findTargets(root, cfg) {
    const result = {}
    for (const key of SCENARIO_KEYS) {
      if (key === 'normal') continue
      const keywords = (cfg.targets[key] || []).map(norm).filter(Boolean)
      const matched = []
      root.traverse((o) => {
        if (o === root || !o.name) return
        const n = norm(o.name)
        // 부모가 이미 매칭됐으면 자식은 따로 세지 않는다 (부모 안의 메시를 통째로 쓰므로).
        const kwIdx = keywords.findIndex((kw) => n.includes(kw))
        if (kwIdx >= 0 && !matched.some((m) => isAncestor(m, o))) { o.userData._kwIdx = kwIdx; matched.push(o) }
      })
      // config에 먼저 적힌 키워드에 걸린 부품이 앞으로 오게 정렬
      matched.sort((a, b) => a.userData._kwIdx - b.userData._kwIdx)
      const meshes = new Set()
      for (const o of matched) o.traverse((c) => { if (c.isMesh) meshes.add(c) })
      // 입자 발생 위치는 config에 가장 먼저 적힌 키워드에 걸린 부품 기준으로 잡는다.
      let box = null
      if (matched.length) {
        box = new THREE.Box3().setFromObject(matched[0])
        if (box.isEmpty()) box = null
      }
      result[key] = { names: matched.map((o) => o.name), meshes: [...meshes], box }
    }
    return result
  }
  function isAncestor(a, b) {
    for (let p = b.parent; p; p = p.parent) if (p === a) return true
    return false
  }

  // ── 애니메이션 ───────────────────────────────
  function clipFor(key) {
    const wanted = state.config.animations?.[key]
    if (wanted) return state.clips.find((c) => c.name === wanted) || null
    if (key === 'normal') return null
    const k = norm(key)
    return state.clips.find((c) => norm(c.name).includes(k)) || null
  }

  // ── 시나리오 전환 ────────────────────────────
  function applyScenario(key) {
    const p = PRESETS[key] || PRESETS.normal
    state.scenario = PRESETS[key] ? key : 'normal'

    pMat.color.setHex(p.color)
    setParticleMode(p.particle)
    scene.fog.color.setHex(p.fogColor)
    scene.fog.density = p.fog
    scene.background.setHex(BG).lerp(new THREE.Color(p.fogColor), 0.012) // 위험 시 배경에 살짝만 색이 돌게 (선형 색공간이라 작은 값도 꽤 밝아짐)
    beacon.visible = p.beacon

    resetGlow()
    if (p.glow) {
      glowMeshes = state.targets[state.scenario]?.meshes || []
      glowMeshes.forEach(prepareGlow)
    }

    if (currentAction) { currentAction.fadeOut(0.3); currentAction = null }
    state.activeClip = null
    const clip = mixer && clipFor(state.scenario)
    if (clip) {
      currentAction = mixer.clipAction(clip)
      currentAction.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.3).play()
      state.activeClip = clip.name
    }

    state.hooks?.setScenario?.(state.scenario)
  }

  function setScenario(key) {
    if (!state.ready) { state.pendingScenario = key; return }
    applyScenario(key)
  }

  // ── 모델 불러오기 ────────────────────────────
  async function loadConfig() {
    try {
      const res = await fetch('models/model-config.json', { cache: 'no-store' })
      if (res.ok) return mergeConfig(await res.json())
    } catch { /* 기본값 사용 */ }
    return mergeConfig({})
  }

  async function exists(url) {
    try {
      const res = await fetch(url, { method: 'HEAD', cache: 'no-store' })
      return res.ok
    } catch { return false }
  }

  function fitToRoom(root, transform) {
    root.rotation.y = THREE.MathUtils.degToRad(transform.rotationY || 0)
    root.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(root)
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || 1
    const s = (transform.fitSize || 12) / maxDim
    root.scale.setScalar(s)
    root.updateMatrixWorld(true)
    box.setFromObject(root)
    const c = box.getCenter(new THREE.Vector3())
    root.position.x -= c.x
    root.position.z -= c.z
    root.position.y -= box.min.y // 바닥(y=0)에 올려놓기
    root.updateMatrixWorld(true)
  }

  async function loadContent() {
    const cfg = await loadConfig()
    const override = new URLSearchParams(location.search).get('model') // 테스트용: ?model=경로.glb
    const url = override || (cfg.file ? `models/${cfg.file}` : null)

    if (url && await exists(url)) {
      try {
        const gltf = await new GLTFLoader().loadAsync(url)
        const root = gltf.scene
        fitToRoom(root, cfg.transform)
        return { root, clips: gltf.animations || [], source: 'glb', file: url, cfg }
      } catch (e) {
        console.error(e)
        onLog(`3D 모델을 읽지 못해 임시 모형으로 표시합니다 (${url}): ${e.message || e}`, 'fail')
      }
    }
    const built = buildCleanroom()
    return { ...built, source: 'builtin', file: null, cfg }
  }

  // 시점: 방위각(azimuth, +z에서 +x 쪽으로 도는 각도)·고도(elevation)로 모델 전체가 들어오게 배치
  function frameCamera() {
    const v = { azimuth: 38, elevation: 32, fov: 32, fit: 1.1, ...(state.view || {}) }
    const b = state.bounds
    const c = b.getCenter(new THREE.Vector3())
    const size = b.getSize(new THREE.Vector3())
    const radius = size.length() / 2
    camera.fov = v.fov
    const dist = (radius / Math.sin(THREE.MathUtils.degToRad(v.fov / 2))) * 0.62 * v.fit
    const az = THREE.MathUtils.degToRad(v.azimuth)
    const el = THREE.MathUtils.degToRad(v.elevation)
    controls.target.set(c.x, b.min.y + size.y * 0.25, c.z)
    camera.position.set(
      controls.target.x + Math.sin(az) * Math.cos(el) * dist,
      controls.target.y + Math.sin(el) * dist,
      controls.target.z + Math.cos(az) * Math.cos(el) * dist,
    )
    camera.near = dist / 100
    camera.far = dist * 10
    camera.updateProjectionMatrix()
    controls.maxPolarAngle = THREE.MathUtils.degToRad(85) // 바닥 아래로 못 내려가게
    controls.minDistance = dist * 0.3
    controls.maxDistance = dist * 2.5
    controls.update()

    // 그림자 범위를 모델 크기에 맞춤
    const sc = sun.shadow.camera
    sc.left = sc.bottom = -radius
    sc.right = sc.top = radius
    sc.near = 0.5
    sc.far = radius * 6
    sun.target.position.copy(c)
    sun.position.set(c.x + radius * 0.6, c.y + radius * 1.6, c.z + radius * 0.9)
    sc.updateProjectionMatrix()
  }

  // 그림자: 불투명한 메시만 그림자를 만들고 받는다 (유리·공기 커튼·화면 제외)
  function setupShadows(root) {
    root.traverse((o) => {
      if (!o.isMesh) return
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      const see = mats.some((m) => m.transparent)
      o.castShadow = !see && !o.userData.noShadow && !o.userData.receiveOnly
      o.receiveShadow = !see
    })
  }

  const readyPromise = (async () => {
    const content = await loadContent()
    scene.add(content.root)
    content.root.updateMatrixWorld(true)

    state.source = content.source
    state.file = content.file
    state.config = content.cfg
    state.clips = content.clips
    state.hooks = content.hooks || null
    state.view = content.view || null
    const box = new THREE.Box3().setFromObject(content.root)
    if (!box.isEmpty()) state.bounds = box
    state.targets = findTargets(content.root, content.cfg)
    if (state.clips.length) mixer = new THREE.AnimationMixer(content.root)
    setupShadows(content.root)

    // 경광등: 모형이 위치를 정해 주면 거기, 아니면 모델 꼭대기 가운데
    if (content.anchors?.beacon) {
      beacon.position.copy(content.anchors.beacon)
    } else {
      const top = state.bounds.getCenter(new THREE.Vector3())
      top.y = state.bounds.max.y - 0.15
      beacon.position.copy(top)
    }
    wash.distance = state.bounds.getSize(v3a).length() * 1.5

    frameCamera()
    state.ready = true
    applyScenario(state.pendingScenario || 'normal')
    return info()
  })().catch((e) => {
    console.error(e)
    onLog(`3D 화면 초기화 실패: ${e.message || e}`, 'fail')
    throw e
  })

  // ── 렌더 루프 ────────────────────────────────
  function resize() {
    const w = container.clientWidth
    const h = container.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }
  new ResizeObserver(resize).observe(container)
  resize()

  const clock = new THREE.Clock()
  let frames = 0
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05)
    const t = clock.elapsedTime
    controls.update()
    if (state.ready) {
      mixer?.update(dt)
      state.hooks?.update?.(dt, t)
      updateParticles(dt, t)
      updateGlow(t)
      if (beacon.visible) {
        beaconSpin.rotation.y = t * 4
        wash.intensity = 6 + 6 * Math.max(0, Math.sin(t * 8))
      }
    }
    renderer.render(scene, camera)
    frames++
  })

  // 검증·디버그용 현재 상태 요약
  function info() {
    const targets = {}
    for (const [k, v] of Object.entries(state.targets)) targets[k] = v.names
    return {
      ready: state.ready,
      source: state.source,
      file: state.file,
      scenario: state.scenario,
      particles: modeName,
      fog: scene.fog.density,
      beacon: beacon.visible,
      glowMeshes: glowMeshes.length,
      activeClip: state.activeClip,
      clips: state.clips.map((c) => c.name),
      targets,
      frames,
      model: state.hooks?.info?.() ?? null,
    }
  }

  return { setScenario, info, ready: readyPromise, isReady: () => state.ready }
}
