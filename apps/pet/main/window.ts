// 투명 · 항상 위 · 프레임 없는 창. docs/specs/pet-window-spec.md FR-001 참조.

import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BrowserWindow } from 'electron'

const dirname = fileURLToPath(new URL('.', import.meta.url))

export function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    // 펫보다 크게 잡는다 — 말풍선이 창 밖으로 잘리면 안 된다. 남는 영역은
    // 클릭 관통(FR-002)으로 비워 두므로 아래 창을 가리지 않는다.
    width: 380,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: join(dirname, '../preload/preload.mjs'),
      // preload가 ESM(.mjs)이라 샌드박스를 끄지 않으면 로드 자체가 조용히 실패해
      // renderer에서 window.nosy가 undefined가 된다. contextIsolation은 그대로 켜 두고,
      // nodeIntegration도 기본값(false)을 유지한다 — renderer의 창구는 preload 하나뿐이다.
      sandbox: false,
      contextIsolation: true
    }
  })

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
