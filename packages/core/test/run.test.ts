// 어댑터 오케스트레이션 계약 테스트.
// docs/specs/health-score-spec.md FR-004(skip은 감점·분모에서 제외),
// docs/specs/drift-detection-spec.md FR-006(30분 주기는 자체형만) 참조.

import { describe, expect, it } from 'vitest'
import { FakeHost } from '../src/host.js'
import { ADAPTERS, runAdapters, selfAdapters } from '../src/run.js'
import type { Adapter, Finding } from '../src/types.js'

const dummyFinding: Finding = {
  id: 'dummy-1',
  adapter: 'dummy',
  severity: 'warn',
  title: '더미',
  cause: '테스트용',
  fix: { description: '없음', command: 'true' }
}

function adapter(overrides: Partial<Adapter> & { name: string }): Adapter {
  return {
    kind: 'self',
    run: async () => [dummyFinding],
    ...overrides
  }
}

describe('runAdapters', () => {
  it('skipReason이 없으면 항상 실행한다', async () => {
    const results = await runAdapters(new FakeHost(), [adapter({ name: 'always' })])

    expect(results).toHaveLength(1)
    expect(results[0].skipped).toBe(false)
    expect(results[0].reason).toBeUndefined()
    expect(results[0].findings).toHaveLength(1)
  })

  it('skipReason이 null이면 실행한다', async () => {
    const results = await runAdapters(new FakeHost(), [
      adapter({ name: 'present', skipReason: async () => null })
    ])

    expect(results[0].skipped).toBe(false)
    expect(results[0].findings).toHaveLength(1)
  })

  it('skipReason이 문자열이면 skipped로 표시하고 사유를 그대로 담는다', async () => {
    const results = await runAdapters(new FakeHost(), [
      adapter({ name: 'absent', skipReason: async () => 'Homebrew가 설치되어 있지 않습니다' })
    ])

    expect(results[0].skipped).toBe(true)
    expect(results[0].reason).toBe('Homebrew가 설치되어 있지 않습니다')
    expect(results[0].findings).toEqual([])
  })

  it('같은 어댑터라도 건너뛴 사유가 다르면 다르게 전달한다', async () => {
    const results = await runAdapters(new FakeHost(), [
      adapter({ name: 'homebrew-absent', skipReason: async () => '미설치' }),
      adapter({ name: 'homebrew-old', skipReason: async () => 'brew doctor --json 미지원 버전' })
    ])

    expect(results[0].reason).toBe('미설치')
    expect(results[1].reason).toBe('brew doctor --json 미지원 버전')
  })

  it('skip된 어댑터는 run을 호출하지 않는다', async () => {
    let ran = false
    await runAdapters(new FakeHost(), [
      adapter({
        name: 'absent',
        skipReason: async () => '미설치',
        run: async () => {
          ran = true
          return []
        }
      })
    ])

    expect(ran).toBe(false)
  })

  it('"문제 0건"과 "해당 없음"을 구분할 수 있다', async () => {
    const results = await runAdapters(new FakeHost(), [
      adapter({ name: 'clean', run: async () => [] }),
      adapter({ name: 'absent', skipReason: async () => '미설치' })
    ])

    expect(results[0].findings).toEqual([])
    expect(results[0].skipped).toBe(false)
    expect(results[0].reason).toBeUndefined()
    expect(results[1].findings).toEqual([])
    expect(results[1].skipped).toBe(true)
    expect(results[1].reason).toBe('미설치')
  })

  it('결과에 어댑터 이름과 ISO 8601 실행 시각을 담는다', async () => {
    const results = await runAdapters(new FakeHost(), [adapter({ name: 'shell-rc' })])

    expect(results[0].adapter).toBe('shell-rc')
    expect(results[0].ranAt).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/)
  })

  it('전달한 어댑터 순서대로 결과를 반환한다', async () => {
    const results = await runAdapters(new FakeHost(), [
      adapter({ name: 'first' }),
      adapter({ name: 'second' }),
      adapter({ name: 'third' })
    ])

    expect(results.map((result) => result.adapter)).toEqual(['first', 'second', 'third'])
  })

  it('어댑터를 넘기지 않으면 등록된 전체를 실행한다', async () => {
    const results = await runAdapters(new FakeHost())

    expect(results.map((result) => result.adapter)).toEqual(ADAPTERS.map((a) => a.name))
  })
})

describe('selfAdapters', () => {
  it('30분 주기 대상으로 자체형만 반환한다 (drift FR-006)', async () => {
    const names = selfAdapters().map((a) => a.name)

    expect(names).toContain('shell-rc')
    expect(names).toContain('version-manager')
    expect(selfAdapters().every((a) => a.kind === 'self')).toBe(true)
  })
})

describe('ADAPTERS 레지스트리', () => {
  it('어댑터 이름이 중복되지 않는다 (스냅샷 레코드 키로 쓰인다)', () => {
    const names = ADAPTERS.map((a) => a.name)

    expect(new Set(names).size).toBe(names.length)
  })
})
