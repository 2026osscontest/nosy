// rc 파일 감시자 테스트. drift-detection-spec FR-005의 트리거에 "사용자가 파일을 직접 고친 순간"을
// 더한다 — 그래야 에디터에서 고치고 앱으로 돌아왔을 때 재진단 버튼을 누르지 않아도 반영된다.
//
// 파일시스템은 mock한다. 실제 파일을 만들지 않고 "무엇을 감시하고 언제 진단을 부르는가"만 본다.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Stats } from 'node:fs'
import type { DiagnosticsRunner } from '../main/ipc'

const mocks = vi.hoisted(() => ({
  watchFile: vi.fn()
}))

vi.mock('node:fs', () => ({ watchFile: mocks.watchFile }))

const HOME = '/Users/fixture'

function fakeRunner(): DiagnosticsRunner {
  return { run: vi.fn(async () => {}) }
}

/** mtimeMs만 보는 감시자라 Stats 전체를 만들지 않는다. */
function stat(mtimeMs: number): Stats {
  return { mtimeMs } as unknown as Stats
}

async function start() {
  vi.resetModules()
  const runner = fakeRunner()
  const { startRcWatcher } = await import('../main/rc-watcher')

  startRcWatcher(runner, HOME)

  const watched = (): string[] => mocks.watchFile.mock.calls.map((call) => call[0] as string)

  /** 감시 중인 파일 하나에 폴링 결과를 흘려 넣는다. */
  const poll = (path: string, current: number, previous: number): void => {
    const call = mocks.watchFile.mock.calls.find((entry) => entry[0] === path)

    if (!call) throw new Error(`감시하지 않는 경로다: ${path}`)

    const listener = call[call.length - 1] as (curr: Stats, prev: Stats) => void

    listener(stat(current), stat(previous))
  }

  const scopes = (): string[] => vi.mocked(runner.run).mock.calls.map((call) => call[0])

  return { runner, watched, poll, scopes }
}

beforeEach(() => {
  for (const fn of Object.values(mocks)) fn.mockClear()
})

describe('startRcWatcher', () => {
  it('셸 rc 파일 3종을 감시한다', async () => {
    const { watched } = await start()

    expect(watched().sort()).toEqual(
      [`${HOME}/.bashrc`, `${HOME}/.zprofile`, `${HOME}/.zshrc`].sort()
    )
  })

  it('기동만으로는 진단을 돌리지 않는다', async () => {
    const { runner } = await start()

    expect(runner.run).not.toHaveBeenCalled()
  })

  // 파일이 바뀌었다는 건 shell-rc·version-manager가 볼 내용이 달라졌다는 뜻이다.
  // brew doctor까지 돌릴 이유는 없으므로 자체형만 돌린다 (FR-006).
  it('파일이 바뀌면 자체형 어댑터만 다시 돌린다', async () => {
    const { poll, scopes } = await start()

    poll(`${HOME}/.zshrc`, 200, 100)

    expect(scopes()).toEqual(['self'])
  })

  // watchFile은 파일이 그대로여도 폴링할 때마다 리스너를 부른다.
  it('내용이 그대로면 진단하지 않는다', async () => {
    const { runner, poll } = await start()

    poll(`${HOME}/.zshrc`, 100, 100)

    expect(runner.run).not.toHaveBeenCalled()
  })

  // 없던 rc 파일이 생기는 경우. watchFile은 없는 파일에 mtimeMs 0을 준다.
  it('없던 파일이 생기면 진단한다', async () => {
    const { poll, scopes } = await start()

    poll(`${HOME}/.bashrc`, 100, 0)

    expect(scopes()).toEqual(['self'])
  })

  it('파일이 지워져도 진단한다', async () => {
    const { poll, scopes } = await start()

    poll(`${HOME}/.zprofile`, 0, 100)

    expect(scopes()).toEqual(['self'])
  })

  it('감시하는 파일 어느 것이 바뀌어도 진단한다', async () => {
    const { poll, scopes } = await start()

    poll(`${HOME}/.zshrc`, 2, 1)
    poll(`${HOME}/.bashrc`, 2, 1)
    poll(`${HOME}/.zprofile`, 2, 1)

    expect(scopes()).toEqual(['self', 'self', 'self'])
  })

  // 폴링 간격이다. 너무 짧으면 상주 앱이 계속 stat을 돌고, 너무 길면 고쳐도 반응이 없다.
  it('폴링 간격을 1~5초 사이로 잡는다', async () => {
    await start()

    for (const call of mocks.watchFile.mock.calls) {
      const options = call[1] as { interval?: number }

      expect(options?.interval).toBeGreaterThanOrEqual(1000)
      expect(options?.interval).toBeLessThanOrEqual(5000)
    }
  })
})
