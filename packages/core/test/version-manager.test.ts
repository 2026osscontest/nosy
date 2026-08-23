// 어댑터 2(version-manager) 테스트. docs/specs/adapter-version-manager-spec.md 참조.
// FR-004(rc 파일 안 nvm+asdf 등 매니저 간 충돌)는 어댑터 1(shell-rc)의 몫이므로 여기서 다루지 않는다.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { runVersionManagerAdapter } from '../src/adapters/version-manager.js'
import { FakeHost, type ExecResult } from '../src/host.js'

const fixturesDir = fileURLToPath(new URL('./fixtures/version-manager/', import.meta.url))
const homedir = '/Users/fixture'

function loadFixture(name: string): string {
  return readFileSync(`${fixturesDir}${name}`, 'utf-8')
}

// nvm/pyenv "미설치"를 기본값으로 깐다 — FakeHost는 스텁 없는 exec 키를 code:0(성공)으로
// 취급하므로, FR-003(초기화 누락) 판정용 exec가 다른 테스트를 오염시키지 않게 명시적으로 막는다.
function notInstalledExecResults(): Record<string, ExecResult> {
  return {
    [`test -e ${homedir}/.nvm`]: { stdout: '', stderr: '', code: 1 },
    'which pyenv': { stdout: '', stderr: '', code: 1 }
  }
}

describe('runVersionManagerAdapter', () => {
  it('아무 문제가 없으면 Finding이 없다', async () => {
    const host = new FakeHost({
      homedir,
      execResults: notInstalledExecResults()
    })

    const findings = await runVersionManagerAdapter(host)

    expect(findings).toEqual([])
  })

  // FR-001: PATH 우선순위 충돌
  describe('FR-001: PATH 우선순위 충돌', () => {
    it('pyenv shim이 시스템 바이너리보다 PATH에서 뒤에 있으면 감지한다', async () => {
      const host = new FakeHost({
        homedir,
        env: { PATH: `/usr/bin:/usr/local/bin:${homedir}/.pyenv/shims` },
        execResults: {
          ...notInstalledExecResults(),
          [`test -e ${homedir}/.pyenv/shims`]: { stdout: '', stderr: '', code: 0 }
        }
      })

      const findings = await runVersionManagerAdapter(host)

      expect(findings).toHaveLength(1)
      const [finding] = findings
      expect(finding.adapter).toBe('version-manager')
      expect(finding.severity).toBe('warn')
      expect(finding.id).toContain('pyenv')
      expect(finding.evidence).toBeUndefined()
      expect(finding.fix.command).toBeTruthy()
    })

    it('pyenv shim이 PATH 맨 앞에 있으면 충돌로 보지 않는다', async () => {
      const host = new FakeHost({
        homedir,
        env: { PATH: `${homedir}/.pyenv/shims:/usr/bin:/usr/local/bin` },
        execResults: {
          ...notInstalledExecResults(),
          [`test -e ${homedir}/.pyenv/shims`]: { stdout: '', stderr: '', code: 0 }
        }
      })

      const findings = await runVersionManagerAdapter(host)

      expect(findings).toEqual([])
    })

    it('nvm shim(NVM_BIN)이 시스템 바이너리보다 PATH에서 뒤에 있으면 감지한다', async () => {
      const nvmBin = `${homedir}/.nvm/versions/node/v20.11.0/bin`
      const host = new FakeHost({
        homedir,
        env: { PATH: `/usr/bin:${nvmBin}`, NVM_BIN: nvmBin },
        execResults: {
          ...notInstalledExecResults(),
          [`test -e ${nvmBin}`]: { stdout: '', stderr: '', code: 0 }
        }
      })

      const findings = await runVersionManagerAdapter(host)

      expect(findings).toHaveLength(1)
      const [finding] = findings
      expect(finding.id).toContain('nvm')
      expect(finding.evidence).toBeUndefined()
      expect(finding.fix.command).toBeTruthy()
    })

    it('NVM_BIN이 세팅되지 않으면 nvm 우선순위 판정을 스킵한다', async () => {
      const host = new FakeHost({
        homedir,
        env: { PATH: '/usr/bin:/usr/local/bin' },
        execResults: notInstalledExecResults()
      })

      const findings = await runVersionManagerAdapter(host)

      expect(findings).toEqual([])
    })

    it('shim 디렉터리가 PATH 문자열에 있어도 실제로 설치되어 있지 않으면(디렉터리 없음) 무시한다', async () => {
      const host = new FakeHost({
        homedir,
        env: { PATH: `/usr/bin:${homedir}/.pyenv/shims` },
        execResults: {
          ...notInstalledExecResults(),
          [`test -e ${homedir}/.pyenv/shims`]: { stdout: '', stderr: '', code: 1 }
        }
      })

      const findings = await runVersionManagerAdapter(host)

      expect(findings).toEqual([])
    })
  })

  // FR-002: .nvmrc/.python-version과 실제 활성 버전 불일치
  describe('FR-002: 버전 파일과 실제 활성 버전 불일치', () => {
    it('.nvmrc가 요구하는 버전과 실제 활성 Node 버전이 다르면 감지한다', async () => {
      const host = new FakeHost({
        homedir,
        files: { '.nvmrc': '20.0.0\n' },
        execResults: {
          ...notInstalledExecResults(),
          'node -v': { stdout: 'v18.17.0\n', stderr: '', code: 0 }
        }
      })

      const findings = await runVersionManagerAdapter(host)

      expect(findings).toHaveLength(1)
      const [finding] = findings
      expect(finding.adapter).toBe('version-manager')
      expect(finding.severity).toBe('warn')
      expect(finding.evidence?.file).toBe('.nvmrc')
      expect(finding.evidence?.line).toBe(1)
      expect(finding.cause).toContain('20.0.0')
      expect(finding.cause).toContain('18.17.0')
    })

    it('.nvmrc 요구 버전이 활성 버전과 정확히 일치하면 Finding이 없다', async () => {
      const host = new FakeHost({
        homedir,
        files: { '.nvmrc': '18.17.0' },
        execResults: {
          ...notInstalledExecResults(),
          'node -v': { stdout: 'v18.17.0\n', stderr: '', code: 0 }
        }
      })

      const findings = await runVersionManagerAdapter(host)

      expect(findings).toEqual([])
    })

    it('.nvmrc가 major 버전만 요구하면 활성 버전의 접두사 일치로 만족한다', async () => {
      const host = new FakeHost({
        homedir,
        files: { '.nvmrc': '18' },
        execResults: {
          ...notInstalledExecResults(),
          'node -v': { stdout: 'v18.17.0\n', stderr: '', code: 0 }
        }
      })

      const findings = await runVersionManagerAdapter(host)

      expect(findings).toEqual([])
    })

    it('.nvmrc가 "v" 접두사를 포함한 형식("v18.17.0")이어도 별칭으로 오인하지 않고 불일치를 감지한다', async () => {
      const host = new FakeHost({
        homedir,
        files: { '.nvmrc': 'v20.0.0\n' },
        execResults: {
          ...notInstalledExecResults(),
          'node -v': { stdout: 'v18.17.0\n', stderr: '', code: 0 }
        }
      })

      const findings = await runVersionManagerAdapter(host)

      expect(findings).toHaveLength(1)
      const [finding] = findings
      expect(finding.evidence?.file).toBe('.nvmrc')
      expect(finding.cause).toContain('20.0.0')
      expect(finding.cause).toContain('18.17.0')
    })

    it('.nvmrc가 별칭(lts/*)이면 해석할 수 없으므로 검사를 스킵한다', async () => {
      const host = new FakeHost({
        homedir,
        files: { '.nvmrc': 'lts/hydrogen' },
        execResults: {
          ...notInstalledExecResults(),
          'node -v': { stdout: 'v18.17.0\n', stderr: '', code: 0 }
        }
      })

      const findings = await runVersionManagerAdapter(host)

      expect(findings).toEqual([])
    })

    it('.python-version이 요구하는 버전과 실제 활성 Python 버전이 다르면 감지한다', async () => {
      const host = new FakeHost({
        homedir,
        files: { '.python-version': '3.12.0' },
        execResults: {
          ...notInstalledExecResults(),
          'python3 --version': { stdout: 'Python 3.11.4\n', stderr: '', code: 0 }
        }
      })

      const findings = await runVersionManagerAdapter(host)

      expect(findings).toHaveLength(1)
      const [finding] = findings
      expect(finding.evidence?.file).toBe('.python-version')
      expect(finding.evidence?.line).toBe(1)
      expect(finding.cause).toContain('3.12.0')
      expect(finding.cause).toContain('3.11.4')
    })

    it('python3 조회가 실패하면 python으로 재시도한다', async () => {
      const host = new FakeHost({
        homedir,
        files: { '.python-version': '2.7.18' },
        execResults: {
          ...notInstalledExecResults(),
          'python3 --version': { stdout: '', stderr: '', code: 127 },
          'python --version': { stdout: '', stderr: 'Python 2.7.18\n', code: 0 }
        }
      })

      const findings = await runVersionManagerAdapter(host)

      expect(findings).toEqual([])
    })

    it('.nvmrc/.python-version 파일이 없으면 버전 비교를 하지 않는다', async () => {
      const host = new FakeHost({
        homedir,
        execResults: notInstalledExecResults()
      })

      const findings = await runVersionManagerAdapter(host)

      expect(findings).toEqual([])
    })

    it('.nvmrc와 .python-version이 동시에 불일치하면 서로 다른 id를 갖는 Finding 2건이 나온다', async () => {
      const host = new FakeHost({
        homedir,
        files: { '.nvmrc': '20.0.0', '.python-version': '3.12.0' },
        execResults: {
          ...notInstalledExecResults(),
          'node -v': { stdout: 'v18.17.0\n', stderr: '', code: 0 },
          'python3 --version': { stdout: 'Python 3.11.4\n', stderr: '', code: 0 }
        }
      })

      const findings = await runVersionManagerAdapter(host)

      expect(findings).toHaveLength(2)
      const ids = findings.map((f) => f.id)
      expect(new Set(ids).size).toBe(2)
    })
  })

  // FR-003: rc 파일 내 버전 매니저 초기화 누락/오배치
  describe('FR-003: rc 파일 초기화 누락/오배치', () => {
    it('nvm 초기화 줄이 rc 파일 마지막 줄이면 오배치로 보지 않는다', async () => {
      const host = new FakeHost({
        homedir,
        files: { [`${homedir}/.zshrc`]: loadFixture('nvm-init-last.zshrc') },
        execResults: notInstalledExecResults()
      })

      const findings = await runVersionManagerAdapter(host)

      expect(findings).toEqual([])
    })

    it('nvm 초기화 줄 뒤에 다른 설정이 이어지면 오배치로 감지한다', async () => {
      const host = new FakeHost({
        homedir,
        files: { [`${homedir}/.zshrc`]: loadFixture('nvm-init-misplaced.zshrc') },
        execResults: notInstalledExecResults()
      })

      const findings = await runVersionManagerAdapter(host)

      expect(findings).toHaveLength(1)
      const [finding] = findings
      expect(finding.severity).toBe('warn')
      expect(finding.evidence?.file).toBe(`${homedir}/.zshrc`)
      expect(finding.evidence?.line).toBe(2)
      expect(finding.evidence?.excerpt).toContain('nvm.sh')
      expect(finding.cause.toLowerCase()).toContain('nvm')
    })

    it('pyenv 초기화 줄이 rc 파일 마지막 줄이면 오배치로 보지 않는다', async () => {
      const host = new FakeHost({
        homedir,
        files: { [`${homedir}/.zshrc`]: loadFixture('pyenv-init-last.zshrc') },
        execResults: notInstalledExecResults()
      })

      const findings = await runVersionManagerAdapter(host)

      expect(findings).toEqual([])
    })

    it('pyenv 초기화 줄 뒤에 다른 설정이 이어지면 오배치로 감지한다', async () => {
      const host = new FakeHost({
        homedir,
        files: { [`${homedir}/.zshrc`]: loadFixture('pyenv-init-misplaced.zshrc') },
        execResults: notInstalledExecResults()
      })

      const findings = await runVersionManagerAdapter(host)

      expect(findings).toHaveLength(1)
      const [finding] = findings
      expect(finding.severity).toBe('warn')
      expect(finding.evidence?.line).toBe(1)
      expect(finding.evidence?.excerpt).toContain('pyenv init')
      expect(finding.cause.toLowerCase()).toContain('pyenv')
    })

    it('nvm이 설치되어 있는데 rc 파일 어디에도 초기화 줄이 없으면 누락으로 감지한다', async () => {
      const host = new FakeHost({
        homedir,
        files: { [`${homedir}/.zshrc`]: loadFixture('no-init.zshrc') },
        execResults: {
          [`test -e ${homedir}/.nvm`]: { stdout: '', stderr: '', code: 0 },
          'which pyenv': { stdout: '', stderr: '', code: 1 }
        }
      })

      const findings = await runVersionManagerAdapter(host)

      expect(findings).toHaveLength(1)
      const [finding] = findings
      expect(finding.evidence).toBeUndefined()
      expect(finding.fix.command).toBeTruthy()
      // echo '\n...'는 -e 없이는 개행으로 해석되지 않아 rc 파일이 깨진다 — printf 기반이어야 한다.
      expect(finding.fix.command).toMatch(/^printf /)
      expect(finding.cause.toLowerCase()).toContain('nvm')
    })

    it('pyenv가 설치되어 있는데 rc 파일 어디에도 초기화 줄이 없으면 누락으로 감지한다', async () => {
      const host = new FakeHost({
        homedir,
        files: { [`${homedir}/.zshrc`]: loadFixture('no-init.zshrc') },
        execResults: {
          [`test -e ${homedir}/.nvm`]: { stdout: '', stderr: '', code: 1 },
          'which pyenv': { stdout: '', stderr: '', code: 0 }
        }
      })

      const findings = await runVersionManagerAdapter(host)

      expect(findings).toHaveLength(1)
      const [finding] = findings
      expect(finding.evidence).toBeUndefined()
      expect(finding.fix.command).toBeTruthy()
      expect(finding.fix.command).toMatch(/^printf /)
      expect(finding.cause.toLowerCase()).toContain('pyenv')
    })

    it('매니저가 설치되어 있지 않으면 초기화 줄이 없어도 누락으로 보지 않는다', async () => {
      const host = new FakeHost({
        homedir,
        files: { [`${homedir}/.zshrc`]: loadFixture('no-init.zshrc') },
        execResults: notInstalledExecResults()
      })

      const findings = await runVersionManagerAdapter(host)

      expect(findings).toEqual([])
    })
  })
})
