// 창 높이를 콘텐츠에 맞추는 계산.
//
// macOS는 보이는 창의 top을 작업 영역 아래로 강제한다(실측: 요청 y와 무관하게 workArea.y).
// 원하는 높이를 그대로 잡으면 위로 올릴 자리가 모자란 창을 OS가 아래로 밀어내고, 펫은 창
// 하단에 붙어 있으므로 화면에서 그만큼 점프한다. 그래서 위로 쓸 수 있는 만큼만 잡는다.

import { describe, expect, it } from 'vitest'
import { INITIAL_HEIGHT, clipOf, fitBounds } from '../main/panel-layout'
import type { Rect } from '../main/panel-layout'

/** 메뉴바 아래로 시작하는 작업 영역. */
const WORK_AREA: Rect = { x: 0, y: 30, width: 1440, height: 870 }

const PANEL_HEIGHT = 560

/** 펫만 떠 있는 창. */
function petOnly(y: number): Rect {
  return { x: 500, y, width: 380, height: INITIAL_HEIGHT }
}

/** 창 아래쪽 변 — 펫이 붙어 있는 쪽이다. 이 값이 곧 펫의 화면 위치를 결정한다. */
const bottomOf = (rect: Rect): number => rect.y + rect.height

describe('INITIAL_HEIGHT', () => {
  // 이 값이 펫보다 크면 그 차이가 그대로 드래그 상한선이 된다.
  it('펫 하나 크기다', () => {
    expect(INITIAL_HEIGHT).toBeLessThanOrEqual(100)
  })
})

describe('fitBounds', () => {
  describe('위쪽에 자리가 있을 때', () => {
    it('원하는 높이를 그대로 잡는다', () => {
      expect(fitBounds(petOnly(600), PANEL_HEIGHT, WORK_AREA).height).toBe(PANEL_HEIGHT)
    })

    // 펫은 창 하단에 붙어 있다. 아래쪽 변이 그대로면 펫도 그대로다.
    it('창 아래쪽 변을 고정한 채 위로만 늘린다', () => {
      const current = petOnly(600)

      const next = fitBounds(current, PANEL_HEIGHT, WORK_AREA)

      expect(bottomOf(next)).toBe(bottomOf(current))
    })

    it('접을 때도 아래쪽 변이 그대로다', () => {
      const opened = fitBounds(petOnly(600), PANEL_HEIGHT, WORK_AREA)

      const shut = fitBounds(opened, INITIAL_HEIGHT, WORK_AREA)

      expect(shut.height).toBe(INITIAL_HEIGHT)
      expect(bottomOf(shut)).toBe(bottomOf(opened))
    })

    it('펼치고 접기를 반복해도 펫이 밀려나지 않는다', () => {
      let rect = petOnly(600)
      const origin = bottomOf(rect)

      for (let i = 0; i < 5; i += 1) {
        rect = fitBounds(rect, PANEL_HEIGHT, WORK_AREA)
        rect = fitBounds(rect, INITIAL_HEIGHT, WORK_AREA)
      }

      expect(bottomOf(rect)).toBe(origin)
    })
  })

  describe('위쪽에 자리가 없을 때', () => {
    // 펫을 화면 꼭대기 근처로 끌어 놓은 경우.
    const nearTop = petOnly(WORK_AREA.y)

    it('작업 영역 위로 넘치게 잡지 않는다', () => {
      const next = fitBounds(nearTop, PANEL_HEIGHT, WORK_AREA)

      expect(next.y).toBeGreaterThanOrEqual(WORK_AREA.y)
      expect(next.height).toBeLessThan(PANEL_HEIGHT)
    })

    // 이것이 이 함수의 존재 이유다. 원하는 높이를 그대로 잡으면 OS가 창을 아래로 밀어낸다.
    it('그래도 펫은 제자리다', () => {
      const next = fitBounds(nearTop, PANEL_HEIGHT, WORK_AREA)

      expect(bottomOf(next)).toBe(bottomOf(nearTop))
    })

    it('잘린 높이를 돌려주어 호출자가 잘림을 알 수 있다', () => {
      const next = fitBounds(nearTop, PANEL_HEIGHT, WORK_AREA)

      expect(next.height).toBe(INITIAL_HEIGHT)
    })
  })

  // 펫을 화면 아래로 끌어 내보내는 것은 막지 않는다. 그 상태에서도 계산이 무너지면 안 된다.
  it('창이 작업 영역 아래로 나가 있어도 원하는 높이를 잡는다', () => {
    const belowScreen = petOnly(WORK_AREA.y + WORK_AREA.height + 200)

    const next = fitBounds(belowScreen, PANEL_HEIGHT, WORK_AREA)

    expect(next.height).toBe(PANEL_HEIGHT)
    expect(bottomOf(next)).toBe(bottomOf(belowScreen))
  })

  it('펫 하나보다 작게 잡지 않는다', () => {
    expect(fitBounds(petOnly(600), 10, WORK_AREA).height).toBe(INITIAL_HEIGHT)
  })

  // BrowserWindow.setBounds에 소수를 넘기면 main 프로세스가 통째로 죽는다.
  // 콘텐츠 높이는 renderer가 재서 보내므로 소수로 올 수 있다.
  it('좌표와 크기를 정수로 준다', () => {
    const next = fitBounds({ x: 500, y: 601, width: 380, height: INITIAL_HEIGHT }, 220.5, WORK_AREA)

    for (const value of Object.values(next.bounds ?? next)) {
      expect(Number.isInteger(value)).toBe(true)
    }
  })

  it('가로 위치와 너비는 건드리지 않는다', () => {
    const current = petOnly(600)

    const next = fitBounds(current, PANEL_HEIGHT, WORK_AREA)

    expect(next.x).toBe(current.x)
    expect(next.width).toBe(current.width)
  })
})

// 잘린 방향을 알려야 "끌어오면 다 보인다"는 힌트를 띄울 수 있다.
describe('clipOf', () => {
  const PANEL_WIDTH = 308
  const WINDOW_WIDTH = 380
  const RIGHT_EDGE = WORK_AREA.x + WORK_AREA.width

  /** 콘텐츠가 가운데 오도록 창 x를 역산한다. */
  function windowFor(contentLeft: number): Rect {
    return {
      x: contentLeft - (WINDOW_WIDTH - PANEL_WIDTH) / 2,
      y: 600,
      width: WINDOW_WIDTH,
      height: PANEL_HEIGHT
    }
  }

  it('화면 안에 다 들어오면 아무 데도 잘리지 않았다고 본다', () => {
    const clip = clipOf(windowFor(500), PANEL_WIDTH, PANEL_HEIGHT, WORK_AREA)

    expect(clip).toEqual({ top: false, left: false, right: false })
  })

  it('창이 원하는 높이보다 낮으면 위가 잘린 것이다', () => {
    const rect = { ...windowFor(500), height: INITIAL_HEIGHT }

    expect(clipOf(rect, PANEL_WIDTH, PANEL_HEIGHT, WORK_AREA).top).toBe(true)
  })

  it('콘텐츠 왼쪽 변이 화면 밖이면 왼쪽이 잘린 것이다', () => {
    const clip = clipOf(windowFor(WORK_AREA.x - 40), PANEL_WIDTH, PANEL_HEIGHT, WORK_AREA)

    expect(clip.left).toBe(true)
    expect(clip.right).toBe(false)
  })

  it('콘텐츠 오른쪽 변이 화면 밖이면 오른쪽이 잘린 것이다', () => {
    const clip = clipOf(windowFor(RIGHT_EDGE - PANEL_WIDTH + 40), PANEL_WIDTH, PANEL_HEIGHT, WORK_AREA)

    expect(clip.right).toBe(true)
    expect(clip.left).toBe(false)
  })

  // 창에는 가장 넓은 콘텐츠에 맞춘 여백이 있다. 창이 조금 나갔다고 콘텐츠가 잘리지는 않는다.
  it('창은 나갔지만 콘텐츠는 안에 있으면 잘리지 않았다고 본다', () => {
    const rect = { ...windowFor(WORK_AREA.x + 4), height: PANEL_HEIGHT }
    expect(rect.x).toBeLessThan(WORK_AREA.x)

    expect(clipOf(rect, PANEL_WIDTH, PANEL_HEIGHT, WORK_AREA).left).toBe(false)
  })

  it('여러 방향이 동시에 잘릴 수 있다', () => {
    const rect = { ...windowFor(WORK_AREA.x - 40), height: INITIAL_HEIGHT }

    expect(clipOf(rect, PANEL_WIDTH, PANEL_HEIGHT, WORK_AREA)).toEqual({
      top: true,
      left: true,
      right: false
    })
  })
})
