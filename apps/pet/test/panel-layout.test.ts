// 창을 어디에 얼마나 크게 놓을지 계산한다.
//
// 규칙은 하나다 — 지금 그려진 것 전체가 항상 화면 안에 있는다. 창이 곧 콘텐츠이므로
// "창을 작업 영역 안으로 민다"가 그 규칙이고, 밀린 만큼 펫이 자기 자리(home)를 떠난다.
//
// macOS는 보이는 창의 top을 작업 영역 아래로 강제한다(실측: 요청 y와 무관하게 workArea.y).
// 그래서 창을 작업 영역 위로 넘치게 잡는 선택지는 애초에 없다 — 잡아 봐야 OS가 아래로
// 밀어내고 펫만 점프한다.

import { describe, expect, it } from 'vitest'
import { INITIAL_HEIGHT, INITIAL_WIDTH, petOrigin, placeBounds } from '../main/panel-layout'
import type { Point, Rect, Size } from '../main/panel-layout'

/** 메뉴바 아래로 시작하는 작업 영역. */
const WORK_AREA: Rect = { x: 0, y: 30, width: 1440, height: 870 }

const RIGHT_EDGE = WORK_AREA.x + WORK_AREA.width
const BOTTOM_EDGE = WORK_AREA.y + WORK_AREA.height

/** 펫만 떠 있을 때의 콘텐츠. */
const PET_ONLY: Size = { width: INITIAL_WIDTH, height: INITIAL_HEIGHT }
/** 상세 패널(308×560)에 여백 8px씩을 두른 크기. */
const PANEL: Size = { width: 324, height: 576 }

/** 사방에 여유가 있는 자리. */
const MIDDLE: Point = { x: 600, y: 600 }

describe('INITIAL_WIDTH / INITIAL_HEIGHT', () => {
  // 이보다 크면 그 여유분이 화면 가장자리에 먼저 닿아 펫이 끝까지 가지 못한다.
  it('펫 하나 크기다', () => {
    expect(INITIAL_WIDTH).toBeLessThanOrEqual(120)
    expect(INITIAL_HEIGHT).toBeLessThanOrEqual(100)
  })
})

describe('placeBounds', () => {
  describe('사방에 자리가 있을 때', () => {
    it('펫을 자기 자리에 놓는다', () => {
      expect(petOrigin(placeBounds(MIDDLE, PET_ONLY, WORK_AREA))).toEqual(MIDDLE)
    })

    // 패널은 펫 위로 펼쳐진다. 펫이 따라 움직이면 방금 누른 자리가 어긋난다.
    it('패널을 펼쳐도 펫은 제자리다', () => {
      expect(petOrigin(placeBounds(MIDDLE, PANEL, WORK_AREA))).toEqual(MIDDLE)
    })

    it('창 크기는 콘텐츠 크기 그대로다', () => {
      const bounds = placeBounds(MIDDLE, PANEL, WORK_AREA)

      expect(bounds.width).toBe(PANEL.width)
      expect(bounds.height).toBe(PANEL.height)
    })
  })

  // 여기가 이 함수의 존재 이유다. 잘라서 보여주지 않고 창을 통째로 안으로 민다.
  describe('콘텐츠가 화면 밖으로 나갈 자리면', () => {
    /** 위쪽에 패널을 펼칠 자리가 없는 곳. */
    const NEAR_TOP: Point = { x: 600, y: WORK_AREA.y + 20 }
    /** 왼쪽으로 패널이 넘치는 곳. */
    const NEAR_LEFT: Point = { x: WORK_AREA.x, y: 600 }
    /** 오른쪽으로 패널이 넘치는 곳. */
    const NEAR_RIGHT: Point = { x: RIGHT_EDGE - 88, y: 600 }

    it('창을 아래로 밀어 패널을 다 보여준다', () => {
      const bounds = placeBounds(NEAR_TOP, PANEL, WORK_AREA)

      expect(bounds.y).toBe(WORK_AREA.y)
      expect(bounds.height).toBe(PANEL.height)
    })

    it('그만큼 펫이 자기 자리에서 밀려난다', () => {
      const moved = petOrigin(placeBounds(NEAR_TOP, PANEL, WORK_AREA))

      expect(moved.y).toBeGreaterThan(NEAR_TOP.y)
      expect(moved.x).toBe(NEAR_TOP.x)
    })

    it('왼쪽으로 넘치면 오른쪽으로 민다', () => {
      const bounds = placeBounds(NEAR_LEFT, PANEL, WORK_AREA)

      expect(bounds.x).toBe(WORK_AREA.x)
      expect(petOrigin(bounds).x).toBeGreaterThan(NEAR_LEFT.x)
    })

    it('오른쪽으로 넘치면 왼쪽으로 민다', () => {
      const bounds = placeBounds(NEAR_RIGHT, PANEL, WORK_AREA)

      expect(bounds.x + bounds.width).toBe(RIGHT_EDGE)
      expect(petOrigin(bounds).x).toBeLessThan(NEAR_RIGHT.x)
    })

    it('두 방향이 함께 모자라면 함께 민다', () => {
      const corner: Point = { x: WORK_AREA.x, y: WORK_AREA.y + 20 }

      const moved = petOrigin(placeBounds(corner, PANEL, WORK_AREA))

      expect(moved.x).toBeGreaterThan(corner.x)
      expect(moved.y).toBeGreaterThan(corner.y)
    })

    // 밀리는 것은 패널이 열려 있는 동안뿐이다. home은 그대로이므로 닫으면 돌아온다.
    it('패널을 닫으면 펫이 자기 자리로 돌아온다', () => {
      placeBounds(NEAR_TOP, PANEL, WORK_AREA)

      expect(petOrigin(placeBounds(NEAR_TOP, PET_ONLY, WORK_AREA))).toEqual(NEAR_TOP)
    })
  })

  describe('창은 언제나 작업 영역 안에 있다', () => {
    const corners: Point[] = [
      { x: -500, y: -500 },
      { x: 9999, y: -500 },
      { x: -500, y: 9999 },
      { x: 9999, y: 9999 }
    ]

    for (const content of [PET_ONLY, PANEL]) {
      for (const home of corners) {
        it(`${content.width}×${content.height} 콘텐츠를 (${home.x}, ${home.y})에 두어도`, () => {
          const bounds = placeBounds(home, content, WORK_AREA)

          expect(bounds.x).toBeGreaterThanOrEqual(WORK_AREA.x)
          expect(bounds.y).toBeGreaterThanOrEqual(WORK_AREA.y)
          expect(bounds.x + bounds.width).toBeLessThanOrEqual(RIGHT_EDGE)
          expect(bounds.y + bounds.height).toBeLessThanOrEqual(BOTTOM_EDGE)
        })
      }
    }
  })

  // 여기서만 콘텐츠가 잘린다. 끌어도 다 볼 수 없는 상황이라 따로 알리지 않는다.
  it('화면보다 큰 콘텐츠는 화면 크기로 자른다', () => {
    const tiny: Rect = { x: 0, y: 0, width: 200, height: 200 }

    const bounds = placeBounds({ x: 50, y: 50 }, PANEL, tiny)

    expect(bounds).toEqual({ x: 0, y: 0, width: 200, height: 200 })
  })

  it('펫 하나보다 작게 잡지 않는다', () => {
    const bounds = placeBounds(MIDDLE, { width: 10, height: 10 }, WORK_AREA)

    expect(bounds.width).toBe(INITIAL_WIDTH)
    expect(bounds.height).toBe(INITIAL_HEIGHT)
  })

  // BrowserWindow.setBounds에 소수를 넘기면 main 프로세스가 통째로 죽는다.
  // 콘텐츠 크기는 renderer가 재서 보내므로 소수로 올 수 있다.
  it('좌표와 크기를 정수로 준다', () => {
    const bounds = placeBounds({ x: 600.5, y: 600.5 }, { width: 323.5, height: 575.5 }, WORK_AREA)

    for (const value of Object.values(bounds)) {
      expect(Number.isInteger(value)).toBe(true)
    }
  })
})

describe('petOrigin', () => {
  it('placeBounds가 놓은 자리를 되짚는다', () => {
    for (const content of [PET_ONLY, PANEL]) {
      expect(petOrigin(placeBounds(MIDDLE, content, WORK_AREA))).toEqual(MIDDLE)
    }
  })

  // 드래그는 이 왕복을 매 이벤트마다 돈다. 여기서 1px씩 어긋나면 펫이 커서에서 멀어진다.
  it('여러 번 왕복해도 자리가 흐르지 않는다', () => {
    let home = MIDDLE

    for (let i = 0; i < 20; i += 1) {
      home = petOrigin(placeBounds(home, PANEL, WORK_AREA))
    }

    expect(home).toEqual(MIDDLE)
  })
})
