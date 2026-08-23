// 스냅샷 저장 · 드리프트 diff. docs/specs/drift-detection-spec.md, docs/ADR.md ADR-006/007 참조.
//
// ADR-007의 하드 제약 두 가지를 여기서 구현한다:
//   ① 스냅샷은 어댑터별 레코드로 분리 저장한다 (FR-002)
//   ② diff는 이번 실행에 포함된 어댑터 범위 안에서만 수행하고,
//      포함되지 않은 어댑터의 레코드는 손대지 않는다 (FR-003)
// diffResults/mergeResults는 순수 함수이며, 파일 I/O는 NodeSnapshotStore에만 둔다.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { AdapterResult, DriftResult, Snapshot } from './types.js'

export interface SnapshotStore {
  load(): Promise<Snapshot>
  save(snapshot: Snapshot): Promise<void>
}

/**
 * 이번 실행 범위 안에서만 신규 Finding을 찾는다 (FR-003, FR-004).
 * - 스냅샷 자체가 비어 있으면 첫 실행이다 — 기준선 수립일 뿐 "변화"가 아니므로 드리프트로 보지 않는다.
 *   (앱을 처음 켜자마자 alarmed가 되는 것은 드리프트 감지가 아니다. 기존 문제의 심각도는 헬스 스코어 등급이 표현한다.)
 * - skip된 어댑터는 비교하지 않는다 — 미설치를 "문제가 전부 해결됨"으로 읽으면 안 된다.
 * - id 비교는 같은 어댑터 레코드 안에서만 한다.
 */
export function diffResults(previous: Snapshot, results: AdapterResult[]): DriftResult {
  if (Object.keys(previous).length === 0) return { hasNewError: false, newFindings: [] }

  const newFindings = results
    .filter((result) => !result.skipped)
    .flatMap((result) => {
      const knownIds = new Set((previous[result.adapter]?.findings ?? []).map((f) => f.id))
      return result.findings.filter((f) => !knownIds.has(f.id))
    })

  return {
    hasNewError: newFindings.some((f) => f.severity === 'error'),
    newFindings
  }
}

/**
 * 실행된 어댑터의 레코드만 갱신하고 나머지는 그대로 유지한다 (FR-002, FR-003).
 * skip된 어댑터는 이전 레코드를 보존하며, 이전 레코드가 없으면 만들지도 않는다.
 */
export function mergeResults(previous: Snapshot, results: AdapterResult[]): Snapshot {
  const merged: Snapshot = { ...previous }

  for (const result of results) {
    if (result.skipped) continue
    merged[result.adapter] = { ranAt: result.ranAt, findings: result.findings }
  }

  return merged
}

/** ADR-006: Electron userData가 아니라 홈 디렉터리에 고정한다 — 사용자가 직접 열어볼 수 있어야 한다. */
export class NodeSnapshotStore implements SnapshotStore {
  readonly path: string

  constructor(baseDir: string = join(homedir(), '.nosy', 'snapshots')) {
    this.path = join(baseDir, 'latest.json')
  }

  /** 파일이 없거나 JSON이 깨져 있으면 빈 스냅샷을 반환한다 (첫 실행·손상 복구 동일 경로). */
  async load(): Promise<Snapshot> {
    try {
      return JSON.parse(await readFile(this.path, 'utf-8')) as Snapshot
    } catch {
      return {}
    }
  }

  async save(snapshot: Snapshot): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true })
    await writeFile(this.path, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf-8')
  }
}
