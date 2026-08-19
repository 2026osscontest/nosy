# 아키텍처

## 워크스페이스
pnpm workspace 단일 저장소(모노레포). `harness.json`의 `commands`는 아래 두 워크스페이스와 일치시킨다. 배포 타깃을 2개로 고정하는 것은 완주 리스크(G5) 관리를 위한 확정 사항이며 재논의하지 않는다(`docs/ADR.md` ADR-005, "재논의 금지 항목" 참조).

- `packages/core` — [배포 타깃 1] 진단 엔진. npm 라이브러리. 어댑터 5종, 헬스 스코어 산출, 스냅샷/드리프트 diff, (내부 전용) CLI를 포함한다.
- `apps/pet` — [배포 타깃 2] Electron 데스크톱 펫. 투명·항상 위·프레임 없는 창, 렌더러(PetView), 말풍선, 토글 패널을 포함한다.

## 디렉토리 구조
```
devenv-pet/                       # pnpm workspace, 단일 저장소
├─ packages/core/                 # [배포 타깃 1] 진단 엔진 — npm 라이브러리
│  ├─ src/host.ts                 #   주입 인터페이스 (테스트 전략의 핵심)
│  ├─ src/types.ts                #   Finding / Snapshot / HealthScore
│  ├─ src/adapters/                #   어댑터 5종
│  ├─ src/score.ts                #   헬스 스코어 산출
│  ├─ src/snapshot.ts             #   스냅샷 저장 · 드리프트 diff
│  ├─ src/cli.ts                  #   ⚠ 내부 개발/테스트 전용. 별도 제품으로 홍보 금지
│  └─ test/fixtures/               #   가짜 .zshrc, 가짜 doctor 출력 텍스트
└─ apps/pet/                      # [배포 타깃 2] Electron 데스크톱 펫
   ├─ main/window.ts              #   투명 · 항상 위 · 프레임 없는 창
   ├─ main/scheduler.ts           #   실행 시 1회 + 30분 + 절전해제
   ├─ renderer/PetView.tsx        #   ⭐ 렌더러 교체 지점 (2D→3D는 이 파일만)
   ├─ renderer/Bubble.tsx         #   말풍선
   └─ renderer/FixPanel.tsx       #   토글 패널
```

## 패턴
- **호스트 주입(Dependency Injection):** 모든 어댑터는 `DiagnosticHost`를 주입받아 동작하고, 실제 파일시스템·셸에 직접 접근하는 코드는 어댑터 안에 한 줄도 없다. 실환경은 `NodeHost`(child_process/fs), 테스트는 `FakeHost`(fixture 텍스트 반환)로 이원화한다.
- **렌더러 격리:** 펫 렌더링은 `<PetView state={...} />` 컴포넌트 하나로 격리한다. 계약은 "펫 상태(idle/thinking/worried/alarmed)를 받아 그린다"뿐이며, 바깥 코드는 구현이 스프라이트인지 3D인지 알지 못한다.

## 데이터 흐름
```
어댑터 실행 (DiagnosticHost 주입)
  → Finding[] 생성 (evidence 또는 fix.command 필수)
  → score.ts가 헬스 스코어 산출 (100점에서 severity별 차감, 어댑터별 최대 -30, 하한 0)
  → snapshot.ts가 어댑터별로 분리 저장 (~/.devenv-pet/snapshots/latest.json)
    → 이전 스냅샷과 "이번 실행 범위 내" id 집합만 diff → 새 error 발생 시 드리프트
  → IPC로 apps/pet(main)에 전달
  → renderer가 상태(idle/thinking/worried/alarmed) 결정 → PetView/Bubble/FixPanel 렌더링
  → 사용자가 토글 on → 실행 전 확인 → fix.command 실행 → 재진단 → 결과 반영
```

## 상태 관리
- 진단 결과·헬스 스코어·드리프트 상태는 main 프로세스(스케줄러)가 소유하고 IPC로 renderer에 전달한다.
- 스케줄러 트리거: 앱 실행 시 1회, 30분마다(자체형 어댑터만: shell-rc, version-manager), 절전 해제 시(`powerMonitor.on('resume')`, 전체 어댑터).
- 스냅샷은 어댑터별 레코드(`{ adapter, ranAt, findings[] }`)로 분리 저장하고, 실행되지 않은 어댑터의 레코드는 그대로 유지한다 — 부분 스캔 결과가 전체 diff를 오염시켜 오탐하지 않도록 하는 것이 핵심 규칙이다(`docs/specs/drift-detection-spec.md` 참조).
