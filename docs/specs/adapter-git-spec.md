# Spec: 어댑터 4 — git

## User Scenarios & Testing
- P1: Given 전역 git `user.name`/`user.email`이 설정되지 않음, When 어댑터가 실행되면, Then 누락 Finding이 `fix.command`와 함께 생성된다.
- P2: Given SSH 키가 없거나 권한이 600이 아님, When 어댑터가 실행되면, Then 해당 Finding이 생성된다.
- P3: Given `~/.gitconfig`에 문법 오류, When 어댑터가 실행되면, Then 문법 오류 Finding이 `evidence`(파일:줄)와 함께 생성된다.

## Requirements
- FR-001: 전역 `user.name`/`user.email` 누락을 감지한다.
- FR-002: SSH 키 부재 또는 권한 오류(600 아님)를 감지한다. 검사 대상 키는 `~/.ssh/id_ed25519`, `~/.ssh/id_rsa`, `~/.ssh/id_ecdsa` 셋으로 고정한다 — 셋 중 하나도 없으면 부재로 판정하고, 존재하는 키 각각에 대해 권한을 확인한다.
- FR-003: `~/.gitconfig` 문법 오류를 감지한다.

## Key Entities
- `GitConfig`: `~/.gitconfig` 파싱 결과
- `SshKeyStatus`: 존재 여부, 권한 모드

## Success Criteria
- 각 항목에 대해 fixture 기반 테스트로 정확한 Finding 생성 검증
- `user.name`/`email` 누락처럼 파일:줄을 가리킬 수 없는 경우 `fix.command`가 채워짐([[core-types-spec]] 규칙)

## Assumptions
- 검사할 SSH 키 타입은 `id_ed25519`·`id_rsa`·`id_ecdsa` 셋으로 확정(2026-08-24). `id_dsa`는 OpenSSH 7.0부터 기본 비활성이라 제외하고, `id_xmss` 등 실험적 타입도 실사용이 없어 제외한다.
- 어댑터 `kind`는 `self`다 — `~/.gitconfig`와 `~/.ssh` 조회가 주 경로라 가볍고, 30분 주기 체크 대상에 포함된다([[drift-detection-spec]] FR-006).
