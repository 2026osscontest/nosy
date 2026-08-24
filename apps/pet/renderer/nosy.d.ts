// preload가 contextBridge로 심는 window.nosy의 전역 선언.
// 표면 정의는 shared/ipc.ts의 NosyApi 한 곳뿐이다 — 여기서 다시 적지 않는다.

import type { NosyApi } from '../shared/ipc'

declare global {
  interface Window {
    nosy: NosyApi
  }
}

export {}
