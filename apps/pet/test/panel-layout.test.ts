// 상세 패널을 펼칠 방향과 그때의 창 사각형.
//
// 창을 크게 잡아 두고 펫을 그 하단에 붙이면, 펫 위쪽 빈 영역이 화면 천장에 걸리는 순간
// 펫이 더 올라가지 못한다 — macOS는 창 상단을 작업 영역 위로 올려주지 않는다. 그래서 창은
// 평소 작게 두고 패널을 열 때만 늘리되, 위로 늘릴 자리가 없으면 아래로 늘리고 펫을 창
// 위쪽에 붙인다.
//
// 어느 방향으로 늘리든 펫의 화면상 위치는 변하지 않아야 한다. 사용자가 끌어다 놓은 자리다.

import { describe, expect, it } from 'vitest'
import { CLOSED_HEIGHT, OPEN_HEIGHT, nextBounds, petScreenY } from '../main/panel-layout'
import type { Rect } from '../main/panel-layout'

/** 넉넉한 화면. 위아래 어느 쪽으로도 펼칠 수 있다. */
const ROOMY: Rect = { x: 0, y: 25, width: 1440, height: 875 }

/** 닫힌 창 하나. 기본 배치는 펫이 창 하단에 붙는 'above'다. */
function closed(y: number): Rect {
  return { x: 500, y, width: 380, height: CLOSED_HEIGHT }
}

describe('nextBounds', () => {
  describe('위쪽에 자리가 있을 때', () => {
    it('위로 펼치고 펫을 창 하단에 그대로 둔다', () => {
      const current = closed(400)
      const before = petScreenY(current, 'above')

      const next = nextBounds(current, 'above', true, ROOMY)

      expect(next.placement).toBe('above')
      expect(next.bounds.height).toBe(OPEN_HEIGHT)
      expect(petScreenY(next.bounds, next.placement)).toBe(before)
    })
  })

  describe('위쪽에 자리가 없을 때', () => {
    // 펫을 화면 꼭대기 근처로 끌어 놓은 경우. 위로 펼치면 패널이 화면 밖으로 나간다.
    it('아래로 펼친다', () => {
      const next = nextBounds(closed(30), 'above', true, ROOMY)

      expect(next.placement).toBe('below')
      expect(next.bounds.height).toBe(OPEN_HEIGHT)
    })

    it('아래로 펼쳐도 펫의 화면 위치는 그대로다', () => {
      const current = closed(30)
      const before = petScreenY(current, 'above')

      const next = nextBounds(current, 'above', true, ROOMY)

      expect(petScreenY(next.bounds, next.placement)).toBe(before)
    })

    it('창이 작업 영역 위로 삐져나가지 않는다', () => {
      const next = nextBounds(closed(30), 'above', true, ROOMY)

      expect(next.bounds.y).toBeGreaterThanOrEqual(ROOMY.y)
    })
  })

  describe('닫을 때', () => {
    it('원래 높이로 돌아가고 펫은 제자리다', () => {
      const opened = nextBounds(closed(400), 'above', true, ROOMY)
      const before = petScreenY(opened.bounds, opened.placement)

      const next = nextBounds(opened.bounds, opened.placement, false, ROOMY)

      expect(next.bounds.height).toBe(CLOSED_HEIGHT)
      expect(petScreenY(next.bounds, next.placement)).toBe(before)
    })

    // 아래로 펼쳤다 닫는 경로. 이때 펫은 창 위쪽에 붙어 있다.
    it('아래로 펼쳤던 창을 닫아도 펫은 제자리다', () => {
      const opened = nextBounds(closed(30), 'above', true, ROOMY)
      expect(opened.placement).toBe('below')
      const before = petScreenY(opened.bounds, opened.placement)

      const next = nextBounds(opened.bounds, opened.placement, false, ROOMY)

      expect(next.bounds.height).toBe(CLOSED_HEIGHT)
      expect(petScreenY(next.bounds, next.placement)).toBe(before)
    })

    it('열고 닫기를 반복해도 펫이 밀려나지 않는다', () => {
      let rect = closed(400)
      let place: 'above' | 'below' = 'above'
      const origin = petScreenY(rect, place)

      for (let i = 0; i < 5; i += 1) {
        const opened = nextBounds(rect, place, true, ROOMY)
        rect = opened.bounds
        place = opened.placement

        const shut = nextBounds(rect, place, false, ROOMY)
        rect = shut.bounds
        place = shut.placement
      }

      expect(petScreenY(rect, place)).toBe(origin)
    })
  })

  // BrowserWindow.setBounds에 소수를 넘기면 main 프로세스가 통째로 죽는다.
  it('좌표와 크기를 정수로 준다', () => {
    const next = nextBounds({ x: 500, y: 401, width: 380, height: CLOSED_HEIGHT }, 'above', true, ROOMY)

    for (const value of Object.values(next.bounds)) {
      expect(Number.isInteger(value)).toBe(true)
    }
  })

  it('가로 위치와 너비는 건드리지 않는다', () => {
    const current = closed(400)

    const next = nextBounds(current, 'above', true, ROOMY)

    expect(next.bounds.x).toBe(current.x)
    expect(next.bounds.width).toBe(current.width)
  })
})
