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

/** 상세 패널의 한 행. `backupPath`가 있으면 이미 적용되어 되돌릴 수 있는 항목이다. */
export interface PanelItem {
  finding: Finding
  backupPath?: string
}

/** 적용에 성공한 항목의 기록. 재진단 결과에서 사라지므로 renderer가 따로 들고 있어야 한다. */
export interface AppliedRecord {
  finding: Finding
  backupPath: string
}

const SEVERITY_ORDER: Record<string, number> = { error: 0, warn: 1, ok: 2 }

/**
 * 패널에 그릴 목록 (toggle-panel-spec FR-001).
 *
 * 적용에 성공한 항목은 그 문제가 해결되었으므로 재진단 결과에서 사라진다. 그대로 두면
 * 방금 고친 항목이 화면에서 증발해 되돌릴 방법이 없어지므로, `applied`에 남은 기록을
 * 목록 뒤에 붙여 "적용됨 · 되돌리기" 행으로 유지한다.
 *
 * 아직 적용하지 않은 항목은 심각한 것부터 보여준다 — 어댑터 등록 순서보다 severity가 먼저다.
 */
export function panelItems(
  results: AdapterResult[],
  applied: Map<string, AppliedRecord>
): PanelItem[] {
  const pending = results
    .flatMap((result) => result.findings)
    .filter((finding) => !applied.has(finding.id))
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))

  const done = [...applied.values()].map(({ finding, backupPath }) => ({ finding, backupPath }))

  return [...pending.map((finding) => ({ finding })), ...done]
}

/** 토글을 켤 수 있는 항목인지 (toggle-panel-spec FR-005). */
export function fixability(finding: Finding): 'ready' | 'sudo' | 'manual' {
  if (finding.fix.needsSudo === true) return 'sudo'
  return finding.fix.edit ? 'ready' : 'manual'
}
