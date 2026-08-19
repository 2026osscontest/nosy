# Spec: 어댑터 1 — shell-rc

## User Scenarios & Testing
- P1: Given `.zshrc`에 동일 PATH 엔트리가 두 번 등장, When shell-rc 어댑터가 실행되면, Then 중복 PATH Finding이 파일:줄 번호와 원문 발췌를 포함해 생성된다.
- P2: Given `.bashrc`의 alias가 존재하지 않는 대상을 가리킴, When 어댑터가 실행되면, Then 죽은 alias Finding이 생성된다.
- P3: Given `.zprofile`이 존재하지 않는 파일을 `source`, When 어댑터가 실행되면, Then 해당 줄이 Finding으로 지목된다.

## Requirements
- FR-001: `.zshrc`/`.bashrc`/`.zprofile`을 진단 대상으로 한다.
- FR-002: 중복 PATH 엔트리를 감지한다.
- FR-003: 존재하지 않는 경로를 가리키는 PATH 엔트리를 감지한다.
- FR-004: 대상이 없는(가리키는 명령/파일이 없는) 죽은 alias를 감지한다.
- FR-005: 존재하지 않는 파일을 `source`하는 줄을 감지한다.
- FR-006: 중복 alias를 감지한다.
- FR-007: 모든 Finding은 파일:줄 번호와 원문 발췌(`evidence`)를 포함한다 — [[core-types-spec]] FR-006과 일치.
- FR-008: 로직은 `github.com/nord342/shellrc-doctor`(MIT, Python 단일 파일)의 진단 로직을 TypeScript로 포팅한다 — 의존성으로 호출하지 않는다.
- FR-009: rc 파일 *안에서* 발견되는 버전 매니저 설정 충돌(nvm+asdf, pyenv+asdf 등) 감지를 포함한다. 이 부분은 어댑터 2(version-manager)와 책임이 겹치지 않도록 명확히 구분한다 — [[adapter-version-manager-spec]] 참조.
- FR-010: 포팅한 소스 파일 상단에 유래(원저장소 URL, 라이선스)를 주석으로 명시한다.

## Key Entities
- `ShellRcFile`: 경로, 줄 배열
- `PathEntry` / `Alias` / `SourceLine`: rc 파일 파싱 결과 단위

## Success Criteria
- `test/fixtures/zshrc/duplicate-path.zshrc`, `dead-alias.zshrc`, `missing-source.zshrc` 각각에서 정확한 파일:줄이 산출됨
- `THIRD-PARTY-NOTICES.md`에 원저작자·저장소 URL·MIT 전문 기재
- README/보고서에 "이 어댑터는 shellrc-doctor(MIT)의 진단 로직에서 유래" 명시

## Assumptions
- NEEDS CLARIFICATION: 지원 셸 문법의 정확한 범위(다중 라인 `export`, 조건부 `source`, `eval` 안의 PATH 조작)는 `docs/SUBMISSION.md` "커뮤니티 접점"의 이슈 후보로만 언급되고 확정 요구사항으로 명시되지 않음 — 포팅 중에는 원본(`shellrc-doctor`)의 동작을 그대로 따르는 것을 기본 가정으로 둔다.
