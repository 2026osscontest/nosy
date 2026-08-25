// 메뉴바 Tray 배선 테스트. docs/specs/pet-window-spec.md FR-010, FR-011 참조.
// Electron은 mock한다 — 실제 메뉴바에 아이콘을 띄우지 않고 "어떤 메뉴가 무엇을 부르는가"만 본다.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindow, MenuItemConstructorOptions } from 'electron'
import type { DiagnosticsRunner } from '../main/ipc'

const mocks = vi.hoisted(() => ({
  createFromDataURL: vi.fn(),
  addRepresentation: vi.fn(),
  setTemplateImage: vi.fn(),
  buildFromTemplate: vi.fn((template: unknown) => ({ template })),
  trayConstructed: vi.fn(),
  setToolTip: vi.fn(),
  setContextMenu: vi.fn(),
  quit: vi.fn(),
  getLoginItemSettings: vi.fn(() => ({ openAtLogin: false })),
  setLoginItemSettings: vi.fn()
}))

vi.mock('electron', () => {
  const image = {
    addRepresentation: mocks.addRepresentation,
    setTemplateImage: mocks.setTemplateImage
  }

  mocks.createFromDataURL.mockReturnValue(image)

  return {
    app: {
      quit: mocks.quit,
      getLoginItemSettings: mocks.getLoginItemSettings,
      setLoginItemSettings: mocks.setLoginItemSettings
    },
    nativeImage: { createFromDataURL: mocks.createFromDataURL },
    Menu: { buildFromTemplate: mocks.buildFromTemplate },
    Tray: class {
      constructor(icon: unknown) {
        mocks.trayConstructed(icon)
      }
      setToolTip = mocks.setToolTip
      setContextMenu = mocks.setContextMenu
    }
  }
})

/** 보임/숨김 상태를 실제로 들고 있는 가짜 창 — 토글 라벨 검증에 필요하다. */
function fakeWindow() {
  let visible = true

  return {
    isVisible: () => visible,
    hide: vi.fn(() => {
      visible = false
    }),
    show: vi.fn(() => {
      visible = true
    }),
    center: vi.fn()
  } as unknown as BrowserWindow
}

function fakeRunner(): DiagnosticsRunner {
  return { run: vi.fn(async () => {}) }
}

/** 가장 최근에 만들어진 메뉴 템플릿 — 토글로 다시 그려질 때마다 갱신된다. */
function currentMenu(): MenuItemConstructorOptions[] {
  const calls = mocks.buildFromTemplate.mock.calls

  return calls[calls.length - 1][0] as MenuItemConstructorOptions[]
}

function itemLabeled(label: string): MenuItemConstructorOptions {
  const item = currentMenu().find((entry) => entry.label === label)

  if (!item) throw new Error(`메뉴에 '${label}'이 없다: ${JSON.stringify(currentMenu())}`)
  return item
}

/** click 핸들러는 (menuItem, window, event) 시그니처지만 여기서는 menuItem만 쓴다. */
function click(label: string, menuItem: Partial<{ checked: boolean }> = {}) {
  const handler = itemLabeled(label).click as unknown as (item: unknown) => void

  handler(menuItem)
}

async function setup() {
  vi.resetModules()
  const window = fakeWindow()
  const runner = fakeRunner()
  const { createTray } = await import('../main/tray')

  createTray(window, runner)

  return { window, runner }
}

beforeEach(() => {
  for (const fn of Object.values(mocks)) fn.mockClear()
  mocks.getLoginItemSettings.mockReturnValue({ openAtLogin: false })
})

describe('createTray', () => {
  it('아이콘을 템플릿 이미지로 등록하고 @2x 표현을 함께 붙인다', async () => {
    await setup()

    expect(mocks.createFromDataURL).toHaveBeenCalled()
    expect(mocks.setTemplateImage).toHaveBeenCalledWith(true)
    expect(mocks.addRepresentation).toHaveBeenCalledWith(
      expect.objectContaining({ scaleFactor: 2 })
    )
  })

  it('FR-010이 요구한 메뉴 4종에 펫 데려오기를 더해 제공한다', async () => {
    await setup()

    const labels = currentMenu()
      .map((item) => item.label)
      .filter(Boolean)

    expect(labels).toEqual([
      '지금 진단하기',
      '펫 데려오기',
      '펫 숨기기',
      '로그인 시 자동 시작',
      '종료'
    ])
  })

  // 드래그는 화면 밖으로 나가는 것을 막지 않는다. 완전히 나가 버리면 끌어올 수단이 없다.
  it("'펫 데려오기'는 창을 화면 가운데로 되돌린다", async () => {
    const { window } = await setup()

    click('펫 데려오기')

    expect(window.center).toHaveBeenCalled()
    expect(window.show).toHaveBeenCalled()
  })

  it("'지금 진단하기'는 전체 스코프로 진단을 돌린다", async () => {
    const { runner } = await setup()

    click('지금 진단하기')

    expect(runner.run).toHaveBeenCalledWith('all')
  })

  describe('펫 표시 토글', () => {
    it('보이는 상태에서 누르면 창을 숨기고 라벨이 뒤집힌다', async () => {
      const { window } = await setup()

      click('펫 숨기기')

      expect(window.hide).toHaveBeenCalled()
      expect(itemLabeled('펫 보이기')).toBeDefined()
    })

    it('숨긴 뒤 다시 누르면 창을 되살린다', async () => {
      const { window } = await setup()

      click('펫 숨기기')
      click('펫 보이기')

      expect(window.show).toHaveBeenCalled()
      expect(itemLabeled('펫 숨기기')).toBeDefined()
    })
  })

  describe('로그인 시 자동 시작', () => {
    it('현재 로그인 항목 설정을 체크 상태로 비춘다', async () => {
      mocks.getLoginItemSettings.mockReturnValue({ openAtLogin: true })
      await setup()

      expect(itemLabeled('로그인 시 자동 시작').checked).toBe(true)
    })

    // 켜는 쪽만 되고 끄는 쪽이 안 되면 FR-008이 말하는 "끄는 방법"이 없어진다.
    it('체크 상태를 그대로 로그인 항목에 반영한다', async () => {
      await setup()

      click('로그인 시 자동 시작', { checked: true })
      expect(mocks.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true })

      click('로그인 시 자동 시작', { checked: false })
      expect(mocks.setLoginItemSettings).toHaveBeenLastCalledWith({ openAtLogin: false })
    })
  })

  // FR-011: 창에는 종료 UI가 존재할 수 없으므로 이 경로가 유일한 종료 수단이다.
  it("'종료'는 앱을 완전히 종료한다", async () => {
    await setup()

    click('종료')

    expect(mocks.quit).toHaveBeenCalled()
  })
})
