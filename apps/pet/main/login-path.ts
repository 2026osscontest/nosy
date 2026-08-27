// Finder/Launchpad/로그인 항목으로 띄운 앱은 로그인 셸을 거치지 않는다.
// launchd가 물려주는 PATH는 `/usr/bin:/bin:/usr/sbin:/sbin`뿐이라
// `~/.local/bin`도 `/opt/homebrew/bin`도 보이지 않는다.
//
// 그러면 진단이 조용히 반쪽이 된다 — shell-rc가 살아 있는 alias를 죽은 것으로
// 신고하고(`alias cc="claude"`), homebrew는 brew를 못 찾아 통째로 skip되며,
// version-manager는 실제와 다른 PATH로 shim 우선순위를 판정한다
// (adapter-version-manager-spec FR-001은 `DiagnosticHost.env.PATH`를 기준으로 삼는다).
//
// 터미널에서 `pnpm dev`로 띄우면 PATH가 온전해 절대 재현되지 않는다.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/** 로그인 셸이 뱉는 인사말·경고에 섞이지 않도록 PATH를 감싸는 마커. */
const MARKER = '__NOSY_PATH__'

/** rc가 무거워도 앱 기동을 붙잡지 않도록 건 상한. 실측은 0.2초 수준이다. */
const TIMEOUT_MS = 5_000

type ExecOptions = { timeout: number }
type Exec = (file: string, args: string[], options: ExecOptions) => Promise<{ stdout: string }>

const defaultExec: Exec = (file, args, options) => execFileAsync(file, args, options)

/** 셸 출력에서 마커로 감싼 PATH를 골라낸다. 찾지 못하면 null. */
export function extractPath(stdout: string): string | null {
  const start = stdout.indexOf(MARKER)
  if (start === -1) return null

  const rest = stdout.slice(start + MARKER.length)
  const end = rest.indexOf(MARKER)
  if (end === -1) return null

  const value = rest.slice(0, end).trim()
  return value.length > 0 ? value : null
}

/**
 * 로그인 셸 PATH를 앞에, 기존 PATH를 뒤에 두고 합친다.
 * Electron이 따로 넣어 둔 항목을 잃지 않으면서 사용자의 셸 환경을 우선한다.
 */
export function mergePath(current: string, resolved: string): string {
  const seen = new Set<string>()
  const merged: string[] = []

  for (const entry of [...resolved.split(':'), ...current.split(':')]) {
    if (entry.length === 0 || seen.has(entry)) continue
    seen.add(entry)
    merged.push(entry)
  }

  return merged.join(':')
}

/**
 * 사용자의 로그인 셸에게 PATH를 물어본다. 실패하면 null — 진단이 반쪽이 될지언정
 * PATH를 못 읽었다고 앱이 뜨지 않아서는 안 된다.
 */
export async function resolveLoginShellPath(
  exec: Exec = defaultExec,
  shell: string | undefined = process.env.SHELL
): Promise<string | null> {
  if (!shell) return null

  try {
    // `-i`가 핵심이다. `-l`만 주면 `.zshrc`가 로드되지 않는데, PATH를 거기서
    // export하는 설정(oh-my-zsh 관례)이 흔하다. echo가 아니라 printf를 쓰는 것은
    // 셸마다 echo의 이스케이프 처리가 갈리기 때문이다.
    const { stdout } = await exec(
      shell,
      ['-ilc', `printf '%s%s%s' '${MARKER}' "$PATH" '${MARKER}'`],
      { timeout: TIMEOUT_MS }
    )
    return extractPath(stdout)
  } catch {
    return null
  }
}

/**
 * `process.env.PATH`를 로그인 셸 기준으로 보강한다.
 *
 * `NodeHost.env`는 `process.env`를 참조로 들고 있고 `exec`도 그것을 상속하므로,
 * 여기서 한 번 갱신하면 어댑터와 자식 프로세스 양쪽에 그대로 반영된다.
 */
export async function applyLoginShellPath(): Promise<void> {
  const resolved = await resolveLoginShellPath()
  if (!resolved) return

  process.env.PATH = mergePath(process.env.PATH ?? '', resolved)
}
