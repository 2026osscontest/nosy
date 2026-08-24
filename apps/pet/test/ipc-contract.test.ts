// IPC 계약의 순수 로직 테스트. Electron을 import하지 않는다.
// 펫 상태 매핑은 docs/UI_GUIDE.md "캐릭터 상태 4종" 표가 정본이다:
//   idle     = 모든 어댑터 정상
//   thinking = 진단 실행 중
//   worried  = warn 있음
//   alarmed  = error 있음 또는 새 드리프트 감지

import { describe, expect, it } from 'vitest'
import type { AdapterResult, DriftResult, Finding, Severity } from '@nosy/core'
import { CHANNEL, buildSnapshot, petStateFor, thinkingSnapshot } from '../shared/ipc'

let seq = 0

function finding(adapter: string, severity: Severity): Finding {
  seq += 1
  return {
    id: `${adapter}-${seq}`,
    adapter,
    severity,
    title: `${adapter} 문제`,
    cause: '테스트용',
    fix: { description: '없음', command: 'true' }
  }
}

function ran(adapter: string, severities: Severity[]): AdapterResult {
  return {
    adapter,
    ranAt: '2026-08-24T12:00:00.000Z',
    skipped: false,
    findings: severities.map((s) => finding(adapter, s))
  }
}

function skipped(adapter: string, reason: string): AdapterResult {
  return { adapter, ranAt: '2026-08-24T12:00:00.000Z', skipped: true, reason, findings: [] }
}

const NO_DRIFT: DriftResult = { hasNewError: false, newFindings: [] }
const NEW_ERROR_DRIFT: DriftResult = {
  hasNewError: true,
  newFindings: [finding('docker', 'error')]
}

describe('CHANNEL', () => {
  it('채널 6종을 정의한다', () => {
    expect(Object.keys(CHANNEL).sort()).toEqual(
      ['applyFix', 'moveBy', 'revertFix', 'run', 'setClickThrough', 'state'].sort()
    )
  })

  it('모든 채널 이름이 nosy: 접두사를 쓴다 (다른 앱·라이브러리와 충돌하지 않게)', () => {
    expect(Object.values(CHANNEL).every((c) => c.startsWith('nosy:'))).toBe(true)
  })

  it('채널 이름이 서로 겹치지 않는다', () => {
    const values = Object.values(CHANNEL)

    expect(new Set(values).size).toBe(values.length)
  })
})

describe('petStateFor', () => {
  it('어댑터 결과가 없으면 idle이다', () => {
    expect(petStateFor([], NO_DRIFT)).toBe('idle')
  })

  it('모든 어댑터가 깨끗하면 idle이다', () => {
    expect(petStateFor([ran('shell-rc', []), ran('git', [])], NO_DRIFT)).toBe('idle')
  })

  it('warn이 있으면 worried다', () => {
    expect(petStateFor([ran('shell-rc', ['warn'])], NO_DRIFT)).toBe('worried')
  })

  it('error가 있으면 alarmed다', () => {
    expect(petStateFor([ran('shell-rc', ['error'])], NO_DRIFT)).toBe('alarmed')
  })

  it('warn과 error가 같이 있으면 alarmed가 이긴다', () => {
    expect(petStateFor([ran('shell-rc', ['warn', 'error'])], NO_DRIFT)).toBe('alarmed')
  })

  it('error가 다른 어댑터에 흩어져 있어도 alarmed다', () => {
    const results = [ran('shell-rc', ['warn']), ran('docker', ['error'])]

    expect(petStateFor(results, NO_DRIFT)).toBe('alarmed')
  })

  // drift-detection-spec FR-004: 새 error가 생기면 펫을 alarmed로 전환한다.
  it('findings가 깨끗해도 새 드리프트가 있으면 alarmed다', () => {
    expect(petStateFor([ran('shell-rc', [])], NEW_ERROR_DRIFT)).toBe('alarmed')
  })

  it("severity 'ok'는 상태를 올리지 않는다", () => {
    expect(petStateFor([ran('shell-rc', ['ok', 'ok'])], NO_DRIFT)).toBe('idle')
  })

  it('skip된 어댑터만 있으면 idle이다 (미설치가 걱정거리는 아니다)', () => {
    const results = [skipped('docker', 'Docker가 설치되어 있지 않습니다')]

    expect(petStateFor(results, NO_DRIFT)).toBe('idle')
  })

  it('thinking은 반환하지 않는다 (진단 실행 중 상태는 별도 경로다)', () => {
    expect(petStateFor([ran('shell-rc', ['error'])], NEW_ERROR_DRIFT)).not.toBe('thinking')
  })
})

describe('buildSnapshot', () => {
  const results = [ran('shell-rc', ['warn']), skipped('docker', 'Docker 미설치')]
  const ranAt = '2026-08-24T12:34:56.000Z'

  it('petState를 petStateFor와 같은 규칙으로 채운다', () => {
    const snap = buildSnapshot(results, NO_DRIFT, ranAt)

    expect(snap.petState).toBe(petStateFor(results, NO_DRIFT))
    expect(snap.petState).toBe('worried')
  })

  it('헬스 스코어를 계산해 담는다', () => {
    const snap = buildSnapshot(results, NO_DRIFT, ranAt)

    expect(snap.score.score).toBe(95)
    expect(snap.score.grade).toBe('정상')
  })

  it('skip된 어댑터를 results에 그대로 남긴다 (UI가 "해당 없음"을 표기해야 한다)', () => {
    const snap = buildSnapshot(results, NO_DRIFT, ranAt)
    const docker = snap.results.find((r) => r.adapter === 'docker')

    expect(docker?.skipped).toBe(true)
    expect(docker?.reason).toBe('Docker 미설치')
  })

  it('drift와 ranAt을 그대로 싣는다', () => {
    const snap = buildSnapshot(results, NEW_ERROR_DRIFT, ranAt)

    expect(snap.drift).toEqual(NEW_ERROR_DRIFT)
    expect(snap.ranAt).toBe(ranAt)
  })

  it('드리프트가 있으면 점수가 정상이어도 alarmed가 된다', () => {
    const snap = buildSnapshot([ran('shell-rc', [])], NEW_ERROR_DRIFT, ranAt)

    expect(snap.score.score).toBe(100)
    expect(snap.petState).toBe('alarmed')
  })
})

describe('thinkingSnapshot', () => {
  it('petState를 thinking으로 만든다', () => {
    expect(thinkingSnapshot().petState).toBe('thinking')
  })

  it('이전 스냅샷이 없으면 100점·빈 결과로 시작한다 (앱 첫 기동)', () => {
    const snap = thinkingSnapshot()

    expect(snap.score.score).toBe(100)
    expect(snap.results).toEqual([])
    expect(snap.drift.hasNewError).toBe(false)
  })

  it('이전 스냅샷이 있으면 점수·결과를 유지한 채 표정만 바꾼다', () => {
    const previous = buildSnapshot([ran('shell-rc', ['warn'])], NO_DRIFT, '2026-08-24T12:00:00.000Z')

    const snap = thinkingSnapshot(previous)

    expect(snap.petState).toBe('thinking')
    expect(snap.score).toEqual(previous.score)
    expect(snap.results).toEqual(previous.results)
  })

  it('이전 스냅샷을 변경하지 않는다', () => {
    const previous = buildSnapshot([ran('shell-rc', ['warn'])], NO_DRIFT, '2026-08-24T12:00:00.000Z')
    const before = JSON.parse(JSON.stringify(previous))

    thinkingSnapshot(previous)

    expect(previous).toEqual(before)
  })
})
