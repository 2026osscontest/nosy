# Step 1: ipc-wiring

## 읽어야 할 파일

- `apps/pet/shared/ipc.ts` — **step 0에서 만든 계약 모듈이다. 이 step의 상류다**
- `apps/pet/main/preload.ts` — 현재 `exposeInMainWorld('nosy', {})` 빈 객체. 채울 대상
- `apps/pet/main/index.ts`, `main/window.ts` — 창 생성 흐름
- `apps/pet/test/ipc-wiring.test.ts` — 이 step의 합격 기준. 이미 작성되어 있다
- `packages/core/src/run.ts` — `ADAPTERS`, `selfAdapters`, `runAdapters`
- `packages/core/src/snapshot.ts` — `SnapshotStore`, `NodeSnapshotStore`, `diffResults`, `mergeResults`
- `docs/specs/pet-window-spec.md` FR-002(클릭 관통), FR-010(Tray 메뉴)
- `docs/ADR.md` ADR-008 — fix 안전장치. 이 step에서 fix를 **구현하지 않는** 이유와 연결된다

## 작업

두 파일을 만든다/채운다.

### 1. `apps/pet/main/ipc.ts` (신규)

```ts
export interface DiagnosticsDeps {
  host: DiagnosticHost
  store: SnapshotStore
}

/** 진단 1회: 어댑터 실행 → 드리프트 비교 → 스냅샷 저장 → PetSnapshot 조립 */
export async function runDiagnostics(scope: DiagnosticScope, deps: DiagnosticsDeps): Promise<PetSnapshot>

/** IPC 핸들러를 등록한다. 결과는 window.webContents로 밀어넣는다. */
export function registerIpcHandlers(window: BrowserWindow, deps: DiagnosticsDeps): void
```

**`runDiagnostics` 흐름**

1. `scope === 'self'`면 `selfAdapters()`, `'all'`이면 `ADAPTERS`를 대상으로 `runAdapters(deps.host, 대상)` 실행
2. `deps.store.load()`로 이전 스냅샷을 읽는다
3. `diffResults(이전, 결과)`로 드리프트를 구한다
4. `mergeResults(이전, 결과)`를 `deps.store.save()`로 저장한다
5. `buildSnapshot(결과, 드리프트, ranAt)`을 반환한다. `ranAt`은 이번 실행 시각(ISO 8601)

순서가 중요하다 — **저장 전에 비교해야 한다.** 먼저 저장하면 이전 상태가 덮여 드리프트가 항상 0이 된다.

**`registerIpcHandlers` 등록 내용**

| 채널 | 방식 | 동작 |
|---|---|---|
| `CHANNEL.run` | `ipcMain.on` | 아래 "run 핸들러" |
| `CHANNEL.setClickThrough` | `ipcMain.on` | `window.setIgnoreMouseEvents(ignore, { forward: true })` |
| `CHANNEL.applyFix` | `ipcMain.handle` | **스텁** — `{ ok: false, error: '아직 구현되지 않았습니다' }` 반환 |
| `CHANNEL.revertFix` | `ipcMain.handle` | **스텁** — 위와 동일 |

`CHANNEL.state`는 등록하지 마라. main → renderer 단방향이라 수신부가 main에 있으면 안 된다.

**run 핸들러**

1. `thinkingSnapshot(마지막 스냅샷)`을 `CHANNEL.state`로 즉시 푸시한다 — 사용자가 펫이 반응하는 걸 바로 봐야 한다
2. `runDiagnostics`를 실행한다
3. 결과 `PetSnapshot`을 `CHANNEL.state`로 푸시한다
4. 마지막 결과 스냅샷을 모듈 안에 기억해 둔다(다음 `thinkingSnapshot`의 인자로 쓴다)

**진단 중복 실행 방지**: 진단이 이미 진행 중이면 새 `run` 요청을 조용히 무시한다. 트리거가 셋(펫 클릭·Tray·타이머)이라 겹칠 수 있는데, `ADAPTERS`의 homebrew 어댑터 인스턴스는 프로세스당 하나이고 `skipReason` → `run` 사이에 1회성 캐시를 들고 있어서, 겹쳐 돌면 그 캐시가 엉킨다. 진단이 끝난 뒤의 요청은 정상 실행해야 한다.

푸시하기 전에 창이 살아 있는지 확인하라(`window.isDestroyed()`).

### 2. `apps/pet/main/preload.ts` (교체)

`contextBridge.exposeInMainWorld('nosy', ...)`로 아래 6개만 노출한다:

```ts
{
  platform: process.platform,                              // IPC 왕복 없음
  run(scope: DiagnosticScope): void,                       // ipcRenderer.send
  setClickThrough(ignore: boolean): void,                  // ipcRenderer.send
  applyFix(findingId: string): Promise<FixResult>,         // ipcRenderer.invoke
  revertFix(findingId: string): Promise<FixResult>,        // ipcRenderer.invoke
  onState(handler: (snapshot: PetSnapshot) => void): () => void
}
```

- `run`과 `setClickThrough`는 응답이 필요 없으므로 `send`를 쓴다. `invoke`로 만들지 마라.
- `onState`는 `ipcRenderer.on(CHANNEL.state, listener)`로 구독하고, **구독을 해제하는 함수를 반환한다**(`removeListener`). React의 `useEffect` 정리 함수로 그대로 쓰인다.
- `onState`의 listener는 Electron의 `IpcRendererEvent`를 벗기고 **payload만** 핸들러에 넘긴다. 이벤트 객체가 React 상태로 새면 안 된다.
- **`ipcRenderer`나 원시 `invoke`/`send`를 그대로 노출하지 마라.** renderer가 임의 채널을 부를 수 있게 되어 `contextIsolation`의 의미가 사라진다.

### 3. `apps/pet/main/index.ts` 연결

`createWindow()` 뒤에 `registerIpcHandlers(window, { host: new NodeHost(), store: new NodeSnapshotStore() })`를 호출해 실제로 배선한다.

## 이 step의 범위가 아닌 것

- **fix 실행·백업·되돌리기 로직을 구현하지 마라.** `applyFix`/`revertFix`는 스텁이다. 실행 경로의 소재지와 `.bak` 백업 규칙(ADR-008)은 별도 작업의 주제이며, 여기서 정하면 두 번 짓게 된다.
- Tray 메뉴·Dock 숨김(ADR-011), 드래그, 30분 타이머(`scheduler.ts`)는 다른 작업이다. 손대지 마라.
- `renderer/` 아래 컴포넌트(`Bubble.tsx`, `FixPanel.tsx`, `PetView.tsx`)를 수정하지 마라.

## Acceptance Criteria

- AC 명령: lint, build, test
- 기준 테스트: `apps/pet/test/ipc-wiring.test.ts` — **이 테스트들이 너의 합격 기준이다.** step 0의 `ipc-contract.test.ts`도 계속 통과해야 한다.

## 검증 절차

1. AC 명령을 직접 실행해보며 자가수정하라. 단, 합격 판정은 러너가 내린다.
2. 작업을 마치면 `phases/ipc-contract/step1-output.json`에 `{"summary": "산출물 한 줄 요약"}`을 작성하라.

## 금지사항

- 테스트 파일(`apps/pet/test/`)을 수정·삭제·추가하지 마라 (잠금이 걸려 있다). 기준이 잘못됐다면 output에 blocked_reason으로 신고하라.
- `phases/` 아래 index.json을 수정하지 마라 (러너 전유물).
- `apps/pet/shared/ipc.ts`를 수정하지 마라 — step 0의 산출물이며 이 step의 상류 계약이다. 부족한 게 있으면 output에 blocked_reason으로 신고하라.
- `packages/core` 아래를 수정하지 마라.
- 기존 테스트를 깨뜨리지 마라.
