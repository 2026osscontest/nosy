# Spec: 온스크린 펫 창 & 캐릭터 상태

## User Scenarios & Testing
- P1: Given macOS에서 앱이 처음 실행됨, When 창이 뜨면, Then 투명·항상 위·프레임 없는 창에 펫 스프라이트가 표시되고 드래그로 이동 가능하다.
- P2: Given 지원하지 않는 플랫폼(Linux/Windows)에서 앱이 실행됨, When 창이 뜨면, Then 크래시 없이 펫이 뜨고 패널에 "v1은 macOS 어댑터만 제공합니다. 현재 플랫폼: {platform}"이 표시된다.
- P3: Given 펫이 화면 위에 상주 중, When 사용자가 펫 영역 밖을 클릭하면, Then 클릭이 관통되어 아래 애플리케이션 작업을 방해하지 않는다.
- P4: Given 펫을 클릭, When 말풍선이 뜨면, Then 헬스 스코어와 가장 심각한 문제 1건이 요약 표시되고, 재클릭 시 상세 패널로 확장된다.

## Requirements
- FR-001: 창은 투명 배경·항상 위·프레임 없음·작업 표시줄 미노출·드래그 이동 가능해야 한다.
- FR-002: 클릭 관통(`setIgnoreMouseEvents`)은 펫 영역 밖에만 적용한다.
- FR-003: 펫 상태는 `idle`/`thinking`/`worried`/`alarmed` 4종으로 표현하며, 렌더링은 `<PetView state={...} />` 단일 컴포넌트로 격리한다(2D→3D 교체 지점).
- FR-004: 클릭 시 말풍선(헬스 스코어 + 가장 심각한 문제 1건 요약)을 표시하고, 재클릭 시 상세(토글) 패널로 확장한다 — [[toggle-panel-spec]] 참조.
- FR-005: 지원하지 않는 플랫폼(macOS 외)에서도 앱은 정상 기동해야 하며, 크래시·무응답 없이 패널에 미지원 플랫폼임을 명시한다("v1은 macOS 어댑터만 제공합니다. 현재 플랫폼: {platform}"). 어댑터 구현과 시연영상은 macOS 전용이며, 코어 엔진은 플랫폼 분기를 열어두되(`host.platform`) Linux/Windows 대응은 v1 범위 밖으로 명시한다 — **1인·8일에 크로스플랫폼 검증은 불가능하며, 되지도 않는 걸 된다고 쓰는 게 기능테스트에서 더 위험하다.**
- FR-006: fixture 기반 테스트(core-types-spec 참조)는 실제 OS 상태에 의존하지 않으므로 모든 OS에서 돈다 — **이것이 비-macOS 심사위원에게 진단 엔진의 정확성을 증명하는 주 경로다.** 창·펫 UI가 macOS 전용이어도 엔진 검증 경로는 플랫폼에 막히지 않는다.
- FR-007: README 최상단에 지원 플랫폼(macOS 전용, v1 기준)을 명시한다. 범위를 숨기지 않는다 — 범위를 명확히 선언한 것과 그냥 안 되는 것은 심사에서 전혀 다르게 읽힌다.
- FR-008: 앱은 macOS 로그인 항목에 자동 등록되어(`app.setLoginItemSettings`), 사용자가 수동 실행하지 않아도 로그인 시 펫이 뜬다(`docs/ADR.md` ADR-009 참조). 최초 실행 시 온보딩에서 자동 시작 여부와 끄는 방법을 안내한다.

## Key Entities
- `PetState`: `'idle' | 'thinking' | 'worried' | 'alarmed'`
- `WindowConfig`: `transparent`, `alwaysOnTop`, `frame: false`

## Success Criteria
- macOS에서 스파이크 산출물로 실제 창이 뜨는 것을 D1에 확인(`docs/TIMELINE.md` D1 완료 판정 기준)
- 비-macOS 환경에서 크래시 없이 미지원 메시지가 표시됨을 수동/CI로 확인(10월 기능테스트 대비)

## Assumptions
- NEEDS CLARIFICATION: 펫 스프라이트의 구체적 크기·기본 위치·다중 모니터 처리 방식은 아직 결정되지 않음.
- 자유 이동(풍부형: 무입력 시간 감지, 다양한 포즈, 관심 끌기 행동)은 v1 커밋 스코프가 아니다 — 여유 시 추가 후보(`docs/TIMELINE.md` "여유 시 추가 후보" 참조). idle 상태의 기본 "천천히 돌아다님"(`docs/UI_GUIDE.md`)만 커밋 스코프이며, 풍부형 확장은 착수 시점에 별도 스펙을 쓴다.
