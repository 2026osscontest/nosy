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
import type { DiagnosticScope, FixResult, PetSnapshot, Placement } from '../shared/ipc'
import { INITIAL_HEIGHT, INITIAL_WIDTH, petFoot, petOrigin, placeBounds } from './panel-layout'
import type { Point } from './panel-layout'

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
  /**
   * 펫을 작업 영역 한가운데로 되돌린다 (Tray "펫 데려오기", FR-010).
   * 창은 늘 작업 영역 전체이므로 창을 옮기는 것으로는 펫이 움직이지 않는다 — 옮길 것은 home이다.
   */
  recenter(): void
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

  /** renderer가 마지막으로 알려준 콘텐츠 크기. 창 크기가 곧 이 값이다. */
  let content = { width: INITIAL_WIDTH, height: INITIAL_HEIGHT }
  /**
   * 펫의 자리. 드래그로만 바뀌고, 패널을 열고 닫는 것으로는 바뀌지 않는다 — 그래야 패널을
   * 닫았을 때 사용자가 놔둔 자리로 돌아온다 (FR-012).
   */
  let home: Point = petOrigin(window.getBounds())
  /** 직전에 보낸 배치. 같은 값을 반복해서 보내지 않도록 기억한다. */
  let lastPlacement = ''

  /**
   * 지금 크기·자리로 콘텐츠를 놓을 자리를 정해 renderer에 알린다.
   *
   * **창은 건드리지 않는다.** 창은 작업 영역 전체에 못박혀 있고(main/window.ts), 여기서
   * 계산한 사각형은 그 창 안에서 콘텐츠를 그릴 자리다. placeBounds의 계산은 창을 놓을
   * 때와 똑같다 — 달라진 것은 결과를 setBounds에 넣느냐 renderer에 보내느냐뿐이다.
   *
   * 드래그는 초당 수십 번이라 왕복시킬 수 없으므로 push로만 보내고, 값이 실제로 바뀌었을
   * 때만 보낸다.
   */
  const place = (always: boolean): void => {
    if (window.isDestroyed()) return

    const { workArea } = screen.getDisplayMatching(window.getBounds())
    const bounds = placeBounds(home, content, workArea)
    const actual = petOrigin(bounds)

    const foot = petFoot(actual)
    const placement: Placement = {
      x: actual.x - home.x,
      y: actual.y - home.y,
      // 화면 좌표를 창 안의 좌표로 옮긴다. 창이 곧 작업 영역이므로 그 원점만 빼면 된다.
      left: foot.x - workArea.x,
      top: foot.y - workArea.y
    }

    const key = `${placement.x}|${placement.y}|${placement.left}|${placement.top}`

    // 크기가 바뀐 뒤에는 값이 그대로여도 반드시 알린다. renderer가 이 답을 받을 때까지
    // 콘텐츠를 감추고 기다리기 때문이다 — 안 보내면 감춘 채로 남는다.
    if (key === lastPlacement && !always) return
    lastPlacement = key
    window.webContents.send(CHANNEL.place, placement)
  }

  ipcMain.on(CHANNEL.setContentSize, (_event, width: number, height: number) => {
    // 소수나 NaN이 setBounds에 닿으면 main 프로세스가 통째로 죽는다. placeBounds가
    // 반올림하지만 숫자가 아닌 값은 여기서 막는다.
    if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) return

    // home은 건드리지 않는다. 패널을 여느라 콘텐츠가 밀렸더라도 닫으면 제자리로 돌아와야 한다.
    content = { width, height }
    place(true)
  })

  ipcMain.on(CHANNEL.moveBy, (_event, dx: number, dy: number) => {
    // 숫자가 아닌 값이 들어오면 home이 NaN으로 오염돼 펫이 영영 사라진다.
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return

    const { workArea } = screen.getDisplayMatching(window.getBounds())

    // 끄는 동안에는 밀린 결과를 그대로 집으로 삼는다. 그래야 화면 끝에 닿은 뒤에도 home이
    // 화면 밖으로 계속 나가지 않아, 방향을 되돌렸을 때 펫이 즉시 커서를 따라온다.
    // 튕김도 이 경로에서는 늘 0이 된다 — 끄는 중에 펫이 튕기면 커서와 어긋나 보인다.
    home = petOrigin(placeBounds({ x: home.x + dx, y: home.y + dy }, content, workArea))
    // 드래그는 초당 수십 번이다. 값이 그대로면 보내지 않는다.
    place(false)
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

  const recenter = (): void => {
    const { workArea } = screen.getDisplayMatching(window.getBounds())

    // 펫 하나 크기의 상자를 작업 영역 한가운데 놓고, 그 안에서 펫이 설 자리를 집으로 삼는다.
    home = petOrigin({
      x: workArea.x + Math.round((workArea.width - INITIAL_WIDTH) / 2),
      y: workArea.y + Math.round((workArea.height - INITIAL_HEIGHT) / 2),
      width: INITIAL_WIDTH,
      height: INITIAL_HEIGHT
    })
    place(true)
  }

  return { run, recenter }
}
