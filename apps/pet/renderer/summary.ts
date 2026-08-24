// 스냅샷에서 화면에 쓸 값을 뽑는 순수 함수들.
// @nosy/core에서 타입만 가져온다 — 값을 가져오면 core 배럴이 renderer 번들에 딸려온다
// (shared/ipc.ts 상단 주석 참조).

import type { AdapterResult, Finding } from '@nosy/core'

/**
 * 말풍선에 요약할 문제 1건 (pet-window-spec FR-004).
 * error가 있으면 그중 첫 건, 없으면 warn 중 첫 건. 보여줄 문제가 없으면 undefined.
 * results 순서는 ADAPTERS 등록 순서이므로, 같은 심각도면 먼저 등록된 어댑터가 앞선다.
 * skip된 어댑터는 findings가 비어 있어 자연히 후보에서 빠진다.
 */
export function mostSevereFinding(results: AdapterResult[]): Finding | undefined {
  const findings = results.flatMap((result) => result.findings)

  return (
    findings.find((finding) => finding.severity === 'error') ??
    findings.find((finding) => finding.severity === 'warn')
  )
}

/** 스코어 게이지 한 칸의 상태. `hot`은 error가 점수를 깎고 있다는 뜻이다. */
export type BarSegment = 'off' | 'on' | 'hot'

const BAR_SEGMENTS = 10

/**
 * 헬스 스코어를 10칸 게이지로 바꾼다 (docs/UI_GUIDE.md "말풍선" 요약).
 * 채워지는 칸 수는 10점 단위로 올림한다 — 1점이라도 남아 있으면 한 칸은 켜져서,
 * 게이지가 완전히 비어 보이는 상태와 진짜 0점을 구분할 수 있다.
 * `hasError`면 마지막으로 채워진 칸만 빨강으로 바꿔 무엇이 점수를 깎았는지 알린다.
 */
export function scoreBar(score: number, hasError: boolean): BarSegment[] {
  const filled = Math.min(BAR_SEGMENTS, Math.ceil(score / BAR_SEGMENTS))

  return Array.from({ length: BAR_SEGMENTS }, (_, index) => {
    if (index >= filled) return 'off'
    return hasError && index === filled - 1 ? 'hot' : 'on'
  })
}
