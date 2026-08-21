# Step 0: character-sprite-view

## 읽어야 할 파일

먼저 아래 파일들을 읽고 아키텍처와 설계 의도를 파악하라:

- `docs/ADR.md` ADR-001 ("애셋 조달 (갱신, 8/19)" 문단)
- `docs/specs/pet-window-spec.md` (FR-003, Key Entities)
- `assets/character/README.md` (구조·팔레트·연출·"연동 지점" 전부)
- `apps/pet/renderer/PetView.tsx`, `apps/pet/renderer/main.tsx` (현재 placeholder 상태)
- `apps/pet/electron.vite.config.ts`, `apps/pet/tsconfig.web.json`
- `packages/core/src/types.ts` (`PetState` 정의)
- `apps/pet/test/character.test.ts` — **이미 작성되어 있다. 이 테스트가 네 합격 기준이다.**

## 배경

`assets/character/`에 22×18px 4상태(`idle`/`thinking`/`worried`/`alarmed`) × 4프레임 스프라이트가 이미 절차적으로 생성돼 있다(`assets/character/sprites/{state}_{n}.png`, `assets/character/frames.json`). 이 캐릭터 디자인은 **확정이 아니다** — 나중에 통째로 교체될 수 있다. 따라서 `PetView`/애니메이션 코드는 지금 만든 캐릭터의 구체적 생김새를 몰라야 하고, **같은 디렉터리 구조·파일명 규칙(`sprites/{state}_{n}.png` + `frames.json`의 `width`/`height`/`fps`/`states[state].length`)을 지키는 새 애셋으로 통째로 바꿔치기해도 이 step에서 작성하는 코드는 한 줄도 안 바꿔도 되어야 한다.**

이번 step은 `docs/UI_GUIDE.md`의 캐릭터 상태 4종(`idle`/`thinking`/`worried`/`alarmed`) **정적/애니메이션 렌더링만** 다룬다. `pet-window-spec.md`가 "제안"으로 언급한 `motion`(`walking`/`dragged`) 축, 드래그 이동, 말풍선, 자유 이동은 이 step의 범위가 아니다(추후 별도 step).

## 작업

### 1. `apps/pet/renderer/character.ts` (신규)

`assets/character/frames.json`을 JSON 모듈로 import해(`resolveJsonModule`은 이미 `tsconfig.base.json`에 켜져 있다) 아래를 export하는 프레임워크 무관 순수 함수/상수 모듈을 작성하라. React나 DOM에 의존하지 않아야 한다(테스트가 그렇게 되어 있다).

```ts
export const CHARACTER_WIDTH: number   // frames.json.width
export const CHARACTER_HEIGHT: number  // frames.json.height
export const CHARACTER_FPS: number     // frames.json.fps

/** state에 해당하는 프레임 개수. frames.json에 없는 state면 0. */
export function frameCount(state: PetState): number

/** 경과 시간(ms) -> 현재 프레임 인덱스. fps·frameCount 기준으로 루프. frameCount가 0이면 0. */
export function frameIndexAt(elapsedMs: number, state: PetState, fps?: number): number

/** sprites/{state}_{frame}.png 파일명에서 확장자를 뺀 stem. */
export function spriteKey(state: PetState, frame: number): string
```

`frames.json`을 타입으로 다룰 때 거대한 리터럴 유니언 타입이 추론되지 않도록 최상위에서 한 번 캐스팅해서 써라(예: `states: Record<string, unknown[]>` 정도로만 필요한 필드를 타이핑). 픽셀 데이터 자체(색상 배열)는 이 step에서 쓰지 않는다 — 실제 렌더링은 PNG를 쓴다(`assets/character/README.md`의 "실제로 `<PetView>`에 쓸 애셋"이 `sprites/*.png`임을 명시).

### 2. `apps/pet/renderer/PetView.tsx` 갱신

현재 `<div className="pet-view" data-state={state} />` placeholder를 실제 스프라이트 렌더링으로 교체하되, **컴포넌트 계약(`{ state: PetState }` prop 하나)은 그대로 유지**한다(`docs/specs/pet-window-spec.md` FR-003 — 바깥 코드가 렌더러 구현을 모르는 격리 지점).

- Vite의 `import.meta.glob`으로 `assets/character/sprites/*.png`를 eager import해 `{state}_{frame}` 키 -> URL 맵을 만들어라. 파일 목록을 하드코딩하지 마라 — 이게 "캐릭터 교체 시 코드 안 건드림"의 핵심이다.
  - `PetView.tsx`는 `apps/pet/renderer/`에 있으므로 리포 루트의 `assets/character/sprites`까지는 상대경로 3단계(`../../../assets/character/sprites/*.png`)다.
  - `import.meta.glob` 타입을 쓰려면 `apps/pet/tsconfig.web.json`의 `compilerOptions.types`에 `"vite/client"`를 추가하거나 `apps/pet/renderer/vite-env.d.ts`에 `/// <reference types="vite/client" />`를 추가하라.
  - pnpm 워크스페이스 루트(`pnpm-lock.yaml`이 있는 `/Users/dnnals/Projects/nosy`)는 Vite가 기본으로 monorepo root로 인식해 `server.fs.allow`에 포함하지만, 만약 dev 서버에서 403(파일시스템 접근 거부)이 나면 `electron.vite.config.ts`의 `renderer.server.fs.allow`에 리포 루트를 명시적으로 추가하라.
- `character.ts`의 `frameIndexAt`/`spriteKey`로 매 애니메이션 틱마다 현재 프레임의 스프라이트 URL을 계산하고 `<img>` (또는 `<canvas>`)로 그려라. `setInterval`이든 `requestAnimationFrame`이든 구현 재량이나, 언마운트/`state` 변경 시 타이머를 반드시 정리해라(누수 금지).
- 픽셀이 흐려지지 않게 렌더링에 `image-rendering: pixelated` CSS를 반드시 적용하라(`assets/character/README.md` "연동 지점" 명시 요구사항). 22×18 원본은 화면에서 너무 작으니 정수 배율로 확대해라(배율 값은 재량).
- 존재하지 않는 프레임 키를 조회하게 되는 극단적 상황(예: 매니페스트에 없는 state)에 대비해 조용히 아무것도 안 그리는 정도의 방어만 하면 충분하다 — 과한 에러 처리는 넣지 마라.

### 3. `apps/pet/renderer/main.tsx`

바꿀 필요 없으면 그대로 둬라(이미 `<PetView state="idle" />`를 렌더링 중).

## Acceptance Criteria

- AC 명령: lint, build, test
- 기준 테스트: `apps/pet/test/character.test.ts` — **이 테스트가 너의 합격 기준이다.**

## 검증 절차

1. AC 명령을 직접 실행해보며 자가수정하라. 단, 합격 판정은 러너가 내린다.
2. 작업을 마치면 `phases/mvp-kickoff/step0-output.json`에 `{"summary": "산출물 한 줄 요약"}`을 작성하라.

## 금지사항

- 테스트 파일(`apps/pet/test/character.test.ts`)을 수정·삭제·추가하지 마라(잠겨 있다). 기준이 잘못됐다고 판단되면 output에 `blocked_reason`으로 신고하라.
- `phases/` 아래 index.json을 수정하지 마라(러너 전유물).
- `PetView`의 `{ state: PetState }` prop 시그니처를 바꾸지 마라 — motion/드래그 등 다른 prop을 이 step에서 추가하지 마라(범위 밖).
- `assets/character/`의 스프라이트 파일명 규칙이나 `frames.json` 구조를 이 step에서 바꾸지 마라 — 캐릭터 애셋 자체는 다른 세션(사람)이 나중에 교체한다.
- 새 의존성(npm 패키지)을 추가하지 마라. Vite/React는 이미 있고 이 작업에 더 필요한 게 없다.
- 기존 테스트를 깨뜨리지 마라.
