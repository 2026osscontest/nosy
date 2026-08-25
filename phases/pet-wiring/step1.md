# Step 1: scheduler

`apps/pet/main/scheduler.ts`의 빈 함수를 실제 주기 실행으로 채운다.

## 읽어야 할 파일

- `AGENTS.md` — 특히 "알려진 함정" 절
- `docs/specs/drift-detection-spec.md` — FR-005, FR-006
- `apps/pet/main/scheduler.ts` — 이번에 수정할 파일 (현재 빈 함수)
- `apps/pet/main/ipc.ts` — `DiagnosticsRunner` 인터페이스. **step 0에서 이미 수정된 상태다. 다시 수정하지 마라.**
- `apps/pet/main/index.ts` — 호출부. 시그니처 변경에 맞춰 함께 고쳐야 한다.
- `apps/pet/main/tray.ts` — `DiagnosticsRunner`를 쓰는 기존 예시

## 작업

### 1. 시그니처를 바꾼다

```ts
export function startScheduler(runner: DiagnosticsRunner): void
```

`BrowserWindow`가 아니라 `DiagnosticsRunner`를 받는다. 이유: `registerIpcHandlers`가 반환하는 runner를 써야 IPC 채널과 **같은 단일 실행 가드**를 공유한다. 창을 받아 직접 진단을 돌리면 타이머와 사용자 클릭이 겹칠 때 homebrew 어댑터의 1회성 캐시가 엉킨다.

`apps/pet/main/index.ts`의 `startScheduler(window)` 호출을 `startScheduler(runner)`로 고친다.

### 2. 트리거 2종을 건다 (drift-detection-spec FR-005)

- **30분마다** → `runner.run('self')`. 자체형 어댑터만 돈다 (FR-006). `setInterval`을 쓴다.
- **절전 해제 시** → `powerMonitor.on('resume', ...)` → `runner.run('all')`. 무거운 래핑형까지 전부 돈다.

`powerMonitor`는 `electron`에서 import한다.

`runner.run`은 Promise를 반환한다. 콜백에서 부유 Promise 경고가 나지 않도록 `void`로 명시하거나 동등하게 처리하라 — `tray.ts`가 `() => void runner.run('all')` 형태를 이미 쓰고 있으니 그 관례를 따르라.

### 3. 앱 실행 시 1회는 걸지 않는다

FR-005 ①("앱 실행 시 1회")은 **renderer가 마운트될 때 `window.nosy.run('all')`을 호출하는 것으로 이미 충족되어 있다** (`apps/pet/renderer/main.tsx` 참조). 스케줄러에서 다시 걸면 중복 트리거가 된다. 실행 가드가 막아주긴 하지만 의도가 흐려지므로 걸지 마라. 대신 **그 사실을 파일 상단 주석에 남겨라** — 나중에 읽는 사람이 "FR-005 ①이 빠졌다"고 오해하지 않도록.

### 4. 상수

30분은 매직 넘버로 흩뿌리지 말고 이름 있는 상수로 둔다 (예: `const SELF_CHECK_INTERVAL_MS = 30 * 60 * 1000`).

## Acceptance Criteria

- AC 명령: lint, build, test
- 기준 테스트: `apps/pet/test/fix-ipc.test.ts`, `apps/pet/test/scheduler.test.ts` — **이 테스트들이 너의 합격 기준이다.**

## 검증 절차

1. AC 명령을 직접 실행해보며 자가수정하라. 단, 합격 판정은 러너가 내린다.
2. 작업을 마치면 `phases/pet-wiring/step1-output.json`에 `{"summary": "산출물 한 줄 요약"}`을 작성하라.

## 금지사항

- 테스트 파일을 수정·삭제·추가하지 마라 (잠금이 걸려 있다). 기준이 잘못됐다면 output에 blocked_reason으로 신고하라.
- `phases/` 아래 index.json을 수정하지 마라 (러너 전유물).
- `apps/pet/main/ipc.ts`를 수정하지 마라. 이유: step 0의 산출물이다. `DiagnosticsRunner` 타입은 import해서 쓰기만 한다.
- `apps/pet/shared/ipc.ts`와 `apps/pet/renderer/` 아래를 건드리지 마라. 이유: 다른 세션이 동시에 작업 중이라 병합 충돌이 난다.
- 스케줄러에 자체 진단 로직(`runAdapters` 직접 호출 등)을 넣지 마라. 이유: 실행 가드를 우회하게 된다. 진단은 오직 `runner.run`으로만 트리거한다.
- 기존 테스트를 깨뜨리지 마라.
