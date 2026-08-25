// 어댑터 3: homebrew. docs/specs/adapter-homebrew-spec.md 참조.
// `brew doctor --json`을 래핑하기만 하며 Homebrew 코드를 포팅하지 않는다.

import type { DiagnosticHost } from '../host.js'
import type { Adapter, Finding } from '../types.js'

interface BrewRemediation {
  text?: string
  commands?: string[]
}

interface BrewDoctorFinding {
  text?: string
  affects?: string[]
  links?: string[]
  remediation?: BrewRemediation | null
}

interface BrewDoctorOutput {
  findings: BrewDoctorFinding[]
}

const ABSENT_REASON = 'Homebrew가 설치되어 있지 않습니다.'
const NO_JSON_REASON =
  '설치된 Homebrew가 `brew doctor --json`을 지원하지 않습니다. Homebrew를 최신 버전으로 업데이트하세요.'

/**
 * 파괴적 명령 판정 키워드. 단어 경계로 매칭한다 — `brew install charm`을 `rm`으로 오판하지 않기 위함이다.
 * `clean`은 `cleanup`과 별도로 필요하다: brew doctor의 check_git_status가 내놓는
 * `git -C <tap> stash -u && git -C <tap> clean -d -f`는 tap의 추적되지 않는 파일을
 * 되돌릴 수 없게 지우는데, `cleanup`만으로는 걸러지지 않는다.
 */
const DESTRUCTIVE_PATTERN = /\b(cleanup|clean|uninstall|rm|remove|prune)\b/

/**
 * `brew doctor --json`을 실행해 파싱한다.
 * 종료 코드는 판정에 쓰지 않는다 — brew doctor는 문제를 찾으면 0이 아닌 코드로 끝난다(spec "함정").
 * 파싱에 실패하면 `--json` 미지원 버전으로 보고 `null`을 반환한다.
 */
async function loadDoctorOutput(host: DiagnosticHost): Promise<BrewDoctorOutput | null> {
  const result = await host.exec('brew', ['doctor', '--json'])

  let parsed: unknown
  try {
    parsed = JSON.parse(result.stdout)
  } catch {
    return null
  }

  if (typeof parsed !== 'object' || parsed === null) return null

  const findings = (parsed as { findings?: unknown }).findings
  if (!Array.isArray(findings)) return null

  return { findings: findings as BrewDoctorFinding[] }
}

/** `text` 첫 줄을 결정적 slug로 바꾼다. 배열 인덱스·타임스탬프를 섞지 않아 실행마다 같은 id가 나온다. */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildCause(text: string, affects: string[]): string {
  if (affects.length === 0) return text
  return `${text}\n영향받는 항목: ${affects.join(', ')}`
}

function toFinding(raw: BrewDoctorFinding): Finding | null {
  const text = (raw.text ?? '').trim()
  const command = raw.remediation?.commands?.[0]

  // FR-005: 고치는 명령을 줄 수 없으면 Finding으로 만들지 않고 버린다.
  if (text.length === 0 || command === undefined) return null

  const title = (text.split('\n')[0] ?? '').trim()
  const reference = raw.links?.[0]

  const finding: Finding = {
    id: `homebrew:${slugify(title)}`,
    adapter: 'homebrew',
    // FR-008: tier는 Homebrew의 지원 등급이지 심각도가 아니다. severity는 warn 고정.
    severity: 'warn',
    title,
    cause: buildCause(text, raw.affects ?? []),
    // FR-002: brew doctor 경고는 파일:줄을 가리킬 수 없으므로 evidence를 채우지 않는다.
    fix: { description: (raw.remediation?.text ?? '').trim() }
  }

  if (DESTRUCTIVE_PATTERN.test(command)) {
    // FR-006(ADR-008 ⑤): 파괴적 명령은 자동 실행 대상에서 빼고 사용자가 직접 판단하게 한다.
    finding.fix.manual = command
  } else {
    finding.fix.command = command
    // FR-007(ADR-008 ③): sudo 명령은 표시만 하고 자동 실행 차단은 UI가 맡는다.
    if (/^sudo\b/.test(command)) finding.fix.needsSudo = true
  }

  if (reference !== undefined) finding.reference = reference

  return finding
}

export function createHomebrewAdapter(): Adapter {
  // skipReason이 돌린 `brew doctor` 결과를 바로 다음 run 한 번이 소비한다.
  // 같은 명령을 두 번 실행하지 않기 위한 1회성 캐시이며, 인스턴스마다 독립이다.
  let pending: BrewDoctorOutput | null = null

  return {
    name: 'homebrew',
    kind: 'wrapping',

    async skipReason(host) {
      const which = await host.exec('which', ['brew'])
      if (which.code !== 0) return ABSENT_REASON

      const output = await loadDoctorOutput(host)
      if (output === null) return NO_JSON_REASON

      pending = output
      return null
    },

    async run(host) {
      const output = pending ?? (await loadDoctorOutput(host))
      pending = null

      if (output === null) return []

      return output.findings
        .map(toFinding)
        .filter((finding): finding is Finding => finding !== null)
    }
  }
}
