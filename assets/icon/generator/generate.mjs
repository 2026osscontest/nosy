// 앱 아이콘(macOS .icns 원본) 생성기.
//
// assets/character/frames.json의 픽셀 그리드를 정수 배율로 확대해
// macOS 스타일 squircle 배경 위에 얹는다. 스프라이트와 같은 원본에서 나오므로
// 캐릭터를 고치면 아이콘도 이 스크립트를 다시 돌리기만 하면 된다.
//
//   node assets/icon/generator/generate.mjs
//
// 출력: apps/pet/build/icon.png (1024×1024) — electron-builder가 .icns로 변환한다.

import { encodePNG } from '../../character/generator/png.mjs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '../../..')

const SIZE = 1024
const INSET = 100 // macOS 아이콘 관행: 1024 캔버스 안에 824 컨텐츠
const CONTENT = SIZE - INSET * 2
const PADDING = 80 // squircle 안쪽 여백

// 캐릭터 시그니처인 코의 코럴색을 배경으로 쓴다. 코 자체는 배경에 가까워지지만
// 외곽선(#A84B34)이 남아 형태는 유지되고, 크림 몸통이 또렷하게 뜬다.
const BG_TOP = '#E8795A'
const BG_BOTTOM = '#C85B3E'
const STATE = 'idle'
const FRAME = 0

const frames = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/character/frames.json'), 'utf8'))

function parseRGBA(s) {
  if (!s) return null
  const m = s.match(/rgba\((\d+),(\d+),(\d+),([\d.]+)\)/)
  return [+m[1], +m[2], +m[3], Math.round(+m[4] * 255)]
}

function hex(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}

// superellipse |x|^n + |y|^n = 1. n=5가 macOS squircle에 가깝다.
function squircleAlpha(x, y, c, r, n = 5) {
  const dx = Math.abs(x - c) / r
  const dy = Math.abs(y - c) / r
  const d = Math.pow(Math.pow(dx, n) + Math.pow(dy, n), 1 / n)
  const edge = 1 / r // 경계 1픽셀 안티에일리어싱
  if (d <= 1 - edge) return 255
  if (d >= 1 + edge) return 0
  return Math.round(255 * (1 - (d - (1 - edge)) / (2 * edge)))
}

function blend(dst, i, [r, g, b, a]) {
  if (a === 0) return
  const inv = (255 - a) / 255
  const f = a / 255
  dst[i] = Math.round(dst[i] * inv + r * f)
  dst[i + 1] = Math.round(dst[i + 1] * inv + g * f)
  dst[i + 2] = Math.round(dst[i + 2] * inv + b * f)
  dst[i + 3] = Math.min(255, Math.round(a + dst[i + 3] * inv))
}

const grid = frames.states[STATE][FRAME]
const px = new Uint8ClampedArray(SIZE * SIZE * 4)

const top = hex(BG_TOP)
const bottom = hex(BG_BOTTOM)
const center = SIZE / 2
const radius = CONTENT / 2

for (let y = 0; y < SIZE; y++) {
  const t = y / (SIZE - 1)
  const col = top.map((v, i) => Math.round(v + (bottom[i] - v) * t))
  for (let x = 0; x < SIZE; x++) {
    const a = squircleAlpha(x, y, center, radius)
    if (a === 0) continue
    blend(px, (y * SIZE + x) * 4, [col[0], col[1], col[2], a])
  }
}

// 그리드에는 빈 행/열이 있다(머리카락 위 여백 등). 캔버스 기준으로 정렬하면
// 캐릭터가 시각적으로 위로 뜨므로, 실제로 칠해진 픽셀의 경계 상자에 맞춘다.
let minX = grid[0].length
let maxX = -1
let minY = grid.length
let maxY = -1
for (let gy = 0; gy < grid.length; gy++) {
  for (let gx = 0; gx < grid[gy].length; gx++) {
    if (!grid[gy][gx]) continue
    if (gx < minX) minX = gx
    if (gx > maxX) maxX = gx
    if (gy < minY) minY = gy
    if (gy > maxY) maxY = gy
  }
}
const boxW = maxX - minX + 1
const boxH = maxY - minY + 1

// 픽셀 경계가 흐려지지 않도록 정수 배율만 쓴다.
const avail = CONTENT - PADDING * 2
const scale = Math.floor(Math.min(avail / boxW, avail / boxH))
const originX = Math.round((SIZE - boxW * scale) / 2) - minX * scale
const originY = Math.round((SIZE - boxH * scale) / 2) - minY * scale

for (let gy = 0; gy < grid.length; gy++) {
  for (let gx = 0; gx < grid[gy].length; gx++) {
    const color = parseRGBA(grid[gy][gx])
    if (!color) continue
    for (let dy = 0; dy < scale; dy++) {
      for (let dx = 0; dx < scale; dx++) {
        const x = originX + gx * scale + dx
        const y = originY + gy * scale + dy
        if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue
        blend(px, (y * SIZE + x) * 4, color)
      }
    }
  }
}

const out = path.join(ROOT, 'apps/pet/build/icon.png')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, encodePNG(SIZE, SIZE, px))
console.log(`wrote ${path.relative(ROOT, out)} (${SIZE}×${SIZE}, ×${scale})`)
