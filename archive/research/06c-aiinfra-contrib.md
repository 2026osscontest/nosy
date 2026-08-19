# 06c — AI 인프라 오픈소스 "2주 기여 가능한 실제 빈 구멍" 발굴

조사일: 2026-08-16 (D-11)
조사자: 리서처
팀 조건: 2~3인 × 하루 4~6시간 × 2주 = **170~250 person-hour**, **NVIDIA GPU 없음**, macOS 개발 환경
표기: `[확인]` = 이슈/코드/CI를 직접 조회해 검증 · `[추정]` = 직접 검증 못 한 추론

---

## 0. 결론 요약

| 순위 | 후보 | 대상 저장소 | GPU 필요 | 판정 |
|:--:|---|---|:--:|---|
| **1** | **ggml WebGPU 백엔드 미구현 연산자 이식** | `ggml-org/llama.cpp` | **불필요**(맥북 내장 GPU) | **강력 추천** |
| 2 | ggml Metal 백엔드 미구현 연산자 이식 | `ggml-org/llama.cpp` | 불필요(Apple Silicon) | 1위의 대체/축소판 |
| 3 | HF `tokenizers` 한글 자모 정규화·디코더 | `huggingface/tokenizers` | 불필요 | 조건부(G8 부분 저촉) |
| 4 | rmcp SEP-990 Enterprise Managed Auth | `modelcontextprotocol/rust-sdk` | 불필요 | 보류(출품작 성립 취약) |

탈락 8건은 §4 참조. **이번 라운드의 핵심 반증 성과: 과제 지시문에 있던 전제 2개가 사실이 아니었음** — (a) "MCP Rust SDK는 베타 단계" → **이미 3.x, 2026-07-28 스펙 stable 전량 구현 완료**, (b) "K-EXAONE 2.0이 추론 엔진에서 미지원" → **750B-A37B 모델이라 미지원 여부와 무관하게 팀이 손댈 수 없음**. §4에 근거 기록.

---

## 1. 절대 조건 — G8 실물 반증 로그 (전수)

직전 라운드 3연속 사망의 교훈("표준 검증기는 공식 진영이, 인기 도구 어댑터는 호스트가, 신생 보안 스캐너는 상용 벤더가 즉시 진입")을 적용해, **이 세 형태에 해당하는 후보는 아예 조사 대상에서 제외**했다. 남은 것은 "프로젝트 코드베이스 안쪽에 실제로 비어 있는 기능"뿐이다.

### 1.1 검색어·명령어 기록 (재현 가능)

```
gh issue list --repo ggml-org/llama.cpp --label "good first issue" --limit 30
gh issue list --repo ggml-org/llama.cpp --state open --search "Feature Request support in:title sort:created-desc"
gh search prs "webgpu" --repo ggml-org/llama.cpp --limit 30
gh search issues "EXAONE|HyperCLOVA|Kanana|Midm|Solar|Motif" --repo ggml-org/llama.cpp
gh issue list --repo modelcontextprotocol/rust-sdk --state open --limit 40
gh issue list --repo modelcontextprotocol/{go-sdk,csharp-sdk} --label "help wanted"
gh issue list --repo vllm-project/vllm --label "good first issue" --state open
gh issue list --repo sgl-project/sglang --label "good first issue" --state open
gh search issues "korean" --repo huggingface/tokenizers
gh issue list --repo open-telemetry/opentelemetry-python-contrib --label "help wanted"
gh api repos/EleutherAI/lm-evaluation-harness/contents/lm_eval/tasks
curl -sL .../llama.cpp/master/docs/ops.md   # 연산자×백엔드 지원 행렬 원본
curl -sL .../llama.cpp/master/.github/workflows/build-webgpu.yml
```

### 1.2 1위 후보에 대한 4단계 반증

| 절차 | 결과 |
|---|---|
| ① 이슈 트래커 직접 검색 | `[확인]` 상위 트래킹 이슈 **#14909 "Feature Request: Implement missing ops from backends"** — `good first issue` + `enhancement` 라벨, 2025-07-28 개설, **1년 이상 열려 있고 담당자 없음**, 댓글 50개가 전부 "이 op 가져가겠다"는 신규 기여자들. 유지보수자가 명시적으로 **"이건 이상적인 good first issue"**라고 선언. → <https://github.com/ggml-org/llama.cpp/issues/14909> |
| ② 공식 로드맵·문서 확인 | `[확인]` 프로젝트가 **`docs/ops.md`라는 공식 지원 행렬을 유지**하고, `scripts/create_ops_docs.py`로 자동 생성한다. 즉 "빈칸"이 프로젝트 스스로 공개·추적하는 공식 미구현 목록이다. 기여 절차(op 1개 = PR 1개, `test-backend-ops -o <op>`로 검증)까지 이슈 본문에 문서화됨. |
| ③ 진행 중 PR 확인 | `[확인]` 열려 있는 PR 전수 조회 결과 **WebGPU 관련 오픈 PR은 3건뿐**(#27069 wasi 빌드, #26258 CI, #25966 테스트 비활성화)이며 **연산자 구현 PR은 0건**. 아래 §2에서 지목하는 26개 미구현 연산자 중 **선점된 것이 하나도 없음**. |
| ④ 공식 진영 잠식 위험 | `[확인]` WebGPU 코드오너는 `reeselevine`, `yomaytk` 2명. 최근 1개월 머지 PR을 보면 이들은 **`flash_attn`/`mul_mat` 성능 튜닝과 NVFP4 양자화에 집중**(#25418, #25143, #25956, #26134)하고 있고 **롱테일 연산자에는 손대지 않는다**. 오히려 외부 기여자 PR(#25847 `CONV_2D_DW`, m1el)이 머지되고 있어 **외부 기여가 실제로 받아들여지는 경로가 열려 있음이 입증됨**. |

**→ G8 통과.** 이 후보는 "외부에서 감싸는 도구"가 아니라 **프로젝트가 스스로 공개한 공식 미구현 목록의 빈칸을 메우는 일**이므로, 상용 벤더나 호스트가 선점할 구조적 유인이 없다.

---

## 2. ★ 1위 — ggml WebGPU 백엔드 미구현 연산자 이식

> **한 문장**: 세계 최대 로컬 추론 엔진 llama.cpp의 **브라우저용 WebGPU 백엔드에 비어 있는 연산자 26개**를 WGSL 커널로 구현해, 현재 브라우저에서 못 돌거나 CPU 폴백으로 느리게 도는 모델군(RWKV·음성·임베딩)을 온디바이스로 돌아가게 만든다.

### 2.1 구체적 대상 — 숫자로 확정 `[확인]`

`docs/ops.md`(2026-08-16 기준 최신본)를 파싱한 실측이다. 전체 111개 연산자 × 12개 백엔드.

| 백엔드 | 미구현(❌) | 부분지원(🟡) | NVIDIA GPU 필요? |
|---|--:|--:|:--:|
| CUDA | 11 | 36 | 필요 |
| Vulkan | 8 | 10 | 사실상 필요 |
| SYCL | 5 | 14 | Intel GPU 필요 |
| **Metal (MTL)** | **20** | **20** | **불필요(Apple Silicon)** |
| **WebGPU** | **37** | **12** | **불필요(Dawn→Metal)** |
| OpenCL | 64 | 22 | Adreno 등 필요 |
| CANN | 42 | 14 | Ascend NPU 필요 |

**WebGPU 미구현 37개 전량** `[확인]`:
```
ACC, ADD1, ARANGE, COL2IM_1D, CONV_3D, CONV_TRANSPOSE_1D, CONV_TRANSPOSE_2D,
COUNT_EQUAL, CROSS_ENTROPY_LOSS, CROSS_ENTROPY_LOSS_BACK, DIAG_MASK_INF,
DSV4_HC_COMB, DSV4_HC_POST, DSV4_HC_PRE, DUP, GATED_LINEAR_ATTN, GET_ROWS_BACK,
GROUP_NORM, IM2COL_3D, LEAKY_RELU, LIGHTNING_INDEXER, MEAN, OPT_STEP_ADAMW,
OPT_STEP_SGD, OUT_PROD, PAD_REFLECT_1D, POOL_1D, POOL_2D, REPEAT_BACK,
RMS_NORM_BACK, ROLL, ROPE_BACK, RWKV_WKV6, RWKV_WKV7, SILU_BACK,
SOFT_MAX_BACK, TIMESTEP_EMBEDDING
```

유지보수자가 **"`_BACK` 접미사 op는 학습용이고 WIP라 우선순위 낮음"**이라고 이슈 본문에 명시했으므로 `[확인]`, 학습계 11개(`*_BACK`, `CROSS_ENTROPY_LOSS*`, `OPT_STEP_*`, `OUT_PROD`)를 제외하면 **추론용 실질 타깃 26개**가 남는다. 난이도별로 분류하면:

| 난이도 | 연산자 | 개수 | 성격 |
|---|---|--:|---|
| **초급** (elementwise/단순 리덕션) | `ADD1` `ARANGE` `LEAKY_RELU` `MEAN` `ACC` `DUP` `COUNT_EQUAL` `ROLL` `DIAG_MASK_INF` | 9 | 기존 `unary.wgsl`/`binary.wgsl` 템플릿 확장으로 대응 |
| **중급** (인덱싱/윈도우 연산) | `GROUP_NORM` `PAD_REFLECT_1D` `POOL_1D` `POOL_2D` `TIMESTEP_EMBEDDING` `COL2IM_1D` `IM2COL_3D` | 7 | 새 `.wgsl` 파일 필요, CPU 레퍼런스 존재 |
| **고급** (순환/융합 커널) | `RWKV_WKV6` `RWKV_WKV7` `GATED_LINEAR_ATTN` `CONV_TRANSPOSE_1D` `CONV_TRANSPOSE_2D` `CONV_3D` `LIGHTNING_INDEXER` `DSV4_HC_PRE/POST/COMB` | 10 | 워크그룹 설계 필요, 2주 내 1~2개만 |

**모델 단위로 번역한 "무엇이 안 도는가"** `[추정]`(연산자↔모델 매핑은 아키텍처 지식 기반 추론):
- `RWKV_WKV6` + `RWKV_WKV7` 부재 → **RWKV-6/7 계열 전 모델**이 브라우저 WebGPU에서 CPU 폴백
- `GROUP_NORM` + `TIMESTEP_EMBEDDING` + `CONV_TRANSPOSE_1D/2D` 부재 → **확산 기반 TTS/음성·이미지 모델**의 브라우저 실행 불가
- `POOL_1D/2D` + `MEAN` 부재 → **임베딩·리랭커 모델**의 풀링 계층이 CPU 폴백

### 2.2 왜 아직 비어 있는가 `[확인]`

1. **트래킹 이슈가 1년 넘게 열려 있음** (#14909, 2025-07-28 개설, 담당자 0명, `good first issue`).
2. **WebGPU 백엔드 자체가 신생**이라 CUDA(11개 미구현)·Vulkan(8개)에 비해 격차가 압도적(37개)이다.
3. **코드오너 2명이 성능 튜닝에 몰려 있음** — 최근 머지 PR은 전부 `flash_attn` 서브그룹 튜닝, NVFP4, WASM 빌드 수정. 롱테일 연산자는 사실상 방치.
4. **선점 경쟁이 Metal·CUDA 쪽으로 쏠려 있음** — 이슈 댓글의 신규 기여자들(CodePath AI301 학생 다수)은 CUDA/Metal/Vulkan/OpenCL만 언급하고 **WebGPU를 가져간 사람이 한 명도 없다**. 진입 장벽(Dawn 설치)이 심리적으로 높아 보이지만 실제로는 §2.3처럼 매우 낮다는 것이 이 후보의 차익 지점이다.

### 2.3 2주 실현성 — **GPU 불필요, 이 후보의 결정적 강점** `[확인]`

**공식 CI에 `runs-on: macos-latest` 잡이 존재한다.** `.github/workflows/build-webgpu.yml` 실측:

```yaml
  macos:
    runs-on: macos-latest
    - name: Dawn Dependency
      run: |
        DAWN_VERSION="v20260317.182325"
        DAWN_ASSET_NAME="Dawn-18eb229...-macos-latest-Release"
        curl -L -o artifact.tar.gz "https://github.com/google/dawn/releases/download/${DAWN_VERSION}/${DAWN_ASSET_NAME}.tar.gz"
    - name: Build
      run: |
        export CMAKE_PREFIX_PATH=dawn
        cmake -B build -G "Ninja" -DCMAKE_BUILD_TYPE=Release -DGGML_WEBGPU=ON -DGGML_METAL=OFF -DGGML_BLAS=OFF
    - name: Test
      run: ctest -L main --verbose --timeout 900
```

의미하는 바:
- **Dawn을 소스 빌드할 필요 없이 구글이 배포하는 macOS 프리빌트 tarball을 받아 쓴다.** 환경 구축 = `curl` + `tar` + `cmake` ≈ **10분**.
- Dawn이 macOS에서 **Metal로 내려가므로, 맥북 내장 GPU가 그대로 WebGPU 디바이스가 된다.** NVIDIA 카드도, 클라우드 GPU도, 대회 인프라 지원도 **일절 필요 없다.**
- 대회는 인프라를 지원하지 않는다는 제약이 여기서 **비용 0**으로 무력화된다. 이것이 vLLM/SGLang 계열 후보를 전부 탈락시킨 반면 이 후보만 살아남은 이유다.

**검증 루프가 완전 자동화되어 있다** `[확인]`:
```
./build/bin/test-backend-ops -o POOL_2D          # CPU 레퍼런스와 수치 비교
./build/bin/test-backend-ops perf -o POOL_2D     # 성능 측정
```
CPU 백엔드 구현이 **정답지(reference)** 역할을 하므로 정확성 증명이 원리적으로 보장된다. 직전 라운드에서 `agent-replay`를 죽였던 "2주 안에 정확성 증명 불가" 리스크가 **구조적으로 존재하지 않는다.**

**공수 산정** `[추정]`:

| 항목 | 시간 |
|---|--:|
| 환경 구축(Dawn + 빌드 + WASM 툴체인) | 12h |
| 코드베이스 파악(`ggml-webgpu.cpp` 239KB, WGSL 구조) | 20h |
| 초급 op 9개 × 6h | 54h |
| 중급 op 7개 × 12h | 84h |
| 고급 op 1~2개(RWKV_WKV7 등) | 30h |
| 브라우저 데모 앱 + 벤치마크 하네스 | 30h |
| 문서·영상·PR 대응 | 20h |
| **합계** | **250h** |

250h는 상한이다. **하한 안전선: 초급 9개 + 중급 4개 = 13개 op (약 150h)**로 잡고, 여유가 생기면 고급으로 확장하는 계단식 계획을 권한다. **op 1개 = PR 1개** 구조라 중간에 멈춰도 성과가 남는 것이 결정적으로 유리하다(완주 리스크 G5 자동 완화).

### 2.4 출품작 성립 여부 — **가장 중요한 항목** `[확인]`+`[추정]`

업스트림 PR만으로는 출품작이 안 된다는 지적은 정확하다. **대표 저장소에 남길 것을 명확히 설계한다.**

제안 저장소명: **`ggml-webgpu-ops`** (또는 `webgpu-onboard`)

| 구성물 | 내용 | 우리 저장소에 남는가 |
|---|---|:--:|
| ① 포크 브랜치 | `llama.cpp` 포크 + op별 브랜치 N개 (업스트림 PR의 원본) | ○ |
| ② **브라우저 데모 앱** | emdawnwebgpu로 WASM 빌드한 llama.cpp를 GitHub Pages에 올린 정적 페이지. 모델 로드 → 브라우저 GPU에서 추론. **서버 인프라 0** | ○ |
| ③ **연산자 커버리지 대시보드** | `docs/ops.md`를 파싱해 백엔드별 커버리지를 시계열로 추적, 우리 기여분을 하이라이트 | ○ |
| ④ **폴백 프로파일러 + 벤치 스위트** | 특정 모델의 그래프에서 어떤 op가 CPU로 폴백되는지 자동 계측하고, op 구현 전/후 tok/s를 비교 리포트로 뽑는 하네스 | ○ |
| ⑤ **한국어 WGSL 커널 기여 가이드** | "ggml 백엔드에 연산자를 추가하는 법" 한국어 튜토리얼 + 예제 PR 링크. **2025 금상(Zephyr 포팅 + 교육자료)의 직계 계승 구조** | ○ |

**2025 금상과의 구조적 동형성**: Zephyr RTOS를 RPi5에 포팅한 팀이 평가받은 것은 "코드량"이 아니라 **① 세계적 프로젝트의 미지원 타깃을 지원되게 만들었다 ② 후속 기여자를 위한 교육자료를 남겼다** 두 가지다. 본 후보는 ①=WebGPU 백엔드 연산자 26개 중 N개, ②=한국어 기여 가이드 + 커버리지 대시보드로 **1:1 대응**한다.

**심사기준 자동 충족** `[추정]`:
- "오픈소스SW 적절성 10점" → **star 124,119개 MIT 프로젝트에 머지된 PR**. 논쟁 여지 없음.
- "커뮤니티 확장 가능성 10점" → 머지 이력 자체가 증거. 한국어 가이드가 후속 확장 경로.
- **G8(레드오션) 원천 회피** → 공식 진영과 경쟁하는 게 아니라 그 일부가 된다.

### 2.5 시연 가능성 — 3분 영상 `[추정]`

```
0:00-0:25  문제 제시. docs/ops.md 화면. WebGPU 열에 ❌ 37개가 줄지어 있는 장면.
           "브라우저에서 도는 llama.cpp는 아직 절반만 완성돼 있습니다."
0:25-1:00  실측. 폴백 프로파일러 실행 → "이 모델의 op 중 N개가 GPU를 못 쓰고 CPU로 떨어집니다"
           라는 리포트가 뜨는 화면.
1:00-2:00  기여. test-backend-ops -o POOL_2D 가 ❌ FAIL 로 뜨는 화면 → WGSL 커널 작성 →
           ✅ PASS 로 바뀌는 화면. 이어서 머지된 업스트림 PR 목록을 스크롤.
2:00-2:40  결과. 브라우저 탭 2개 나란히. 왼쪽=기여 전(CPU 폴백), 오른쪽=기여 후.
           한국어 오픈웨이트 모델(kanana-2-3b 등)에 같은 프롬프트를 넣고
           토큰이 흘러나오는 속도 차이를 실시간으로 보여줌. tok/s 카운터 오버레이.
2:40-3:00  커버리지 대시보드. ❌ 37 → ❌ (37-N) 으로 줄어든 막대그래프.
           한국어 기여 가이드 페이지.
```
**시각적 강도가 매우 높다.** 벤치마크 숫자가 아니라 "브라우저에서 글자가 빠르게 나온다"는 것이 직관적으로 보인다.

### 2.6 정량 지표

| 지표 | 측정 방법 | 목표 |
|---|---|---|
| **연산자 커버리지** | `docs/ops.md` WebGPU 열 ❌ 개수 | 37 → 24 이하 (13개 이상 구현) |
| **업스트림 머지 PR 수** | GitHub | 8건 이상 머지 |
| **수치 정확성** | `test-backend-ops -o <op>` | 구현 op 100% PASS (CPU 레퍼런스 대비) |
| **커널 성능** | `test-backend-ops perf -o <op>` | op별 GFLOPS / GB/s |
| **모델 e2e 처리량** | 브라우저 tok/s | CPU 폴백 제거분에 대한 개선율(%) |
| **폴백 제거율** | 자체 프로파일러 | 대상 모델 그래프의 CPU 폴백 노드 수 감소 |
| **첫 토큰 지연(TTFT)** | 브라우저 계측 | ms |

### 2.7 라이선스 `[확인]`

| 대상 | 라이선스 | 판정 |
|---|---|---|
| `ggml-org/llama.cpp` | **MIT** | ○ 포크·수정·재배포 전면 자유. 대회 제출에 제약 없음 |
| Dawn (Google) | BSD-3-Clause | ○ (빌드 의존성, 프리빌트 바이너리 사용) |
| Emscripten | MIT / NCSA | ○ |

**모델 라이선스는 반드시 별도 확인 필요** `[확인] 존재 / [추정] 라이선스`:
- `kakaocorp/kanana-2-3b-instruct` — GGUF 양자화본 존재(`mradermacher/kanana-2-3b-instruct-i1-GGUF`, 다운로드 1,943). **라이선스 조항 미확인 → 착수 전 필수 확인**
- `kakaocorp/kanana-nano-2.1b-instruct` — GGUF 존재. 2.1B로 브라우저에 가장 적합
- `LGAI-EXAONE` 계열 — **EXAONE AI Model License는 연구 목적 제한 조항이 있는 것으로 알려짐 `[추정]`. 대회 출품물 시연에 쓰려면 조항 정독 필요**
- 대회 규정상 **외부 상용 API 의존 구조 금지 / 오픈웨이트 필수** → 본 후보는 **브라우저에서 로컬 실행**하므로 외부 API 호출이 구조적으로 0. 규정 대응이 가장 깔끔한 후보다.

> 데모 모델은 라이선스가 가장 관대한 것으로 고르되, **한국어 모델을 쓰는 것이 대회 맥락상 유리**하다. 확인 순서: kanana → Midm → EXAONE.

### 2.8 착수 첫 3일 상세 계획

**전제**: 3인 팀을 A(백엔드/커널), B(커널), C(하네스/데모)로 나눈다.

#### Day 1 — 환경 구축과 "빈칸의 실재" 확정 (전원)

| 시간 | 작업 | 검증 기준 |
|---|---|---|
| 오전 | Dawn macOS 프리빌트 내려받기 → `CMAKE_PREFIX_PATH=dawn cmake -B build -DGGML_WEBGPU=ON -DGGML_METAL=OFF -DGGML_BLAS=OFF` → 빌드 | `./build/bin/llama-cli --list-devices` 에 **WebGPU 디바이스가 뜬다** |
| 오후 | `./build/bin/test-backend-ops support -b WebGPU --output csv > webgpu.csv` 실행 | **`docs/ops.md`의 ❌ 37개가 로컬에서 재현된다.** 문서가 최신이 아닐 수 있으므로 **이 실측 CSV가 진짜 기준선**이다 (유지보수자 CISC가 이슈에서 "문서는 최신이 아닐 수 있으니 로컬에서 먼저 갱신하라"고 명시) |
| 저녁 | 기준선 CSV를 우리 저장소에 `baseline/webgpu-YYYYMMDD.csv`로 커밋 | 대회 심사 시 "우리가 시작할 때 이랬다"는 **반박 불가능한 증거**가 된다 |

> **Day 1의 유일한 실패 조건**: 로컬 실측 결과 ❌가 37개보다 훨씬 적으면(예: 10개 이하) 그동안 코드오너가 대량 구현한 것이므로 **즉시 2위 후보(Metal, ❌ 20개)로 전환**한다. 이 판정을 Day 1 안에 끝내는 것이 계획의 핵심이다.

#### Day 2 — 첫 PR 관통 (A) + 코드 지도 (B, C)

| 담당 | 작업 | 검증 기준 |
|---|---|---|
| **A** | **가장 쉬운 op 1개(`ADD1` 또는 `LEAKY_RELU`)를 끝까지 관통.** 기존 `unary.wgsl` / `binary.wgsl` 템플릿과 `ggml-webgpu.cpp`의 디스패치 등록부를 모방 | `test-backend-ops -o ADD1` **PASS** → **당일 업스트림 PR 제출** |
| **B** | `ggml-webgpu.cpp`(239KB)에서 op 등록 → 파이프라인 생성 → 셰이더 바인딩까지의 경로를 문서화. `embed_wgsl.py` 빌드 스텝 이해 | 팀 내부 위키에 "새 op 추가 체크리스트" 초안 |
| **C** | WASM/브라우저 빌드 경로 확보. emdawnwebgpu 패키지 받아 `EMDAWNWEBGPU_DIR` 지정 후 빌드 | **브라우저에서 모델 하나가 돌아간다** (성능 무관, 돌기만 하면 성공) |

> **Day 2에 PR 1건을 반드시 낸다.** 이유: ① 리뷰 사이클 지연이 이 프로젝트의 최대 리스크이므로 최대한 일찍 큐에 넣는다 ② 유지보수자가 이슈에서 **"담당 배정을 요청하지 말고 그냥 PR을 먼저 내라"**고 명시했으므로, 선점의 유일한 수단이 PR이다 ③ 첫 PR 리뷰 피드백이 나머지 12개의 품질을 결정한다.

#### Day 3 — 병렬화 + 차별화 자산 착수

| 담당 | 작업 | 검증 기준 |
|---|---|---|
| **A** | 초급 op 2~3개 동시 진행(`ARANGE`, `MEAN`, `COUNT_EQUAL`). op 1개 = 브랜치 1개 = PR 1개 원칙 고수 | 각 op `test-backend-ops` PASS |
| **B** | 중급 첫 타깃 `POOL_2D` 착수. CPU 레퍼런스(`ggml-cpu`) 읽고 워크그룹 설계 | Day 4 내 PASS 목표 |
| **C** | **폴백 프로파일러 프로토타입.** `GGML_SCHED_DEBUG=2` 등으로 그래프 분할 로그를 파싱해 "이 모델에서 CPU로 떨어지는 op와 노드 수"를 표로 출력 | **한국어 모델 1개에 대해 폴백 리포트가 출력된다** — 이것이 시연 영상 0:25~1:00 구간의 핵심 자산 |

**3일 차 종료 시점의 팀 상태 (성공 기준)**
- [ ] 로컬 WebGPU 실측 기준선 CSV가 저장소에 커밋됨
- [ ] 업스트림 PR **1건 이상 제출**, 2~3건 작업 중
- [ ] 브라우저에서 모델이 실제로 도는 것을 확인
- [ ] 폴백 프로파일러가 리포트를 출력
- [ ] "새 op 추가 체크리스트" 문서 초안 (→ 최종 산출물 ⑤의 씨앗)

**리스크와 대응**

| 리스크 | 확률 | 대응 |
|---|:--:|---|
| 업스트림 리뷰가 2주 안에 안 끝남 | **높음** | 심사 대상은 **"제출한 PR + 우리 저장소 자산"**이지 머지 여부가 아니다. 다만 **머지 1건은 확보하고 싶으므로** Day 2에 가장 쉬운 op를 낸다. Metal 기여자 사례에서 리뷰 지연이 실제로 관찰됨(#25982, #21267 stale) — **이것을 예상 리스크로 결과보고서에 미리 적어두면 오히려 성숙도로 평가된다** |
| 다른 기여자가 같은 op 선점 | 중 | 이슈 댓글과 오픈 PR을 **매일 아침 확인**. 현재 WebGPU op PR은 0건이라 여유 있음 |
| 고급 op(RWKV 등)에서 시간 소진 | 중 | 초급·중급 13개를 먼저 완주한 뒤에만 착수. **계단식 계획 고수** |
| Dawn 버전 불일치로 빌드 실패 | 낮 | CI가 고정한 `v20260317.182325` / Dawn commit `18eb229`를 그대로 사용 |

---

## 3. 2~4위 후보

### 3.1 [2위] ggml **Metal** 백엔드 미구현 연산자 — 1위의 대체/보험

- **대상** `[확인]`: 동일 이슈 #14909. Metal ❌ **20개** + 🟡 20개. 학습계 제외 시 실질 타깃 약 10개: `ADD1` `COL2IM_1D` `CONV_2D_DW` `DIAG_MASK_INF` `DSV4_HC_*` `GATED_LINEAR_ATTN` `IM2COL_3D` `LIGHTNING_INDEXER` `MUL_MAT_HADAMARD`
- **GPU** `[확인]`: **불필요.** Apple Silicon 맥북이 곧 Metal 디바이스. Dawn 설치조차 필요 없어 진입 장벽은 1위보다도 낮다
- **왜 2위인가** `[확인]`: ① **경쟁이 훨씬 심하다.** 이슈 댓글에서 Metal op를 가져간 기여자만 6명 이상(`vrvrv` CONV_2D, `ayush-os` LOG, `cern1710` OPT_STEP_ADAMW, `seyoungjeong` XIELU, `Blackcyan30` SILU_BACK, `kunwar-vikrant` SOFT_MAX_BACK). ADD1은 PR이 3건(#19987, #21267, #21274) 중복 제출될 정도로 과열 ② **빈칸이 절반**(20 vs 37) ③ **브라우저 데모라는 시각적 무기가 없다** — 시연 영상이 터미널 숫자 비교로 전락
- **판정**: 단독 출품작으로는 1위보다 명백히 약하다. **Day 1 실측에서 WebGPU가 이미 메워져 있을 경우의 폴백 카드**로 보유

### 3.2 [3위] HuggingFace `tokenizers` — 한글 자모 처리 `[조건부]`

- **대상** `[확인]`: **`huggingface/tokenizers` #1975 "[RFC] Korean Tokenization: Jamo Decomposition as Pre-tokenizer"** (2026-03-22 개설, 담당자 0명, `Feature Request` 라벨). → <https://github.com/huggingface/tokenizers/issues/1975>
- **강력한 긍정 신호** `[확인]`: 핵심 유지보수자 **ArthurZucker가 직접 "Sounds good! Happy to have... Do you want to submit a PR?"라고 기여를 초청**했다. 이슈 제안자가 3월 23일에 구현 방향을 되물었으나 **그 이후 5개월간 답변도 PR도 없다.** 자모/한글/한국어 키워드로 PR 전수 검색 결과 **관련 PR 0건** → 완전히 비어 있음
- **G8 부분 저촉 — 반드시 알아야 할 반증** `[확인]`: **RFC가 주장하는 "10줄짜리 자모 분해"는 이미 유니코드 NFD로 대부분 가능하다.** 직접 실행 검증:
  ```python
  unicodedata.normalize('NFD', '한글 처리')
  # → ᄒ(U+1112) ᅡ(U+1161) ᆫ(U+11AB) ᄀ ᅳ ᆯ ␣ ᄎ ᅥ ᄅ ᅵ  (11자)
  # NFC 역변환 100% 무손실. 초성 ㄱ(U+1100)과 종성 ㄱ(U+11A8)이 다른 코드포인트라 위치 정보도 보존됨
  ```
  그리고 `tokenizers/src/normalizers/unicode.rs`에 **`NFD` / `NFC` / `NFKD` / `NFKC` 노멀라이저가 이미 전부 구현되어 있다** `[확인]`. → **"그거 `normalizers.NFD()`로 되잖아요"라는 심사위원 한마디에 무너질 위험이 실재한다.**
- **그럼에도 남아 있는 진짜 빈칸** `[확인]`:
  1. **디코더가 없다.** `tokenizers/src/decoders/`에 `bpe / byte_fallback / ctc / fuse / sequence / strip / wordpiece`만 있고 **NFC 재조합 디코더가 없다**(`NFC` 코드 검색 결과 decoders 경로 0건). 즉 NFD로 자모 분해해 학습한 토크나이저는 **디코딩 시 음절로 되돌릴 표준 경로가 없다.** 이것이 유일하게 명확한 "코드베이스 안쪽 미구현"
  2. NFD는 **복합 자모를 더 쪼개지 않는다**(ㅘ→ㅗ+ㅏ, ㄳ→ㄱ+ㅅ). 선행 연구(KR-BERT, arXiv:2008.03979)가 효과를 보고한 것은 이 추가 분해 단계다
  3. ArthurZucker의 수용 조건 — **"Hub에 이걸 쓰는 모델/토크나이저가 실제로 올라와 있을 것"** → 우리가 토크나이저를 학습해 Hub에 올려야 한다. **토크나이저 학습은 CPU만으로 가능**하므로 이건 오히려 기회
- **2주 실현성**: Rust + Python 바인딩, **GPU 완전 불필요**. Apache-2.0. star 10,972
- **출품작 성립**: 저장소 = 한국어 토크나이저 벤치마크 스위트 + Hub에 올린 자모 토크나이저 + 상류 PR(디코더 + 복합자모 분해기)
- **시연**: 같은 한국어 문장의 토크나이저별 토큰 분해를 색깔 블록으로 비교하는 화면. 토큰 수 막대그래프
- **치명적 리스크 (G6)** `[추정]`: **"자모 분해가 실제로 유리하다"가 측정 결과 거짓일 수 있다.** 음절 1개가 자모 2~3개로 늘어나므로 시퀀스 길이는 오히려 증가한다. RFC 본문도 "토큰 수는 늘어날 수 있으나 어휘 압축이 상쇄"라고 인정한다. **부정적 결과가 나오면 출품작의 서사가 붕괴한다.** 1위 후보에는 이런 리스크가 원리적으로 없다(CPU 레퍼런스가 정답지)
- **판정**: **한국 대회 맥락에서의 서사(한국어 토큰 비용 문제 + 유지보수자 초청장)는 1위보다 강하지만, 기술적 빈칸의 크기와 결과 확실성이 1위보다 약하다.** 1위를 주축으로 하되 이 후보를 버리기 아깝다면, **"실패해도 되는 리서치 트랙"으로 병행**하는 구성은 가능

### 3.3 [4위] rmcp — SEP-990 Enterprise Managed Authorization `[보류]`

- **대상** `[확인]`: `modelcontextprotocol/rust-sdk` **#531** (2025-11-07 개설, **9개월 이상 미해결**, 담당자 0명, `T-security` `enhancement` `P2`)
- **왜 비어 있는가** `[확인]`: 2025-12에 `tanish111`이 "작업하겠다"고 했으나 8개월간 PR 없음. 2026-06-19 확장 스펙이 정식 stabilize된 뒤 `tdesai-eightfold`가 "공수를 산정해보겠다"고 한 것이 마지막 활동. **구현 PR 0건**
- **내용**: OIDC/SAML 연동, RFC 8693 Token Exchange(ID-JAG), RFC 7523 JWT Bearer Grant, 서버측 JWT 검증·리플레이 방지
- **GPU** `[확인]`: 완전 불필요. 순수 Rust
- **탈락 사유는 아니지만 순위가 낮은 이유**:
  1. **출품작 성립이 취약.** 업스트림 PR 하나 외에 우리 저장소에 남길 것이 마땅치 않다. 억지로 만들면 "테스트용 IdP 하네스" 정도인데 이는 §0에서 경계한 "외부에서 감싸는 도구"에 가깝다
  2. **3분 영상에 보여줄 그림이 없다.** OAuth 토큰 교환 성공 로그는 시각적 임팩트가 0에 수렴
  3. **정량 지표가 안 나온다.** 처리량·지연·정확도 어느 것도 해당 없음
  4. 엔터프라이즈 IdP 실물 없이 2주 내 정합성 증명이 어렵다
- **판정**: **기술적으로는 진짜 빈 구멍이 맞으나 대회 출품작으로는 부적합.** 대회와 무관하게 개인 기여로는 훌륭한 타깃

---

## 4. 탈락 후보 기록 — 이 영역에서 가장 가치 있는 산출물

> 직전 라운드가 3연속 사망한 영역이므로 **"왜 안 되는지"를 근거와 함께 남기는 것**이 재조사 비용을 절감한다.

| # | 후보 | 탈락 사유 | 근거 `[확인]` |
|:--:|---|---|---|
| T1 | **K-EXAONE 2.0 추론 엔진 지원** | **모델이 750B-A37B(전문가 256개, 컨텍스트 262K).** 권장 구성이 **H200 8장 × 2노드 = 16장.** GPU 없는 팀이 로드조차 불가능. 게다가 llama.cpp는 이미 이전 세대 K-EXAONE 236B를 b7737부터 지원 중이고, vLLM/SGLang 설정은 LG AI Research가 자체 포크로 직접 배포한다 → **모델 벤더가 스스로 메우는 구멍** | HF 모델카드, `gh search issues "EXAONE" --repo vllm-project/vllm` 결과 EXAONE-4.5 관련 이슈가 전부 **closed** |
| T2 | **llama.cpp Motif-3-Beta 지원** (#26125) | **이미 선점됨.** `timkhronos`의 draft PR **#26298**이 존재하며 **+1,580/-6 규모**로 진행 중(3일 전 갱신). 게다가 모델이 314B-A13B라 CPU 검증 불가 | `gh pr view 26298 --repo ggml-org/llama.cpp` |
| T3 | **llama.cpp Solar-Open2 지원** (#26115, Upstage) | 선점은 안 됐으나 **250B-A15B / 컨텍스트 1M.** 양자화해도 100GB+ RAM 필요 → **2주 안에 팀이 정확성을 검증할 물리적 방법이 없다.** 이미 커뮤니티 GGUF+패치(`prometheusAIR/Solar-Open2-250B-GGUF`)도 돌아다님 | 이슈 본문 + 댓글 |
| T4 | **vLLM `good first issue` 기여** | 전수 조회한 24건이 **거의 전부 NVIDIA GPU 필수**(PTX 9.4 `ldmatrix` INT4 로드, NVFP4 GEMM Triton 구현, FlashInfer 융합, CUDA graph, TP MoE collectives, cascade attention 휴리스틱…). **GPU 없는 팀은 착수 자체가 불가** | `gh issue list --repo vllm-project/vllm --label "good first issue"` |
| T5 | **SGLang `good first issue` 기여** | 동일 사유 + 다수가 **내부 리팩터링/문서 정리**(SGLang Diffusion 관련 6건, Cookbook 문서 2건)라 출품작 서사가 안 나옴 | `gh issue list --repo sgl-project/sglang --label "good first issue"` |
| T6 | **MCP Rust SDK "베타 미구현 기능" 보완** | **전제가 사실이 아님.** README 실측: rmcp는 **3.x**이며 *"This SDK implements the stable MCP `2026-07-28` specification"* — server discovery, transport-neutral subscriptions, long-running tasks, response caching, MRTR, HTTP routing headers **전부 구현 완료**. 남은 오픈 이슈는 대부분 버그 리포트·네이밍 논의 | `curl .../rust-sdk/main/README.md` |
| T7 | **rmcp 네이티브 Rate Limiting** (#388) | **5일 전 선점됨.** `IgorKasianenko`가 "작업하겠다"며 2026-07-28 스펙 기준으로 규칙 변경분까지 표로 정리한 상세 설계를 게시 | `gh issue view 388 --repo modelcontextprotocol/rust-sdk` |
| T8 | **MCP Go / C# SDK 스펙 미반영분** | **Go SDK는 `help wanted` 이슈가 단 1건**("문서에 예제 추가", 8개월 전)뿐 — 실질 빈칸 없음. **C# SDK는 13건 있으나 전부 OAuth 설정 문제·플래키 테스트·샘플 요청** 등 잡무성이라 출품작 서사가 성립 불가 | `gh issue list --repo modelcontextprotocol/{go-sdk,csharp-sdk} --label "help wanted"` |
| T9 | **OpenTelemetry GenAI semconv 계측 기여** | `opentelemetry-python-contrib`의 `help wanted` 25건이 **전부 2~3년 묵은 HTTP/메시징 계측 이슈**로 **GenAI와 무관**. `semantic-conventions`에서 `gen_ai` 오픈 이슈는 **2건뿐**이며 둘 다 1년 이상 묵은 **네이밍 가이드 논의**(코드 아님). **"공식 계측 라이브러리에 기여한다"는 접근의 대상 자체가 존재하지 않는다** | `gh issue list --repo open-telemetry/opentelemetry-python-contrib --label "help wanted"` / `gh search issues "gen_ai" --repo open-telemetry/semantic-conventions --state open` |
| T10 | **lm-evaluation-harness 한국어 태스크 추가** | **이미 있음.** `lm_eval/tasks/` 221개 디렉터리 중 한국어만 **5종**: `kmmlu`, `haerae`, `kobest`, `kormedmcqa`, `click`. "한국어 태스크 부재"라는 전제가 거짓 | `gh api repos/EleutherAI/lm-evaluation-harness/contents/lm_eval/tasks` |
| T11 | **Transformers.js 미지원 모델/파이프라인** | `help wanted` **2건**(2023~2024년, 토큰 분류 aggregation·Svelte 문서), `good first issue` **3건**으로 실질 빈칸이 거의 없음. 오픈 이슈 대부분은 **개별 모델 변환 요청**이라 "1개 모델 추가 = 출품작"이 성립하지 않음 | `gh issue list --repo huggingface/transformers.js --label "help wanted"` |
| T12 | **ONNX Runtime Web WebGPU 미지원 연산자** | 검색으로 **해당하는 오픈 이슈를 찾지 못함**. 공식 미구현 목록도 llama.cpp의 `docs/ops.md` 같은 형태로 공개되어 있지 않아 **"빈칸의 실재"를 대회 전에 증명할 수 없다.** 같은 성격의 작업이면 근거가 문서화된 llama.cpp WebGPU(1위)가 모든 면에서 우월 | `gh search issues "webgpu op" --repo microsoft/onnxruntime --state open` |

### 4.1 이번 라운드에서 갱신된 사망 패턴

직전 3형태에 더해, **이 영역 고유의 4번째 사망 패턴**을 확인했다:

> **④ "최신·최대 모델 지원"은 하드웨어 장벽으로 죽는다.**
> 프런티어 오픈웨이트 모델(K-EXAONE 750B, Solar-Open2 250B, Motif-3 314B)은 지원이 비어 있어도 **검증에 필요한 하드웨어가 없어서 손댈 수 없다.** 게다가 이런 모델은 **벤더가 자체 포크로 직접 지원을 배포**하므로 구멍이 오래 남지도 않는다.
> **역으로 도출되는 원칙: 모델이 아니라 "백엔드·연산자"를 노려라.** 연산자는 크기가 작고, CPU 레퍼런스가 정답지로 존재하며, 소비자용 하드웨어로 검증되고, 공식 지원 행렬(`docs/ops.md`)이라는 반박 불가능한 근거 문서가 딸려 온다.

---

## 5. 최종 권고

**1위 `ggml WebGPU 백엔드 연산자 이식`을 주축으로 진행할 것.** 근거를 한 줄로 압축하면:

> **"GPU 없는 팀도 맥북 한 대로 star 12만 MIT 프로젝트의 공식 미구현 목록을 실제로 줄일 수 있고, 그 결과가 브라우저 화면에서 눈으로 보이는" 유일한 후보다.**

세 가지가 동시에 성립하는 후보는 이것뿐이었다 — ① 하드웨어 장벽 0 (`build-webgpu.yml`의 `runs-on: macos-latest` + Dawn 프리빌트로 실증) ② 정확성 증명 구조 내장 (`test-backend-ops`의 CPU 레퍼런스 비교) ③ 시각적 시연 자산 (브라우저 온디바이스 추론 속도 비교).

**Day 1 종료 시점에 로컬 실측 CSV로 ❌ 개수를 재확인하고, 37개에서 크게 줄어 있으면 즉시 2위(Metal, ❌ 20개)로 전환한다.** 이 판정 게이트를 반드시 계획에 포함할 것.
