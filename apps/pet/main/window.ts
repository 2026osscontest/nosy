// 투명 · 항상 위 · 프레임 없는 창. docs/specs/pet-window-spec.md FR-001 참조.

import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BrowserWindow } from 'electron'

const dirname = fileURLToPath(new URL('.', import.meta.url))

export function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 200,
    height: 200,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: join(dirname, '../preload/preload.mjs')
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    window.loadFile(join(dirname, '../renderer/index.html'))
  }

  return window
}
