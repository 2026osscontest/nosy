# Step 1: adapter-shell-rc

## 읽어야 할 파일

먼저 아래 파일들을 읽고 아키텍처와 설계 의도를 파악하라:

- `docs/PRD.md` "차별점 — 선언적 적용 도구가 아니라 진단 도구다" (증상 → 원인 파일:줄 → 고치는 명령이 핵심 차별점)
- `docs/ADR.md` ADR-004 (shellrc-doctor 포팅 배경·범위·고지 의무)
- `docs/specs/adapter-shell-rc-spec.md`, `docs/specs/core-types-spec.md`
- `packages/core/src/types.ts` (`Finding`/`Fix`/`Severity`), `packages/core/src/host.ts` (`DiagnosticHost`/`FakeHost`/`NodeHost`)
- `packages/core/test/host.test.ts` (`FakeHost` 사용 예시 — 특히 **미등록 `exec` 호출은 기본적으로 `{code: 0}`을 반환**하고, 미등록 `readFile`은 `null`을 반환한다는 점)
- `packages/core/test/shell-rc.test.ts`, `packages/core/test/fixtures/zshrc/*.zshrc` — **이미 작성되어 있다. 이 테스트가 너의 합격 기준이며, 아래 "감지 규칙"은 이 테스트와 정확히 맞물리도록 설계됐다. 규칙을 임의로 바꾸면 테스트가 잘못된 이유로 실패한다.**

원본 참고(선택, 권장): `https://github.com/nord342/shellrc-doctor`를 WebFetch로 열어 실제 감지 로직을 참고하면 "포팅"의 취지에 더 부합한다(ADR-004). 다만 아래 "감지 규칙"이 이 프로젝트의 합격 기준이므로, 원본과 세부 구현이 다르더라도 아래 규칙을 따르는 것이 우선이다.

## 배경

이 어댑터가 `docs/PRD.md`의 핵심 차별점("증상 → 원인 파일:줄 → 고치는 명령")을 지는 1번 어댑터다. `test/shell-rc.test.ts`의 fixture들은 골든셋 채굴(`docs/TIMELINE.md` D3) 이전에 작성된 **대표 합성(synthetic) 패턴**이다 — 실제 골든셋 URL로 교체하는 것은 이 step의 범위가 아니다.

## 작업

`packages/core/src/adapters/shell-rc.ts`를 작성하라.

```ts
export async function runShellRcAdapter(host: DiagnosticHost): Promise<Finding[]>
```

파일 최상단에 원저작자·저장소 URL·"이 로직은 shellrc-doctor(MIT)에서 유래했다"는 주석을 남겨라(ADR-004 FR-010). `packages/core`의 `child_process`/`fs`를 직접 쓰지 말고 전부 `host`를 통해서만 접근하라(`core-types-spec` FR-002).

### 대상 파일

`host.homedir`의 `.zshrc`, `.bashrc`, `.zprofile` 3개(FR-001). `host.readFile`이 `null`을 반환하면(파일 없음) 그 파일은 조용히 건너뛴다 — 에러를 던지지 않는다.

### 감지 규칙 (테스트와 1:1로 맞물려 있으니 그대로 구현하라)

각 항목은 파일의 줄들을 순회하며 아래 조건에 매칭되는 줄에서 Finding을 만든다. 줄 번호는 1부터 시작. **trim 후 `#`으로 시작하는 주석 줄은 모든 규칙에서 제외한다** — 아래 규칙은 전부 "주석이 아닌 줄 중에서"를 전제로 한다.

1. **중복 PATH 엔트리** (`warn`) — trim한 줄이 `export ` 로 시작하고 `PATH=`를 포함하는 줄(예: `export PATH="..."`)에서 `=` 뒤 값을 `:`로 분리한다. 리터럴 세그먼트(순수 `$PATH`/`${PATH}` 자기참조 토큰은 세그먼트로 취급하지 않는다)가 **같은 파일 안에서 이미 나온 적이 있으면** 그 재등장 지점에서 Finding 1건을 만든다. `evidence`는 그 줄(파일·줄 번호·원문 발췌).
2. **존재하지 않는 PATH 엔트리** (`warn`) — 위에서 얻은 각 PATH 리터럴 세그먼트에 대해 `host.exec('test', ['-e', segment])`를 호출한다. `code !== 0`이면 Finding을 만든다. (이미 "중복"으로 표시한 재등장 세그먼트를 또 dead로 이중 신고할지는 재량 — 테스트 fixture는 이 둘이 겹치는 경우를 만들지 않는다.)
3. **죽은 alias** (`warn`) — trim한 줄이 `alias `로 시작하는 `alias name=value` 형태의 줄에서 `value`의 첫 토큰(따옴표 제거)을 대상으로 본다. 대상이 `/`, `~`, `./`, `../`로 시작하면 경로로 취급해 `host.exec('test', ['-e', target])`, 아니면 명령어로 취급해 `host.exec('which', [target])`를 호출한다. `code !== 0`이면 Finding.
4. **존재하지 않는 파일을 source** (`error`) — trim한 줄이 정확히 `source `로 시작하거나 `. `(마침표+공백)으로 시작하면, 그 뒤 나머지(따옴표 제거)를 경로로 보고 `host.readFile(path)`를 호출한다. `null`이면 Finding.
5. **중복 alias** (`warn`) — 같은 파일 안에서 같은 alias 이름이 두 번째 이상 정의되면, 그 재정의 줄에서 Finding.
6. **버전 매니저 충돌 — nvm+asdf, pyenv+asdf** (`warn`, FR-009) — 파일 전체 텍스트에 `nvm.sh`(nvm init 신호)와 `asdf.sh`(asdf init 신호)가 **둘 다** 포함돼 있거나, `pyenv init`과 `asdf.sh`가 둘 다 포함돼 있으면 Finding 1건을 만든다. `evidence`는 `asdf.sh`가 등장하는 줄. `cause`에는 반대쪽 도구 이름(예: "nvm")을 반드시 언급해라(테스트가 `cause`에 소문자로 `nvm`이 포함되는지 확인한다). rc 파일 밖에서의 버전 충돌(실제 활성 버전 비교 등)은 어댑터 2(version-manager)의 몫이니 여기서 다루지 않는다(`docs/specs/adapter-version-manager-spec.md` FR-004).

### Finding 공통 규칙

- `adapter: 'shell-rc'` 고정.
- `id`는 안정적이고 같은 실행 안에서 서로 겹치지 않아야 한다(드리프트 diff의 키 — `core-types-spec` FR-005). 정확한 포맷은 재량.
- `evidence`는 항상 채운다(FR-006, 파일 기반 어댑터는 필수) — `file`(절대경로), `line`, `excerpt`(원문 줄, trim 여부는 재량이나 핵심 토큰은 포함해야 함).
- `fix`는 **`description`만 채우고 `command`는 비워둔다**(v1은 rc 파일을 자동으로 고쳐 쓰지 않는다 — 수동 검토가 안전하다). 필요하면 `fix.manual`에 안내 문구를 추가해도 된다. `evidence`가 이미 있으므로 `fix.command` 없이도 `core-types-spec` FR-008을 만족한다.
- `title`/`cause`는 자유롭게 작성하되 실제로 문제를 설명해야 한다(테스트가 일부 문자열 포함 여부를 확인한다).

### THIRD-PARTY-NOTICES.md (ADR-004, `docs/SUBMISSION.md` 라이선스 체크리스트)

리포 루트에 `THIRD-PARTY-NOTICES.md`가 아직 없다. 새로 만들어 `shellrc-doctor`(저장소 `https://github.com/nord342/shellrc-doctor`, MIT 라이선스) 원저작자 고지와 MIT 전문을 기재하라. 이 문서는 AC로 검증되지 않지만 ADR-004가 명시한 하드 요구사항이니 빠뜨리지 마라.

## Acceptance Criteria

- AC 명령: lint, build, test
- 기준 테스트: `apps/pet/test/character.test.ts`, `packages/core/test/shell-rc.test.ts` — **이 테스트들이 너의 합격 기준이다.**

## 검증 절차

1. AC 명령을 직접 실행해보며 자가수정하라. 단, 합격 판정은 러너가 내린다.
2. 작업을 마치면 `phases/mvp-kickoff/step1-output.json`에 `{"summary": "산출물 한 줄 요약"}`을 작성하라.

## 금지사항

- 테스트 파일(`packages/core/test/shell-rc.test.ts`)이나 fixture(`packages/core/test/fixtures/zshrc/*.zshrc`)를 수정·삭제·추가하지 마라(잠겨 있다). 기준이 잘못됐다고 판단되면 output에 `blocked_reason`으로 신고하라.
- `phases/` 아래 index.json을 수정하지 마라(러너 전유물).
- `DiagnosticHost` 인터페이스(`packages/core/src/host.ts`)를 확장하지 마라 — `exec`/`readFile`/`env`/`homedir` 네 가지만으로 구현해야 한다(`core-types-spec` FR-001, 이미 확정된 계약).
- rc 파일을 실제로 수정/삭제하는 코드를 넣지 마라 — 이 어댑터는 진단만 한다(`fix.command`를 채우지 않는 것과 같은 이유).
- `packages/core/src/adapters/`에 `.gitkeep` 외에 이 step과 무관한 다른 어댑터 파일을 만들지 마라(범위 밖, 다른 step 몫).
- 새 의존성(npm 패키지)을 추가하지 마라.
- 기존 테스트를 깨뜨리지 마라.
