// main 쪽 IPC 배선. 요청 채널은 여기서만 등록하고, 결과는 CHANNEL.state로 밀어넣는다.
// fix 실행은 core의 fix 엔진(applyFix/revertFix)에 그대로 위임한다 — 안전장치 5종
// (ADR-008: sudo 거부·expectedLine 대조·백업 선행)을 main에서 다시 구현하지 않는다.

import { ipcMain, screen } from 'electron'
import type { BrowserWindow } from 'electron'
import {
  ADAPTERS,
  applyFix,
  diffResults,
  mergeResults,
  revertFix,
  runAdapters,
  selfAdapters
} from '@nosy/core'
import type { Finding, FixHost, SnapshotStore } from '@nosy/core'
import { CHANNEL, buildSnapshot, thinkingSnapshot } from '../shared/ipc'
import type { DiagnosticScope, FixResult, PanelPlacement, PetSnapshot } from '../shared/ipc'
import { clampY, nextBounds } from './panel-layout'

export interface DiagnosticsDeps {
  /**
   * fix 엔진이 파일을 써야 하므로 쓰기 가능한 호스트를 받는다.
   * 어댑터에는 이 값을 그대로 넘기더라도 시그니처가 `DiagnosticHost`라 쓰기 능력이 보이지 않는다
   * — "진단은 읽기만 한다"는 경계를 타입으로 지킨다.
   */
  host: FixHost
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
  /**
   * 적용에 성공한 fix의 되돌리기 재료. backupPath만이 아니라 Finding 객체째 보관한다
   * — 적용 직후 재진단하면 그 문제는 해결되어 최신 results에서 사라지는데,
   * core의 revertFix는 finding을 인자로 받기 때문이다.
   */
  const applied = new Map<string, { finding: Finding; backupPath: string }>()

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

  /** 최신 진단 결과에서 findingId를 찾는다. 진단 전이거나 이미 해결된 항목이면 undefined. */
  const findLatest = (findingId: string): Finding | undefined => {
    for (const result of latest?.results ?? []) {
      const found = result.findings.find((finding) => finding.id === findingId)
      if (found) return found
    }
    return undefined
  }

  ipcMain.on(CHANNEL.run, (_event, scope: DiagnosticScope) => run(scope))

  ipcMain.on(CHANNEL.setClickThrough, (_event, ignore: boolean) => {
    // forward: true라야 관통 중에도 창이 마우스 이동을 계속 받아 펫 영역 복귀를 감지한다 (FR-002).
    window.setIgnoreMouseEvents(ignore, { forward: true })
  })

  /**
   * 펼칠 방향은 화면 경계를 봐야 정해지므로 renderer가 결정할 수 없다. 창을 콘텐츠 높이에
   * 맞추고 어느 쪽으로 펼쳤는지 알려준다 — renderer는 그 방향에 맞춰 펫과 말풍선·패널의
   * 위아래 순서를 뒤집는다.
   */
  let placement: PanelPlacement = 'above'

  ipcMain.handle(CHANNEL.setContentHeight, (_event, height: number): PanelPlacement => {
    // 소수나 NaN이 setBounds에 닿으면 main 프로세스가 통째로 죽는다. nextBounds가 반올림하지만
    // 숫자가 아닌 값은 여기서 막는다.
    if (!Number.isFinite(height) || height <= 0) return placement

    const current = window.getBounds()
    const { workArea } = screen.getDisplayMatching(current)
    const next = nextBounds(current, placement, height, workArea)

    placement = next.placement
    window.setBounds(next.bounds)

    return placement
  })

  ipcMain.on(CHANNEL.moveBy, (_event, dx: number, dy: number) => {
    // setPosition은 정수만 받는다. 소수가 들어가면 main 프로세스가 통째로 죽으므로
    // renderer가 정수를 보내더라도 여기서 한 번 더 막는다.
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return

    const bounds = window.getBounds()
    const moved = { ...bounds, x: bounds.x + dx, y: bounds.y + dy }
    const { workArea } = screen.getDisplayMatching(bounds)

    // 위쪽은 macOS가 알아서 막는다. 아래쪽은 막지 않아 그대로 두면 펫이 화면 밖으로 나가
    // 사라지므로 여기서 가둔다 — 한쪽만 막히면 드래그가 비대칭으로 느껴진다.
    window.setPosition(Math.round(moved.x), clampY(moved, workArea))
  })

  ipcMain.handle(CHANNEL.applyFix, async (_event, findingId: string): Promise<FixResult> => {
    const finding = findLatest(findingId)
    if (!finding) {
      return { ok: false, error: '진단 결과에서 해당 항목을 찾을 수 없습니다. 다시 진단해 주세요.' }
    }

    const outcome = await applyFix(deps.host, finding)
    if (!outcome.ok) return { ok: false, error: outcome.error }

    applied.set(findingId, { finding, backupPath: outcome.backupPath as string })
    // toggle-panel-spec FR-002 ③: 실행 후 재진단해 결과를 반영한다.
    await run('all')

    return { ok: true, backupPath: outcome.backupPath }
  })

  ipcMain.handle(CHANNEL.revertFix, async (_event, findingId: string): Promise<FixResult> => {
    const record = applied.get(findingId)
    if (!record) return { ok: false, error: '적용 기록이 없어 되돌릴 수 없습니다.' }

    const outcome = await revertFix(deps.host, record.finding, record.backupPath)
    // 실패했으면 기록을 지우지 않는다 — 백업은 그대로 남아 있으므로 재시도할 수 있어야 한다.
    if (!outcome.ok) return { ok: false, error: outcome.error }

    applied.delete(findingId)
    await run('all')

    return { ok: true, backupPath: outcome.backupPath }
  })

  return { run }
}
