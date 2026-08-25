// 어댑터 1: shell-rc. docs/specs/adapter-shell-rc-spec.md 참조.
//
// 이 어댑터의 감지 규칙은 shellrc-doctor(MIT License)의 접근 방식을 참고해
// TypeScript로 포팅했다. 런타임 의존성으로 호출하지 않고 이 프로젝트의 Finding 스키마에
// 맞춰 새로 구현했다 (docs/ADR.md ADR-004).
// 원저작자: nord342 — https://github.com/nord342/shellrc-doctor (MIT License)
// MIT 라이선스 전문은 리포 루트 THIRD-PARTY-NOTICES.md 참조.

import type { DiagnosticHost } from '../host.js'
import type { Finding } from '../types.js'

const RC_FILENAMES = ['.zshrc', '.bashrc', '.zprofile']

// NodeHost.exec는 execFile로 셸을 거치지 않으므로, test/which에 넘기기 전에
// 선행 $HOME/${HOME}/~ 를 host.homedir로 직접 치환해야 한다.
function expandHomePrefix(value: string, host: DiagnosticHost): string {
  if (value === '$HOME' || value.startsWith('$HOME/')) {
    return host.homedir + value.slice('$HOME'.length)
  }
  if (value === '${HOME}' || value.startsWith('${HOME}/')) {
    return host.homedir + value.slice('${HOME}'.length)
  }
  if (value === '~' || value.startsWith('~/')) {
    return host.homedir + value.slice('~'.length)
  }
  return value
}

// $HOME/~ 는 위에서 확장할 수 있지만 $ZSH·${VAR:-기본값}·$(...)·와일드카드는 셸을 실제로
// 돌려야만 값을 알 수 있다. 확인할 수 없는 경로를 "없다"고 단정하면 powerlevel10k의
// `${XDG_CACHE_HOME:-...}`나 oh-my-zsh의 `$ZSH/oh-my-zsh.sh`처럼 멀쩡한 설정을 문제로
// 보고하게 된다 — 게다가 이제 그 finding에는 줄 삭제 fix가 붙는다. 오탐보다 미탐을 택한다.
const UNRESOLVABLE_EXPANSION = /[$`{}*?[\]]/

function isUnresolvable(path: string): boolean {
  return UNRESOLVABLE_EXPANSION.test(path)
}

// which로 조회하면 실패하는 셸 빌트인 — alias 대상이 이들이면 존재하는 것으로 취급한다.
const SHELL_BUILTINS = new Set([
  'cd', 'source', '.', 'pushd', 'popd', 'exit', 'alias', 'unalias',
  'export', 'unset', 'echo', 'printf', 'type', 'command', 'builtin'
])

function isCommentLine(line: string): boolean {
  return line.trim().startsWith('#')
}

function stripQuotes(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length >= 2) {
    const first = trimmed[0]
    const last = trimmed[trimmed.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1)
    }
  }
  return trimmed
}

export async function runShellRcAdapter(host: DiagnosticHost): Promise<Finding[]> {
  const findings: Finding[] = []

  for (const filename of RC_FILENAMES) {
    const filePath = `${host.homedir}/${filename}`
    const content = await host.readFile(filePath)
    if (content === null) continue

    await scanFile(host, filePath, content, findings)
  }

  return findings
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

async function scanFile(host: DiagnosticHost, filePath: string, content: string, findings: Finding[]): Promise<void> {
  const nextId = createIdFactory()
  const seenPathSegments = new Set<string>()
  const seenAliasNames = new Set<string>()
  let versionConflictReported = false

  const nonCommentLines = content
    .split('\n')
    .map((line, index) => ({ line, lineNo: index + 1 }))
    .filter(({ line }) => line.trim().length > 0 && !isCommentLine(line))

  const nonCommentText = nonCommentLines.map(({ line }) => line).join('\n')
  const hasNvmInit = nonCommentText.includes('nvm.sh')
  const hasPyenvInit = nonCommentText.includes('pyenv init')
  const hasAsdfInit = nonCommentText.includes('asdf.sh')

  for (const { line, lineNo } of nonCommentLines) {
    const trimmed = line.trim()
    const excerpt = trimmed

    if (trimmed.startsWith('export ') && trimmed.includes('PATH=')) {
      const eqIdx = trimmed.indexOf('PATH=')
      const rawValue = trimmed.slice(eqIdx + 'PATH='.length)
      const value = stripQuotes(rawValue)
      const segments = value.split(':').filter((seg) => seg.length > 0 && seg !== '$PATH' && seg !== '${PATH}')

      for (const segment of segments) {
        if (seenPathSegments.has(segment)) {
          findings.push({
            id: nextId(`shell-rc:${filePath}:dup-path:${segment}`),
            adapter: 'shell-rc',
            severity: 'warn',
            title: 'PATH에 중복된 항목이 있습니다',
            cause: `"${segment}" 항목이 PATH에 중복 등록되어 있습니다.`,
            evidence: { file: filePath, line: lineNo, excerpt },
            fix: { description: '중복된 PATH 항목을 하나만 남기고 제거하세요.' }
          })
          continue
        }
        seenPathSegments.add(segment)

        // 중복 판정은 문자열 비교라 확장 없이도 정확하므로 위에서 먼저 한다.
        // 존재 확인만 건너뛴다.
        const expandedSegment = expandHomePrefix(segment, host)
        if (isUnresolvable(expandedSegment)) continue

        const result = await host.exec('test', ['-e', expandedSegment])
        if (result.code !== 0) {
          findings.push({
            id: nextId(`shell-rc:${filePath}:missing-path:${segment}`),
            adapter: 'shell-rc',
            severity: 'warn',
            title: '존재하지 않는 PATH 항목이 있습니다',
            cause: `"${segment}" 경로가 실제로 존재하지 않습니다.`,
            evidence: { file: filePath, line: lineNo, excerpt },
            fix: { description: '존재하지 않는 PATH 항목을 PATH에서 제거하세요.' }
          })
        }
      }
    }

    if (trimmed.startsWith('alias ')) {
      const rest = trimmed.slice('alias '.length)
      const eq = rest.indexOf('=')

      if (eq !== -1) {
        const name = rest.slice(0, eq).trim()
        const value = stripQuotes(rest.slice(eq + 1))
        const target = value.trim().split(/\s+/)[0] ?? ''

        if (seenAliasNames.has(name)) {
          findings.push({
            id: nextId(`shell-rc:${filePath}:dup-alias:${name}`),
            adapter: 'shell-rc',
            severity: 'warn',
            title: '중복 정의된 alias가 있습니다',
            cause: `alias "${name}"이(가) 이미 정의된 이름으로 다시 정의되었습니다.`,
            evidence: { file: filePath, line: lineNo, excerpt },
            fix: {
              description: '중복 정의된 alias 중 하나를 제거하세요.',
              edit: { file: filePath, removeLine: lineNo, expectedLine: excerpt }
            }
          })
        } else {
          seenAliasNames.add(name)
        }

        const expandedTarget = expandHomePrefix(target, host)

        // 값을 알 수 없는 대상(`alias k=$KUBECTL_BIN`)은 죽었는지 판단할 수 없다.
        if (target.length > 0 && !isUnresolvable(expandedTarget)) {
          const isPath =
            target.startsWith('/') ||
            target.startsWith('~') ||
            target.startsWith('./') ||
            target.startsWith('../') ||
            target.startsWith('$HOME') ||
            target.startsWith('${HOME}')
          const isBuiltin = SHELL_BUILTINS.has(target)

          const result = isBuiltin
            ? { stdout: '', stderr: '', code: 0 }
            : isPath
              ? await host.exec('test', ['-e', expandedTarget])
              : await host.exec('which', [expandedTarget])

          if (result.code !== 0) {
            findings.push({
              id: nextId(`shell-rc:${filePath}:dead-alias:${name}`),
              adapter: 'shell-rc',
              severity: 'warn',
              title: '대상이 존재하지 않는 alias가 있습니다',
              cause: `alias "${name}"이(가) 가리키는 "${target}"을(를) 찾을 수 없습니다.`,
              evidence: { file: filePath, line: lineNo, excerpt },
              fix: {
                description: '대상이 사라진 alias를 제거하거나 올바른 대상으로 수정하세요.',
                edit: { file: filePath, removeLine: lineNo, expectedLine: excerpt }
              }
            })
          }
        }
      }
    }

    if (trimmed.startsWith('source ') || trimmed.startsWith('. ')) {
      const rawPath = trimmed.startsWith('source ') ? trimmed.slice('source '.length) : trimmed.slice('. '.length)
      const sourcePath = expandHomePrefix(stripQuotes(rawPath), host)

      // 값을 알 수 없는 경로(`source $ZSH/oh-my-zsh.sh`)는 없는지 확인할 방법이 없다.
      if (!isUnresolvable(sourcePath) && (await host.readFile(sourcePath)) === null) {
        findings.push({
          id: nextId(`shell-rc:${filePath}:missing-source:${sourcePath}`),
          adapter: 'shell-rc',
          severity: 'error',
          title: '존재하지 않는 파일을 source하고 있습니다',
          cause: `"${sourcePath}" 파일이 존재하지 않아 셸 시작 시 오류가 발생할 수 있습니다.`,
          evidence: { file: filePath, line: lineNo, excerpt },
          fix: {
            description: '더 이상 존재하지 않는 파일에 대한 source 구문을 제거하세요.',
            edit: { file: filePath, removeLine: lineNo, expectedLine: excerpt }
          }
        })
      }
    }

    if (!versionConflictReported && line.includes('asdf.sh') && hasAsdfInit) {
      if (hasNvmInit) {
        findings.push({
          id: nextId(`shell-rc:${filePath}:version-conflict:nvm`),
          adapter: 'shell-rc',
          severity: 'warn',
          title: '버전 매니저 초기화 충돌이 있습니다',
          cause: '이 파일에서 nvm과 asdf가 동시에 Node 버전을 초기화하고 있어 충돌할 수 있습니다.',
          evidence: { file: filePath, line: lineNo, excerpt },
          fix: { description: 'nvm 또는 asdf 중 하나만 사용하도록 초기화 구문을 정리하세요.' }
        })
        versionConflictReported = true
      } else if (hasPyenvInit) {
        findings.push({
          id: nextId(`shell-rc:${filePath}:version-conflict:pyenv`),
          adapter: 'shell-rc',
          severity: 'warn',
          title: '버전 매니저 초기화 충돌이 있습니다',
          cause: '이 파일에서 pyenv와 asdf가 동시에 Python 버전을 초기화하고 있어 충돌할 수 있습니다.',
          evidence: { file: filePath, line: lineNo, excerpt },
          fix: { description: 'pyenv 또는 asdf 중 하나만 사용하도록 초기화 구문을 정리하세요.' }
        })
        versionConflictReported = true
      }
    }
  }
}
