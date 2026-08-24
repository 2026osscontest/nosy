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

  // 회귀 테스트 — 실제 ~/.zshrc로 검증하다 발견한 오탐. p10k의 `${XDG_CACHE_HOME:-...}`와
  // oh-my-zsh의 `$ZSH/oh-my-zsh.sh`를 "존재하지 않는 파일"로 단정해 error를 냈다.
  // 셸을 돌려야만 알 수 있는 경로는 확인할 수 없으므로 단정하지 않는다 — 오탐보다 미탐이 낫다.
  it('해석할 수 없는 셸 확장이 든 경로는 문제로 보고하지 않는다', async () => {
    const host = new FakeHost({
      homedir,
      files: { [`${homedir}/.zshrc`]: loadFixture('unresolvable-expansion.zshrc') },
      execResults: {
        // 확장하지 못한 리터럴을 그대로 조회하면 당연히 실패한다 — 그 실패를 근거로 삼으면 안 된다.
        'which $KUBECTL_BIN': { stdout: '', stderr: '', code: 1 },
        'test -e $CARGO_HOME/bin': { stdout: '', stderr: '', code: 1 }
      }
    })

    await expect(runShellRcAdapter(host)).resolves.toEqual([])
  })

  // source 분기만 expandHomePrefix를 빠뜨려, 멀쩡한 `source $HOME/...`을 전부 error로 냈다.
  it('source 경로의 $HOME과 ~를 확장한 뒤 존재를 확인한다', async () => {
    const host = new FakeHost({
      homedir,
      files: {
        [`${homedir}/.zshrc`]: loadFixture('home-var-source.zshrc'),
        [`${homedir}/.exists.sh`]: '# stub\n',
        [`${homedir}/.tilde-exists.sh`]: '# stub\n'
      }
    })

    const findings = await runShellRcAdapter(host)

    expect(findings).toHaveLength(1)
    expect(findings[0].evidence?.line).toBe(2)
    expect(findings[0].cause).toContain('.missing.sh')
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

  // 회귀 테스트 — code-review에서 발견된 버그: NodeHost.exec는 execFile로 셸을 거치지 않으므로
  // $HOME/~ 같은 셸 변수·틸드가 확장되지 않은 채 test/which에 리터럴로 전달되면 안 된다.
  // 어댑터는 host.exec를 호출하기 전에 자체적으로 $HOME/~를 host.homedir로 치환해야 한다.
  it('PATH 항목의 $HOME을 확장한 뒤 존재를 확인한다 (리터럴 "$HOME/bin"으로 조회하면 안 됨)', async () => {
    const host = new FakeHost({
      homedir,
      files: { [`${homedir}/.zshrc`]: loadFixture('home-var-path.zshrc') },
      execResults: {
        // 버그가 있는 구현은 이 리터럴 키를 조회해 실패로 오판한다.
        'test -e $HOME/bin': { stdout: '', stderr: '', code: 1 },
        // 올바른 구현은 $HOME을 homedir로 확장한 뒤 이 키를 조회해야 하며, 존재하는 것으로 등록돼 있다.
        [`test -e ${homedir}/bin`]: { stdout: '', stderr: '', code: 0 }
      }
    })

    const findings = await runShellRcAdapter(host)

    expect(findings).toEqual([])
  })

  it('$HOME을 확장해도 실제로 없는 PATH 항목은 여전히 감지한다 ($HOME 세그먼트를 통째로 건너뛰는 꼼수 방지)', async () => {
    const host = new FakeHost({
      homedir,
      files: { [`${homedir}/.zshrc`]: loadFixture('home-var-path-missing.zshrc') },
      execResults: {
        [`test -e ${homedir}/does-not-exist-xyz`]: { stdout: '', stderr: '', code: 1 }
      }
    })

    const findings = await runShellRcAdapter(host)

    expect(findings).toHaveLength(1)
    expect(findings[0].severity).toBe('warn')
    expect(findings[0].evidence?.line).toBe(1)
  })

  it('cd/source 같은 셸 빌트인을 가리키는 alias는 죽은 alias로 오판하지 않는다', async () => {
    const host = new FakeHost({
      homedir,
      files: { [`${homedir}/.zshrc`]: loadFixture('builtin-alias.zshrc') },
      execResults: {
        // 버그가 있는 구현은 빌트인도 그냥 which로 조회하며, 실제 which는 빌트인을 못 찾아 실패한다.
        'which cd': { stdout: '', stderr: '', code: 1 },
        'which source': { stdout: '', stderr: '', code: 1 }
      }
    })

    const findings = await runShellRcAdapter(host)

    expect(findings).toEqual([])
  })
})
