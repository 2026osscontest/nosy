// 주기 진단 스케줄러 테스트. docs/specs/drift-detection-spec.md FR-005, FR-006 참조.
// Electron과 시계를 모두 mock한다 — 실제로 30분을 기다리지 않고 "언제 어떤 scope로 도는가"만 본다.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DiagnosticsRunner } from '../main/ipc'

const mocks = vi.hoisted(() => ({
  powerOn: vi.fn()
}))

vi.mock('electron', () => ({
  powerMonitor: { on: mocks.powerOn },
  ipcMain: { handle: vi.fn(), on: vi.fn() }
}))

const MINUTE = 60 * 1000

function fakeRunner(): DiagnosticsRunner {
  return { run: vi.fn(async () => {}) }
}

async function start() {
  vi.resetModules()
  const runner = fakeRunner()
  const { startScheduler } = await import('../main/scheduler')

  startScheduler(runner)

  /** powerMonitor에 등록된 'resume' 리스너를 꺼내 직접 호출한다. */
  const fireResume = (): void => {
    const listener = mocks.powerOn.mock.calls.find((call) => call[0] === 'resume')?.[1] as
      | (() => void)
      | undefined

    if (!listener) throw new Error('resume 리스너가 등록되지 않았다')
    listener()
  }

  const scopes = (): string[] => vi.mocked(runner.run).mock.calls.map((call) => call[0])

  return { runner, fireResume, scopes }
}

beforeEach(() => {
  vi.useFakeTimers()
  for (const fn of Object.values(mocks)) fn.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('startScheduler', () => {
  // FR-005 ①(앱 실행 시 1회)은 renderer가 마운트될 때 run('all')로 이미 수행한다.
  // 스케줄러가 여기서 또 돌면 기동 직후 진단이 두 번 트리거된다.
  it('기동 직후에는 아무 진단도 돌리지 않는다', async () => {
    const { runner } = await start()

    expect(runner.run).not.toHaveBeenCalled()
  })

  describe('30분 주기 (FR-006)', () => {
    it('30분이 지나면 자체형 어댑터만 돌린다', async () => {
      const { scopes } = await start()

      await vi.advanceTimersByTimeAsync(30 * MINUTE)

      expect(scopes()).toEqual(['self'])
    })

    it('30분이 되기 전에는 돌지 않는다', async () => {
      const { runner } = await start()

      await vi.advanceTimersByTimeAsync(29 * MINUTE)

      expect(runner.run).not.toHaveBeenCalled()
    })

    it('한 번 돌고 끝나지 않고 계속 반복한다', async () => {
      const { scopes } = await start()

      await vi.advanceTimersByTimeAsync(90 * MINUTE)

      expect(scopes()).toEqual(['self', 'self', 'self'])
    })
  })

  describe('절전 해제 (FR-005 ③)', () => {
    it('resume 리스너를 등록한다', async () => {
      await start()

      expect(mocks.powerOn).toHaveBeenCalledWith('resume', expect.any(Function))
    })

    // 절전 중에 brew·버전 매니저 상태가 바뀌었을 수 있으므로 무거운 래핑형까지 전부 돈다.
    it('절전에서 깨어나면 전체 어댑터를 돌린다', async () => {
      const { fireResume, scopes } = await start()

      fireResume()

      expect(scopes()).toEqual(['all'])
    })
  })
})
