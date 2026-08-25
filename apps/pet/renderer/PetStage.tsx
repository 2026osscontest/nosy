// 펫의 마우스 상호작용을 모아둔 곳. 렌더링은 <PetView>가, 요약 표시는 <Bubble>이 한다.
// PetView 안에 상호작용을 넣지 않는다 — 2D→3D 교체 지점을 순수하게 유지해야 한다 (ADR-001).

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { PetView } from './PetView'
import { Bubble } from './Bubble'
import { FixPanel } from './FixPanel'
import type { PetSnapshot, Placement } from '../shared/ipc'

/** 이보다 적게 움직였으면 드래그가 아니라 클릭으로 본다 (pet-window-spec P4). */
const CLICK_SLOP_PX = 4

/**
 * 콘텐츠 덩어리 둘레의 여백. main이 받는 콘텐츠 크기는 이 여백을 포함한 값이고, main이
 * 돌려주는 자리(Placement)도 여백을 포함한 사각형의 좌상단이다 — 실제로 그리는
 * .pet-interactive는 그만큼 안쪽에 놓는다.
 *
 * 말풍선·패널의 하드 섀도(4px)가 화면 밖으로 나가지 않도록 네 방향 모두에 실어 보낸다.
 */
const CONTENT_MARGIN_PX = 8

/**
 * 이동 속도. 시간을 고정하면 거리에 따라 속도가 몇 배씩 달라진다 — 멀리 밀릴 때는
 * 시원하고 조금 밀릴 때는 굼떠 보인다. 거리에 비례해 시간을 정해 속도를 일정하게 둔다.
 */
const TRAVEL_SPEED_PX_PER_S = 1200
const TRAVEL_MIN_S = 0.16
const TRAVEL_MAX_S = 0.38

/**
 * 이보다 조금이라도 아래위로 움직였으면 착지로 본다. 눈은 중력을 먼저 읽어서, 내려갔는데
 * 착지가 없으면 애니메이션이 빠진 것처럼 보인다 — 가로 성분이 더 크더라도 그렇다.
 */
const LANDING_MIN_PX = 8

/**
 * 밀린 방향에 맞는 몸짓. 이동 축이 어디냐에 따라 읽혀야 하는 그림이 다르다.
 *
 * 세로로 밀리면 땅에 부딪히는 그림이다 — 이동 중에는 홀쭉해지고 착지에서 납작해진다.
 * 두 축이 함께 변해야 무게가 실린다.
 *
 * 가로로만 밀리면 끌려가는 그림이다 — Y를 건드리면 안 된다. 건드리는 순간 위아래로
 * 또잉거려서 "눌렸다"로 읽히고, 끌려간다는 인상이 사라진다. X만 늘였다 줄인다.
 * 기준점도 끌리는 쪽 반대편에 둬야 늘어나는 방향이 진행 방향이 된다.
 */
function motionOf(shove: Shove): Record<string, string | number> {
  const seconds = Math.min(
    Math.max(Math.hypot(shove.x, shove.y) / TRAVEL_SPEED_PX_PER_S, TRAVEL_MIN_S),
    TRAVEL_MAX_S
  )
  const travel = {
    '--from-x': `${-shove.x}px`,
    '--from-y': `${-shove.y}px`,
    '--travel-time': `${seconds.toFixed(3)}s`
  }

  if (Math.abs(shove.y) < LANDING_MIN_PX) {
    return {
      ...travel,
      '--stretch-x': 1.25,
      '--stretch-y': 1,
      '--squash-x': 0.75,
      '--squash-y': 1,
      '--origin-x': shove.x > 0 ? '0%' : '100%'
    }
  }

  return {
    ...travel,
    '--stretch-x': 0.75,
    '--stretch-y': 1.25,
    '--squash-x': 1.25,
    '--squash-y': 0.75,
    '--origin-x': '50%'
  }
}

/**
 * 'closing'은 패널을 이미 접기로 했지만 아직 창을 줄이지 않은 구간이다. 창을 먼저 줄이면
 * 펫이 출발해야 할 자리(밀려나 있던 곳)가 창 밖이 되어 그릴 수가 없다 — 그래서 패널을
 * 보이지만 않게 두고 크기는 유지한 채, 펫이 제자리로 끌려간 뒤에 창을 줄인다.
 */
type View = 'closed' | 'bubble' | 'panel' | 'closing'

/**
 * 펫을 누르면 바로 상세 패널이 열린다 (docs/UI_GUIDE.md "인터랙션 흐름").
 * 말풍선을 거치지 않는다 — 펫을 누른다는 건 이미 상세를 보겠다는 뜻이고, 문제가 0건일 때는
 * 말풍선과 패널의 내용이 사실상 같아 한 단계가 통째로 군더더기가 된다.
 *
 * 말풍선은 alarmed일 때 펫이 스스로 띄우는 연출로만 남는다. 그 상태에서 누르면 패널로 확장된다.
 */
const NEXT_VIEW: Record<View, View> = {
  closed: 'panel',
  bubble: 'panel',
  panel: 'closing',
  closing: 'panel'
}

// main이 보내는 Placement에서 쓰임이 다른 두 부분을 갈라 쓴다. 계약이 바뀌면 여기도
// 따라 바뀌도록 파생시킨다.
/** 펫이 집에서 밀려난 양. */
type Shove = Pick<Placement, 'x' | 'y'>
/** 창 안에서 펫이 서 있는 자리(발치 한가운데). */
type Foot = Pick<Placement, 'left' | 'top'>

interface DragState {
  lastX: number
  lastY: number
  movedX: number
  movedY: number
}

interface PetStageProps {
  snapshot: PetSnapshot | null
}

export function PetStage({ snapshot }: PetStageProps) {
  const [view, setView] = useState<View>('closed')
  // 패널이 화면 밖으로 나갈 자리면 창이 통째로 밀린다. 그 방향으로 펫이 튕긴다.
  const [shove, setShove] = useState<Shove | null>(null)
  // 패널을 접는 동안 펫이 제자리로 끌려가는 구간.
  const [retreat, setRetreat] = useState<Shove | null>(null)
  /**
   * 창 안에서 펫이 서 있는 자리. 창은 작업 영역 전체에 못박혀 있으므로(main/window.ts),
   * 펫이 화면 어디에 있느냐는 창이 아니라 이 값 하나가 정한다.
   */
  const [foot, setFoot] = useState<Foot | null>(null)
  /**
   * 움직임 스위치 (Tray "움직임"). 꺼지면 펫의 프레임도, 여닫을 때의 연출도 멈춘다 —
   * 자리는 즉시 바뀐다. main이 창이 뜬 직후 현재 값을 한 번 보내 준다.
   */
  const [motionOn, setMotionOn] = useState(true)
  /** 배치 구독은 한 번만 걸리고 다시 걸리지 않으므로, 그 안에서는 최신 값을 ref로 읽는다. */
  const motionRef = useRef(true)
  /** 펫이 지금 자기 자리에서 얼마나 벗어나 있는지. 되돌아갈 거리이자 방향이다. */
  const displaced = useRef<Shove>({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const drag = useRef<DragState | null>(null)
  const interactive = useRef<HTMLDivElement>(null)
  const anchor = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const lastSize = useRef('')

  const petState = snapshot?.petState ?? 'idle'
  // 두 애니메이션은 같은 거리·방향을 쓴다. 밀려날 때와 되돌아갈 때가 정반대일 뿐이다.
  const motion = motionOf(shove ?? retreat ?? { x: 0, y: 0 })

  // 창은 펫보다 크고 남는 영역은 비어 있다. 기본을 관통으로 두지 않으면
  // 그 빈 영역이 아래 창의 클릭을 삼킨다 (FR-002).
  useEffect(() => {
    window.nosy.setClickThrough(true)
  }, [])

  useEffect(
    () =>
      window.nosy.onMotion((enabled) => {
        motionRef.current = enabled
        setMotionOn(enabled)
      }),
    []
  )

  useEffect(
    () =>
      window.nosy.onPlace((next) => {
        displaced.current = { x: next.x, y: next.y }
        // 곧바로 반영한다. 드래그는 이 값이 갱신되는 속도가 그대로 펫이 커서를 따라오는
        // 속도다 — 한 프레임이라도 미루면 끌려오는 것이 늦어 보인다.
        //
        // 예전에는 여기서 한 프레임을 기다리고 그동안 화면을 통째로 감췄다. 창을 콘텐츠
        // 크기로 다시 잡던 시절, 창이 옮겨지는 것과 renderer가 그것을 아는 것 사이의
        // 시차 때문에 펫이 보정 전 자리에 찍혔다 튀었기 때문이다. 창은 이제 움직이지도
        // 커지지도 않고 펫의 자리는 콘텐츠 크기와 무관하므로(petFoot), 기다릴 것도
        // 감출 것도 없다 — 감추는 그 구간이 여닫을 때 보이던 깜빡임이었다.
        setFoot({ left: next.left, top: next.top })

        // 움직임이 꺼져 있으면 자리만 바꾸고 끝낸다.
        if (!motionRef.current || (next.x === 0 && next.y === 0)) {
          setRetreat(null)
          setShove(null)
          return
        }

        setShove({ x: next.x, y: next.y })
      }),
    []
  )

  // 접기 시작. 되돌아갈 거리는 지금 벗어나 있는 만큼이다.
  useEffect(() => {
    if (view !== 'closing') return

    // 움직임이 꺼져 있으면 끌려가는 구간 없이 곧장 닫는다.
    if (!motionOn) {
      setShove(null)
      setRetreat(null)
      setView('closed')
      return
    }

    // 들어오는 밀림 애니메이션이 아직 돌고 있었다면 여기서 넘겨받는다. 둘이 같은 요소를
    // 두고 다투면 어느 쪽이 이기는지가 CSS 규칙 순서에 달리게 된다.
    setShove(null)
    setRetreat(displaced.current)
  }, [view, motionOn])

  // 같은 방향으로 다시 밀려도 애니메이션이 처음부터 돌아야 한다. animation 속성을 떼고
  // 리플로우를 강제한 뒤 도로 붙이면 브라우저가 처음부터 다시 돌린다.
  //
  // 값을 비웠다가 다음 프레임에 넣는 방식으로는 안 된다. 그 사이 한 프레임 동안 펫이
  // 애니메이션 없이 최종 위치에 그려졌다가 출발점으로 되돌아가 깜빡인다. 여기서는 페인트
  // 전에 동기적으로 끝나므로 중간 프레임이 없다.
  useLayoutEffect(() => {
    if (!shove && !retreat) return

    // 이동과 착지가 서로 다른 요소에서 도므로 둘 다 되감아야 한다. 하나만 되감으면
    // 다음 밀림에서 몸만, 혹은 자리만 다시 움직인다.
    for (const element of [anchor.current, body.current]) {
      if (!element) continue

      element.style.animation = 'none'
      void element.offsetHeight
      element.style.animation = ''
    }
  }, [shove, retreat])

  // 창은 지금 그려진 만큼만 차지한다. 창이 곧 콘텐츠이므로 이 값 하나가 창 크기와
  // 화면 안으로 밀어 넣는 계산을 전부 결정한다 (main/panel-layout.ts placeBounds).
  //
  // 말풍선 높이는 문제 제목의 길이에 따라 달라지므로 상수로 둘 수 없다. 실제로 재서 보낸다.
  useEffect(() => {
    const element = interactive.current
    if (!element) return

    const sync = (): void => {
      const width = element.offsetWidth + CONTENT_MARGIN_PX * 2
      const height = element.offsetHeight + CONTENT_MARGIN_PX * 2

      // 같은 크기를 다시 보내면 배치 → 리렌더 → 관측이 되풀이될 수 있다.
      const key = `${width}x${height}`
      if (key === lastSize.current) return
      lastSize.current = key

      window.nosy.setContentSize(width, height)
    }

    sync()

    const observer = new ResizeObserver(sync)
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  // UI_GUIDE "캐릭터 상태 4종": alarmed는 말풍선을 자동으로 띄운다.
  // 이미 무언가 열려 있으면 건드리지 않는다 — fix 적용 후 재진단으로 alarmed가 다시 오는데,
  // 그때 패널이 말풍선으로 접히면 방금 고친 항목의 되돌리기 버튼이 사라진다.
  useEffect(() => {
    if (petState === 'alarmed') setView((current) => (current === 'closed' ? 'bubble' : current))
  }, [petState])

  /**
   * 드래그 상태를 정리하고 직전 상태를 돌려준다.
   *
   * releasePointerCapture는 캡처를 갖고 있지 않으면 예외를 던진다. 한 번 어긋나면 이 정리
   * 경로가 통째로 막혀 drag.current가 낡은 좌표를 든 채 살아남으므로 먼저 확인하고 부른다.
   */
  const endDrag = (event: React.PointerEvent<HTMLDivElement>): DragState | null => {
    const state = drag.current

    drag.current = null
    setDragging(false)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    return state
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { lastX: event.screenX, lastY: event.screenY, movedX: 0, movedY: 0 }
    setDragging(true)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const state = drag.current
    if (!state) return

    // 버튼이 이미 떼어진 뒤의 이동이라면 pointerup을 놓친 것이다. 그대로 두면 lastX/lastY가
    // 놓은 자리에 멈춘 채 남아, 다음에 커서가 펫에 닿는 순간 그동안 벌어진 거리가 통째로
    // 델타로 계산되어 창이 그만큼 순간이동한다.
    if (event.buttons === 0) {
      endDrag(event)
      return
    }

    // 화면 좌표의 차이를 쓴다 — 창이 커서 아래에서 움직여도 델타가 어긋나지 않는다.
    // Retina·트랙패드에서 screenX는 소수로 오는데 BrowserWindow.setPosition은 정수만 받는다.
    // 그래서 정수 부분만 보내고 lastX도 보낸 만큼만 전진시킨다 — 남은 소수가 다음 이벤트에
    // 그대로 이월되므로, 반올림해서 보낼 때처럼 창이 커서보다 빨리 가지 않는다.
    const dx = Math.trunc(event.screenX - state.lastX)
    const dy = Math.trunc(event.screenY - state.lastY)
    if (dx === 0 && dy === 0) return

    state.lastX += dx
    state.lastY += dy
    state.movedX += dx
    state.movedY += dy

    window.nosy.moveBy(dx, dy)
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
    const state = endDrag(event)
    if (!state) return

    if (Math.abs(state.movedX) <= CLICK_SLOP_PX && Math.abs(state.movedY) <= CLICK_SLOP_PX) {
      setView((current) => {
        const next = NEXT_VIEW[current]
        // 밀려난 적이 없으면 되돌아갈 것도 없다. 곧장 닫는다.
        const away = displaced.current

        return next === 'closing' && away.x === 0 && away.y === 0 ? 'closed' : next
      })
    }
  }

  return (
    <div className="pet-stage">
      {/* 관통을 끄는 범위는 펫·말풍선·상세 패널을 함께 감싼 이 영역이다. 패널이 이 바깥에
          있으면 클릭이 관통되어 토글이 눌리지 않는다. */}
      <div
        ref={interactive}
        className="pet-interactive"
        data-closing={view === 'closing'}
        // 아직 자리를 못 받았으면 그릴 수 없다. 0,0에 한 번 찍혔다가 제자리로 튀는 것을 막는다.
        data-unplaced={foot === null}
        // 창은 작업 영역 전체에 고정이므로 펫의 화면상 자리는 이 두 값이 전부 정한다.
        // 펫의 발치에 매달아 위로 자라게 한다 (index.css .pet-interactive).
        style={{ left: `${foot?.left ?? 0}px`, top: `${foot?.top ?? 0}px` }}
        onPointerEnter={(event) => {
          // 버튼을 누르지 않은 채 들어왔는데 드래그 상태가 남아 있다면 지난 드래그의 잔재다.
          if (event.buttons === 0) drag.current = null
          window.nosy.setClickThrough(false)
        }}
        onPointerLeave={() => {
          // 드래그 중에는 커서가 잠깐 벗어나도 관통을 켜지 않는다 — 켜면 드래그가 끊긴다.
          if (!drag.current) window.nosy.setClickThrough(true)
        }}
      >
        {view === 'bubble' && <Bubble snapshot={snapshot} />}
        {(view === 'panel' || view === 'closing') && <FixPanel snapshot={snapshot} />}

        {/* 펫이 그려질 수 있는 영역의 위쪽 경계를 패널의 아래 가장자리에 못박는다.
            펫은 애니메이션이 도는 동안 자기 합성 레이어로 올라가 z-index를 무시하고 패널
            앞으로 나온다. 클립은 그 순서와 무관하게 그릴 수 있는 영역 자체를 자른다
            (index.css .pet-gate). 접는 중에는 걸지 않는다 — 그때는 패널이 이미 사라졌고
            펫이 그 자리로 끌려 올라가는 것이 보여야 한다. */}
        <div className="pet-gate" data-gate={shove !== null}>
          {/* 창이 밀려 펫이 자리를 떠났으면 그 방향으로 튕긴다 (index.css pet-shove).
              transform만 바꾼다 — 레이아웃이 바뀌면 위 ResizeObserver가 창을 다시 잡고,
              그 결과가 다시 밀림을 낳아 되먹임이 생긴다. */}
          <div
            ref={anchor}
            className="pet-anchor"
            data-dragging={dragging}
            data-shove={shove !== null}
            data-retreat={retreat !== null}
            style={
              {
                '--shove-x': Math.sign(shove?.x ?? 0),
                '--shove-y': Math.sign(shove?.y ?? 0),
                ...motion
              } as CSSProperties
            }
            // 이동이 먼저 끝나고 착지가 뒤따른다. 이동에서 지워 버리면 data-shove가 꺼지며
            // 착지가 재생 도중에 사라진다 — 마지막인 착지가 끝났을 때만 지운다.
            onAnimationEnd={(event) => {
              if (event.animationName === 'pet-land') setShove(null)
              // 다 끌려왔다. 이제 패널을 떼면 창이 줄어들고, 펫은 이미 그 자리에 있다.
              if (event.animationName === 'pet-retreat') setView('closed')
            }}
            // CSS만으로 막히지 않는 경우를 대비한 두 번째 방어선. 네이티브 드래그가
            // 시작되면 포인터 이벤트가 끊겨 아래 핸들러가 전부 죽는다.
            onDragStart={(event) => event.preventDefault()}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            {/* 이동은 바깥(.pet-anchor), 눌림·늘어남은 안쪽에서 따로 돈다. 한 애니메이션에
                묶으면 이동 시간을 거리에 맞출 때 착지 타이밍까지 같이 늘어난다. */}
            <div ref={body} className="pet-body">
              <PetView state={petState} animated={motionOn} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
