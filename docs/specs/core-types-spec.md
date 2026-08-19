# Spec: 코어 타입 계약 & 호스트 주입

## User Scenarios & Testing
- P1: Given 실제 macOS 환경, When `NodeHost`가 어댑터에 주입되면, Then 어댑터는 실제 `child_process`/`fs`를 통해 진단을 수행한다.
- P2: Given `test/fixtures/`의 텍스트, When `FakeHost`가 어댑터에 주입되면, Then 실제 파일시스템 접근 없이 동일한 Finding 로직을 검증할 수 있다.
- P3: Given 임의의 어댑터가 생성한 `Finding` 전체, When 어댑터 단위 테스트가 실행되면, Then 모든 Finding이 `evidence` 또는 `fix.command` 중 최소 하나를 가짐이 검증된다.

## Requirements
- FR-001: `DiagnosticHost` 인터페이스는 `exec(cmd, args)`, `readFile(path)`, `env`, `homedir`를 제공한다.
- FR-002: 모든 어댑터는 `DiagnosticHost`를 주입받아야 하며, 어댑터 코드 내부에서 `child_process`/`fs`에 직접 접근해서는 안 된다.
- FR-003: 실환경 구현은 `NodeHost`, 테스트 구현은 `FakeHost`(`test/fixtures/`의 텍스트를 반환)로 제공한다.
- FR-004: `Finding` 타입은 `id, adapter, severity('ok'|'warn'|'error'), title, cause, evidence?(file,line,excerpt), fix(description, command?, manual?, needsSudo?, revert?), reference?`를 포함한다.
- FR-005: `id`는 안정적 식별자여야 하며 드리프트 diff의 키로 쓰인다.
- FR-006: 파일 기반 어댑터(shell-rc, version-manager)의 모든 Finding은 `evidence`가 필수다.
- FR-007: 가리킬 파일·줄이 존재하지 않는 문제(예: Docker 데몬 미실행)는 `evidence` 대신 `fix.command`를 반드시 채운다.
- FR-008: 모든 Finding은 `evidence` 또는 `fix.command` 중 최소 하나를 가져야 하며, 이 규칙은 어댑터 단위 테스트로 강제한다.
- FR-009: 각 fixture는 골든셋의 실제 사례 1건에서 유래하며, 테스트 파일에 출처 URL을 주석으로 남긴다.

## Key Entities
- `DiagnosticHost`: `exec`/`readFile`/`env`/`homedir` — 실환경(`NodeHost`)과 테스트(`FakeHost`)로 이원화되는 주입 인터페이스
- `Finding`: 진단 결과 1건. `id`/`adapter`/`severity`/`title`/`cause`/`evidence?`/`fix`/`reference?` — `reference`는 골든셋 출처 URL을 담아, 지어낸 문제가 아니라 근거 있는 진단임을 증명하는 용도다.
- `fix`: `description`, `command?`, `manual?`, `needsSudo?`, `revert?`

## Success Criteria
- 어댑터 코드에 `child_process`/`fs` 직접 호출이 0건 (grep으로 검증 가능)
- 모든 어댑터의 모든 Finding이 `evidence` 또는 `fix.command` 규칙을 만족 (단위 테스트)
- `pnpm test`가 실제 OS 상태에 의존하지 않고 CI에서 통과

## Assumptions
- `exec`의 반환 타입은 `{ stdout, stderr, code }`로 고정되며, 어댑터는 이 셋만으로 파싱한다.
- NEEDS CLARIFICATION: `readFile`이 파일 부재 시 `null`을 반환하는 것은 타입에 명시되어 있으나, 권한 오류 등 다른 실패 모드의 처리(예외 throw 여부)는 아직 결정되지 않음.
