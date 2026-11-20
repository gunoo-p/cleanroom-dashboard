// 코드로 그리는 텍스처 모음 (외부 이미지 파일 없이 canvas로 생성).
import * as THREE from 'three'

function canvas(w, h, draw) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

// 바닥 타일 2×2 묶음: 구멍 뚫린(perforated) 타일과 부분 타공 타일이 섞인 클린룸 이중바닥
export function floorTexture(tileSize) {
  const tex = canvas(512, 512, (g, W) => {
    const T = W / 2
    g.fillStyle = '#eef2f6'
    g.fillRect(0, 0, W, W)
    const patterns = [
      [0, 0, 'full'], [T, 0, 'ring'],
      [0, T, 'ring'], [T, T, 'full'],
    ]
    for (const [ox, oy, kind] of patterns) {
      // 타일 면 + 이음매
      g.fillStyle = '#f6f8fa'
      g.fillRect(ox + 3, oy + 3, T - 6, T - 6)
      g.strokeStyle = '#b8c3ce'
      g.lineWidth = 4
      g.strokeRect(ox + 2, oy + 2, T - 4, T - 4)
      // 타공 구멍 (가까이서 보면 구멍, 멀리서 보면 점무늬)
      const n = 9
      const step = (T - 48) / (n - 1)
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const edge = i < 2 || j < 2 || i > n - 3 || j > n - 3
          if (kind === 'ring' && !edge) continue
          const cx = ox + 24 + i * step
          const cy = oy + 24 + j * step
          g.fillStyle = '#8e9bab'
          g.beginPath()
          g.arc(cx, cy, 5.2, 0, Math.PI * 2)
          g.fill()
          g.fillStyle = '#c4ced8'
          g.beginPath()
          g.arc(cx + 1.2, cy + 1.2, 3.2, 0, Math.PI * 2)
          g.fill()
        }
      }
    }
  })
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(1 / (tileSize * 2), 1 / (tileSize * 2))
  return tex
}

// FFU(팬 필터 유닛) 아랫면 격자
export function grilleTexture() {
  return canvas(256, 256, (g, W) => {
    g.fillStyle = '#f3f5f8'
    g.fillRect(0, 0, W, W)
    g.fillStyle = '#d5dde6'
    roundRect(g, 26, 26, W - 52, W - 52, 10)
    g.fill()
    g.strokeStyle = '#5d6a78'
    g.lineWidth = 5
    for (let y = 42; y < W - 36; y += 14) {
      g.beginPath()
      g.moveTo(38, y)
      g.lineTo(W - 38, y)
      g.stroke()
    }
  })
}

// 장비 화면 UI — 정상(청록 대시보드) / 경보(빨강)
export function screenTexture(alarm = false) {
  return canvas(256, 192, (g, W, H) => {
    g.fillStyle = alarm ? '#5b0d12' : '#0b3b4a'
    g.fillRect(0, 0, W, H)
    if (alarm) {
      g.fillStyle = '#ef4444'
      g.fillRect(0, 0, W, 34)
      g.fillStyle = '#fff'
      g.font = 'bold 22px sans-serif'
      g.fillText('⚠ ALARM', 12, 25)
      g.fillStyle = '#fecaca'
      g.font = 'bold 18px sans-serif'
      g.fillText('THRESHOLD EXCEEDED', 12, 70)
      g.fillStyle = '#f87171'
      for (let i = 0; i < 4; i++) g.fillRect(12, 92 + i * 22, 60 + ((i * 53) % 150), 10)
      return
    }
    g.fillStyle = '#1aa3b0'
    g.fillRect(0, 0, W, 26)
    g.fillStyle = '#e0fbff'
    g.font = 'bold 15px sans-serif'
    g.fillText('PROCESS  RUN', 10, 18)
    // 그래프
    g.strokeStyle = '#5ee7f0'
    g.lineWidth = 3
    g.beginPath()
    for (let x = 0; x <= 140; x += 10) {
      const y = 110 - Math.sin(x / 18) * 22 - x * 0.15
      x === 0 ? g.moveTo(14 + x, y) : g.lineTo(14 + x, y)
    }
    g.stroke()
    // 막대
    g.fillStyle = '#38bdf8'
    for (let i = 0; i < 5; i++) g.fillRect(170 + i * 15, 140 - (20 + i * 9), 10, 20 + i * 9)
    g.fillStyle = '#7dd3fc'
    for (let i = 0; i < 3; i++) g.fillRect(14, 140 + i * 15, 70 + i * 30, 7)
  })
}

// 공기 커튼: 세로 줄무늬(흐르는 공기). map은 아래로 흘러가게 offset을 움직인다.
export function airflowTexture() {
  // 바탕은 은은한 막(면 전체), 그 위에 부드러운 세로 줄무늬가 흐른다.
  const tex = canvas(128, 256, (g, W, H) => {
    g.fillStyle = 'rgba(255,255,255,0.45)'
    g.fillRect(0, 0, W, H)
    for (let x = 0; x < W; x += 10) {
      const a = 0.3 + 0.5 * Math.abs(Math.sin(x * 1.7))
      for (let y = 0; y < H; y += 4) {
        const k = 0.5 + 0.5 * Math.sin((y / H) * Math.PI * 4 + x)
        g.fillStyle = `rgba(255,255,255,${(a * (0.5 + 0.5 * k)).toFixed(3)})`
        g.fillRect(x, y, 5, 4)
      }
    }
  })
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.NoColorSpace
  return tex
}

// 공기 커튼 투명도: 위는 진하고 아래로 갈수록 사라짐
export function fadeTexture() {
  const tex = canvas(4, 128, (g, W, H) => {
    const grad = g.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#ffffff')
    grad.addColorStop(0.55, '#8a8a8a')
    grad.addColorStop(1, '#000000')
    g.fillStyle = grad
    g.fillRect(0, 0, W, H)
  })
  tex.colorSpace = THREE.NoColorSpace
  return tex
}

// 창문 너머 옆 베이(다른 클린룸) 풍경
export function windowViewTexture() {
  return canvas(256, 160, (g, W, H) => {
    const grad = g.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#cfe7ee')
    grad.addColorStop(1, '#8fbccb')
    g.fillStyle = grad
    g.fillRect(0, 0, W, H)
    // 장비 실루엣
    const tools = [[18, 60, 70, 100], [100, 48, 60, 112], [172, 66, 66, 94]]
    for (const [x, y, w, h] of tools) {
      g.fillStyle = '#e8f1f5'
      roundRect(g, x, y, w, h, 6)
      g.fill()
      g.fillStyle = '#3f8fa6'
      g.fillRect(x + 8, y + 16, w - 16, h * 0.35)
      g.fillStyle = '#2d5b8c'
      g.fillRect(x, y + h - 14, w, 14)
    }
    g.fillStyle = 'rgba(255,255,255,0.35)'
    g.beginPath()
    g.moveTo(0, 0); g.lineTo(90, 0); g.lineTo(20, H); g.lineTo(0, H)
    g.fill()
  })
}

// 장비 창 안쪽(공정 챔버) 모습
export function chamberTexture() {
  return canvas(128, 128, (g, W, H) => {
    const grad = g.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, '#1e4f63')
    grad.addColorStop(1, '#0f2f3d')
    g.fillStyle = grad
    g.fillRect(0, 0, W, H)
    g.fillStyle = '#5fd0dc'
    g.fillRect(28, 70, 72, 10)
    g.fillStyle = '#9ad7e0'
    g.beginPath()
    g.ellipse(64, 66, 30, 8, 0, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = '#2b6e82'
    g.fillRect(56, 18, 16, 40)
    g.fillStyle = 'rgba(255,255,255,0.25)'
    g.fillRect(8, 8, 18, 112)
  })
}
