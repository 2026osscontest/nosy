# Step 0: ipc-shared-contract

## 읽어야 할 파일

먼저 아래 파일들을 읽고 설계 의도를 파악하라:

- `docs/UI_GUIDE.md` "캐릭터 상태 4종" 표 — **펫 상태 매핑의 정본이다**
- `docs/specs/pet-window-spec.md` FR-003(펫 상태 4종), FR-005(플랫폼 표기)
- `docs/specs/drift-detection-spec.md` FR-004(새 error → alarmed)
- `docs/specs/health-score-spec.md` FR-004(skip은 감점·집계에서 제외)
- `packages/core/src/types.ts` — `PetState`, `HealthScore`, `AdapterResult`, `DriftResult` 스키마
- `packages/core/src/score.ts` — `computeHealthScore`
- `apps/pet/test/ipc-contract.test.ts` — 이 step의 합격 기준. 이미 작성되어 있다

## 작업

`apps/pet/shared/ipc.ts`를 새로 만들어라. main·preload·renderer 세 곳이 공유하는 계약 모듈이다.

**Electron을 import하지 마라.** 이 파일은 순수 타입·상수·함수만 담는다. `electron`을 import하면 renderer 번들이 깨진다.

### 내보낼 것

```ts
export const CHANNEL = {
  run: 'nosy:run',
  applyFix: 'nosy:apply-fix',
  revertFix: 'nosy:revert-fix',
  setClickThrough: 'nosy:set-click-through',
  state: 'nosy:state'
} as const

export type DiagnosticScope = 'all' | 'self'

/** main → renderer로 밀어넣는 단일 상태 덩어리. renderer는 이것 하나만 보고 그린다. */
export interface PetSnapshot {
  petState: PetState
  score: HealthScore
  results: AdapterResult[]
  drift: DriftResult
  ranAt: string
}

export interface FixResult {
  ok: boolean
  backupPath?: string
  error?: string
}

export function petStateFor(results: AdapterResult[], drift: DriftResult): PetState
export function buildSnapshot(results: AdapterResult[], drift: DriftResult, ranAt: string): PetSnapshot
export function thinkingSnapshot(previous?: PetSnapshot): PetSnapshot
```

`@nosy/core`에서 타입과 `computeHealthScore`를 가져다 쓴다(`apps/pet/package.json`에 이미 의존성으로 있다).

### petStateFor — 매핑 규칙

`docs/UI_GUIDE.md` 표를 그대로 옮긴다. 우선순위가 있다:

1. `drift.hasNewError`가 참이거나, 어떤 어댑터든 `severity === 'error'`인 Finding이 있으면 → `'alarmed'`
2. 아니고, `severity === 'warn'`인 Finding이 있으면 → `'worried'`
3. 그 외 → `'idle'`

- `severity === 'ok'`는 상태를 올리지 않는다.
- `skipped === true`인 어댑터는 `findings`가 비어 있으므로 자연히 아무 영향이 없다. 미설치는 걱정거리가 아니다.
- **`'thinking'`은 이 함수가 반환하지 않는다.** 진단 실행 중이라는 것은 결과로부터 알 수 없고, 실행을 시작한 쪽만 안다.

### buildSnapshot

`computeHealthScore(results)`로 점수를 계산하고 `petStateFor(results, drift)`로 표정을 정해 한 덩어리로 묶는다. `results`는 그대로 싣는다 — skip된 어댑터도 빼지 마라. UI가 "해당 없음"을 표기하려면 그 정보가 필요하다(health-score-spec FR-004).

### thinkingSnapshot

진단이 시작될 때 밀어넣을 스냅샷을 만든다. 이전 스냅샷이 있으면 **표정만 `'thinking'`으로 바꾸고 점수·결과·드리프트는 유지한다** — 진단 도중에 화면의 숫자가 0으로 깜빡이면 안 된다. 이전 스냅샷이 없으면(앱 첫 기동) 100점·빈 결과·드리프트 없음으로 시작한다.

인자로 받은 `previous`를 변경하지 마라.

### tsconfig 등록

`shared/`는 현재 어느 tsconfig의 `include`에도 없다. `apps/pet/tsconfig.node.json`과 `apps/pet/tsconfig.web.json` 양쪽의 `include` 배열에 `"shared"`를 추가하라. main과 renderer가 같은 타입을 봐야 한다.

## Acceptance Criteria

- AC 명령: lint, build, test
- 기준 테스트: `apps/pet/test/ipc-contract.test.ts` — **이 테스트들이 너의 합격 기준이다.**

## 검증 절차

1. AC 명령을 직접 실행해보며 자가수정하라. 단, 합격 판정은 러너가 내린다.
2. 작업을 마치면 `phases/ipc-contract/step0-output.json`에 `{"summary": "산출물 한 줄 요약"}`을 작성하라.

## 금지사항

- 테스트 파일(`apps/pet/test/`)을 수정·삭제·추가하지 마라 (잠금이 걸려 있다). 기준이 잘못됐다면 output에 blocked_reason으로 신고하라.
- `phases/` 아래 index.json을 수정하지 마라 (러너 전유물).
- `shared/ipc.ts`에서 `electron`을 import하지 마라.
- `apps/pet/main/`과 `apps/pet/renderer/` 아래 파일을 수정하지 마라 — 배선은 step 1의 몫이다.
- `packages/core` 아래를 수정하지 마라.
- 기존 테스트(`apps/pet/test/character.test.ts`)를 깨뜨리지 마라.
