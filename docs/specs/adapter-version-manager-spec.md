# Spec: 어댑터 2 — version-manager

## User Scenarios & Testing
- P1: Given `.nvmrc`가 특정 Node 버전을 요구하지만 현재 셸의 활성 버전이 다름, When 어댑터가 실행되면, Then 버전 불일치 Finding이 생성된다.
- P2: Given nvm/pyenv shim이 PATH에서 시스템 바이너리보다 뒤에 위치, When 어댑터가 실행되면, Then 우선순위 충돌 Finding이 생성된다.
- P3: Given rc 파일에 버전 매니저 초기화 줄이 없거나 잘못된 위치, When 어댑터가 실행되면, Then 초기화 누락/오배치 Finding이 생성된다.

## Requirements
- FR-001: nvm/pyenv shim이 PATH에서 시스템 바이너리에 밀리는 우선순위 충돌을 감지한다.
- FR-002: `.nvmrc`/`.python-version`이 요구하는 버전과 실제로 활성화된 버전의 불일치를 감지한다 — 파일만 읽어서는 알 수 없고 실제 버전을 조회해야 하며, 이것이 이 어댑터의 고유 가치다.
- FR-003: 버전 매니저 초기화 줄이 rc 파일에 없거나 잘못된 위치에 있는 경우를 감지한다.
- FR-004: rc 파일 *안에서* 발견되는 버전 매니저 설정 충돌(nvm+asdf 등)은 이 어댑터의 책임이 아니다 — 어댑터 1([[adapter-shell-rc-spec]])이 이미 담당하므로 중복 구현하지 않는다.

## Key Entities
- `VersionRequirement`: 파일(`.nvmrc`/`.python-version`) 경로, 요구 버전
- `ActiveVersion`: 실제 활성 버전 (`DiagnosticHost.exec`로 조회)

## Success Criteria
- `.nvmrc`/`.python-version`과 실제 활성 버전이 다른 fixture에서 Finding이 정확히 생성됨
- 어댑터 1과 기능 중복이 없음 (코드 리뷰로 확인)

## Assumptions
- 실제 활성 버전 조회는 `DiagnosticHost.exec`를 통해 이뤄진다고 가정한다(예: `node -v`, `python --version`) — 구체적 조회 명령은 아직 결정되지 않음.
- NEEDS CLARIFICATION: `asdf` 자체(`.tool-versions`)를 별도로 다루는지 아직 결정되지 않음 — nvm/pyenv만 명시됨.
