# 프로젝트: Nosy — 개발 환경 진단 펫

## 기술 스택
- pnpm workspace 모노레포 (`packages/core` + `apps/pet` 2개 배포 타깃 고정, ADR-005)
- TypeScript 전 구간 통일 (Tauri/Rust 기각, ADR-003)
- `apps/pet`: Electron + React — 투명·항상 위·프레임 없는 데스크톱 펫
- `packages/core`: npm 라이브러리 — 어댑터 5종(shell-rc, version-manager, homebrew, git, docker) + 헬스 스코어 산출 + 스냅샷/드리프트 diff

## 아키텍처 규칙
- CRITICAL: 배포 타깃은 `packages/core`·`apps/pet` 2개로 고정한다. 늘리지 않는다 (ADR-005, "재논의 금지 항목")
- CRITICAL: 모든 어댑터는 `DiagnosticHost`를 주입받아 동작한다 — 실제 파일시스템·셸에 직접 접근하는 코드를 어댑터 안에 두지 않는다. 실환경은 `NodeHost`, 테스트는 `FakeHost`로 이원화한다
- CRITICAL: 펫 렌더링은 `<PetView state={...} />` 컴포넌트 하나로 격리한다 — 2D→3D 전환 시 이 파일만 교체하면 되도록 유지한다 (ADR-001)
- `packages/core/src/cli.ts`는 내부 개발/테스트 전용이다. 별도 제품으로 소개하지 않는다 (ADR-005)
- 스냅샷은 `~/.nosy/snapshots/latest.json`에 어댑터별 레코드(`{ adapter, ranAt, findings[] }`)로 분리 저장한다 (ADR-006, ADR-007)
- 드리프트 diff는 "이번 실행에 포함된 어댑터 범위" 안에서만 수행한다. 부분 스캔 결과로 전체 id 집합을 diff하지 않는다 (ADR-007)
- fix 실행은 ① 실행 전 확인 ② 파일 수정 전 `.bak.<타임스탬프>` 백업 ③ sudo 필요 명령은 자동 실행 금지, 복사만 제공 ④ `fix.revert` 없으면 되돌리기 버튼 비활성 ⑤ 파괴적 작업(삭제·전역 설정 초기화)은 fix 대상에서 제외 (ADR-008)

## 개발 프로세스
- 이 프로젝트는 Harness를 사용한다. 검증 명령의 SSOT는 `harness.json`의 `commands`다.
- 테스트는 설계 세션(사람과 함께 작업하는 이 세션)만 작성한다. 구현을 위임받은 세션은 테스트를 수정할 수 없다 — 구현자가 자기 코드에 맞춰 테스트를 느슨하게 쓰는 걸 막기 위함.
- CRITICAL: `phases/` 아래 index.json의 status는 러너가 기록한다. 직접 수정하지 말 것
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:)

## 도메인 참고
- Finding은 파일에서 비롯된 문제면 `evidence`(파일:줄+발췌), 그 외는 `fix.command`를 반드시 동반한다 — "증상 → 원인 파일:줄 → 고치는 명령"이 핵심 차별점
- 헬스 스코어는 100점에서 severity별로 차감하며 어댑터별 최대 -30, 하한 0
- `shellrc-doctor`(Python, MIT) 로직은 런타임 의존성으로 호출하지 않고 TypeScript로 포팅한다 — 포팅 파일 상단과 `THIRD-PARTY-NOTICES.md`에 원저작자·저장소 URL·MIT 전문 고지 필요 (ADR-004)
- 재논의 금지 항목은 `docs/ADR.md` "재논의 금지 항목" 표에 있다 — 다시 꺼내지 않는다
- 정본은 `docs/`다(PRD·ARCHITECTURE·ADR·UI_GUIDE·SUBMISSION·TIMELINE·specs). `spec.md`는 더 이상 없다

## 알려진 함정
전부 2026-08-24 병렬 구현에서 실제로 겪은 것들이다.

- **러너는 변경 파일이 0건이면 AC를 하나도 실행하지 않고 합격 판정을 낸다.** 구현자 세션이 불발되면(실제로 2초 만에 종료된 적 있음) 산출물 없이 `completed`가 된다. 러너가 "✓"를 낸 뒤에는 **산출물 파일이 실제로 생겼는지 눈으로 확인할 것.**
- **`phases/index.json`(전체 현황 파일)이 없으면 verify-gate 훅이 전체 테스트 스위트를 돌린다.** 그러면 아직 구현 안 된 다른 step의 red에 구현자가 항상 막혀 blocked를 신고한다. 새 phase를 추가하면 이 파일의 `phases` 배열에도 넣어야 한다. 배열 순서상 **앞에 있는 미완료 phase에서 누적 tests 계산이 멈춘다.**
- **pnpm 11에서 `pnpm run test -- {paths}`의 `--`는 인자를 vitest에 전달하지 않는다.** 경로 필터가 통째로 무시되고 전체 스위트가 돈다. `harness.json`은 `--` 없는 형태(`pnpm run test {paths}`)로 고쳐뒀다.
- **worktree 병렬 실행 시 `packages/core/src/index.ts`와 `run.ts`를 각 step에서 잠글 것.** 여러 브랜치가 export/등록을 한 줄씩 추가하면 병합에서 충돌한다. wiring은 병합 후 설계 세션이 한 번에 한다.
- **worktree마다 `pnpm install`이 필요하고, `apps/pet` 테스트를 돌리려면 그 worktree에서 `packages/core`를 빌드해야 한다** — workspace link가 `dist/`를 가리키는데 git checkout에는 없다.
- **`electron-vite`가 만드는 `*.tsbuildinfo`는 이름이 여러 가지다**(`tsconfig.node.tsbuildinfo` 등). gitignore 패턴을 `*.tsbuildinfo`로 둘 것.
- **`electron-vite`는 preload를 ESM(`.mjs`)으로 빌드하는데, Electron은 ESM preload에 `sandbox: false`를 요구한다.** 안 끄면 preload 로드가 **에러 한 줄 없이** 실패하고 renderer에서 `window.nosy`만 undefined가 된다. `contextIsolation`은 켜 둔 채로 샌드박스만 끈다.
- **renderer가 `apps/pet/shared/ipc.ts`에서 값을 하나라도 import하면 `@nosy/core` 배럴이 통째로 renderer 번들에 들어가 `node:child_process`에서 터진다.** 그 파일이 `computeHealthScore`를 import하기 때문이다. 타입만 가져올 때는 전부 지워져서 안 보이다가, 값 하나를 가져오는 순간 드러난다. renderer용 순수 헬퍼는 `renderer/` 아래에 두고 core에서는 `import type`만 쓴다.
- **`BrowserWindow.setPosition`에 소수를 넘기면 renderer가 아니라 main 프로세스가 통째로 죽는다.** Retina·트랙패드에서 `PointerEvent.screenX`는 소수로 온다. 그냥 반올림하면 커서보다 창이 2배 빨리 가므로, 정수 부분만 보내고 남은 소수는 다음 이벤트로 이월할 것.
- **`-webkit-user-drag: none`은 상속되지 않는다.** `body`에만 걸면 `<img>`가 여전히 네이티브 드래그앤드롭의 소스가 되어 고스트 이미지와 복사 커서(초록 +)가 뜨고, **포인터 이벤트가 끊겨 직접 만든 드래그 핸들러가 아예 돌지 못한다.** img에 직접 걸고 `onDragStart`에서 `preventDefault()`까지 할 것.
- **macOS는 `show()`된 창의 top을 작업 영역 아래로 강제한다.** `setPosition`/`setBounds`에 y=-100을 넘겨도 실제 y는 `workArea.y`가 된다. 아래쪽은 막지 않아 창이 화면 밖으로 나갈 수 있다 — 위아래가 비대칭이다. **`show()` 전에는 이 제약이 없어서, 창을 띄우지 않고 시험하면 "제약이 없다"는 반대 결론이 나온다.** 펫이 창 하단에 붙어 있으므로 창이 높을수록 펫의 상한이 그만큼 내려간다. 창 높이를 콘텐츠에 맞추지 않으면 그 여유분이 그대로 드래그 상한선이 된다. **드래그 핸들러가 `setPosition`만 부르면 같은 함정에 다시 빠진다** — 콘텐츠 크기가 안 바뀌니 높이를 다시 잡는 경로가 안 돌고, 패널을 편 높은 창이 천장에 걸려 펫이 화면 중간에서 멈춘다. 옮길 때마다 `setBounds`로 높이까지 다시 잡을 것.
- **`transparent: true` 창에도 macOS는 창 사각형 전체에 드롭섀도를 그린다.** 펫 뒤로 네모난 그림자가 비치고, 포커스를 받으면 활성 창용 진한 그림자로 바뀌어 더 도드라진다. `hasShadow: false`로 끌 것.
- **`electron-vite dev`는 main 프로세스를 다시 빌드하지 않는다.** `main/` 아래를 고쳐도 실행 중인 앱에는 반영되지 않으며, 로그에도 재빌드 기록이 남지 않아 조용히 무시된다. 계측 로그를 넣고 한참 재현하다 로그가 한 줄도 없어서야 알아챈 적이 있다. **main을 고치면 앱을 재시작할 것.** renderer(`renderer/`, CSS)는 HMR로 즉시 반영된다.
- **창을 옮기는 것과 renderer가 그것을 아는 것 사이에는 시차가 있다.** main이 `setBounds`를 부르고 IPC로 알려 줄 때까지 renderer는 옛 기준으로 그린다 — 그 사이에 프레임이 끼면 펫이 엉뚱한 자리에 찍혔다가 튄다. 창 크기와 펫의 화면 위치가 함께 바뀌는 연출을 만들 때는 이 왕복을 먼저 계산에 넣을 것.
- **테스트를 추가할 때 같은 describe의 기존 케이스와 모순되지 않는지 확인할 것.** 드리프트 기준선 규칙을 추가했다가 기존 id 스코핑 테스트와 정면으로 충돌해 구현자가 blocked를 냈다. 구현자의 신고가 옳았다.
