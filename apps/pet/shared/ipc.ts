// main·preload·renderer 세 곳이 공유하는 IPC 계약.
// electron을 import하지 않는다 — renderer 번들에서도 그대로 로드되어야 한다.
//
// CRITICAL: renderer는 이 파일에서 **타입만** 가져가야 한다. 값을 하나라도 import하면
// 아래 computeHealthScore를 타고 @nosy/core 배럴 전체가 renderer 번들에 들어가고,
// host.js의 node:child_process에서 터진다. renderer용 순수 헬퍼는 renderer/ 아래에 둔다.

import { computeHealthScore } from '@nosy/core'
import type { AdapterResult, DriftResult, HealthScore, PetState } from '@nosy/core'

/** 채널 이름은 'nosy:' 접두사로 고정한다 — 다른 앱·라이브러리와 겹치지 않게. */
export const CHANNEL = {
  run: 'nosy:run',
  applyFix: 'nosy:apply-fix',
  revertFix: 'nosy:revert-fix',
  setClickThrough: 'nosy:set-click-through',
  moveBy: 'nosy:move-by',
  setContentSize: 'nosy:set-content-size',
  state: 'nosy:state',
  place: 'nosy:place'
} as const

/**
 * 지금 콘텐츠를 어디에 그릴지, 그 자리가 펫의 집에서 얼마나 밀려난 자리인지.
 *
 * 창은 작업 영역 전체를 덮은 채 크기가 절대 바뀌지 않는다(main/window.ts). 무엇을 펼치고
 * 접든 움직이는 것은 창이 아니라 창 **안에서** 콘텐츠를 놓는 자리다 — macOS는 투명 창의
 * 크기를 바꿀 때마다 그리는 표면을 새로 잡느라 한 프레임을 비우는데, 그것이 여닫을 때마다
 * 보이는 깜빡임이었다.
 */
export interface Placement {
  /**
   * 펫이 자기 자리(home)에서 밀려난 양. 패널이 화면 밖으로 나갈 자리면 콘텐츠 덩어리가
   * 통째로 안쪽으로 밀리는데(main/panel-layout.ts placeBounds), 그때 펫이 함께 움직인 거리다.
   *
   * 부호가 곧 밀려난 방향이다 — renderer는 그 방향으로 튕기는 몸짓을 재생한다.
   * 밀리지 않았으면 둘 다 0이다.
   */
  x: number
  y: number
  /**
   * 작업 영역(=창) 왼쪽 위를 원점으로 한, **펫의 발치 한가운데**. renderer는 콘텐츠
   * 덩어리를 이 점에 매달아 그린다 — 덩어리는 펫 위로 자라므로, 이 점만 고정하면 패널을
   * 펼치고 접어도 펫이 선 자리가 흔들리지 않는다 (main/panel-layout.ts petFoot).
   */
  left: number
  top: number
}

/** 'self': 30분 주기 체크(자체형 어댑터만), 'all': 전체 (drift-detection-spec FR-006). */
export type DiagnosticScope = 'all' | 'self'

/** main → renderer로 밀어넣는 단일 상태 덩어리. renderer는 이것 하나만 보고 그린다. */
export interface PetSnapshot {
  petState: PetState
  score: HealthScore
  results: AdapterResult[]
  drift: DriftResult
  ranAt: string
}

export interface FixResult {
  ok: boolean
  backupPath?: string
  error?: string
}

function hasSeverity(results: AdapterResult[], severity: 'warn' | 'error'): boolean {
  return results.some((result) => result.findings.some((finding) => finding.severity === severity))
}

/**
 * 진단 결과 → 펫 표정. docs/UI_GUIDE.md "캐릭터 상태 4종" 표가 정본이다.
 * 새 error(드리프트)나 error가 있으면 alarmed, warn만 있으면 worried, 그 외 idle.
 * skip된 어댑터는 findings가 비어 있으므로 자연히 영향이 없다 — 미설치는 걱정거리가 아니다.
 * 'thinking'은 결과로부터 알 수 없으므로 여기서 반환하지 않는다 (thinkingSnapshot 참조).
 */
export function petStateFor(results: AdapterResult[], drift: DriftResult): PetState {
  if (drift.hasNewError || hasSeverity(results, 'error')) return 'alarmed'
  if (hasSeverity(results, 'warn')) return 'worried'
  return 'idle'
}

/**
 * 한 번의 진단 결과를 renderer에 보낼 한 덩어리로 묶는다.
 * skip된 어댑터도 results에 그대로 남긴다 — UI가 "해당 없음"을 표기하려면 필요하다
 * (health-score-spec FR-004).
 */
export function buildSnapshot(
  results: AdapterResult[],
  drift: DriftResult,
  ranAt: string
): PetSnapshot {
  return {
    petState: petStateFor(results, drift),
    score: computeHealthScore(results),
    results,
    drift,
    ranAt
  }
}

/**
 * 진단이 시작될 때 밀어넣을 스냅샷. 표정만 thinking으로 바꾸고 점수·결과·드리프트는 유지한다
 * — 진단 도중에 화면의 숫자가 0으로 깜빡이면 안 된다. `previous`는 변경하지 않는다.
 * 이전 스냅샷이 없으면(앱 첫 기동) 100점·빈 결과·드리프트 없음으로 시작하고, ranAt은 빈 문자열이다.
 */
export function thinkingSnapshot(previous?: PetSnapshot): PetSnapshot {
  if (!previous) {
    return {
      petState: 'thinking',
      score: computeHealthScore([]),
      results: [],
      drift: { hasNewError: false, newFindings: [] },
      ranAt: ''
    }
  }

  return { ...previous, petState: 'thinking' }
}

/**
 * renderer가 보는 `window.nosy`의 표면. preload가 이 타입을 구현하고
 * renderer의 전역 선언(`renderer/nosy.d.ts`)이 같은 타입을 참조한다 — 한쪽만 고쳐 갈라지는 걸 막는다.
 *
 * 결과 전달은 push 단일 경로다. `run`은 요청만 보내고 답을 기다리지 않으며,
 * 누가 시작했든(펫 클릭·Tray·타이머) 결과는 항상 `onState`로 도착한다.
 */
export interface NosyApi {
  /** IPC 왕복 없이 preload가 상수로 준다 (pet-window-spec FR-005). */
  platform: string
  run(scope: DiagnosticScope): void
  setClickThrough(ignore: boolean): void
  /** 펫의 자리를 dx·dy만큼 옮긴다 (드래그, pet-window-spec FR-001). 창은 움직이지 않는다. */
  moveBy(dx: number, dy: number): void
  /**
   * 지금 그려야 할 콘텐츠 크기를 알린다. 창 크기는 이것으로 바뀌지 않는다 — 이 값은 콘텐츠가
   * 화면 밖으로 나가지 않게 놓을 자리를 계산하는 데만 쓰인다.
   *
   * 응답을 기다리지 않는다 — 결과는 언제나 `onPlace`로 도착한다.
   */
  setContentSize(width: number, height: number): void
  /** 콘텐츠를 놓을 자리가 정해질 때마다 불린다. 반환값은 구독 해제 함수다. */
  onPlace(handler: (placement: Placement) => void): () => void
  applyFix(findingId: string): Promise<FixResult>
  revertFix(findingId: string): Promise<FixResult>
  /** 반환값은 구독 해제 함수 — React useEffect의 정리 함수로 그대로 쓴다. */
  onState(handler: (snapshot: PetSnapshot) => void): () => void
}

