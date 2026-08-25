// 펫의 마우스 상호작용을 모아둔 곳. 렌더링은 <PetView>가, 요약 표시는 <Bubble>이 한다.
// PetView 안에 상호작용을 넣지 않는다 — 2D→3D 교체 지점을 순수하게 유지해야 한다 (ADR-001).

import { useEffect, useRef, useState } from 'react'
import { PetView } from './PetView'
import { Bubble } from './Bubble'
import { FixPanel } from './FixPanel'
import type { PetSnapshot } from '../shared/ipc'

/** 이보다 적게 움직였으면 드래그가 아니라 클릭으로 본다 (pet-window-spec P4). */
const CLICK_SLOP_PX = 4

/**
 * 펫을 누를 때마다 도는 3단계 (docs/UI_GUIDE.md "상호작용":
 * 클릭 → 말풍선 요약 → 재클릭 → 상세 패널 확장).
 */
type View = 'closed' | 'bubble' | 'panel'

const NEXT_VIEW: Record<View, View> = { closed: 'bubble', bubble: 'panel', panel: 'closed' }

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
  const [dragging, setDragging] = useState(false)
  const drag = useRef<DragState | null>(null)

  const petState = snapshot?.petState ?? 'idle'

  // 창은 펫보다 크고 남는 영역은 비어 있다. 기본을 관통으로 두지 않으면
  // 그 빈 영역이 아래 창의 클릭을 삼킨다 (FR-002).
  useEffect(() => {
    window.nosy.setClickThrough(true)
  }, [])

  // UI_GUIDE "캐릭터 상태 4종": alarmed는 말풍선을 자동으로 띄운다.
  // 이미 무언가 열려 있으면 건드리지 않는다 — fix 적용 후 재진단으로 alarmed가 다시 오는데,
  // 그때 패널이 말풍선으로 접히면 방금 고친 항목의 되돌리기 버튼이 사라진다.
  useEffect(() => {
    if (petState === 'alarmed') setView((current) => (current === 'closed' ? 'bubble' : current))
  }, [petState])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = { lastX: event.screenX, lastY: event.screenY, movedX: 0, movedY: 0 }
    setDragging(true)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const state = drag.current
    if (!state) return

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
    const state = drag.current
    drag.current = null
    setDragging(false)
    event.currentTarget.releasePointerCapture(event.pointerId)
    if (!state) return

    if (Math.abs(state.movedX) <= CLICK_SLOP_PX && Math.abs(state.movedY) <= CLICK_SLOP_PX) {
      setView((current) => NEXT_VIEW[current])
    }
  }

  return (
    <div className="pet-stage">
      {/* 관통을 끄는 범위는 펫·말풍선·상세 패널을 함께 감싼 이 영역이다. 패널이 이 바깥에
          있으면 클릭이 관통되어 토글이 눌리지 않는다. */}
      <div
        className="pet-interactive"
        onPointerEnter={() => window.nosy.setClickThrough(false)}
        onPointerLeave={() => {
          // 드래그 중에는 커서가 잠깐 벗어나도 관통을 켜지 않는다 — 켜면 드래그가 끊긴다.
          if (!drag.current) window.nosy.setClickThrough(true)
        }}
      >
        {view === 'bubble' && <Bubble snapshot={snapshot} />}
        {view === 'panel' && <FixPanel snapshot={snapshot} />}

        <div
          className="pet-anchor"
          data-dragging={dragging}
          // CSS만으로 막히지 않는 경우를 대비한 두 번째 방어선. 네이티브 드래그가
          // 시작되면 포인터 이벤트가 끊겨 아래 핸들러가 전부 죽는다.
          onDragStart={(event) => event.preventDefault()}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <PetView state={petState} />
        </div>
      </div>
    </div>
  )
}
