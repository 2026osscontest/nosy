// preload 브릿지와 main IPC 핸들러 배선 테스트.
// Electron은 mock한다 — 이 테스트는 "무엇이 어느 채널로 오가는가"만 검증하고
// 실제 창이나 프로세스를 띄우지 않는다.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindow } from 'electron'
import { ADAPTERS, FakeHost, selfAdapters } from '@nosy/core'
import type { Snapshot, SnapshotStore } from '@nosy/core'
import { CHANNEL } from '../shared/ipc'
import type { PetSnapshot, Placement } from '../shared/ipc'

const mocks = vi.hoisted(() => ({
  exposeInMainWorld: vi.fn(),
  invoke: vi.fn(async () => ({ ok: true })),
  rendererSend: vi.fn(),
  rendererOn: vi.fn(),
  removeListener: vi.fn(),
  handle: vi.fn(),
  mainOn: vi.fn()
}))

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: mocks.exposeInMainWorld },
  ipcRenderer: {
    invoke: mocks.invoke,
    send: mocks.rendererSend,
    on: mocks.rendererOn,
    removeListener: mocks.removeListener
  },
  ipcMain: { handle: mocks.handle, on: mocks.mainOn },
  // 창을 놓을 때 작업 영역을 본다 — 콘텐츠가 화면 밖으로 나가면 안으로 민다
  // (main/panel-layout.ts placeBounds).
  screen: { getDisplayMatching: () => ({ workArea: WORK_AREA }) }
}))

/** 넉넉한 작업 영역 — 이 테스트들은 가두기 자체가 아니라 배선을 본다. */
const WORK_AREA = { x: 0, y: 25, width: 1440, height: 875 }

/** preload를 한 번 로드해 contextBridge에 넘어간 API 객체를 꺼낸다. */
async function loadBridge() {
  vi.resetModules()
  mocks.exposeInMainWorld.mockClear()
  await import('../main/preload')

  const call = mocks.exposeInMainWorld.mock.calls[0]
  return { key: call?.[0] as string, api: call?.[1] as Record<string, unknown> }
}

interface CountingStore extends SnapshotStore {
  saveCount: number
  current: Snapshot
}

function memoryStore(initial: Snapshot = {}): CountingStore {
  let current = initial
  let saveCount = 0

  return {
    get current() {
      return current
    },
    get saveCount() {
      return saveCount
    },
    async load() {
      return current
    },
    async save(snapshot: Snapshot) {
      current = snapshot
      saveCount += 1
    }
  }
}

interface SentMessage {
  channel: string
  payload: PetSnapshot | Placement
}

function fakeWindow(sent: SentMessage[]) {
  return {
    webContents: {
      send: (channel: string, payload: PetSnapshot | Placement) => sent.push({ channel, payload })
    },
    setIgnoreMouseEvents: vi.fn(),
    getPosition: vi.fn(() => [100, 200]),
    getBounds: vi.fn(() => ({ x: 100, y: 200, width: 104, height: 88 })),
    setBounds: vi.fn(),
    setPosition: vi.fn(),
    isDestroyed: () => false
  } as unknown as BrowserWindow
}

beforeEach(() => {
  for (const fn of Object.values(mocks)) fn.mockClear()
})

describe('preload 브릿지', () => {
  it("window.nosy 하나만 노출한다", async () => {
    const { key } = await loadBridge()

    expect(mocks.exposeInMainWorld).toHaveBeenCalledTimes(1)
    expect(key).toBe('nosy')
  })

  it('약속한 9개 항목을 노출한다', async () => {
    const { api } = await loadBridge()

    expect(Object.keys(api).sort()).toEqual(
      [
        'applyFix',
        'moveBy',
        'onPlace',
        'onState',
        'platform',
        'revertFix',
        'run',
        'setClickThrough',
        'setContentSize'
      ].sort()
    )
  })

  // 드래그는 초당 수십 번 발생한다. 응답을 기다리면 창이 커서를 따라오지 못한다.
  it('moveBy는 응답을 기다리지 않고 send로 보낸다', async () => {
    const { api } = await loadBridge()
    ;(api.moveBy as (dx: number, dy: number) => void)(3, -4)

    expect(mocks.rendererSend).toHaveBeenCalledWith(CHANNEL.moveBy, 3, -4)
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  // ipcRenderer를 통째로 노출하면 renderer가 임의 채널을 부를 수 있다.
  it('ipcRenderer나 원시 invoke/send를 그대로 노출하지 않는다', async () => {
    const { api } = await loadBridge()

    expect(api.ipcRenderer).toBeUndefined()
    expect(api.invoke).toBeUndefined()
    expect(api.send).toBeUndefined()
  })

  it('platform은 IPC 왕복 없이 상수로 준다 (pet-window-spec FR-005)', async () => {
    const { api } = await loadBridge()

    expect(api.platform).toBe(process.platform)
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('run은 응답을 기다리지 않고 send로 보낸다', async () => {
    const { api } = await loadBridge()
    ;(api.run as (scope: string) => void)('all')

    expect(mocks.rendererSend).toHaveBeenCalledWith(CHANNEL.run, 'all')
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('setClickThrough도 send로 보낸다', async () => {
    const { api } = await loadBridge()
    ;(api.setClickThrough as (ignore: boolean) => void)(true)

    expect(mocks.rendererSend).toHaveBeenCalledWith(CHANNEL.setClickThrough, true)
  })

  it('applyFix와 revertFix는 결과가 필요하므로 invoke를 쓴다', async () => {
    const { api } = await loadBridge()

    await (api.applyFix as (id: string) => Promise<unknown>)('finding-1')
    await (api.revertFix as (id: string) => Promise<unknown>)('finding-2')

    expect(mocks.invoke).toHaveBeenCalledWith(CHANNEL.applyFix, 'finding-1')
    expect(mocks.invoke).toHaveBeenCalledWith(CHANNEL.revertFix, 'finding-2')
  })

  describe('onState', () => {
    it('state 채널을 구독한다', async () => {
      const { api } = await loadBridge()
      ;(api.onState as (h: (s: PetSnapshot) => void) => void)(() => {})

      expect(mocks.rendererOn).toHaveBeenCalledWith(CHANNEL.state, expect.any(Function))
    })

    // IpcRendererEvent가 React 상태로 새면 안 된다 — 핸들러는 payload만 받아야 한다.
    it('Electron 이벤트 객체를 벗기고 스냅샷만 넘긴다', async () => {
      const { api } = await loadBridge()
      const received: unknown[] = []
      ;(api.onState as (h: (s: PetSnapshot) => void) => void)((s) => received.push(s))

      const listener = mocks.rendererOn.mock.calls[0][1] as (e: unknown, p: unknown) => void
      listener({ sender: 'ipc-event' }, { petState: 'idle' })

      expect(received).toEqual([{ petState: 'idle' }])
    })

    it('반환한 함수를 부르면 구독이 해제된다', async () => {
      const { api } = await loadBridge()
      const unsubscribe = (api.onState as (h: (s: PetSnapshot) => void) => () => void)(() => {})

      expect(typeof unsubscribe).toBe('function')
      unsubscribe()

      expect(mocks.removeListener).toHaveBeenCalledWith(CHANNEL.state, expect.any(Function))
    })
  })
})

describe('registerIpcHandlers', () => {
  /** 지금까지 renderer로 나간 배치 메시지만 골라낸다. */
  function placements(sent: SentMessage[]): Placement[] {
    return sent.filter((m) => m.channel === CHANNEL.place).map((m) => m.payload as Placement)
  }

  async function register(store: CountingStore = memoryStore()) {
    vi.resetModules()
    const sent: SentMessage[] = []
    const window = fakeWindow(sent)
    const deps = { host: new FakeHost(), store }
    const { registerIpcHandlers } = await import('../main/ipc')

    registerIpcHandlers(window, deps)

    const onHandler = (channel: string) =>
      mocks.mainOn.mock.calls.find((c) => c[0] === channel)?.[1] as
        | ((event: unknown, ...args: unknown[]) => unknown)
        | undefined

    return { sent, window, store, onHandler }
  }

  it('요청 채널 4종을 등록한다', async () => {
    await register()

    const registered = [
      ...mocks.mainOn.mock.calls.map((c) => c[0]),
      ...mocks.handle.mock.calls.map((c) => c[0])
    ]

    expect(registered).toContain(CHANNEL.run)
    expect(registered).toContain(CHANNEL.setClickThrough)
    expect(registered).toContain(CHANNEL.applyFix)
    expect(registered).toContain(CHANNEL.revertFix)
  })

  it('state 채널은 등록하지 않는다 (main → renderer 단방향이다)', async () => {
    await register()

    const registered = [
      ...mocks.mainOn.mock.calls.map((c) => c[0]),
      ...mocks.handle.mock.calls.map((c) => c[0])
    ]

    expect(registered).not.toContain(CHANNEL.state)
  })

  // 창은 작업 영역 전체에 못박혀 있다(main/window.ts). 드래그가 옮기는 것은 창이 아니라
  // 창 안에서 펫이 서는 자리이고, 그 자리는 CHANNEL.place로 renderer에 간다.
  it('moveBy는 델타만큼 펫의 자리를 옮긴다 (pet-window FR-001)', async () => {
    const { sent, window, onHandler } = await register()

    onHandler(CHANNEL.moveBy)?.({}, 12, -5)

    // 창을 건드리면 리사이즈 깜빡임이 되살아난다.
    expect(window.setBounds).not.toHaveBeenCalled()
    expect(window.setPosition).not.toHaveBeenCalled()

    // 시작 자리(108,208)에서 델타만큼 간 뒤의 발치. 밀려나지 않았으므로 shove는 0이다.
    expect(placements(sent).at(-1)).toEqual({ x: 0, y: 0, left: 164, top: 250 })
  })

  // Retina·트랙패드에서 screenX는 소수로 온다. 소수가 그대로 좌표에 남으면 펫이 반 픽셀에
  // 걸쳐 그려져 도트가 뭉갠다.
  it('소수 델타가 들어와도 정수 좌표를 보낸다', async () => {
    const { sent, onHandler } = await register()

    onHandler(CHANNEL.moveBy)?.({}, 0.5, -0.5)

    const placement = placements(sent).at(-1)

    expect(placement).toBeDefined()
    for (const value of Object.values(placement as Placement)) {
      expect(Number.isInteger(value)).toBe(true)
    }
  })

  it('숫자가 아닌 델타는 무시한다', async () => {
    const { sent, onHandler } = await register()

    onHandler(CHANNEL.moveBy)?.({}, Number.NaN, undefined)

    expect(placements(sent)).toHaveLength(0)
  })

  it('setClickThrough는 창의 setIgnoreMouseEvents로 이어진다 (pet-window FR-002)', async () => {
    const { window, onHandler } = await register()

    onHandler(CHANNEL.setClickThrough)?.({}, true)

    expect(window.setIgnoreMouseEvents).toHaveBeenCalled()
    expect(vi.mocked(window.setIgnoreMouseEvents).mock.calls[0][0]).toBe(true)
  })

  describe('run 채널', () => {
    it('진단 시작을 알리는 thinking을 먼저 푸시하고, 결과를 뒤이어 푸시한다', async () => {
      const { sent, onHandler } = await register()

      await onHandler(CHANNEL.run)?.({}, 'all')

      expect(sent.length).toBeGreaterThanOrEqual(2)
      expect(sent[0].channel).toBe(CHANNEL.state)
      expect(sent[0].payload.petState).toBe('thinking')
      expect(sent[sent.length - 1].payload.petState).not.toBe('thinking')
    })

    it("scope 'all'은 등록된 어댑터 전부를 실행한다", async () => {
      const { sent, onHandler } = await register()

      await onHandler(CHANNEL.run)?.({}, 'all')

      const last = sent[sent.length - 1].payload

      expect(last.results.map((r) => r.adapter)).toEqual(ADAPTERS.map((a) => a.name))
    })

    // drift-detection-spec FR-006: 30분 주기 체크는 자체형만 돈다.
    it("scope 'self'는 자체형 어댑터만 실행한다", async () => {
      const { sent, onHandler } = await register()

      await onHandler(CHANNEL.run)?.({}, 'self')

      const last = sent[sent.length - 1].payload

      expect(last.results.map((r) => r.adapter)).toEqual(selfAdapters().map((a) => a.name))
    })

    it('실행 결과를 스냅샷에 저장한다', async () => {
      const { store, onHandler } = await register()

      await onHandler(CHANNEL.run)?.({}, 'all')

      expect(store.saveCount).toBe(1)
      expect(Object.keys(store.current).length).toBeGreaterThan(0)
    })

    // ADAPTERS의 homebrew 인스턴스는 프로세스당 하나이고 skipReason→run 사이에 캐시를 든다.
    // 진단이 겹쳐 돌면 그 캐시가 엉키므로 겹치지 않게 막아야 한다.
    it('진단이 이미 도는 중이면 새 요청을 무시한다', async () => {
      const { store, onHandler } = await register()
      const handler = onHandler(CHANNEL.run)

      await Promise.all([handler?.({}, 'all'), handler?.({}, 'all')])

      expect(store.saveCount).toBe(1)
    })

    it('앞선 진단이 끝난 뒤의 요청은 정상 실행한다', async () => {
      const { store, onHandler } = await register()
      const handler = onHandler(CHANNEL.run)

      await handler?.({}, 'all')
      await handler?.({}, 'all')

      expect(store.saveCount).toBe(2)
    })
  })
})
