# 2026년 8월 기준 기술 트렌드 리서치 — 오픈소스 개발자대회 전략용

> 작성일: 2026-08-16
> 목적: "최신 기술 활용 정도"(혁신성 6점), "타 오픈소스SW 적절 도입"(10점), "잠재적 경쟁력"(15점) 심사기준에 맞는 기술 축 도출
> 방법: 전 항목 WebSearch 검증. 검증 못 한 내용은 `[미검증]` 표기.
> 주의: 대회 심사기준의 정확한 배점표는 공개 웹에서 확인되지 않았고(오리엔테이션 7/23 공지 예정), 본 문서는 의뢰인이 제공한 배점 정보를 전제로 작성했습니다. `[미검증]`

---

## 0. 30초 요약

1. **모델 레이어는 끝난 게임이다.** 오픈 웨이트 모델은 2026년에 상품(commodity)이 됐다. 모델을 쓰는 것 자체는 이제 가산점이 아니다.
2. **표준 레이어가 새 전장이다.** MCP는 2025년 12월 Linux Foundation 산하 Agentic AI Foundation(AAIF)에 기증되어 벤더 중립 표준이 됐고, 2026-07-28 스펙에서 **stateless 아키텍처로 전면 개편**됐다. AGENTS.md, Agent Skills(SKILL.md), A2A가 모두 같은 재단 아래 모였다. **"표준을 정확히 구현했다"는 것이 2026년의 최신성 시그널**이다.
3. **가장 큰 빈틈은 '에이전트가 만들어낸 부작용을 처리하는 도구'다.** AI 코딩 에이전트가 만든 산출물의 검증·출처·비용·보안이 전부 미성숙하다. curl이 버그바운티를 종료하고 Jazzband가 해산한 게 2026년이다.
4. **한국 특수 맥락 3종**: AI 기본법 시행(2026-01-22, 생성물 표시 의무), 망분리 완화(N2SF), 독자 AI 파운데이션 모델의 Apache-2.0 전면 공개(K-EXAONE 2.0, 750B). 이 셋 중 하나에 걸치면 심사위원 체감 가치가 크게 오른다.

---

## 1. 2026년 현재 오픈소스 AI 생태계 지형

### 1.1 오픈 웨이트 모델 — 이미 상품화됨

- 2026년 8월 기준 상위 5개 오픈 웨이트 모델 중 4개가 중국 랩(DeepSeek, Moonshot, Zhipu/Z.ai, Alibaba)에서 나온다. 코딩·추론에서 프론티어 클로즈드 모델과의 격차를 거의 닫았다. ([wavect.io](https://wavect.io/blog/open-weight-llm-comparison-2026/), [tech-insider.org](https://tech-insider.org/best-open-source-llm-2026/))
- **Kimi K3** (Moonshot, 2026-07-16): 2.8T 파라미터 MoE, 896 전문가 중 ~16개 활성, 네이티브 비전, 1M 컨텍스트. 현재 오픈 웨이트 올라운더 1위로 평가됨. ([codersera](https://codersera.com/blog/best-open-source-llm-2026-llama-4-qwen-3-5-deepseek-v4-gemma-4-mistral/))
- **OSI 승인 라이선스 프론티어 라인업이 두꺼워졌다**: DeepSeek V4(MIT), GLM-5.1(MIT), MiniMax-M2.7(Apache-2.0), Qwen3.6(Apache-2.0), Gemma 4(Apache-2.0). ([huggingface.co/blog/daya-shankar](https://huggingface.co/blog/daya-shankar/open-source-llms))
- **함의**: "오픈 모델을 파인튜닝했다"는 것만으로는 2026년에 혁신성 점수가 나오지 않는다. 모델은 부품이고, 심사 포인트는 그 위 레이어다.

### 1.2 로컬 추론 스택 — 역할 분화 완료

| 엔진 | 2026년 위상 | 적정 용도 |
|---|---|---|
| **llama.cpp** | 이식성의 기준. Raspberry Pi ~ H100 클러스터 | 엣지/워크스테이션 |
| **Ollama** | llama.cpp 위의 "가전제품". GGUF 네이티브 | 단일 사용자 데스크톱 |
| **vLLM** | 프로덕션 서빙 표준. PagedAttention + continuous batching, GPU 85~92% 활용, Ollama 대비 부하 시 **10~20배 처리량** | 다중 사용자 서빙 |
| **SGLang** | RadixAttention으로 공유 프리픽스 중복 연산 제거. **에이전트 루프/멀티턴에 최적** | 에이전트 워크플로 |

출처: [bizon-tech](https://bizon-tech.com/blog/best-llm-inference-engines), [sesamedisk](https://sesamedisk.com/llamacpp-vs-vllm-vs-sglang-vs-ollama-2026/), [dev.to 가이드](https://dev.to/sreeraj-sreenivasan/the-complete-guide-to-local-llm-inference-tools-in-july-2026-llamacpp-ollama-vllm-sglang-and-4mh1)

- **브라우저가 진짜 추론 런타임이 됐다**: WebGPU가 2025-11-25 Chrome/Firefox/Edge/Safari 기본 탑재, 글로벌 커버리지 약 82.7%. **Transformers.js v4**(2026-02)는 런타임을 C++로 재작성 + WebGPU 백엔드로 v3 대비 3~10배 속도, Llama 3.2 3B가 약 60 tok/s. ([pockit.tools](https://pockit.tools/blog/run-llms-browser-webgpu-transformers-js-chrome-built-in-ai-guide/), [wowdata.science](https://wowdata.science/browser-native-agents-llms-in-browser-ai-guide-2026/))
- **2026년 스윗스팟**: 브라우저 AI = 고빈도·저복잡도(자동완성, 분류, 임베딩, 짧은 요약) / 서버 AI = 다단계 추론.

### 1.3 에이전트 표준 — 여기가 2026년의 핵심

#### MCP (Model Context Protocol)

- **거버넌스**: 2025년 12월 Anthropic이 MCP를 Linux Foundation 산하 **Agentic AI Foundation(AAIF)** 에 기증. AAIF는 MCP + goose + AGENTS.md를 앵커 프로젝트로 출범, **150개 이상 회원사로 Linux Foundation 역사상 가장 빠른 성장**. ([Linux Foundation 보도자료](https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation), [aaif.io](https://aaif.io/))
- **채택 규모**: Python + TypeScript SDK 월 다운로드 약 **9,700만**. 공식 MCP Registry API는 2026-05-24 기준 latest 서버 9,652건 / 버전 포함 28,959건. Glama 19,831+, MCP.so 16,000+. ([digitalapplied](https://www.digitalapplied.com/blog/mcp-97-million-downloads-model-context-protocol-mainstream), [mcp.institute](https://mcp.institute/research/state-of-mcp-2026))
- **엔터프라이즈**: Stacklok 2026 리포트 기준 조사 대상 소프트웨어 조직의 **41%가 MCP 서버를 프로덕션 배포**(제한적 또는 광범위). ([digitalapplied](https://www.digitalapplied.com/blog/mcp-adoption-statistics-2026-model-context-protocol))
- **2026-07-28 스펙 — 대격변**: ([공식 블로그](https://blog.modelcontextprotocol.io/posts/2026-07-28/))
  - **양방향 stateful → request/response stateless로 전환**. 공유 스토리지 없이 표준 로드밸런서 뒤 배치 가능.
  - **MRTR(Multi Round-Trip Requests)**: 서버가 `resultType: "input_required"` 반환 → 클라이언트가 `inputResponses`로 재시도. 영속 연결 없이 중간 확인 가능.
  - **헤더 기반 라우팅**: `Mcp-Method`, `Mcp-Name` HTTP 헤더로 게이트웨이가 JSON 파싱 없이 라우팅/인가.
  - **캐시 가능한 list 결과**: `ttlMs`, `cacheScope`.
  - **인가**: RFC 9207 issuer 검증 의무화, DCR → **CIMD(Client ID Metadata Documents)** 로 이전.
  - **Tasks 확장 정식화**: `tasks/get`, `tasks/update`, `subscriptions/listen`.
  - **Deprecation**: Roots / Sampling / Logging 폐기 예고(최소 12개월), HTTP+SSE 레거시 전송 폐기.
  - SDK: TS/Python/Go/C# Tier 1, **Rust SDK 베타**.
- **⚠️ 전략적 함의**: 대부분의 기존 MCP 서버/클라이언트는 아직 stateful 구 스펙이다. **2026-07-28 스펙을 구현한 프로젝트는 그 자체로 "최신"을 증명**한다. 이건 지금 가장 값싸고 확실한 최신성 시그널이다.

#### A2A (Agent2Agent)

- Google이 2025-06-23 Linux Foundation에 기증. 1주년 시점에 **150개 이상 조직 지원**, Google/Microsoft/AWS 플랫폼 통합, 공급망·금융·보험·ITOps에서 프로덕션 배포. v1.0에서 멀티 프로토콜 지원, 엔터프라이즈 멀티테넌시, 보안 플로우 현대화. ([LF 보도자료](https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year), [Google OSS 블로그](https://opensource.googleblog.com/2026/04/a-year-of-open-collaboration-celebrating-the-anniversary-of-a2a.html))
- AAIF 로드맵상 **A2A 거버넌스 스펙(에이전트 간 신뢰 체인) RFC 완료 목표가 2026 Q3**. 즉 지금이 아직 미완성 구간. ([RockB 정리](https://baeseokjae.github.io/posts/linux-foundation-agentic-ai-foundation-2026/))
- 학술적으로 **MCP/A2A/ACP가 표현하지 못하는 거버넌스 공백**이 지적되고 있다. ([arXiv 2606.31498](https://arxiv.org/pdf/2606.31498))

#### Agent Skills (SKILL.md) — 2026년 최대 확산 속도

- Anthropic이 2025-12-18 **agentskills.io** 에 개방 표준으로 공개, AAIF가 스튜어드. YAML frontmatter + Markdown 폴더. 서버·런타임·인프라 불필요. ([paperclipped](https://www.paperclipped.de/en/blog/agent-skills-open-standard-interoperability/), [laurentkempe](https://laurentkempe.com/2026/01/27/Agent-Skills-From-Claude-to-Open-Standard/))
- **2026년 3월 기준 32개 도구가 스펙 지원**: Claude Code, OpenAI Codex CLI/ChatGPT, VS Code/GitHub Copilot, Gemini CLI, JetBrains Junie, AWS Kiro, Block goose, Sourcegraph Amp, Snowflake, Databricks, ByteDance TRAE, Mistral AI.
- **규모**: Vercel skills.sh 89,753개, 3대 마켓플레이스(SkillsMP, Skills.sh, ClawHub) 합산 **49만 개 이상**. ([paperclipped](https://www.paperclipped.de/en/blog/agent-skills-open-standard-interoperability/))
- **함의**: 스킬은 이미 홍수다. "스킬을 만들었다"는 혁신이 아니고, **"49만 개 스킬의 보안·품질 문제를 다룬다"** 가 혁신이다(→ §3 빈틈 참조).

#### AGENTS.md / Spec-Driven Development

- **GitHub Spec Kit**: MIT, 2026년 6월 기준 **111k stars / 9.8k forks**, 30개 이상 에이전트 통합(Claude Code, Copilot, Cursor, Gemini CLI, Windsurf, Codex CLI, Amp, Roo Code…). 워크플로: specify → plan → tasks → implement. 요구사항 문법은 **EARS**가 사실상 표준. ([spec-kit](https://github.com/github/spec-kit/blob/main/spec-driven.md), [marktechpost](https://www.marktechpost.com/2026/05/08/meet-github-spec-kit-an-open-source-toolkit-for-spec-driven-development-with-ai-coding-agents/))
- AGENTS.md v1.0 안정 스펙 릴리스가 AAIF 로드맵에 있다. ([RockB](https://baeseokjae.github.io/posts/linux-foundation-agentic-ai-foundation-2026/))

### 1.4 에이전트 프레임워크 — 통합 완료, 승자 확정

- 2026년 6월 기준 **6개 SDK가 프로덕션을 지배**: LangGraph, CrewAI, OpenAI Agents SDK, Claude Agent SDK, Google ADK, Microsoft Semantic Kernel. ([requesty](https://www.requesty.ai/blog/best-ai-agent-sdks-compared-2026-langchain-crewai-openai-anthropic-google), [qubittool](https://qubittool.com/blog/ai-agent-framework-comparison-2026))
- **LangGraph가 프로덕션 마일리지 1위**: Klarna 8,500만 사용자, Uber, LinkedIn, JPMorgan. CrewAI 대비 토큰 비용 47% 절감(명시적 엣지 전이 vs LLM 라우팅). ([O'Reilly Radar](https://www.oreilly.com/radar/the-open-source-agent-toolkit-in-2026/))
- **레이어별 승자** (O'Reilly Radar, 2026): 오케스트레이션 = LangGraph / 메모리 = Mem0(하이브리드 벡터-그래프, 추론 14배 저렴) / 코딩 에이전트 = OpenHands(SWE-bench 53%+) / 추론 = vLLM.
- **명시된 빈틈 4가지** (동 출처, 그대로 인용 가치 있음):
  1. **7개 레이어 모두에서 best-in-class인 생태계가 없다** → 통합 마찰이 구조적으로 남아있다.
  2. **프로덕션 내구성 부족**: CrewAI는 크래시된 런에서 재개 불가. Skyvern 비전 스택은 멀티스텝 태스크 7개 중 1개꼴 실패.
  3. **관측성 도입 지연**: "이 레이어를 건너뛰는 게 에이전트 엔지니어링에서 가장 비싼 실수"인데 팀들은 여전히 프로덕션 위기 전까지 트레이싱을 미룬다.
  4. **지연시간-감사 트레이드오프 미해결**.
- 프레임워크 공간 자체의 진단: **"오픈소스 에이전트 툴킷은 대부분의 문제를 풀었지만, 각 문제를 열두 가지 서로 호환되지 않는 방식으로 풀었다."** ([O'Reilly Radar](https://www.oreilly.com/radar/the-open-source-agent-toolkit-in-2026/))

### 1.5 RAG의 현재 위치 — "죽지 않았고, 게으른 RAG만 죽었다"

- 2026년 담론의 결론: **naive RAG(2023년 chunk-and-pray 파이프라인)는 실제로 퇴출 중**이지만 검색 자체는 죽지 않았다. 롱 컨텍스트가 죽인 건 retrieval이 아니라 lazy retrieval. ([LightOn](https://lighton.ai/lighton-blogs/rag-is-dead-long-live-rag-retrieval-in-the-age-of-agents), [byteiota](https://byteiota.com/rag-vs-long-context-2026-retrieval-debate/), [AkitaOnRails](https://akitaonrails.com/en/2026/04/06/rag-is-dead-long-context/))
- **2026년 올바른 멘탈 모델**: "RAG냐 아니냐"가 아니라 툴킷 선택 — 롱 컨텍스트로 충분하면 검색 생략 / 코퍼스가 크거나 신선하거나 통제 필요하면 agentic retrieval / 행동은 파인튜닝.
- **"의무적 벡터 DB"의 종말**이 명시적으로 논의되고 있고, grep/구조적 검색이 재평가받고 있다. ([AkitaOnRails](https://akitaonrails.com/en/2026/04/06/rag-is-dead-long-context/))
- **심사 관점 번역**: 프로젝트 설명에 "RAG 파이프라인 구축"이라고 쓰면 2023~2024년 냄새가 난다. 같은 걸 해도 **"agentic retrieval / 조건부 검색 정책"** 으로 프레이밍하거나, 애초에 검색을 쓰지 않는 설계를 하는 게 유리하다.

### 1.6 AI 코딩 에이전트 확산이 만든 새로운 문제 — **2026년 최대 기회 영역**

#### (a) AI 슬롭(AI slop) 위기 — 실재하는 피해

- **비용 비대칭**이 근본 원인: 한 사람이 에이전트로 하루 5~6개 PR을 생성할 수 있고 생성 비용은 0에 수렴하는데, **리뷰 비용은 그대로**다. ([The New Stack](https://thenewstack.io/ai-generated-code-crisis/))
- **curl**: Daniel Stenberg가 2026년 1월 **6년간 운영한 HackerOne 버그바운티를 종료**. 2025년 중반 기준 제출의 약 1/5이 존재하지 않는 취약점을 기술적으로 그럴듯하게 서술한 AI 슬롭이었다.
- **Jazzband**(파이썬 프로젝트 컬렉티브): AI 생성 스팸 PR/이슈 물량을 감당 못해 **2026년 완전 해산**.
- **Godot** 메인테이너들이 "소모적이고 사기를 꺾는(draining and demoralizing)" AI 슬롭 제출을 공개 성토. ([devclass](https://www.devclass.com/ai-ml/2026/02/19/github-itself-to-blame-for-ai-slop-prs-say-devs/4091420))
- **GitHub이 PR kill switch를 검토** 중이고 커뮤니티 디스커션 #185387이 진행 중. ([The Register](https://www.theregister.com/software/2026/02/03/github-ponders-kill-switch-for-pull-requests-to-stop-ai-slop/4334869), [GitHub Discussion](https://github.com/orgs/community/discussions/185387))
- 96%의 코드베이스가 오픈소스에 의존하는데 슬롭이 그걸 위협한다는 분석. ([The New Stack](https://thenewstack.io/ai-slop-open-source/))

#### (b) 컨텍스트 엔지니어링

- 코딩 에이전트 세션이 벤치마크 태스크에서 **평균 8M 토큰 / 문제당 154턴**에 달한다. ([Code as Agent Harness, arXiv 2605.18747](https://arxiv.org/pdf/2605.18747))
- 컴팩션 전략이 "예방(prevention)" vs "치료(cure)"로 분화. OpenHands의 condenser는 9개 pluggable 구현을 파이프라인으로 조합하고, **삭제 대신 마커 삽입 방식이라 공격적 컴팩션 후에도 세션 리플레이가 가능**하다. ([arXiv 2604.03515](https://arxiv.org/pdf/2604.03515), [DeepWiki opencode](https://deepwiki.com/sst/opencode/2.4-context-management-and-compaction))
- **Tokalator**: 툴 헤비 워크플로에서 208K → 86K 토큰(58.6% 감소) 자동 컴팩션 시연. ([arXiv 2604.08290](https://arxiv.org/pdf/2604.08290))
- 진단: **컨텍스트 창이 커져도 컨텍스트 관리 문제는 사라지지 않았다. 100만 토큰 예산에서도 에이전트는 컨텍스트 엔지니어링에 실패한다.**

#### (c) 샌드박싱

- 2025년부터 Claude/GPT/Gemini/Codex가 **실제 코드를 실행하기 시작**했다 — 패키지 설치, 서버 실행, 파일시스템 수정, 네트워크 요청. 하루 수백만 세션. ([emirb.github.io](https://emirb.github.io/blog/microvm-2026/))
- 격리 3계층: microVM(Firecracker, Kata, E2B — 전용 커널, <150ms) / gVisor(유저스페이스 syscall 인터셉트) / 하드닝 컨테이너(신뢰 코드 전용).
- **Docker Sandboxes / `sbx`**: Claude Code, Codex, Gemini, Kiro를 위한 microVM 기반 샌드박스 CLI를 Docker가 직접 출시. ([amux.io](https://amux.io/guides/ai-agent-sandboxing/), [Northflank](https://northflank.com/blog/how-to-sandbox-ai-agents))
- **WASM + WASI가 capability-based 샌드박스 대안**으로 명시적으로 언급됨(Wasmtime/Wasmer).

#### (d) 관측성 / 비용

- **OTel GenAI semantic conventions 현황(중요)**: v1.42.0(2026-06-12)에서 모든 `gen_ai.*` 속성/스팬이 메인 semconv 저장소에서 **전용 GenAI conventions 저장소로 분리**. 다만 **stable 졸업이 아니다** — 여전히 pre-stable/experimental, 1.0 릴리스 없음, 버전 간 이름 변경 가능. v1.41 기준 agent/workflow/tool/model 스팬 + 지연·토큰 메트릭 정의. ([john-hodge.com](https://john-hodge.com/blog/opentelemetry-genai-semantic-conventions/), [greptime](https://greptime.com/blogs/2026-05-09-opentelemetry-genai-semantic-conventions))
  - 권장 포지션: **"지금 채택하되 빌드 대상 컨벤션 버전을 핀 고정하고 churn을 예상하라."**
- 오픈소스 비용/관측 스택: **Langfuse**(트레이싱 레이어에 비용 직접 기록, 자체호스팅), **LiteLLM**(140+ 프로바이더, 1,892 모델을 OpenAI 호환 키 하나로), **Arize Phoenix**(OTel 네이티브), **OpenObserve**(Rust, Parquet). ([finout](https://www.finout.io/blog/best-ai-cost-observability-tools-in-2026), [litellm.ai](https://www.litellm.ai/))
- 한계 진단: **대부분의 "LLM 관측성" 도구는 프롬프트·토큰·지연에서 멈춘다. 무엇이 잘못됐는지는 알려주지만 왜 잘못됐는지는 못 알려준다.** 에이전트가 그럴듯한 파라미터로 잘못된 툴을 호출하면 성공으로 완료되고 에러 로그도 안 남고 3단계 더 전파된다. ([atlan](https://atlan.com/know/ai-agent-observability/), [Braintrust](https://www.braintrust.dev/articles/agent-observability-complete-guide-2026))

#### (e) MCP 보안

- 2026년 1~2월에만 **30건 이상의 CVE** 접수. 파편화되고 신뢰되지 않는 레지스트리 생태계가 보안 위협. ([mcp.institute](https://mcp.institute/research/state-of-mcp-2026))
- **Tool Poisoning Attack**: 툴 설명에 사용자에게는 안 보이고 모델에게는 보이는 악성 지시를 심는 공격. ([Invariant Labs](https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks), [MDPI](https://www.mdpi.com/2624-800X/6/3/84))
- **mcp-scan**(Invariant Labs → Snyk 인수): 프롬프트 인젝션·툴 포이즈닝·rug pull 탐지. 2,000+ stars, 최신 v0.4.13(2026-04). **툴 핀닝**(첫 스캔 시 툴 설명 해시 → 변경 시 알림)이 핵심 기능. 현재 **Snyk Agent Scan**으로 리브랜딩. ([snyk/agent-scan](https://github.com/snyk/agent-scan), [appsecsanta](https://appsecsanta.com/mcp-scan))
- **OWASP MCP Top 10**이 존재한다. ([mcpplaygroundonline](https://mcpplaygroundonline.com/blog/mcp-security-tool-poisoning-owasp-top-10-mcp-scan))

---

## 2. 2026년에 이미 레드오션이 된 것

> 이 목록에 해당하면 심사위원이 "그거 이미 있잖아요"라고 할 가능성이 높다. 구체적 경쟁 프로젝트 이름을 함께 적었다.

| # | 레드오션 아이디어 | 이미 존재하는 것 | 근거 |
|---|---|---|---|
| 1 | **문서 Q&A / 사내 지식 RAG 챗봇** | 셀 수 없음. naive RAG 자체가 2023년 유물로 취급됨 | [LightOn](https://lighton.ai/lighton-blogs/rag-is-dead-long-live-rag-retrieval-in-the-age-of-agents) |
| 2 | **단순 API 래핑 MCP 서버** | 6개 공개 레지스트리에 **67,057개** 서버 카탈로그(2026-03). **52%가 방치 상태** | [rapidclaw](https://rapidclaw.dev/blog/mcp-servers-dead-what-it-means-2026), [tooldirectory](https://tooldirectory.ai/blog/state-of-mcp-servers-2026) |
| 3 | **AI 코드리뷰 봇** | CodeRabbit(200만 저장소, 1,300만 PR 처리), Greptile, Cursor BugBot, Qodo Merge(오픈소스 뿌리), SonarQube, Semgrep, Graphite, Augment | [Greptile 비교](https://www.greptile.com/content-library/best-ai-code-review-tools) |
| 4 | **또 하나의 에이전트 오케스트레이션 프레임워크** | LangGraph, CrewAI, OpenAI Agents SDK, Claude Agent SDK, Google ADK, Semantic Kernel, AG2, Strands, Pydantic AI, Mastra | [O'Reilly](https://www.oreilly.com/radar/the-open-source-agent-toolkit-in-2026/) |
| 5 | **로컬 LLM 채팅 UI / 데스크톱 앱** | Ollama, LM Studio, Jan, Msty, Open WebUI, GPT4All, AnythingLLM, Faraday | [youngju.dev](https://www.youngju.dev/blog/culture/2026-05-16-local-ai-on-device-llms-2026-ollama-lm-studio-jan-msty-open-webui-gpt4all-anythingllm-faraday-deep-dive) |
| 6 | **에이전트 메모리 레이어** | Mem0, Zep/Graphiti, Letta, Cognee, LangMem, MemPalace, Memvid, EverMind, Hindsight, ReMe | [devgenius 비교](https://blog.devgenius.io/ai-agent-memory-systems-in-2026-mem0-zep-hindsight-memvid-and-everything-in-between-compared-96e35b818da8) |
| 7 | **LLM 관측성/트레이싱 플랫폼** | Langfuse, Arize Phoenix, MLflow, Braintrust, LangWatch, Agenta, OpenObserve, Helicone | [confident-ai](https://www.confident-ai.com/knowledge-base/compare/best-ai-agent-observability-tools-2026) |
| 8 | **AI 게이트웨이 / LLM 프록시** | LiteLLM, **Envoy AI Gateway 1.0**(CNCF, 16 프로바이더 + MCP 게이트웨이), Portkey, Bifrost, Kong, Helicone | [aigateway.envoyproxy.io](https://aigateway.envoyproxy.io/) |
| 9 | **개인 비서 에이전트** | **OpenClaw** — 2026년 최대 사건. 9,000 → 30만 stars를 몇 주만에, React·Linux 추월. 29개 채널(WhatsApp/Telegram/Discord/Slack/Signal/iMessage). 창시자 Peter Steinberger는 2026-02 OpenAI 합류 | [Wikipedia](https://en.wikipedia.org/wiki/OpenClaw), [TechCrunch](https://techcrunch.com/2026/02/15/openclaw-creator-peter-steinberger-joins-openai/) |
| 10 | **브라우저 자동화 에이전트** | Browser Use, Stagehand(DOM), Skyvern(비전) | [O'Reilly](https://www.oreilly.com/radar/the-open-source-agent-toolkit-in-2026/) |
| 11 | **SWE 에이전트 / 자동 이슈 해결** | OpenHands(SWE-bench 53%+), Claude Code, Codex CLI, Gemini CLI, Amp, Roo Code, opencode | 동상 |
| 12 | **Agent Skill 모음집 / 스킬 마켓플레이스** | skills.sh 89,753개, 3대 마켓플레이스 합산 **49만 개** | [paperclipped](https://www.paperclipped.de/en/blog/agent-skills-open-standard-interoperability/) |
| 13 | **벡터 DB / 임베딩 스토어** | "의무적 벡터 DB의 종말"이 2026년 담론 | [AkitaOnRails](https://akitaonrails.com/en/2026/04/06/rag-is-dead-long-context/) |
| 14 | **텍스트→SQL, 요약기, 자막 생성기 등 단일 LLM 호출 래퍼** | "튜토리얼을 따라했다"는 신호로 읽힘 | [medium/design-bootcamp](https://medium.com/design-bootcamp/top-5-ai-projects-to-build-in-2026-dae0e82e85be) |
| 15 | **한국어 파인튜닝 LLM 공개** | 정부 독파모 사업으로 LG(K-EXAONE 2.0, 750B, Apache-2.0), SKT, 업스테이지, 모티프가 이미 HuggingFace 공개 | [ZDNet](https://zdnet.co.kr/view/?no=20260804100005) |

**공통 판정 기준**: 위 15개는 전부 "레이어를 하나 더 얹는" 아이디어다. 2026년에는 이미 그 레이어에 10개 이상의 구현이 있다.

---

## 3. 2026년에 막 열린 빈틈 — 10개

> 형식: 문제 / 현존 대안 / 왜 아직 빈틈인지 / 2주 MVP 가능성

### 빈틈 1. ★★★ AI 기여물 출처 증명 + 품질 게이트 (AI slop 대응)

- **문제**: 메인테이너가 익사 중이다. curl은 버그바운티를 종료했고 Jazzband는 해산했다. 생성 비용 0 vs 리뷰 비용 불변의 구조적 비대칭.
- **현존 대안**: [SlopGuard](https://github.com/Blue-B/slopguard)(GitHub App, 휴리스틱만으로 정밀도 100%/재현율 89%, MIT + Commons Clause — **한국 개발자 프로젝트**), [Slopper](https://github.com/marketplace/actions/slopper-ai-slop-detector)(GitHub Action), GitHub 자체 kill switch **검토 단계**.
- **왜 빈틈인가**: 현존 도구는 전부 **사후 탐지(detection) 휴리스틱**이다. **사전 증명(provenance)** 쪽은 비어 있다 — 기여자가 "이 PR의 어느 부분이 에이전트 산출이고, 어떤 테스트/에이전트 트레이스로 검증됐는지"를 **기계 검증 가능한 형태(in-toto attestation, sigstore 서명, git trailer)** 로 첨부하는 표준과 도구가 없다. 공급망 보안 진영(SLSA/sigstore)과 AI 슬롭 진영이 아직 만나지 않았다.
- **2주 MVP**: ✅ 가능. `git commit trailer + GitHub Action + cosign 서명 attestation` 조합. 서버 불필요.
- **차별화 필수**: SlopGuard가 이미 한국 프로젝트라 "탐지"로 가면 충돌한다. **증명·서명 축**으로 가야 한다.

### 빈틈 2. ★★★ MCP 서버 신뢰·헬스 레이어 (설치 전/후 지속 검증)

- **문제**: 67,057개 서버 중 **52% 방치**, **87%가 고신뢰 임계를 통과 못 함**. 개발자는 npm 패키지 고르듯 star 수와 감(vibe)으로 MCP 서버를 고르고 자격증명을 넘긴다.
- **현존 대안**: mcp-scan/Snyk Agent Scan(정적 스캔 + 툴 핀닝), 공식 MCP Registry(큐레이션·보안 등급이 **2026 로드맵 항목**이지 완성물이 아님).
- **왜 빈틈인가**: (a) **지속 헬스체크**가 없다 — 설치 시점 1회 스캔뿐. (b) **2026-07-28 stateless 스펙 준수 여부 검증기**가 없다. (c) 로컬 개발자용 "이 서버가 살아있나 / 툴 설명이 바뀌었나 / 어떤 권한을 요구하나"를 한 번에 보여주는 CLI가 얕다. 문제는 개수가 아니라 **큐레이션**이라는 게 명시적 진단이다.
- **2주 MVP**: ✅ 가능. CLI + 로컬 SQLite + 스케줄 헬스체크. 서버 인프라 0.
- **출처**: [rapidclaw](https://rapidclaw.dev/blog/mcp-servers-dead-what-it-means-2026), [roushanrakesh](https://roushanrakesh.com/blog/mcp-eval-gap-trust-infrastructure/), [tooldirectory](https://tooldirectory.ai/blog/state-of-mcp-servers-2026)

### 빈틈 3. ★★★ Agent Skills 보안 검증 / 서명 / 샌드박싱

- **문제**: 49만 개 SKILL.md가 3대 마켓플레이스에 떠 있다. SKILL.md는 **그냥 마크다운**이다 — 서버도 런타임도 인프라도 없다는 게 장점이자 **곧 프롬프트 인젝션 페이로드를 검증 없이 실행한다는 뜻**이다. MCP는 tool poisoning 연구와 CVE 30건이 이미 있지만, 스킬은 그 정도 검증 인프라가 없다.
- **현존 대안**: Snyk agent-scan이 "MCP servers and agent skills"를 표방하나 스킬 특화 룰은 얕음. AAIF의 **보안 적합성 인증 프로그램은 로드맵 단계**.
- **왜 빈틈인가**: 스펙이 2025-12-18에 나왔고 32개 도구가 3개월 만에 채택했다. **채택 속도가 보안 도구 성숙 속도를 압도**했다. 스킬 린터/서명/권한 선언 표준이 사실상 없다.
- **2주 MVP**: ✅ 가능. `skill-lint` CLI — frontmatter 스키마 검증 + 위험 패턴(외부 URL fetch, 자격증명 언급, 지시 은폐) 탐지 + sigstore 서명/검증.
- **출처**: [paperclipped](https://www.paperclipped.de/en/blog/agent-skills-open-standard-interoperability/), [snyk/agent-scan](https://github.com/snyk/agent-scan), [aaif.io](https://aaif.io/)

### 빈틈 4. ★★★ 로컬 코딩 에이전트 → OTel GenAI 트레이스 브리지

- **문제**: Claude Code / Codex CLI / Gemini CLI / opencode 등 **로컬 코딩 에이전트 세션은 관측성 블랙박스**다. 세션당 평균 8M 토큰 / 154턴이 로컬 JSONL에만 쌓이고, 팀 단위로는 무슨 일이 있었는지 아무도 모른다.
- **현존 대안**: Langfuse/Phoenix/MLflow는 **SDK로 계측한 애플리케이션**용이다. ccusage류는 비용만 본다. 로컬 에이전트의 훅 이벤트를 OTel GenAI semconv 스팬으로 변환하는 표준 어댑터가 없다.
- **왜 빈틈인가**: OTel GenAI semconv가 2026-06-12(v1.42.0)에야 전용 저장소로 분리됐고 **아직 pre-stable**이다. 즉 지금이 정확히 "규격은 나왔는데 구현이 없는" 구간이다.
- **2주 MVP**: ✅ 가능. 에이전트 훅 → OTLP exporter. Jaeger/Grafana에 그대로 뜨는 데모는 시각적으로 강력하다.
- **부가 가치**: 심사위원에게 "OTel GenAI semconv v1.4x 준수"라고 말할 수 있다 = 최신성 + 오픈소스 적절성 동시 득점.
- **출처**: [john-hodge](https://john-hodge.com/blog/opentelemetry-genai-semantic-conventions/), [greptime](https://greptime.com/blogs/2026-05-09-opentelemetry-genai-semantic-conventions), [arXiv 2605.18747](https://arxiv.org/pdf/2605.18747)

### 빈틈 5. ★★☆ 컨텍스트 예산 프로파일러 ("에이전트판 flamegraph")

- **문제**: 100만 토큰 컨텍스트에서도 에이전트는 컨텍스트 엔지니어링에 실패한다. **어떤 툴 호출이 컨텍스트를 태우는지** 아무도 측정하지 않는다. Tokalator가 58.6% 감소를 시연했다는 건 곧 **평상시 절반 이상이 낭비**라는 뜻이다.
- **현존 대안**: OpenHands condenser(9개 pluggable, 프레임워크 내부용), opencode 컴팩션(도구 내장), Tokalator(연구 프로토타입, arXiv 2604.08290).
- **왜 빈틈인가**: 전부 **특정 에이전트에 내장된 기능**이다. 에이전트 중립적인 **진단 도구**(프로파일러)가 없다. flamegraph가 perf 생태계에 준 역할을 하는 물건이 없다.
- **2주 MVP**: ✅ 가능. 세션 로그 파싱 → 툴별/파일별 토큰 귀속 → 터미널 TUI 또는 정적 HTML 리포트.

### 빈틈 6. ★★★ 한국 AI 기본법 대응 — 생성물 표시·검증 OSS

- **문제**: **인공지능기본법이 2026-01-22 시행**됐다(세계 최초의 포괄적 AI 규제 시행). 생성형 AI 결과물이 서비스 밖으로 다운로드·공유될 때 **표시 의무**가 발생한다. 표시 방법은 가시·가청 워터마크 또는 **메타데이터 등 기계 판독 방식**. 기계 판독 방식만 쓰면 다운로드 단계에서 최소 1회 이용자 고지 필요. 유예기간 최소 1년, 실제 제재는 2027년 이후 예상.
- **현존 대안**: C2PA/Content Credentials 계열 도구(국제 표준, 한국 법 요건 매핑 없음), 상용 컴플라이언스 솔루션.
- **왜 빈틈인가**: **한국 법 요건에 맞춘 오픈소스 라이브러리/검증기가 사실상 없다.** 시행 7개월 차, 유예기간 중 = 지금이 정확히 수요가 생기고 공급이 없는 창.
- **2주 MVP**: ✅ 가능. C2PA 기반 표시 + 한국 법 요건 체크리스트 검증기 + 이미지/오디오/텍스트 메타데이터 삽입 라이브러리 + CLI.
- **한국 심사 가산점**: 매우 큼. 국내 규제 적시 대응 = "잠재적 경쟁력"(15점) 직결.
- **출처**: [정책브리핑](https://www.korea.kr/news/policyNewsView.do?newsId=148958380), [신&김 뉴스레터](https://www.shinkim.com/kor/media/newsletter/3142), [help-me 가이드](https://www.help-me.kr/blog/article/korea-ai-act-2026-compliance-guide/), [openads 워터마크 표기법](https://www.openads.co.kr/content/contentDetail?contsId=18359)

### 빈틈 7. ★★☆ 한국 공공 API → MCP 서버 자동 생성기

- **문제**: data.go.kr 기반 MCP 서버들이 **전부 수작업**이다. 서울시, 조달, 안전, 금융 등이 각각 별도 저장소로 파편화돼 있다. 공공데이터포털은 10만 개 이상 데이터셋을 보유한다.
- **현존 대안**: [Koomook/data-go-mcp-servers](https://github.com/Koomook/data-go-mcp-servers), [pinnaclesoft-ko 서울 예제](https://github.com/pinnaclesoft-ko/be-node-seoul-data-mcp), OpenData MCP(mcp.ezrnd.co.kr) — 전부 **개별 API를 손으로 감싼 것**.
- **왜 빈틈인가**: 한국 공공 API 특유의 함정(이중 인코딩된 `serviceKey`, XML/JSON 혼재, 비표준 페이지네이션, 오류코드 불일치, OpenAPI 스펙 미제공/부정확)을 흡수하는 **제너레이터**가 없다. 10만 개 데이터셋을 손으로 감쌀 수는 없다.
- **2주 MVP**: ✅ 가능. 스펙 파싱 → MCP 서버 코드 생성 + 2026-07-28 stateless 스펙 준수.
- **한국 심사 가산점**: 큼(공공데이터 활용 + 재사용성).

### 빈틈 8. ★★☆ AI 의존성 게이트 (환각 패키지 / slopsquatting 방어)

- **문제**: **AI 코드 제안이 존재하지 않거나 낡은 패키지를 참조**해서 새로운 공급망 침해 벡터를 만든다. 동시에 SBOM은 "있냐"가 아니라 "그걸로 행동할 거버넌스가 있냐"의 문제로 이동했고, **모델용 ML-BOM/AI-BOM**이 새 요구사항으로 등장했다.
- **현존 대안**: Socket/Snyk 등 상용 위주, OSV-Scanner(일반 취약점), Sigstore cosign + SLSA provenance(프로덕션 준비 완료·널리 채택).
- **왜 빈틈인가**: "**이 의존성은 에이전트가 이번 세션에 추가했다**"는 사실 자체를 추적하는 도구가 없다. 에이전트 세션 ↔ 의존성 변경 ↔ 패키지 실존성/평판을 연결하는 게이트가 비어 있다.
- **2주 MVP**: ✅ 가능. pre-commit hook + CI action. 신규 의존성 diff → 레지스트리 실존/나이/다운로드 검증 → 에이전트 귀속 태깅.
- **출처**: [SD Times](http://sdtimes.com/software-supply-chain-security/), [Cloudsmith](https://cloudsmith.com/blog/the-2026-guide-to-software-supply-chain-security-from-static-sboms-to-agentic-governance), [AquilaX](https://aquilax.ai/blog/supply-chain-artifact-signing-slsa)

### 빈틈 9. ★★☆ 접근성 × 플로우 인지 자동 검사 (KWCAG 2.2 / EAA)

- **문제**: axe-core 단독 자동 검출률 **27%**, Pa11y 병행해도 **35%**. 나머지는 사람의 판단이 필요했고 아무도 시간이 없었다. 유럽 접근성법(EAA)이 2025-06-28 27개 회원국에서 발효, EU AI Act가 2026-08-02 전면 집행. 한국은 KWCAG 2.2.
- **현존 대안**: axe-core(생태계 앵커, 오픈소스 룰 엔진), Lighthouse, Pa11y — 전부 **정적 단일 페이지 스캔**. 상용 axe DevTools/Auditor, AI 네이티브 a11y 코파일럿(EvinceAI 등)은 **상용**. Flow-A11y는 2026년 논문 단계([arXiv 2607.03100](https://arxiv.org/pdf/2607.03100)).
- **왜 빈틈인가**: "**플로우 인지**"(로그인 → 장바구니 → 결제 같은 다단계 흐름 전체를 스크린리더 관점으로 통과하는지) 오픈소스 도구가 없다. 브라우저 에이전트 + axe-core 조합이면 지금 가능한데 아무도 안 만들었다. **한국어 스크린리더 맥락(센스리더 등)은 완전히 비어 있다.**
- **2주 MVP**: ⚠️ 범위를 좁히면 가능(플로우 3개 + KWCAG 2.2 특정 항목 세트).
- **한국 심사 가산점**: 큼(디지털 포용, 공공기관 의무).

### 빈틈 10. ★★☆ 에이전트 변경에 대한 로컬 퍼스트 감사·되돌리기

- **문제**: 에이전트가 로컬 파일/데이터를 대량 수정하는데, 사람 편집과 에이전트 편집을 **구분해서 병합·되돌리기**할 방법이 없다. git은 커밋 단위라 너무 거칠고, 에이전트는 커밋 사이에 수백 번 편집한다.
- **현존 대안**: CRDT 진영은 성숙했다 — Yjs(주당 92만 다운로드, 17k stars, Notion/Tiptap/BlockNote), Automerge 3.0(칼럼나 저장으로 문서 크기 40~60% 감소, 서브밀리초 병합), Loro, ElectricSQL. 그러나 **전부 사람↔사람 협업 전제**다.
- **왜 빈틈인가**: "에이전트를 또 하나의 협업자로 모델링한 CRDT 레이어"가 없다. 로컬 퍼스트는 2026년에 "2015년의 컨테이너화" 수준 — 도구는 작동하고 얼리어답터가 실제 제품을 출하 중이다. 여기에 에이전트를 붙인 사례가 아직 없다.
- **2주 MVP**: ⚠️ 중상 난이도. CRDT 학습 곡선이 있다. 파일시스템 워처 + Automerge 기반 좁은 데모로는 가능.
- **출처**: [pkgpulse CRDT 비교](https://www.pkgpulse.com/guides/yjs-vs-automerge-vs-loro-crdt-libraries-2026), [verity](https://verity.salient.community/research/local-first-software-in-2026.html), [FOSDEM 2026 local-first 트랙](https://fosdem.org/2026/schedule/track/local-first/)

### (보조) 빈틈 11~12 — 난이도 높지만 임팩트 큼

- **11. WASM 컴포넌트로 실행하는 MCP 서버 런타임**: **WASI 0.3이 2026-06-11 Bytecode Alliance에서 비준**됐다(async func / stream<T> / future<T> 네이티브). Wasmtime 43, JCO에서 지원 착륙 중. WASI 1.0은 2026년 완료 목표. MCP 서버를 capability-based WASM 샌드박스에서 돌리면 §빈틈2·3의 보안 문제가 구조적으로 해결된다. **2주 MVP: ❌ 어려움**(툴체인 미성숙). ([platform.uno](https://platform.uno/blog/the-state-of-webassembly-2025-2026/), [techbytes](https://techbytes.app/posts/wasi-0-3-and-beyond-webassembly-interfaces-2026/))
- **12. 망분리/폐쇄망 환경용 에이전트 스택**: KISA가 **총 55억 원 규모 N2SF 도입·실증 사업**을 본격화하며 "업무 환경에서 생성형 AI 활용"을 6대 모델 중 하나로 선정. 폐쇄망에서 MCP·에이전트를 돌리는 오픈소스 레퍼런스가 없다. **2주 MVP: ⚠️ 인프라 부담 큼**. ([드림시큐리티](https://www.dreamsecurity.com/pr/news/1091))

---

## 4. AI 외 영역의 2026 트렌드

### 4.1 WebAssembly / WASI
- **WASI 0.3 비준: 2026-06-11**(Bytecode Alliance). 컴포넌트 모델 네이티브 async 프리미티브로 재기반. WASI 0.2의 콜백 우회를 제거.
- 2026년 Preview 3 안정화 + 컴포넌트 모델 확산으로 **WASM이 특정 용도에서 컨테이너의 정당한 대안**이 됐다.
- 런타임: Wasmtime 43, JCO. WASI 1.0 표준화 2026년 완료 목표.
- 출처: [platform.uno](https://platform.uno/blog/the-state-of-webassembly-2025-2026/), [zylos](https://zylos.ai/research/2026-02-05-webassembly-ecosystem-2026/)

### 4.2 Rust
- **Linux 커널에서 실험 단계 종료**(2025 Kernel Maintainers Summit). 2026년 기준 커널 코드베이스의 약 0.4%, 수십만 줄.
- **Ubuntu 25.10이 Rust coreutils를 기본 탑재**, 26.04 LTS로 계승 예정.
- 개발자 만족도 조사 전부 1위, LangPop 종합 7~8위. ripgrep/fd/bat 등 JS 생태계 핵심 도구 다수가 Rust.
- **MCP Rust SDK는 베타** — 여기 기여하는 것도 하나의 축.
- 출처: [langpop](https://langpop.com/blog/state-of-rust-2026), [desdelinux](https://blog.desdelinux.net/en/linux-kernel-rust-official-android-16-drivers-drm-debate/)

### 4.3 로컬 퍼스트 / CRDT
- Yjs = 프로덕션 디폴트(주당 92만 다운로드, 17k stars). Automerge 3.0(2025 말) = 칼럼나 저장으로 40~60% 크기 감소 + 서브밀리초 병합. Loro = 신흥.
- ElectricSQL은 "Electric Next"(서버 전용, Postgres 테이블 스트리밍)로 피벗.
- **FOSDEM 2026에 Local-First 전용 트랙**이 생겼다 = 커뮤니티 정통성 확보 신호.
- 평가: "2026년 로컬 퍼스트는 2015년의 컨테이너화와 비슷하다 — 도구는 작동하고 얼리어답터가 실제 제품을 출하 중."

### 4.4 개발자 경험(DX) / TUI 르네상스
- **Bubble Tea v2.0**(2026-02, "orders of magnitude" 성능 개선), Textual(Python), Ink(React 패턴), Ratatui(Rust).
- 터미널이 더 이상 검은 배경 회색 글자가 아니다 — 둥근 모서리, 그라디언트, 마우스, 마크다운, 이미지.
- 동인: SSH/컨테이너/CI가 일상이 되면서 GUI 없는 작업이 잦아짐 + AI 코딩 어시스턴트가 TUI 프레임워크 패턴을 잘 이해함.
- **전략적 의미**: CLI/TUI는 2주 안에 완성도 있는 데모를 만들기 가장 쉬운 형태다(§6 참조).
- 출처: [byteiota TUI](https://byteiota.com/tui-renaissance-2026-why-terminal-uis-are-back/), [youngju.dev 심층](https://www.youngju.dev/blog/culture/2026-05-14-tui-development-ratatui-bubbletea-ink-textual-terminal-ui-renaissance-deep-dive-2026.en)

### 4.5 관측가능성 (OTel)
- §1.6(d) 참조. 핵심: **GenAI semconv는 전용 저장소로 분리됐지만 여전히 experimental**. 지금 채택하되 버전 핀 고정이 권장 포지션.
- 이 "규격은 있는데 stable이 아닌" 상태가 곧 기여 기회다.

### 4.6 공급망 보안
- SBOM/SLSA/Sigstore가 **버즈워드 → 운영 요건**으로 성숙. 동인: 미국 EO 14028, **EU Cyber Resilience Act**.
- Sigstore(cosign / Fulcio CA / Rekor 투명성 로그)는 프로덕션 준비 완료·널리 채택. SLSA provenance와 결합해 소스→배포 아티팩트 신뢰 체인 완성.
- **새 축**: AI 자산으로 확장 — 모델 provenance, 학습 데이터 무결성, **ML-BOM**, HuggingFace pickle 익스플로잇.
- 출처: [SD Times](http://sdtimes.com/software-supply-chain-security/), [AppScale](https://appscale.blog/en/blog/supply-chain-security-ai-sbom-model-provenance-huggingface-pickle-exploits-2026)

### 4.7 접근성
- EAA 2025-06-28 27개국 발효, **EU AI Act 2026-08-02 전면 집행** — 고위험 AI 제공자는 EAA 포함 기존 EU 법 준수 의무.
- axe-core는 여전히 생태계 앵커지만 **자동 검출 커버리지 27~35%**가 구조적 한계.
- 한국: KWCAG 2.2. ([a11ykr.github.io/kwcag22](https://a11ykr.github.io/kwcag22/))

### 4.8 온디바이스 / 엣지
- WebGPU 82.7% 커버리지 + Transformers.js v4 + 2GB 미만 양자화 모델 = 브라우저가 추론 런타임.
- 2026년 AI CPU에 NPU 통합 — 온디바이스 작업에서 외장 GPU 대비 **70% 낮은 전력으로 40~45 TOPS**. `[일부 미검증 — 벤더 자료 성격]`
- 출처: [szwecent 구매가이드](https://www.szwecent.com/ko/which-2026-ai-cpus-should-your-enterprise-deploy-a-procurement-guide/)

### 4.9 데이터 엔지니어링
- **단일 노드 데이터 엔지니어링**이 2026 트렌드. 예전에 분산 시스템이 필요했던 워크로드를 DuckDB/Polars/DataFusion/LakeSail이 처리. DuckDB는 ~10억 행까지 강력.
- **DuckDB v1.5.3**(2026-05): **Quack Remote Protocol** 도입 — 필요 시 클라이언트-서버 구성, 원격 attach/쿼리 오케스트레이션. Iceberg 확장에 **MERGE INTO** 지원.
- **Iceberg가 신규 레이크하우스 기본 오픈 테이블 포맷**.
- 출처: [datalakehousehub](https://datalakehousehub.com/blog/2026-05-single-node-data-engineering/), [endjin](https://endjin.com/blog/duckdb-rise-of-in-process-analytics-understanding-data-singularity)

### 4.10 그린 소프트웨어 (보조 축)
- 데이터센터 전력이 AI 워크로드로 2026년 1,000 TWh 초과 전망.
- **Carbonlog** — AI 보조 개발의 탄소발자국을 실시간 추적하는 **오픈소스 Claude Code 플러그인**(2026-03). Green Software Foundation의 Carbon-Aware SDK, SCI 명세, CodeCarbon.
- 출처: [Open Source For You](https://www.opensourceforu.com/2026/03/cnaught-open-sources-plugin-to-measure-ai-energy-and-carbon-use/), [GSF awesome-green-software](https://github.com/Green-Software-Foundation/awesome-green-software)

### 4.11 언어 지형
- **2025년 8월 TypeScript가 GitHub 최다 사용 언어로 Python·JavaScript를 추월**. AI가 "타입 있냐 없냐" 논쟁을 정리했다 — 타입 시스템이 **내가 안 쓴 코드의 안전망**이 됐기 때문.
- GitHub에 AI 관련 저장소 430만 개 이상, LLM 관련만 전년 대비 **178% 증가**.
- 출처: [GitHub Octoverse](https://github.blog/news-insights/octoverse/what-the-fastest-growing-tools-reveal-about-how-software-is-being-built/)

---

## 5. 한국 특수 맥락

### 5.1 대회 자체
- 주최 과학기술정보통신부 / 주관 정보통신산업진흥원, 운영 한국오픈소스협회. **올해 20주년**. 학생부문·일반부문. 접수 2026-06-15 ~ 07-17, 오리엔테이션 7/23에 평가기준 공지.
- ⚠️ **정확한 배점표는 공개 웹에서 확인 불가** `[미검증]`. 공식: [osscontest.kr](https://osscontest.kr/overview), [oss.kr](https://www.oss.kr/dev_competition/registration)
- 출처: [아주대 공지](https://www.ajou.ac.kr/sw/board/notice.do?mode=view&articleNo=370437), [ZDNet](https://zdnet.co.kr/view/?no=20260615161052), [swuniv](https://www.swuniv.kr/38/?idx=171852041&bmode=view)

### 5.2 한국에서 특히 가치를 인정받는 주제 (가산점 축)

| 축 | 근거 | 강도 |
|---|---|---|
| **AI 기본법 대응** | 2026-01-22 시행. 세계 최초 포괄 AI 규제. 생성물 표시 의무, 고영향 AI 사전 고지, 유예 최소 1년(제재는 2027~) | ★★★ |
| **공공데이터 활용** | 공공데이터포털 10만+ 데이터셋. 2026년 6월 활용신청 TOP 10에 통합 플랫폼 포함. 단 "AI 학습에 적합한 품질·라벨링은 제한적"이 정부 스스로의 진단 | ★★★ |
| **웹접근성 / 디지털 포용** | KWCAG 2.2. 공공기관 의무. 국내 심사에서 사회적 가치로 높게 평가되는 전통 | ★★★ |
| **망분리 완화 / N2SF / 폐쇄망** | KISA 55억 규모 도입·실증 사업, 6대 모델에 "업무 환경 생성형 AI 활용" 포함 | ★★☆ |
| **독자 AI 파운데이션 모델 연계** | K-EXAONE 2.0(LG, 750B, 2026-07-31 HuggingFace 공개, **Apache-2.0으로 라이선스 전환**), SKT·업스테이지·모티프테크놀로지스 2차 평가 모델 공개 | ★★☆ |
| **한국어 처리** | Kiwi/KoNLPy 형태소 분석이 여전히 실무 표준. 한국어 특화 토크나이저 이슈 존재. KoBERT는 레거시로 분류됨 | ★★☆ |
| **국산 NPU / 온디바이스** | 모빌린트 MLX-A1 등 국산 엣지 AI. 제조 중소·중견기업 온디바이스 AI 지원 정책 | ★☆☆ |

출처: [ZDNet 독파모](https://zdnet.co.kr/view/?no=20260804100005), [헤럴드경제 K-엑사원](https://biz.heraldcorp.com/article/10826523), [CODIT 오픈소스 AI 전략](https://thecodit.com/blog/open-source-ai-strategy-kr), [드림시큐리티 N2SF](https://www.dreamsecurity.com/pr/news/1091), [엑스디노드 정부 AI 예산](https://www.xdnode.co.kr/insight/articles/2026-government-ai-infrastructure-programs)

> **정책 인사이트**: 정부의 AI R&D 지원은 초거대 모델·산업별 솔루션에 집중되어 있고 **"오픈소스 기반 모델 개발이나 생태계 조성은 사실상 정책 사각지대"** 라는 진단이 나와 있다([CODIT](https://thecodit.com/blog/open-source-ai-strategy-kr)). 이 사각지대를 정면으로 겨냥한다고 서사를 짜면 심사위원에게 강하게 꽂힌다.

### 5.3 한국 대회에서 약하게 평가될 수 있는 주제

1. **영어권 개발자만 대상으로 하는 니치 개발 도구** — "국내 파급효과" 설명이 어려움.
2. **해외 상용 SaaS(OpenAI API 등)에 완전 종속된 구조** — 오픈소스 적절성 10점에서 불리. 최소한 로컬/오픈 웨이트 fallback 경로 필요.
3. **데모 불가능한 순수 라이브러리/인프라** — 15점짜리 "활용성" 심사에서 눈에 보이는 결과가 없으면 손해.
4. **라이선스/거버넌스가 부실한 프로젝트** — 오픈소스 대회에서 치명적. LICENSE, CONTRIBUTING, CoC, 의존성 라이선스 호환성 표는 기본. OpenChain 한국 워킹그룹의 [ISO 표준 기반 기업 오픈소스 관리 가이드(2026)](https://openchain-project.github.io/OpenChain-KWG/guide/opensource_for_enterprise/) 참조 가치 있음.
5. **또 하나의 한국어 LLM 파인튜닝** — 정부 독파모 4사가 이미 750B급을 Apache-2.0으로 공개했다. 개인/소규모 팀의 파인튜닝은 상대 비교에서 초라해진다.
6. **AI 슬롭 냄새가 나는 산출물** — 2026년 심사위원은 이걸 알아본다. README가 이모지 폭탄 + 과장된 마케팅 문구면 즉시 감점 요인.

---

## 6. 2주 개발 현실성 필터

AI 코딩 에이전트를 최대 활용하는 소규모 팀이 2주 안에 **"데모 가능한 완성도"** 에 도달하는 프로젝트의 기술적 특성:

### ✅ 유리한 특성

| 특성 | 이유 |
|---|---|
| **CLI / TUI 형태** | UI 디자인 비용 0에 가까움. Bubble Tea v2.0 / Textual / Ink / Ratatui가 성숙. 에이전트가 TUI 패턴을 잘 생성함. 터미널 데모는 녹화도 쉽다(asciinema/VHS) |
| **기존 생태계의 확장점에 꽂기** | GitHub App/Action, pre-commit hook, MCP 서버, SKILL.md, VS Code 확장, OTel exporter. **호스트가 UI·배포·인증을 다 해준다** |
| **서버 인프라 0** | 로컬 실행 + SQLite/파일 저장. 배포·운영·비용·보안 리스크 전부 제거. 심사위원도 `npx`/`uvx` 한 줄로 재현 가능 |
| **좁고 명확한 입출력** | "이 입력을 넣으면 이 판정이 나온다". 검증 가능한 성공 기준을 만들 수 있어 에이전트에게 루프를 맡길 수 있음 |
| **명세가 이미 존재하는 문제** | MCP 2026-07-28 스펙, OTel GenAI semconv, SKILL.md 스펙, KWCAG 2.2, SLSA/in-toto. **스펙이 곧 테스트 케이스**라 2주 안에 "정확성"을 증명 가능 |
| **정적 산출물 데모** | HTML 리포트, SVG 다이어그램, 터미널 출력. 실시간 서버 데모보다 실패 리스크가 낮다 |
| **eval/골든셋을 프로젝트에 포함** | SlopGuard가 "정밀도 100% / 재현율 89%"라고 말할 수 있는 이유. **숫자가 있으면 심사에서 압도적으로 유리** |

### ❌ 불리한 특성

- 모델 학습/파인튜닝이 크리티컬 패스에 있음 (GPU 시간, 재현성, 데이터 확보)
- 멀티유저 실시간 협업 서버 (배포·상태·인증 전부 필요)
- 모바일 네이티브 앱 (빌드·심사·기기 테스트)
- 대규모 데이터 수집/크롤링 의존 (법적 리스크 + 시간)
- 브라우저 확장 + 서버 + CLI 등 **3개 이상의 배포 타깃**
- CRDT/분산합의 등 정확성 증명이 어려운 알고리즘 코어
- WASM 컴포넌트 모델 툴체인 (2026년에도 러프함)

### 권장 2주 스케줄 뼈대

```
D1-2   스펙 확정 + 골든셋(테스트 케이스 20~50개) 먼저 작성 → 검증: 케이스가 fail하는 것 확인
D3-7   코어 구현 (에이전트에게 골든셋 통과를 목표로 위임) → 검증: 골든셋 통과율 측정
D8-10  CLI/TUI + 리포트 출력 + `npx/uvx` 일회 실행 경로 → 검증: 빈 머신에서 재현
D11-12 오픈소스 위생: LICENSE, CONTRIBUTING, CoC, 의존성 라이선스 표, SBOM, 릴리스 서명
D13-14 데모 녹화(asciinema/VHS) + README + 숫자(정밀도/재현율/절감률) 확정
```

**핵심**: **골든셋을 먼저 쓰는 것**이 AI 코딩 에이전트를 2주 동안 자율 루프로 돌릴 수 있게 하는 유일한 방법이다. 성공 기준이 약하면 에이전트는 계속 사람을 부른다.

---

## 7. 2026 심사위원에게 "최신 기술을 제대로 썼다"는 인상을 주는 기술 시그널 TOP 10

| # | 시그널 | 왜 최신인가 (근거) |
|---|---|---|
| **1** | **MCP 2026-07-28 stateless 스펙 준수** (MRTR, `Mcp-Method`/`Mcp-Name` 헤더 라우팅, `ttlMs`/`cacheScope`, CIMD 인가) | 스펙이 나온 지 한 달. 기존 서버 대부분은 구 stateful 스펙. 이걸 구현했다는 것만으로 최신성 증명 | 
| **2** | **Agentic AI Foundation 표준군 정렬** (MCP + AGENTS.md + Agent Skills를 벤더 중립 표준으로 명시적 채택) | AAIF는 2025-12 출범, 150+ 회원사로 LF 역사상 최속 성장. "벤더 종속 아님"을 구조적으로 증명 |
| **3** | **OTel GenAI semantic conventions 기반 계측** (버전 핀 고정 명시) | v1.42.0(2026-06-12)에 전용 저장소 분리, 아직 pre-stable. 이걸 정확히 아는 것 자체가 최신성 신호 |
| **4** | **Sigstore(cosign/Fulcio/Rekor) + SLSA provenance로 릴리스 서명** | EU CRA·EO 14028로 운영 요건화. 학생/개인 프로젝트가 이걸 하면 성숙도가 튄다 |
| **5** | **AI 기여물의 기계 검증 가능한 출처 표기** (git trailer / in-toto attestation) | curl 버그바운티 종료, Jazzband 해산, GitHub kill switch 검토가 2026년 사건. 문제 인식 자체가 최신 |
| **6** | **에이전트 산출물의 결정적 리플레이 / 골든셋 eval 수치 제시** | "정밀도 X% / 재현율 Y%"를 말할 수 있는 프로젝트는 2026년에도 소수. 관측성 스킵이 "가장 비싼 실수"라는 게 업계 진단 |
| **7** | **microVM / gVisor / WASM capability 샌드박스로 에이전트 실행 격리** | Docker `sbx`가 2026년에 등장. "컨테이너는 샌드박스가 아니다"가 2026년 명제 |
| **8** | **SGLang(RadixAttention) 또는 vLLM(PagedAttention)을 목적에 맞게 선택하고 그 이유를 설명** | 엔진 역할 분화가 2026년에 끝났다. "그냥 Ollama 썼어요"와 차원이 다름 |
| **9** | **WebGPU + Transformers.js v4 온디바이스 추론** (서버 비용 0, 프라이버시 100%) | WebGPU 2025-11 전 브라우저 기본 탑재, 커버리지 82.7%. v4는 2026-02 C++/WebGPU 재작성 |
| **10** | **agentic retrieval / 조건부 검색 정책** 또는 **롱컨텍스트 + grep으로 벡터DB 제거** | "의무적 벡터 DB의 종말"이 2026년 담론. 벡터DB를 안 쓴 이유를 설명할 수 있으면 오히려 최신 |

**보조 시그널**: DuckDB v1.5.3 Quack Remote Protocol / Iceberg MERGE INTO, WASI 0.3(2026-06-11 비준), Automerge 3.0 칼럼나 포맷, Bubble Tea v2.0, TypeScript strict + 타입을 안전망으로 쓴 서사, MCP Rust SDK(베타) 기여, Carbonlog류 탄소 측정 통합.

---

## 8. "작년 것"처럼 보이는 안티 시그널 TOP 10

| # | 안티 시그널 | 왜 낡아 보이는가 |
|---|---|---|
| **1** | **"LangChain으로 RAG 파이프라인을 구축했습니다"** | 2023년 문장. chunk-and-pray는 2026년에 명시적으로 퇴출 대상 |
| **2** | **벡터 DB를 아키텍처 다이어그램 중앙에 그림** | 2026년엔 "정말 필요했나"를 먼저 묻는다 |
| **3** | **"프롬프트 엔지니어링"을 핵심 기여로 제시** | 2026년 용어는 컨텍스트 엔지니어링 / 하네스 엔지니어링. 프롬프트는 구현 디테일 |
| **4** | **단일 API를 감싼 MCP 서버 하나** | 67,057개 존재, 52% 방치. 개수 경쟁은 이미 끝났고 문제는 큐레이션 |
| **5** | **자체 에이전트 오케스트레이션 프레임워크를 새로 만듦** | 6개 SDK로 통합 완료. "각 문제를 열두 가지 호환 안 되는 방식으로 풀었다"는 게 업계 자조 |
| **6** | **또 하나의 로컬 LLM 채팅 UI / 개인 비서** | Ollama·LM Studio·Jan·Open WebUI·AnythingLLM에 더해 OpenClaw가 30만 stars |
| **7** | **GPT-3.5/GPT-4 또는 Llama 2·3 세대 모델 명시** | 2026년 기준은 Kimi K3, DeepSeek V4, GLM-5.x, Qwen3.6, Gemma 4. 구세대 모델명은 즉시 연식을 드러냄 |
| **8** | **OpenAI API 단일 종속, 오픈 모델 경로 없음** | 오픈소스 대회에서 "오픈소스SW 적절성"(10점) 직격탄 |
| **9** | **평가 지표 없이 "잘 작동합니다"** | 2026년은 eval의 해. 숫자 없는 AI 프로젝트는 검증 불가 취급 |
| **10** | **README가 이모지 폭탄 + 과장 마케팅 + 근거 없는 벤치마크 표** | **정확히 AI 슬롭의 외형**이다. 2026년 메인테이너/심사위원은 이 패턴을 즉시 식별한다 |

**추가 안티 시그널**: "블록체인+AI", "메타버스", 파인튜닝 자체를 성과로 제시, Docker 컨테이너를 보안 경계로 주장, 웹 접근성 미고려, LICENSE 파일 없음, 의존성 라이선스 호환성 미검토, 커밋이 전부 하루에 몰려 있음(에이전트 일괄 생성 인상).

---

## 9. 종합 권고 — 어느 축을 잡을 것인가

**최우선 조합 (2주 실현성 × 최신성 × 한국 가산점)**

1. **1순위 — 빈틈 4 + 5 결합**: 로컬 코딩 에이전트 세션을 **OTel GenAI semconv로 내보내고 컨텍스트 예산을 프로파일링**하는 CLI.
   최신성 ★★★(OTel GenAI가 아직 pre-stable) / 2주 실현성 ★★★(훅 + exporter + TUI) / 레드오션 회피 ★★★ / 한국 가산점 ★☆☆
2. **2순위 — 빈틈 6**: **한국 AI 기본법 생성물 표시·검증 오픈소스 라이브러리**.
   한국 가산점 ★★★(2026-01-22 시행, 유예 중) / 2주 실현성 ★★★ / 최신성 ★★☆ / 경쟁 ★☆☆(거의 없음)
3. **3순위 — 빈틈 1 + 8 결합**: **AI 기여물 provenance attestation + 환각 패키지 게이트** (sigstore + in-toto + GitHub Action).
   최신성 ★★★ / 서사 강도 ★★★(curl·Jazzband 스토리) / 2주 실현성 ★★☆ / SlopGuard와 차별화 설계 필수
4. **4순위 — 빈틈 2 or 3**: **MCP 서버 / Agent Skill 신뢰 검증 CLI**(2026-07-28 스펙 준수 검증 포함).
   최신성 ★★★ / 2주 실현성 ★★★ / 경쟁 ★★☆(mcp-scan 존재 → 지속 헬스체크·스펙 검증으로 차별화)

**어느 축을 잡든 반드시 넣을 것**: (a) 골든셋 기반 정량 지표, (b) `npx`/`uvx` 원커맨드 재현, (c) sigstore 서명된 릴리스 + SBOM, (d) 표준 이름과 버전 명시(MCP 2026-07-28 / OTel semconv vX.YZ / SLSA Lv), (e) asciinema 데모, (f) 라이선스·CONTRIBUTING·CoC 완비.

---

## 부록 A. 검증 한계 (`[미검증]` 목록)

- 2026 오픈소스 개발자대회의 **정확한 배점표**(혁신성 6 / 오픈소스 적절성 10 / 활용성 15)는 공개 웹에서 확인 불가. 오리엔테이션(7/23) 공지 대상.
- 최근(2024~2025) **수상작 목록**: oss.kr 수상작 페이지가 HTTP 403으로 직접 확인 실패. 레드오션 판정에 수상작 이력이 반영되지 않았음 → **별도 확인 권장**(대회 사무국 02-599-7917 / contest@oss.kr).
- NPU 성능 수치(40~45 TOPS, 전력 70% 절감)는 벤더 성격 자료 기반.
- 일부 2026년 모델 벤치마크 순위(Kimi K3, GLM-5.2 등)는 2차 매체 요약 기반이며 원 벤치마크 리더보드 직접 확인은 하지 않음.
- Agent Skills 마켓플레이스 스킬 개수(49만)는 단일 출처 기반.

## 부록 B. 주요 출처

**표준/거버넌스**
- MCP 2026-07-28 스펙: https://blog.modelcontextprotocol.io/posts/2026-07-28/
- Agentic AI Foundation: https://aaif.io/ , https://www.linuxfoundation.org/press/linux-foundation-announces-the-formation-of-the-agentic-ai-foundation
- A2A 1주년: https://www.linuxfoundation.org/press/a2a-protocol-surpasses-150-organizations-lands-in-major-cloud-platforms-and-sees-enterprise-production-use-in-first-year
- Agent Skills 표준: https://www.paperclipped.de/en/blog/agent-skills-open-standard-interoperability/
- GitHub Spec Kit: https://github.com/github/spec-kit/blob/main/spec-driven.md

**생태계 지형**
- O'Reilly Radar, The Open Source Agent Toolkit in 2026: https://www.oreilly.com/radar/the-open-source-agent-toolkit-in-2026/
- State of MCP 2026: https://mcp.institute/research/state-of-mcp-2026
- MCP 서버 52% 방치: https://rapidclaw.dev/blog/mcp-servers-dead-what-it-means-2026
- 추론 엔진 비교: https://sesamedisk.com/llamacpp-vs-vllm-vs-sglang-vs-ollama-2026/
- GitHub Octoverse: https://github.blog/news-insights/octoverse/what-the-fastest-growing-tools-reveal-about-how-software-is-being-built/

**AI 슬롭 / 코딩 에이전트 문제**
- The New Stack, AI-generated code crisis: https://thenewstack.io/ai-generated-code-crisis/
- The Register, GitHub PR kill switch: https://www.theregister.com/software/2026/02/03/github-ponders-kill-switch-for-pull-requests-to-stop-ai-slop/4334869
- SlopGuard: https://github.com/Blue-B/slopguard
- 코딩 에이전트 아키텍처 분류: https://arxiv.org/pdf/2604.03515
- Tokalator 컨텍스트 툴킷: https://arxiv.org/pdf/2604.08290

**관측성 / 보안**
- OTel GenAI semconv 현황(2026-07): https://john-hodge.com/blog/opentelemetry-genai-semantic-conventions/
- Snyk agent-scan: https://github.com/snyk/agent-scan
- 에이전트 샌드박싱: https://amux.io/guides/ai-agent-sandboxing/ , https://emirb.github.io/blog/microvm-2026/

**한국 맥락**
- AI 기본법 시행: https://www.korea.kr/news/policyNewsView.do?newsId=148958380
- AI 기본법 투명성 의무 해설: https://www.shinkim.com/kor/media/newsletter/3142
- K-EXAONE 2.0 Apache-2.0 공개: https://biz.heraldcorp.com/article/10826523
- 독파모 4사 현황: https://zdnet.co.kr/view/?no=20260804100005
- 오픈소스 AI 정책 사각지대: https://thecodit.com/blog/open-source-ai-strategy-kr
- N2SF 도입 실증: https://www.dreamsecurity.com/pr/news/1091
- KWCAG 2.2: https://a11ykr.github.io/kwcag22/
- data.go.kr MCP 서버: https://github.com/Koomook/data-go-mcp-servers
- 대회 공식: https://osscontest.kr/overview
