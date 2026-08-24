// 말풍선이 고르는 "가장 심각한 문제 1건" 로직. docs/specs/pet-window-spec.md FR-004 참조.

import { describe, expect, it } from 'vitest'
import type { AdapterResult, Finding, Severity } from '@nosy/core'
import { mostSevereFinding } from '../renderer/summary'

function finding(id: string, severity: Severity): Finding {
  return {
    id,
    adapter: 'test',
    severity,
    title: id,
    cause: '',
    fix: { description: '' }
  }
}

function result(adapter: string, findings: Finding[], skipped = false): AdapterResult {
  return { adapter, ranAt: '', skipped, findings }
}

describe('mostSevereFinding', () => {
  it('문제가 없으면 undefined를 준다', () => {
    expect(mostSevereFinding([result('a', [])])).toBeUndefined()
    expect(mostSevereFinding([])).toBeUndefined()
  })

  it('warn만 있으면 첫 warn을 고른다', () => {
    const results = [result('a', [finding('w1', 'warn'), finding('w2', 'warn')])]

    expect(mostSevereFinding(results)?.id).toBe('w1')
  })

  // 뒤쪽 어댑터의 error가 앞쪽 어댑터의 warn보다 먼저다 — 심각도가 순서를 이긴다.
  it('warn보다 error를 먼저 고른다, 어댑터 순서와 무관하게', () => {
    const results = [result('a', [finding('w1', 'warn')]), result('b', [finding('e1', 'error')])]

    expect(mostSevereFinding(results)?.id).toBe('e1')
  })

  it('error가 여럿이면 먼저 등록된 어댑터의 것을 고른다', () => {
    const results = [result('a', [finding('e1', 'error')]), result('b', [finding('e2', 'error')])]

    expect(mostSevereFinding(results)?.id).toBe('e1')
  })

  // skip된 어댑터는 findings가 비어 있으므로 따로 걸러낼 필요가 없다.
  it('skip된 어댑터는 후보에 영향을 주지 않는다', () => {
    const results = [result('skipped', [], true), result('b', [finding('w1', 'warn')])]

    expect(mostSevereFinding(results)?.id).toBe('w1')
  })

  it('severity가 ok인 finding은 고르지 않는다', () => {
    expect(mostSevereFinding([result('a', [finding('o1', 'ok')])])).toBeUndefined()
  })
})
