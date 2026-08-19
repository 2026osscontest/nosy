# Spec: 어댑터 5 — docker

## User Scenarios & Testing
- P1: Given Docker CLI는 설치돼 있지만 데몬이 실행 중이 아님, When 어댑터가 실행되면, Then 데몬 미실행 Finding이 `fix.command`와 함께 생성된다.
- P2: Given Docker 엔진 자체가 미설치, When 어댑터가 실행되면, Then 정상 skip 처리된다.
- P3: Given `docker context`가 오설정, When 어댑터가 실행되면, Then 오설정 Finding이 생성된다.

## Requirements
- FR-001: CLI는 있는데 데몬 미실행 상태를 감지한다.
- FR-002: 엔진 자체 미설치 시 정상 skip 처리(감점 없음, 분모 제외).
- FR-003: `docker context` 오설정을 감지한다.

## Key Entities
- `DockerStatus`: CLI 존재 여부, 데몬 상태, 활성 context

## Success Criteria
- `test/fixtures/docker/daemon-not-running.stderr.txt` 등에서 정확한 Finding 생성
- 미설치 fixture에서 skip 처리 검증

## Assumptions
- 이 어댑터는 `docs/TIMELINE.md` "포기 우선순위"의 2번 항목이다 — 일정이 밀리면 가장 먼저 제외될 수 있다는 점을 구현 우선순위 판단에 반영한다.
