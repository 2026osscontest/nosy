// IPC 브릿지. renderer가 볼 수 있는 창구는 window.nosy 하나뿐이다.
// ipcRenderer나 원시 invoke/send는 노출하지 않는다 — 노출하면 renderer가 임의 채널을 부를 수 있어
// contextIsolation의 의미가 사라진다.

import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { CHANNEL } from '../shared/ipc'
import type {
  Placement,
  DiagnosticScope,
  FixResult,
  NosyApi,
  PetSnapshot
} from '../shared/ipc'

// NosyApi로 못박아 둔다 — 여기서 빠뜨린 메서드는 renderer의 전역 선언과 어긋나 컴파일에서 걸린다.
const api: NosyApi = {
  /** IPC 왕복 없이 상수로 준다 (pet-window-spec FR-005). */
  platform: process.platform,

  run: (scope: DiagnosticScope): void => ipcRenderer.send(CHANNEL.run, scope),

  setClickThrough: (ignore: boolean): void => ipcRenderer.send(CHANNEL.setClickThrough, ignore),

  moveBy: (dx: number, dy: number): void => ipcRenderer.send(CHANNEL.moveBy, dx, dy),

  setContentSize: (width: number, height: number): void =>
    ipcRenderer.send(CHANNEL.setContentSize, width, height),

  /** 구독 해제 함수를 반환한다 — onState와 같은 규약이다. */
  onPlace: (handler: (placement: Placement) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, placement: Placement): void => handler(placement)

    ipcRenderer.on(CHANNEL.place, listener)
    return () => ipcRenderer.removeListener(CHANNEL.place, listener)
  },

  /** 구독 해제 함수를 반환한다 — onState와 같은 규약이다. */
  onMotion: (handler: (enabled: boolean) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, enabled: boolean): void => handler(enabled)

    ipcRenderer.on(CHANNEL.motion, listener)
    return () => ipcRenderer.removeListener(CHANNEL.motion, listener)
  },

  applyFix: (findingId: string): Promise<FixResult> =>
    ipcRenderer.invoke(CHANNEL.applyFix, findingId),

  revertFix: (findingId: string): Promise<FixResult> =>
    ipcRenderer.invoke(CHANNEL.revertFix, findingId),

  /** 구독 해제 함수를 반환한다 — React useEffect의 정리 함수로 그대로 쓴다. */
  onState: (handler: (snapshot: PetSnapshot) => void): (() => void) => {
    // IpcRendererEvent를 벗기고 payload만 넘긴다. 이벤트 객체가 React 상태로 새면 안 된다.
    const listener = (_event: IpcRendererEvent, snapshot: PetSnapshot): void => handler(snapshot)

    ipcRenderer.on(CHANNEL.state, listener)
    return () => ipcRenderer.removeListener(CHANNEL.state, listener)
  }
}

contextBridge.exposeInMainWorld('nosy', api)
