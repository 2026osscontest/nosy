# 07a — 브라우저 완결형 개발자 도구 (서버 인프라 0 / 순수 TS·JS)

조사일: 2026-08-17 (D-10)
담당 축: 브라우저 안에서 완결되는 개발자 도구. WASM·WebGPU를 **우리가 만들지 않고**, 기성품만 소비.
제약 재확인: 구현 언어 TS/Python만 / 170~250 person-hour / GPU 없음 / 인프라 지원 0 / 최종 사용자 = 개발자
1순위 기준: **발표 현장 임팩트("우와")**

---

## 0. 결론 요약

| 순위 | 후보 | 우와 | G8 | 2주 실현성 | 종합 |
|---|---|:-:|:-:|:-:|---|
| **1** | `ignoregrid` — 무시·포함 패턴의 **도구 간 의미 불일치**를 실제 구현 8종 교차 실행으로 전수 발굴 | **4~5/5** | **깨끗 (유사 0건)** | **최상 (미지 2개)** | **채택 권고** |
| **2** | `schedhunt` — 코드 무수정 async/await **스케줄 전수 탐색기** | **5/5** | **위험 (인접 5건, 동형 1건)** | 중 (미지 3개) | **조건부 / 보험** |
| — | 나머지 11건 | — | 대부분 G8 HIT | — | 탈락 (§4 표) |

**이 축의 구조적 특성**: 진입장벽이 0이기 때문에 "브라우저로 옮기면 좋은 것"은 이미 대부분 옮겨져 있다.
실측: 컴파일러(TS Playground/Babel REPL/swc), DB(shell.duckdb.org/PGlite), 프로파일러(speedscope/Perfetto),
AST(astexplorer.net), 모듈 해석(arethetypeswrong.github.io), 모델 검사(`tla-checker` npm), 마크다운 차등(babelmark3)
— **전부 존재**. 따라서 "브라우저에서 된다"만으로는 우와가 안 나오고, **"브라우저에서 되는데 아무도 안 했다"**를
증명할 수 있는 좁은 틈만 후보가 된다. 아래 2건이 그 틈이다.

---

## 1. ★ 후보 1 — `ignoregrid`

### 1-1. 한 문장 정의
**같은 무시·포함 패턴 파일을 git·npm·Docker·tsc·ESLint·Prettier·Biome·번들러가 서로 다르게 해석하는 지점을, 실제 구현체를 브라우저에서 그대로 교차 실행해 전수로 찾아내는 도구.**

### 1-2. 문제의 실체 (왜 이게 진짜 고통인가)

`[확인]` ESLint 공식 문서가 **자기 입으로 gitignore와 다르다고 명시**한다:
> "Unlike `.gitignore`, an ignore pattern like `.config` will only ignore the `.config` directory in the same directory as the configuration file. If you want to recursively ignore all directories named `.config`, you need to use `**/.config/`"
> "A pattern like `dir-to-exclude/` will not ignore anything."
https://eslint.org/docs/latest/use/configure/ignore

`[확인]` ESLint 이슈 #16264 "Bug: [new config system] `.eslintignore` doesn't work like `.gitignore`"
https://github.com/eslint/eslint/issues/16264 — 그리고 이 불일치를 메우려고 `eslint-gitignore`, `includeIgnoreFile` 유틸이 별도로 생겼다. **즉 불일치는 공식적으로 인정된 사실이고, 각 도구가 개별 우회책을 만들고 있을 뿐, 전체 지형도를 보여주는 것은 없다.**

`[확인]` ripgrep은 `-g/--glob`에까지 gitignore 의미를 적용하고, `/`가 절대 경로가 아니라 적용 지점 기준 앵커 경로로 해석된다 (BurntSushi/ripgrep Discussion #2156) https://github.com/BurntSushi/ripgrep/discussions/2156

`[확인]` picomatch는 브레이스 확장을 **하지 않고**, micromatch는 **한다** (picomatch README 명시)
https://github.com/micromatch/picomatch

`[확인]` 영향 규모 — npm 주간 다운로드 (2026-08-17 registry API 실측):

| 매처 | 주간 DL |
|---|---:|
| minimatch | 595,560,719 |
| picomatch | 394,965,852 |
| glob | 330,523,318 |
| ignore | 262,128,052 |
| micromatch | 134,626,827 |
| tinyglobby | 129,826,602 |
| fast-glob | 129,278,749 |
| globby | 61,788,754 |
| **합계** | **약 20억/주** |

즉 **주당 20억 회 설치되는 8개 구현이, 같은 문법으로 보이는 패턴을 서로 다르게 해석한다.** 개발자는 이걸 "왜 내 `.eslintignore`가 안 먹지", "왜 Docker 이미지에 `node_modules`가 들어갔지", "왜 `.env.local`이 npm 패키지에 포함됐지"로 매일 겪지만, **어느 도구가 어떻게 다른지 한 화면에서 보여주는 것이 없다.**

### 1-3. "우와" 체크리스트 판정 — **5개 중 4~5개 충족**

| # | 항목 | 판정 | 근거 |
|:-:|---|:-:|---|
| 1 | 배경지식 0, 30초 이해 | **○** | 화면에 "당신의 `.env.local`은 **git은 무시하지만 npm publish에는 포함**됩니다" 한 줄이 뜬다. 설명이 필요 없다. 시크릿 유출은 누구나 아찔해한다 |
| 2 | 심사위원이 자기 노트북으로 즉시 체험 | **◎** | File System Access API로 **자기 프로젝트 폴더를 선택**하면 그 자리에서 자기 리포의 불일치가 나온다. 업로드·서버·계정 전부 없음. "우리가 준비한 예제"가 아니라 **심사위원 본인의 코드**가 증거가 되는 게 이 후보의 최강점 |
| 3 | 정량적으로 극적 | **○** | "도구 8개 × 파일 4,120개 = 32,960 판정을 0.4초에 교차 실행 → 불일치 파일 27개" / 퍼저 모드 "무작위 패턴 20만 개 → 구현 간 불일치 3.4만 건, 6초" |
| 4 | "이게 지금까지 없었어?" | **○** | 주당 20억 다운로드 생태계인데 교차 비교기가 0건 (§1-5). 이 숫자와 함께 제시하면 반응이 나온다 |
| 5 | 화면에 움직임·실시간 변화 | **○** | 파일×도구 히트맵이 실시간으로 채워지며 불일치 셀이 빨갛게 점등. 퍼저 모드는 불일치 스트림이 초당 수천 건씩 쏟아짐 |

> **"귀여운 정도"를 넘는 근거**: 이 데모의 클라이맥스는 표의 숫자가 아니라 **"심사위원 본인 리포에서 실제 시크릿·불필요 파일 유출 경로가 발견되는 순간"**이다. 정적 비교가 아니라 그 자리에서 새로 발견되는 사실이다.

### 1-4. 3분 시연 시나리오 (초 단위)

| 시각 | 화면 | 나레이션 |
|---|---|---|
| 0:00–0:12 | 빈 브라우저 탭 하나. 주소창에 URL 입력, 엔터. 로딩 0.6초 후 도구가 뜬다. 우측 상단에 `서버 요청 0건 / 설치 0` 배지 | "설치도 서버도 없습니다. 링크 하나입니다" |
| 0:12–0:25 | "폴더 선택" 클릭 → OS 파일 선택기 → 실제 오픈소스 프로젝트(예: 우리 저장소) 선택. 좌측에 감지된 설정 파일이 하나씩 체크되며 나타남: `.gitignore` `.npmignore` `.dockerignore` `tsconfig.json` `eslint.config.js` `.prettierignore` `biome.json` `vite.config.ts` | "이 프로젝트에는 무시 규칙이 8군데 흩어져 있습니다" |
| 0:25–0:40 | 중앙에 파일 4,120행 × 도구 8열 히트맵이 **위에서 아래로 실시간 채워짐**. 셀 색: 초록=포함, 회색=무시, **빨강=도구 간 불일치**. 우측 카운터가 `32,960 판정 / 0.41초`로 멈춤 | "8개 도구의 실제 구현을 브라우저에서 그대로 돌렸습니다. 재구현이 아닙니다" |
| 0:40–0:58 | 빨간 셀만 필터. 27행 남음. 맨 위 행 클릭 → 확대 패널: `.env.local` — git: **무시** / npm publish: **포함** / Docker build context: **포함** / ripgrep: 무시. 아래에 "원인: `.npmignore`가 존재하면 `.gitignore`는 무시된다" + 해당 스펙 링크 | "이 한 줄이 시크릿 유출 경로입니다" |
| 0:58–1:12 | "수정 제안" 클릭 → 세 도구 모두 무시하게 만드는 최소 패치 diff가 생성됨. 복사 버튼 | "고치는 방법까지 diff로 줍니다" |
| 1:12–1:30 | **심사위원 참여 구간.** "직접 해보세요" 버튼 → QR/짧은 URL 표시. 심사위원이 자기 노트북에서 열고 자기 프로젝트 폴더 선택 → 각자 화면에 각자의 빨간 셀이 뜬다 | "지금 여기서 각자 프로젝트로 해보십시오" |
| 1:30–2:05 | 탭 전환: **퍼저 모드.** "탐색 시작" → 무작위 패턴이 초당 수천 개 생성되며, 좌측에 불일치 사례가 실시간 스트림으로 쏟아짐. 카운터 `패턴 203,417 / 불일치 34,208 / 6.2초`. 각 행은 `패턴 → 도구A: 매치, 도구B: 미매치` | "고정된 테스트가 아니라 새 불일치를 계속 발굴합니다" |
| 2:05–2:30 | 불일치를 원인별로 자동 분류한 막대그래프가 자라남: `브레이스 확장 미지원`, `선행 슬래시 앵커링`, `디렉터리 접미사 /`, `부정 패턴 재포함 순서`, `대소문자`, `**의 0-세그먼트 해석` … 각 막대 클릭 시 최소 재현 패턴 | "원인은 6가지 규칙 차이로 수렴합니다" |
| 2:30–2:50 | "코퍼스 내보내기" → 최소화된 불일치 사례 JSON이 다운로드. 옆에 우리 저장소에 이미 커밋된 코퍼스 파일 수(예: 1,204건)와, 이 코퍼스로 실제 제출한 업스트림 이슈 목록 | "발굴 결과는 재사용 가능한 자산으로 저장소에 남습니다" |
| 2:50–3:00 | 마지막 화면: 숫자 3개만 — `20억 주간 다운로드 / 8개 구현 / 교차 검증 도구: 0건 → 1건` | — |

### 1-5. G8 실물 반증 로그

**① 웹 검색 (한국어 1 + 영어 2 이상, 문제 서술로)**

| 검색어 | 결론 |
|---|---|
| (KO) "gitignore npmignore tsconfig exclude eslint ignore 패턴 도구마다 다르게 동작 불일치 문제" | 불일치를 설명하는 **문서·이슈·개별 우회 패키지**만 나옴 (ESLint 공식 문서, #16264, #18304, `eslint-gitignore`). **교차 비교 도구는 0건** |
| (EN) "glob pattern semantics differ between minimatch picomatch fast-glob ripgrep gitignore compare tool" | 상위 결과 전부 **단일 구현 테스터** (globster.xyz) 또는 라이브러리 README. 다중 구현 차등 도구 0건 |
| (EN) "Postgres row level security ..." 등 타 후보 검증에도 동일 방식 적용 (§4) | — |

확인 URL:
- https://eslint.org/docs/latest/use/configure/ignore `[확인]` — ESLint가 스스로 gitignore와 다르다고 명시
- https://github.com/eslint/eslint/issues/16264 `[확인]` — 불일치 버그 리포트
- https://github.com/orgs/eslint/discussions/18304 `[확인]` — v9 ignores 혼란
- https://github.com/BurntSushi/ripgrep/discussions/2156 `[확인]` — ripgrep의 앵커링 의미 차이
- https://github.com/micromatch/picomatch `[확인]` — picomatch는 브레이스 확장 미지원, micromatch는 지원
- https://globster.xyz/ `[확인]` — **단일 구현** glob 테스터 (경쟁 아님)

**② `gh search repos` (실행 결과)**

```
gh search repos "glob compare implementations"   → 0건
gh search repos "glob differential"              → 0건 (무관한 논문/시장조사 리포만)
gh search repos "minimatch picomatch compare"    → 0건
gh search repos "ignore pattern debugger"        → 0건
gh search repos "glob tester"      → GarthDB/glob-tester-cli(★2, 단일 구현 CLI),
                                     MareMare/GlobTester(★0, C#), java-glob-tester(★0)
gh search repos "gitignore tester" → ArnavMK/GitignoreTester(★0, Java),
                                     KmanRenaud/Gitignore-tester(★0, C#)
```
→ **존재하는 것은 전부 "단일 구현을 시험해보는 장난감"이고, 별 0~2개다. 다중 구현 교차 비교·차등 퍼징은 0건.** `[확인]`

**③ 붙으려는 대상의 공식 문서·로드맵 확인**
- ESLint: 불일치를 **문서화하고 그대로 유지**하는 방침 (호환 유틸 `includeIgnoreFile`만 제공). 통합 계획 없음 `[확인]`
- npm: `.npmignore` 존재 시 `.gitignore` 무시, `files` 필드 우선 — 규칙을 **문서로 설명**하고 `npm pack --dry-run`으로 결과만 보여줌. 도구 간 비교 기능 없음 `[확인]`
- git: gitignore(5) 스펙은 git 자신만 규정. 타 도구와의 정합성은 git의 관심사가 아님 `[확인]`
- **사망 패턴 1(표준의 검증기/컨포먼스) 회피 확인**: glob에는 **단일 표준 진영이 없다**(POSIX·bash·git·각 라이브러리가 각자). 그래서 "공식 진영이 컨포먼스 스위트를 만든다"는 사망 패턴이 성립하지 않는다. 단, **설계 규칙: git/bash를 "정답"으로 놓는 순간 컨포먼스 도구가 되어 사망 패턴 1에 접근한다. 정답 없는 차등(differential) 비교로 유지해야 한다.** `[추정]`
- **사망 패턴 2(호스트가 내장) 회피 확인**: 이 도구는 특정 호스트에 붙는 어댑터가 아니다. 어느 한 도구가 내장할 동기가 구조적으로 없다(자기와 남의 차이를 보여주는 것이 제품이므로) `[추정]`
- **사망 패턴 3(보안 스캐너) 회피 확인**: 시크릿 스캐너가 아니다. 시크릿 유출은 결과의 한 사례일 뿐, 제품은 패턴 의미 불일치 발굴기다. 단 **`publint` / `npm pack --dry-run`이 "무엇이 발행되나"는 이미 알려주므로, 그 한 축만으로 포지셔닝하면 중복이다** `[확인]`

**④ npm/PyPI 레지스트리 유사 패키지명 조회 (실행 결과)**

```
registry search "glob compare"              → 0건
registry search "gitignore test"            → 0건
registry search "ignore pattern diff"       → 0건
registry search "glob differential testing" → 0건
registry search "globstar semantics"        → 0건
```
`[확인]` 유사 패키지 0건.

**최종 판정: 유사 도구 0건. G8 통과.**

### 1-6. 2주 실현성 — **가능 (이 축에서 가장 안전)**

TS만으로 완결. **핵심 강점: 우리가 매처를 재구현하지 않고, 실제 구현체를 그대로 브라우저에서 실행한다.**

| 대상 | 브라우저에서 실제 구현 실행 가능? | 근거/방법 |
|---|:-:|---|
| minimatch / picomatch / micromatch | **○** | 순수 JS, 의존성 없음. import만 하면 끝 `[확인]` |
| `ignore` (gitignore 의미) | **○** | 순수 JS `[확인]` |
| tsc의 `include`/`exclude` | **○** | TypeScript는 순수 JS. `ts.parseJsonConfigFileContent`에 가상 fs 훅을 넣어 **진짜 tsc 판정**을 얻음 `[추정, 검증 필요]` |
| Prettier의 ignore | **○** | Prettier는 브라우저 standalone 배포 존재 `[확인]` |
| Biome | **○** | `@biomejs/wasm-web` **기성 WASM 패키지** (우리가 빌드하지 않음 — 제약 준수) `[확인]` |
| tinyglobby / fast-glob / globby | **○(매칭 코어)** | 매칭은 picomatch/micromatch에 위임. 순회부만 node fs 의존 `[확인]` |
| ESLint | **△** | `@eslint/config-array` 계열이 node fs에 의존. `memfs`(순수 JS) 셰임으로 우회 시도 → 실패 시 **규칙 재구현 + 근거 문서 링크**로 대체 `[추정]` |
| npm packlist / Docker | **△** | `ignore-walk`는 node fs 의존, Docker patternmatcher는 Go. **규칙 재구현 + 스펙 링크 병기**로 처리하고 화면에 "재구현" 배지를 명시 표기 `[추정]` |

**미지 요소 2개 (크리티컬 패스)**
1. tsc `parseJsonConfigFileContent`를 브라우저 가상 fs로 구동 — 실패 시 tsc를 매트릭스에서 빼도 데모는 성립. **치명적 아님**
2. ESLint 실구현 브라우저 구동 — 실패 시 재구현 대체. **치명적 아님**
→ **두 미지 요소 모두 실패해도 후보가 죽지 않는다.** 이것이 후보 2와 결정적으로 다른 점이다.

**공수 배분 `[추정]`**: 매처 어댑터 계층 35h / File System Access + 설정 파서 30h / 히트맵 UI 50h / 차등 퍼저 + 원인 분류 + 최소화 40h / 코퍼스·문서·업스트림 이슈 30h / 시연영상·보고서 25h = **210h** (가용 170~250h 내)

### 1-7. 우리 대표 저장소에 남는 것

- `packages/core` — 매처 어댑터 통일 인터페이스 + 차등 판정 엔진 (npm 배포, Node/브라우저 양용)
- `packages/fuzz` — 패턴 생성기 + 불일치 최소화(delta) + 원인 분류기
- `apps/web` — 정적 사이트 (GitHub Pages, 서버 0)
- **`corpus/` — 최소화된 불일치 사례 코퍼스**. 이게 핵심 자산이다. `05-idea-scoring.md`에서 확인한 대로 2026 필드 상위권(`capnet`의 골든셋 40장)이 이미 골든셋을 저장소에 넣고 있다. 우리는 **자동 발굴된 수천 건 규모**로 그 위를 간다
- `docs/rules.md` — 6가지 규칙 차이의 근거 링크 표 (스펙 인용 포함)
- `upstream/` — 코퍼스에서 도출한 업스트림 이슈·PR 기록 (출품작이 아니라 **파급력 증거**로만 사용)

### 1-8. 정량 지표 (발표 슬라이드용)

| 지표 | 값 | 출처 |
|---|---|---|
| 영향 생태계 규모 | **주간 20억 다운로드** (매처 8종 합계) | npm registry API 실측 `[확인]` |
| 교차 검증 도구 | **기존 0건 → 1건** | gh/npm 검색 5종 전부 0건 `[확인]` |
| 실제 구현 교차 실행 수 | 8종 (그중 실구현 6종 이상) | §1-6 |
| 데모 판정 처리량 | 32,960 판정 / 0.41초 | `[추정, 구현 후 실측]` |
| 퍼저 발굴량 | 패턴 20만 / 불일치 3.4만 / 6초 | `[추정, 구현 후 실측]` |
| 저장소 자산 | 최소화 불일치 코퍼스 1,000건 이상 | `[추정]` |
| 서버 비용 | **0원 / 요청 0건** | 정적 배포 `[확인]` |

### 1-9. 수명 — **3년 뒤에도 있다. 오히려 악화된다**
`[확인]` 신규 매처가 계속 등장한다: `tinyglobby`(2024~, 이미 주간 1.3억으로 fast-glob 추월), Biome·Oxc·rolldown 등 신세대 툴체인이 각자 매처를 들고 온다. **구현 수가 늘어나는 방향이므로 불일치는 증가한다.** 전환기 수요에 기대는 후보가 아니다.

### 1-10. 커뮤니티 접점
`[확인]` 조직화된 상대가 명확하다: minimatch/glob (isaacs, npm 생태계 코어) · picomatch/micromatch (jonschlinkert) · ESLint 팀 (#16264가 열려 있음) · Biome · Vite/tinyglobby (SuperchupuDev) · git 문서 · Docker. 코퍼스에서 나온 불일치는 **각 저장소에 곧바로 제출 가능한 형태**이므로, 결과보고서에 "실제 업스트림 반영" 항목을 채울 경로가 있다.

### 1-11. 착수 첫 3일 (성공 기준 포함)
1. **D1**: minimatch·picomatch·micromatch·`ignore` 4종을 브라우저에서 동시 로드해 동일 패턴에 대해 서로 다른 답을 내는 사례를 **손으로 최소 1건** 확보 → 검증: 스크린샷 1장
2. **D2**: 무작위 패턴 생성기 + 차등 판정 루프 → 검증: **10초 안에 서로 다른 원인 3종 이상의 불일치를 자동 발굴**
3. **D3**: File System Access API로 실제 프로젝트 폴더를 읽어 파일×도구 히트맵 1차 렌더 → 검증: **우리 저장소 자체에서 빨간 셀 1개 이상 발견**
→ D3까지 빨간 셀이 안 나오면 후보 2로 전환한다.

---

## 2. 후보 2 — `schedhunt` (조건부 / 보험)

### 2-1. 한 문장 정의
**한 줄도 고치지 않은 당신의 async/await 코드를 브라우저에 붙이면, 가능한 실행 순서를 대신 전수 탐색해 버그를 찾아 최소 재현 링크로 돌려주는 도구.**

### 2-2. "우와" 체크리스트 — **5/5 (이 축 최고)**

| # | 판정 | 근거 |
|:-:|:-:|---|
| 1 | ◎ | "테스트를 1만 번 돌려도 안 나오는 버그를 0.4초에 찾았습니다" — 좌우 2패널 대조로 즉시 이해 |
| 2 | ○ | 브라우저 완결. 심사위원이 자기 코드 붙여넣기 가능. 반례 스케줄을 URL에 인코딩 → **링크를 열면 그 버그가 100% 재현** |
| 3 | ◎ | 랜덤 스트레스 10,000회 = 발견 0건 vs 체계적 탐색 0.4초 = 발견 1건 + 7스텝 최소화 |
| 4 | ◎ | "JS는 싱글스레드라 race가 없다"는 통념을 정면으로 깨는 반전 서사 |
| 5 | ◎ | 두 async 흐름이 교차하는 타임라인 애니메이션 + 탐색 카운터 |

### 2-3. G8 반증 로그 — ★ **여기가 문제다**

**① 웹 검색**
- (EN) "JavaScript async race condition detector systematic concurrency testing tool" → **NodeRacer**(학술, Node 전용, 환경 계측 필요), **JS-TOD**(순서 의존 flaky, 별개)
- (EN) "deterministic scheduler promise interleaving explore bug TypeScript library" → 학술 논문(delay-bounded scheduling)만
- (KO) "자바스크립트 비동기 경쟁 조건 재현 테스트 도구 스케줄러" → 전용 도구 정보 **없음** (블로그 설명글만)

**② `gh search repos` — 결정적 발견**
```
gh search repos "systematic concurrency" →
   barrucadu/dejafu ★201 (Haskell) / JetBrains/lincheck ★691 (Kotlin)
   coyote-scheduler (C++) / jtool-sct (Java)   ← 즉 다른 언어에는 전부 있고 JS에만 없다
gh search repos "concurrency testing" --language typescript →
   hasnainkhatri87/raceproof ★1   ← ★★ 동형 도구
   gaurav-kalal18/RaceHunter ★0  (실은 Express+Prisma 백엔드 벤치마크. 무관)
```

`[확인]` **`hasnainkhatri87/raceproof` (생성 2026-07-16, 한 달 전, MIT, TypeScript)**
https://github.com/hasnainkhatri87/raceproof — README 인용:
> "**Explore the timelines your tests never run.** … deterministic, bounded concurrency-testing tool for TypeScript … returns a minimized, replayable counterexample … **Static React/Vite interface that performs all work locally in a Web Worker**"
기능 목록에 **BFS/DFS/시드 랜덤 탐색, 중복 상태 제거, delta debugging 최소화, Vitest 회귀 테스트 생성, Web Worker 브라우저 워크벤치, 30초 데모 영상**까지 이미 있다.
→ **우리가 그리던 데모와 거의 동일하다.** 심사위원이 5분만 검색하면 찾는다.

`[확인]` `fast-check`의 `fc.scheduler()` — 공식 문서에 "Race conditions" 전용 섹션 + 튜토리얼
https://fast-check.dev/docs/advanced/race-conditions/ — 확인 결과: **수동 계측 필요**(`schedule()`/`scheduleFunction()`으로 감싸야 함), **탐색은 무작위**, **최소화 없음**, **시각화 없음**, 공식 문서가 "fetch나 외부 이벤트 이미터는 자동 제어 불가"라고 명시.

`[확인]` `glideapps/determined` (npm `determined`, 0.4.1, 2026-07 갱신, ★1)
https://github.com/glideapps/determined — TS용 DST 프레임워크. 확인 결과: **자체 프리미티브(`checkpoint`/`failpoint`/`blockpoint`/`Mutex`) 사용 필수**, 시드 랜덤, 최소화 없음, Node 전용.

**③ 상위 도구의 로드맵**
- `gh search issues --repo dubzzz/fast-check "scheduler"` → #4485/#4486(waitFor·waitAll 개선), #5819(마이크로태스크 제어 개선, closed). **자동 계측 계획은 없음** `[확인]`
- `gh search issues --repo vitest-dev/vitest "race condition"` → 나온 것은 전부 **Vitest 자신의 flaky 버그**(#9635, #8339, #7871…). 인터리빙 탐색 기능 계획 없음 `[확인]`

**④ npm**
- `determined` `[확인]` / `@sx4im/chronos-core`(DST 코어) `[확인]` / `replicafuzz`(0.1.0-alpha.2, 2026-07-15, "Falsify multi-client browser convergence with seeded schedules and minimized replay" — CRDT/동기화 수렴 축) `[확인]`

**판정**
- 넓은 범주("JS 비동기 동시성 테스팅") **인접 도구 5건 → 팀 규칙(3건 이상) 엄격 적용 시 탈락**
- 좁은 범주("**코드 무수정 자동 계측** + 경계 완전탐색") **0건** — RaceProof·`determined`는 **모델/프리미티브를 새로 기술해야 하고**, fast-check는 **호출부를 감싸야 한다**. 실제 async/await 코드를 그대로 받는 것은 아직 없다. (Kotlin 생태계에서 TLA+ 모델 검사와 Lincheck 코드 검사가 공존하는 것과 같은 구분)
- **그러나 발표 임팩트가 1순위인 이번 라운드에서, "심사위원이 검색하면 나오는 ★1 동형 저장소"는 우와를 무력화하는 치명적 리스크다.** 발표에서 fast-check와 RaceProof를 먼저 명시하고 "저들은 모델을 새로 써야 합니다, 우리는 당신 코드를 붙이면 됩니다"로 선점 방어해야만 성립한다.

### 2-4. 2주 실현성 — **가능하나 미지 요소 3개**
순수 TS. 핵심 기법: `@babel/standalone`(순수 JS, 브라우저 동작 `[확인]`)으로 `async function`→`function*`, `await e`→`yield e` 변환 후, **우리 드라이버가 코루틴을 한 스텝씩 구동** → 스케줄 완전 제어. TS는 `@babel/preset-typescript`로 타입 제거.
1. **미지①** async generator / `for await` / 클래스 메서드 / 네이티브 `Promise.all` 조합의 변환 정확도 → 대응: 지원 부분집합을 명시하고 미지원 구문은 경고
2. **미지②** `fetch`·타이머·이벤트 이미터 모델링 범위 → 대응: 화이트리스트 방식
3. **미지③** 상태공간 폭발 → 대응: preemption bound(PCT/delay-bounded) + 반복 심화
→ **후보 1과 달리 미지 요소가 크리티컬 패스에 있다.** 미지①이 깨지면 제품이 성립하지 않는다.

### 2-5. 나머지 항목 (요약)
- **저장소에 남는 것**: `core`(스케줄러+변환기, npm 배포) / `web`(정적 플레이그라운드) / **`corpus`(실제 OSS·AI 생성 코드에서 발굴한 race 사례집)**
- **정량 지표**: "다른 언어 5개(Haskell dejafu·Kotlin Lincheck·Rust loom·C# Coyote·Java jtool-sct)에는 있고 JS에는 없던 것" / "랜덤 1만회 0건 vs 0.4초 1건" / "AI 코딩 에이전트 생성 async 코드 N개 중 X%에서 race 발견" ← 이 조사 자체가 강한 슬라이드가 된다 `[추정]`
- **수명**: 영구. async/await는 사라지지 않는다
- **커뮤니티 접점**: fast-check, Vitest, TC39, DST 커뮤니티(TigerBeetle·Antithesis 담론). 단 **fast-check 플러그인 형태로 만들면 사망 패턴 2(호스트가 내장)에 걸린다 → 독립 도구여야 한다**

---

## 3. 후보 3 — **없음**

우와 체크리스트 3개 이상을 충족하면서 G8을 통과하는 세 번째 후보를 찾지 못했다. 억지로 올리지 않는다.
탐색한 12건의 사망 원인은 §4에 전부 기록했다.

---

## 4. 탈락 후보 기록 (재조사 비용 절감용)

| 후보 | 우와 | 탈락 사유 | 근거 URL / 명령 |
|---|:-:|---|---|
| **브라우저 RLS 정책 전수 검증기** (PGlite로 역할×행 조합 폭격, 히트맵) | 5/5 | **G8 HIT — 유사 3건 이상.** `pgrls`(정적 분석기, 67 룰, policy-diff, pytest 플러그인), `matte97p/rlsgrid`(★7, cross-tenant 퍼저), Atlas RLS 테스팅, Supabase Security Advisor 내장 | https://github.com/pgrls/pgrls · https://github.com/matte97p/rlsgrid · https://atlasgo.io/faq/testing-rls |
| **브라우저 최소 재현 축소기** (1,842줄→9줄 실시간 애니메이션) | 5/5 | **G8 HIT — 유사 4건 이상.** C-Reduce(★1668), `DRMacIver/shrinkray`(★378, 2026-07 활성, 멀티포맷), `uw-pluverse/perses`(★210, 2026-08 활성, 언어 무관), `comby-reducer`(★77), npm `jsdelta` | `gh search repos "program reducer" / "shrinkray"` · https://github.com/DRMacIver/shrinkray |
| **ReDoS 실시간 백트래킹 시각화 + 공격 문자열 자동 생성** | 5/5 | **G8 HIT — 유사 5건.** `recheck`, `eslint-plugin-redos`, `redos-detector`(TS), `regexploit`, `safe-regex`, `vuln-regex-detector`. 사망 패턴 3 | `[확인]` 다수 존재 |
| **TS 타입 에러 자동 축소·해독기** (320줄 에러 → 원인 3줄) | 4/5 | **G8 HIT — 유사 3건 이상.** `pretty-ts-errors`(VSCode, 초유명), `ts-error-translator`(웹+VSCode), Total TypeScript 계열 | `[확인]` |
| **JSON Schema / Markdown 구현 차등 퍼저** | 4/5 | **사망 패턴 1.** 공식 컨포먼스 스위트가 이미 지배 — JSON-Schema-Test-Suite, CommonMark spec tests + **babelmark3**(다중 마크다운 구현 비교 웹도구가 이미 존재) | `[확인]` |
| **URL / YAML / JSON 파서 차등** | 3/5 | **사망 패턴 1.** WHATWG URL 테스트 스위트, yaml-test-suite, JSONTestSuite 공식 존재 | `[확인]` |
| **SQL 엔진 차등 실행기** (PGlite+sql.js+duckdb-wasm 3패널) | 4/5 | **G8 HIT.** `sqllogictest`(공식 스위트), `SQLancer`(논리 버그 차등 퍼저) 존재 | `[확인]` |
| **모듈 해석(export map) 런타임별 차등** | 4/5 | **G8 HIT.** `arethetypeswrong.github.io`(브라우저 완결, 다중 resolution 모드 검사) + `publint`가 이미 정확히 이것 | https://arethetypeswrong.github.io |
| **TS 타입 성능 병목 브라우저 프로파일러** | 3/5 | **사망 패턴 2.** 공식 `tsc --generateTrace` + `@typescript/analyze-trace` + Perfetto 뷰어가 이미 내장 경로 | `[확인]` |
| **레이아웃 깨짐 조합 폭격기** (뷰포트×폰트×언어 수천 조합) | 4/5 | **G8 HIT 3건 이상**(Percy, Chromatic, BackstopJS) + **체험성 결함**: X-Frame-Options로 심사위원 자기 사이트 로드 불가 | `[확인]` |
| **브라우저 모델 검사기 (TS로 쓴 명세)** | 4/5 | **G8 HIT.** npm `tla-checker`(WASM TLA+ 모델 검사기), npm `tla-precheck`("TS로 상태 머신 쓰면 TLA+로 증명"), `will62794/spectacle`(JS TLA+ 인터프리터+상태그래프 시각화) | `registry.npmjs.org` 검색 `[확인]` |
| **CRDT / 로컬퍼스트 동기화 수렴 폭격기** (8패널 라이브 편집) | 5/5 | **G8 HIT.** npm `replicafuzz` 0.1.0-alpha.2 (2026-07-15) — "Falsify multi-client browser convergence with seeded schedules and minimized replay". 정확히 동일 축 + 각 CRDT 라이브러리가 자체 fuzz 보유 | https://github.com/Atomics-hub/replicafuzz `[확인]` |
| **Web Serial 기반 브라우저 펌웨어 도구** | 4/5 | **G8 HIT** (`esptool-js` 공식, Adafruit WebSerial ESPTool, Improv WiFi, Wokwi) + **체험 조건 위반**(하드웨어 필요) + 팀 제약(저수준) | `[확인]` |
| **P2P 개발 서버 터널 / 브라우저 분산 빌드** | 4/5 | **인프라 0 위반** — WebRTC 시그널링 서버 필수 | `[추정]` |

### 4-1. 이번 라운드에서 갱신된 사망 패턴 (기존 5개에 추가)

6. **"브라우저로 옮기면 좋은 것"은 이미 옮겨져 있다.** 컴파일러·DB·프로파일러·AST·모듈해석·모델검사 전부 브라우저판 존재. "브라우저에서 된다"는 그 자체로는 차별점이 아니다. **"브라우저에서 되는데 아무도 안 했다"를 검색으로 증명해야 후보가 된다.**
7. **★0~1 저장소가 가장 위험하다.** 이번에 두 후보를 죽인 `raceproof`(★1), `replicafuzz`(alpha)는 스타가 거의 없어 일반 검색에 안 걸린다. **`gh search repos "<축 이름>" --language typescript`와 npm registry 전문 검색을 반드시 병행할 것.** 스타 수로 걸러내면 놓친다.
8. **"우와" 상위 후보는 서로 같은 곳으로 수렴한다.** 이번 12건 중 우와 5/5를 받은 4건(RLS·축소기·CRDT·동시성)이 전부 "**조합 폭발을 자동 탐색해 반례를 최소화한다**"는 동일 골격이었고, 그래서 전부 같은 방식으로 이미 점유돼 있었다. **골격이 매력적일수록 점유 확률이 높다.**

---

## 5. 최종 권고

1. **`ignoregrid`(후보 1)로 간다.** 우와 4~5/5, G8 유사 도구 0건, 미지 요소 2개가 모두 비-크리티컬. D-10에서 이 조합이 유일하게 안전하다.
2. **D3 게이트를 반드시 지킨다** — 우리 저장소 자체에서 빨간 셀(불일치) 1개 이상이 안 나오면 즉시 후보 2로 전환.
3. **`schedhunt`(후보 2)는 보험으로만.** 채택 시 발표 첫 30초에 fast-check와 `raceproof`를 **먼저 언급하고** "저들은 모델을 새로 써야 한다"로 선점 방어하는 것이 필수 조건이다. 이 방어 없이는 우와가 무력화된다.
4. **후보 1의 설계 규칙 2개**: (a) git/bash를 "정답"으로 놓지 말 것(사망 패턴 1 접근) (b) 시크릿 유출 단일 축으로 포지셔닝하지 말 것(`publint`·`npm pack --dry-run`과 중복).
