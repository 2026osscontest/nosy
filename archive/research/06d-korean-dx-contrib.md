# 06d — 한국어 처리·국제화·접근성·개발자도구 생태계 빈 구멍 발굴

조사일: 2026-08-16 / 대상: 2026 오픈소스 개발자대회 (2~3인, 2주, 총 170~250h)

표기: `[확인]` = URL·명령으로 직접 검증함 / `[추정]` = 추론

---

## 0. 조사 방식과 G8 반증 원칙

직전 라운드 실패("빈틈인 줄 알았는데 이미 있었다")를 막기 위해 후보마다 아래 4단계를 강제했다.

1. 이슈 트래커 직접 검색 — `gh api search/issues`로 저장소별 open/closed 전수 조회
2. 한국어·영어 웹 검색
3. GitHub 저장소 검색 (한국어 키워드 `한글`, `초성`, `도로명주소`, `어절` 포함) + npm/crates.io 레지스트리 404 확인
4. **실물 재현** — 라이브러리를 실제 설치해 한국어 입력을 넣고 출력을 눈으로 확인

4번(실물 재현)이 이번 라운드의 핵심이다. 아래 1순위 후보는 "이슈가 없어서 빈틈 같다"가 아니라 **내가 직접 코드를 설치해 버그를 재현하고 원인 라인까지 특정**했다.

---

## 후보 1 (최유망) — 한글 줄바꿈(어절 단위 / `word-break: keep-all`)이 브라우저 밖 전 생태계에서 깨져 있음

### 1-1. 무엇이 문제인가

한국어는 어절(띄어쓰기) 단위로 줄을 바꾸는 것이 표준 조판이다. 그런데 **UAX#14(유니코드 줄바꿈 알고리즘)의 기본값은 한글 음절을 `ID` 클래스로 취급**해 음절마다 줄바꿈을 허용한다. UAX#14 자체가 "한국어 문서를 위해서는 Hangul을 `AL` 클래스로 tailoring해야 한다"고 명시한다 `[확인]`(https://unicode.org/reports/tr14/tr14-51.html).

웹 브라우저는 이 tailoring을 `word-break: keep-all`로 구현해 두었고, 한국 개발자들이 쓰는 사실상의 필수 CSS다. W3C i18n 문서도 "`word-break: normal`은 음절마다 끊고, `keep-all`이 공백 기준 줄바꿈을 달성한다"고 확인한다 `[확인]`(https://w3c.github.io/i18n-tests/results/word-break).

**그런데 브라우저 엔진 밖의 텍스트 레이아웃 스택에는 이 tailoring이 사실상 전무하다.** 결과적으로 OG 이미지, HTML→캔버스 스크린샷, PDF, 터미널 CLI, 조판 엔진에서 한국어가 단어 한가운데서 잘린다.

### 1-2. 실물 재현 결과 (직접 실행함)

**(A) `css-line-break` — 명백한 스펙 위반 버그, 원인 라인까지 특정** `[확인]`

설치 후 실행한 결과:

```
스크립트   옵션        출력
한글       normal    ["오","픈","소","스 ","개","발","자","대","회"]
한글       keep-all  ["오","픈","소","스 ","개","발","자","대","회"]   ← 무반응
中文       normal    ["开","源","开","发","者","大","赛"]
中文       keep-all  ["开源开发者大赛"]                                ← 정상 동작
日本語     keep-all  ["オー","プ","ン","ソー","ス"]                     ← 무반응
```

즉 **`keep-all`이 중국어에서는 동작하는데 한글에서는 완전히 무시된다.** 원인은 업스트림 `src/LineBreak.ts:555-560` `[확인]`(https://github.com/niklasvh/css-line-break/blob/master/src/LineBreak.ts#L555-L560):

```ts
const forbiddenBreakpoints =
    options.wordBreak === 'keep-all'
        ? isLetterNumber.map((letterNumber, i) => {
              return letterNumber && codePoints[i] >= 0x4e00 && codePoints[i] <= 0x9fff;
          })
        : undefined;
```

`0x4e00..0x9fff`는 **CJK 통합 한자(Han)만**이다. 한글 음절(U+AC00–U+D7A3), 한글 자모(U+1100–U+11FF), 호환 자모(U+3130–U+318F), 가나가 전부 빠져 있다. CSS Text Level 3의 `keep-all`은 "typographic letter unit" 전체에 적용되어야 하며 **한국어가 이 속성의 대표 유스케이스**인데도 그렇다.

> **이것이 "글로벌 메인테이너가 한국어를 몰라서" 생긴 갭의 교과서적 사례다.** 작성자는 CJK = 한자라고 생각하고 한자 범위를 하드코딩했다. 한국어를 아는 사람이면 30초 만에 알아볼 버그가 2018년부터 방치돼 있다.

**(B) `linebreak` (foliojs) — tailoring API 자체가 없음** `[확인]`

```
js linebreak: "오" | "픈" | "소" | "스 " | "개" | "발" | "자" | "대" | "회" | "에 " | ...
```
UAX#14 기본값만 구현하고 `keep-all` 상당 옵션이 없다. **Vercel `satori`가 이 패키지에 의존**한다 `[확인]`(satori 0.29.0 package.json dependencies에 `"linebreak": "^1.1.0"`).

**(C) Python `uniseg` — 동일** `[확인]`
```
['오','픈','소','스 ','개','발','자','대','회','에 ','참','가','합','니','다']
```

**(D) Rust `unicode-linebreak` — tailoring API 없음** `[확인]`(https://docs.rs/unicode-linebreak/latest/) — 공개 API가 `linebreaks(text)` 하나뿐이라 로케일/워드브레이크 옵션을 넣을 자리가 없다. 이 크레이트가 `textwrap`을 통해 Rust CLI 생태계 전반의 줄바꿈을 담당한다.

**(E) Typst — 3년간 미해결** `[확인]`(https://github.com/typst/typst/issues/1164) — "Word break keep all", 2023-05-10 개설, 2026-04-30까지 코멘트 14개, **담당자 없음**, 라벨 `feature request`/`text`. 별 55,477개짜리 프로젝트다. 결정적으로 이 스레드에서 Typst가 **icu4x `icu_segmenter`로 이미 전환했는데도(PR #1355) 한국어는 그대로 깨진다**는 것이 확인됐다.

**(F) ICU4X 본진도 미정립** `[확인]`(https://github.com/unicode-org/icu4x/issues/8047) — "Figure out how to do `LineBreakWordOption` correctly", 2026-06-08 개설, 담당자 없음, 본문에 "The current implementation is pretty hacky, and the spec itself is light on details."

→ **(E)+(F)는 "ICU4X로 갈아타면 해결된다"는 통념이 틀렸음을 증명한다.** 이건 우리 결과보고서의 핵심 논거가 된다.

### 1-3. 파급력 (실측)

| 대상 | npm 월 다운로드 | GitHub 의존 저장소 수 | 상태 |
|---|---|---|---|
| `css-line-break` | **66,494,369** | **307,063** | keep-all 한글 미적용 (버그) |
| `html2canvas` (→css-line-break) | **67,295,940** | **340,522** | 상동 (전이) |
| `linebreak` (foliojs) | **51,617,018** | **155,301** | tailoring 부재 |
| `satori` (→linebreak) | **15,912,964** | **45,858** | Next.js OG 이미지 |
| `unicode-linebreak` (crates.io) | 20,613,288 (최근) | revdeps 58 | tailoring 부재 |
| `textwrap` (crates.io) | 50,660,351 (최근) | **revdeps 698** | 상동 (전이) |
| `typst` | — | stars 55,477 | #1164 3년 미해결 |

`[확인]` — npm registry API, crates.io API, GitHub dependents 페이지에서 2026-08-16 직접 조회.

**파급력이 큰 곳의 작은 수정**이라는 기준에 정확히 부합한다. css-line-break 수정은 사실상 코드 4~6줄이다.

### 1-4. 반증 시도 기록 (G8)

| 검색 방법 | 검색어 | 결과 |
|---|---|---|
| npm registry 직접 조회 | `korean-linebreak`, `hangul-linebreak`, `keep-all-linebreak`, `hangul-wrap` | **전부 HTTP 404** `[확인]` |
| GitHub repo 검색 | `hangul linebreak`, `korean wordwrap`, `korean line breaking`, `keep-all hangul`, `한글 줄바꿈 라이브러리`, `korean text wrapping 어절` | 유의미한 결과 0건. `google/budou`(아카이브·CJK 전반·한국어 모델 없음), `subsoap/wraptext`(★7)만 근접 `[확인]` |
| GitHub org 검색 | `org:toss linebreak`, `org:naver hangul`, `org:kakao hangul` | 0건 (kakao/khaiii는 형태소 분석기로 무관) `[확인]` |
| BudouX 한국어 모델 | `gh api repos/google/budoux/contents/budoux/models` | `ja, ja_knbc, th, zh-hans, zh-hant` — **한국어 모델 없음**. 이슈 #701은 "keep-all 쓰라"는 잠정 안내로 종결 `[확인]` |
| 이슈 트래커 | `repo:foliojs/linebreak is:issue korean`, `repo:niklasvh/html2canvas is:issue korean line break` | **0건 — 아무도 신고조차 안 했다** `[확인]` |
| 이슈 트래커 | `repo:vercel/satori is:issue korean` | #414(2023, closed)만. 진행 중인 #687/#743은 ICU4X 전환 제안이며 (E)에 의해 한국어를 해결하지 못함 `[확인]` |

**반증 통과.** 이 문제를 다루는 라이브러리가 어느 생태계에도 없다.

### 1-5. 왜 아직 비어 있는가

- css-line-break: 2018년부터 한자 범위 하드코딩. **관련 이슈 신고 0건** — 한국인 사용자가 원인을 라이브러리로 역추적하지 못했다.
- linebreak/uniseg/unicode-linebreak: UAX#14 "기본값"을 충실히 구현한 것이고, tailoring이 필요하다는 사실 자체가 한국어 도메인 지식이다.
- Typst: 한국인 기여자(RanolP)가 3년째 접근했으나 `overflow-wrap` 아키텍처 문제에 막혀 미착지.
- **핵심: 이 문제는 "라이브러리 버그"가 아니라 "한국어를 아는 사람만 보이는 결함"이다.** 진입장벽이 남에게만 높다는 이 방향의 구조적 강점이 그대로 적용된다.

### 1-6. 출품작 성립 여부 ★

업스트림 PR만으로는 출품작이 안 된다는 제약을 충족하는 구성:

**우리 저장소에 남는 것 (대표 저장소 1개):**

1. **`hangul-linebreak` 코어 라이브러리** — UAX#14 + KS X 1026 기반 한글 tailoring 구현. TypeScript(주) + Rust/Python 포팅. 의존성 최소.
2. **한글 줄바꿈 적합성 테스트 코퍼스** — 어절/복합명사/괄호·따옴표/숫자+단위/한영혼용/URL/자모 NFD 등 카테고리별 케이스와 기대 분절 위치를 담은 언어중립 JSON 코퍼스. **이게 진짜 자산이다.** 어느 언어의 어느 라이브러리든 이 코퍼스로 검증할 수 있다.
3. **크로스 라이브러리 검증기(CLI)** — 동일 한국어 문단을 N개 라이브러리에 통과시키고, **헤드리스 Chrome의 `word-break: keep-all` 렌더 결과를 정답(oracle)으로 삼아** diff·점수표를 출력. 이게 정량 지표를 자동 생성한다.
4. **업스트림 PR 묶음** — css-line-break, satori, uniseg, textwrap, typst 대상. 병합 여부와 무관하게 "실물 반증된 버그 + 재현 코드 + 패치"라는 근거가 남는다.

**메인테이너 비활성 리스크 대응**: css-line-break는 2023-09-27 이후 push가 없고 open issue 14개다 `[확인]`. PR이 안 병합될 수 있다. → 그래서 **1~3번이 본체이고 PR은 보너스**로 설계했다. 심사에서 "업스트림에 못 넣었네"가 감점이 되지 않는 구조다.

### 1-7. 시연 가능성 (3분 영상) ★★

before/after 화면이 4개 나온다. 전부 "깨지던 것이 고쳐지는" 그림이다.

1. **OG 이미지**: satori로 한국어 제목 OG 이미지 생성 → 단어 중간에서 잘림 → 패치 후 어절 단위로 정렬 (좌우 분할 화면)
2. **html2canvas 스크린샷**: `word-break: keep-all`이 걸린 실제 한국어 페이지를 캡처 → 원본 페이지와 캡처 결과가 다름 → 패치 후 일치
3. **터미널 CLI**: Rust `clap` 기반 CLI의 한국어 도움말이 어절 중간에서 잘림 → 패치 후 정상
4. **검증기 대시보드**: 라이브러리 6종 × 코퍼스 케이스의 정확도 표가 빨강→초록으로 바뀌는 화면

특히 2번은 "브라우저에서는 멀쩡한데 캡처하면 깨진다"는 대비가 즉각적으로 이해된다.

### 1-8. 정량 지표

- 코퍼스 케이스 수 (목표 300+), 카테고리 수
- 라이브러리별 정확도: 브라우저 oracle 대비 분절 위치 일치율 (%). 패치 전/후 비교
- 고친 케이스 수 (라이브러리 × 케이스)
- 영향받는 다운스트림: **의존 저장소 합계 848,000+** (css-line-break 307,063 + html2canvas 340,522 + linebreak 155,301 + satori 45,858) `[확인]`
- 월 다운로드 합계 **2억+** `[확인]`

### 1-9. 2주 실현성

총 170~250h. 언어는 TypeScript 주력 + Rust/Python 얇은 포팅. 빌드·테스트는 npm/vitest, cargo test, pytest. 재현 환경은 이미 내가 셋업해 검증을 마쳤으므로 착수 비용이 낮다.

- 코어 tailoring 알고리즘: UAX#14 클래스 테이블 위에 한글 범위 재분류 + 금칙 처리. 난이도 중.
- 리스크: 복합명사 내부 분절(공백 없는 긴 한국어 단어)은 사전/ML이 필요해 **범위 밖으로 명시적으로 제외**한다. `keep-all` 상당까지만 한다. Typst #1164 스레드에서 peng1999가 "완벽을 좋은 것의 적으로 만들지 말자"고 한 것과 동일한 판단이다 `[확인]`.
- 리스크: overflow(한 줄에 안 들어가는 긴 어절) 처리 → `overflow-wrap: break-word` 상당 fallback을 옵션으로 제공.

### 1-10. 착수 첫 3일 계획 ★

**Day 1 — 정답(oracle) 확보와 코퍼스 골격**
- 오전: Playwright + 헤드리스 Chrome으로 "임의 한국어 문단 + `word-break: keep-all` + 지정 폭"을 렌더하고 **실제 줄바꿈 위치를 추출하는 하니스** 작성. (`Range.getClientRects()`로 줄 경계 좌표를 뽑아 문자 오프셋으로 환산)
  - 검증: 알려진 문장 5개에 대해 사람이 눈으로 센 어절 경계와 하니스 출력이 일치
- 오후: 코퍼스 스키마 확정(JSON: `text`, `expectedBreaks`, `category`, `source`) + 카테고리 8종 정의 + 시드 케이스 40개 작성
  - 검증: 40개 전부 oracle 하니스를 통과해 `expectedBreaks`가 자동 채워짐
- 산출: 저장소 초기화, CI(GitHub Actions) 스켈레톤

**Day 2 — 현황 측정기(검증기 v0)로 "얼마나 깨졌는지"를 수치화**
- 오전: 어댑터 레이어 작성 — `css-line-break`, `linebreak`, `uniseg`, `unicode-linebreak`, `satori`(간접), 브라우저(oracle)를 동일 인터페이스로 감싸기
  - 검증: 6개 어댑터가 모두 같은 형식(분절 인덱스 배열)을 반환
- 오후: 코퍼스 × 어댑터 매트릭스를 돌려 **정확도 표 최초 생성**. 이 숫자가 결과보고서의 "before"가 된다.
  - 검증: css-line-break `keep-all` 한글 정확도가 0%에 수렴하는 것이 표로 재현됨 (오늘 수동 확인한 결과와 일치해야 함)
- 산출: `RESULTS.md` 초판 — 이 시점에 이미 "발견" 자체가 보고 가능한 성과

**Day 3 — 코어 tailoring 최소 구현 + 첫 업스트림 패치**
- 오전: `hangul-linebreak` 코어 — UAX#14 클래스 테이블에서 한글 음절/자모/호환자모를 `AL`로 재매핑하는 tailoring 함수 + 공백 기반 분절
  - 검증: 코퍼스 기본 카테고리(어절, 한영혼용) 정확도 90% 이상
- 오후: `css-line-break` 패치 작성 — `LineBreak.ts:555-560`의 하드코딩 범위를 한글/가나 포함으로 확장. 업스트림 테스트 스위트 통과 확인 후 PR 초안 + 재현 코드 첨부
  - 검증: 기존 중국어 테스트 회귀 없음 + 한글 케이스 신규 통과
- 산출: 첫 PR 제출, 시연 영상용 before/after 클립 1개 확보

---

## 후보 2 — ICU4X 한글 정렬·검색 콜레이션 (초성 검색 포함)

**대상**: `unicode-org/icu4x`
- **#6600** "Inconsistent comparison of Korean syllables vs individual jamo" `[확인]`(https://github.com/unicode-org/icu4x/issues/6600) — 2025-05-15 개설, **담당자 없음**, 라벨 `C-collator`/`investigate`. 재현 코드가 이슈 본문에 있다: primary strength에서 `이`vs`ㅇㅣ`는 equal인데 `일`vs`ㅇㅣㄹ`, `읽`vs`ㅇㅣㄹㄱ`은 greater. 받침 유무에 따라 결과가 달라지는 명백한 비일관성.
- **#1941** "Figure out what to do about Korean search collations" `[확인]`(https://github.com/unicode-org/icu4x/issues/1941) — 2022-05-25 개설, **마지막 업데이트 2022-05-30 (4년 정체)**, assignee hsivonen, 라벨 `S-medium`. 한국어 검색 콜레이션(초성 검색의 표준 기반)이 ICU4X에 미구현.

**왜 비어 있는가**: 콜레이션 담당자가 한국어 정렬 관례(자모 분해 검색, 받침 처리)를 판단할 수 없어 "figure out"에서 멈췄다. 전형적인 언어 도메인 지식 병목. `[확인]` 이슈 제목·본문이 그 자체로 증거.

**파급력**: ICU4X는 Firefox·Chrome·Android가 채택. 매우 큼. `[확인]`(satori #743 본문 인용)

**출품작 성립**: 우리 저장소에 "한글 콜레이션 적합성 테스트 스위트 + CLDR `ko` 정렬 규칙 검증기"를 남길 수 있다. 다만 **본체 수정이 Rust 콜레이션 내부라 난이도가 매우 높고, Unicode Consortium의 PR 수용 기준이 엄격**하다.

**시연**: 정렬 결과 표 before/after. 후보 1의 시각적 임팩트에 크게 못 미친다.

**판정: 2순위.** 위상은 최고급이지만 2주 안에 "고쳐진 화면"을 만들 확률이 낮다. **다만 후보 1의 코퍼스 접근법을 그대로 적용해 "한글 콜레이션 테스트 스위트 + 버그 리포트"만 내는 축소판은 후보 1의 보조 트랙으로 붙일 수 있다.**

---

## 후보 3 — axe-core: CJK 문장부호 정규화 누락으로 한국어 페이지 오탐

**대상**: `dequelabs/axe-core` **#5308** `[확인]`(https://github.com/dequelabs/axe-core/issues/5308)
- 2026-08-15 개설(**어제**), 라벨 `ungroomed`, 코멘트 0, 담당자 없음
- 내용: `label-content-name-mismatch` 룰의 `getPunctuationRegExp()`가 ASCII/라틴 문장부호만 다뤄 CJK 문장부호(U+3000–U+303F)와 전각 형태(U+FF01–U+FF65)를 제거하지 못함 → **영어에서는 통과하는 동일 패턴이 한국어/중국어/일본어 페이지에서는 실패(오탐)**. WCAG 2.5.3 Level A 룰.

**왜 비어 있는가**: 정규식에 라틴 문장부호만 넣은 전형적 서구 기본값. axe-core 4.10.3부터 재현되는 장기 결함.

**파급력**: axe-core는 웹 접근성 자동검사의 사실상 표준(Lighthouse, Playwright, Cypress, 각종 CI에 내장). 매우 큼.

**2주 실현성**: 높음. 정규식 확장 + 테스트. 다만 **작업량이 너무 작아 단독 출품작이 못 된다** (반나절 분량).

**KWCAG 룰셋 관련 반증** `[확인]`:
- npm `axe-kwcag`, `kwcag`, `axe-core-korean`, `a11y-kwcag` → **전부 404**
- GitHub `KWCAG` 검색 결과 14개 중 대부분 학습용/개인 연습장. 실질 경쟁자는 `Daegu-Cyber-University/ModuWeb`(★11, 접근성 위젯으로 성격 다름), `IsaacEryn/a11ychk`(★3, 2026-08-12 push, 서비스형), `resistan/aak`(★0)
- → **"axe-core 위에 얹는 KWCAG 2.2 룰셋 플러그인"은 실제로 비어 있다.** 다만 KWCAG 33개 검사항목 중 상당수가 WCAG와 중복이라 **순수 한국 고유 룰이 얼마나 되는지 별도 검증이 필요**하다. 이 검증 없이는 "룰셋 기여" 규모를 주장할 수 없다.

**판정: 3순위.** #5308은 후보 1의 곁다리 PR로 껴 넣기 좋다(같은 "서구 기본값이 CJK를 빠뜨림" 서사). KWCAG 룰셋은 단독으로 가려면 중복도 조사가 선행돼야 한다.

---

## 후보 4 — TUI/터미널의 한글 폭·NFD 렌더링

**대상**: `ratatui/ratatui` **#1396** "Korean characters are not rendered correctly" `[확인]`(https://github.com/ratatui/ratatui/issues/1396)
- 2024-10-02 개설, **22개월 미해결**, 라벨 `Type: Bug`, **담당자 없음**, 연결된 PR 없음
- 원인이 코멘트에서 이미 특정됨: crossterm 백엔드의 `draw()`가 커서 이동을 문자 폭이 아니라 **하드코딩 `1`**로 처리 `[확인]`(joshka/sxyazi 2024-10-03 코멘트)
- 관련: #1745(중국어, 2025-03 미해결), #1271(unicode 폭 계산, 2024-08 미해결), #2526(더블폭 글리프 경계, 2026-05 미해결)

**파급력** `[확인]`: ratatui 누적 44,122,789 다운로드 / **crates.io 역의존 5,375개**. yazi, gitui, bottom, atuin 등 인기 TUI가 전부 여기 위에 있다.

**NFD 관련 실측 결과 (중요한 부정 결과)** `[확인]`: macOS NFD 한글이 폭 계산을 깨뜨린다는 가설을 검증했으나 **Python `wcwidth` 0.8.2와 Node `string-width` 모두 NFD `가나다라마`를 정확히 10으로 계산**했다(`U+1160–U+11FF`를 0폭 처리). 즉 **"NFD 폭 계산이 범생태계적으로 깨져 있다"는 가설은 반증됐다.** ratatui 문제는 폭 계산이 아니라 백엔드 커서 이동 로직이다.

**판정: 4순위.** 원인 진단이 이미 남에 의해 끝나 있어 "발견"의 지분이 없고, 수정 범위가 좁아 단독 출품작 규모에 못 미친다. 다만 **후보 1의 "터미널 시연"과 결합하면 좋은 보조 소재**다.

---

## 탈락 후보 (반증에서 사망)

| 후보 | 탈락 사유 | 근거 |
|---|---|---|
| 한글 처리 JS 라이브러리 (자모 분해/조사/로마자) | **`toss/es-hangul`(★1,859)이 이미 점유.** Python/Go/Kotlin/Dart/Gleam/Java 포팅까지 존재 | `[확인]` GitHub `es-hangul` 검색 결과 10건 |
| 초성 검색 라이브러리 | es-hangul이 제공. 남은 갭은 ICU4X 내부(후보 2)뿐 | `[확인]` `chosung korean search` 검색 결과 ★1 안드로이드 라이브러리 1건 |
| NCP/Naver Cloud Terraform provider | **공식 provider 존재.** 서드파티는 ★3 이하 방치 저장소들 | `[확인]` `naver cloud platform terraform provider` 검색 |
| macOS NFD 한글 폭 계산 갭 | **실측 반증.** wcwidth/string-width 모두 정상 | `[확인]` 직접 실행 (본문 후보 4 참조) |
| BudouX 한국어 모델 추가 | 모델은 실제로 없으나, **한국어는 띄어쓰기가 있어 ML 분절의 실익이 낮고** 구글이 #701에서 `keep-all` 권고로 종결. 후보 1이 상위호환 | `[확인]` https://github.com/google/budoux/issues/701 |
| MeiliSearch/Typesense 한국어 토크나이저 | MeiliSearch는 charabia로 한국어 지원 완료(#153 closed), Typesense는 로케일 하이라이트 이슈(#977/#978, 2023)만 잔존 — 규모 부족 | `[확인]` 각 저장소 이슈 검색 |
| Tantivy 한국어 토크나이저 | `lindera-tantivy`가 이미 존재 | `[확인]` https://github.com/lindera/lindera-tantivy |
| 도로명주소/사업자번호 검증 라이브러리 | `chrisryugj/gjdong`(★41)이 주소 정규화를 이미 하고 있고, 나머지는 파급력 실측이 불가능한 수준(★0~1). 대회 기준 "파급력"을 논증할 수 없음 | `[확인]` GitHub 한국어 키워드 검색 |
| Textual CJK IME (#6667, #5456, #5457) | 실재하는 미해결 버그이나 **Windows 전용 + 일본어 IME 중심**이라 한국 파급효과 논증이 약하고 재현 환경 구축 비용이 큼 | `[확인]` https://github.com/Textualize/textual/issues/6667 |
| pandoc/WeasyPrint/jsPDF 한글 폰트 | 미해결 이슈들이 폰트 임베딩·환경 문제로 라이브러리 결함이 아님 | `[확인]` 각 저장소 이슈 검색 |

---

## 최종 권고

**후보 1로 간다.** 근거:

1. **실물 반증을 통과한 유일한 후보** — 이슈가 없어서가 아니라, 내가 코드를 설치해 버그를 재현하고 업스트림 소스 라인(`LineBreak.ts:555-560`)까지 특정했다. "빈틈인 줄 알았는데 있었다"가 원천적으로 불가능하다.
2. **파급력 실측치가 압도적** — 의존 저장소 848,000+, 월 다운로드 2억+. "파급력이 큰 곳의 작은 수정"이라는 이상적 형태.
3. **출품작이 성립** — 코퍼스·검증기·코어 라이브러리가 우리 저장소에 남는다. 업스트림 병합 여부에 결과가 종속되지 않는다.
4. **시연이 강력** — before/after 화면이 4종. 특히 "브라우저에서는 멀쩡한데 캡처하면 깨진다"는 대비.
5. **한국 심사위원에게 직결** — 한국어 조판이라는, 심사위원 본인이 매일 겪는 문제다. 설명이 필요 없다.
6. **G8 안전** — Typst #1164(3년), ICU4X #8047이 증명하듯 공식 진영도 답을 못 냈고, ICU4X 전환으로도 해결되지 않는다는 반례(Typst)까지 확보했다.

**보조 트랙 권고**: axe-core #5308(후보 3)을 곁다리 PR로 포함. "서구 기본값이 CJK를 빠뜨린다"는 동일 서사를 접근성 영역까지 확장해 결과보고서의 주제 폭을 넓힌다. 비용은 반나절.
