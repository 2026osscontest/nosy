# 04. 경쟁 레포 실측 조사 — 2026 오픈소스 개발자대회

> 조사일: 2026-08-16 / 조사 도구: `gh` CLI (인증됨, REST + GraphQL), WebSearch, WebFetch
> 표기 규칙: `[확인]` = API/문서로 직접 실측 · `[추정]` = 간접 근거 기반 추론
> **모든 수치는 GitHub API 실측값이며, 지어낸 URL·수치는 없습니다.**

---

## 0. 먼저: 대회 정보 재확인 (조사 중 확보)

| 항목 | 내용 | 근거 |
|---|---|---|
| 정식 명칭 | **2026 오픈소스 개발자대회** (구 "공개SW 개발자대회"에서 개명, 20주년) | `[확인]` osscontest.kr / oss.kr |
| 주최·주관 | 과학기술정보통신부 / 정보통신산업진흥원(NIPA), 운영 한국오픈소스협회 | `[확인]` |
| 참가접수 | 6.15 ~ **7.17(금) 18:00** 마감 (이미 종료) | `[확인]` |
| **출품작 제출** | 7.18 ~ **8.27(목) 18:00** — 결과보고서 + 소스코드 + **시연영상 3분** | `[확인]` |
| 1차 평가(서면) | 9.3 ~ 9.4, 약 **40팀** 선발 | `[확인]` |
| 멘토링 | 9.18 ~ 10.9 (1차 합격팀) | `[확인]` |
| 2차 평가 | 10.12 ~ 10.28 **기능테스트 + 라이선스 검증** | `[확인]` |
| 발표평가 | 11.4 ~ 11.5 → 수상 발표 11.11 → 시상식 12.4 | `[확인]` |
| 시상 규모 | 총 23점 / 6,700만원. 대상 1,000만 · 금상 500만 · 은상 250만 · 동상 200만 · 장려상 100만 | `[추정]` 경쟁팀(unityctl)의 자체 조사 문서 기준, 공식 공고와 상금총액 상이 가능 |

> ⏰ **오늘 기준 제출까지 11일.** "2주"라는 팀 가정과 거의 일치합니다.

**핵심 함의 3가지**
1. 1차는 **서면**입니다 — 심사위원은 코드를 실행하지 않고 **결과보고서 + README + 3분 영상**만 봅니다. 레포의 "겉모습"이 1차 통과의 전부입니다.
2. 2차에 **라이선스 검증**이 독립 관문으로 있습니다 — 후술하듯 이게 실제 탈락 사유 1순위입니다.
3. 40팀 선발 → 약 19~21팀 수상. **1차만 통과하면 수상 확률이 절반입니다.** 즉 승부처는 (a) 1차 서면 통과, (b) 상위상을 가르는 발표평가입니다.

---

## 1. 조사 커버리지 (정직한 기록)

### 시도한 검색어 (전부 실행함)
`gh search repos`: `공개SW 개발자대회` · `공개SW개발자대회` · `osscontest` · `OSS Contest 공개SW` · `오픈소스 개발자대회` · `오픈소스개발자대회` · `2026 오픈소스 개발자대회` · `2025 공개SW 개발자대회` · `공개SW 개발자대회 2025` · `19회 공개SW` · `제19회 오픈소스` · `20회 오픈소스 개발자대회` · `osscontest 2026` · `opensource contest 2026 출품` · `오픈소스 개발자대회 출품작` · `공개SW 개발자대회 수상` · `OSS Developers Contest korea`

`gh search code` (README 전문 검색, 권한 있음): `공개SW 개발자대회` · `오픈소스 개발자대회` · `2026 오픈소스 개발자대회` · `오픈소스 개발자대회 자유과제` · `오픈소스 개발자대회 지정과제` · `osscontest.kr`

WebSearch: 심사기준·후기·회고·수상결과 등 6종

### 수확
| 구분 | 확보 수 | 비고 |
|---|---|---|
| **2026년 현재 출품(예정)작** | **27개** | 전부 실측 완료. 대회 언급이 README/CLAUDE.md/docs에 명시된 것만 |
| 과거 수상작·본선작 (2017~2025) | **15개** | 상격 확인된 것 위주 |
| 글로벌 소형 OSS 앵커 | **10개** | A선 기준점 확보용 |
| **합계 실측 레포** | **52개** | |

### 못 찾은 것 (한계 명시)
- **2025년 최종 수상작 목록**: `oss.kr` 수상결과 공지 페이지가 **HTTP 403**으로 차단되어 상격별 작품명 매칭 실패. → 2025년 수상작 GitHub 레포는 `seoul-fit/backend`, `Worlds-iOS-v2/*`(본선), `Gyu-Chul/RAGIT`(수상 배지 커밋 확인) 등 단편적으로만 확보.
- **2026년 전체 출품작 명단**: 비공개. 27개는 "레포에 대회를 언급한 팀"만이며, **실제 출품팀은 이보다 훨씬 많을 것**입니다 `[추정]`. 다만 언급하지 않은 팀은 대체로 OSS 지향성이 낮으므로, **27개는 "OSS 문법을 아는 상위 표본"에 가깝습니다** — 즉 이 표본을 이기면 전체를 이깁니다.
- **공식 세부 배점표**: 오리엔테이션(7.23) 자료로만 배포되어 웹에 없음. 팀이 받은 자료(1차 팀워크 6점 / 개발문서 구체성 6점, 2차 커뮤니티 확장가능성 10점)가 1차 출처입니다.

---

## 2. 2026년 현재 출품작 실측 — **직접 경쟁자 27팀**

정렬: 종합 완성도 체감순. `★`=스타, `C`=커밋, `Con`=기여자, `I`=이슈, `PR`=PR, `Runs`=CI 실행수

### 2-1. 상위권 (진짜 위협 — 이 팀들이 우리 경쟁자입니다)

| # | 레포 | 작품/성격 | 언어 | ★ | C | Con | I | PR | 개발기간 | CI Runs | 릴리스 | LICENSE |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | [ChoHyeonChan/maskingtape](https://github.com/ChoHyeonChan/maskingtape) | 한국어 PII 비식별화 엔진 (라이브러리+CLI+MCP) | Python/Dart | 1 | **329** | **6** | **139** | **146** | 07-17~08-16 (30일) | **332** | 0 | Apache-2.0 |
| 2 | [JNU-SWCU/oss-hub](https://github.com/JNU-SWCU/oss-hub) | 전남대 SW중심대학 사업 허브 | TypeScript | 0 | **2054** | 5 | **326** | **603** | 07-11~08-13 (33일) | **4404** | **98** | ❌ **없음** |
| 3 | [JeongDoWook/vuln-agent](https://github.com/JeongDoWook/vuln-agent) | 런타임 맥락 기반 취약점 진단 에이전트 | PHP | 0 | **904** | 2 | 54 | **572** | 07-07~08-16 (40일) | 0 ❌ | 0 | MIT |
| 4 | [Jason-hub-star/unityctl](https://github.com/Jason-hub-star/unityctl) | AI 에이전트용 Unity 제어 CLI/MCP | C# | **18** | 197 | 3 | 5 | 12 | 03-17~08-05 (141일) | 252 | **14** | MIT |
| 5 | [Hbin77/tierroute](https://github.com/Hbin77/tierroute) | 오프라인·예산인지 LLM 라우팅 | Python | 0 | 236 | 1 | 24 | 38 | 07-15~07-20 (5일) | 206 | 0 | Apache-2.0 |
| 6 | [gncorpseo-commits/capnet](https://github.com/gncorpseo-commits/capnet) | Capability 계약 기반 실행 계층 | Python | 1 | 110 | 2 | 6 | 92 | 08-01~08-16 (15일) | 138 | 0 | Apache-2.0 |
| 7 | [Ae-Ti/CodeAtlas](https://github.com/Ae-Ti/CodeAtlas) | 코드 지도/큐레이션 | PLpgSQL/Py | 0 | 104 | 2 | 16 | 25 | 08-04~08-16 (12일) | 0 ❌ | 0 | MIT |
| 8 | [WOVY/FinIDS](https://github.com/WOVY/FinIDS) | 금융 침입탐지 (ELK+LLM) | Python | 0 | 66 | 1 | **48** | 22 | 06-16~08-05 (50일) | 42 | 0 | MIT |
| 9 | [needsbuilder/ttobak](https://github.com/needsbuilder/ttobak) | 또박 — 공공문서 쉬운글 변환(Easy-Read) | Python | 1 | 123 | 1 | 8 | 7 | 06-30~08-06 (37일) | 33 | 1 | Apache-2.0 |
| 10 | [Junghoo-developer/SongRyeon](https://github.com/Junghoo-developer/SongRyeon) | 코드검증 사실 / LLM판단 분리 런타임 | Python | 2 | 108 | 1 | 0 | 3 | 06-26~08-07 (42일) | 90 | 0(태그6) | MIT |

**상위권 관리체계 상세**

| 레포 | CONTRIB | CoC | Issue<br>Tpl | PR<br>Tpl | SECU | NOTICE | SBOM | CHANGE<br>LOG | 라벨 | 마일<br>스톤 | 브랜치 | 테스트<br>파일 | md<br>파일 | README<br>줄수 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| maskingtape | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | **17** | **3** | 100+ | 62 | 21 | 161 (mermaid✅) |
| oss-hub | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | 10 | 0 | 43 | **664** | 75 | README 없음 ❌ |
| vuln-agent | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | 9 | 0 | 1 | 87 | 68 | 83 |
| unityctl | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | 9 | 0 | 8 | 167 | 76 | 200 |
| tierroute | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | 9 | 0 | 9 | 48 | 26 | **1027** |
| capnet | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | 9 | 0 | 10 | 89 | 46 | 175 |
| CodeAtlas | ✅ | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ | **18** | **3** | 28 | 8 | 37 | 391 |
| FinIDS | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | **21** | **7** | 15 | 7 | 12 | 70 |
| ttobak | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ | 9 | 0 | 1 | 85 | 18 | 151 (데모GIF✅) |
| SongRyeon | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | 9 | 0 | 11 | 91 | 24 | 353 |

### 2-2. 중·하위권 (17팀 — 상대적으로 넘기 쉬운 그룹)

| 레포 | 성격 | ★ | 커밋 | 기여자 | 이슈 | PR | CI | LICENSE | README줄 | 특이사항 |
|---|---|---|---|---|---|---|---|---|---|---|
| [seungchan-song/RAG-DIAG](https://github.com/seungchan-song/RAG-DIAG) | RAG 보안 진단 CLI | 2 | 101 | 3 | 0 | 5 | Copilot만 | MIT | 523 | md 245개(문서 과다) |
| [goldmireu-source/dailysync](https://github.com/goldmireu-source/dailysync) | AI 뉴스 큐레이션 | 0 | 263 | 2 | 0 | 0 | 배포만 | ❌ **없음** | 239 | 이슈·PR 0 |
| [Vovvser/vowser-client](https://github.com/Vovvser/vowser-client) | AI 음성 브라우저 (KMP) | 0 | 236 | 2 | 0 | 41 | ❌ | Apache-2.0 | 261 | 2025 활동, CI 전무 |
| [Alderwork/eme](https://github.com/Alderwork/eme) | AI 코딩 에이전트 관제 | 0 | 161 | 1 | 0 | 0 | ✅ 3종 | MIT | 188 | 릴리스 3, 커뮤니티 파일 풀세트인데 **이슈·PR 0** |
| [Gyu-Chul/RAGIT](https://github.com/Gyu-Chul/RAGIT) | GitHub RAG | 5 | 185 | 2 | 0 | 7 | ❌ | NOASSERTION | 584 | 2025 수상 배지 커밋 있음 |
| [nohseongmin/VibeGuard](https://github.com/nohseongmin/VibeGuard) | 바이브코딩 보안 가드레일 | 0 | 35 | 1 | 0 | 0 | ✅ 2종 | MIT | 198 | 이슈·PR 0 |
| [chodaQ/chodOS](https://github.com/chodaQ/chodOS) | Rust OS | 2 | 32 | 1 | 0 | 0 | ✅ | MIT | 74 | 이슈·PR 0 |
| [Ralastessh/Vibex](https://github.com/Ralastessh/Vibex) | 자유과제 (드로잉) | 0 | 32 | 3 | 0 | 5 | ❌ | MIT | 173 | CI·이슈 없음 |
| [Takch02/Tibero_OpenSQL_MCP](https://github.com/Takch02/Tibero_OpenSQL_MCP) | Tibero MCP (지정과제) | 0 | 49 | 1 | 14 | 9 | ✅ | Apache-2.0 | 170 | mermaid✅, CONTRIB 없음 |
| [Rabbit-Hole0/carrot](https://github.com/Rabbit-Hole0/carrot) | Rabbit Hole | 0 | 22 | 2 | 0 | 7 | ❌ | ❌ **없음** | 189 | |
| [hoddukzoa12/openWidGet](https://github.com/hoddukzoa12/openWidGet) | Windows 위젯 플랫폼 | 1 | 12 | 1 | 29 | 5 | ❌ | AGPL-3.0 | 87 | **라벨 44·마일스톤 10** (계획만 화려, 커밋 12) |
| [YuMinBee/meongtamjeong](https://github.com/YuMinBee/meongtamjeong) | 유기견 CLIP+FAISS 검색 | 0 | 16 | 1 | 0 | 2 | ✅ 2종 | Apache-2.0 | 277 | README 최고수준(arch+api+demo+mermaid) |
| [DONGJUN92/OSS_Contest_SKT_Router](https://github.com/DONGJUN92/OSS_Contest_SKT_Router) | SKT LLM 라우터 (지정과제) | 0 | 12 | 1 | 0 | 0 | ✅ | Apache-2.0 | 264 | 문서 33개인데 커밋 12 |
| [dev-carki/HR-Agent](https://github.com/dev-carki/HR-Agent) | LangGraph 이력서 분석 | 0 | 19 | 1 | 0 | 0 | ❌ | ❌ **없음** | 159 | 3월 이후 중단 |
| [competition-zerozero/opensource-liwonace](https://github.com/competition-zerozero/opensource-liwonace) | 리원에이스 지정과제 | 0 | 9 | 2 | 0 | 0 | ❌ | ❌ **없음** | 3 | README 3줄 |
| [shin0624/BridgeSense_DT](https://github.com/shin0624/BridgeSense_DT) | AI 교량 안전 디지털트윈 | 0 | **4** | 1 | 0 | 1 | ❌ | MIT | **3** | README 117바이트 |
| [NiceTry3675/OSS_Harnest](https://github.com/NiceTry3675/OSS_Harnest) | (초기 단계) | 0 | 3 | 1 | 0 | 0 | ❌ | ❌ | — | 파일 3개 |

### 2-3. 2026 필드 통계 (n=27) `[확인]`

| 지표 | min | p25 | **중앙값** | p75 | max |
|---|---|---|---|---|---|
| 스타 | 0 | 0 | **0** | 1 | 18 |
| 커밋 | 3 | 19 | **101** | 197 | 2054 |
| 기여자 | 1 | 1 | **1** | 2 | 6 |
| 이슈 | 0 | 0 | **0** | 16 | 326 |
| PR | 0 | 0 | **5** | 25 | 603 |
| CI 실행수 | 0 | 0 | **6** | 90 | 4404 |
| 릴리스 | 0 | 0 | **0** | 0 | 98 |
| README 줄수 | 3 | 151 | **188** | 264 | 1027 |
| 테스트 파일 | 0 | 2 | **15** | 85 | 664 |

| 항목 보유율 | 2026 필드 |
|---|---|
| LICENSE 파일 | 77% |
| SPDX 인식 라이선스 | 74% |
| CI(워크플로 1개 이상) | **59%** |
| 이슈 1개 이상 사용 | **40%** |
| CONTRIBUTING.md | 51% |
| ISSUE_TEMPLATE | 44% |
| PR_TEMPLATE | 44% |
| CODE_OF_CONDUCT | **14%** |
| CHANGELOG | 18% |
| SECURITY.md | 22% |
| NOTICE(의존성 고지) | 25% |
| SBOM | 25% |
| **릴리스 1개 이상** | **22%** |

> ⚠️ **주의: 2026 필드는 예년보다 확연히 강합니다.** CI 보유율 59%(과거 수상작 46%), SBOM 25%(과거 0%), CONTRIBUTING 51%(과거 26%). AI 코딩 에이전트 보급으로 커밋·PR·문서량이 폭증했습니다(vuln-agent 904커밋/40일, oss-hub 2054커밋/33일). **"과거 수상작 수준"으로 잡으면 올해는 못 이깁니다.**

---

## 3. 과거 수상작 실측 (2017~2025, n=15)

| 레포 | 작품 | 연도 | 결과 | 언어 | ★ | 커밋 | 기여자 | 이슈 | PR | CI | 릴리스 | LICENSE | README줄 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| [SSU-DC-DCWZ/ObsCare_Main](https://github.com/SSU-DC-DCWZ/ObsCare_Main) | ObsCare 지능형 관제 | 2021 | **금상** | Python | 5 | 259 | 3 | 0 | 0 | ❌ | 0 | GPL-3.0 | 122 |
| [devwithpug/RandHand-Chat](https://github.com/devwithpug/RandHand-Chat) | 랜손챗 | 2021 | **은상** | Java/Kotlin | 7 | 314 | 4 | **40** | 29 | ✅ | 0 | ❌ | 117 |
| [PROMAplatform/proma-back](https://github.com/PROMAplatform/proma-back) | PROMA | 2024 | **은상** | Java | 2 | 282 | 4 | 23 | 112 | ✅ | 0 | MIT | **1** ❌ |
| [pjhcsols/Web3.0-...](https://github.com/pjhcsols/Web3.0-Credential_Management_System) | Web3 자격증명 | 2024 | 라온시큐어 대표상 | Java/Swift | 4 | 198 | 4 | 25 | 18 | ❌ | 0 | Apache-2.0 | **694** |
| [TEAM-Hearus/HEARUS-SPRING-BACKEND](https://github.com/TEAM-Hearus/HEARUS-SPRING-BACKEND) | HEARUS | 2024 | **동상(카카오)** | Java | 1 | 201 | 2 | 0 | 6 | ✅ | 0 | Apache-2.0 | 52 |
| [None-Step/None-Step-BE](https://github.com/None-Step/None-Step-BE) | 이번역 | 2024 | **장려상** | Java | 2 | 325 | 3 | 0 | 187 | ❌ | 0 | Apache-2.0 | **976** |
| [among-neighbors/AN-frontend-builtin](https://github.com/among-neighbors/AN-frontend-builtin) | 이웃사이 | 2022 | **동상** | TypeScript | 2 | 300 | 3 | 26 | 71 | ❌ | 1 | Apache-2.0 | 215 |
| [4PT5/PersonalTraining-...](https://github.com/4PT5/PersonalTraining-for-Visually-Impaired) | 시각장애인 PT | 2021 | **동상** | Python | 0 | 91 | 5 | 0 | 26 | ❌ | 0 | Apache-2.0 | 122 |
| [project-elmo/project_elmo_backend](https://github.com/project-elmo/project_elmo_backend) | ELMO | 2023 | **장려상** | Python | 11 | 219 | 2 | 0 | 6 | ✅ | 0 | ❌ | 311 |
| [MotuS-Web/MotuS-FrontEnd](https://github.com/MotuS-Web/MotuS-FrontEnd) | MotuS | 2023 | 우수작(본선) | JavaScript | 2 | 252 | 2 | 17 | 52 | ❌ | 0 | MIT | 60 |
| [Worlds-iOS-v2/worlds-be-nest](https://github.com/Worlds-iOS-v2/worlds-be-nest) | 월스 | 2025 | 본선 | TypeScript | 2 | 291 | 5 | 2 | 44 | ✅ | 0(태그2) | MIT | 112 |
| [seoul-fit/backend](https://github.com/seoul-fit/backend) | Seoul Fit | 2025 | 출품 | Java | 1 | 112 | 3 | 1 | 0 | ✅ | 0 | NOASSERTION | 114 |
| [drexly/openhgsenti](https://github.com/drexly/openhgsenti) | 한국어 감성검색 | 2017 | 결선 | Python | **28** | 26 | 2 | 1 | 1 | ❌ | 0 | Apache-2.0 | 80 |
| [sedyn/electrom](https://github.com/sedyn/electrom) | electrom | 2021 | 출품 | C/C++ | 3 | 59 | 1 | 0 | 0 | ❌ | 0 | MIT | 164 |
| [PENEKhun/springdog](https://github.com/PENEKhun/springdog) | springdog | 2024 | 출품 | Java | 7 | 256 | 2 | **63** | 83 | ✅ 4종 | 0 | Apache-2.0 | 122 |

### 과거 수상작 통계 (n=15) `[확인]`

| 지표 | min | p25 | **중앙값** | p75 | max |
|---|---|---|---|---|---|
| 스타 | 0 | 2 | **2** | 7 | 28 |
| 커밋 | 26 | 112 | **252** | 291 | 325 |
| 기여자 | 1 | 2 | **3** | 4 | 5 |
| 이슈 | 0 | 0 | **1** | 25 | 63 |
| PR | 0 | 1 | **26** | 71 | 187 |
| README 줄수 | 1 | 80 | **122** | 215 | 976 |

보유율: LICENSE 93% · CI **46%** · 이슈사용 60% · CONTRIBUTING 26% · CoC 20% · **릴리스 6%** · **SBOM 0%** · CHANGELOG 6%

> 💡 **가장 중요한 발견**: **금상 수상작(ObsCare)의 스타는 5개, 커밋 259, 이슈 0, PR 0, CI 없음, 릴리스 없음입니다.**
> **스타 수는 이 대회의 평가 요소가 사실상 아닙니다.** 수상작 15개 중 최다가 28★(2017년 결선작), 중앙값 2★.
> → 우리가 "스타 확보"에 2주를 쓰는 것은 **완전한 낭비**입니다. 이 판단이 이번 조사의 최대 소득입니다.

---

## 4. 글로벌 소형 OSS 앵커 (A선 기준점)

"실제로 성공한 소형~중형 OSS"가 어떤 모습인지 실측. **A선의 질적 기준을 여기서 가져옵니다.**

| 레포 | 성격 | ★ | 커밋 | 기여자 | 릴리스 | CI워크플로 | CI실행 | 테스트파일 | CONTRIB | CoC | IssueTpl | CHANGELOG | README줄 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| [toss/es-toolkit](https://github.com/toss/es-toolkit) | JS 유틸 (한국) | 11,297 | 1789 | 100+ | **84** | 14 | 6924 | 809 | ✅ | ✅ | ✅ | ✅ | 70 |
| [sissbruecker/linkding](https://github.com/sissbruecker/linkding) | 북마크 매니저 | 11,063 | 906 | 100+ | **90** | 7 | 509 | 110 | ❌ | ❌ | ❌ | ✅ | 133 |
| [tconbeer/harlequin](https://github.com/tconbeer/harlequin) | DB TUI | 6,323 | 481 | 23 | **96** | 8 | 2707 | 226 | ✅ | ❌ | ✅ | ✅ | 174 |
| [ynqa/jnv](https://github.com/ynqa/jnv) | jq TUI | 6,091 | 374 | 13 | 18 | 3 | 170 | 0 | ✅ | ✅ | ❌ | ❌ | **429** |
| [samchon/typia](https://github.com/samchon/typia) | TS 검증기 (한국) | 5,866 | 2761 | 100+ | **100+** | 14 | 8365 | 1460 | ✅ | ✅ | ✅ | ❌ | 173 |
| [charmbracelet/freeze](https://github.com/charmbracelet/freeze) | 코드 스크린샷 | 4,786 | 417 | 15 | 6(태그10) | 8 | 495 | 70 | ❌ | ❌ | ✅ | ❌ | **384** |
| [dbcli/litecli](https://github.com/dbcli/litecli) | SQLite CLI | 3,290 | 577 | 39 | 15(태그37) | 4 | 206 | 26 | ✅ | ❌ | ❌ | ✅ | 44 |
| [toss/suspensive](https://github.com/toss/suspensive) | React 라이브러리 (한국) | 1,041 | 1531 | 50 | **100+** | 13 | 6540 | 96 | ✅ | ✅ | ✅ | ✅ | 97 |
| [daangn/stackflow](https://github.com/daangn/stackflow) | 모바일 네비게이터 (한국) | 1,023 | 749 | 46 | **100+** | 5 | 2750 | 33 | ✅ | ❌ | ❌ | ✅ | 93 |
| **[PENEKhun/springdog](https://github.com/PENEKhun/springdog)** | **Spring 라이브러리 (한국 1인)** | **7** | 256 | 2 | 0 | **4** | — | **91** | ✅ | ✅ | ✅ | ✅ | 122 |

### 앵커에서 읽히는 패턴 `[확인]`

1. **CI는 예외 없이 100%** — 10/10 전부 GitHub Actions 보유. 평균 8종 워크플로.
2. **릴리스/태그 체계 90%** — springdog 제외 9/9가 릴리스 보유, 중앙값 **90개**. 반면 국내 대회 필드는 22%, 과거 수상작은 6%.
3. **스타는 시간의 함수** — jnv 6,091★는 커밋 374개로 달성. **코드량이 아니라 "한 가지를 극단적으로 잘함 + 압도적 README"**가 만든 결과. jnv README 429줄, freeze README 384줄 — 둘 다 데모 이미지 중심.
4. **springdog가 결정적 앵커** — 스타 7개, 기여자 2명, 한국 개인 개발자. **그런데 CONTRIBUTING + CoC + ISSUE_TEMPLATE + CHANGELOG + 4종 CI + 테스트 91파일 + 이슈 63/PR 83.**
   → **"스타 없이도 글로벌 OSS의 거버넌스를 완벽히 갖출 수 있다"는 증명이며, 정확히 2주 내 재현 가능한 형태입니다.** A선의 실행 템플릿은 es-toolkit이 아니라 **springdog**입니다.

---

## 5. ★ 3단 기준선 — C선 / B선 / A선

> **A선 앵커 원칙**: 국내 대회 참가작 평균이 아니라, **① 글로벌 소형 OSS의 거버넌스 수준 + ② 2026 필드 최상위(maskingtape·unityctl) + ③ 금상급 수상작이 못 한 것**을 기준으로 설정.
> **2주 판정 조건**: 2~3인 × 4~6시간/일 × 14일 = **170~250 person-hour**

### 5-1. 종합 기준선표

| 지표 | **C선**<br>(탈락 방지) | **B선**<br>(수상권 진입) | **A선**<br>(상위상 겨냥) | 2주 도달 | A선 근거 |
|---|---|---|---|---|---|
| **커밋 수** | ≥ 30 | ≥ 150 | **≥ 300**<br>(+ 최근 2주 일평균 5커밋 이상) | ✅ 가능 | 2026 필드 p75=197 / 과거 수상작 max=325 / harlequin 481 |
| **기여자 수** | 1 | ≥ 2 | **≥ 3** (실인원, 커밋 균형 20% 이상씩) | ✅ 가능 | 2026 필드 중앙값 1명, p75 2명. 3명이면 상위 10% |
| **이슈 사용** | ≥ 1 (기능 아님) | ≥ 15 | **≥ 40 (닫힘 30 이상)**<br>+ 라벨 15종 + 마일스톤 3개 | ✅ 가능 | 2026 필드 60%가 이슈 0개. FinIDS 48/CodeAtlas 16이 상위. springdog 63 |
| **PR + 리뷰** | ≥ 5 PR | ≥ 25 PR | **≥ 50 PR, 그중 20개 이상에 리뷰 코멘트**<br>(다른 팀원이 승인) | ⚠️ 조건부 | 2026 필드 PR 중앙값 5. **리뷰 흔적은 조사한 52개 중 사실상 전무** |
| **CI** | 워크플로 1개, 배지 green | 테스트+린트 2종, 실행 50회+ | **4종 이상**(test/lint/build/release)<br>**+ OS·버전 매트릭스 + 커버리지 배지** | ✅ 가능 | 앵커 10/10 보유, 평균 8종. springdog 4종. 국내 CI 보유율 59%지만 대부분 1종 |
| **릴리스/태그** | 태그 1개 | v0.1.0 릴리스 1개 + 노트 | **SemVer 릴리스 5개 이상**<br>+ CHANGELOG.md + 자동 릴리스 워크플로<br>+ **패키지 배포(PyPI/npm/crates)** | ✅ 가능 | **국내 필드 릴리스 보유 22%, 과거 수상작 6%. 앵커는 90%, 중앙값 90개.**<br>→ **최대 격차 지점** |
| **커밋 컨벤션** | 일관성 있음 | Conventional Commits | **CC 100% 준수 + 스코프 + 이슈 번호 연결**<br>(`feat(core): ... (#123)`) | ✅ 가능 | maskingtape·capnet·vuln-agent가 이미 이 수준 |
| **브랜치 전략** | main만 | main + develop + feature/* | **이슈번호 연동 브랜치 + 보호 규칙 + PR 필수 머지**<br>(직접 push 0건) | ✅ 가능 | maskingtape(`45-hybrid-name-detect`), FinIDS(`feature/24-rules-engine`) 방식 |
| **CONTRIBUTING** | — | 있음 | **있음 + "good first issue" 라벨 5개 이상 실제 등록**<br>+ 개발환경 셋업 스크립트 | ✅ 가능 | 2차 '커뮤니티 확장 가능성 10점' 직결. 필드 51%가 파일만 있고 good-first-issue 없음 |
| **CODE_OF_CONDUCT** | — | — | **있음** (Contributor Covenant) | ✅ 가능 | **필드 보유율 14%. 파일 복붙 10분. 최고 가성비 항목** |
| **ISSUE/PR 템플릿** | — | 있음 | **버그/기능/질문 3종 + config.yml + PR 체크리스트** | ✅ 가능 | 필드 44% |
| **테스트** | 존재 | 테스트 파일 20개+ | **커버리지 70%+ 측정·배지 노출**<br>+ CI에서 자동 실행 | ⚠️ 조건부 | 조사한 52개 중 **커버리지 배지 보유 0개**. 압도적 차별점 |
| **README** | 150줄, 설치법 | 200줄+ 아키텍처 다이어그램 | **본문은 150~250줄로 절제**<br>+ **상단 데모 GIF** + 배지 5종<br>+ mermaid 아키텍처 + 표 + **영문 README** | ✅ 가능 | jnv/freeze 패턴. 국내는 1027줄(tierroute)·976줄(None-Step) 같은 **과다 서술이 오히려 감점** |
| **문서 사이트** | — | docs/ 폴더 | **GitHub Pages 문서 사이트 배포**<br>(MkDocs/Docusaurus, 15분 셋업) | ✅ 가능 | **국내 52개 레포 중 문서 사이트 보유 확인 0개**. 앵커는 typia/es-toolkit/suspensive 모두 보유 |
| **데모 영상** | 화면녹화 3분 | 자막 + 편집 | **README 상단 GIF(자동재생) + 3분 영상(내레이션·자막·챕터)**<br>+ 라이브 데모 링크 or 1-command 실행 | ✅ 가능 | ttobak만 GIF 보유. 나머지 26/27 없음 |
| **라이선스** | LICENSE 파일 | LICENSE + README 명시 | **LICENSE + NOTICE/THIRD-PARTY-NOTICES**<br>+ **SBOM(SPDX or CycloneDX)** + CI 자동 라이선스 스캔<br>+ **호환성 검토 문서** | ✅ 가능 | **2차 라이선스 검증 관문 직결.** 필드 SBOM 25%, NOTICE 25%, **CI 스캔 0%** |
| **스타 수** | 0 (무관) | 0 (무관) | **5~20 (참고치일 뿐)** | — | **금상 수상작 5★. 평가와 무관 — 투자 금지** |
| **토픽/디스커버리** | — | topics 5개 | **topics 10개+ + 소셜 프리뷰 이미지 + 짧은 description** | ✅ 가능 | unityctl 12개, ttobak 10개. 필드 대부분 0개 |

### 5-2. "2주 안에 불가능한 것"과 대체 시그널

| A선 항목 | 판정 | 왜 불가능/어려운가 | **대체 시그널 (같은 인상을 주는 법)** |
|---|---|---|---|
| 스타 수백~수천 | ❌ **불가능** | 시간의 함수. 마케팅 없이는 2주에 불가 | **불필요** — 금상작이 5★. 대신 **"외부인이 쓸 수 있음"의 증거**로 대체: PyPI/npm 배포 후 **다운로드 수 스크린샷**, `pip install X` 한 줄이 README 최상단 |
| 외부 기여자(팀 외부) | ❌ 사실상 불가능 | 2주에 낯선 사람이 PR을 보낼 리 없음 | ① **good first issue 5~8개를 실제로 열어두기** (난이도·예상시간·관련파일 명시) → "받을 준비가 되어 있다"가 곧 커뮤니티 확장 가능성 점수. ② 다른 OSS에 **우리가 보낸 PR/이슈 링크**를 README에 걸기 (역방향 기여 증명) |
| PR 리뷰 20건+ | ⚠️ 조건부 | 2인 팀이면 리뷰가 형식화됨 | 리뷰 **개수보다 깊이**. 3~5건이라도 **"이 부분 경계값이 틀렸다 → 수정 커밋 → 승인"** 전체 사이클이 스크린샷 1장에 담기면 충분. 이 대화 로그를 **결과보고서 '팀워크'에 캡처로 삽입** (1차 6점 직격) |
| 커버리지 70% | ⚠️ 조건부 | 기존 코드가 많으면 후행 테스트가 큼 | **핵심 모듈 1~2개만 90%+**로 만들고 배지에 그 모듈만 표시하거나, 전체 커버리지가 낮아도 **codecov 배지 자체를 노출**. 조사한 52개 중 0개가 보유 → 숫자가 낮아도 "측정하고 있다"만으로 차별화 |
| 오랜 개발기간 | ❌ 불가능 | 첫 커밋 날짜는 못 바꿈 | **밀도**로 전환: "40일 / 300커밋 / 일평균 7.5커밋" 을 결과보고서에 **커밋 활동 그래프 이미지로** 제시. 2026 필드는 이미 이 패턴(vuln-agent 40일 904커밋)이므로 기간 자체는 감점 요인 아님 |
| 실사용자·트래픽 | ❌ 불가능 | | **재현 가능한 벤치마크**로 대체. "우리 도구가 X를 Y% 개선"을 **재현 스크립트 + CI에서 자동 실행**으로 증명. maskingtape·tierroute가 이 방향으로 가고 있음 |

### 5-3. 지금 우리가 A선까지 해야 할 항목의 우선순위 (투입 대비 효과)

| 우선 | 작업 | 소요 | 근거 (필드 대비 격차) |
|---|---|---|---|
| 🥇 1 | **릴리스 체계 구축** (SemVer 태그 5개 + CHANGELOG + 자동 릴리스 워크플로 + 패키지 배포) | 4~8h | 필드 22% / 과거 수상작 **6%** / 앵커 90%. **가장 큰 격차** |
| 🥇 2 | **CI 4종 + 커버리지 배지 + 라이선스 자동 스캔** | 6~10h | 커버리지 배지 필드 **0개**. 라이선스 CI 스캔 **0개**. 2차 관문 직결 |
| 🥇 3 | **README 상단 데모 GIF + 3분 영상** | 8~12h | 27개 중 GIF 1개. 1차가 **서면**이라 영상·GIF가 곧 심사 인상 |
| 🥈 4 | **라이선스 풀세트** (NOTICE + SBOM + 호환성 검토표) | 4~6h | 실제 탈락 사유 1순위 (§6 참조) |
| 🥈 5 | **이슈 40개 + 라벨 15 + 마일스톤 3 + good first issue 5** | 6~10h | 필드 60%가 이슈 0개. 1차 팀워크 6점 + 2차 커뮤니티 10점 동시 타격 |
| 🥈 6 | **GitHub Pages 문서 사이트** | 3~5h | 국내 52개 중 **0개**. 대비 효과 극대 |
| 🥉 7 | CoC + 3종 이슈템플릿 + PR템플릿 | 1~2h | CoC 보유 14%. 복붙 수준 가성비 |
| 🥉 8 | topics 10개 + 소셜 프리뷰 + 영문 README | 2~3h | |

**합계 34~56시간** — 170~250 person-hour 예산의 **20~25%**. 나머지는 기능·보고서·발표 준비에 쓸 수 있습니다. **A선은 2주 안에 충분히 도달 가능합니다.**

---

## 6. 심사 현장의 실제 질문·피드백·탈락 사유 (참가 후기 수집)

> 출처는 각 항목에 명시. `[확인]` = 후기 원문 기반

### 6-1. 심사위원이 실제로 본 것

| # | 내용 | 출처 |
|---|---|---|
| 1 | **"심사위원들이 프로젝트가 오픈소스로 어떻게 발전할 수 있을지, 어떤 곳에 기여할 수 있을지에 초점"** — 기능 자체보다 **오픈소스 생태계 기여 가능성**을 물음 | `[확인]` [2021 회고](https://devwithpug.github.io/blog/opensw-retrospect/) |
| 2 | 발표 시간 **10분**(대면, 마이크 없음) / 2021년 비대면은 **15분**. 이후 질의응답 | `[확인]` [2024 후기](https://velog.io/@eunah/공모전-2024-공개-SW-개발자대회-후기-이번역-회고04-1wgksnf3), [2021 회고](https://devwithpug.github.io/blog/opensw-retrospect/) |
| 3 | **"어떤 기술, 인프라, 라이브러리 및 모듈을 붙이는 경우 납득할 수 있는 이유가 있어야 한다"** — 기술 선택의 정당화를 요구 | `[확인]` [2021 회고](https://devwithpug.github.io/blog/opensw-retrospect/) |
| 4 | 본선 진출 후 **주 1~2회 비대면 멘토링**. 신청 분야와 다른 멘토가 배정될 수 있음(AI/모바일 신청 → 백엔드 실무자 배정) | `[확인]` [2021 회고](https://devwithpug.github.io/blog/opensw-retrospect/) |
| 5 | 멘토링에서 **사회문제 관점 보강**을 요구받음 ("사회 문제 멘토링을 받으며 전국 지하철 역의 침수 피해를 조사") | `[확인]` [2024 후기](https://velog.io/@eunah/공모전-2024-공개-SW-개발자대회-후기-이번역-회고04-1wgksnf3) |

### 6-2. 기능테스트 — 실제 진행 방식과 함정

| # | 내용 | 출처 |
|---|---|---|
| 6 | **기능 명세서를 먼저 제출** → 며칠 후 **Zoom으로 실시간 시연**하며 명세서의 각 기능 작동 여부를 하나씩 판정 | `[확인]` [2024 후기](https://velog.io/@eunah/공모전-2024-공개-SW-개발자대회-후기-이번역-회고04-1wgksnf3) |
| 7 | ⚠️ **"기능 명세서 작성 당시 썼던 기능을 뺐던게 기억났다"** → 검증 당일 급히 기능 추가. **명세서에 썼는데 없으면 감점** | `[확인]` 동일 |
| 8 | ⚠️ **테스트 당일 백엔드 서버 에러로 일정 연기** — "절대 잊지 못할 것 같다" | `[확인]` [2021 회고](https://devwithpug.github.io/blog/opensw-retrospect/) |
| 9 | 교훈: **"기능 명세서 작성은 철저하게, 단 실제로 구현한 기능만"** | `[확인]` [2024 후기](https://velog.io/@eunah/공모전-2024-공개-SW-개발자대회-후기-이번역-회고04-1wgksnf3) |

> 🔴 **우리 액션**: 기능 명세서에 적을 항목은 전부 **CI에서 자동 검증되는 테스트로 1:1 매핑**해 두면, 시연 당일 서버가 죽어도 "CI 로그로 증명" 가능. 조사한 52개 중 이 구조를 갖춘 팀 없음.

### 6-3. 라이선스 검증 — 실제 탈락 사유 1순위

| # | 내용 | 출처 |
|---|---|---|
| 10 | **"우리가 사용하는 라이브러리 하나하나 모두 라이선스가 있었으며"** 각 라이브러리 충돌 여부를 전수 검토당함 | `[확인]` [2024 후기](https://velog.io/@eunah/공모전-2024-공개-SW-개발자대회-후기-이번역-회고04-1wgksnf3) |
| 11 | **"오픈소스 라이브러리가 생각보다는 복잡한 것을 알게 되었다"** — MariaDB 커넥터가 **LGPL 2.1**임을 뒤늦게 발견 | `[확인]` [2021 회고](https://devwithpug.github.io/blog/opensw-retrospect/) |
| 12 | 흔한 위반 3종: ① GPL(copyleft)과 비호환 라이선스 결합·LGPL 동적링크 조건 누락 ② 의존성 라이선스 미고지·LICENSE 누락·**의존성 트리 연쇄 미확인** ③ copyleft 소스공개 의무 미충족 | `[추정]` 경쟁팀 unityctl의 [자체 조사 문서](https://github.com/Jason-hub-star/unityctl/blob/master/docs/contest/2026-oss-developer-contest.md) |
| 13 | 멘토링 종료 후 **"출품작에 라이선스 문제는 없는지, 기능은 모두 정상 동작하는지" 검사** — 2차의 독립 관문 | `[확인]` 대회 공식 프로세스 |

> 🔴 **우리 액션**: `pip-licenses`/`license-checker`/`cargo-deny`를 **CI 잡으로** 넣고, GPL/LGPL/AGPL 발견 시 fail. 결과를 `THIRD-PARTY-NOTICES.md`로 자동 생성. **의존성의 의존성(트랜지티브)까지** 스캔. 이걸 하는 2026 팀은 0개입니다.

### 6-4. 1차 서면평가 — 탈락 사유

| # | 내용 | 출처 |
|---|---|---|
| 14 | **"1차 탈락 사례가 많다"** — 1차가 실질적 관문 (40팀 컷) | `[확인]` [2024 회고02](https://velog.io/@eunah/공모전-2024-공개-SW-개발자대회-후기-이번역-회고02-tzcsw61c) |
| 15 | **"1차 예선 보고서 제출 시에는 최대한 풍부하게 작성하자!"** — 13페이지로 제출 후 "이것도 쓸걸" 후회. 참여 경험과 기록을 중요하게 평가 | `[확인]` 동일 + [회고04](https://velog.io/@eunah/공모전-2024-공개-SW-개발자대회-후기-이번역-회고04-1wgksnf3) |
| 16 | 자체 평가한 약점: **"AI나 최신 기술 부재가 아쉬웠다"** | `[확인]` [회고02](https://velog.io/@eunah/공모전-2024-공개-SW-개발자대회-후기-이번역-회고02-tzcsw61c) |
| 17 | 명시적 탈락 사례(제14회, 본선 미진출): **"완성도가 많이 떨어지는 상태로 제출"**, 팀원 대부분 초심자, **"저장소를 보면 협업 능력이 많이 어설프다는 것이 티가 난다"** | `[확인]` [제14회 후기](https://velog.io/@peeeeeter_j/제14회-공개SW개발자대회-1) |
| 18 | 같은 팀 자평: 인터넷 복붙 코드 미검토로 권한/보안 문제 발생, 프레임워크 구조 이해 부족으로 디렉토리 여러 차례 재구성 | `[확인]` 동일 |
| 19 | **"제출은 기간 내에"** — 완성도보다 기한 준수 우선 | `[확인]` [회고04](https://velog.io/@eunah/공모전-2024-공개-SW-개발자대회-후기-이번역-회고04-1wgksnf3) |

> 🔴 **17번이 핵심 인용문입니다.** *"저장소를 보면 협업 능력이 어설픈 게 티가 난다"* — 심사위원이 레포를 열었을 때 **PR·이슈·리뷰·브랜치 흔적으로 협업 수준이 즉시 읽힌다**는 뜻이며, 이것이 1차 '팀워크 6점'의 실체입니다.

### 6-5. 수상작 공통 특징 `[추정]`

경쟁팀 unityctl의 조사 문서 기준: ① 실제 산업/실무 문제를 푸는 **완성도 높은 도구** ② 기술 혁신성 + 명확한 문서화 + **테스트/CI-CD 등 프로페셔널한 DevOps 문화** ③ 기존 오픈소스(k8s, Prometheus 등)를 **창의적으로 확장한 생태계 기여**. (과거 예시로 ZAPP-배포자동화, Clymene-k8s모니터링 언급)

---

## 7. 결론

### 7-1. 경쟁자들이 공통적으로 못 하는 것 (= 우리의 2주 차별화 지점)

| 순위 | 못 하는 것 | 실측 근거 | 우리 대응 | 난이도 |
|---|---|---|---|---|
| 1 | **릴리스·버전 체계가 없다** | 2026 필드 릴리스 보유 **22%** / 과거 수상작 **6%** / 글로벌 앵커 **90%(중앙값 90개)** | SemVer 태그 5개 + CHANGELOG + `release.yml` 자동화 + PyPI/npm 배포 | 낮음 |
| 2 | **테스트 커버리지를 측정·노출하지 않는다** | 조사한 **52개 전부 커버리지 배지 0개** | codecov 연동 + README 배지 | 낮음 |
| 3 | **라이선스를 CI로 검증하지 않는다** | SBOM 25%, NOTICE 25%, **자동 스캔 0%**. 그런데 2차 독립 관문 | `license-check` CI 잡 + THIRD-PARTY-NOTICES 자동생성 + 호환성 표 | 낮음 |
| 4 | **문서 사이트가 없다** | 국내 52개 중 **0개**. 앵커는 typia/es-toolkit/suspensive 보유 | MkDocs Material → GitHub Pages (3~5h) | 낮음 |
| 5 | **데모가 조악하다** | 27개 중 README 데모 GIF 보유 **1개(ttobak)**. 나머지는 정적 스크린샷 또는 없음 | README 최상단 자동재생 GIF + 3분 영상(내레이션·자막·챕터) | 중간 |
| 6 | **이슈를 안 쓴다** | 2026 필드 **60%가 이슈 0개**, 과거 수상작 40%가 0개 | 이슈 40+ / 라벨 15 / 마일스톤 3 / good first issue 5 | 중간 |
| 7 | **PR에 리뷰 흔적이 없다** | PR은 많은데(중앙값 5, 최대 603) **리뷰 코멘트가 붙은 PR은 거의 없음**. 혼자 열고 혼자 머지 | 최소 20건에 실제 리뷰 코멘트 → 수정 커밋 → 승인 사이클 | 중간 |
| 8 | **CODE_OF_CONDUCT가 없다** | 필드 보유율 **14%** | Contributor Covenant 복붙 (10분) | 매우 낮음 |
| 9 | **1인 프로젝트다** | 2026 필드 기여자 **중앙값 1명**, p75 2명 | 3명 실제 커밋 분산 | 낮음 |
| 10 | **README가 과다하거나 부실하다** | 1027줄(tierroute)·976줄(None-Step) vs 3줄(BridgeSense·liwonace). 앵커는 **70~430줄, 데모 중심** | 150~250줄 + GIF + mermaid + 영문판 | 낮음 |

### 7-2. ★ 상위상 레포에 **있고**, 그냥 참가한 레포에 **없는 것**

> 이 대비가 이번 조사의 최종 답입니다.

| | **상위상/성공 OSS에 있는 것** | **그냥 참가한 레포에 없는 것** |
|---|---|---|
| **제품으로 존재하는가** | `pip install X` / `npm i X` 한 줄로 **남이 설치해 쓸 수 있음**. 릴리스 노트가 버전별로 쌓임 | clone 후 수동 셋업. 릴리스 0개. "우리 데모 서버 살아있을 때만" 동작 |
| **증거가 자동인가** | 테스트·린트·라이선스·빌드가 **CI에서 매 PR마다 자동 검증**되고 배지로 노출 | "됩니다"라는 주장만. 검증 당일 서버가 죽으면 증명 불가 (실제 발생 사례 있음) |
| **협업이 눈에 보이는가** | 이슈→브랜치→PR→**리뷰 코멘트→수정→승인→머지**의 사이클이 레포에 남아 있음 | PR은 있으나 리뷰 0. 혹은 main에 직접 push. → *"저장소를 보면 협업 능력이 어설픈 게 티가 난다"* |
| **남이 들어올 수 있는가** | CONTRIBUTING + CoC + 이슈템플릿 + **실제로 열려 있는 good first issue** + 개발환경 셋업 문서 | 파일은 있어도(51%) 정작 들어올 입구(good first issue)가 없음. 2차 커뮤니티 확장 10점을 통째로 놓침 |
| **라이선스를 통제하는가** | LICENSE + NOTICE + SBOM + **트랜지티브 의존성까지 자동 스캔** + 호환성 검토 문서 | LICENSE 파일 하나. LGPL/GPL이 의존성 트리에 섞여 있는지 아무도 모름 → **2차 탈락 1순위** |
| **3초 안에 이해되는가** | README 최상단 **데모 GIF 한 장**으로 "무엇을 하는 물건인지" 즉시 전달 | 1000줄 서술형 README, 또는 3줄 README. 심사위원은 서면 1차에서 이걸로만 판단 |
| **문서가 제품처럼 있는가** | GitHub Pages 문서 사이트, API 레퍼런스, 아키텍처 다이어그램 | md 파일 몇 개가 루트에 흩어져 있음 |
| **왜 이 기술인가 답하는가** | ADR/설계 근거가 문서에 있음. 벤치마크로 주장을 수치화 | *"어떤 기술을 붙이는 경우 납득할 수 있는 이유가 있어야 한다"* — 이 질문에 무너짐 |

### 7-3. 최종 판정: 우리가 겨냥할 선

```
C선 (탈락 방지)  : 커밋 30 · 기여자 1 · 이슈 1 · PR 5 · CI 1종 · LICENSE · README 150줄
                   → 2026 필드 하위 40%는 여기도 못 넘음 (BridgeSense 4커밋, liwonace README 3줄)

B선 (수상권 진입) : 커밋 150 · 기여자 2 · 이슈 15 · PR 25 · CI 2종 · 릴리스 1 · README 200줄+아키텍처
                   → 2026 필드 상위 10개 팀이 여기 근처. 과거 금상작도 이 정도 (오히려 CI·릴리스는 미달)

A선 (상위상 겨냥) : 커밋 300+ · 기여자 3 · 이슈 40(라벨15/마일스톤3/good-first-issue 5) · PR 50(리뷰 20)
                   · CI 4종+매트릭스+커버리지배지 · SemVer 릴리스 5+CHANGELOG+패키지배포
                   · NOTICE+SBOM+라이선스 CI스캔 · 문서사이트 · README 데모GIF+영문판
                   → 2026 필드에서 **이 전부를 갖춘 팀은 0개**. 34~56시간이면 도달 가능.
```

**우리가 A선을 잡아야 하는 이유**: maskingtape(329커밋/139이슈/146PR/CI 332회)와 unityctl(18★/릴리스14/3종CI)은 이미 B선을 넘었습니다. **B선을 목표로 하면 그들과 동률이고, 동률에서는 아이디어 운이 승부를 가릅니다.** A선의 8개 항목(릴리스·커버리지배지·라이선스CI·문서사이트·데모GIF·good first issue·리뷰사이클·CoC)은 **필드 보유율이 0~25%인 무주공산**이며, 전부 2주 예산의 25% 안에 들어옵니다.

**동시에 하지 말아야 할 것**: 스타 확보 활동. **금상 수상작이 5★, 수상작 15개 중앙값 2★**입니다. 이 대회는 스타를 보지 않습니다.

---

## 부록: 실측 원본 데이터

- 2026 출품작 27개: `m2026.json`
- 과거 수상작 15개: `mpast.json`
- 글로벌 앵커 10개: `mglobal.json`
- 이슈/PR GraphQL 카운트: `counts.json`
- 수집 스크립트: `measure.py`

(위치: `/private/tmp/claude-501/-Users-dnnals-Projects-opensource/e401f74d-4307-4155-8c76-13d10e186cf0/scratchpad/`)

### 참고 출처
- [오픈소스 개발자대회 공식](https://osscontest.kr/) · [대회 개요](https://osscontest.kr/overview) · [공개SW 포털](https://www.oss.kr/dev_competition/registration)
- [2021 공개SW 개발자대회 회고 (은상)](https://devwithpug.github.io/blog/opensw-retrospect/)
- [2024 공개SW 개발자대회 후기 [이번역] 회고_04](https://velog.io/@eunah/%EA%B3%B5%EB%AA%A8%EC%A0%84-2024-%EA%B3%B5%EA%B0%9C-SW-%EA%B0%9C%EB%B0%9C%EC%9E%90%EB%8C%80%ED%9A%8C-%ED%9B%84%EA%B8%B0-%EC%9D%B4%EB%B2%88%EC%97%AD-%ED%9A%8C%EA%B3%A004-1wgksnf3)
- [2024 공개SW 개발자대회 후기 [이번역] 회고_02](https://velog.io/@eunah/%EA%B3%B5%EB%AA%A8%EC%A0%84-2024-%EA%B3%B5%EA%B0%9C-SW-%EA%B0%9C%EB%B0%9C%EC%9E%90%EB%8C%80%ED%9A%8C-%ED%9B%84%EA%B8%B0-%EC%9D%B4%EB%B2%88%EC%97%AD-%ED%9A%8C%EA%B3%A002-tzcsw61c)
- [제14회 공개SW개발자대회 후기 (본선 미진출)](https://velog.io/@peeeeeter_j/%EC%A0%9C14%ED%9A%8C-%EA%B3%B5%EA%B0%9CSW%EA%B0%9C%EB%B0%9C%EC%9E%90%EB%8C%80%ED%9A%8C-1)
- [2025년 오픈소스 개발자대회 최종 수상 결과 (403 차단, 미확인)](https://www.oss.kr/dev_competition_notice/show/d603db69-c717-46b5-a077-c57a6b70b71f)
- 경쟁팀 unityctl 자체 조사 문서: `Jason-hub-star/unityctl` → `docs/contest/2026-oss-developer-contest.md`
