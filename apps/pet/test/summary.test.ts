// 말풍선이 고르는 "가장 심각한 문제 1건" 로직. docs/specs/pet-window-spec.md FR-004 참조.

import { describe, expect, it } from 'vitest'
import type { AdapterResult, Finding, Severity } from '@nosy/core'
import { mostSevereFinding, scoreBar } from '../renderer/summary'

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

describe('scoreBar', () => {
  it('점수를 10점 단위 칸으로 채운다', () => {
    expect(scoreBar(70, false).filter((s) => s !== 'off')).toHaveLength(7)
    expect(scoreBar(100, false).every((s) => s === 'on')).toBe(true)
  })

  it('0점이면 한 칸도 켜지 않는다', () => {
    expect(scoreBar(0, false).every((s) => s === 'off')).toBe(true)
  })

  // 1점 남은 상태와 진짜 0점이 똑같이 보이면 안 된다.
  it('1점이라도 남아 있으면 한 칸은 켠다', () => {
    expect(scoreBar(1, false).filter((s) => s !== 'off')).toHaveLength(1)
  })

  it('error가 있으면 마지막으로 채워진 칸만 빨강이다', () => {
    const segments = scoreBar(70, true)

    expect(segments[6]).toBe('hot')
    expect(segments.filter((s) => s === 'hot')).toHaveLength(1)
    expect(segments.slice(0, 6).every((s) => s === 'on')).toBe(true)
  })

  it('error가 없으면 빨간 칸이 없다', () => {
    expect(scoreBar(70, false).includes('hot')).toBe(false)
  })

  it('0점이면 error가 있어도 빨간 칸이 생기지 않는다', () => {
    expect(scoreBar(0, true).includes('hot')).toBe(false)
  })
})
