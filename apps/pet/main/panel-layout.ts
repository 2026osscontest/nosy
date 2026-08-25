// 상세 패널을 펼칠 방향과 그때의 창 사각형. Electron을 import하지 않는 순수 계산이다.
//
// 창을 크게 잡아 두고 펫을 그 하단에 붙이면, 펫 위쪽 빈 영역이 화면 천장에 걸리는 순간
// 펫이 더 올라가지 못한다 — macOS는 창 상단을 작업 영역 위로 올려주지 않는다. 창을 560px로
// 키웠더니 실제로 펫이 화면 중간에서 멈췄다.
//
// 그래서 창은 평소 작게 두고 패널을 열 때만 늘린다. 위로 늘릴 자리가 없으면 아래로 늘리고
// 펫을 창 위쪽에 붙인다. 어느 방향이든 펫의 화면상 위치는 변하지 않아야 한다 — 사용자가
// 끌어다 놓은 자리다.

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** 'above': 패널이 펫 위, 펫은 창 하단. 'below': 패널이 펫 아래, 펫은 창 상단. */
export type Placement = 'above' | 'below'

/** 펫만(말풍선까지) 담는 높이. */
export const CLOSED_HEIGHT = 300
/** 상세 패널까지 담는 높이. renderer의 .panel-list max-height와 맞물린다. */
export const OPEN_HEIGHT = 560

// renderer의 .pet-interactive 여백, PetView의 22×18 스프라이트 × SCALE 4.
const PET_MARGIN_PX = 8
const PET_HEIGHT_PX = 72

/** 창 안에서 펫 이미지의 top 오프셋. */
function petOffset(placement: Placement, height: number): number {
  return placement === 'above' ? height - PET_MARGIN_PX - PET_HEIGHT_PX : PET_MARGIN_PX
}

/** 펫 이미지의 화면상 top 좌표. 창을 어떻게 늘리든 이 값이 유지되어야 한다. */
export function petScreenY(bounds: Rect, placement: Placement): number {
  return bounds.y + petOffset(placement, bounds.height)
}

/**
 * 패널을 열거나 닫을 때의 새 창 사각형과 펼침 방향.
 * `workArea`는 메뉴바·Dock을 제외한 화면 영역이다.
 */
export function nextBounds(
  current: Rect,
  placement: Placement,
  open: boolean,
  workArea: Rect
): { bounds: Rect; placement: Placement } {
  const petY = petScreenY(current, placement)
  const height = open ? OPEN_HEIGHT : CLOSED_HEIGHT

  // 위로 펼쳤을 때의 창 상단. 작업 영역을 벗어나면 아래로 펼친다.
  const topIfAbove = petY - (height - PET_MARGIN_PX - PET_HEIGHT_PX)
  const next: Placement = topIfAbove >= workArea.y ? 'above' : 'below'

  return {
    bounds: {
      x: current.x,
      y: Math.round(next === 'above' ? topIfAbove : petY - PET_MARGIN_PX),
      width: current.width,
      height
    },
    placement: next
  }
}
