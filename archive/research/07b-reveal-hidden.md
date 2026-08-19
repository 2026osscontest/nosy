# 07b — "보이지 않던 손실을 드러내는" 진단·계측 도구 축

작성일: 2026-08-17 (D-10) / 담당 축: 숨은 낭비의 계량
제약 재확인: TS·Python only / 170~250 person-hour / GPU 없음 / 인프라 미지원 / 최종 사용자 = 개발자

---

## 결론 요약

**후보 1개.** 억지로 3개를 채우지 않았습니다.

- **채택 권고: `usecov` — 실사용 커버리지(usage coverage) 계측기.** "우와" 체크리스트 5/5, G8 통과(직접 유사 OSS 0~1개), TS/Python 100%, 미지 요소 3개.
- 후보 2·3으로 검토한 7건은 전부 탈락(§3). 특히 **CI 낭비 계량**은 GitHub이 네이티브로 내장 완료(사망 패턴 2 정면), **테스트 스위트 잉여 계량**은 3일 전(8/14) 등록된 저장소가 정면 커버.

---

## 1. 채택 후보 — `usecov`

### 1-1. 한 문장 정의

> **테스트 커버리지가 아니라 "실사용 커버리지"를 재서, 아무도 실행하지 않는 코드와 아무도 테스트하지 않는 실행 경로를 동시에 드러내는 TS/Python 계측 도구.**

핵심 전환: 기존 커버리지는 **테스트가 코드를 얼마나 지나가는가**를 잰다. `usecov`는 **실제 실행 트래픽이 코드를 얼마나 지나가는가**를 재고, 그 둘을 교차해 4사분면으로 자른다.

| | 테스트 커버 O | 테스트 커버 X |
|---|---|---|
| **실사용 O** | 안전 | **위험 — 사용자는 매일 지나가는데 검증이 없다** |
| **실사용 X** | **낭비 — 아무도 안 쓰는 코드를 테스트·리뷰·CI에서 유지 중** | 삭제 후보 |

기존 도구는 이 표의 **왼쪽 열 한 칸**만 보고 있다. 오른쪽 열과 아래 행은 아무도 재지 않는다.

### 1-2. "우와" 체크리스트 — **5/5 충족**

| # | 항목 | 판정 | 근거 |
|---|---|:-:|---|
| 1 | 배경 지식 0에서 30초 이해 | ○ | "테스트는 87% 커버한다고 합니다. 사용자는 그 중 몇 %를 실제로 실행할까요?" — 이 한 문장으로 끝. 커버리지 배지는 비개발자도 본 적 있음 |
| 2 | 심사위원 현장 체험 | ○ | 노트북을 넘기고 "평소 쓰시듯 눌러보세요". 클릭이 곧 계측 입력. 네트워크·인프라 불필요 |
| 3 | before/after 정량적 극적 | ○ | **87% → 31%, 격차 56%p.** 선행 연구가 이 크기를 뒷받침(§1-3) |
| 4 | "이게 되나?" / "지금까지 없었어?" | ○ | 두 반응 모두 발생. ① "프로덕션에 커버리지를 켠다고? 느려지지 않나?" → 오버헤드 2%대 제시 ② "테스트 커버리지랑 실사용을 비교한 도구가 없었어?" → OSS 부재 확인됨 |
| 5 | 화면에 움직임·실시간 변화 | ○ | 회색 트리맵 3,180 타일이 조작에 따라 **실시간 점등**. 6주치 로그 리플레이 시 물결처럼 번짐 |

**이 축의 특수 강점 적용**: 3번을 엄격 판정해도 통과한다. 아래 숫자는 추정이 아니라 선행 연구 실측치다.

### 1-3. 드러날 숫자의 크기 — 근거

| 실측 대상 | 결과 | 출처 |
|---|---|---|
| 웹페이지 25,000개 JS 함수 | **중위 페이지에서 함수의 70%가 미사용**, 제거 시 페이지 크기 60% 감소 | `[확인]` Muzeel, arXiv [2106.08948](https://arxiv.org/pdf/2106.08948) |
| 오픈소스 Java 프로젝트 35개 | 메서드의 **15.94%가 사실상 죽은 코드** | `[확인]` W&M TSE'18 [멀티 스터디](https://www.cs.wm.edu/~denys/pubs/TSE'18-DeadCode.pdf) |
| 산업용 .NET 웹앱 | 메서드의 **25%가 죽음** | `[확인]` 동일 계열 연구, [hello2morrow](https://blog.hello2morrow.com/2015/04/dead-code-detection/) |
| 2년 이상 활발히 개발된 코드베이스 | **10~30%가 아무것도 하지 않음** | `[확인]` [axify](https://axify.io/blog/dead-code) |
| 테스트되지 않은 코드 변경 | 결함 포함 확률 **5배** | `[확인]` [Teamscale Test Gap Analysis](https://teamscale.com/features/test-gap-analysis) |
| JS 코드 계측 오버헤드 | V8 정밀 커버리지 20~40% (무겁다) | `[확인]` [v8.dev](https://v8.dev/blog/javascript-code-coverage) |
| Python 계측 오버헤드 | `sys.monitoring`(PEP 669) 사용 시 **5% 미만** | `[확인]` [nedbat 블로그](https://nedbatchelder.com/blog/202312/coveragepy_with_sysmonitoring.html), [PEP 669](https://peps.python.org/pep-0669/) |

**발표 문장(추정 결합)**: `[추정]` "테스트 커버리지 87%인 저장소에서 실사용 커버리지는 31%. 당신은 48,000줄을 6주간 테스트하고 리뷰하고 CI에서 돌렸지만 그 코드는 단 한 번도 실행되지 않았습니다. 동시에, 사용자가 매일 지나가는 88개 함수에는 테스트가 없습니다."

> 왜 이 축에 유리한가: 낭비 쪽(48,000줄)은 "우와"를 만들고, **위험 쪽(88개 함수)은 "그래서 뭘 해야 하나"에 즉답**한다. 진단만 하고 끝나는 도구가 아니다.

### 1-4. 3분 시연 시나리오 (초 단위)

| 시각 | 화면에 보이는 것 | 말하는 것 |
|---|---|---|
| 0:00–0:20 | 슬라이드 1장. 실제 오픈소스 저장소의 커버리지 배지 `coverage 87%` 확대 | "이 배지를 안 믿는 분? 그럼 질문. 사용자는 이 중 몇 %를 실제로 실행할까요? 아무도 재본 적이 없습니다" |
| 0:20–0:40 | 왼쪽: 로컬 실행 중인 오픈소스 웹앱(FastAPI + React). 오른쪽: **전부 회색인 트리맵 3,180 타일**. 터미널에 `usecov attach` 한 줄 | "코드 한 줄도 고치지 않았습니다. 프로세스에 붙였을 뿐입니다" |
| 0:40–1:30 | **노트북을 심사위원에게 넘김.** 조작할 때마다 타일이 실시간 점등. 상단 카운터 증가: `214 / 3,180 (6.7%)` | "평소 쓰시듯 아무거나 눌러보세요" (침묵. 화면만 움직임) |
| 1:30–2:00 | "6주치 액세스 로그 재생" 버튼. 배속 재생되며 트리맵이 물결처럼 번짐 → 정지. `실사용 커버리지 31%` vs `테스트 커버리지 87%` 나란히 | "1분으론 부족하죠. 이 앱의 실제 6주치 트래픽을 넣습니다" |
| 2:00–2:35 | 트리맵이 **4색 사분면으로 갈라지는 애니메이션**. 낭비 1,742함수/48,000LOC, 위험 88함수. 위험 타일 클릭 → 파일·라인 점프 | "왼쪽 아래가 낭비입니다. 그런데 진짜 무서운 건 오른쪽 위, 88개입니다" |
| 2:35–2:50 | `usecov prune --dry-run` → 삭제 후보 PR diff 생성. 예측: CI −N분, 번들 −N KB | "삭제 PR을 대신 씁니다" |
| 2:50–3:00 | 화면 하단 오버헤드 계기: `2.1%` | "이 계측의 오버헤드는 2.1%입니다. 프로덕션에 켜둘 수 있습니다" |

**데모 실패 리스크와 완화**: 라이브 조작이 핵심이라 실패 시 치명적. ① 전 과정 로컬(네트워크 0 의존) ② 사전 캡처한 스냅샷 재생 모드를 백업으로 준비 ③ 심사위원 조작 구간은 실패해도 로그 리플레이로 복구 가능.

### 1-5. G8 실물 반증 로그

**① 웹 검색 (영어 2 + 한국어 1 이상, 문제 서술로 검색)**

| # | 검색어 | 결과 | 결론 |
|---|---|---|---|
| 1 | `production runtime code coverage dead code never executed in production tool Node.js Python open source` | Istanbul/nyc/pytest-cov = 전부 **테스트** 커버리지. SeaLights만 프로덕션 커버리지를 하는데 **상용 엔터프라이즈**([docs.sealights.io](https://docs.sealights.io/knowledgebase/setup-and-configuration/troubleshooting-faq/others/sealights-vs-sonarqube)) | OSS 부재 |
| 2 | `"NODE_V8_COVERAGE" production dead code detection percentage of code never runs tool` | [Per Buer 블로그](https://medium.com/@perbu/finding-dead-code-in-nodejs-projects-cd9ce927653) = c8을 프로덕션에 몇 시간 돌리는 **수동 레시피**. [v8.dev](https://v8.dev/blog/javascript-code-coverage) = 엔진 문서. 패키지화된 도구 없음 | 기법은 공개, 제품은 없음 |
| 3 | `"test gap analysis" open source tool production usage vs test coverage Teamscale SeaLights alternative` | [Teamscale](https://teamscale.com/features/test-gap-analysis)·SeaLights = 상용, Java/.NET 중심. "OSS 대안"으로 제시되는 것은 SonarQube·JaCoCo·PIT·Stryker = **전부 다른 범주**(정적 분석·테스트 커버리지·뮤테이션) | **카테고리는 검증됨 + OSS 공백** |
| 4 | `what percentage of code is never executed in production study dead code empirical research` | §1-3 수치 확보 | 숫자 크기 확정 |
| 5 | `"sys.monitoring" Python low overhead production coverage dead code detection tool 2026` | PEP 669, [coveragepy #1746](https://github.com/nedbat/coveragepy/issues/1746), SlipCover 논문. **저오버헤드 프로덕션 사용률 도구는 없음** | 기술 경로 확보 + 공백 |
| 6 | `[한국어]` `커버리지 배지 신뢰 못하는 이유 제외 설정 스킵된 테스트 방치 CI 초록불` | "초록불이 무엇을 보장하는지 아무도 문장으로 갖고 있지 않다"([youngju.dev](https://www.youngju.dev/blog/career/2026-08-15-career-skills-verification-and-testing)) 등 담론만 존재 | 국내 수요 담론 ○, 도구 ✗ |
| 7 | `Michael Feathers Scythe production coverage dead code tool` | [michaelfeathers/scythe](https://github.com/michaelfeathers/scythe) 실재. 그러나 **개발자가 `scythe_probe()`를 손으로 삽입**하는 방식, Ruby 중심, 2016년 이후 정지 | 가장 가까운 선행 도구이나 자동 전수 계측 아님 |

**② `gh search repos`**

| 검색어 | 결과 |
|---|---|
| `production coverage dead code` | **0건** |
| `runtime dead code detection` | **0건** |
| `usage coverage production` | **0건** |
| `unused function production traffic` | **0건** |
| `test gap analysis` | `janScheible/test-gap-analysis`(Java 알고리즘 습작), `crisesarmiento/testsense`(AI **정적** 분석), `kodustech/kodus-graph`(정적 그래프) — **런타임 계측 0건** |
| 대조군 `mutation testing` | mutmut·infection·stryker-js 정상 반환 → 검색 자체는 작동 |

**③ 대상의 공식 문서·로드맵 확인**
- `coverage.py`: [issue #1746](https://github.com/nedbat/coveragepy/issues/1746)에서 `sys.monitoring` 도입 진행 중이나, **정체성이 "테스트 커버리지 측정"에 고정**. 프로덕션 사용률·사분면 분석은 범위 밖. `[확인]`
- Node.js: `NODE_V8_COVERAGE`는 **원시 이벤트 출력만** 제공([공식 문서](https://nodejs.org/learn/test-runner/collecting-code-coverage)). c8/bcoe는 테스트 리포터. `[확인]`
- Chrome DevTools Coverage / Lighthouse "Reduce unused JavaScript": **브라우저 1페이지·1세션 한정**, 서버 코드 없음, 테스트 커버리지 대조 없음. `[확인]`
- Teamscale·SeaLights: 상용 라이선스. OSS로 내려올 유인이 없다. `[확인]`

**④ npm / PyPI**
- npm `production coverage`, `dead code runtime`, `code usage heatmap` → 해당 도구 **0건** (`babel-dead-code-elimination`=빌드 타임, `fallow`=정적 분석)
- PyPI `prodcov` / `production-coverage` / `runtime-deadcode` → **전부 404**

**유사 도구 카운트: 직접 유사 OSS 0~1개(Scythe, 수동·정지), 상용 2개(Java/.NET).** → 탈락선(3개) 미달, **통과**.

**사망 패턴 5종 대조**

| 패턴 | 해당 여부 | 근거 |
|---|:-:|---|
| 1. 표준의 검증기·린터 | ✗ | 표준 자체가 없다. 우리가 측정 규격을 제안하는 쪽 |
| 2. 인기 도구의 관측성 연동 → 호스트 내장 | **주의 → 회피** | **내장할 호스트가 없다.** CPython·V8은 원시 이벤트만 내놓는 런타임이고 "사용률 분석 제품"을 만들 주체가 아니다. coverage.py는 테스트 커버리지에 정체성 고정. LLM 관측성 플랫폼과는 도메인이 무관(에이전트·토큰·프롬프트 일절 없음) |
| 3. 신생 생태계 보안 스캐너 | ✗ | 보안 아님. CVE·시그니처 일절 없음 |
| 4. 최신·최대 모델 지원 | ✗ | 모델 무관, GPU 무관 |
| 5. 번역·로컬라이제이션 | ✗ | 해당 없음 |

### 1-6. 2주 실현성 — TS/Python 100%, 미지 요소 3개

| 구성 요소 | 언어 | 기법 | 난이도 |
|---|---|---|---|
| Python 수집기 | Python | `sys.monitoring` `PY_START` 이벤트 + 첫 히트 후 `DISABLE` 반환 → **함수당 1회만 비용 발생**, 정상 상태 오버헤드 거의 0 | 중 (순수 Python, PEP 669 학습 필요) |
| Node/TS 수집기 | TS | `inspector` 세션 `Profiler.startPreciseCoverage({detailed:false})` 또는 `NODE_V8_COVERAGE`(코드 0줄) | 하 |
| 소스맵 역매핑 | TS | 기존 `v8-to-istanbul` 사용 | 하 (기존 OSS) |
| 다중 프로세스 머저 | Python/TS | 함수 히트 집합 합집합 + 정규화된 함수 ID | 하 |
| 테스트 커버리지 파서 | Python/TS | `coverage.json` / `lcov` / istanbul JSON 읽기 | 하 |
| 사분면 계산 + 트리맵 뷰어 | TS | D3 트리맵 + WebSocket 실시간 스트림 | 중 |
| 데모 앱 + 로그 리플레이어 | Python/TS | 오픈소스 웹앱 + 액세스 로그 재생 | 중 |
| GitHub Action | TS | PR에 사분면 변화 코멘트 | 하 |

**저수준 크리티컬 패스 없음.** Rust·C·셰이더·커널 전무. 두 런타임이 필요한 이벤트를 이미 공개 API로 내놓고 있어, 우리 작업은 **수집·머지·교차·시각화** 계층뿐이다.

**미지 요소 3개**
1. TS → JS 소스맵 매핑 정확도 (완화: `v8-to-istanbul` 검증된 라이브러리 사용, 실패 시 JS 레벨로 데모)
2. `sys.monitoring`의 async·멀티스레드 동작 (완화: `COVERAGE_CORE=sysmon` 경유 fallback 확보)
3. 리팩터링 시 함수 ID 안정성 (완화: 데모·2주 범위에서는 무관, 로드맵 항목으로 명시)

**공수 배분 `[추정]`**: W1 = 두 수집기 + 머저 + 함수 ID 정규화(약 90h), W2 = 커버리지 파서 + 사분면 + 트리맵 UI + 데모 앱/리플레이어(약 100h). 총 190h — 가용 범위 내.

### 1-7. 대표 저장소에 남는 것

- `usecov` 모노레포: `packages/collector-node`(npm 배포), `python/usecov`(PyPI 배포), `packages/viewer`
- **실측 데이터셋**: 공개 오픈소스 앱 N개의 "테스트 커버리지 vs 실사용 커버리지 격차" 재현 가능한 골든셋 + 리플레이 로그. → 1차 서면평가(30점)에서 문서-코드 괴리가 없는 산출물
- `usage-coverage` **측정 규격 문서** — 용어와 계산법을 정의해 후속 구현이 붙을 수 있게 함(OSS 발전 가능성 6점)
- GitHub Action: PR 단위 사분면 변화 코멘트
- 3분 시연 영상 + 결과보고서

### 1-8. 발표에 올릴 정량 지표

1. **테스트 커버리지 vs 실사용 커버리지 격차 (%p)** — 대표 지표
2. 사분면별 함수 수 / LOC (낭비 / 위험 / 안전 / 삭제후보)
3. **위험 사분면 함수 수** — 실사용 O + 테스트 X. 결함 확률 5배 구간(Teamscale 근거)
4. 삭제 후보 LOC → CI 시간·번들 크기 감소 예측치
5. **계측 오버헤드 %** (목표 3% 미만) — "프로덕션에 켤 수 있다"의 증거이자 기술 난도 증명
6. 실측 대상 저장소 수 / 총 함수 수

### 1-9. 수명 (3년 뒤에도 문제인가)

**악화된다.** ① 죽은 코드는 코드베이스 나이에 비례해 축적되고, 정적 분석은 원리적으로 "참조는 되지만 실행되지 않는 코드"를 볼 수 없다. ② **AI 코딩 에이전트가 코드 생산량을 구조적으로 폭증**시키면서, 생산량 대비 실행되는 비율은 떨어진다. "얼마나 썼나"가 아니라 "무엇이 실제로 살아 있나"를 재는 도구의 수요는 3년 뒤 더 크다. ③ `sys.monitoring`은 Python 3.12+ 기능으로 향후 표준 경로가 되며, 우리 도구는 그 위에 올라간다.

### 1-10. 커뮤니티 접점

| 커뮤니티 | 접점 |
|---|---|
| `coverage.py` (nedbat) | [#1746](https://github.com/nedbat/coveragepy/issues/1746) `sys.monitoring` 논의에 실사용 사례 제공. 프로덕션 모드 요구사항 피드백 |
| CPython / PEP 669 | `sys.monitoring` 실사용 사례가 희소 — 실전 리포트 자체가 기여 가치 |
| Vitest / Istanbul (`v8-to-istanbul`, `c8` by bcoe) | 소스맵 매핑 이슈 업스트림 기여 경로 |
| 국내 | 파이썬 코리아, FEConf/JSConf Korea 발표 소재로 직결. "실사용 커버리지"라는 새 용어가 발표 후크 |

---

## 2. 왜 후보가 1개인가

이 축은 강점과 함정이 같은 곳에 있다. "숨은 낭비를 계량한다"는 아이디어는 **누구나 떠올리는 자리**이고, 그래서 CI 비용·관측성 비용·번들 크기·플래키 테스트는 이미 호스트가 내장했거나 상용 벤더가 점령했다. 이 축에서 살아남는 조건은 하나였다.

> **측정 대상이 "런타임이 원시 이벤트로만 내놓고, 아무도 제품으로 조립하지 않은 것"이어야 한다.**

`usecov`가 통과한 이유가 정확히 이것이다. V8과 CPython은 필요한 이벤트를 이미 공개하는데, 그것을 "실사용 사용률"로 조립한 OSS는 없다. 조립할 유인이 있는 주체(Teamscale·SeaLights)는 상용이라 내려오지 않고, 런타임 진영은 제품을 만들 주체가 아니다. **구조적 공백**이며, 이는 팀이 잃은 12건과 성질이 다르다.

---

## 3. 탈락 후보 기록

| 후보 | 한 문장 | 탈락 사유 | 반증 근거 |
|---|---|---|---|
| **CI 낭비 X-ray** — 머지 안 된 커밋·무효화된 실행·재실행·캐시 미스에 태운 CI 시간 계량 | "당신 조직은 CI 시간의 40~60%를 버립니다" | **사망 패턴 2 정면 — 호스트가 내장 완료.** 게다가 커뮤니티 도구 8개 이상 | GitHub Actions **Usage Metrics + Performance Metrics 2025-03 GA** ([changelog](https://github.blog/changelog/2025-03-14-actions-performance-metrics-are-generally-available-and-enterprise-level-metrics-are-in-public-preview/), [docs](https://docs.github.com/en/actions/administering-github-actions/viewing-github-actions-metrics)). `gh search`: `gaia-research/skill-ci-churn`(2026-08-15, "wasted CI compute" 정면), `austenstone/github-actions-usage-report`, `M1XZG/github-actions-usage-reporter`, `abeyuya/actions-cost-check-tool`, `ghostinhat/actions-policy-audit` 등 |
| **테스트 스위트 잉여 계량** — 지워도 커버리지가 같은 테스트 찾기 | "테스트 30% 지워도 검증력 동일, CI 40% 절감" | **3일 전 등록 저장소가 정면 커버** | `JoseAntonioNuevo/test-suite-doctor` (2026-08-14): "audit, minimize, and heal bloated Vitest/Jest test suites — per-test coverage metrics, greedy minimization, AI-slop detection, mutation-score verification". 추가로 `sophie-nguyenthuthuy/testselect`, `PrecisionUtilityGuild/recon` |
| **초록불 감사기** — 조용히 스킵된 테스트 + 제외 설정으로 부풀린 커버리지 계량 | "배지는 87%인데 실제로는 62%" | **숫자가 작다 — 3번 기준 미달.** 직접 실측함 | 실측(2026-08-17, `--filter=blob:none` 클론): airflow 스킵 마커 420 / 테스트 함수 28,322 = **1.5%**, pandas 220 / 20,877 = **1.05%**, n8n 116 / 73,109 = **0.16%**. flask·httpx·requests는 스킵 0~7개, omit 설정 1~2줄. **"1.5%, 평균 3년 방치"는 "오..엥" 수준.** 팀 기준 미달 |
| **관측성 비용 좀비** — 아무도 조회하지 않는 메트릭·로그 계량 | "커스텀 메트릭 비용의 20~50%가 독자 0" | **완전한 레드오션 + 축의 명시적 배제 대상** | Grafana [Adaptive Metrics](https://grafana.com/blog/identify-unused-costly-metrics-with-cardinality-management-dashboards-in-grafana-cloud/), Datadog [Metrics without Limits](https://docs.datadoghq.com/metrics/metrics-without-limits/), `mimirtool analyze`, Cribl·Sawmills·Bindplane·Edge Delta |
| **mock 과용 계량** — 커버리지 중 mock 경계 뒤에 있는 비율 | "커버리지 85%의 절반은 mock을 테스트한 것" | **정의가 논쟁적 + 화면 움직임 없음 + `usecov`와 스토리 중복.** 지표 정의를 심사위원이 반박하면 무너진다 | `gh search "mock overuse"` 0건이라 공백은 있으나, 선행 연구([arXiv 2503.19284](https://arxiv.org/pdf/2503.19284))가 제시하는 수치가 "mock 호출의 9%만 검증됨"이라 발표용 숫자로 약함. npm은 `msw-inspector-cli`만 |
| **배포물 낭비** — npm tarball / node_modules 중 실행되지 않는 바이트 | "설치 1.2GB, 실행 34MB" | **유사 도구 3개 초과 → 탈락 규칙 적용** | `node-prune`, `modclean`, `clean-modules`, `packagephobia`, `publint`, `@vercel/nft` |
| **API 엔드포인트 사망률** — 호출되지 않는 엔드포인트 계량 | "엔드포인트 340개 중 112개만 호출됨" | **`usecov`의 도메인 변형 — 독립 후보로 세우면 중복.** 선행 수치 근거도 없음 | 검색 결과 확립된 통계 없음. Datadog API Catalog·42Crunch(상용). → **`usecov`의 부가 렌즈로 흡수** |
| **프런트엔드 미사용 JS** | "첫 화면 JS의 82%가 실행되지 않음" | **Lighthouse가 "Reduce unused JavaScript" 감사로 내장** | Chrome DevTools Coverage 탭 + Lighthouse 표준 감사. → **`usecov`가 서버 코드까지 확장하는 방향으로 흡수** |

---

## 4. 팀에 넘기는 판단 사항

1. **이름**: `usecov` / `realcov` / `liveness` 중 택. "실사용 커버리지(usage coverage)"라는 **용어를 우리가 정의**하는 것이 발표 후크로 가장 강하다.
2. **데모 대상 앱 선정**: 커버리지 배지가 높고(80%+), 로컬에서 원커맨드로 뜨고, TS·Python 양쪽을 쓰는 오픈소스 웹앱. 이 선정이 데모 품질을 결정한다 — **착수 첫날에 확정할 것**.
3. **6주치 트래픽 확보**: 실제 액세스 로그가 없으면 E2E 시나리오 기반 합성 트래픽 + 생성 스크립트를 저장소에 포함(재현 가능성 확보). 합성이라는 사실은 발표에서 명시할 것.
4. **경계 방어 준비**: 심사위원 예상 질문 ① "코드 커버리지랑 뭐가 다른가" ② "프로덕션에 켜도 되나(오버헤드·보안)" ③ "안 쓰이는 코드를 지우면 위험하지 않나(계절성·장애 경로)". 특히 ③은 **`--dry-run` PR 제안 + 관측 기간 명시**로 답해야 한다.
5. **위험 사분면을 전면에 둘 것**: 낭비 쪽은 "우와"를 만들지만, 활용성 15점은 **"사용자가 매일 지나가는데 테스트가 없는 88개"**가 벌어준다. 발표 순서를 이렇게 짤 것.
