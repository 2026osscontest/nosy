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
  state: 'nosy:state'
} as const

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
  /** 창을 화면 좌표 기준으로 dx·dy만큼 옮긴다 (드래그, pet-window-spec FR-001). */
  moveBy(dx: number, dy: number): void
  applyFix(findingId: string): Promise<FixResult>
  revertFix(findingId: string): Promise<FixResult>
  /** 반환값은 구독 해제 함수 — React useEffect의 정리 함수로 그대로 쓴다. */
  onState(handler: (snapshot: PetSnapshot) => void): () => void
}

