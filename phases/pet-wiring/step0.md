# Step 0: fix-ipc

`apps/pet/main/ipc.ts`의 fix 스텁을 `@nosy/core`의 fix 엔진에 연결한다.

## 읽어야 할 파일

먼저 아래 파일들을 읽고 아키텍처와 설계 의도를 파악하라:

- `AGENTS.md` — 특히 "알려진 함정" 절 전체
- `docs/ADR.md` (ADR-008 안전장치 5종), `docs/specs/toggle-panel-spec.md`
- `apps/pet/main/ipc.ts` — 이번에 수정할 파일
- `apps/pet/shared/ipc.ts` — `CHANNEL`, `FixResult`, `PetSnapshot` 계약 (수정 금지)
- `packages/core/src/fix.ts` — `applyFix` / `revertFix` / `FixOutcome`
- `packages/core/src/host.ts` — `DiagnosticHost`, `FixHost`
- `packages/core/src/types.ts` — `Finding`, `Fix`, `FixEdit`
- `apps/pet/test/ipc-wiring.test.ts` — 기존 배선 테스트. **깨뜨리지 말 것.**

## 작업

### 1. `DiagnosticsDeps.host`의 타입을 좁힌다

```ts
export interface DiagnosticsDeps {
  host: FixHost   // DiagnosticHost → FixHost
  store: SnapshotStore
}
```

`NodeHost`와 `FakeHost`는 이미 `FixHost`를 구현하므로 호출부(`apps/pet/main/index.ts`) 수정은 불필요하다.

`FixHost`는 쓰기 가능한 host다. **어댑터에는 절대 주입하지 않는다** — `runAdapters`에 넘기는 인자는 지금처럼 그대로 두면 되고, 어댑터 시그니처를 `FixHost`로 바꾸지 마라. 이유: 어댑터가 파일을 쓸 수 있게 되는 순간 "진단은 읽기만 한다"는 경계가 무너진다.

### 2. 적용 기록을 `Finding` 객체째 보관한다

`registerIpcHandlers` 안에 모듈 스코프가 아닌 **핸들러 클로저 스코프**로 다음 맵을 둔다:

```ts
const applied = new Map<string, { finding: Finding; backupPath: string }>()
```

`backupPath`만 저장하면 안 된다. 이유: apply 성공 직후 재진단하면 그 문제는 해결되었으므로 최신 `results`에서 해당 `Finding`이 사라진다. 그런데 core의 `revertFix(host, finding, backupPath)`는 `finding`을 인자로 받는다. 최신 결과에서만 조회하면 되돌리기가 영구히 불가능해진다.

### 3. `CHANNEL.applyFix` 핸들러

`ipcMain.handle(CHANNEL.applyFix, async (_event, findingId: string): Promise<FixResult> => ...)`

1. 최신 스냅샷(`latest`)의 `results`를 훑어 `finding.id === findingId`인 `Finding`을 찾는다.
   - 없으면 `{ ok: false, error: '진단 결과에서 해당 항목을 찾을 수 없습니다. 다시 진단해 주세요.' }`를 반환한다. **core를 호출하지 않는다.**
2. core의 `applyFix(deps.host, finding)`을 호출한다.
3. `ok`가 false면 core가 준 `error`를 그대로 담아 반환한다. **main에서 안전장치를 다시 구현하지 마라** — sudo 거부, `expectedLine` 대조, 백업 선행은 전부 core `fix.ts`가 이미 한다. 두 곳에 흩어지면 규칙이 어긋난다.
4. `ok`가 true면 `applied.set(findingId, { finding, backupPath })`로 기록한 뒤 **재진단을 실행한다** (toggle-panel-spec FR-002 ③). 기존 `run` 함수를 재사용하면 결과가 자동으로 `CHANNEL.state`로 흘러간다.
5. `{ ok: true, backupPath }`를 반환한다.

`FixOutcome`과 `FixResult`는 필드가 같지만 서로 다른 타입이다(core / IPC 계약). 그대로 스프레드해서 넘겨도 되고 명시적으로 옮겨도 되지만, `shared/ipc.ts`의 `FixResult` 정의를 바꾸지는 마라.

### 4. `CHANNEL.revertFix` 핸들러

1. `applied.get(findingId)`로 조회한다.
   - 없으면 `{ ok: false, error: '적용 기록이 없어 되돌릴 수 없습니다.' }`
2. core의 `revertFix(deps.host, finding, backupPath)`를 호출한다.
3. `ok`가 false면 core의 `error`를 그대로 반환한다. **맵에서 지우지 마라** — 복원이 실패했으므로 백업은 여전히 유효하고 재시도할 수 있어야 한다.
4. `ok`가 true면 `applied.delete(findingId)` 후 재진단을 실행하고 결과를 반환한다.

### 5. 재진단 중복 실행

기존 `running` 가드가 이미 진단 동시 실행을 막는다. fix 이후 재진단도 같은 `run`을 거치므로 별도 가드를 새로 만들지 마라.

### 6. `notImplemented` 제거

이제 쓰이지 않으므로 지운다.

## Acceptance Criteria

- AC 명령: lint, build, test
- 기준 테스트: `apps/pet/test/fix-ipc.test.ts` — **이 테스트가 너의 합격 기준이다.**

## 검증 절차

1. AC 명령을 직접 실행해보며 자가수정하라. 단, 합격 판정은 러너가 내린다.
2. 작업을 마치면 `phases/pet-wiring/step0-output.json`에 `{"summary": "산출물 한 줄 요약"}`을 작성하라.

## 금지사항

- 테스트 파일을 수정·삭제·추가하지 마라 (잠금이 걸려 있다). 기준이 잘못됐다면 output에 blocked_reason으로 신고하라.
- `phases/` 아래 index.json을 수정하지 마라 (러너 전유물).
- `apps/pet/shared/ipc.ts`를 수정하지 마라. 이유: renderer·preload·main 세 곳이 공유하는 계약이고, 다른 브랜치가 동시에 작업 중이라 병합 충돌이 난다.
- `apps/pet/renderer/` 아래 어떤 파일도 건드리지 마라. 이유: UI는 별도 세션이 동시에 작업 중이다.
- `apps/pet/main/scheduler.ts`를 건드리지 마라. 이유: step 1의 범위다.
- `packages/core/` 아래를 수정하지 마라. 이유: fix 엔진은 이미 완성·검증되었고 이 step은 배선만 한다.
- main 프로세스에 sudo 실행, 임의 셸 문자열 실행(`fix.command`를 exec에 넘기는 것)을 추가하지 마라. 이유: ADR-008이 금지한 안전 경계이며 재논의 금지 항목이다.
- 기존 테스트를 깨뜨리지 마라.
