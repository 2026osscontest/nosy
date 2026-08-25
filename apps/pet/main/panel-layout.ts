// 창을 어디에 얼마나 크게 놓을지 계산한다. Electron을 import하지 않는 순수 함수다.
//
// 규칙은 하나다 — **지금 그려진 것 전체가 항상 화면 안에 있는다.** 펫만 떠 있으면 펫이,
// 패널이 열리면 펫과 패널이 함께. 창은 콘텐츠와 같은 크기이므로 "창을 작업 영역 안으로
// 민다"가 곧 그 규칙이다 (docs/specs/pet-window-spec.md FR-012).
//
// 펫은 자기 자리(home)를 갖는다. 드래그로만 바뀌고, 패널을 열고 닫는 것으로는 바뀌지 않는다.
// 패널이 화면 밖으로 나갈 자리면 창이 통째로 밀리면서 펫도 home을 떠나지만, 패널을 닫으면
// 창이 작아져 다시 home에 놓인다.
//
// 잘라내는 것은 화면 자체가 콘텐츠보다 작을 때뿐이다. 그때는 끌어도 다 볼 수 없으므로
// 따로 알리지 않는다 — 끌어오라고 안내해 봐야 거짓말이 된다.

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** 펫 스프라이트의 좌상단 화면 좌표. */
export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

// renderer의 .pet-interactive 여백, PetView의 22×18 스프라이트 × SCALE 4.
const PET_MARGIN_PX = 8
const PET_WIDTH_PX = 88
const PET_HEIGHT_PX = 72

/** 펫 하나만 담는 창 크기. 콘텐츠를 재기 전 초기값이자 창의 하한이다. */
export const INITIAL_WIDTH = PET_MARGIN_PX * 2 + PET_WIDTH_PX
export const INITIAL_HEIGHT = PET_MARGIN_PX * 2 + PET_HEIGHT_PX

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * 펫이 `home`에 오도록 `content` 크기의 창을 놓는다. 그대로 두면 콘텐츠가 화면 밖으로
 * 나가는 자리면 창을 작업 영역 안으로 민다 — 그만큼 펫이 home을 떠난다.
 *
 * 얼마나 밀렸는지는 호출자가 `petOrigin(결과)`와 `home`의 차이로 알 수 있다. 그 차이가
 * 곧 펫이 튕겨 나간 방향이다.
 */
export function placeBounds(home: Point, content: Size, workArea: Rect): Rect {
  // 화면보다 큰 창은 만들 수 없다. 이 경우에만 콘텐츠가 잘린다.
  const width = clamp(Math.round(content.width), INITIAL_WIDTH, workArea.width)
  const height = clamp(Math.round(content.height), INITIAL_HEIGHT, workArea.height)

  // 펫은 창 하단 가운데에 붙어 있다. 그 자리가 home이 되도록 창을 역산한다.
  const wantX = home.x + PET_WIDTH_PX / 2 - width / 2
  const wantY = home.y + PET_HEIGHT_PX + PET_MARGIN_PX - height

  return {
    x: Math.round(clamp(wantX, workArea.x, workArea.x + workArea.width - width)),
    y: Math.round(clamp(wantY, workArea.y, workArea.y + workArea.height - height)),
    width,
    height
  }
}

/**
 * 펫의 발치 한가운데. renderer는 콘텐츠 덩어리를 이 점에 매달아 그린다.
 *
 * 좌상단이 아니라 발치를 쓰는 이유가 있다. 콘텐츠는 펫 위로 자라므로, 좌상단을 기준으로
 * 놓으면 패널이 열려 덩어리가 커질 때 펫이 아래로 밀려 내려간다 — 그 자리를 바로잡는
 * 새 좌표가 IPC로 돌아올 때까지 한 프레임이 어긋난다. 발치를 기준으로 두면 덩어리가
 * 무엇이든 펫이 선 자리는 변하지 않는다.
 */
export function petFoot(origin: Point): Point {
  return { x: origin.x + PET_WIDTH_PX / 2, y: origin.y + PET_HEIGHT_PX }
}

/** 창 안에서 펫이 실제로 놓인 자리. placeBounds의 역함수다. */
export function petOrigin(bounds: Rect): Point {
  return {
    x: Math.round(bounds.x + (bounds.width - PET_WIDTH_PX) / 2),
    y: bounds.y + bounds.height - PET_MARGIN_PX - PET_HEIGHT_PX
  }
}
