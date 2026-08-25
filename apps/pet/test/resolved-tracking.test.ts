// 사용자가 앱 밖에서 직접 고친 항목을 화면에 남기는 로직.
//
// 앱이 고친 항목은 applyFix가 알려주므로 추적할 수 있지만, 사용자가 에디터로 rc 파일을
// 고친 경우에는 알림이 없다. 재진단 결과에서 그 문제가 그냥 사라질 뿐이다. 그러면 화면에서
// 항목이 증발해 "내가 고친 게 반영된 건가"를 알 수 없으므로, 직전 결과와 비교해 사라진
// 항목을 '해결됨'으로 남긴다.

import { describe, expect, it } from 'vitest'
import type { AdapterResult, Finding, Severity } from '@nosy/core'
import { panelItems, trackResolved } from '../renderer/summary'
import type { TrackedRow } from '../renderer/summary'

function finding(id: string, adapter = 'shell-rc', severity: Severity = 'warn'): Finding {
  return { id, adapter, severity, title: id, cause: '', fix: { description: '' } }
}

function result(adapter: string, findings: Finding[], skipped = false): AdapterResult {
  return { adapter, ranAt: '', skipped, findings }
}

function tracked(entries: TrackedRow[] = []): Map<string, TrackedRow> {
  return new Map(entries.map((entry) => [entry.finding.id, entry]))
}

const statusOf = (map: Map<string, TrackedRow>, id: string) => map.get(id)?.status

describe('trackResolved', () => {
  it('직전에 있던 문제가 사라지면 해결됨으로 남긴다', () => {
    const previous = [result('shell-rc', [finding('a'), finding('b')])]
    const current = [result('shell-rc', [finding('b')])]

    const next = trackResolved(tracked(), previous, current)

    expect(statusOf(next, 'a')).toBe('resolved')
    expect(next.has('b')).toBe(false)
  })

  it('새로 생긴 문제는 기록하지 않는다', () => {
    const previous = [result('shell-rc', [])]
    const current = [result('shell-rc', [finding('a')])]

    expect(trackResolved(tracked(), previous, current).size).toBe(0)
  })

  // drift-detection-spec / ADR-007과 같은 함정이다. scope 'self'로 돈 진단에는 homebrew
  // 결과가 아예 없는데, 이를 "사라졌다"고 읽으면 homebrew 문제가 전부 해결된 것이 된다.
  it('이번 스캔에 포함되지 않은 어댑터의 문제는 건드리지 않는다', () => {
    const previous = [
      result('shell-rc', [finding('rc-1')]),
      result('homebrew', [finding('brew-1', 'homebrew')])
    ]
    const current = [result('shell-rc', [finding('rc-1')])]

    expect(trackResolved(tracked(), previous, current).size).toBe(0)
  })

  // 건너뛴 어댑터는 findings가 비어 있을 뿐 "문제가 없다"는 뜻이 아니다.
  it('건너뛴 어댑터의 문제도 건드리지 않는다', () => {
    const previous = [result('homebrew', [finding('brew-1', 'homebrew')])]
    const current = [result('homebrew', [], true)]

    expect(trackResolved(tracked(), previous, current).size).toBe(0)
  })

  // 앱이 고쳐서 사라진 것이라면 이미 backupPath를 들고 applied로 기록돼 있다.
  // 여기서 resolved로 덮으면 되돌리기 버튼이 사라진다.
  it('이미 기록된 항목의 상태를 덮어쓰지 않는다', () => {
    const target = finding('a')
    const previous = [result('shell-rc', [target])]
    const current = [result('shell-rc', [])]
    const before = tracked([{ finding: target, status: 'applied', backupPath: '/x/.zshrc.bak.1' }])

    const next = trackResolved(before, previous, current)

    expect(statusOf(next, 'a')).toBe('applied')
    expect(next.get('a')?.backupPath).toBe('/x/.zshrc.bak.1')
  })

  // 사용자가 에디터에서 되돌린 경우. 문제가 실제로 돌아왔으므로 미해결로 다시 보여야 한다.
  it('해결됨으로 남겼던 문제가 다시 나타나면 기록에서 뺀다', () => {
    const target = finding('a')
    const previous = [result('shell-rc', [target])]
    const current = [result('shell-rc', [target])]
    const before = tracked([{ finding: target, status: 'resolved' }])

    expect(trackResolved(before, previous, current).has('a')).toBe(false)
  })

  // applied/reverted는 앱이 관리하는 상태다. 문제가 다시 나타났다고 지우면
  // 되돌리기 직후 그 행이 통째로 사라진다.
  it('되돌린 항목은 문제가 다시 나타나도 기록에 남긴다', () => {
    const target = finding('a')
    const previous = [result('shell-rc', [target])]
    const current = [result('shell-rc', [target])]
    const before = tracked([{ finding: target, status: 'reverted', backupPath: '/x/.zshrc.bak.1' }])

    expect(statusOf(trackResolved(before, previous, current), 'a')).toBe('reverted')
  })

  // 진단은 30분마다, 파일이 바뀔 때마다 돈다. 매번 새 Map을 만들면 React가 그때마다 다시 그린다.
  it('바뀔 것이 없으면 받은 Map을 그대로 돌려준다', () => {
    const previous = [result('shell-rc', [finding('a')])]
    const current = [result('shell-rc', [finding('a')])]
    const before = tracked()

    expect(trackResolved(before, previous, current)).toBe(before)
  })

  it('직전 결과가 없으면(첫 진단) 아무것도 기록하지 않는다', () => {
    const current = [result('shell-rc', [finding('a')])]

    expect(trackResolved(tracked(), [], current).size).toBe(0)
  })
})

describe('panelItems', () => {
  it('결과에 없는 기록도 행으로 남긴다', () => {
    const target = finding('a')
    const items = panelItems([result('shell-rc', [])], tracked([{ finding: target, status: 'resolved' }]))

    expect(items.map((item) => item.finding.id)).toEqual(['a'])
    expect(items[0].status).toBe('resolved')
  })

  it('적용된 항목에만 되돌릴 백업 경로를 준다', () => {
    const applied = finding('a')
    const resolved = finding('b')
    const items = panelItems(
      [result('shell-rc', [])],
      tracked([
        { finding: applied, status: 'applied', backupPath: '/x/.zshrc.bak.1' },
        { finding: resolved, status: 'resolved' }
      ])
    )

    const byId = new Map(items.map((item) => [item.finding.id, item]))

    expect(byId.get('a')?.backupPath).toBe('/x/.zshrc.bak.1')
    expect(byId.get('b')?.backupPath).toBeUndefined()
  })

  // 되돌린 항목은 다시 미해결이므로 토글이 꺼진 것처럼 보여야 한다.
  it('되돌린 항목에는 백업 경로를 주지 않는다', () => {
    const target = finding('a')
    const items = panelItems(
      [result('shell-rc', [target])],
      tracked([{ finding: target, status: 'reverted', backupPath: '/x/.zshrc.bak.1' }])
    )

    expect(items).toHaveLength(1)
    expect(items[0].backupPath).toBeUndefined()
  })

  it('같은 문제를 결과와 기록 양쪽에서 가져와 두 번 그리지 않는다', () => {
    const target = finding('a')
    const items = panelItems(
      [result('shell-rc', [target])],
      tracked([{ finding: target, status: 'resolved' }])
    )

    expect(items).toHaveLength(1)
  })

  // 고친 항목이 목록 안에서 자리를 옮기면 무슨 일이 일어났는지 읽히지 않는다.
  it('파일과 줄 번호 순으로 정렬한다', () => {
    const at = (id: string, line: number): Finding => ({
      ...finding(id),
      evidence: { file: '/x/.zshrc', line, excerpt: '' }
    })
    const items = panelItems(
      [result('shell-rc', [at('c', 30), at('a', 4), at('b', 12)])],
      tracked()
    )

    expect(items.map((item) => item.finding.id)).toEqual(['a', 'b', 'c'])
  })
})
