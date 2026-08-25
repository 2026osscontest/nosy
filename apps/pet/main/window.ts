// 투명 · 항상 위 · 프레임 없는 창. docs/specs/pet-window-spec.md FR-001 참조.

import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BrowserWindow, screen } from 'electron'

const dirname = fileURLToPath(new URL('.', import.meta.url))

/**
 * 창은 작업 영역 전체를 덮고, 그 뒤로 **크기가 절대 바뀌지 않는다.**
 *
 * 콘텐츠에 맞춰 창을 키웠다 줄였다 하면 두 가지가 따라온다.
 * 하나는 깜빡임 — macOS는 투명 창의 크기를 바꿀 때마다 그리는 표면을 새로 잡느라 한
 * 프레임을 비운다. 패널을 여닫을 때마다 그 빈 프레임이 보였다.
 * 다른 하나는 드래그 상한선 — macOS는 보이는 창의 top을 작업 영역 아래로 강제하는데,
 * 펫이 창 하단에 붙어 있으므로 창이 높을수록 펫이 위로 갈 수 있는 한계가 그만큼 내려간다.
 *
 * 창을 작업 영역에 못박으면 둘 다 사라진다. 크기가 안 바뀌니 표면을 다시 잡을 일이 없고,
 * 창 top이 이미 작업 영역 맨 위라 더 밀려날 자리도 없다. 움직이는 것은 창이 아니라 창
 * **안에서** 콘텐츠를 놓는 자리이며, 그 계산은 main/panel-layout.ts가 그대로 한다.
 */
export function createWindow(): BrowserWindow {
  const { workArea } = screen.getPrimaryDisplay()

  const window = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    // 투명 창이어도 macOS는 창 사각형 전체에 드롭섀도를 그린다. 펫 뒤로 네모난
    // 그림자가 비치고, 포커스를 받으면 활성 창용 진한 그림자로 바뀌어 더 도드라진다.
    hasShadow: false,
    webPreferences: {
      preload: join(dirname, '../preload/preload.mjs'),
      // preload가 ESM(.mjs)이라 샌드박스를 끄지 않으면 로드 자체가 조용히 실패해
      // renderer에서 window.nosy가 undefined가 된다. contextIsolation은 그대로 켜 두고,
      // nodeIntegration도 기본값(false)을 유지한다 — renderer의 창구는 preload 하나뿐이다.
      sandbox: false,
      contextIsolation: true
    }
  })

  // 창이 화면을 통째로 덮으므로, 관통을 켜기 전까지는 화면 전체의 클릭을 삼킨다. renderer가
  // 켜 주기를 기다리면 그때까지 사용자가 아무것도 누를 수 없다 — 만들자마자 켜 둔다.
  // forward: true라야 관통 중에도 마우스 이동이 계속 와서 펫 영역 진입을 감지할 수 있다.
  window.setIgnoreMouseEvents(true, { forward: true })

  // 기본값이면 창이 만들어진 Space에만 남아, 데스크톱을 바꾸면 펫이 사라진다.
  // 상주형 펫이므로 모든 Space를 따라다녀야 한다. visibleOnFullScreen까지 켜야
  // 전체화면 앱 위에서도 보인다.
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    window.loadFile(join(dirname, '../renderer/index.html'))
  }

  return window
}
