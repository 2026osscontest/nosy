// Finding id의 안정성 테스트.
//
// id는 UI가 "같은 문제"를 알아보는 유일한 열쇠다. 지금은 줄 번호가 id에 박혀 있어서,
// 한 줄을 지우면 그 아래 항목들이 내용은 그대로인데 전부 다른 id가 된다. 그러면 화면은
// 그것들을 "사라진 문제 + 새로 생긴 문제"로 읽어, 사용자가 직접 고친 항목을 추적할 수 없다.
//
// 그래서 id는 "무엇이 잘못됐는가"로만 만든다. 줄 번호는 evidence.line에 이미 있으므로
// id에서 빠져도 정보가 사라지지 않는다.

import { describe, expect, it } from 'vitest'
import { runShellRcAdapter } from '../src/adapters/shell-rc.js'
import { runVersionManagerAdapter } from '../src/adapters/version-manager.js'
import { FakeHost } from '../src/host.js'
import type { ExecResult } from '../src/host.js'

const homedir = '/Users/fixture'
const rc = `${homedir}/.zshrc`

function shellRcHost(content: string): FakeHost {
  return new FakeHost({ homedir, files: { [rc]: content } })
}

/** 버전 매니저가 설치돼 있지 않은 상태 — 이 테스트가 보려는 건 rc 파일 쪽 finding뿐이다. */
function notInstalled(): Record<string, ExecResult> {
  return {
    [`test -e ${homedir}/.nvm`]: { stdout: '', stderr: '', code: 1 },
    'which pyenv': { stdout: '', stderr: '', code: 1 }
  }
}

function versionManagerHost(content: string): FakeHost {
  return new FakeHost({ homedir, files: { [rc]: content }, execResults: notInstalled() })
}

const ids = (findings: { id: string }[]): string[] => findings.map((finding) => finding.id)

describe('Finding id', () => {
  describe('줄 번호에 묶이지 않는다', () => {
    // 이것이 이 파일의 핵심이다. 위쪽에 주석 두 줄이 끼어들면 문제의 줄 번호는 밀리지만
    // 잘못된 내용은 그대로다 — 같은 문제이므로 같은 id여야 한다.
    it('shell-rc: 앞에 줄이 끼어들어 위치가 밀려도 id가 같다', async () => {
      const before = await runShellRcAdapter(
        shellRcHost(["alias ll='ls -la'", "alias ll='ls -lah'", ''].join('\n'))
      )
      const after = await runShellRcAdapter(
        shellRcHost(['# 주석', '', "alias ll='ls -la'", "alias ll='ls -lah'", ''].join('\n'))
      )

      expect(before).toHaveLength(1)
      expect(ids(after)).toEqual(ids(before))
      // 줄 번호 자체는 evidence에 그대로 남아 있어야 한다 — fix가 그 값을 쓴다.
      expect(before[0].evidence?.line).toBe(2)
      expect(after[0].evidence?.line).toBe(4)
    })

    it('shell-rc: 없는 파일을 source하는 문제도 위치와 무관하게 같은 id다', async () => {
      const before = await runShellRcAdapter(
        shellRcHost(['source /nowhere/missing.sh', ''].join('\n'))
      )
      const after = await runShellRcAdapter(
        shellRcHost(['export EDITOR=vim', 'source /nowhere/missing.sh', ''].join('\n'))
      )

      expect(before).toHaveLength(1)
      expect(ids(after)).toEqual(ids(before))
    })

    it('version-manager: 초기화 줄이 밀려도 id가 같다', async () => {
      const before = await runVersionManagerAdapter(
        versionManagerHost(['source "$NVM_DIR/nvm.sh"', 'export EDITOR=vim', ''].join('\n'))
      )
      const after = await runVersionManagerAdapter(
        versionManagerHost(
          ['# 주석', 'source "$NVM_DIR/nvm.sh"', 'export EDITOR=vim', ''].join('\n')
        )
      )

      expect(before).toHaveLength(1)
      expect(ids(after)).toEqual(ids(before))
    })
  })

  describe('같은 파일 안에서 서로 다른 문제는 구분된다', () => {
    // 줄 번호를 빼면 이것들이 전부 같은 id로 뭉갠다. 그러면 화면에서 한 건만 보이거나
    // React가 같은 key를 가진 형제를 그리게 된다.
    it('같은 alias가 세 번 정의되면 중복 finding들의 id가 서로 다르다', async () => {
      const findings = await runShellRcAdapter(
        shellRcHost(
          ["alias ll='ls -la'", "alias ll='ls -lah'", "alias ll='ls -A'", ''].join('\n')
        )
      )

      expect(findings).toHaveLength(2)
      expect(new Set(ids(findings)).size).toBe(2)
    })

    // 지금 id에는 source 대상 경로가 아예 들어 있지 않다 — 줄 번호만 빼면 곧바로 충돌한다.
    it('없는 파일을 두 개 source하면 id가 서로 다르다', async () => {
      const findings = await runShellRcAdapter(
        shellRcHost(['source /nowhere/a.sh', 'source /nowhere/b.sh', ''].join('\n'))
      )

      expect(findings).toHaveLength(2)
      expect(new Set(ids(findings)).size).toBe(2)
    })

    it('완전히 같은 줄이 두 번 있어도 id가 서로 다르다', async () => {
      const findings = await runShellRcAdapter(
        shellRcHost(['source /nowhere/a.sh', 'source /nowhere/a.sh', ''].join('\n'))
      )

      expect(findings).toHaveLength(2)
      expect(new Set(ids(findings)).size).toBe(2)
    })

    it('version-manager: 초기화 줄이 두 번 있어도 id가 서로 다르다', async () => {
      const findings = await runVersionManagerAdapter(
        versionManagerHost(
          ['source "$NVM_DIR/nvm.sh"', 'source "$NVM_DIR/nvm.sh"', 'export EDITOR=vim', ''].join(
            '\n'
          )
        )
      )

      expect(findings).toHaveLength(2)
      expect(new Set(ids(findings)).size).toBe(2)
    })
  })

  describe('그 밖의 성질', () => {
    it('같은 입력이면 같은 id가 나온다', async () => {
      const content = ["alias ll='ls -la'", "alias ll='ls -lah'", 'source /nowhere/a.sh', ''].join(
        '\n'
      )

      expect(ids(await runShellRcAdapter(shellRcHost(content)))).toEqual(
        ids(await runShellRcAdapter(shellRcHost(content)))
      )
    })

    // 같은 문제가 .zshrc와 .bashrc에 각각 있으면 별개의 문제다 — 고칠 파일이 다르다.
    it('파일이 다르면 같은 내용이라도 id가 다르다', async () => {
      const content = ["alias ll='ls -la'", "alias ll='ls -lah'", ''].join('\n')
      const host = new FakeHost({
        homedir,
        files: { [rc]: content, [`${homedir}/.bashrc`]: content }
      })

      const findings = await runShellRcAdapter(host)

      expect(findings).toHaveLength(2)
      expect(new Set(ids(findings)).size).toBe(2)
    })

    it('어댑터 이름으로 시작한다', async () => {
      const findings = await runShellRcAdapter(
        shellRcHost(["alias ll='ls -la'", "alias ll='ls -lah'", ''].join('\n'))
      )

      expect(findings.every((finding) => finding.id.startsWith('shell-rc:'))).toBe(true)
    })
  })
})
