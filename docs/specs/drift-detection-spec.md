# Spec: 드리프트 감지

## User Scenarios & Testing
- P1: Given 마지막 정상 스냅샷에 없던 error가 이번 실행에서 발견됨, When 드리프트 검사가 수행되면, Then 드리프트로 판정되고 펫이 `alarmed` 상태로 전환되며 말풍선이 자동 표시된다.
- P2: Given 30분 주기 체크가 자체형 어댑터(shell-rc, version-manager)만 실행, When 드리프트 diff가 수행되면, Then 이번 실행에 포함되지 않은 래핑형 어댑터의 기존 레코드는 그대로 유지되고 "사라짐"으로 오판되지 않는다.
- P3: Given 절전 해제(resume) 이벤트, When 트리거되면, Then 전체 어댑터가 재실행되고 드리프트가 재평가된다.

## Requirements
- FR-001: 스냅샷은 `~/.nosy/snapshots/latest.json`에 저장한다(Electron `userData` 대신 홈 디렉터리 고정 — 사용자가 직접 열람 가능해야 함).
- FR-002: 스냅샷은 어댑터별 레코드(`{ adapter, ranAt, findings[] }`)로 분리 저장한다.
- FR-003: 비교는 이번 실행에 실제로 포함된 어댑터 범위 안에서만 Finding `id` 집합을 diff한다. 이번 실행에 포함되지 않은 어댑터의 레코드는 손대지 않고 그대로 유지한다.
- FR-004: 이전에 없던 `error`가 새로 생기면 드리프트로 판정하고, 펫을 `alarmed` 상태로 전환하며 말풍선을 자동 표시한다.
- FR-005: 트리거는 ① 앱 실행 시 1회 ② 30분마다 ③ 절전 해제 시(`powerMonitor.on('resume')`)로 확정한다.
- FR-006: 30분 주기 체크는 자체형 어댑터(shell-rc, version-manager)만 실행한다. 무거운 래핑형 어댑터(`brew doctor` 등)는 절전 해제 시와 수동 실행 시에만 실행한다.

## Key Entities
- `Snapshot`: `{ [adapter: string]: { ranAt: string, findings: Finding[] } }`
- `DriftResult`: 신규 `error` 여부, 신규 Finding 목록

## Success Criteria
- 30분 주기 체크가 자체형 어댑터만 돌 때, 래핑형 어댑터 레코드가 "사라짐 → 재발생"으로 오판되지 않음을 단위 테스트로 검증(이 문서가 명시적으로 경고하는 회귀 케이스)
- 신규 `error` 발생 시 펫 상태가 `alarmed`로 전환됨을 통합 테스트로 검증

## Assumptions
- 없음 — 어댑터별 분리 저장 + 실행 범위 한정 diff는 "선택이 아니다" — 둘 다 하드 제약으로 명시적으로 확정됐다.
