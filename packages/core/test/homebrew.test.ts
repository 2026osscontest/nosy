// 어댑터 3(homebrew) 테스트. docs/specs/adapter-homebrew-spec.md 참조.
//
// fixture의 경고 원문·remediation 명령은 실제 Homebrew 6.0.17의
// Library/Homebrew/diagnostic.rb에서 그대로 가져왔다 (core-types-spec FR-009: 골든셋 출처 명시).
//   - You have unlinked kegs...        : check_for_unlinked_but_not_keg_only
//   - Broken symlinks were found...    : check_for_broken_symlinks       (remediation: brew cleanup)
//   - You have multiple Cellars.       : check_multiple_cellars          (remediation: rm -rf .../Cellar)
//   - ...not writable by your user     : check_access_directories        (remediation: sudo chown -R)
//   - TMPDIR ... doesn't exist.        : check_tmpdir                    (remediation 없음)
// 출처: https://github.com/Homebrew/brew/blob/main/Library/Homebrew/diagnostic.rb

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createHomebrewAdapter } from '../src/adapters/homebrew.js'
import { FakeHost, type ExecResult } from '../src/host.js'
import type { Finding } from '../src/types.js'

const fixturesDir = fileURLToPath(new URL('./fixtures/brew-doctor/', import.meta.url))

function fixture(name: string): string {
  return readFileSync(`${fixturesDir}${name}`, 'utf-8')
}

/** exec 호출을 기록해 "brew doctor를 몇 번 돌렸는지"를 검증할 수 있게 한다. */
class CountingHost extends FakeHost {
  readonly calls: string[] = []

  override async exec(cmd: string, args: string[]): Promise<ExecResult> {
    this.calls.push([cmd, ...args].join(' '))
    return super.exec(cmd, args)
  }

  countOf(command: string): number {
    return this.calls.filter((call) => call === command).length
  }
}

const BREW_INSTALLED: ExecResult = { stdout: '/opt/homebrew/bin/brew\n', stderr: '', code: 0 }
const BREW_MISSING: ExecResult = { stdout: '', stderr: '', code: 1 }

/**
 * brew가 설치되어 있고 `brew doctor --json`이 주어진 stdout을 내는 호스트.
 * exitCode 기본값이 1인 것은 의도적이다 — brew doctor는 문제를 찾으면 0이 아닌 코드로 끝난다.
 */
function brewHost(doctorStdout: string, exitCode = 1): CountingHost {
  return new CountingHost({
    execResults: {
      'which brew': BREW_INSTALLED,
      'brew doctor --json': { stdout: doctorStdout, stderr: '', code: exitCode }
    }
  })
}

/** skipReason → run 순서로 한 사이클 돌린다 (runAdapters가 실제로 호출하는 순서). */
async function runCycle(host: CountingHost): Promise<Finding[]> {
  const adapter = createHomebrewAdapter()
  const reason = adapter.skipReason ? await adapter.skipReason(host) : null

  expect(reason).toBeNull()

  return adapter.run(host)
}

function byTitleContaining(findings: Finding[], needle: string): Finding {
  const found = findings.find((f) => f.title.includes(needle))

  expect(found, `"${needle}"를 포함하는 Finding이 없다`).toBeDefined()

  return found as Finding
}

describe('createHomebrewAdapter', () => {
  describe('어댑터 메타', () => {
    it('이름은 homebrew다', () => {
      expect(createHomebrewAdapter().name).toBe('homebrew')
    })

    it("kind는 'wrapping'이다 (외부 CLI 래핑이라 30분 주기 대상이 아니다 — drift FR-006)", () => {
      expect(createHomebrewAdapter().kind).toBe('wrapping')
    })

    it('호출마다 독립된 인스턴스를 만든다 (캐시가 인스턴스 간에 새지 않는다)', () => {
      expect(createHomebrewAdapter()).not.toBe(createHomebrewAdapter())
    })
  })

  describe('FR-003/004: skip 판정', () => {
    it('Homebrew가 미설치면 사유 문자열을 반환한다', async () => {
      const host = new CountingHost({ execResults: { 'which brew': BREW_MISSING } })

      const reason = await createHomebrewAdapter().skipReason!(host)

      expect(reason).toBeTruthy()
      expect(reason).toContain('Homebrew')
    })

    it('미설치일 때는 brew doctor를 실행하지 않는다', async () => {
      const host = new CountingHost({ execResults: { 'which brew': BREW_MISSING } })

      await createHomebrewAdapter().skipReason!(host)

      expect(host.countOf('brew doctor --json')).toBe(0)
    })

    it('--json 미지원 버전(평문 출력)이면 사유 문자열을 반환한다', async () => {
      const host = brewHost('Your system is ready to brew.\n')

      const reason = await createHomebrewAdapter().skipReason!(host)

      expect(reason).toBeTruthy()
    })

    it('미설치와 --json 미지원은 서로 다른 사유 문자열이다 (사용자에게 다른 상황이다)', async () => {
      const absent = new CountingHost({ execResults: { 'which brew': BREW_MISSING } })
      const noJson = brewHost('Your system is ready to brew.\n')

      const absentReason = await createHomebrewAdapter().skipReason!(absent)
      const noJsonReason = await createHomebrewAdapter().skipReason!(noJson)

      expect(absentReason).not.toBe(noJsonReason)
    })

    it('정상이면 null을 반환한다', async () => {
      const host = brewHost(fixture('clean.json'), 0)

      expect(await createHomebrewAdapter().skipReason!(host)).toBeNull()
    })

    // adapter-homebrew-spec "함정": brew doctor는 문제를 찾으면 0이 아닌 코드로 끝난다.
    it('종료 코드가 0이 아니어도 JSON이 파싱되면 skip하지 않는다', async () => {
      const host = brewHost(fixture('unlinked-kegs.json'), 1)

      expect(await createHomebrewAdapter().skipReason!(host)).toBeNull()
    })
  })

  describe('FR-001/002: 파싱과 매핑', () => {
    it('경고가 없으면 Finding이 없다', async () => {
      expect(await runCycle(brewHost(fixture('clean.json'), 0))).toEqual([])
    })

    it('text 첫 줄을 title로, 전문을 cause로 옮긴다', async () => {
      const [found] = await runCycle(brewHost(fixture('unlinked-kegs.json')))

      expect(found.title).toBe('You have unlinked kegs in your Cellar.')
      expect(found.cause).toContain('Leaving kegs unlinked can lead to build-trouble')
    })

    it('affects를 cause에 덧붙인다', async () => {
      const [found] = await runCycle(brewHost(fixture('unlinked-kegs.json')))

      expect(found.cause).toContain('node')
      expect(found.cause).toContain('python@3.12')
    })

    it('remediation.commands[0]을 fix.command로, remediation.text를 fix.description으로 옮긴다', async () => {
      const [found] = await runCycle(brewHost(fixture('unlinked-kegs.json')))

      expect(found.fix.command).toBe('brew link node')
      expect(found.fix.description).toContain('Run `brew link` on these')
    })

    it('links[0]을 reference로 옮긴다', async () => {
      const [found] = await runCycle(brewHost(fixture('unlinked-kegs.json')))

      expect(found.reference).toBe('https://docs.brew.sh/FAQ')
    })

    it('links가 비어 있으면 reference를 채우지 않는다', async () => {
      const found = byTitleContaining(await runCycle(brewHost(fixture('mixed.json'))), 'Broken symlinks')

      expect(found.reference).toBeUndefined()
    })

    it('adapter 필드는 homebrew다', async () => {
      const [found] = await runCycle(brewHost(fixture('unlinked-kegs.json')))

      expect(found.adapter).toBe('homebrew')
    })

    // FR-002: brew doctor 경고는 파일:줄을 가리킬 수 없다.
    it('evidence를 채우지 않는다', async () => {
      const findings = await runCycle(brewHost(fixture('mixed.json')))

      expect(findings.every((f) => f.evidence === undefined)).toBe(true)
    })
  })

  describe('FR-008: severity는 warn 고정', () => {
    it('모든 Finding의 severity가 warn이다', async () => {
      const findings = await runCycle(brewHost(fixture('mixed.json')))

      expect(findings.length).toBeGreaterThan(0)
      expect(findings.every((f) => f.severity === 'warn')).toBe(true)
    })

    // "함정": tier는 Homebrew의 지원 등급이지 심각도가 아니다.
    it('tier가 3이어도 severity를 올리지 않는다', async () => {
      const json = JSON.stringify({
        tier: 3,
        findings: [
          {
            text: 'You are using an unsupported configuration.\n',
            tier: 3,
            affects: [],
            links: [],
            remediation: { text: 'Fix it.\n', commands: ['brew update'] }
          }
        ]
      })

      const [found] = await runCycle(brewHost(json))

      expect(found.severity).toBe('warn')
    })
  })

  describe('FR-005: 고칠 방법이 없는 항목은 버린다', () => {
    it('remediation이 null이거나 commands가 비면 Finding으로 만들지 않는다', async () => {
      expect(await runCycle(brewHost(fixture('no-remediation.json')))).toEqual([])
    })

    it('mixed에서 remediation이 없는 TMPDIR 항목만 빠지고 나머지 4건이 남는다', async () => {
      const findings = await runCycle(brewHost(fixture('mixed.json')))

      expect(findings).toHaveLength(4)
      expect(findings.some((f) => f.title.includes('TMPDIR'))).toBe(false)
    })
  })

  describe('FR-006: 파괴적 명령은 fix.command로 주지 않는다 (ADR-008)', () => {
    it('brew cleanup은 fix.command 대신 fix.manual로 제공한다', async () => {
      const found = byTitleContaining(await runCycle(brewHost(fixture('mixed.json'))), 'Broken symlinks')

      expect(found.fix.command).toBeUndefined()
      expect(found.fix.manual).toContain('brew cleanup')
    })

    it('rm 계열 명령도 fix.command 대신 fix.manual로 제공한다', async () => {
      const found = byTitleContaining(await runCycle(brewHost(fixture('mixed.json'))), 'multiple Cellars')

      expect(found.fix.command).toBeUndefined()
      expect(found.fix.manual).toContain('/opt/homebrew/Cellar')
    })

    it('파괴적 판정은 단어 경계로 한다 (brew install charm을 rm으로 오판하지 않는다)', async () => {
      const json = JSON.stringify({
        tier: 1,
        findings: [
          {
            text: 'Some installed formulae are missing dependencies.\n',
            tier: 1,
            affects: [],
            links: [],
            remediation: { text: 'Install them.\n', commands: ['brew install charm'] }
          }
        ]
      })

      const [found] = await runCycle(brewHost(json))

      expect(found.fix.command).toBe('brew install charm')
      expect(found.fix.manual).toBeUndefined()
    })
  })

  describe('FR-007: sudo 표시', () => {
    it('sudo로 시작하는 명령은 needsSudo를 켠다', async () => {
      const found = byTitleContaining(await runCycle(brewHost(fixture('mixed.json'))), 'not writable')

      expect(found.fix.needsSudo).toBe(true)
      expect(found.fix.command).toBe('sudo chown -R dnnals /opt/homebrew/share')
    })

    it('sudo가 아닌 명령에는 needsSudo를 켜지 않는다', async () => {
      const [found] = await runCycle(brewHost(fixture('unlinked-kegs.json')))

      expect(found.fix.needsSudo).toBeFalsy()
    })
  })

  describe('core-types FR-008: 행동 지침 없는 Finding 금지', () => {
    // evidence가 없는 어댑터이므로 fix.command 또는 fix.manual 중 하나는 반드시 있어야 한다.
    it('모든 Finding이 fix.command 또는 fix.manual을 가진다', async () => {
      const findings = await runCycle(brewHost(fixture('mixed.json')))

      expect(findings.length).toBeGreaterThan(0)
      expect(findings.every((f) => Boolean(f.fix.command) || Boolean(f.fix.manual))).toBe(true)
    })
  })

  describe('core-types FR-005: id 안정성 (드리프트 diff 키)', () => {
    it('같은 입력이면 같은 id가 나온다', async () => {
      const first = await runCycle(brewHost(fixture('mixed.json')))
      const second = await runCycle(brewHost(fixture('mixed.json')))

      expect(first.map((f) => f.id)).toEqual(second.map((f) => f.id))
    })

    it('서로 다른 경고는 서로 다른 id를 가진다', async () => {
      const ids = (await runCycle(brewHost(fixture('mixed.json')))).map((f) => f.id)

      expect(new Set(ids).size).toBe(ids.length)
    })

    it('id는 homebrew 어댑터임을 식별할 수 있다', async () => {
      const findings = await runCycle(brewHost(fixture('mixed.json')))

      expect(findings.every((f) => f.id.startsWith('homebrew'))).toBe(true)
    })
  })

  describe('1회성 캐시: brew doctor 중복 실행 방지', () => {
    it('skipReason → run 한 사이클에서 brew doctor를 한 번만 실행한다', async () => {
      const host = brewHost(fixture('mixed.json'))

      await runCycle(host)

      expect(host.countOf('brew doctor --json')).toBe(1)
    })

    it('캐시는 run 한 번에 소비되고, 다음 run은 다시 실행한다 (stale 결과 재사용 금지)', async () => {
      const host = brewHost(fixture('mixed.json'))
      const adapter = createHomebrewAdapter()

      await adapter.skipReason!(host)
      await adapter.run(host)
      await adapter.run(host)

      expect(host.countOf('brew doctor --json')).toBe(2)
    })

    it('skipReason 없이 run만 호출해도 동작한다', async () => {
      const host = brewHost(fixture('unlinked-kegs.json'))

      const findings = await createHomebrewAdapter().run(host)

      expect(findings).toHaveLength(1)
      expect(host.countOf('brew doctor --json')).toBe(1)
    })
  })
})
