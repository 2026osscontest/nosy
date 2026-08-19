> **[보관] 이 문서는 역할을 마쳤습니다 — 2026-08-19**
>
> `dnnals/dnnals-plugins`의 `harness` 플러그인을 개선하는 작업을 세션 간에 이어가기 위한 핸드오프 문서였습니다. 다루던 라운드(roleGuard 삭제, E단계 review 체이닝, phases 경량화, 시크릿 스캔 훅, setup 스크립트화 등)가 전부 완료·push·캐시 갱신까지 끝났고, `disable-model-invocation` 결정까지 마무리되어 **더 이어갈 다음 세션이 없습니다.**
>
> 이 프로젝트(`/Users/dnnals/Projects/opensource`)는 이제 `harness.json`/`AGENTS.md`/`docs/*`가 실제로 생성된 실사용 단계입니다. 하네스 플러그인 자체를 더 고칠 일이 생기면 이 문서를 이어 쓰지 말고 새로 시작하세요 — 판단 근거·방법론(부록 B의 블라인드 실험 방법론 등)만 참고용으로 유효합니다.

---

# Harness 플러그인 개선 — 세션 핸드오프

이 문서는 `dnnals/dnnals-plugins` 저장소의 `harness` 플러그인을 개선하는 작업을 세션 간에 이어가기 위한 핸드오프다. 컨텍스트가 찰 때마다 세션을 분리하며 이 파일을 갱신한다.

## 0. 지금 상태

**push 완료** (`dnnals/dnnals-plugins` origin/main, 커밋 순서대로):
- `9d67534` — `harness.config.json` → `harness.json` 리네임, CLAUDE.md에 검증자/구현자 분리 원칙 명시
- `c50d280` — D단계 재승인 게이트 제거 → 테스트 diff 체크포인트로 대체 (실측 검증 완료)
- `d0063cf` — `spec`/`fix` 스킬 신규 추가, `harness` 스킬 연결부 반영(description에 위험군 기준, A단계에서 spec.md 읽기), 5개 SKILL.md 문구 다이어트
- `47e32ad` — `AGENTS.md`를 지침 SSOT로 분리, `CLAUDE.md`는 `@AGENTS.md` import로 축소(`harness.json`의 `executor`가 codex 등일 때 대응)
- `7f366e0` — 크리티컬 사전방지 1호: git pre-commit 시크릿 스캔 훅 추가
- `aa9e839` — 버전 3.1.2 → 3.2.0 (아래 "플러그인 캐시 드리프트" 참고)
- (이번 라운드, 아래 섹션 1-2) — roleGuard 전면 제거, review 스킬이 E단계 검증 단일 진입점으로, phases 1-step 경량화, 템플릿/spec 조건부화, 버전 3.2.0 → 3.3.0
- `4973ee4` — `setup` 스킬의 `.gitignore` 처리를 실제 템플릿 파일과 연결(고아 파일이었음, 아래 섹션 2의 4·6번 참고), 버전 3.3.0 → 3.3.1
- `f34267e` — setup 절차를 `scripts/setup.mjs`로 스크립트화(파일 생성·gitignore 병합·훅 설치는 기계적 작업이라 결정론적 스크립트로, 판단(UI 유무)만 에이전트 몫으로 분리 — runner.mjs와 같은 패턴). 유닛테스트 6개 추가(77개), 버전 3.3.1 → 3.3.2

**이 핸드오프 문서가 다루던 라운드는 여기서 종료.** 섹션 2의 미결 항목(4, 6)까지 이번 세션에서 처리했고, 사용자가 실사용 단계로 넘어간다. 5, 7번은 실사용 중 자연히 검증/논의될 항목으로 남겨둔다.

**✅ 플러그인 캐시 드리프트 — 해결 완료.** `Skill` 툴이 실제로 로드하는 경로는 마켓플레이스 클론이 아니라 버전 고정 캐시(`~/.claude/plugins/cache/dnnals-plugins/harness/<version>/`)다. `plugin.json`의 `version`을 안 올리고 마켓플레이스 소스만 계속 고쳐온 탓에, **`9d67534`부터 이 세션 시작 시점까지의 커밋 전부가 실사용 경로(Skill 툴)에 한 번도 반영된 적이 없었다** — 블라인드 벤치마크로 처음 발견(`spec`/`fix` 스킬 디렉토리 자체가 캐시에 없었음). 조치: 버전을 `3.1.2 → 3.2.0`(시크릿 스캔 반영분) → `3.3.0`(가벼움 재검토 반영분)으로 올려 push, 사용자가 `/plugin`으로 재설치 실행. **검증 완료**: `installed_plugins.json`의 `gitCommitSha`가 마켓플레이스 `HEAD`(`a6547982...`)와 일치, `~/.claude/plugins/cache/dnnals-plugins/harness/3.3.0/`이 마켓플레이스와 `diff -rq`로 완전 동일(캐시 내부 마커 파일 하나 제외), 스킬 목록에 `harness:fix/harness/review/setup` 전부 정상 노출(`spec`은 `disable-model-invocation`대로 목록엔 안 뜨되 명시 호출 가능 — 의도된 동작). **앞으로의 습관**: 마켓플레이스 소스를 고칠 때마다 `plugin.json`의 `version`을 반드시 같이 올릴 것 — 이번 사고 자체가 재발 방지 대상이다.

**로컬 이 프로젝트(`/Users/dnnals/Projects/opensource`)의 템플릿 파일들은 사용자가 방금 직접 지웠다** — 분실이 아니라 의도적. 플러그인이 이번 라운드까지 마무리되면 `harness:setup`으로 다시 생성할 예정이다. 새 세션은 이 디렉토리에 `harness.json`/`docs/`가 없다고 당황하지 말 것.

**결정 완료**: `harness` 스킬에 `disable-model-invocation`은 넣지 않는다(현재 상태 유지, 사용자 최종 확인). 근거: `spec`이 명시적 호출만 요구하는 이유는 "무거운 파이프라인이라서"가 아니라 "요청하지도 않은 인터뷰를 갑자기 시작하는 게 침해적이라서"다. `harness`/`fix`는 둘 다 모델이 위험군(부록 10번 기준)을 보고 알아서 진입하는 게 설계 의도이고, `harness`는 B단계 사용자 승인·D단계 diff 확인 게이트가 이미 있어 자동 진입해도 안전하다. 코드 변경 없음.

## 1. 핵심 철학 — 이번에 다시 못박은 것 (다음 모든 결정의 기준)

이 프로젝트를 관통하는 원칙은 그대로 유지된다: **모델이 발전할수록 하네스는 가벼워져야 한다. 실수는 사전에 상상해서 막지 않고, 사후에 기록해서 개선한다.**

이번 세션에서 사용자가 이 원칙을 다음과 같이 더 명확하게 구체화했다 — **다음 세션은 이 구분을 최우선으로 따를 것**:

- **하네스 플러그인은 워크플로우(파이프라인 구조)만 제공한다.** 가드레일(강제 규칙)은 그 위에 얹는 별개의 층이다.
- **가드레일의 기본값은 사후 대응이다.** 실제로 한 번 실수가 발생한 지점에만, 그 지점 하나에만 가드레일을 추가한다. 발생하지도 않은 시나리오를 상상해서 미리 규칙을 채우지 않는다. 에이전트의 자율성을 최대한 보장하는 게 기본 방향이다.
- **예외 — "크리티컬"한 실수는 사전에 방지한다.** 되돌릴 수 없거나(irreversible) 한 번만 터져도 치명적인 카테고리는 "한 번 겪고 나서 배우자"는 사후 대응 원칙에서 제외한다. 처음부터 기본 가드레일로 막아둔다.
  - 사용자가 든 예시: **환경변수/시크릿 노출.**
  - 정확한 카테고리 목록과 강제 방식(hook? 커밋 전 스캔? 등)은 아직 확정 안 됨 — 다음 세션의 첫 작업.

이 두 층을 혼동하지 말 것: 기존에 정립된 "위험군 트리거 기준"(공유 상태·동시성·보안 경계·자원 생명주기·외부 API 계약 — 4번 섹션 참고)은 **작업을 어느 파이프라인(harness vs fix)으로 보낼지** 정하는 라우팅 기준이고, 이번에 새로 나온 "크리티컬 사전방지"는 **그 파이프라인들 전부 위에 항상 깔리는 별도의 안전망**이다.

### 1-1. 크리티컬 사전방지 1호 — 시크릿/환경변수 노출 (완료)

**결정**: git pre-commit 훅 하나로만 구현. 처음엔 (A) Read/Edit/Write 자체를 `.env`류 파일에서 차단 + (B) `blockedCommands`에 `cat .env` 류 패턴 확장 + (C) pre-commit 스캔, 3중으로 설계했다가 **"가벼워야 한다" 원칙에 비춰 스스로 되짚어 C 하나로 줄였다**:
- 진짜 되돌릴 수 없는 순간은 로컬에서 파일을 읽는 시점이 아니라 **git commit — 특히 push되어 공유 저장소(이 레포는 opensource라 더더욱)에 올라가는 순간**이다. A/B는 아직 되돌릴 수 있는 단계를 막는 거라 "크리티컬 예외"의 비가역성 근거가 약하고, 로컬 디버깅 자율성만 깎는다.
- A의 14개 파일 패턴, C 초안의 벤더별(AWS/Slack/GitHub) 토큰 정규식은 "실제로 겪은 실수"가 아니라 상상으로 채운 목록이었다 — §1의 "목록을 미리 크게 상상해서 채우지 말 것" 원칙을 스스로 어긴 사례. 최종안은 최소 3패턴(`.env`류 파일명, private key 헤더, 범용 `key/secret/token/password=` 대입)으로 줄였다.
- A/B는 폐기가 아니라 **보류**다 — "에이전트가 `.env`를 읽어서 채팅 응답에 값을 그대로 노출"한 실제 사고가 나면 그때 사후 대응으로 추가한다(§1 기본 원칙 그대로 적용).

**구현물** (`dnnals-plugins` 레포):
- `harness/scripts/lib/secret-scan.mjs` — 판정 로직 (`isSecretFile`/`findSecretFiles`/`findSecretLines`)
- `harness/scripts/hooks/pre-commit-secret-scan.mjs` — 실제 git 훅에서 실행되는 스크립트. `git diff --cached --name-only --diff-filter=ACMR`로 파일명 검사(삭제는 제외 — 시크릿 파일을 지우는 커밋까지 막으면 오탐), `git diff --cached -U0`로 추가된 줄만 내용 검사.
- `harness/tests/secret-scan.test.mjs` — 유닛테스트 6개
- `harness/skills/setup/SKILL.md` 절차 4번 — `.git/hooks/pre-commit`에 절대경로 shim 설치. **기존 pre-commit 훅이 있으면 덮어쓰지 않고 안내만** (체이닝 자동화는 기존 훅을 망가뜨릴 위험이 있어 안 함). git 저장소가 아니면 스킵.

**검증**: 실제 git 저장소 + 실제 `git commit`으로 12개 시나리오 벤치마크 — 차단 4종(env 파일/하드코딩 키/private key/혼합 스테이징), 통과 6종(env.example/평범한 코드/짧은 값/env 참조/--no-verify 우회/**env 파일 삭제**), 설치 로직 2종(신규 설치/기존 훅 보존). 과정에서 실버그 1개 발견해 수정: `.env` **삭제** 커밋까지 막던 것을 `--diff-filter=ACMR`로 고침(삭제 D는 제외). 최종 12/12 통과, 기존 유닛테스트 79개 회귀 없음.

### 1-2. "가벼움" 재검토 라운드 — 전체 파이프라인 구조 재검토 (완료, 실행 대기)

시크릿 스캔 이후 사용자가 "가벼움 원칙에 다시 비춰보자"고 요청, 여러 턴에 걸쳐 파이프라인 전체를 재검토했다. 결정 사항:

1. **E단계 = `harness:review` 호출로 확정, A-1의 옛 diff는 폐기.** 옛 안은 `harness/SKILL.md`가 러너 완료 후 `Skill({skill:"code-review"})`(내장 스킬)를 직접 부르는 것이었는데, 재검토 중 사용자가 지적: `review`(플러그인 자체 스킬, 아키텍처/ADR/CRITICAL 체크리스트 전용) 체크리스트를 AGENTS.md에 흡수하면 **AGENTS.md는 매 세션 무조건 로드**돼서 리뷰 안 하는 세션에서도 공짜로 토큰을 태운다는 반박이 나왔고, 이게 맞았다. 최종 구조: `harness/SKILL.md`가 러너 완료 후 `harness:review`를 부르고, `harness:review` 절차 맨 앞에서 먼저 `Skill({skill:"code-review"})`를 호출한 뒤 자기 체크리스트를 얹는다 — 진입점 하나로 통합, 체크리스트는 스킬 안에 있어 실제 호출될 때만 컨텍스트 비용 발생(프로그레시브 디스클로저). **구현 완료**: `harness/skills/harness/SKILL.md`에 E단계 추가, `harness/skills/review/SKILL.md` 절차 0번에 code-review 체이닝 추가.
2. **일반화된 설계 규칙**: AGENTS.md(매 세션 상시 로드)엔 "어떤 상황에 어떤 스킬을 쓸지" 판단에 필요한 것(원칙·라우팅 기준 — 짧고 항상 필요)만 두고, "그 스킬을 어떻게 수행할지"(체크리스트·절차 — 길고 가끔 필요)는 해당 스킬 파일 안에 둔다. 앞으로 이 기준으로 판단할 것.
3. **`roles`/`roleGuard` 전면 삭제.** 사용자의 원래 의도: "여러 사람이 각자 자기 코딩 에이전트로 협업할 때, 한 사람의 에이전트가 다른 사람 담당 영역을 침범 못 하게" — 의도 자체는 타당하지만 도구가 틀렸다고 판단. 이유:
   - GitHub/GitLab/Bitbucket의 **CODEOWNERS + 브랜치 보호 규칙**이 이미 이 문제를 더 잘 푼다 — 플랫폼이 강제(리뷰 없인 머지 불가)하고, 사람이 실제로 diff를 보고 "이건 정당한 크로스 바운더리 수정이다"라고 판단할 기회(PR 리뷰)까지 준다. 지금 roleGuard는 `.harness-role`이라는 로컬 관례 파일에 전적으로 의존하는 훨씬 약한 재발명이었고, 정당한 예외 상황에서도 그냥 하드 블록만 한다.
   - B단계 step 설계 규율("step 하나는 레이어 하나만, 시그니처 수준으로 건드릴 파일을 못박는다")과 상당 부분 중복 — 오늘 벤치마크에서도 구현자가 지시된 파일만 정확히 건드렸다.
   - 실제로 겪은 사고가 없다 — §1 "사후 대응 원칙"에 따르면 크리티컬 예외(비가역적/치명적)에도 안 들어간다(침범해도 PR 리뷰로 되돌리면 됨).
   - **breadcrumb 없이 완전 삭제로 확정** — "CODEOWNERS가 이미 검증된 업계 표준이라 되돌릴 계획 자체가 불필요하다"는 사용자 판단. **구현 완료**: `config.mjs`/`rules.mjs`/`edit-checks.mjs`/`runner.mjs`/`templates/harness.json`/`skills/harness/SKILL.md`/`skills/setup/SKILL.md`에서 role 관련 코드·문구 전부 제거, 관련 테스트 8개 삭제(79→71개, 전부 green).
4. **phases 파일 체계는 유지하되 1-step task는 경량화.** 처음엔 "`phases/index.json`을 git log로 대체하자"고 제안했다가 철회함 — **러너는 성공한 step만 커밋하므로 blocked/error 상태는 git에 아예 흔적이 없다.** git으로 재구성 불가능한 정보라 index.json이 실제로 필요하다(사용자가 직접 지적, 맞는 지적이었음). 대신 파일 *개수*를 줄이는 쪽으로 재조정:
   - `phases/index.json`(여러 task 전체 현황 카탈로그)은 **task가 1개뿐이면 생략 가능** — 러너(`updateTopIndex`)가 이미 파일 부재를 안전하게 no-op 처리하고 있어 러너 코드 변경 없이 SKILL.md 지시만으로 가능.
   - step이 **1개뿐이면** 별도 `step{N}.md` 파일 없이 `phases/{task}/index.json`의 해당 step 객체에 `body` 필드로 지시서를 인라인한다. step이 2개 이상이면 기존대로 사람이 설계 리뷰 중 개별 파일을 읽기 편하도록 분리 유지. **구현 완료**: `runner.mjs`의 `runStep()`이 `step.body`가 있으면 그걸, 없으면 `step{N}.md`를 읽도록 수정(추가적·하위호환, 기존 멀티스텝 경로 무변경). `harness/SKILL.md` C-1/C-3에 조건 반영. **주의: 이 경로는 유닛테스트가 없다** — `runner.mjs`는 직접 임포트 가능한 모듈이 아니라 스크립트라 기존에도 직접 테스트가 없었고(오직 `runner-core.mjs`만 유닛테스트됨), 이번 변경도 마찬가지다. 다음 세션의 블라인드 벤치마크(1-step 태스크 포함)로 실측 검증할 것.
   - `roles`처럼 정적 판단만으로 처리 가능한 항목과 달리, 이건 실제 동작 경로 변경이라 **실측 전에는 "됐다"고 단정하지 말 것**.
5. **템플릿 조건부화.** `UI_GUIDE.md`는 사용자 대면 UI가 있는 프로젝트일 때만 생성(CLI/라이브러리/백엔드 전용이면 생략). PRD/ARCHITECTURE 통합은 논의만 하고 보류 — 실제 템플릿 본문 재구성까지는 이번 라운드에서 안 함.
6. **`spec` 스킬 경량화.** 정식 5섹션 문서를 무조건 요구하던 것에서, "먼저 채팅으로 가볍게 인터뷰 → 그걸로 충분하면 문서화 없이 바로 harness로 체이닝, 이해관계자가 여럿이거나 범위가 복잡할 때만 정식 spec.md 작성"으로 변경.
7. **`codex` 실행기 지원은 변경 없이 유지** — 사용자가 실사용 확인. 애초에 개편안 후보에서 제외.

**실측 완료**: 4번(phases 경량화)은 독립 블라인드 벤치마크로 실제 러너 실행까지 검증 완료(섹션 2의 3번 참고). 5, 6(템플릿/spec 조건부화)은 SKILL.md 문구 수준 변경이라 별도 실측 없이 진행했으나, 벤치마크 중 UI_GUIDE 조건부 생성이 실제로도 의도대로 동작함을 부수적으로 확인함.

## 2. 다음 세션이 할 일 (순서대로)

1. ~~"크리티컬 사전방지" 목록과 강제 방식을 확정한다~~ — **완료 (1-1 참고)**.
2. ~~플러그인 캐시가 실제로 갱신됐는지 확인한다~~ — **완료.** `gitCommitSha`가 마켓플레이스 HEAD와 일치, `diff -rq`로 캐시=마켓플레이스 확인됨(0번 섹션 참고).
3. ~~이번 라운드("가벼움" 재검토) 실측 벤치마크~~ — **완료.** 독립 세션(블라인드)이 1-step 인라인 body 경로를 실제 `runner.mjs`로 돌려 정상 동작 확인(red→구현→AC 3개 통과→커밋), 설계 산출물 3파일→1파일 실측(66% 감소), roles 잔재 없음(grep 전수 확인), UI_GUIDE 조건부 생성 정상, review 체이닝 절차 실행 가능 판정. 유닛테스트 71개 + throwaway red→green 6개 전부 통과. 독립 판단 결론: "토큰 효율적이고 가벼우며 실사용 가능한 수준" — 단, 헤드리스 구현자 spawn 비용(1-step에도 ~$0.16·20초+)은 파이프라인 코어 특성이라 이번 경량화 대상이 아니었다는 점도 함께 짚음.
4. ~~`harness` 스킬의 `disable-model-invocation` 여부를 결정한다~~ — **완료.** 현재 상태 유지(자동 트리거 허용). 상세는 0번 섹션.
5. **`spec`/`fix` 스킬을 실전에서 검증한다** — 아직 합성 실험도, 실사용도 안 해봄. 벤치마크 대신 사용자의 실사용(2026 오픈소스 개발자대회 프로젝트) 중 자연히 검증될 예정.
6. ~~로컬 프로젝트 재세팅~~ — **완료.** `harness:setup` 절차대로 `harness.json`/`AGENTS.md`/`CLAUDE.md`/`docs/{PRD,ARCHITECTURE,ADR,UI_GUIDE}.md`/`.gitignore` 생성(이 프로젝트는 온스크린 데스크톱 펫이라 UI_GUIDE 포함). 진행 중 실제 버그 하나 발견해 수정: `templates/.gitignore`가 setup 절차 어디에도 연결되지 않은 고아 파일이었음(node_modules/.env 무시 규칙이 죽어있었고, roleGuard 삭제 때 `.harness-role` 잔재도 여기만 안 지워짐). `setup/SKILL.md` 절차 3번을 "템플릿 파일을 실제로 읽어 병합"으로 고치고 버전 3.3.0 → 3.3.1, `claude plugin update --scope project`로 캐시 갱신 확인(`gitCommitSha`/`diff -rq` 재검증 완료). 이 프로젝트는 아직 git 저장소가 아니라 pre-commit 시크릿 스캔 훅 설치는 건너뜀 — `git init` 후 `harness:setup`을 한 번 더 돌리거나 훅을 수동 설치할 것. `harness.json`/`AGENTS.md`/`docs/*`는 플레이스홀더 상태이니 프로젝트에 맞게 채워야 `/harness:harness`로 넘어갈 수 있다.
7. **(낮은 우선순위) PRD/ARCHITECTURE 템플릿 통합 검토** — 1-2의 5번, 논의만 하고 실행 안 함.

## 3. 참고 경로

- 플러그인 레포: `github.com/dnnals/dnnals-plugins` (`harness/` 디렉토리, 마켓플레이스: `.claude-plugin/marketplace.json`, 플러그인: `harness/.claude-plugin/plugin.json`)
- 로컬 git clone(바로 편집·커밋·push 가능): `/Users/dnnals/.claude/plugins/marketplaces/dnnals-plugins`
- 이 프로젝트(로컬): `/Users/dnnals/Projects/opensource` — 템플릿 파일 없음(0번 섹션 참고), `docs/{ADR,ARCHITECTURE,PRD,UI_GUIDE}.md`는 남아있을 수 있음
- `.claude/settings.json`에 이미 `dnnals-plugins` 마켓플레이스 + `harness@dnnals-plugins` 플러그인이 등록되어 있음
- 테스트: `cd .../dnnals-plugins/harness && node --test tests/*.test.mjs` (71개, `npm test`는 package.json이 없어 안 됨. roles 관련 8개 삭제 + secret-scan 6개 신규로 79→71)

---

## 부록 A. 이전 라운드 결정 이력 (완료, 참고용)

1. CLAUDE.md와 docs/ 템플릿을 harness/templates/에서 가져와 프로젝트에 배치 — 이후 `AGENTS.md` 분리로 대체됨(0번 섹션).
2. 하네스 플러그인이 실제로 동작하는 성숙한 코드베이스임을 확인 (hooks, runner.mjs 497줄, 테스트 73개+, v3.1.x).
3. `harness.config.json` → `harness.json`으로 리네임 — "config"가 중복이라는 판단(package.json/tsconfig.json류 관례).
4. CLAUDE.md의 TDD 관련 문구 정리 — hook이 반응형으로 이미 처리하는 것(TDD enforce/warn)은 안 적되, hook이 설명 못 해주는 "왜 이렇게 설계했는지"(검증자/구현자 분리 원칙)는 남긴다. 최종 문구: "테스트는 설계 세션만 작성한다. 구현을 위임받은 세션은 테스트를 수정할 수 없다 — 구현자가 자기 코드에 맞춰 테스트를 느슨하게 쓰는 걸 막기 위함."
5. "알려진 함정" 섹션을 CLAUDE.md(현 AGENTS.md) 본문에 신설 — 별도 로그 파일 대신. 근거: stale 정보를 계속 주입하는 별도 append 로그가 에이전트를 오히려 나쁘게 만든 실패 사례.
6. **D단계 재승인 게이트 제거 → 가벼운 체크포인트로 대체.** 처음엔 "diff-only 체크포인트가 재승인을 대체할 만큼 안전한가"를 실측 검증 없이 반영하는 게 모순이라 보류했다가, 이번 세션에서 실제로 블라인드 실험(웹훅 idempotency 시나리오)을 돌려 검증 완료:
   - diff-only(테스트 코드만, 구현 코드 접근 없음) 리뷰는 실제 프로덕션급 버그(TTL이 in-flight 상태를 보호 못 해 발생하는 중복 실행/비결정적 덮어쓰기/연쇄 삭제)를 전혀 못 잡음.
   - 구현 코드 접근이 있으면 일반 리뷰든 "깨봐" 프레이밍의 어드버서리 리뷰든 똑같이 잡아냄 — **결정적 변수는 프레이밍이 아니라 코드 접근 여부.**
   - 재해석: D단계 시점(러너 기동 전)엔 애초에 구현 코드가 존재하지 않는다(구현은 러너가 D 이후 생성) — 그래서 옛 재승인도 새 diff 체크포인트도 원래 구현 버그를 본 적이 없었다. **진짜 위험은 러너 완료 후 아무도 구현을 검증하지 않는다는 것**이었는데, 이 새 E단계(`Skill({skill:"code-review"})` 게이트)는 검증까지 마쳤지만 "실제 사고가 아직 없다"는 이유로 반영은 보류했다(1번 섹션의 원칙과 정확히 같은 논리 — 이게 이번에 "크리티컬 예외"를 명문화하게 된 배경이기도 하다). diff는 아래 A-1에 대기 중.
7. `docs/specs/{feature}-spec.md` 구조 확정(GitHub spec-kit 참고, 5섹션: User Scenarios & Testing/Requirements/Key Entities/Success Criteria/Assumptions) — `spec` 스킬 SKILL.md 안에 인라인으로 반영됨(별도 템플릿 파일 없음).
8. 스킬 체이닝 방식 확인(mattpocock/skills 레포 실측) — SKILL.md 안에 `Skill({skill:"..."})` 호출 지시만 넣으면 체이닝됨. 무거운 스킬은 `disable-model-invocation: true`로 명시적 호출만.
9. `fix` 스킬 설계 — 재현 → 조건부 회귀테스트(seam 없으면 "테스트할 자리가 없다"고 기록) → 수정 → spec 이탈 감지 → 모호성이 있으면 사용자에게 확인. `disable-model-invocation` 없음(자동 트리거, mattpocock의 `diagnosing-bugs` 패턴 채택).
10. **무거운 파이프라인(spec+harness)의 트리거 기준을 "기능이냐 버그냐"나 "크기"가 아니라 "위험군"으로 재정의**: 공유 상태·동시성·보안 경계·자원 생명주기·외부 API 계약처럼 "로컬에서는 맞아 보이는데 실제 조건에서 깨지는" 위험군을 건드리는가. 만족하면 Tier 2(harness), 아니면 Tier 0/1(`fix`).
11. `spec`/`fix` 스킬 신규 작성 + `harness` 연결부 반영 + 5개 SKILL.md 독립 감사(다이어트, 3곳 제거 — 검증자/구현자 분리 원칙 등 비자명한 설계 근거는 반례로 보존).
12. `AGENTS.md`/`CLAUDE.md` 분리 — `harness.json`의 `executor`가 Claude 외 CLI(예: codex)일 수 있어, 그런 실행기가 관례상 읽는 `AGENTS.md`를 SSOT로 두고 `CLAUDE.md`는 `@AGENTS.md` import로.
13. 크리티컬 사전방지 1호(시크릿/환경변수 노출) — git pre-commit 스캔 훅. 상세는 1-1.
14. 플러그인 캐시 드리프트 발견 — 버전 미고정 갱신으로 `9d67534` 이후 전 커밋이 실사용 경로에 미반영이었던 것 확인, 버전 3.3.0으로 조치. 상세는 0번 섹션.
15. "가벼움" 전면 재검토 — E단계=`harness:review`(내부에서 code-review 체이닝), roleGuard 전면 삭제(CODEOWNERS로 대체 권고), phases 1-step 경량화, 템플릿/spec 조건부화. 상세는 1-2.

### A-1. (폐기됨 — 1-2 참고) 옛 E단계 diff

아래는 처음 설계했던 안으로, **`harness/SKILL.md`가 러너 완료 후 `code-review`를 직접 호출**하는 구조였다. 1-2에서 `harness:review`를 경유하는 구조로 대체되어 폐기됨(체크리스트를 AGENTS.md 대신 스킬 파일에 두는 게 컨텍스트 효율상 낫다는 이유). 실제 반영된 최종 형태는 `harness/skills/harness/SKILL.md`의 "E. 검증" 절과 `harness/skills/review/SKILL.md` 절차 0번 참고.

```diff
+## E. 검증 (러너 완료 후)
+
+task의 모든 step이 완료되면 `Skill({skill: "code-review"})`로 해당 task의 변경 diff를 리뷰한다.
+이슈 발견 시 근거와 함께 사용자에게 보고하고 대응을 논의한다. 이슈 없으면 완료 처리.
```

## 부록 B. 블라인드 실험 방법론 (재사용 가능)

확증편향을 피하려면, 검증하려는 대화를 전혀 모르는 새 세션에게 작업을 시키고, 결과를 역시 무관한 다른 세션이 판정하게 한다. 이번 프로젝트에서 세 차례 반복 검증됨:

- **실험 1** (URL 단축기 버그 수정 + 만료 기능): 무거운 파이프라인이 과잉인 규모였음. 유일한 진짜 문제는 "모호성을 안 물어본 것".
- **실험 2** (레이트리밋, 공유 상태·동시성): 블라인드 에이전트의 자체 테스트(4개, 전부 단일 스레드 순차)는 못 잡는 실제 버그 2개(락 없는 레이스 컨디션, 무한 메모리 누수)를 "이거 깨봐"라는 요청만 받은 무관한 어드버서리 에이전트가 재현까지 해서 입증.
- **실험 3** (웹훅 idempotency, 부록 A-6): diff-only 리뷰 vs 코드 접근 리뷰(일반/어드버서리 프레이밍 둘 다) 비교 — 코드 접근 여부가 결정적 변수임을 확인.

공통 결론: **검증자/구현자 분리는 구조적 문제**(자기 눈으로 자기 사각지대를 못 봄)라 모델이 아무리 좋아져도 안 없어질 가능성이 크다 — 사람 개발팀이 시니어여도 코드리뷰를 계속 하는 것과 같은 이유. 새로운 워크플로우 변경을 검증할 때 이 방법론을 재사용할 것.
