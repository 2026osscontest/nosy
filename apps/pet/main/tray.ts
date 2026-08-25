// 메뉴바 Tray. docs/specs/pet-window-spec.md FR-010, FR-011 참조.
// 창이 frame:false + 클릭 관통이라 창 안에는 종료 UI가 존재할 수 없다 —
// 앱의 종료 경로는 여기 "종료" 메뉴 하나로 고정한다.

import { Menu, Tray, app, nativeImage } from 'electron'
import type { BrowserWindow } from 'electron'
import { TRAY_ICON_1X, TRAY_ICON_2X } from './tray-icon'
import type { DiagnosticsRunner } from './ipc'

function trayImage() {
  const image = nativeImage.createFromDataURL(TRAY_ICON_1X)

  image.addRepresentation({ scaleFactor: 2, dataURL: TRAY_ICON_2X })
  // 알파만 쓰는 흑백 아이콘임을 알린다 — AppKit이 라이트·다크 메뉴바에 맞춰 색을 뒤집어 준다.
  image.setTemplateImage(true)

  return image
}

/**
 * 반환한 Tray는 호출자가 붙들고 있어야 한다. 지역 변수로 두면 GC되어 메뉴바 아이콘이 사라진다.
 */
export function createTray(window: BrowserWindow, runner: DiagnosticsRunner): Tray {
  const tray = new Tray(trayImage())

  tray.setToolTip('Nosy')

  // 펫 표시 토글은 라벨이 상태에 따라 바뀌므로 누를 때마다 메뉴를 다시 만든다.
  const render = (): void => {
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: '지금 진단하기', click: () => void runner.run('all') },
        // 드래그는 화면 밖으로 나가는 것을 막지 않는다(무엇이 잘렸는지 힌트로 알린다).
        // 펫이 완전히 나가 버리면 끌어올 수단이 없으므로 여기서 되찾는다.
        {
          label: '펫 데려오기',
          click: () => {
            window.center()
            window.show()
            render()
          }
        },
        {
          label: window.isVisible() ? '펫 숨기기' : '펫 보이기',
          click: () => {
            if (window.isVisible()) window.hide()
            else window.show()
            render()
          }
        },
        { type: 'separator' },
        {
          label: '로그인 시 자동 시작',
          type: 'checkbox',
          checked: app.getLoginItemSettings().openAtLogin,
          click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked })
        },
        { type: 'separator' },
        { label: '종료', click: () => app.quit() }
      ])
    )
  }

  render()

  return tray
}
