// 창 높이를 콘텐츠에 맞추는 계산. Electron을 import하지 않는 순수 함수다.
//
// macOS는 **보이는** 창의 top을 작업 영역 아래로 강제한다. 실측 결과 요청한 y가 무엇이든
// (-100, -20, 0, 20 전부) 실제 y는 workArea.y로 고정됐다. show() 전에는 제약이 없어서
// setBounds만 시험해 보면 제약이 없는 것처럼 보이므로 속기 쉽다.
//
// 그래서 원하는 높이를 그대로 잡으면 안 된다. 위로 올릴 자리가 모자란 창은 OS가 아래로
// 밀어내고, 펫은 창 하단에 붙어 있으므로 화면에서 그만큼 점프한다. 대신 위로 쓸 수 있는
// 만큼만 잡고 나머지는 잘린 채로 둔다 — 잘렸다는 사실은 renderer가 힌트로 알린다.
//
// 창을 콘텐츠보다 크게 잡지 않는 것이 핵심이다. 여유분은 그대로 드래그 상한선이 된다.

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

// renderer의 .pet-interactive 여백, PetView의 22×18 스프라이트 × SCALE 4.
const PET_MARGIN_PX = 8
const PET_HEIGHT_PX = 72

/** 펫 하나만 담는 창 높이. 콘텐츠를 재기 전 초기값이자 창의 하한이다. */
export const INITIAL_HEIGHT = PET_MARGIN_PX * 2 + PET_HEIGHT_PX

/**
 * 창을 `desired` 높이로 잡는다. 펫은 늘 창 하단에 붙어 있으므로 창 아래쪽 변을 고정한 채
 * 위로만 늘린다 — 그래야 펫의 화면상 위치가 변하지 않는다.
 *
 * 작업 영역 위로 넘칠 만큼은 늘리지 않는다. 넘기면 OS가 창을 도로 아래로 밀어 펫이 점프한다.
 * 그 경우 콘텐츠 위쪽이 잘리며, 호출자는 반환된 height가 desired보다 작은 것으로 알 수 있다.
 */
export function fitBounds(current: Rect, desired: number, workArea: Rect): Rect {
  const bottom = current.y + current.height
  const available = bottom - workArea.y
  const height = Math.max(INITIAL_HEIGHT, Math.min(Math.round(desired), available))

  return { x: current.x, y: Math.round(bottom - height), width: current.width, height }
}

/** 콘텐츠가 작업 영역 밖으로 잘려 나간 방향. */
export interface ClipState {
  top: boolean
  left: boolean
  right: boolean
}

/**
 * 지금 콘텐츠가 어느 쪽으로 잘렸는지.
 *
 * 아래쪽은 보지 않는다 — 펫이 화면 아래로 나가면 힌트도 함께 나가 보여줄 수가 없다.
 * 그쪽 복구 수단은 Tray의 "펫 데려오기"다.
 *
 * 콘텐츠는 창 가로 가운데에 놓이므로 창이 아니라 콘텐츠의 좌우 변으로 판정한다. 창에는
 * 가장 넓은 콘텐츠(상세 패널)에 맞춘 여백이 있어서, 창이 조금 나갔다고 콘텐츠가 잘리지는 않는다.
 */
export function clipOf(
  bounds: Rect,
  contentWidth: number,
  desiredHeight: number,
  workArea: Rect
): ClipState {
  const contentLeft = bounds.x + (bounds.width - contentWidth) / 2

  return {
    top: bounds.height < desiredHeight,
    left: contentLeft < workArea.x,
    right: contentLeft + contentWidth > workArea.x + workArea.width
  }
}
