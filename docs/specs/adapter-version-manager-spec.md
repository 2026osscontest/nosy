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

## Requirements (설계 단계 확정 세부사항)
- FR-001 상세: 판정 기준은 rc 파일 텍스트가 아니라 실제 활성 `PATH`(`DiagnosticHost.env.PATH`)다. pyenv는 `${PYENV_ROOT:-~/.pyenv}/shims`, nvm은 `env.NVM_BIN`(nvm.sh가 세팅하는 현재 활성 버전 bin 디렉터리)이 시스템 바이너리 디렉터리(`/usr/bin`, `/bin`, `/usr/local/bin`)보다 PATH에서 뒤에 있으면 충돌로 본다. `NVM_BIN`이 세팅되지 않은 경우(현재 프로세스 환경에 nvm이 로드되지 않음)는 판정 불가로 보고 스킵한다 — nvm은 셸 함수라 바이너리 조회(`which nvm`)로 설치 여부를 알 수 없기 때문이다.
- FR-003 상세: "초기화 오배치"는 nvm/pyenv 초기화 줄이 rc 파일의 마지막 non-comment 줄이 아닌 경우로 정의한다(pyenv 공식 문서가 명시하는 요구사항이자 nvm 설치 스크립트의 관행과 일치). "초기화 누락"은 매니저가 실제 설치되어 있는데(`test -e {NVM_DIR}`, `which pyenv`) `.zshrc`/`.bashrc`/`.zprofile` 어디에도 초기화 줄이 없는 경우다.

## Assumptions
- 실제 활성 버전 조회는 `DiagnosticHost.exec`를 통해 이뤄진다: Node는 `node -v`, Python은 `python3 --version`(실패 시 `python --version`)으로 조회한다.
- 버전 일치 판정은 접두사 비교다 — 요구 버전이 활성 버전의 앞부분과 일치하면 만족으로 본다(예: 요구 `"18"`은 활성 `"18.17.0"`을 만족한다). `.nvmrc`가 별칭(`lts/*` 등 숫자로 시작하지 않는 값)을 담고 있으면 nvm 셸 함수 없이는 해석할 수 없으므로 검사를 스킵한다.
- **결정(asdf 범위)**: `asdf`(`.tool-versions`)는 v1 범위에서 제외한다. 근거: (1) FR-001~003 요구사항 자체가 nvm/pyenv만 명시적으로 대상으로 한다. (2) 스코프 최소화 원칙(`AGENTS.md`). (3) rc 파일 *안에서*의 매니저 충돌은 asdf를 포함해 이미 어댑터 1이 담당하므로(FR-009), 여기서 asdf 단독 처리를 추가하면 두 어댑터의 책임 경계가 다시 모호해진다. 필요성이 확인되면 후속 스펙으로 별도 다룬다.
