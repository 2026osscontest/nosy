// 헬스 스코어 산출 테스트. docs/specs/health-score-spec.md 참조.
// 배점표(error -15, warn -5, 어댑터 상한 -30, 하한 0)는 상수로 고정되어야 한다 —
// 영상·보고서에 점수를 노출하므로 실행마다 달라지면 안 된다(Success Criteria).

import { describe, expect, it } from 'vitest'
import { computeHealthScore } from '../src/score.js'
import type { AdapterResult, Finding, Severity } from '../src/types.js'

let seq = 0

function finding(adapter: string, severity: Severity): Finding {
  seq += 1
  return {
    id: `${adapter}-${seq}`,
    adapter,
    severity,
    title: `${adapter} 문제 ${seq}`,
    cause: '테스트용',
    fix: { description: '없음', command: 'true' }
  }
}

/** 실행된 어댑터. severities 개수만큼 Finding을 만든다. */
function ran(adapter: string, severities: Severity[]): AdapterResult {
  return {
    adapter,
    ranAt: '2026-08-24T00:00:00.000Z',
    skipped: false,
    findings: severities.map((severity) => finding(adapter, severity))
  }
}

/** 미설치 등으로 건너뛴 어댑터. */
function skipped(adapter: string, reason: string): AdapterResult {
  return { adapter, ranAt: '2026-08-24T00:00:00.000Z', skipped: true, reason, findings: [] }
}

describe('computeHealthScore', () => {
  describe('FR-001: 배점', () => {
    // health-score-spec P1
    it('서로 다른 어댑터의 error 1건·warn 1건이면 100 - 15 - 5 = 80점이다', () => {
      const score = computeHealthScore([ran('shell-rc', ['error']), ran('git', ['warn'])])

      expect(score.score).toBe(80)
    })

    it('문제가 없으면 100점이다', () => {
      const score = computeHealthScore([ran('shell-rc', []), ran('git', [])])

      expect(score.score).toBe(100)
    })

    it('어댑터가 하나도 없으면 100점이다', () => {
      expect(computeHealthScore([]).score).toBe(100)
    })

    it("severity 'ok'는 감점하지 않는다", () => {
      const score = computeHealthScore([ran('shell-rc', ['ok', 'ok', 'ok'])])

      expect(score.score).toBe(100)
    })

    it('error는 15점, warn은 5점씩 차감한다', () => {
      expect(computeHealthScore([ran('a', ['error'])]).score).toBe(85)
      expect(computeHealthScore([ran('a', ['warn'])]).score).toBe(95)
      expect(computeHealthScore([ran('a', ['warn', 'warn'])]).score).toBe(90)
    })
  })

  describe('FR-002: 어댑터별 감점 상한 -30', () => {
    // health-score-spec P2
    it('한 어댑터에서 error 5건(-75 상당)이 나와도 감점은 -30으로 캡핑된다', () => {
      const score = computeHealthScore([ran('shell-rc', ['error', 'error', 'error', 'error', 'error'])])

      expect(score.score).toBe(70)
      expect(score.deductions).toEqual([{ adapter: 'shell-rc', deduction: 30 }])
    })

    it('상한은 어댑터마다 독립적으로 적용된다', () => {
      const score = computeHealthScore([
        ran('shell-rc', ['error', 'error', 'error']),
        ran('git', ['error', 'error', 'error'])
      ])

      expect(score.score).toBe(40)
      expect(score.deductions).toEqual([
        { adapter: 'shell-rc', deduction: 30 },
        { adapter: 'git', deduction: 30 }
      ])
    })

    it('상한에 못 미치면 실제 감점을 그대로 쓴다', () => {
      const score = computeHealthScore([ran('shell-rc', ['error', 'warn'])])

      expect(score.deductions).toEqual([{ adapter: 'shell-rc', deduction: 20 }])
    })
  })

  describe('FR-003: 하한 0점', () => {
    it('감점 합계가 100을 넘어도 0점 아래로 내려가지 않는다', () => {
      const score = computeHealthScore([
        ran('a', ['error', 'error']),
        ran('b', ['error', 'error']),
        ran('c', ['error', 'error']),
        ran('d', ['error', 'error'])
      ])

      expect(score.score).toBe(0)
    })
  })

  describe('FR-004: skip된 어댑터 제외', () => {
    // health-score-spec P3 — Docker를 쓰지 않는 사용자가 감점당하면 안 된다.
    it('skip된 어댑터는 감점하지 않는다', () => {
      const score = computeHealthScore([
        ran('shell-rc', ['warn']),
        skipped('docker', 'Docker가 설치되어 있지 않습니다')
      ])

      expect(score.score).toBe(95)
    })

    it('skip된 어댑터는 deductions 배열에 아예 포함되지 않는다', () => {
      const score = computeHealthScore([
        ran('shell-rc', ['warn']),
        skipped('docker', 'Docker가 설치되어 있지 않습니다')
      ])

      expect(score.deductions.map((d) => d.adapter)).toEqual(['shell-rc'])
    })

    it('전부 skip이면 100점이고 deductions는 비어 있다', () => {
      const score = computeHealthScore([skipped('docker', '미설치'), skipped('homebrew', '미설치')])

      expect(score.score).toBe(100)
      expect(score.deductions).toEqual([])
    })
  })

  describe('deductions 내역', () => {
    it('실행된 어댑터는 감점이 0이어도 내역에 포함한다 (UI가 "검사했고 깨끗함"을 보여줘야 한다)', () => {
      const score = computeHealthScore([ran('shell-rc', []), ran('git', ['warn'])])

      expect(score.deductions).toEqual([
        { adapter: 'shell-rc', deduction: 0 },
        { adapter: 'git', deduction: 5 }
      ])
    })

    it('입력 순서를 그대로 유지한다', () => {
      const score = computeHealthScore([ran('c', ['warn']), ran('a', ['warn']), ran('b', ['warn'])])

      expect(score.deductions.map((d) => d.adapter)).toEqual(['c', 'a', 'b'])
    })
  })

  describe('FR-005: 등급', () => {
    it('90점 이상은 정상이다', () => {
      expect(computeHealthScore([]).grade).toBe('정상')
      expect(computeHealthScore([ran('a', ['warn', 'warn'])]).grade).toBe('정상')
    })

    it('70~89점은 주의다', () => {
      expect(computeHealthScore([ran('a', ['error'])]).grade).toBe('주의')
      expect(computeHealthScore([ran('a', ['error', 'error'])]).grade).toBe('주의')
    })

    it('70점 미만은 문제 있음이다', () => {
      expect(computeHealthScore([ran('a', ['error', 'error']), ran('b', ['warn'])]).grade).toBe('문제 있음')
    })

    it('0점은 문제 있음이다', () => {
      const score = computeHealthScore([
        ran('a', ['error', 'error']),
        ran('b', ['error', 'error']),
        ran('c', ['error', 'error']),
        ran('d', ['error', 'error'])
      ])

      expect(score.grade).toBe('문제 있음')
    })

    it('경계값 90과 70이 각각 위쪽 등급에 속한다', () => {
      // 90 = 100 - warn*2, 70 = 100 - error*2
      expect(computeHealthScore([ran('a', ['warn', 'warn'])]).score).toBe(90)
      expect(computeHealthScore([ran('a', ['warn', 'warn'])]).grade).toBe('정상')
      expect(computeHealthScore([ran('a', ['error', 'error'])]).score).toBe(70)
      expect(computeHealthScore([ran('a', ['error', 'error'])]).grade).toBe('주의')
    })
  })

  describe('재현성', () => {
    it('같은 입력에 같은 결과를 낸다', () => {
      const results = [ran('shell-rc', ['error', 'warn']), skipped('docker', '미설치')]

      expect(computeHealthScore(results)).toEqual(computeHealthScore(results))
    })

    it('입력을 변경하지 않는다', () => {
      const results = [ran('shell-rc', ['error'])]
      const snapshot = JSON.parse(JSON.stringify(results))

      computeHealthScore(results)

      expect(results).toEqual(snapshot)
    })
  })
})
