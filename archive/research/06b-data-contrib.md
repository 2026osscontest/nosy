# 06b — 데이터 엔진·분석·스토리지 생태계 기여 빈틈 조사

조사일: 2026-08-16 (D-11)
조사자: 리서처 / 조사 방식: `gh api` 이슈·PR 직접 검색 + **로컬 실물 실행 검증**(DuckDB 1.5.5, Polars 1.43.2 설치 후 직접 실행)
전제: 2~3인 × 하루 4~6시간 × 2주 = 170~250 person-hour / 제출물 = 대표 저장소 1개 + 결과보고서 + 시연영상 3분

> **결론 요약**: 이 축에서 **단독으로 통과선(85점)을 넘길 후보는 나오지 않았다.**
> 가장 유력했던 두 가설("DuckDB가 한글 인코딩을 못 읽는다", "DuckDB에 초성 검색이 없다")은
> **둘 다 실물 실행으로 반증됐다.** 조건부 생존 2개만 남았고, 둘 다 단독 출품작으로는 얇다.
> 억지로 후보를 만들지 않고 반증 기록을 그대로 남긴다.

---

## 0. 이번 라운드의 핵심 — 실물 실행으로 죽인 것들

직전 라운드에서 후보 4개가 "빈틈인 줄 알았는데 이미 있었다"로 사망했다. 이번에는 **검색이 아니라 실행**으로 검증했다. 그 결과 **가장 유력했던 가설 2개가 죽었다.**

### 0-1. [확인/실행] "DuckDB는 EUC-KR/CP949를 못 읽는다" → **거짓. 공식 확장이 이미 있다**

`duckdb/duckdb-encodings` 확장이 이미 존재한다. ICU charset 데이터 기반 **1,040개 인코딩** 지원.

- 저장소: https://github.com/duckdb/duckdb-encodings (MIT, 생성 2025-04-08, DuckDB **공식 org**)
- 테스트 파일 `test/sql/encodings.test`에 다음 토큰이 실재: `cp949`, `Cp949`, `EUC_KR`, `euc_kr`, `JOHAB`, `Johab`, `windows-949`, `ibm-949`, `KSC`, `ksc`
  - 확인 명령: `gh api repos/duckdb/duckdb-encodings/contents/test/sql/encodings.test --jq '.content' | base64 -d | grep -io "euc[-_]kr\|cp949\|johab\|windows-949"`

**로컬 실행 검증** (DuckDB 1.5.5, CP949로 인코딩한 한글 CSV 직접 생성 후 읽기):

```python
# 파일: 이름,부서,금액 / 홍길동,기획재정부,1000 ... 을 cp949로 저장
c.sql("INSTALL encodings; LOAD encodings;")          # → LOADED
c.sql("select * from read_csv('k_cp949.csv', encoding='cp949')").fetchall()
# → [('홍길동', '기획재정부', 1000), ('김철수', '행정안전부', 2000)]   ✅ 정상 동작
```

**판정**: "한글 인코딩을 못 읽는다"는 빈틈은 **존재하지 않는다.** DuckDB 축에서 이 방향은 전면 폐기.

보조 확인: `repo:duckdb/duckdb CP949` 이슈 검색 → `total_count: 0`, `EUC-KR` → `total_count: 0`. **이슈 트래커에 수요 신호조차 없다.** 이미 해결됐기 때문이다.

### 0-2. [확인/실행] "DuckDB에 한글 정규화·정렬이 없다" → **거짓. 코어에 이미 있다**

DuckDB 1.5.5 내장 함수 945개를 직접 열거해 확인했다.

```sql
select distinct function_name from duckdb_functions()
where function_name ~ '.*(nfc|nfd|norm|accent|collate|jamo|hangul|kor).*'
```

- **`nfc_normalize` 존재** — 실행 확인: `select nfc_normalize('각') = '각'` → `True`
- **`strip_accents` 존재**
- **`icu_collate_ko` 존재** — 한국어 ICU 콜레이션이 코어에 이미 포함 (`icu_collate_ja`, `icu_collate_zh` 등과 함께 총 130여 개 로케일)

**판정**: 정규화·정렬 축은 이미 채워져 있다. 남은 것은 자모 분해/초성 계열뿐인데, 그것도 아래에서 죽는다.

### 0-3. [확인/실행] ★ **"DuckDB에 초성 검색이 없다" → 함수는 없지만, 순수 SQL로 지금 당장 된다**

**이번 조사에서 가장 중요한 발견이다. 후보 하나를 죽이는 정보다.**

한글 음절은 `U+AC00 + (초성×588 + 중성×28 + 종성)`이라는 순수 산술 구조라, 확장 없이 DuckDB 내장 함수(`string_split`, `unicode`, `list_transform`, `list_reduce`)만으로 초성 추출이 **완전히 표현 가능하다.**

```sql
-- 확장 없이, DuckDB 1.5.5 순수 SQL로 동작하는 초성 추출식
list_reduce(
  list_transform(
    string_split(name, ''),
    ch -> CASE WHEN unicode(ch) BETWEEN 44032 AND 55203
               THEN 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'[((unicode(ch) - 44032) // 588) + 1]
               ELSE ch END),
  (a, b) -> a || b)

-- 실사용 형태
SELECT count(*) FROM biz WHERE <위 식> LIKE 'ㄱㅂㅊ%';
```

**로컬 실측** (200만 행, 상호명 8종 반복, DuckDB 1.5.5, M-series macOS):

| 방식 | 결과 | 시간 |
|---|---:|---:|
| `name LIKE '김밥%'` (기준선) | 250,000 | **0.00s** |
| **순수 SQL 초성 매칭** (`LIKE 'ㄱㅂㅊ%'`) | 250,000 | **0.19s** |
| Python UDF | — | **미측정** (numpy 미설치로 첫 시도 실패, 재측정 중 세션 한도) |

**판정 — 이 사실이 왜 치명적인가**:
1. 심사위원이 *"그거 SQL로 되잖아요?"* 라고 물으면 **실제로 된다.** 20줄짜리 반례를 그 자리에서 실행할 수 있다.
2. 200만 행 0.19초는 "느려서 못 쓴다"고 주장할 수 없는 수준이다. 확장을 만들어도 **정량 지표가 안 나온다**(활용성·데모 배점 직격).
3. 남는 가치는 "가독성·편의성"뿐인데, 이는 **매크로 한 줄**(`CREATE MACRO chosung(s) AS ...`)로 끝난다. C++ 확장을 2주 들여 만들 근거가 되지 못한다.

→ **`duckdb-hangul` 확장 후보는 이 발견으로 사실상 사망.** (잔존 논거는 §2-A 참조, 그러나 약함)

### 0-4. [확인/실행] Polars 인코딩 — 여기는 **일부 살아있다**

Polars 1.43.2를 설치해 직접 실행했다.

| 호출 | 결과 |
|---|---|
| `pl.read_csv("k_cp949.csv", encoding="cp949")` | ✅ **동작** (2,3) |
| `pl.scan_csv("k_cp949.csv", encoding="cp949")` | ❌ `ValueError: csv 'encoding' must be one of {'utf8', 'utf8-lossy'}` |
| `pl.DataFrame(...).write_csv("w.csv", encoding="cp949")` | ❌ `TypeError: write_csv() got an unexpected keyword argument 'encoding'` |

Polars **자체 docstring이 한계를 명시**한다 (`polars/io/csv/functions.py:204-208`):
> "When using other encodings than `utf8` or `utf8-lossy`, **the input is first decoded in memory with python.**"

구현부 (`functions.py:497`): `encoding_supported_in_lazy = encoding in {"utf8", "utf8-lossy"}`

**즉 CP949는 "못 읽는" 게 아니라 "게으르게(lazy/streaming) 못 읽는다".** 전체 파일을 Python으로 메모리에 디코드한 뒤에야 파싱이 시작된다.

**메모리 실측** (직접 생성한 340만 행 한글 CSV, CP949 202MB / UTF-8 252MB):

| 시나리오 | peak RSS | 시간 |
|---|---:|---:|
| `read_csv(cp949)` 전체 로드 | **959 MB** | 1.0s |
| `scan_csv(utf8)` lazy count | 313 MB | 0.2s |
| `read_csv(cp949)` + group_by 집계 | **1,022 MB** | 1.0s |
| `scan_csv(utf8)` + group_by, `engine="streaming"` | **502 MB** | 0.1s |

→ 동일 데이터에서 **메모리 약 2배, 시간 약 10배.** 파일 크기에 비례해 peak가 무한히 증가하는 구조라, 수 GB급 CP949 파일은 원리적으로 OOM.

**부수 발견(기술적 난이도 증거)**: 이 벤치마크용 UTF-8 변환 스크립트를 4MB 청크로 단순 디코드했더니 즉시 실패했다.
`UnicodeDecodeError: 'cp949' codec can't decode byte 0xbd in position 4194303: incomplete multibyte sequence`
→ **멀티바이트 경계 처리**가 스트리밍 트랜스코딩의 실제 난점이며, `codecs.getincrementaldecoder`로 해결해야 했다. 플러그인을 만든다면 이것이 코어 난이도다.

---

## 1. 반증 통과 여부 — 후보 전수 판정표

| # | 후보 가설 | 반증 시도 | 결과 |
|---|---|---|---|
| 1 | DuckDB가 EUC-KR/CP949 CSV를 못 읽는다 | 공식 `duckdb-encodings` 확장 발견 + **로컬 실행 성공** | **사망** |
| 2 | DuckDB에 한글 NFC 정규화·한국어 정렬이 없다 | `duckdb_functions()` 실행 → `nfc_normalize`, `icu_collate_ko` 존재 | **사망** |
| 3 | DuckDB에 초성 검색이 없다 → 확장 제작 | **순수 SQL로 구현·실행 성공 (200만 행 0.19s)** | **사망** (§0-3) |
| 4 | DuckDB Iceberg 확장에 미구현 영역이 있다 | `duckdb-iceberg` open 이슈 **82건**, DuckDB Labs가 8월에도 매일 커밋 | **사망**(레드오션) |
| 5 | 한국 공공 API를 DuckDB 확장으로 (sistat 선례) | 선례는 실재하나, 직전 라운드 `datago-mcp-gen`(73.6점)과 동일 축·저기술깊이 | **사망**(중복) |
| 6 | 한글 형태소 분석 확장 | mecab-ko-dic 사전 라이선스 + 2주 내 정확도 증명 불가 (G7) | **사망** |
| 7 | Polars 한국어 레거시 인코딩 스트리밍 IO 플러그인 | 이슈 open + 유지보수자 out-of-scope 선언 + 실행 실패 확인 | **조건부 생존** (§2-B) |
| 8 | DuckDB 한글 텍스트 확장(초성 외 규칙 함수) | 존재 반증은 통과, 그러나 §0-3이 핵심 논거를 파괴 | **조건부 생존, 약함** (§2-A) |
| 9 | DuckDB spatial 비-UTF8 shapefile(.dbf) | 이슈는 실재하나 업스트림 소형 PR — **우리 저장소에 아무것도 안 남음** | **사망**(출품작 불성립, §3) |
| 10 | DuckDB CSV **쓰기** 인코딩 미지원 | 실행으로 확인됐으나 코어 1-옵션 수준 | **사망**(규모 미달, §3) |

### 1-1. 존재 반증은 통과한 항목 (= "없는 건 맞다")

아래는 실제로 검색해서 **없음을 확인**했다. 다만 없다는 것이 곧 후보 성립은 아니다.

- DuckDB 커뮤니티 확장 **전체 목록 약 300개**를 열거 — 한국·한글 관련 **0건**
  - `gh api repos/duckdb/community-extensions/contents/extensions --jq '.[].name'`
  - 참고로 국가 특화 선례는 실재: `sistat`(슬로베니아 통계청), `eurostat`, `sudan`, `us_address_standardizer`
- `gh search repos "duckdb korean"` / `"duckdb hangul"` / `"duckdb euc-kr"` / `"hangul duckdb"` → **전부 0건**
- `repo:duckdb/community-extensions korean OR hangul OR korea` → 1건이나 오탐(`hnsw_acorn`)
- `repo:apache/datafusion korean OR hangul` → **0건**
- `repo:ClickHouse/ClickHouse hangul OR chosung` → **0건**
- 한국 주소 파싱 OSS: `donkko/address-standardization`(2016-12, 사실상 사망) 외 **현대적 구현 없음**

### 1-2. [확인] 생태계 비대칭 — 이 축의 유일한 강한 서사

| 생태계 | 한국어 텍스트 지원 | 근거 |
|---|---|---|
| PostgreSQL | **있음** | `i0seph/textsearch_ko`(BSD-2, mecab-ko-dic), `pgbigm/pg_bigm`, `pgroonga/pgroonga` |
| Elasticsearch | **있음** | 공식 Nori 분석기 + `punxism/elasticsearch-hangul-jamo-plugin` |
| JavaScript | **있음** | `toss/es-hangul` (MIT, ★1,859) |
| **DuckDB / Polars / DataFusion / ClickHouse** | **전무** | 위 §1-1 검색 결과 전부 0건 |

이 비대칭 자체는 사실이고 발표 서사로 강하다. **그러나 §0-3이 "그래서 필요한가"에 대한 반례를 제공하므로, 서사만으로는 활용성 점수가 나오지 않는다.**

---

## 2. 조건부 생존 후보 (2개) — 둘 다 단독으로는 얇음

### A. `duckdb-hangul` — 한글 규칙 기반 텍스트 함수 확장 · **약함, 비추천**

1. **구체적 대상**: DuckDB 커뮤니티 확장으로, 순수 SQL로 표현 불가능한 한글 **규칙 기반** 함수(표준 발음법, 로마자 표기법, 조사 자동선택, 두벌식↔QWERTY 변환)를 제공.
2. **왜 비어 있는가**: [확인] 커뮤니티 확장 300개 중 0건, GitHub 검색 0건. "어려워서"가 아니라 **한국어 사용자가 DuckDB 확장 저자층에 없어서**(관심 부재형).
3. **2주 실현성**: **가능**. 자모 산술은 순수 정수 연산이고, [확인] `toss/es-hangul`(MIT)이 **완성된 명세 + spec 파일 38개**를 제공해 골든셋을 그대로 이식 가능. API 표면: `assemble/disassemble/getChoseong/getJungseong/getJongseong/hasBatchim/josa/romanize/standardizePronunciation/convertQwertyToHangul` 등. Rust 크레이트 재료도 존재(`hangul` 29,810dl, `unic-ucd-hangul` 584,407dl).
4. **출품작 성립**: ○ 독립 확장 저장소 + 골든셋 테스트 + `description.yml` PR.
5. **시연**: `INSTALL hangul FROM community; LOAD hangul;` 후 쿼리 — 시각적으로 평범.
6. **정량 지표**: **여기서 죽는다.** §0-3 때문에 초성 성능 이득을 주장할 수 없고, 나머지 함수는 "몇 개 구현했다" 외에 숫자가 없다.
7. **라이선스**: MIT로 깨끗. es-hangul(MIT) 명세 참조 가능. **형태소 분석은 반드시 제외**(mecab-ko-dic 사전 라이선스 리스크).

**치명적 반론 (대응 불가)**: *"초성 검색은 SQL로 되던데요"* → 실제로 된다(0.19s/200만 행). 남는 `josa`·`romanize`는 **분석 워크로드가 아니라 애플리케이션 계층 기능**이라 "왜 DB 엔진에 넣나"에 답하기 어렵다. **채택 비추천.**

### B. `polars-krcsv` — Polars 레거시 인코딩 스트리밍 IO 플러그인 · **조건부**

1. **구체적 대상**: `pyo3-polars`의 `register_io_source` 기반 Polars IO 플러그인으로, CP949/EUC-KR CSV를 **전체 메모리 디코드 없이 스트리밍 스캔**(lazy)하고 CP949로 쓰기까지 지원.
2. **왜 비어 있는가**: **관심 부재가 아니라 명시적 거부.** [확인] 유지보수자 orlp: *"Non-UTF-8 encoded CSVs are out-of-scope for Polars."* (https://github.com/pola-rs/polars/issues/26244)
   - https://github.com/pola-rs/polars/issues/28705 — "scan_csv does not support cp949 encoding." **2026-08-05 open, 댓글 0, label: enhancement** (한국어 사용자가 11일 전에 올린 이슈)
   - https://github.com/pola-rs/polars/issues/25423 — windows-1252 scan_csv, 2025-11-20 open, 댓글 4 ("3년 전 #7461에서도 같은 요청, 계획 없다고 답변받음")
   - https://github.com/pola-rs/polars/issues/28803 — write_csv encoding, 2026-08-13 open
   - https://github.com/pola-rs/polars/issues/11476 — write_csv encoding, **2023-10-03 open, 약 3년 미해결**
   - 제목에 `encoding` 포함 open 이슈 **14건**
   → **업스트림이 안 할 것이 확정**이므로 서드파티 플러그인이 유일한 정답 경로. 이것이 이 후보의 최대 강점.
3. **2주 실현성**: **조건부**. Rust 학습 비용 + `pyo3-polars` IO plugin API. 재료는 유리 — `encoding_rs` 크레이트가 EUC-KR을 커버, 멀티바이트 경계 처리는 incremental decoder 패턴으로 해결(§0-4에서 실제로 부딪히고 해결함). **구조적 선례 존재**: `jrothbaum/polars_readstat`(SAS/Stata/SPSS를 읽는 Polars IO 플러그인) — 정확히 같은 형태의 서드파티 플러그인이 이미 성립함을 증명.
4. **출품작 성립**: ○ PyPI 배포 패키지 + 저장소. 업스트림 PR 의존 없음.
5. **시연**: **이 축 후보 중 유일하게 영상이 강하다.** 수 GB CP949 파일에 `pl.read_csv` → 메모리 그래프 급상승 → OOM. 같은 파일에 우리 플러그인 → 평탄한 메모리 곡선으로 완주. 실측 peak RSS 대비 그래프.
6. **정량 지표**: [확인/실측] 202MB 파일 기준 peak RSS 1,022MB → 목표 200MB대(약 5배 절감), 집계 시간 1.0s → 0.1s대. 파일 크기 대비 peak 선형성 그래프. 지원 인코딩 수.
7. **라이선스**: Polars는 MIT, `pyo3-polars` MIT, `encoding_rs`는 Apache-2.0/MIT 듀얼. **GPL/AGPL/Elastic 계열 없음.** 깨끗.

**약점 (통과선 미달 사유)**:
- 범위가 **"인코딩 하나"**로 보인다. 심사위원 한 문장 요약이 "CSV 인코딩 플러그인"이 되면 혁신성·활용성에서 회복 불가.
- `read_csv`는 **이미 동작한다.** "못 읽는다"가 아니라 "메모리를 2배 쓴다"라서 통증 강도가 약하다. 실측 2배는 "OOM 난다"만큼 극적이지 않다(수 GB 파일에서만 극적).
- Polars 유지보수자가 out-of-scope라고 한 영역이라, **업스트림 병합 = 커뮤니티 확장 가능성 증명 경로가 막혀 있다.** 직전 채점에서 상하위를 가른 것이 바로 이 20점 구간이었다(`05-idea-scoring.md` §4-1).

---

## 3. 출품작 불성립으로 탈락 (사실은 맞으나 저장소에 아무것도 안 남음)

기여 자체는 가치 있으나 **"우리 저장소에 무엇이 남는가"에 답이 없어** 탈락. 다만 다른 후보의 **보조 기여 이력**으로는 쓸 수 있다.

| 항목 | 확인된 사실 | 탈락 사유 |
|---|---|---|
| **DuckDB CSV 쓰기 인코딩** | [실행] `COPY (...) TO 'out.csv' (FORMAT CSV, ENCODING 'cp949')` → `Invalid Input Error: Option "ENCODING" is not supported for writing - only for reading`. `duckdb-encodings` README도 "currently only performs encoding when reading data" 명시 | 코어 옵션 1개 추가 수준. 업스트림 PR만 남고 출품 저장소가 없음 |
| **duckdb-spatial 비-UTF8 shapefile** | [확인] `#394`(2024-09-10 open, **약 2년 미해결**), `#356`(2024-06-30 open), `#744`(2025-12-10 open). encoding 관련 이슈 19건. 한국 공간데이터(국가공간정보포털·도로명주소 전자지도) `.dbf`는 전부 CP949 | GDAL `SHAPE_ENCODING` 설정 노출 수준의 소형 PR. 동일 |
| **duckdb-iceberg** | [확인] open 이슈 82건, 2026-08-05~15에만 신규 12건. DuckDB Labs가 직접·집중 유지보수 중 | 유급 유지보수자와 경쟁. 2주 팀이 의미 있는 자리를 못 잡음 |

**참고 — 커뮤니티 확장 등재는 실제로 빠르다** [확인]: `duckdb/community-extensions` PR 병합 지연이 **0~1일**이다.
`#2484 Add cloudwatch 0.1.0` 2026-08-10 생성 → 08-11 병합 / `#2485 Add gcloud_observability` 08-10 → 08-11 / `#2498 Add anofox_optimize` 08-14 → 08-14 당일.
제출 요건은 `extensions/<name>/description.yml` **파일 1개 PR**, Rust 허용, CMake만 지원, 공개 GitHub + 라이선스 필수 (https://duckdb.org/community_extensions/documentation.html).
→ **대회 기간 내 공식 등재가 물리적으로 가능하다.** 이 축에서 좋은 후보가 나왔다면 "커뮤니티 확장 가능성 10점"을 실물로 증명할 수 있었을 것이다. 후보가 없어서 못 쓰는 카드다.

---

## 4. 경쟁 필드 확인

[확인] `04-competitor-repos.md`·`03-tech-trends-2026.md`를 `duckdb|polars|arrow|iceberg|한글|초성|형태소|인코딩|cp949|hangul`로 전수 검색 → **2026 경쟁 27팀 중 데이터 엔진·한글 텍스트 축 참가팀 0건.**

즉 **경쟁은 없다.** 그럼에도 후보를 추천하지 않는 이유는 경쟁 때문이 아니라, **빈틈 자체가 실물 검증에서 무너졌기 때문**이다.

---

## 5. 미조사 영역 (시간 부족으로 손대지 못함)

다음 라운드가 있다면 여기서부터. 위 결론은 이 영역들을 **포함하지 않은** 상태의 결론이다.

1. **dbt / SQLMesh / Airflow 어댑터·플러그인 갭** — 전혀 조사 못 함. 어댑터 부재 목록 미확인.
2. **한국 금융·의료 표준 포맷** — HL7 FHIR 한국 프로파일, 심평원 EDI 청구 포맷, 금융권 표준. **도메인 지식 해자가 가장 클 수 있는 영역인데 미조사.**
3. **행정표준코드·법정동/행정동 코드 체계** — 시계열 변경 이력 추적(코드 통폐합) 문제. `vuski/admdongkor` 저장소 존재만 확인.
4. **Delta Lake / Hudi 언어 바인딩 갭** — 미조사 (Iceberg만 확인).
5. **Arrow IO 포맷 / DataFusion 미구현 함수** — DataFusion open 이슈 중 "missing" 제목 11건 확인했으나 내용 미열람.
6. **ClickHouse 확장 생태계 / pgvector 주변** — 미조사.
7. **DuckDB v1.5.3 Quack Remote Protocol 주변 미구현 영역** — 미조사.
8. **HWP/HWPX를 DuckDB 테이블 함수로**(`read_hwpx()`) — 파서는 다수 존재 확인(`KimDaehyeon6873/hwp-hwpx-parser`, Rust `hwpers` 7,712dl), 엔진 통합은 부재. 유일하게 미조사분 중 후보 가능성이 남은 항목이나, **HWP는 문서 포맷이지 분석 포맷이 아니라는 근본 문제**가 있음.
9. **Python UDF 대비 네이티브 확장 성능 배수** — §0-3에서 측정 실패(세션 한도). 후보 A를 되살리려면 이 숫자가 필요하나, 애초에 순수 SQL이 0.19s라 되살아나기 어려움.

---

## 6. 최종 판정

**이 축(데이터 엔진·분석·스토리지)에서 통과선 85점을 넘길 후보는 발굴되지 않았다.**

- 유력 가설 3개(인코딩 읽기 / 정규화·정렬 / 초성 검색)가 **전부 실물 실행으로 반증**됐다. 특히 §0-3의 순수 SQL 초성 검색은 심사장에서 그대로 반례로 실행 가능한 형태라, 해당 후보를 되살릴 방법이 없다.
- 조건부 생존 2개 중 A(`duckdb-hangul`)는 **비추천**, B(`polars-krcsv`)는 기술적으로 정당하고 라이선스도 깨끗하며 시연 영상이 강하지만, **범위가 "CSV 인코딩 플러그인" 한 문장으로 축소되고 업스트림이 out-of-scope를 선언해 커뮤니티 확장 경로가 막혀 있다.** 직전 채점에서 상하위를 가른 2차 20점 구간(커뮤니티 확장 + OSS 적절성)에서 점수가 나오지 않는다.
- 따라서 **다른 두 축(임베디드·AI 인프라)의 강한 후보를 채택할 것을 권고한다.** B는 그 후보들이 모두 무너졌을 때만 꺼내는 3순위 예비안으로 남긴다.

**부수 소득**: `duckdb/community-extensions`의 병합 지연이 0~1일이라는 사실(§3)은 **다른 축의 후보가 DuckDB 확장 형태를 취할 수 있다면** "커뮤니티 확장 가능성 10점"을 대회 기간 내 실물로 증명할 수 있는 카드다. 이 축 밖에서 재활용할 가치가 있다.
