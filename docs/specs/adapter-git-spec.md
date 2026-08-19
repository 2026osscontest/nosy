# Spec: 어댑터 4 — git

## User Scenarios & Testing
- P1: Given 전역 git `user.name`/`user.email`이 설정되지 않음, When 어댑터가 실행되면, Then 누락 Finding이 `fix.command`와 함께 생성된다.
- P2: Given SSH 키가 없거나 권한이 600이 아님, When 어댑터가 실행되면, Then 해당 Finding이 생성된다.
- P3: Given `~/.gitconfig`에 문법 오류, When 어댑터가 실행되면, Then 문법 오류 Finding이 `evidence`(파일:줄)와 함께 생성된다.

## Requirements
- FR-001: 전역 `user.name`/`user.email` 누락을 감지한다.
- FR-002: SSH 키 부재 또는 권한 오류(600 아님)를 감지한다.
- FR-003: `~/.gitconfig` 문법 오류를 감지한다.

## Key Entities
- `GitConfig`: `~/.gitconfig` 파싱 결과
- `SshKeyStatus`: 존재 여부, 권한 모드

## Success Criteria
- 각 항목에 대해 fixture 기반 테스트로 정확한 Finding 생성 검증
- `user.name`/`email` 누락처럼 파일:줄을 가리킬 수 없는 경우 `fix.command`가 채워짐([[core-types-spec]] 규칙)

## Assumptions
- NEEDS CLARIFICATION: SSH 키 경로 탐지 범위(`~/.ssh/id_rsa`, `id_ed25519` 등 어떤 키 타입까지 검사하는지)는 아직 결정되지 않음.
