// 창을 어느 쪽으로 펼칠지와 그때의 창 사각형. Electron을 import하지 않는 순수 계산이다.
//
// 창 높이를 콘텐츠보다 크게 잡으면 그 여유분이 곧 드래그 상한선이 된다.
//
// macOS는 **보이는** 창의 top을 작업 영역 아래로 강제한다. 실측 결과 요청한 y가 무엇이든
// (-100, -20, 0, 20 전부) 실제 y는 workArea.y로 고정됐다. show() 전에는 제약이 없어서
// setBounds만 시험해 보면 제약이 없는 것처럼 보이므로 속기 쉽다.
//
// 펫은 창 하단에 붙어 있으므로, 창이 높을수록 펫의 상한이 그만큼 내려간다. 창을 560으로
// 잡았을 때는 화면 중간에서, 말풍선 자리만 남긴 300일 때도 220px 위에서 멈췄다.
//
// 그래서 높이를 상수로 두지 않는다. renderer가 실제 콘텐츠 높이를 재서 보내고 창은 딱 그만큼만
// 잡는다. 펫만 떠 있으면 창도 펫 크기라 상한선이 사라진다.
//
// 위로 펼칠 자리가 없으면 아래로 펼치고 펫을 창 위쪽에 붙인다. 어느 방향이든 펫의 화면상
// 위치는 변하지 않아야 한다 — 사용자가 끌어다 놓은 자리다.

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** 'above': 말풍선·패널이 펫 위, 펫은 창 하단. 'below': 펫이 창 상단, 나머지가 그 아래. */
export type Placement = 'above' | 'below'

// renderer의 .pet-interactive 여백, PetView의 22×18 스프라이트 × SCALE 4.
const PET_MARGIN_PX = 8
const PET_HEIGHT_PX = 72

/** renderer가 콘텐츠를 재서 보내주기 전까지 쓸 창 높이 — 펫 하나 크기다. */
export const INITIAL_HEIGHT = PET_MARGIN_PX * 2 + PET_HEIGHT_PX

/** 창 안에서 펫 이미지의 top 오프셋. */
function petOffset(placement: Placement, height: number): number {
  return placement === 'above' ? height - PET_MARGIN_PX - PET_HEIGHT_PX : PET_MARGIN_PX
}

/** 펫 이미지의 화면상 top 좌표. 창을 어떻게 늘리든 이 값이 유지되어야 한다. */
export function petScreenY(bounds: Rect, placement: Placement): number {
  return bounds.y + petOffset(placement, bounds.height)
}

/**
 * 창을 작업 영역 안에 가둔 세로 위치.
 *
 * 위쪽은 macOS가 알아서 막지만 아래쪽은 막지 않아, 펫을 아래로 끌면 화면 밖으로 나가
 * 사라진다. 한쪽만 막히면 드래그가 비대칭으로 느껴지고 펫을 잃어버릴 수도 있다.
 *
 * 창이 작업 영역보다 높으면(패널을 펼친 상태) 가둘 수 없으므로 위에 붙인다.
 */
export function clampY(bounds: Rect, workArea: Rect): number {
  const lowest = workArea.y + workArea.height - bounds.height

  return Math.round(Math.min(Math.max(bounds.y, workArea.y), Math.max(workArea.y, lowest)))
}

/**
 * 창 높이를 `height`로 바꿀 때의 새 사각형과 펼침 방향.
 * `workArea`는 메뉴바·Dock을 제외한 화면 영역이다.
 */
export function nextBounds(
  current: Rect,
  placement: Placement,
  height: number,
  workArea: Rect
): { bounds: Rect; placement: Placement } {
  const petY = petScreenY(current, placement)

  // 위로 펼쳤을 때의 창 상단. 작업 영역을 벗어나면 아래로 펼친다.
  const topIfAbove = petY - (height - PET_MARGIN_PX - PET_HEIGHT_PX)
  const next: Placement = topIfAbove >= workArea.y ? 'above' : 'below'

  return {
    bounds: {
      x: current.x,
      y: Math.round(next === 'above' ? topIfAbove : petY - PET_MARGIN_PX),
      width: current.width,
      height: Math.round(height)
    },
    placement: next
  }
}
