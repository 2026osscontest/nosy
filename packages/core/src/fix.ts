// fix 실행 엔진. docs/ADR.md ADR-008(안전장치 5종), docs/specs/toggle-panel-spec.md FR-003~007 참조.
//
// v1이 실제로 적용하는 fix는 `fix.edit`(줄 삭제형) 하나뿐이다. 남아 있는 `fix.command`는
// `nvm use`처럼 셸 함수라 execFile로 실행할 수 없고, 임의 셸 문자열 실행은 ADR-008의
// 안전 경계를 넘으므로 이 엔진은 명령을 실행하지 않는다.

import type { FixHost } from './host.js'
import type { Finding } from './types.js'

export interface FixOutcome {
  ok: boolean
  /** 성공 시 만들어진 백업 파일 경로. revertFix에 그대로 넘긴다. */
  backupPath?: string
  /** 실패 사유. 사용자에게 그대로 보여줄 수 있는 한국어 문장으로 쓴다. */
  error?: string
}

interface SplitFile {
  lines: string[]
  hasTrailingNewline: boolean
}

/** 마지막 줄 뒤 개행 유무를 따로 기억해 두고, 다시 합칠 때 그대로 복원한다. */
function splitLines(content: string): SplitFile {
  const lines = content.split('\n')
  const hasTrailingNewline = lines.length > 1 && lines[lines.length - 1] === ''
  return { lines: hasTrailingNewline ? lines.slice(0, -1) : lines, hasTrailingNewline }
}

function joinLines({ lines, hasTrailingNewline }: SplitFile): string {
  return lines.join('\n') + (hasTrailingNewline ? '\n' : '')
}

/** 백업 파일명의 타임스탬프. 로컬 시각의 `YYYYMMDD-HHmmss`. */
function formatStamp(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  )
}

export async function applyFix(host: FixHost, finding: Finding): Promise<FixOutcome> {
  const { fix } = finding

  // ADR-008 ③: 권한 상승을 앱이 대신 실행하지 않는다.
  if (fix.needsSudo === true) {
    return { ok: false, error: '관리자 권한이 필요한 항목은 자동으로 실행하지 않습니다. 명령을 복사해 직접 실행하세요.' }
  }

  const edit = fix.edit
  if (!edit) {
    return { ok: false, error: '이 항목은 자동 수정을 지원하지 않습니다. 안내에 따라 직접 수정하세요.' }
  }

  const content = await host.readFile(edit.file)
  if (content === null) {
    return { ok: false, error: `대상 파일을 읽을 수 없습니다 — ${edit.file}` }
  }

  const file = splitLines(content)
  if (edit.removeLine < 1 || edit.removeLine > file.lines.length) {
    return {
      ok: false,
      error: `${edit.file}에 ${edit.removeLine}번째 줄이 없습니다. 파일이 진단 이후 변경된 것으로 보입니다. 다시 진단해 주세요.`
    }
  }

  const target = file.lines[edit.removeLine - 1] ?? ''
  if (target.trim() !== edit.expectedLine) {
    return {
      ok: false,
      error: `${edit.file}:${edit.removeLine}의 내용이 진단 시점과 다릅니다. 파일이 진단 이후 변경되었으므로 실행을 중단했습니다. 다시 진단해 주세요.`
    }
  }

  // ADR-008 ②: 파일 수정은 반드시 백업 후에 한다.
  const backupPath = `${edit.file}.bak.${formatStamp(host.now())}`
  try {
    await host.copyFile(edit.file, backupPath)
  } catch {
    return { ok: false, error: `백업 파일을 만들지 못해 수정을 중단했습니다 — ${backupPath}` }
  }

  file.lines.splice(edit.removeLine - 1, 1)
  try {
    await host.writeFile(edit.file, joinLines(file))
  } catch {
    return { ok: false, error: `파일을 쓰지 못했습니다. 백업은 ${backupPath}에 남아 있습니다.` }
  }

  return { ok: true, backupPath }
}

export async function revertFix(host: FixHost, finding: Finding, backupPath: string): Promise<FixOutcome> {
  const edit = finding.fix.edit
  if (!edit) {
    return { ok: false, error: '이 항목은 되돌리기를 지원하지 않습니다.' }
  }

  // 호출자가 임의 경로를 넘겨 아무 파일이나 덮어쓰는 것을 막는다.
  if (!backupPath.startsWith(`${edit.file}.bak.`)) {
    return { ok: false, error: `${edit.file}의 백업 파일이 아니므로 복원하지 않았습니다 — ${backupPath}` }
  }

  const content = await host.readFile(backupPath)
  if (content === null) {
    return { ok: false, error: `백업 파일을 찾을 수 없습니다 — ${backupPath}` }
  }

  try {
    await host.writeFile(edit.file, content)
  } catch {
    return { ok: false, error: `백업을 복원하지 못했습니다 — ${edit.file}` }
  }

  return { ok: true, backupPath }
}
