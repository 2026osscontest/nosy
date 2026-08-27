import { app } from 'electron'
import type { Tray } from 'electron'
import { NodeHost, NodeSnapshotStore } from '@nosy/core'
import { createWindow } from './window'
import { registerIpcHandlers } from './ipc'
import { createTray } from './tray'
import { startScheduler } from './scheduler'
import { startRcWatcher } from './rc-watcher'
import { applyLoginShellPath } from './login-path'

// GC 방지용 보관소. Tray를 whenReady 콜백의 지역 변수로만 두면 수거되어
// 메뉴바 아이콘이 조용히 사라진다.
const retained: Tray[] = []

// Electron 초기화와 겹쳐 두어 기동이 늦어지지 않게 한다. Finder로 띄운 앱은
// 로그인 셸 PATH를 물려받지 못해 진단이 조용히 반쪽이 된다 (login-path.ts 참고).
const loginShellPath = applyLoginShellPath()

app.whenReady().then(async () => {
  // Dock 아이콘을 숨긴다 (pet-window-spec FR-009). app.dock은 macOS에만 있으므로
  // 옵셔널 접근으로 가드한다 — 비-macOS에서도 크래시 없이 떠야 한다 (FR-005).
  app.dock?.hide()

  // 첫 진단은 renderer가 마운트되며 IPC로 들어온다(scheduler.ts 주석 참고).
  // 창을 만들기 전에 기다리면 그 전에 PATH가 준비된다.
  await loginShellPath

  const window = createWindow()
  // 어댑터가 보는 홈과 감시하는 홈이 갈리지 않도록 host 인스턴스를 재사용한다
  // — os.homedir()를 따로 부르면 HOME을 바꿔 띄우는 데모 환경에서 두 경로가 어긋난다.
  const host = new NodeHost()
  const runner = registerIpcHandlers(window, {
    host,
    store: new NodeSnapshotStore()
  })

  retained.push(createTray(window, runner))
  startScheduler(runner)
  startRcWatcher(runner, host.homedir)
})

// 빈 핸들러가 필요하다 — 리스너가 하나도 없으면 Electron이 기본 동작으로 앱을 종료한다.
// 창을 닫아도 앱은 살아 있어야 하고, 종료는 Tray의 "종료" 하나로만 한다 (FR-011).
app.on('window-all-closed', () => {})
