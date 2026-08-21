// 어댑터 1(shell-rc) 테스트. docs/specs/adapter-shell-rc-spec.md 참조.
// fixture는 shellrc-doctor(MIT, github.com/nord342/shellrc-doctor) 골든셋 채굴 전
// 대표 패턴으로 작성한 합성(synthetic) 데이터다 — 실제 골든셋 확보 후 출처 URL로 교체 예정.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { runShellRcAdapter } from '../src/adapters/shell-rc.js'
import { FakeHost } from '../src/host.js'

const fixturesDir = fileURLToPath(new URL('./fixtures/zshrc/', import.meta.url))
const homedir = '/Users/fixture'

function loadFixture(name: string): string {
  return readFileSync(`${fixturesDir}${name}`, 'utf-8')
}

describe('runShellRcAdapter', () => {
  it('정상적인 .zshrc에서는 Finding이 없다', async () => {
    const host = new FakeHost({
      homedir,
      files: { [`${homedir}/.zshrc`]: loadFixture('clean.zshrc') }
    })

    const findings = await runShellRcAdapter(host)

    expect(findings).toEqual([])
  })

  it('중복 PATH 엔트리를 파일:줄과 함께 감지한다', async () => {
    const host = new FakeHost({
      homedir,
      files: { [`${homedir}/.zshrc`]: loadFixture('duplicate-path.zshrc') }
    })

    const findings = await runShellRcAdapter(host)

    expect(findings).toHaveLength(1)
    const [finding] = findings
    expect(finding.adapter).toBe('shell-rc')
    expect(finding.severity).toBe('warn')
    expect(finding.evidence?.file).toBe(`${homedir}/.zshrc`)
    expect(finding.evidence?.line).toBe(2)
    expect(finding.evidence?.excerpt).toContain('PATH')
    expect(finding.fix.description.length).toBeGreaterThan(0)
    expect(finding.fix.command).toBeUndefined()
  })

  it('대상이 사라진 죽은 alias를 감지한다', async () => {
    const host = new FakeHost({
      homedir,
      files: { [`${homedir}/.zshrc`]: loadFixture('dead-alias.zshrc') },
      execResults: {
        'test -e /usr/local/bin/oldtool-removed': { stdout: '', stderr: '', code: 1 }
      }
    })

    const findings = await runShellRcAdapter(host)

    expect(findings).toHaveLength(1)
    const [finding] = findings
    expect(finding.severity).toBe('warn')
    expect(finding.evidence?.line).toBe(2)
    expect(finding.evidence?.excerpt).toContain('oldtool')
  })

  it('존재하지 않는 파일을 source하는 줄을 감지한다', async () => {
    const host = new FakeHost({
      homedir,
      files: { [`${homedir}/.zshrc`]: loadFixture('missing-source.zshrc') }
    })

    const findings = await runShellRcAdapter(host)

    expect(findings).toHaveLength(1)
    const [finding] = findings
    expect(finding.severity).toBe('error')
    expect(finding.evidence?.line).toBe(2)
    expect(finding.evidence?.excerpt).toContain('.nonexistent-config.sh')
  })

  it('같은 이름의 alias가 다시 정의되면 중복으로 감지한다', async () => {
    const host = new FakeHost({
      homedir,
      files: { [`${homedir}/.zshrc`]: loadFixture('duplicate-alias.zshrc') }
    })

    const findings = await runShellRcAdapter(host)

    expect(findings).toHaveLength(1)
    const [finding] = findings
    expect(finding.severity).toBe('warn')
    expect(finding.evidence?.line).toBe(3)
    expect(finding.evidence?.excerpt).toContain('ll')
  })

  it('rc 파일 안에서 nvm+asdf 초기화 충돌을 감지한다 (FR-009, 어댑터 2와 겹치지 않는 영역)', async () => {
    const host = new FakeHost({
      homedir,
      files: {
        [`${homedir}/.zshrc`]: loadFixture('version-manager-conflict.zshrc'),
        // 이 경로가 실제로 존재하는 것으로 취급해 "missing source" 판정과 겹치지 않게 한다.
        '/opt/homebrew/opt/asdf/libexec/asdf.sh': '# asdf init stub\n'
      }
    })

    const findings = await runShellRcAdapter(host)

    expect(findings).toHaveLength(1)
    const [finding] = findings
    expect(finding.severity).toBe('warn')
    expect(finding.evidence?.line).toBe(3)
    expect(finding.cause.toLowerCase()).toContain('nvm')
  })

  it('.bashrc/.zprofile이 없으면 조용히 건너뛴다(에러 없음)', async () => {
    const host = new FakeHost({
      homedir,
      files: { [`${homedir}/.zshrc`]: loadFixture('clean.zshrc') }
    })

    await expect(runShellRcAdapter(host)).resolves.toEqual([])
  })

  it('한 파일에 서로 다른 문제가 여러 건 있으면 각각 서로 다른 id를 갖는다', async () => {
    const host = new FakeHost({
      homedir,
      files: { [`${homedir}/.zshrc`]: loadFixture('multiple-issues.zshrc') }
    })

    const findings = await runShellRcAdapter(host)

    expect(findings).toHaveLength(2)
    const ids = findings.map((f) => f.id)
    expect(new Set(ids).size).toBe(2)
    expect(findings.every((f) => f.id.length > 0)).toBe(true)
  })
})
