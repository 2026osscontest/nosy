// 어댑터 레지스트리와 오케스트레이션.
// 어댑터 실행 결과를 AdapterResult[]로 통일해 score/snapshot/scheduler에 넘긴다.

import type { DiagnosticHost } from './host.js'
import type { Adapter, AdapterResult } from './types.js'
import { runShellRcAdapter } from './adapters/shell-rc.js'
import { runVersionManagerAdapter } from './adapters/version-manager.js'
import { createHomebrewAdapter } from './adapters/homebrew.js'

/** v1 어댑터 목록. 실행 순서는 이 배열 순서를 따른다. */
export const ADAPTERS: Adapter[] = [
  { name: 'shell-rc', kind: 'self', run: runShellRcAdapter },
  { name: 'version-manager', kind: 'self', run: runVersionManagerAdapter },
  createHomebrewAdapter()
]

/** 30분 주기 체크 대상 (drift-detection-spec FR-006). */
export function selfAdapters(): Adapter[] {
  return ADAPTERS.filter((adapter) => adapter.kind === 'self')
}

export async function runAdapters(
  host: DiagnosticHost,
  adapters: Adapter[] = ADAPTERS
): Promise<AdapterResult[]> {
  const results: AdapterResult[] = []

  for (const adapter of adapters) {
    const ranAt = new Date().toISOString()
    const reason = adapter.skipReason ? await adapter.skipReason(host) : null

    results.push(
      reason === null
        ? { adapter: adapter.name, ranAt, skipped: false, findings: await adapter.run(host) }
        : { adapter: adapter.name, ranAt, skipped: true, reason, findings: [] }
    )
  }

  return results
}
