// Finder/Launchpad로 띄운 앱은 로그인 셸을 거치지 않아 PATH가 최소
// (`/usr/bin:/bin:/usr/sbin:/sbin`)로 들어온다. 그러면 `~/.local/bin`이나
// `/opt/homebrew/bin`이 빠져 살아 있는 alias가 죽은 것으로 오탐되고
// homebrew 어댑터도 skip된다. 터미널 `pnpm dev`로는 PATH가 온전해 재현되지 않는다.

import { describe, expect, it, vi } from 'vitest'
import { extractPath, mergePath, resolveLoginShellPath } from '../main/login-path'

const MARKER = '__NOSY_PATH__'

describe('extractPath', () => {
  it('마커 사이의 PATH를 뽑는다', () => {
    expect(extractPath(`${MARKER}/usr/local/bin:/usr/bin${MARKER}`)).toBe('/usr/local/bin:/usr/bin')
  })

  it('rc가 앞뒤로 뱉은 잡음에 섞여 있어도 뽑는다', () => {
    const noisy = `Last login: Tue\n${MARKER}/opt/homebrew/bin:/usr/bin${MARKER}\nwelcome!\n`
    expect(extractPath(noisy)).toBe('/opt/homebrew/bin:/usr/bin')
  })

  it('마커가 없으면 null을 준다', () => {
    expect(extractPath('/usr/bin:/bin')).toBeNull()
  })

  it('여는 마커만 있고 닫는 마커가 없으면 null을 준다', () => {
    expect(extractPath(`${MARKER}/usr/bin`)).toBeNull()
  })

  it('마커 사이가 비어 있으면 null을 준다', () => {
    expect(extractPath(`${MARKER}${MARKER}`)).toBeNull()
  })
})

describe('mergePath', () => {
  it('로그인 셸 PATH를 앞에, 기존 PATH를 뒤에 둔다', () => {
    expect(mergePath('/usr/bin', '/opt/homebrew/bin')).toBe('/opt/homebrew/bin:/usr/bin')
  })

  it('중복 항목을 한 번만 남긴다', () => {
    expect(mergePath('/usr/bin:/bin', '/opt/homebrew/bin:/usr/bin')).toBe(
      '/opt/homebrew/bin:/usr/bin:/bin'
    )
  })

  it('빈 항목을 버린다', () => {
    expect(mergePath('/usr/bin::', ':/opt/homebrew/bin')).toBe('/opt/homebrew/bin:/usr/bin')
  })

  it('기존 PATH에만 있는 항목도 잃지 않는다', () => {
    expect(mergePath('/electron/only', '/opt/homebrew/bin')).toBe(
      '/opt/homebrew/bin:/electron/only'
    )
  })
})

describe('resolveLoginShellPath', () => {
  it('로그인 셸을 인터랙티브 로그인 모드로 띄운다', async () => {
    // `-i`가 빠지면 `.zshrc`가 로드되지 않는다. PATH를 `.zshrc`에서 export하는
    // 설정(oh-my-zsh 관례)에서는 그 한 글자가 이 버그의 원인이 된다.
    const exec = vi.fn().mockResolvedValue({ stdout: `${MARKER}/opt/homebrew/bin${MARKER}` })

    await resolveLoginShellPath(exec, '/bin/zsh')

    expect(exec).toHaveBeenCalledTimes(1)
    const [file, args] = exec.mock.calls[0]
    expect(file).toBe('/bin/zsh')
    expect(args[0]).toBe('-ilc')
  })

  it('셸이 내놓은 PATH를 돌려준다', async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: `${MARKER}/opt/homebrew/bin${MARKER}` })

    await expect(resolveLoginShellPath(exec, '/bin/zsh')).resolves.toBe('/opt/homebrew/bin')
  })

  it('셸 실행이 실패해도 던지지 않고 null을 준다', async () => {
    const exec = vi.fn().mockRejectedValue(new Error('timeout'))

    await expect(resolveLoginShellPath(exec, '/bin/zsh')).resolves.toBeNull()
  })

  it('셸이 마커 없이 아무 말이나 하면 null을 준다', async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: 'command not found\n' })

    await expect(resolveLoginShellPath(exec, '/bin/zsh')).resolves.toBeNull()
  })

  it('SHELL을 모르면 셸을 띄우지 않는다', async () => {
    const exec = vi.fn()
    const original = process.env.SHELL
    delete process.env.SHELL

    try {
      await expect(resolveLoginShellPath(exec)).resolves.toBeNull()
      expect(exec).not.toHaveBeenCalled()
    } finally {
      if (original === undefined) delete process.env.SHELL
      else process.env.SHELL = original
    }
  })

  it('셸이 오래 걸리면 앱이 붙잡히지 않도록 타임아웃을 건다', async () => {
    const exec = vi.fn().mockResolvedValue({ stdout: `${MARKER}/usr/bin${MARKER}` })

    await resolveLoginShellPath(exec, '/bin/zsh')

    const options = exec.mock.calls[0][2]
    expect(options?.timeout).toBeGreaterThan(0)
  })
})

describe('회귀: Finder로 띄운 앱의 PATH', () => {
  it('로그인 셸에만 있는 ~/.local/bin이 최종 PATH에 살아남는다', async () => {
    // 사용자가 겪은 그대로의 상황: `alias cc="claude"`의 claude는
    // ~/.local/bin에 있는데 Finder 실행 PATH에는 그 디렉터리가 없다.
    const finderPath = '/usr/bin:/bin:/usr/sbin:/sbin'
    const loginPath = '/Users/me/.local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin'
    const exec = vi.fn().mockResolvedValue({ stdout: `${MARKER}${loginPath}${MARKER}` })

    const resolved = await resolveLoginShellPath(exec, '/bin/zsh')
    const merged = mergePath(finderPath, resolved!)

    expect(merged.split(':')).toContain('/Users/me/.local/bin')
    expect(merged.split(':')).toContain('/opt/homebrew/bin')
  })
})
