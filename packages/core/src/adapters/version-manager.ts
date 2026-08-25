// 어댑터 2: version-manager. docs/specs/adapter-version-manager-spec.md 참조.
// rc 파일 *안에서*의 매니저 간 설정 충돌(nvm+asdf 등)은 어댑터 1(shell-rc)의 책임이다
// (adapter-shell-rc-spec.md FR-009) — 이 어댑터에서는 다루지 않는다.

import type { DiagnosticHost } from '../host.js'
import type { Finding } from '../types.js'

const RC_FILENAMES = ['.zshrc', '.bashrc', '.zprofile']
const SYSTEM_BIN_DIRS = ['/usr/bin', '/bin', '/usr/local/bin']

function isCommentLine(line: string): boolean {
  return line.trim().startsWith('#')
}

function nonCommentLines(content: string): { line: string; lineNo: number }[] {
  return content
    .split('\n')
    .map((line, index) => ({ line, lineNo: index + 1 }))
    .filter(({ line }) => line.trim().length > 0 && !isCommentLine(line))
}

/** PATH 세그먼트 목록에서 shimDir가 시스템 바이너리 디렉터리보다 뒤에 있는지 확인한다. */
async function checkPathPriorityConflict(
  host: DiagnosticHost,
  shimDir: string | undefined
): Promise<{ conflict: boolean } | null> {
  if (!shimDir) return null

  const pathSegments = (host.env.PATH ?? '').split(':')
  const shimIndex = pathSegments.indexOf(shimDir)
  if (shimIndex === -1) return null

  const result = await host.exec('test', ['-e', shimDir])
  if (result.code !== 0) return null

  const conflict = pathSegments.slice(0, shimIndex).some((seg) => SYSTEM_BIN_DIRS.includes(seg))
  return { conflict }
}

async function checkPathPriority(host: DiagnosticHost, findings: Finding[]): Promise<void> {
  const pyenvRoot = host.env.PYENV_ROOT ?? `${host.homedir}/.pyenv`
  const pyenvShims = `${pyenvRoot}/shims`
  const pyenvResult = await checkPathPriorityConflict(host, pyenvShims)
  if (pyenvResult?.conflict) {
    findings.push({
      id: 'version-manager:path-conflict:pyenv',
      adapter: 'version-manager',
      severity: 'warn',
      title: 'pyenv shim이 시스템 바이너리에 밀려 있습니다',
      cause: `pyenv shim 디렉터리("${pyenvShims}")가 PATH에서 시스템 바이너리 디렉터리보다 뒤에 있어, pyenv로 설정한 버전 대신 시스템 기본 버전이 사용될 수 있습니다.`,
      fix: { description: 'pyenv 초기화가 셸 시작 시 PATH 맨 앞에 shim을 추가하도록 설정하세요.', command: 'eval "$(pyenv init -)"' }
    })
  }

  const nvmBin = host.env.NVM_BIN
  const nvmResult = await checkPathPriorityConflict(host, nvmBin)
  if (nvmResult?.conflict) {
    findings.push({
      id: 'version-manager:path-conflict:nvm',
      adapter: 'version-manager',
      severity: 'warn',
      title: 'nvm shim이 시스템 바이너리에 밀려 있습니다',
      cause: `nvm이 활성화한 버전 디렉터리("${nvmBin}")가 PATH에서 시스템 바이너리 디렉터리보다 뒤에 있어, nvm으로 설정한 버전 대신 시스템 기본 버전이 사용될 수 있습니다.`,
      fix: { description: 'nvm이 기본 버전을 PATH 맨 앞에 두도록 재설정하세요.', command: 'nvm use --default' }
    })
  }
}

function normalizeVersionTag(value: string): string {
  const trimmed = value.trim()
  return trimmed.startsWith('v') ? trimmed.slice(1) : trimmed
}

function versionSatisfies(required: string, active: string): boolean {
  const reqParts = required.split('.')
  const activeParts = active.split('.')
  for (let i = 0; i < reqParts.length; i++) {
    if (reqParts[i] !== activeParts[i]) return false
  }
  return true
}

function extractPythonVersion(output: string): string | null {
  const match = output.match(/Python\s+(\S+)/)
  return match?.[1] ?? null
}

async function checkNvmrcVersion(host: DiagnosticHost, findings: Finding[]): Promise<void> {
  const content = await host.readFile('.nvmrc')
  if (content === null) return

  const required = normalizeVersionTag(content)
  if (!/^\d/.test(required)) return

  const result = await host.exec('node', ['-v'])
  if (result.code !== 0) return

  const active = normalizeVersionTag(result.stdout)
  if (versionSatisfies(required, active)) return

  findings.push({
    id: 'version-manager:version-mismatch:.nvmrc',
    adapter: 'version-manager',
    severity: 'warn',
    title: '.nvmrc가 요구하는 Node 버전과 실제 활성 버전이 다릅니다',
    cause: `.nvmrc는 Node "${required}"을(를) 요구하지만 실제 활성 버전은 "${active}"입니다.`,
    evidence: { file: '.nvmrc', line: 1, excerpt: required },
    fix: { description: '.nvmrc가 요구하는 버전으로 nvm을 전환하세요.', command: 'nvm use' }
  })
}

async function checkPythonVersion(host: DiagnosticHost, findings: Finding[]): Promise<void> {
  const content = await host.readFile('.python-version')
  if (content === null) return

  const required = content.trim()
  if (!/^\d/.test(required)) return

  let result = await host.exec('python3', ['--version'])
  if (result.code !== 0) {
    result = await host.exec('python', ['--version'])
  }
  if (result.code !== 0) return

  const active = extractPythonVersion(`${result.stdout}${result.stderr}`)
  if (active === null) return
  if (versionSatisfies(required, active)) return

  findings.push({
    id: 'version-manager:version-mismatch:.python-version',
    adapter: 'version-manager',
    severity: 'warn',
    title: '.python-version이 요구하는 버전과 실제 활성 버전이 다릅니다',
    cause: `.python-version은 Python "${required}"을(를) 요구하지만 실제 활성 버전은 "${active}"입니다.`,
    evidence: { file: '.python-version', line: 1, excerpt: required },
    fix: { description: '.python-version이 요구하는 버전으로 pyenv를 전환하세요.', command: 'pyenv local' }
  })
}

/**
 * 한 파일을 스캔하는 동안 발급한 id를 세어, 같은 id가 다시 나오면 순번 접미사를 붙인다.
 * 줄 번호를 id에서 뺀 뒤에도 남는 충돌(같은 줄이 두 번 있는 경우 등)을 덮기 위한 것이며,
 * 순번은 "이 파일에서 몇 번째로 나온 같은 문제인가"이므로 무관한 줄이 위에 끼어들어도
 * 변하지 않는다.
 */
function createIdFactory(): (base: string) => string {
  const counts = new Map<string, number>()
  return (base) => {
    const nth = (counts.get(base) ?? 0) + 1
    counts.set(base, nth)
    return nth === 1 ? base : `${base}#${nth}`
  }
}

async function checkRcInitPlacement(host: DiagnosticHost, findings: Finding[]): Promise<void> {
  const files: { filePath: string; lines: { line: string; lineNo: number }[] }[] = []

  for (const filename of RC_FILENAMES) {
    const filePath = `${host.homedir}/${filename}`
    const content = await host.readFile(filePath)
    if (content === null) continue
    files.push({ filePath, lines: nonCommentLines(content) })
  }

  let hasNvmInitAnywhere = false
  let hasPyenvInitAnywhere = false

  for (const { filePath, lines } of files) {
    const nextId = createIdFactory()
    const lastLine = lines.at(-1)
    const lastLineNo = lastLine ? lastLine.lineNo : -1

    for (const { line, lineNo } of lines) {
      const trimmed = line.trim()

      if (trimmed.includes('nvm.sh')) {
        hasNvmInitAnywhere = true
        if (lineNo !== lastLineNo) {
          findings.push({
            id: nextId(`version-manager:${filePath}:misplaced-init:nvm`),
            adapter: 'version-manager',
            severity: 'warn',
            title: 'nvm 초기화 줄이 rc 파일 마지막에 있지 않습니다',
            cause: 'nvm 초기화 구문 뒤에 다른 설정이 이어지면 nvm이 PATH를 완전히 제어하지 못할 수 있습니다.',
            evidence: { file: filePath, line: lineNo, excerpt: trimmed },
            fix: { description: 'nvm 초기화 구문을 rc 파일의 가장 마지막 줄로 옮기세요.' }
          })
        }
      }

      if (trimmed.includes('pyenv init')) {
        hasPyenvInitAnywhere = true
        if (lineNo !== lastLineNo) {
          findings.push({
            id: nextId(`version-manager:${filePath}:misplaced-init:pyenv`),
            adapter: 'version-manager',
            severity: 'warn',
            title: 'pyenv 초기화 줄이 rc 파일 마지막에 있지 않습니다',
            cause: 'pyenv 초기화 구문 뒤에 다른 설정이 이어지면 pyenv가 PATH를 완전히 제어하지 못할 수 있습니다.',
            evidence: { file: filePath, line: lineNo, excerpt: trimmed },
            fix: { description: 'pyenv 초기화 구문을 rc 파일의 가장 마지막 줄로 옮기세요.' }
          })
        }
      }
    }
  }

  const nvmDir = host.env.NVM_DIR ?? `${host.homedir}/.nvm`
  const nvmInstalled = await host.exec('test', ['-e', nvmDir])
  if (nvmInstalled.code === 0 && !hasNvmInitAnywhere) {
    findings.push({
      id: 'version-manager:missing-init:nvm',
      adapter: 'version-manager',
      severity: 'warn',
      title: 'nvm이 설치되어 있지만 초기화 구문이 없습니다',
      cause: 'nvm이 설치되어 있는데 .zshrc/.bashrc/.zprofile 어디에도 초기화 구문이 없어 셸에서 nvm을 사용할 수 없습니다.',
      fix: {
        description: 'rc 파일 끝에 nvm 초기화 구문을 추가하세요.',
        command: `printf '%s\\n' 'export NVM_DIR="$HOME/.nvm"' '[ -s "$NVM_DIR/nvm.sh" ] && \\. "$NVM_DIR/nvm.sh"' >> ${host.homedir}/.zshrc`
      }
    })
  }

  const pyenvInstalled = await host.exec('which', ['pyenv'])
  if (pyenvInstalled.code === 0 && !hasPyenvInitAnywhere) {
    findings.push({
      id: 'version-manager:missing-init:pyenv',
      adapter: 'version-manager',
      severity: 'warn',
      title: 'pyenv가 설치되어 있지만 초기화 구문이 없습니다',
      cause: 'pyenv가 설치되어 있는데 .zshrc/.bashrc/.zprofile 어디에도 초기화 구문이 없어 셸에서 pyenv를 사용할 수 없습니다.',
      fix: {
        description: 'rc 파일 끝에 pyenv 초기화 구문을 추가하세요.',
        command: `printf '%s\\n' 'eval "$(pyenv init -)"' >> ${host.homedir}/.zshrc`
      }
    })
  }
}

export async function runVersionManagerAdapter(host: DiagnosticHost): Promise<Finding[]> {
  const findings: Finding[] = []

  await checkPathPriority(host, findings)
  await checkNvmrcVersion(host, findings)
  await checkPythonVersion(host, findings)
  await checkRcInitPlacement(host, findings)

  return findings
}
