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

/**
 * 화면이 붙들고 있는 행 하나의 상태.
 *
 * - `applied`  — 이 앱이 고쳤다. `backupPath`로 되돌릴 수 있다.
 * - `reverted` — 되돌렸다. 문제는 다시 미해결이지만 행은 제자리에 남겨 둔다.
 * - `resolved` — 사용자가 앱 밖에서 직접 고쳤다. 되돌릴 수단이 없다.
 *
 * 어느 상태든 기록을 지우지 않는다. 지우면, 되돌리기 응답과 재진단 결과(state)가 서로 다른
 * IPC로 도착하는 탓에 둘 사이 한 프레임 동안 그 항목이 results에도 이 기록에도 없어
 * 행이 통째로 사라졌다 다시 나타난다.
 */
export interface TrackedRow {
  finding: Finding
  status: 'applied' | 'reverted' | 'resolved'
  backupPath?: string
}

/** 상세 패널의 한 행. `backupPath`가 있으면 지금 적용된 상태라 되돌릴 수 있다. */
export interface PanelItem {
  finding: Finding
  status?: TrackedRow['status']
  backupPath?: string
}

/**
 * 직전 진단에는 있었는데 이번엔 사라진 항목을 '해결됨'으로 기록한다.
 *
 * 앱이 고친 항목은 applyFix가 알려주지만, 사용자가 에디터로 rc 파일을 고친 경우에는
 * 알림이 없다 — 재진단 결과에서 그냥 사라질 뿐이다. 그대로 두면 화면에서 항목이 증발해
 * 사용자가 방금 한 수정이 반영됐는지 알 수 없다.
 *
 * CRITICAL: "사라졌다"는 판정은 **이번 실행이 실제로 살펴본 어댑터 안에서만** 유효하다.
 * scope 'self'로 돈 진단에는 homebrew 결과가 아예 없고, 건너뛴 어댑터는 findings가 비어
 * 있을 뿐이다. 그것을 해결로 읽으면 손대지 않은 문제가 통째로 해결된 것이 된다
 * (드리프트 diff의 부분 스캔 규칙, ADR-007과 같은 함정이다).
 *
 * 바뀔 것이 없으면 받은 Map을 그대로 돌려준다 — 진단은 30분마다, 파일이 바뀔 때마다 도는데
 * 매번 새 Map을 만들면 그때마다 패널이 다시 그려진다.
 */
export function trackResolved(
  tracked: Map<string, TrackedRow>,
  previous: AdapterResult[],
  current: AdapterResult[]
): Map<string, TrackedRow> {
  const scanned = new Set(
    current.filter((result) => !result.skipped).map((result) => result.adapter)
  )
  const currentIds = new Set(current.flatMap((result) => result.findings).map((f) => f.id))

  const vanished = previous
    .filter((result) => scanned.has(result.adapter))
    .flatMap((result) => result.findings)
    .filter((finding) => !currentIds.has(finding.id) && !tracked.has(finding.id))

  // 사용자가 에디터에서 되돌린 경우. 문제가 실제로 돌아왔으므로 미해결로 다시 보여야 한다.
  // applied·reverted는 앱이 관리하는 상태이므로 여기서 지우지 않는다.
  const returned = [...tracked.values()].filter(
    (row) => row.status === 'resolved' && currentIds.has(row.finding.id)
  )

  if (vanished.length === 0 && returned.length === 0) return tracked

  const next = new Map(tracked)

  for (const finding of vanished) next.set(finding.id, { finding, status: 'resolved' })
  for (const row of returned) next.delete(row.finding.id)

  return next
}

/**
 * 정렬 키. 같은 파일 안에서는 줄 번호 순으로 — 사용자가 rc 파일을 위에서 아래로 읽는 순서다.
 * 줄 번호는 문자열 비교를 하므로 자리수를 맞춘다. 근거 파일이 없는 항목은 뒤로 보낸다.
 */
function sortKey(finding: Finding): string {
  const { evidence } = finding

  return evidence ? `${evidence.file}:${String(evidence.line).padStart(6, '0')}` : '~'
}

/**
 * 패널에 그릴 목록 (toggle-panel-spec FR-001).
 *
 * 해결된 항목은 재진단 결과에서 사라지므로 `tracked`에 남은 기록을 합쳐 행을 유지한다.
 *
 * 순서는 severity가 아니라 파일·줄 기준이다 — 적용 전후로 같은 자리에 남아야 한다.
 * 심각도로 정렬하면 고친 항목이 목록 안에서 갑자기 이동해 무슨 일이 일어났는지 읽히지 않는다.
 * 가장 심각한 문제를 앞세우는 일은 말풍선이 이미 하고 있다.
 */
export function panelItems(
  results: AdapterResult[],
  tracked: Map<string, TrackedRow>
): PanelItem[] {
  const fromResults = results
    .flatMap((result) => result.findings)
    .filter((finding) => !tracked.has(finding.id))

  const fromTracked = [...tracked.values()].map((row) => row.finding)

  return [...fromResults, ...fromTracked]
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
    .map((finding) => {
      const row = tracked.get(finding.id)

      if (!row) return { finding }

      // 되돌린 항목은 다시 미해결이므로 백업 경로를 넘기지 않는다 — 토글이 꺼진 것으로 보여야 한다.
      return row.status === 'applied'
        ? { finding, status: row.status, backupPath: row.backupPath }
        : { finding, status: row.status }
    })
}

/** 토글을 켤 수 있는 항목인지 (toggle-panel-spec FR-005). */
export function fixability(finding: Finding): 'ready' | 'sudo' | 'manual' {
  if (finding.fix.needsSudo === true) return 'sudo'
  return finding.fix.edit ? 'ready' : 'manual'
}
