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
