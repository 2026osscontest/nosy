// main 쪽 IPC 배선. 요청 채널은 여기서만 등록하고, 결과는 CHANNEL.state로 밀어넣는다.
// fix 실행(ADR-008 안전장치 5종)은 이 step의 범위가 아니라 applyFix/revertFix는 스텁이다.

import { ipcMain } from 'electron'
import type { BrowserWindow } from 'electron'
import { ADAPTERS, diffResults, mergeResults, runAdapters, selfAdapters } from '@nosy/core'
import type { DiagnosticHost, SnapshotStore } from '@nosy/core'
import { CHANNEL, buildSnapshot, thinkingSnapshot } from '../shared/ipc'
import type { DiagnosticScope, FixResult, PetSnapshot } from '../shared/ipc'

export interface DiagnosticsDeps {
  host: DiagnosticHost
  store: SnapshotStore
}

/** 진단 1회: 어댑터 실행 → 드리프트 비교 → 스냅샷 저장 → PetSnapshot 조립. */
export async function runDiagnostics(
  scope: DiagnosticScope,
  deps: DiagnosticsDeps
): Promise<PetSnapshot> {
  const ranAt = new Date().toISOString()
  const results = await runAdapters(deps.host, scope === 'self' ? selfAdapters() : ADAPTERS)

  // 저장보다 비교가 먼저다 — 먼저 저장하면 기준선이 이번 결과로 덮여 드리프트가 항상 0이 된다.
  const previous = await deps.store.load()
  const drift = diffResults(previous, results)
  await deps.store.save(mergeResults(previous, results))

  return buildSnapshot(results, drift, ranAt)
}

/**
 * 진단은 프로세스 전체에서 한 번에 하나만 돈다. ADAPTERS의 homebrew 인스턴스는 프로세스당
 * 하나이고 skipReason→run 사이에 1회성 캐시를 들기 때문에, 트리거 셋(펫 클릭·Tray·타이머)이
 * 겹쳐 돌면 그 캐시가 엉킨다.
 */
let running = false
/** 다음 thinking 푸시에 쓸 마지막 결과 — 진단 중 화면의 숫자가 깜빡이지 않게 유지한다. */
let latest: PetSnapshot | undefined

const notImplemented = (): FixResult => ({ ok: false, error: '아직 구현되지 않았습니다' })

/**
 * renderer 밖(Tray·스케줄러)에서 진단을 트리거하는 창구.
 * IPC 채널과 같은 단일 실행 가드를 공유해야 하므로 별도 함수로 만들지 않고 여기서 넘겨준다.
 */
export interface DiagnosticsRunner {
  /** 이미 진단이 돌고 있으면 무시된다. 결과는 언제나 CHANNEL.state로만 도착한다. */
  run(scope: DiagnosticScope): Promise<void>
}

/** IPC 핸들러를 등록한다. 결과는 window.webContents로 밀어넣는다. */
export function registerIpcHandlers(
  window: BrowserWindow,
  deps: DiagnosticsDeps
): DiagnosticsRunner {
  const push = (snapshot: PetSnapshot): void => {
    if (window.isDestroyed()) return
    window.webContents.send(CHANNEL.state, snapshot)
  }

  const run = async (scope: DiagnosticScope): Promise<void> => {
    if (running) return
    running = true

    try {
      // 사용자가 펫의 반응을 즉시 봐야 하므로 결과를 기다리지 않고 먼저 표정을 바꾼다.
      push(thinkingSnapshot(latest))
      latest = await runDiagnostics(scope, deps)
      push(latest)
    } finally {
      running = false
    }
  }

  ipcMain.on(CHANNEL.run, (_event, scope: DiagnosticScope) => run(scope))

  ipcMain.on(CHANNEL.setClickThrough, (_event, ignore: boolean) => {
    // forward: true라야 관통 중에도 창이 마우스 이동을 계속 받아 펫 영역 복귀를 감지한다 (FR-002).
    window.setIgnoreMouseEvents(ignore, { forward: true })
  })

  ipcMain.on(CHANNEL.moveBy, (_event, dx: number, dy: number) => {
    // 화면 좌표 델타를 그대로 더한다. renderer가 커서의 screenX/screenY 차이를 보내므로
    // 창이 커서 아래에서 움직여도 어긋나지 않는다.
    const [x, y] = window.getPosition()
    window.setPosition(x + dx, y + dy)
  })

  ipcMain.handle(CHANNEL.applyFix, notImplemented)
  ipcMain.handle(CHANNEL.revertFix, notImplemented)

  return { run }
}
