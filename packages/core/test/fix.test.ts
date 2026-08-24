// fix 실행 엔진 테스트. docs/ADR.md ADR-008(안전장치 5종), docs/specs/toggle-panel-spec.md 참조.
//
// v1은 "그 줄을 통째로 지우면 해결되는" 문제에만 실제 수정을 지원한다 — shell-rc의
// missing-source / dup-alias / dead-alias 3종. 나머지는 설명·명령 복사로만 제공한다.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { runShellRcAdapter } from '../src/adapters/shell-rc.js'
import { FakeHost } from '../src/host.js'
import { applyFix, revertFix } from '../src/fix.js'
import type { Finding } from '../src/types.js'

const fixturesDir = fileURLToPath(new URL('./fixtures/zshrc/', import.meta.url))
const homedir = '/Users/fixture'
const rcPath = `${homedir}/.zshrc`

function loadFixture(name: string): string {
  return readFileSync(`${fixturesDir}${name}`, 'utf-8')
}

/** 테스트마다 시각을 고정한다 — 백업 파일명이 실행할 때마다 달라지면 단언할 수 없다. */
const FROZEN = new Date(2026, 7, 24, 17, 8, 12)
const STAMP = '20260824-170812'

interface HostExtras {
  files?: Record<string, string>
  execResults?: Record<string, { stdout: string; stderr: string; code: number }>
}

function hostWith(content: string, extra: HostExtras = {}) {
  return new FakeHost({
    homedir,
    now: FROZEN,
    files: { [rcPath]: content, ...extra.files },
    execResults: extra.execResults
  })
}

async function findingsFor(name: string, extra: HostExtras = {}): Promise<Finding[]> {
  return runShellRcAdapter(hostWith(loadFixture(name), extra))
}

/** 줄 삭제형 fix를 직접 조립한다 — 어댑터 출력에 의존하지 않는 엔진 단위 테스트용. */
function editFinding(overrides: Partial<Finding['fix']> = {}): Finding {
  return {
    id: 'test:finding',
    adapter: 'shell-rc',
    severity: 'error',
    title: '테스트용 finding',
    cause: '테스트',
    evidence: { file: rcPath, line: 2, excerpt: 'second' },
    fix: {
      description: '두 번째 줄을 지운다',
      edit: { file: rcPath, removeLine: 2, expectedLine: 'second' },
      ...overrides
    }
  }
}

describe('shell-rc가 채우는 fix.edit', () => {
  it('missing-source에 evidence와 일치하는 edit를 붙인다', async () => {
    const [finding] = await findingsFor('missing-source.zshrc')

    expect(finding.fix.edit).toEqual({
      file: finding.evidence?.file,
      removeLine: finding.evidence?.line,
      expectedLine: finding.evidence?.excerpt
    })
  })

  it('중복 alias에 edit를 붙인다 — alias 정의는 한 줄에 하나뿐이다', async () => {
    const [finding] = await findingsFor('duplicate-alias.zshrc')

    expect(finding.fix.edit?.removeLine).toBe(3)
    expect(finding.fix.edit?.expectedLine).toBe("alias ll='ls -lah'")
  })

  it('대상이 사라진 alias에 edit를 붙인다', async () => {
    const [finding] = await findingsFor('dead-alias.zshrc', {
      execResults: { 'test -e /usr/local/bin/oldtool-removed': { stdout: '', stderr: '', code: 1 } }
    })

    expect(finding.fix.edit?.removeLine).toBe(2)
    expect(finding.fix.edit?.expectedLine).toContain('oldtool')
  })

  // 한 export PATH= 줄에는 살아있는 다른 세그먼트가 함께 있다. 줄을 지우면 PATH가 통째로 날아간다.
  it('PATH 관련 finding에는 edit를 붙이지 않는다', async () => {
    const duplicate = await findingsFor('duplicate-path.zshrc')
    const missing = await findingsFor('home-var-path-missing.zshrc', {
      execResults: { [`test -e ${homedir}/does-not-exist-xyz`]: { stdout: '', stderr: '', code: 1 } }
    })

    expect(duplicate.length).toBeGreaterThan(0)
    expect(missing.length).toBeGreaterThan(0)
    for (const finding of [...duplicate, ...missing]) {
      expect(finding.fix.edit).toBeUndefined()
    }
  })

  // nvm과 asdf 중 어느 쪽을 지울지는 사람이 판단할 문제다.
  it('버전 매니저 충돌에는 edit를 붙이지 않는다', async () => {
    const all = await findingsFor('version-manager-conflict.zshrc')
    const conflicts = all.filter((finding) => finding.id.includes('version-conflict'))

    expect(conflicts.length).toBeGreaterThan(0)
    for (const finding of conflicts) expect(finding.fix.edit).toBeUndefined()
  })
})

describe('FakeHost의 쓰기 구현', () => {
  it('writeFile로 쓴 내용을 readFile로 읽는다', async () => {
    const host = hostWith('before')

    await host.writeFile(rcPath, 'after')

    expect(await host.readFile(rcPath)).toBe('after')
  })

  it('copyFile은 내용을 그대로 복제한다', async () => {
    const host = hostWith('original')

    await host.copyFile(rcPath, `${rcPath}.bak.1`)

    expect(await host.readFile(`${rcPath}.bak.1`)).toBe('original')
  })

  it('없는 원본을 copyFile하면 예외를 던진다', async () => {
    const host = hostWith('original')

    await expect(host.copyFile('/nope', '/nope.bak')).rejects.toThrow()
  })

  it('주입한 now()를 돌려준다', () => {
    expect(hostWith('x').now()).toEqual(FROZEN)
  })
})

describe('applyFix', () => {
  it('지정한 줄만 지우고 나머지는 보존한다', async () => {
    const host = hostWith('first\nsecond\nthird\n')

    const outcome = await applyFix(host, editFinding())

    expect(outcome.ok).toBe(true)
    expect(await host.readFile(rcPath)).toBe('first\nthird\n')
  })

  it('끝에 개행이 없는 파일의 개행 구조를 임의로 바꾸지 않는다', async () => {
    const host = hostWith('first\nsecond\nthird')

    await applyFix(host, editFinding())

    expect(await host.readFile(rcPath)).toBe('first\nthird')
  })

  // ADR-008 ②: 파일 수정은 반드시 백업 후에 한다.
  it('쓰기 전에 원본을 .bak.<타임스탬프>로 백업한다', async () => {
    const host = hostWith('first\nsecond\nthird\n')

    const outcome = await applyFix(host, editFinding())

    expect(outcome.backupPath).toBe(`${rcPath}.bak.${STAMP}`)
    expect(await host.readFile(outcome.backupPath!)).toBe('first\nsecond\nthird\n')
  })

  // ADR-008 ③: 권한 상승을 앱이 대신 실행하지 않는다.
  it('needsSudo면 실행을 거부하고 파일을 건드리지 않는다', async () => {
    const host = hostWith('first\nsecond\nthird\n')

    const outcome = await applyFix(host, editFinding({ needsSudo: true }))

    expect(outcome.ok).toBe(false)
    expect(outcome.error).toBeTruthy()
    expect(await host.readFile(rcPath)).toBe('first\nsecond\nthird\n')
  })

  it('edit가 없는 finding은 거부한다 — v1은 명령 실행을 지원하지 않는다', async () => {
    const host = hostWith('first\nsecond\nthird\n')
    const finding = editFinding()
    delete finding.fix.edit
    finding.fix.command = 'nvm use'

    const outcome = await applyFix(host, finding)

    expect(outcome.ok).toBe(false)
    expect(await host.readFile(rcPath)).toBe('first\nsecond\nthird\n')
  })

  // 진단 시점과 토글을 켜는 시점 사이에 파일이 편집되면 줄 번호가 밀린다.
  // 대조 없이 지우면 엉뚱한 줄이 날아간다 — 이 테스트가 그걸 막는다.
  it('대상 줄이 expectedLine과 다르면 거부하고 파일을 건드리지 않는다', async () => {
    const host = hostWith('inserted\nfirst\nsecond\nthird\n')

    const outcome = await applyFix(host, editFinding())

    expect(outcome.ok).toBe(false)
    expect(outcome.error).toBeTruthy()
    expect(await host.readFile(rcPath)).toBe('inserted\nfirst\nsecond\nthird\n')
  })

  it('줄 번호가 파일 범위를 벗어나면 거부한다', async () => {
    const host = hostWith('only one line\n')

    const outcome = await applyFix(host, editFinding())

    expect(outcome.ok).toBe(false)
    expect(await host.readFile(rcPath)).toBe('only one line\n')
  })

  it('대상 파일을 읽을 수 없으면 거부한다', async () => {
    const host = new FakeHost({ homedir, now: FROZEN, files: {} })

    const outcome = await applyFix(host, editFinding())

    expect(outcome.ok).toBe(false)
  })

  it('앞뒤 공백만 다른 줄은 같은 줄로 보고 실행한다', async () => {
    const host = hostWith('first\n   second   \nthird\n')

    const outcome = await applyFix(host, editFinding())

    expect(outcome.ok).toBe(true)
    expect(await host.readFile(rcPath)).toBe('first\nthird\n')
  })
})

describe('revertFix', () => {
  it('apply 후 revert하면 원본으로 돌아온다', async () => {
    const host = hostWith('first\nsecond\nthird\n')
    const finding = editFinding()

    const applied = await applyFix(host, finding)
    const reverted = await revertFix(host, finding, applied.backupPath!)

    expect(reverted.ok).toBe(true)
    expect(await host.readFile(rcPath)).toBe('first\nsecond\nthird\n')
  })

  // 호출자가 임의 경로를 넘겨 아무 파일이나 덮어쓰는 것을 막는다.
  it('대상 파일의 백업이 아닌 경로는 거부한다', async () => {
    const host = hostWith('first\nsecond\nthird\n', { files: { '/etc/passwd': 'root:x:0:0' } })
    const finding = editFinding()
    await applyFix(host, finding)

    const outcome = await revertFix(host, finding, '/etc/passwd')

    expect(outcome.ok).toBe(false)
    expect(await host.readFile('/etc/passwd')).toBe('root:x:0:0')
    expect(await host.readFile(rcPath)).toBe('first\nthird\n')
  })

  it('백업 파일이 없으면 거부한다', async () => {
    const host = hostWith('first\nthird\n')

    const outcome = await revertFix(host, editFinding(), `${rcPath}.bak.${STAMP}`)

    expect(outcome.ok).toBe(false)
  })

  it('edit가 없는 finding은 거부한다', async () => {
    const host = hostWith('first\nsecond\nthird\n')
    const finding = editFinding()
    delete finding.fix.edit

    const outcome = await revertFix(host, finding, `${rcPath}.bak.${STAMP}`)

    expect(outcome.ok).toBe(false)
  })
})

// 데모 서사 그대로: 진단 → 고침 → 재진단에서 사라짐 → 되돌리면 다시 나타남.
describe('진단 → fix → 재진단 왕복', () => {
  it('missing-source를 고치면 재진단에서 사라지고, 되돌리면 다시 잡힌다', async () => {
    const host = hostWith(loadFixture('missing-source.zshrc'))

    const [before] = await runShellRcAdapter(host)
    expect(before.severity).toBe('error')

    const applied = await applyFix(host, before)
    expect(applied.ok).toBe(true)
    expect(await runShellRcAdapter(host)).toHaveLength(0)

    await revertFix(host, before, applied.backupPath!)
    expect(await runShellRcAdapter(host)).toHaveLength(1)
  })
})
