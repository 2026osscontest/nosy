# Spec: 어댑터 3 — homebrew

## User Scenarios & Testing
- P1: Given `brew doctor`가 경고를 출력, When 어댑터가 실행되면, Then 그 출력이 수정 지침 Finding으로 번역된다.
- P2: Given Homebrew가 미설치, When 어댑터가 실행되면, Then 정상 skip 처리되고 감점 없이 "해당 없음"으로 표기된다.
- P3: Given Homebrew는 있으나 `brew doctor --json`을 지원하지 않는 버전, When 어댑터가 실행되면, Then 미설치와 **구분되는 사유**로 skip 처리된다.

## Requirements
- FR-001: `brew doctor --json`을 실행하고 JSON을 파싱한다. 평문 출력은 파싱하지 않는다.
- FR-002: 파싱 결과를 Finding으로 번역한다. `brew doctor`의 경고는 파일:줄을 가리킬 수 없으므로 `evidence` 없이 `fix.command`를 채운다([[core-types-spec]] FR-007).
- FR-003: Homebrew 미설치 시 정상 skip 처리하며 감점 없이 분모에서 제외한다([[health-score-spec]] FR-004와 연동).
- FR-004: `--json` 미지원 버전에서도 skip 처리하되, 미설치와 다른 `skipReason` 문자열을 반환한다 — 사용자에게 "안 깔림"과 "깔렸는데 못 봄"은 다른 상황이다.
- FR-005: `remediation.commands`가 비어 있는 finding은 **Finding으로 만들지 않고 버린다.** 고치는 명령을 줄 수 없으면 [[core-types-spec]] FR-008(evidence 또는 fix.command 필수)을 만족할 수 없고, 그런 항목은 Nosy가 제공할 가치가 없다.
- FR-006: 파괴적 명령(`brew cleanup` 등 삭제류)은 `fix.command`로 채우지 않고 `fix.manual`로만 제공한다(`docs/ADR.md` ADR-008, [[toggle-panel-spec]] FR-007).
- FR-007: `sudo`로 시작하는 remediation 명령은 `fix.needsSudo = true`로 표시한다([[toggle-panel-spec]] FR-005).
- FR-008: 모든 Finding의 severity는 `warn`으로 고정한다. `brew doctor`는 자체 출력에서 이 경고들이 치명적이지 않음을 명시한다("just ignore this") — 이를 `error`로 올리면 헬스 스코어가 과장된다.

## Requirements (설계 단계 확정 세부사항)

### `brew doctor --json` 출력 스키마
2026-08-24 로컬 Homebrew 6.0.17에서 실행해 확인한 실제 스키마다.

```json
{
  "tier": 1,
  "findings": [
    {
      "text": "You have unlinked kegs in your Cellar.\n...",
      "tier": 1,
      "affects": ["foo", "bar"],
      "links": ["https://..."],
      "remediation": { "text": "Run `brew link` on these:\n...", "commands": ["brew link foo"] }
    }
  ]
}
```

`remediation`은 nullable이다. `findings`가 비면 `[]`.

### 매핑 규칙
| brew | Nosy `Finding` |
|---|---|
| `text` 첫 줄 | `title` |
| `text` 전문 | `cause` |
| `remediation.commands[0]` | `fix.command` |
| `remediation.text` | `fix.description` |
| `links[0]` | `reference` |
| `affects[]` | `cause`에 덧붙임 |

### 함정
- **`tier`는 severity가 아니다.** Homebrew의 지원 등급(Tier 1/2/3, unsupported)이며 문제의 심각도와 무관하다. severity 매핑에 쓰지 말 것(FR-008이 `warn` 고정).
- `--json`은 **hidden 플래그**이고 2026-05-29에 추가됐다(Homebrew 커밋 `9bb718d934`). `brew doctor --help`에 나오지 않는다. 지원 여부는 실행 결과로 판정한다 — 파싱에 실패하거나 종료 코드가 비정상이면 미지원으로 간주하고 skip한다.
- `brew doctor`는 문제가 있으면 **0이 아닌 코드로 종료한다.** 종료 코드만으로 실패를 판정하면 정상 동작을 오류로 오인한다. JSON 파싱 성공 여부로 판정할 것.

## Key Entities
- `BrewDoctorFinding`: `--json` 출력의 findings 배열 원소 (`text`/`tier`/`affects`/`links`/`remediation`)

## Success Criteria
- `test/fixtures/brew-doctor/*.json` fixture에서 정확한 Finding 생성
- 미설치 fixture와 `--json` 미지원 fixture에서 서로 다른 `skipReason`으로 skip 처리됨을 검증
- `remediation`이 없는 finding이 결과에서 제외됨을 검증

## Assumptions
- 어댑터 `kind`는 `wrapping`이다 — 외부 CLI 호출이라 무겁고, 30분 주기 체크 대상이 아니다([[drift-detection-spec]] FR-006).
- Homebrew를 런타임에 CLI로 호출할 뿐 코드를 포팅하지 않으므로, `docs/ADR.md` ADR-004(shellrc-doctor 포팅 고지)의 대상이 아니다.
