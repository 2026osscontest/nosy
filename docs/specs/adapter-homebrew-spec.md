# Spec: 어댑터 3 — homebrew

## User Scenarios & Testing
- P1: Given `brew doctor`가 경고를 출력, When 어댑터가 실행되면, Then 그 출력이 수정 지침 Finding으로 번역된다.
- P2: Given Homebrew가 미설치, When 어댑터가 실행되면, Then 정상 skip 처리되고 감점 없이 "해당 없음"으로 표기된다.

## Requirements
- FR-001: `brew doctor`를 실행하고 출력을 파싱한다.
- FR-002: 파싱 결과를 수정 지침 Finding으로 번역한다 — 파일:줄을 가리킬 수 있는 경우 `evidence`를, 없는 경우 `fix.command`를 채운다([[core-types-spec]] 규칙 준수).
- FR-003: Homebrew 미설치 시 정상 skip 처리하며 감점 없이 분모에서 제외한다([[health-score-spec]] FR-004와 연동).

## Key Entities
- `BrewDoctorOutput`: `brew doctor` 실행 결과(stdout/stderr/code)

## Success Criteria
- `test/fixtures/brew-doctor/outdated-formula.txt` 등에서 정확한 Finding 생성
- 미설치 fixture에서 skip 처리(감점 0, 분모 제외) 검증

## Assumptions
- NEEDS CLARIFICATION: `brew doctor`의 다양한 경고 유형(outdated formula 외) 중 v1에서 실제로 파싱할 패턴의 전체 목록은 아직 결정되지 않음 — 골든셋 수집(`docs/SUBMISSION.md` "골든셋 수집 계획") 과정에서 확정 필요.
