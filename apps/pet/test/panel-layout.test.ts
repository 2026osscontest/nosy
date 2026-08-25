// 창을 어느 쪽으로 펼칠지와 그때의 창 사각형.
//
// 창 높이를 콘텐츠보다 크게 잡으면 그 여유분이 곧 드래그 상한선이 된다 — 펫은 창 하단에
// 붙어 있고, macOS는 창 상단을 작업 영역 위로 올려주지 않는다. 그래서 창은 renderer가 잰
// 콘텐츠 높이에 딱 맞춘다. 위로 펼칠 자리가 없으면 아래로 펼치고 펫을 창 위쪽에 붙인다.
//
// 어느 방향으로 펼치든 펫의 화면상 위치는 변하지 않아야 한다. 사용자가 끌어다 놓은 자리다.

import { describe, expect, it } from 'vitest'
import { INITIAL_HEIGHT, nextBounds, petScreenY } from '../main/panel-layout'
import type { Rect } from '../main/panel-layout'

/** 넉넉한 화면. 위아래 어느 쪽으로도 펼칠 수 있다. */
const ROOMY: Rect = { x: 0, y: 25, width: 1440, height: 875 }

/** 말풍선 하나 정도. */
const BUBBLE_HEIGHT = 220
/** 상세 패널까지. */
const PANEL_HEIGHT = 560

/** 펫만 떠 있는 창. 기본 배치는 펫이 창 하단에 붙는 'above'다. */
function petOnly(y: number): Rect {
  return { x: 500, y, width: 380, height: INITIAL_HEIGHT }
}

describe('INITIAL_HEIGHT', () => {
  // 이 값이 펫보다 크면 그 차이가 그대로 드래그 상한선이 된다.
  it('펫 하나 크기다', () => {
    expect(INITIAL_HEIGHT).toBeLessThanOrEqual(100)
  })
})

describe('nextBounds', () => {
  describe('위쪽에 자리가 있을 때', () => {
    it('위로 펼치고 펫을 창 하단에 그대로 둔다', () => {
      const current = petOnly(600)
      const before = petScreenY(current, 'above')

      const next = nextBounds(current, 'above', PANEL_HEIGHT, ROOMY)

      expect(next.placement).toBe('above')
      expect(next.bounds.height).toBe(PANEL_HEIGHT)
      expect(petScreenY(next.bounds, next.placement)).toBe(before)
    })

    it('말풍선만 한 높이도 같은 방식으로 잡는다', () => {
      const current = petOnly(600)
      const before = petScreenY(current, 'above')

      const next = nextBounds(current, 'above', BUBBLE_HEIGHT, ROOMY)

      expect(next.bounds.height).toBe(BUBBLE_HEIGHT)
      expect(petScreenY(next.bounds, next.placement)).toBe(before)
    })
  })

  describe('위쪽에 자리가 없을 때', () => {
    // 펫을 화면 꼭대기 근처로 끌어 놓은 경우. 위로 펼치면 화면 밖으로 나간다.
    it('아래로 펼친다', () => {
      const next = nextBounds(petOnly(30), 'above', PANEL_HEIGHT, ROOMY)

      expect(next.placement).toBe('below')
      expect(next.bounds.height).toBe(PANEL_HEIGHT)
    })

    // 말풍선도 같아야 한다. 말풍선만 위로 고집하면 경고가 뜨는 순간 화면 밖으로 나간다.
    it('말풍선도 아래로 펼친다', () => {
      const next = nextBounds(petOnly(30), 'above', BUBBLE_HEIGHT, ROOMY)

      expect(next.placement).toBe('below')
    })

    it('아래로 펼쳐도 펫의 화면 위치는 그대로다', () => {
      const current = petOnly(30)
      const before = petScreenY(current, 'above')

      const next = nextBounds(current, 'above', PANEL_HEIGHT, ROOMY)

      expect(petScreenY(next.bounds, next.placement)).toBe(before)
    })

    it('창이 작업 영역 위로 삐져나가지 않는다', () => {
      const next = nextBounds(petOnly(30), 'above', PANEL_HEIGHT, ROOMY)

      expect(next.bounds.y).toBeGreaterThanOrEqual(ROOMY.y)
    })
  })

  describe('접을 때', () => {
    it('펫 크기로 돌아가고 펫은 제자리다', () => {
      const opened = nextBounds(petOnly(600), 'above', PANEL_HEIGHT, ROOMY)
      const before = petScreenY(opened.bounds, opened.placement)

      const next = nextBounds(opened.bounds, opened.placement, INITIAL_HEIGHT, ROOMY)

      expect(next.bounds.height).toBe(INITIAL_HEIGHT)
      expect(petScreenY(next.bounds, next.placement)).toBe(before)
    })

    // 아래로 펼쳤다 접는 경로. 이때 펫은 창 위쪽에 붙어 있다.
    it('아래로 펼쳤던 창을 접어도 펫은 제자리다', () => {
      const opened = nextBounds(petOnly(30), 'above', PANEL_HEIGHT, ROOMY)
      expect(opened.placement).toBe('below')
      const before = petScreenY(opened.bounds, opened.placement)

      const next = nextBounds(opened.bounds, opened.placement, INITIAL_HEIGHT, ROOMY)

      expect(petScreenY(next.bounds, next.placement)).toBe(before)
    })

    it('펼치고 접기를 반복해도 펫이 밀려나지 않는다', () => {
      let rect = petOnly(600)
      let place: 'above' | 'below' = 'above'
      const origin = petScreenY(rect, place)

      for (let i = 0; i < 5; i += 1) {
        const opened = nextBounds(rect, place, PANEL_HEIGHT, ROOMY)
        rect = opened.bounds
        place = opened.placement

        const shut = nextBounds(rect, place, INITIAL_HEIGHT, ROOMY)
        rect = shut.bounds
        place = shut.placement
      }

      expect(petScreenY(rect, place)).toBe(origin)
    })
  })

  // BrowserWindow.setBounds에 소수를 넘기면 main 프로세스가 통째로 죽는다.
  // 콘텐츠 높이는 renderer가 재서 보내므로 소수로 올 수 있다.
  it('좌표와 크기를 정수로 준다', () => {
    const next = nextBounds(
      { x: 500, y: 401, width: 380, height: INITIAL_HEIGHT },
      'above',
      220.5,
      ROOMY
    )

    for (const value of Object.values(next.bounds)) {
      expect(Number.isInteger(value)).toBe(true)
    }
  })

  it('가로 위치와 너비는 건드리지 않는다', () => {
    const current = petOnly(600)

    const next = nextBounds(current, 'above', PANEL_HEIGHT, ROOMY)

    expect(next.bounds.x).toBe(current.x)
    expect(next.bounds.width).toBe(current.width)
  })
})
