// 스냅샷 저장·드리프트 diff 테스트. docs/specs/drift-detection-spec.md, docs/ADR.md ADR-006/007 참조.
//
// ADR-007이 하드 제약으로 못박은 두 가지를 여기서 강제한다:
//   ① 스냅샷은 어댑터별 레코드로 분리 저장한다
//   ② diff는 이번 실행에 실제로 포함된 어댑터 범위 안에서만 수행하고,
//      포함되지 않은 어댑터의 레코드는 건드리지 않는다
// ②를 어기면 30분 주기 체크마다 래핑형 Finding이 "사라짐 → 재발생"으로 오판되어
// 펫이 30분마다 헛되이 놀라는 앱이 된다.

import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { NodeSnapshotStore, diffResults, mergeResults } from '../src/snapshot.js'
import type { AdapterResult, Finding, Severity, Snapshot } from '../src/types.js'

function finding(adapter: string, id: string, severity: Severity = 'warn'): Finding {
  return {
    id,
    adapter,
    severity,
    title: `${id} 제목`,
    cause: '테스트용',
    fix: { description: '없음', command: 'true' }
  }
}

function ran(adapter: string, findings: Finding[], ranAt = '2026-08-24T12:00:00.000Z'): AdapterResult {
  return { adapter, ranAt, skipped: false, findings }
}

function skipped(adapter: string, reason: string): AdapterResult {
  return { adapter, ranAt: '2026-08-24T12:00:00.000Z', skipped: true, reason, findings: [] }
}

function entry(findings: Finding[], ranAt = '2026-08-24T11:00:00.000Z') {
  return { ranAt, findings }
}

describe('diffResults', () => {
  describe('FR-004: 신규 error 판정', () => {
    it('이전에 없던 id가 나오면 신규 Finding으로 잡는다', () => {
      const previous: Snapshot = { 'shell-rc': entry([finding('shell-rc', 'old-1')]) }
      const drift = diffResults(previous, [
        ran('shell-rc', [finding('shell-rc', 'old-1'), finding('shell-rc', 'new-1')])
      ])

      expect(drift.newFindings.map((f) => f.id)).toEqual(['new-1'])
    })

    it('이전에 이미 있던 id는 신규로 잡지 않는다', () => {
      const previous: Snapshot = { 'shell-rc': entry([finding('shell-rc', 'old-1')]) }
      const drift = diffResults(previous, [ran('shell-rc', [finding('shell-rc', 'old-1')])])

      expect(drift.newFindings).toEqual([])
      expect(drift.hasNewError).toBe(false)
    })

    it('신규 Finding에 error가 하나라도 있으면 hasNewError가 true다', () => {
      const previous: Snapshot = { 'shell-rc': entry([]) }
      const drift = diffResults(previous, [
        ran('shell-rc', [finding('shell-rc', 'new-1', 'warn'), finding('shell-rc', 'new-2', 'error')])
      ])

      expect(drift.hasNewError).toBe(true)
    })

    it('신규 Finding이 warn뿐이면 hasNewError는 false다', () => {
      const previous: Snapshot = { 'shell-rc': entry([]) }
      const drift = diffResults(previous, [
        ran('shell-rc', [finding('shell-rc', 'new-1', 'warn'), finding('shell-rc', 'new-2', 'warn')])
      ])

      expect(drift.newFindings).toHaveLength(2)
      expect(drift.hasNewError).toBe(false)
    })

    it('이전에 이미 있던 error는 hasNewError를 켜지 않는다', () => {
      const previous: Snapshot = { 'shell-rc': entry([finding('shell-rc', 'old-1', 'error')]) }
      const drift = diffResults(previous, [ran('shell-rc', [finding('shell-rc', 'old-1', 'error')])])

      expect(drift.hasNewError).toBe(false)
    })

    it('id 비교는 어댑터 레코드 안에서만 한다 (다른 어댑터의 같은 id는 새 것이다)', () => {
      const previous: Snapshot = { 'shell-rc': entry([finding('shell-rc', 'dup')]) }
      const drift = diffResults(previous, [ran('git', [finding('git', 'dup')])])

      expect(drift.newFindings.map((f) => f.adapter)).toEqual(['git'])
    })
  })

  describe('FR-003: 실행 범위 한정 diff (ADR-007 핵심 회귀 케이스)', () => {
    it('이번 실행에 포함되지 않은 어댑터의 이전 Finding은 "사라짐"으로 오판하지 않는다', () => {
      // drift-detection-spec P2: 30분 주기 체크는 자체형(shell-rc, version-manager)만 돈다.
      const previous: Snapshot = {
        'shell-rc': entry([finding('shell-rc', 'rc-1')]),
        homebrew: entry([finding('homebrew', 'brew-1', 'error')])
      }

      const drift = diffResults(previous, [ran('shell-rc', [finding('shell-rc', 'rc-1')])])

      expect(drift.newFindings).toEqual([])
      expect(drift.hasNewError).toBe(false)
    })

    it('주기 체크 → 전체 스캔 순서로 돌아도 래핑형이 "재발생"으로 오판되지 않는다', () => {
      // 전체 스캔에서 이미 기록된 homebrew Finding은, 주기 체크를 거친 뒤 다시 전체 스캔해도 신규가 아니다.
      const afterFull: Snapshot = {
        'shell-rc': entry([finding('shell-rc', 'rc-1')]),
        homebrew: entry([finding('homebrew', 'brew-1', 'error')])
      }

      const periodic = [ran('shell-rc', [finding('shell-rc', 'rc-1')])]
      const merged = mergeResults(afterFull, periodic)
      expect(diffResults(afterFull, periodic).hasNewError).toBe(false)

      const full = [
        ran('shell-rc', [finding('shell-rc', 'rc-1')]),
        ran('homebrew', [finding('homebrew', 'brew-1', 'error')])
      ]

      expect(diffResults(merged, full).newFindings).toEqual([])
      expect(diffResults(merged, full).hasNewError).toBe(false)
    })

    it('skip된 어댑터는 diff 대상이 아니다 (미설치를 "전부 해결됨"으로 보지 않는다)', () => {
      const previous: Snapshot = { homebrew: entry([finding('homebrew', 'brew-1', 'error')]) }
      const drift = diffResults(previous, [skipped('homebrew', 'Homebrew가 설치되어 있지 않습니다')])

      expect(drift.newFindings).toEqual([])
      expect(drift.hasNewError).toBe(false)
    })
  })

  describe('기준선 수립 (이전 레코드가 없는 어댑터)', () => {
    it('이전 스냅샷에 레코드가 없는 어댑터는 드리프트로 판정하지 않는다', () => {
      // 첫 실행은 "변화"가 아니라 기준선 수립이다. 앱을 처음 켜자마자 말풍선이 튀어나오며
      // alarmed가 되는 것은 드리프트 감지가 아니다 — 기존 문제의 심각도는
      // 헬스 스코어 등급(health-score-spec FR-005)이 펫 상태로 표현한다.
      const drift = diffResults({}, [
        ran('shell-rc', [finding('shell-rc', 'rc-1', 'error'), finding('shell-rc', 'rc-2', 'error')])
      ])

      expect(drift.newFindings).toEqual([])
      expect(drift.hasNewError).toBe(false)
    })

    it('기준선이 수립된 다음 실행부터는 신규 error를 잡는다', () => {
      const first = [ran('shell-rc', [finding('shell-rc', 'rc-1', 'error')])]
      const baseline = mergeResults({}, first)

      const drift = diffResults(baseline, [
        ran('shell-rc', [finding('shell-rc', 'rc-1', 'error'), finding('shell-rc', 'rc-2', 'error')])
      ])

      expect(drift.newFindings.map((f) => f.id)).toEqual(['rc-2'])
      expect(drift.hasNewError).toBe(true)
    })

    it('레코드가 비어 있는(문제 0건) 어댑터는 기준선이 있는 것으로 본다', () => {
      const previous: Snapshot = { 'shell-rc': entry([]) }
      const drift = diffResults(previous, [ran('shell-rc', [finding('shell-rc', 'rc-1', 'error')])])

      expect(drift.newFindings.map((f) => f.id)).toEqual(['rc-1'])
      expect(drift.hasNewError).toBe(true)
    })

    // 기준선 판정은 스냅샷 전체가 아니라 **어댑터별**이다.
    // 며칠 쓰던 사용자가 Docker를 새로 설치하면 docker 어댑터가 그때 처음 실행되는데,
    // 그 어댑터의 기존 문제 전부가 "새로 생긴 error"로 잡히면 펫이 헛되이 놀란다.
    it('다른 어댑터의 기준선이 있어도, 이 어댑터의 레코드가 없으면 기준선 수립으로 본다', () => {
      const previous: Snapshot = { 'shell-rc': entry([finding('shell-rc', 'rc-1')]) }

      const drift = diffResults(previous, [
        ran('shell-rc', [finding('shell-rc', 'rc-1')]),
        ran('docker', [finding('docker', 'd-1', 'error'), finding('docker', 'd-2', 'error')])
      ])

      expect(drift.newFindings).toEqual([])
      expect(drift.hasNewError).toBe(false)
    })

    it('기준선이 있는 어댑터의 신규만 잡고, 기준선이 없는 어댑터는 건너뛴다', () => {
      const previous: Snapshot = { 'shell-rc': entry([finding('shell-rc', 'rc-1')]) }

      const drift = diffResults(previous, [
        ran('shell-rc', [finding('shell-rc', 'rc-1'), finding('shell-rc', 'rc-2', 'error')]),
        ran('docker', [finding('docker', 'd-1', 'error')])
      ])

      expect(drift.newFindings.map((f) => f.id)).toEqual(['rc-2'])
      expect(drift.hasNewError).toBe(true)
    })
  })
})

describe('mergeResults', () => {
  describe('FR-002: 어댑터별 레코드 분리 저장', () => {
    it('실행된 어댑터의 레코드를 이번 결과로 갱신한다', () => {
      const previous: Snapshot = { 'shell-rc': entry([finding('shell-rc', 'old-1')]) }
      const merged = mergeResults(previous, [
        ran('shell-rc', [finding('shell-rc', 'new-1')], '2026-08-24T12:00:00.000Z')
      ])

      expect(merged['shell-rc'].findings.map((f) => f.id)).toEqual(['new-1'])
      expect(merged['shell-rc'].ranAt).toBe('2026-08-24T12:00:00.000Z')
    })

    it('문제가 0건이면 빈 findings로 갱신한다 (레코드 자체는 남는다)', () => {
      const previous: Snapshot = { 'shell-rc': entry([finding('shell-rc', 'old-1')]) }
      const merged = mergeResults(previous, [ran('shell-rc', [])])

      expect(merged['shell-rc']).toBeDefined()
      expect(merged['shell-rc'].findings).toEqual([])
    })
  })

  describe('FR-003: 실행되지 않은 어댑터 레코드 보존', () => {
    it('이번 실행에 포함되지 않은 어댑터의 레코드는 그대로 유지한다', () => {
      const previous: Snapshot = {
        'shell-rc': entry([finding('shell-rc', 'rc-1')]),
        homebrew: entry([finding('homebrew', 'brew-1')], '2026-08-24T09:00:00.000Z')
      }

      const merged = mergeResults(previous, [ran('shell-rc', [])])

      expect(merged.homebrew).toEqual(previous.homebrew)
    })

    it('skip된 어댑터의 레코드도 그대로 유지한다 (빈 결과로 덮어쓰지 않는다)', () => {
      const previous: Snapshot = { homebrew: entry([finding('homebrew', 'brew-1')]) }
      const merged = mergeResults(previous, [skipped('homebrew', '미설치')])

      expect(merged.homebrew).toEqual(previous.homebrew)
    })

    it('skip된 어댑터에 이전 레코드가 없으면 레코드를 만들지 않는다', () => {
      const merged = mergeResults({}, [skipped('docker', '미설치')])

      expect(merged).toEqual({})
    })
  })

  it('previous를 변경하지 않고 새 객체를 반환한다', () => {
    const previous: Snapshot = { 'shell-rc': entry([finding('shell-rc', 'old-1')]) }
    const before = JSON.parse(JSON.stringify(previous))

    const merged = mergeResults(previous, [ran('shell-rc', [finding('shell-rc', 'new-1')])])

    expect(previous).toEqual(before)
    expect(merged).not.toBe(previous)
  })
})

describe('NodeSnapshotStore', () => {
  const tempDirs: string[] = []

  async function tempStore(): Promise<NodeSnapshotStore> {
    const dir = await mkdtemp(join(tmpdir(), 'nosy-snapshot-'))
    tempDirs.push(dir)
    return new NodeSnapshotStore(join(dir, 'snapshots'))
  }

  afterEach(() => {
    tempDirs.length = 0
  })

  // ADR-006: userData가 아니라 홈 디렉터리에 고정한다 — 사용자가 직접 열어볼 수 있어야 한다.
  it('기본 저장 위치는 ~/.nosy/snapshots/latest.json이다', () => {
    expect(new NodeSnapshotStore().path).toBe(join(homedir(), '.nosy', 'snapshots', 'latest.json'))
  })

  it('파일이 없으면 빈 스냅샷을 반환한다 (첫 실행)', async () => {
    const store = await tempStore()

    expect(await store.load()).toEqual({})
  })

  it('save한 스냅샷을 load로 그대로 되읽는다', async () => {
    const store = await tempStore()
    const snapshot: Snapshot = { 'shell-rc': entry([finding('shell-rc', 'rc-1')]) }

    await store.save(snapshot)

    expect(await store.load()).toEqual(snapshot)
  })

  it('디렉터리가 없어도 save가 만들어 준다', async () => {
    const store = await tempStore()

    await store.save({ 'shell-rc': entry([]) })

    expect(await store.load()).toEqual({ 'shell-rc': entry([]) })
  })

  it('JSON이 깨져 있으면 빈 스냅샷으로 복구한다', async () => {
    const store = await tempStore()
    await mkdir(join(store.path, '..'), { recursive: true })
    await writeFile(store.path, '{ 이건 JSON이 아니다', 'utf-8')

    expect(await store.load()).toEqual({})
  })

  it('사람이 읽을 수 있게 들여쓴 JSON으로 저장한다 (ADR-006: 사용자가 직접 열어본다)', async () => {
    const store = await tempStore()
    await store.save({ 'shell-rc': entry([finding('shell-rc', 'rc-1')]) })

    const raw = await readFile(store.path, 'utf-8')

    expect(raw).toContain('\n')
    expect(raw).toMatch(/\n {2}"shell-rc"/)
  })

  it('save를 두 번 하면 마지막 내용만 남는다', async () => {
    const store = await tempStore()

    await store.save({ 'shell-rc': entry([finding('shell-rc', 'rc-1')]) })
    await store.save({ git: entry([finding('git', 'git-1')]) })

    expect(await store.load()).toEqual({ git: entry([finding('git', 'git-1')]) })
  })
})
