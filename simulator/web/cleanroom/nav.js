// 바닥 격자 길찾기 (A*) — 장비·벽을 피해 걷는 경로를 만든다.
//   장애물: equipment 그룹의 장비마다 3D 모형에서 바닥 위 차지 영역(사각형)을 자동 계산 (천장 FFU 제외)
//   벽: 방 바닥 외곽선(room.js ROOM)에서 일정 거리 안쪽만 걸을 수 있음
//   결과 경로는 일직선으로 갈 수 있는 구간을 이어 붙여(곧게 펴기) 자연스럽게 걷게 한다.
import * as THREE from 'three'
import { ROOM } from './room.js'

const CELL = 0.2
const BODY = 0.3   // 작업자 몸 반지름 (경로 계획용 여유)
const WALL_GAP = 0.35

// 방 바닥 외곽선 (room.js outline과 같은 모양, 벽 두께만큼 안쪽)
function roomPolygon() {
  const { minX, maxX, minZ, maxZ, cutFront, cutSide, wallT } = ROOM
  const a = minX + wallT, c = minZ + wallT
  return [
    [a, c], [maxX - cutSide, c], [maxX, minZ + cutSide], [maxX, maxZ - cutFront],
    [maxX - cutFront, maxZ], [minX + cutSide, maxZ], [a, maxZ - cutSide],
  ]
}

function insidePoly(poly, x, z) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]
    const [xj, zj] = poly[j]
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

function distToSeg(px, pz, [ax, az], [bx, bz]) {
  const dx = bx - ax, dz = bz - az
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)))
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz))
}

// equipment 그룹의 장비별 바닥 차지 영역 [minX, minZ, maxX, maxZ]
export function obstaclesFrom(equipmentGroup) {
  equipmentGroup.updateWorldMatrix(true, true)
  const rects = []
  const box = new THREE.Box3()
  for (const child of equipmentGroup.children) {
    if (/^ffu_/.test(child.name)) continue // 천장에 매달린 FFU는 걷는 데 지장 없음
    box.setFromObject(child)
    if (box.isEmpty() || box.min.y > 1.5) continue
    rects.push({ name: child.name, r: [box.min.x, box.min.z, box.max.x, box.max.z] })
  }
  return rects
}

export function createNav(obstacles) {
  const poly = roomPolygon()
  const x0 = ROOM.minX, z0 = ROOM.minZ
  const W = Math.ceil((ROOM.maxX - ROOM.minX) / CELL)
  const H = Math.ceil((ROOM.maxZ - ROOM.minZ) / CELL)
  const blocked = new Uint8Array(W * H)

  function freeAt(x, z, pad = BODY) {
    if (!insidePoly(poly, x, z)) return false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      if (distToSeg(x, z, poly[j], poly[i]) < WALL_GAP) return false
    }
    for (const { r } of obstacles) {
      if (x > r[0] - pad && x < r[2] + pad && z > r[1] - pad && z < r[3] + pad) return false
    }
    return true
  }
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) blocked[j * W + i] = freeAt(x0 + (i + 0.5) * CELL, z0 + (j + 0.5) * CELL) ? 0 : 1
  }

  const cellOf = (x, z) => [
    Math.min(W - 1, Math.max(0, Math.floor((x - x0) / CELL))),
    Math.min(H - 1, Math.max(0, Math.floor((z - z0) / CELL))),
  ]
  const center = (i, j) => [x0 + (i + 0.5) * CELL, z0 + (j + 0.5) * CELL]

  // 막힌 칸이면 가장 가까운 빈 칸으로 (장비 바로 옆에 서 있는 작업 자리 등)
  function nearestFree(i, j) {
    if (!blocked[j * W + i]) return [i, j]
    for (let rad = 1; rad < 15; rad++) {
      let best = null, bd = Infinity
      for (let dj = -rad; dj <= rad; dj++) {
        for (let di = -rad; di <= rad; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== rad) continue
          const ii = i + di, jj = j + dj
          if (ii < 0 || jj < 0 || ii >= W || jj >= H || blocked[jj * W + ii]) continue
          const d = di * di + dj * dj
          if (d < bd) { bd = d; best = [ii, jj] }
        }
      }
      if (best) return best
    }
    return [i, j]
  }

  // 두 점 사이를 일직선으로 갈 수 있는지 (조금 좁은 여유로 검사해 곧게 펴기)
  function lineFree(ax, az, bx, bz) {
    const n = Math.ceil(Math.hypot(bx - ax, bz - az) / (CELL * 0.5))
    for (let k = 0; k <= n; k++) {
      const t = k / (n || 1)
      if (!freeAt(ax + (bx - ax) * t, az + (bz - az) * t, BODY * 0.85)) return false
    }
    return true
  }

  // A* (8방향). 반환: [[x, z], ...] — 마지막은 정확한 목표점
  function path(from, to) {
    const [si, sj] = nearestFree(...cellOf(from[0], from[1]))
    const [gi, gj] = nearestFree(...cellOf(to[0], to[1]))
    const start = sj * W + si, goal = gj * W + gi
    const g = new Float32Array(W * H).fill(Infinity)
    const prev = new Int32Array(W * H).fill(-1)
    const closed = new Uint8Array(W * H)
    const open = [start]
    g[start] = 0
    const h = (k) => {
      const di = Math.abs((k % W) - gi), dj = Math.abs(Math.floor(k / W) - gj)
      return Math.max(di, dj) + 0.414 * Math.min(di, dj)
    }
    const fOf = (k) => g[k] + h(k)
    while (open.length) {
      let bi = 0
      for (let k = 1; k < open.length; k++) if (fOf(open[k]) < fOf(open[bi])) bi = k
      const cur = open[bi]
      open[bi] = open[open.length - 1]
      open.pop()
      if (cur === goal) break
      if (closed[cur]) continue
      closed[cur] = 1
      const ci = cur % W, cj = Math.floor(cur / W)
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue
          const ni = ci + di, nj = cj + dj
          if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue
          const nk = nj * W + ni
          if (blocked[nk] || closed[nk]) continue
          if (di && dj && (blocked[cj * W + ni] || blocked[nj * W + ci])) continue // 모서리 끼어가기 금지
          const ng = g[cur] + (di && dj ? 1.414 : 1)
          if (ng < g[nk]) { g[nk] = ng; prev[nk] = cur; open.push(nk) }
        }
      }
    }
    // 격자 경로 복원
    const cells = []
    for (let k = goal; k !== -1; k = prev[k]) {
      cells.unshift(center(k % W, Math.floor(k / W)))
      if (k === start) break
    }
    if (cells.length === 0 || prev[goal] === -1 && goal !== start) return [to] // 길이 없으면 곧장
    // 곧게 펴기: 일직선으로 갈 수 있는 가장 먼 점까지 건너뛰기
    const pts = [from, ...cells, to]
    const out = []
    let a = 0
    while (a < pts.length - 1) {
      let b = pts.length - 1
      while (b > a + 1 && !lineFree(pts[a][0], pts[a][1], pts[b][0], pts[b][1])) b--
      out.push(pts[b])
      a = b
    }
    return out
  }

  // 점이 장비 영역 안에 들어가 있는지 (몸 반지름 pad만큼 포함)
  function insideObstacle(x, z, pad = 0) {
    return obstacles.find(({ r }) => x > r[0] - pad && x < r[2] + pad && z > r[1] - pad && z < r[3] + pad) || null
  }

  return { path, insideObstacle, obstacles }
}
