# 06a — 임베디드·RTOS·시스템 하드웨어 생태계 기여 빈틈 조사

조사일: 2026-08-16 (D-11)
조사자: 리서처
팀 조건: 2~3인 / 하루 4~6시간 / 총 170~250 person-hour
목표: 2025 금상(티에스엔랩 `tsnlab/zephyr` — Zephyr RTOS Raspberry Pi 5 포팅 + `tsnlab/zephyr-rtos-lecture`) 형태의 **"큰 업스트림의 검증 가능한 빈 구멍"** 발굴

> **결론 요약**: 반증을 통과한 후보는 **2개(+조건부 1개)**. 억지로 늘리지 않았다.
> 1위는 **`zephyr-lang-rust`에 embedded-hal 어댑터 계층 신설** — 하드웨어 0개로 완주 가능하고, 정량 지표가 가장 강하다.

---

## 0. 반증 방법론 — 무엇을 어떻게 깼는가

직전 라운드 전멸(4/4)을 반복하지 않기 위해, **모든 후보에 대해 "이미 있다"를 먼저 증명하려고 시도**했다. 사용한 채널:

| 채널 | 구체적 명령/URL |
|---|---|
| 이슈 트래커 직접 조회 | `gh search issues --repo <repo> "<키워드>"`, `gh issue view <n> --repo <repo>` (본문 + 코멘트 전문 확인) |
| PR 트래커 | `gh search prs --repo <repo> "<키워드>"` — **merged/closed 포함**해서 "이미 머지됨"을 잡아냄 |
| 저장소 트리 전수 | `gh api repos/<r>/git/trees/<br>?recursive=1` → 파일 경로 grep (문서보다 트리가 정확함) |
| 소스 클론 | `git clone --depth 1 zephyr-lang-rust` 후 `zephyr/src/device/` 실제 구현 목록 확인 |
| 크레이트 레지스트리 | `crates.io/api/v1/crates?q=`, `.../reverse_dependencies` |
| 서드파티 포크 | `gh search repos "<키워드>"` (스타 수·마지막 푸시 날짜까지 확인) |
| 공식 문서 | `renode.readthedocs.io/.../supported-boards.html` 등 |

**이 방법으로 후보 6개가 실제로 죽었다** (§5 탈락표). 특히 WIZnet W6100 Zephyr 드라이버와 WIZnet Rust 드라이버는 "빈틈처럼 보였지만 이미 머지된" 전형적 사례였다.

---

## 1. ★ 1위 후보 — `zephyr-embedded-hal`: Zephyr RTOS용 embedded-hal 1.0 구현

### 1.1 구체적 대상 (한 문장)
Zephyr 공식 Rust 언어 지원 모듈 `zephyrproject-rtos/zephyr-lang-rust`에 **`embedded-hal` 1.0 / `embedded-hal-async` 트레이트 구현 계층(I2C·SPI·GPIO·ADC·PWM·Delay)을 추가**해, crates.io의 기존 Rust 임베디드 드라이버 생태계 전체를 Zephyr의 1,090개 보드 위에서 무수정으로 쓸 수 있게 만든다.

### 1.2 왜 아직 비어 있는가 — 반증 로그

| 확인 항목 | 결과 | 근거 |
|---|---|---|
| 저장소에 embedded-hal 구현이 있는가 | **없음** | `git clone` 후 `zephyr/Cargo.toml` 의존성 전수 확인 — `embedded-hal` 계열 의존성 0개. `zephyr/src/device/` 에 존재하는 파일은 **`gpio.rs`, `flash.rs` 단 2개** [확인] https://github.com/zephyrproject-rtos/zephyr-lang-rust/tree/main/zephyr/src/device |
| 이슈로 요청된 적 있는가 | **있음, 그리고 17개월째 방치** | 이슈 #73 "Driver support" (2025-03-20 개설, OPEN). 체크박스 `I2C controller / I2C peripheral / USB device / Networking` **전부 미체크**. 2025-03-30 코멘트에서 `nathaniel-greaseboss`가 *"adding an adapter layer between zephyr's low level api's and the embedded_hal crate would be great. That way the existing ecosystem of drivers on rust could be integrated"* 라고 정확히 이 제안을 함 → **수요는 증명됐고 아무도 안 함** [확인] https://github.com/zephyrproject-rtos/zephyr-lang-rust/issues/73 |
| 진행 중인 PR이 있는가 | **없음** | `gh search prs --repo zephyrproject-rtos/zephyr-lang-rust "embedded-hal OR embedded_hal"` → 결과 0건 [확인] |
| 핵심 개발자가 작업 중인가 | **아님 (인력 병목)** | 로드맵 이슈 #120(디바이스 확장), #117(async 심화), #118(IRQ async), #119(DT 통합), #121(네트워킹), #122(USB), #124(crypto) — **전부 2025-07-03에 메인테이너가 일괄 개설한 뒤 13개월째 OPEN**. 2026-08-06 개설된 #172 *"How to help? ... The project also doesn't seem to be actively maintained"* 에 **메인테이너 응답 0건** [확인] https://github.com/zephyrproject-rtos/zephyr-lang-rust/issues/172 |
| 서드파티 구현이 있는가 | **없음** | crates.io `q=zephyr` 25건 전수 확인 — Zephyr RTOS용 HAL 크레이트 없음(대부분 Soroban/Stellar의 동명이인 "Zephyr VM"). `gh search repos "zephyr rust embedded-hal"` → 0건. `tylerwhall/zephyr-rust`는 별개의 구형 프로젝트(libstd 지향, embedded-hal 아님) [확인] |
| 프로젝트가 죽은 건 아닌가 | **살아있고 외부 PR을 머지함** | 최근 커밋 2026-08-13. 최근 머지 PR 15건 중 **외부 기여자 PR 8건**(kurtjd #173, eHammarstrom #157/#138/#137, levietduc0712 #143, ZhaoxiangJin #139, letanphuc #135, tinegachris #132) [확인] |

> **비어 있는 이유의 성격 판정: "어려워서"가 아니라 "메인테이너 1인 체제라 손이 못 감"**.
> 이건 우리에게 최상의 조건이다. 기술 난이도가 아니라 인력 부족이 원인이므로, 2주 집중 투입으로 메울 수 있고, PR이 실제로 머지될 확률이 높다.

### 1.3 왜 이게 "큰 기여"인가 — 정량 근거 [전부 확인]

| 지표 | 값 | 출처 |
|---|---:|---|
| `embedded-hal` 역의존 크레이트 수 | **1,704개** | crates.io API `reverse_dependencies` meta.total |
| `embedded-hal` 누적 다운로드 | 30,216,315 | crates.io API |
| `embedded-hal-async` 누적 다운로드 | 6,043,864 | crates.io API |
| Zephyr 보드 수 (`board.yml`) | **1,090개** / 벤더 189개 | zephyr main 트리 전수 |
| Zephyr I2C 드라이버 / SPI 드라이버 | 99개 / 88개 | 〃 |
| 선례(설계 검증) | `linux-embedded-hal` 5,835,371 DL | Linux 디바이스에 대해 똑같은 어댑터를 제공하는 공식 rust-embedded 크레이트가 이미 성공 사례 |

**한 문장 발표 카피**: *"embedded-hal 생태계의 드라이버 1,704개와 Zephyr의 보드 1,090개 사이에는 어댑터 한 장이 없어서 곱이 0이었습니다. 우리가 그 한 장을 만들었습니다."*

### 1.4 2주 실현성 — **가능**

- **하드웨어 필요: 0** (필수 아님). 근거: Zephyr에 **`drivers/i2c/i2c_emul.c`, `drivers/spi/spi_emul.c`** 및 **`*emul*.c` 59개 파일(센서 에뮬레이터)** 이 존재 → 실물 센서 없이 I2C/SPI 트랜잭션을 검증 가능 [확인]. 실행은 `qemu_cortex_m3`(zephyr-lang-rust CI가 이미 쓰는 타깃, `docs.yml:48`)에서.
- **빌드 환경 구축**: Zephyr SDK + `rustup target add` + bindgen(libclang). **주의: 이슈 #144 "bindgen: detect and use libclang from Zephyr SDK 1.0 (LLVM)" 이 OPEN** — 첫날 하루를 여기서 태울 수 있다. 회피책은 시스템 LLVM 사용 [확인] https://github.com/zephyrproject-rtos/zephyr-lang-rust/issues/144
- **작업량 추정** [추정]: GPIO 트레이트(0.5일) → Delay(0.5일) → I2C(2일) → SPI(2일) → ADC/PWM(2일) → async 변형(3일) → 호환성 매트릭스·CI(3일) → 문서/교육자료(2일). 여유 포함 14일에 들어온다.
- **이미 깔린 기반**: `GpioPin`에 `set/get/toggle/configure`가 구현돼 있어 `embedded_hal::digital::{OutputPin, InputPin, StatefulOutputPin}`은 **첫날 바로 나온다**. `zephyr::time`(fugit) 있음 → `DelayNs` 즉시. embassy 통합(`zephyr/src/embassy/`)이 이미 있어 `embedded-hal-async` 경로도 열려 있다 [확인].
- **위험**: 팀의 Rust 숙련도. unsafe FFI + 트레이트 설계는 Rust 중급 이상을 요구한다. **이 후보의 유일한 큰 리스크.**

### 1.5 출품작 성립 여부 — **성립 (대표 저장소가 명확)**

우리 대표 저장소 `zephyr-embedded-hal`에 남는 것:
1. **독립 크레이트** — `embedded-hal` 1.0 / `embedded-hal-async` / `embedded-io-async` 트레이트 구현체 (업스트림 머지 여부와 무관하게 crates.io 배포 가능한 자체 산출물)
2. **업스트림 PR 세트** — `zephyr-lang-rust`의 `zephyr/src/device/{i2c,spi,adc,pwm}.rs` 신규 바인딩 (이슈 #73/#120 직접 해소). PR 링크가 README에 기여 이력으로 남는다
3. **호환성 매트릭스** — crates.io 드라이버 크레이트 N개 × 보드/QEMU M개 표. 이게 활용성 점수의 핵심 증거
4. **하드웨어 없는 테스트 하네스** — Zephyr `i2c_emul`/`spi_emul` + 센서 에뮬레이터 기반 Twister 테스트 스위트 + GitHub Actions CI
5. **교육자료** — 2025 금상이 `zephyr-rtos-lecture`로 한 것과 동일 포지션. "Zephyr에서 Rust 드라이버 쓰기" 한국어 가이드

### 1.6 시연 가능성 — **강함 (화면에 확실히 보인다)**
- 3분 구성: ① crates.io에서 남의 드라이버 크레이트(`bme280`, `ssd1306`, `lis2dh12` 등)를 **한 줄도 고치지 않고** `Cargo.toml`에 추가 → ② `west build -b qemu_cortex_m3 && west build -t run` → ③ QEMU 콘솔에 센서 값이 찍힌다 → ④ (선택) 실보드에서 OLED에 그림이 뜬다 → ⑤ 호환성 매트릭스 표 + CI 초록불
- **네트워크·실물 의존이 없어 데모 실패 리스크가 구조적으로 낮다.**

### 1.7 최초성 주장 — **가능 (검증 가능한 형태)**
> "**세계 최초의 Zephyr RTOS용 embedded-hal 1.0 구현**"
> 검증: ① `zephyr-lang-rust` 저장소에 embedded-hal 의존성 0 (Cargo.toml) ② 관련 PR 0건 ③ crates.io에 해당 크레이트 부재 ④ 요청 이슈 #73이 2025-03부터 미해결. **네 가지를 모두 링크로 제시할 수 있다.**

### 1.8 정량 지표 (발표 슬라이드용)
- 구현한 embedded-hal 트레이트 N/M개 (blocking + async)
- **무수정으로 동작한 crates.io 드라이버 크레이트 개수** ← 가장 강력한 숫자
- 지원 보드 수 (Zephyr 1,090개 중 실검증 K개)
- C 대비 바이너리 크기·인터럽트 지연 오버헤드 (`samples/bench`가 이미 저장소에 있음 → 재활용)
- Twister 테스트 통과율

### 1.9 착수 첫 3일 계획 (성공 기준 포함)

```
D1  환경 구축 + 기존 자산 파악
    - Zephyr SDK + west + rustup 설치, 타깃 thumbv7m-none-eabi 추가
    - 이슈 #144(libclang) 회피: 시스템 LLVM 경로 지정
    - 검증: `west build -b qemu_cortex_m3 samples/hello_world && west build -t run` 이 콘솔 출력
    - 검증: samples/blinky, samples/button, tests/drivers/gpio-async 3개 빌드 성공
    - 산출: 저장소 초기화 + "환경 구축 트러블슈팅" 문서(교육자료 1장 확보)

D2  GPIO + Delay 트레이트 (첫 머지 가능 단위)
    - GpioPin → embedded_hal::digital::{OutputPin, InputPin, StatefulOutputPin, ErrorType}
    - zephyr::time → embedded_hal::delay::DelayNs, embedded_hal_async::delay::DelayNs
    - 검증: samples/blinky를 embedded-hal 트레이트만 써서 재작성 → QEMU에서 동일 동작
    - 검증: `cargo clippy` 무경고 (업스트림 CI가 clippy 강제, PR #157)
    - 산출: 업스트림 이슈 #73에 진행 상황 코멘트 + 첫 PR 초안

D3  I2C — 이 프로젝트의 승부처
    - zephyr-sys의 raw `i2c_transfer`/`i2c_write_read` 위에 safe wrapper + embedded_hal::i2c::I2c 구현
    - devicetree 제너레이터(zephyr-build)에 i2c 노드 추가
    - 검증: Zephyr i2c_emul + 기존 센서 에뮬레이터로 트랜잭션 왕복 테스트 통과
    - 검증(핵심): crates.io 드라이버 1개를 무수정 의존성으로 넣어 QEMU에서 값 출력
    - 이 검증이 D3에 통과하면 나머지 11일은 "복제 + 확장"이라 완주가 사실상 확정된다.
    - 실패 시 즉시 2위 후보로 전환 (D3가 이 프로젝트의 go/no-go 게이트)
```

---

## 2. 2위 후보 — `renode-esp32c`: Renode용 ESP32 RISC-V 플랫폼 모델 + Zephyr 하드웨어리스 CI

### 2.1 구체적 대상
오픈소스 시뮬레이터 **Renode에 ESP32-C3/C6(RISC-V) 플랫폼 모델을 신설**하고, 그것을 Zephyr 보드 디렉터리의 `support/*.repl`로 연결해 **실물 ESP32 없이 Zephyr 테스트를 CI에서 돌릴 수 있게** 만든다.

### 2.2 왜 비어 있는가 — 반증 로그

| 확인 항목 | 결과 | 근거 |
|---|---|---|
| Renode에 ESP32 모델이 있는가 | **전무** | `gh api repos/renode/renode/git/trees/master?recursive=1` 전수 grep → `esp32` 파일 **0개**. Xtensa 관련은 `platforms/cpus/xtensa-sample-controller.repl` 하나뿐(Intel ADSP/SOF용) [확인] |
| 공식 지원 보드 목록에 있는가 | **없음** | https://renode.readthedocs.io/en/latest/introduction/supported-boards.html — ESP32 계열 전 변종 부재 (RP2040/RP2350, RPi4/5도 부재) [확인] |
| 이슈로 요청된 적 있는가 | **5년째 OPEN** | #262 "Feature Request: ESP32 and RP2040 support" (2021-11-06). 코멘트에 2022·2023·2024년에 걸쳐 +1이 계속 붙음. 2022-04-16 Antmicro 측 mithro의 답변은 "Xtensa ISA 작업이 시작됐다"는 블로그 링크뿐이고 **이후 4년간 플랫폼 모델은 나오지 않았다** [확인] https://github.com/renode/renode/issues/262 |
| 최신 요청 | **2026-07-22** | #946 "Add support for the Espressif ESP32-C6-DevKitC development board" — 코멘트 0, 응답 0 [확인] https://github.com/renode/renode/issues/946 |
| 진행 중인 PR이 있는가 | **없음** | `gh search prs --repo renode/renode "esp32 OR espressif"` → 0건. `renode/renode-infrastructure` 도 0건 [확인] |
| 서드파티 구현이 있는가 | **없음** | `gh search repos "renode esp32"` → 0건 [확인] |

> **비어 있는 이유의 성격 판정: "어려워서"가 아니라 "Antmicro의 비즈니스 모델"**.
> 공식 문서가 신규 플랫폼 추가에 대해 **상용 지원(commercial support)** 을 안내한다 [확인, supported-boards 문서]. 즉 신규 플랫폼 모델링은 유료 서비스 라인이라 무료 요청은 영구 대기열에 들어간다. 미해결 요청이 ESP32-C6(#946), nRF5340(#900), STM32U585(#948), Renesas RA4M3(#821), nRF54LM20(#945)로 계속 쌓이는 것이 방증이다. **다만 코드베이스는 Apache-2.0이고 커뮤니티 PR을 받는다** → 우리가 들어갈 자리가 있다.

### 2.3 숨은 강력한 지표 — Zephyr 쪽에서 본 공백 [확인, 자체 측정]
Zephyr는 이미 Renode 통합 배관(`boards/common/renode.board.cmake`, `boards/common/renode_robot.board.cmake`)을 갖고 있다. 그런데:

> **Zephyr 보드 1,090개 중 Renode 모델(`support/*.repl`)을 가진 보드는 단 5개 = 0.46%**
> (`boards/antmicro/myra_sip_baseboard`, `boards/antmicro/stm32h7_renode_reference_board`, `boards/microchip/m2gl025_miv`, `boards/renode/cortex_r8_virtual`, `boards/renode/riscv32_virtual`)

이 숫자 하나로 발표 첫 슬라이드가 끝난다: *"Zephyr 보드의 99.5%는 실물 하드웨어 없이는 CI를 돌릴 수 없습니다."*

### 2.4 2주 실현성 — **조건부**
- **하드웨어 필요: 0** (전부 시뮬레이터). Zephyr에 `esp32c3_devkitc`, `esp32c3_devkitm`, `esp32c3_rust`, `esp32c6_devkitc` 보드가 이미 있어 **펌웨어는 공짜로 얻는다** [확인, zephyr 트리]
- 모델링 필요 페리페럴 [추정]: RISC-V 코어(Renode 기존 자산 재사용) + UART + SYSTIMER/TIMG + **인터럽트 매트릭스(ESP32-C3 고유, 최대 난관)** + GPIO/IO_MUX + SYSTEM/클럭 스텁 + 플래시 캐시(MMU) 매핑. ROM 부트로더는 우회하고 Zephyr ELF를 직접 로드해 범위를 줄인다.
- **실현성 판정이 "가능"이 아닌 "조건부"인 이유**: 인터럽트 매트릭스와 캐시/XIP 매핑이 예상보다 커질 수 있고, C#/Mono 기반 Renode 빌드 환경 학습이 필요하다. **`hello_world` UART 출력이 D5까지 안 나오면 손절**해야 한다.

### 2.5 출품작 성립 여부 — **성립**
대표 저장소 `renode-esp32c`에 남는 것: ① C# 페리페럴 모델 세트 ② `.repl`/`.resc` 플랫폼 기술 ③ Robot Framework 테스트 스위트 ④ Zephyr 보드용 `support/` 오버레이 + 업스트림 PR ⑤ GitHub Actions에서 **하드웨어 없이 도는 Zephyr CI 워크플로** ⑥ "Renode로 내 보드 모델 만들기" 한국어 교육자료.

### 2.6 시연 가능성 — **매우 강함**
Renode 콘솔에 Zephyr 셸이 뜨고, GPIO 토글이 Renode 로그에 찍히고, GitHub Actions 로그에 하드웨어 없이 테스트가 통과한다. **전 과정이 화면 캡처만으로 완결**된다.

### 2.7 최초성 주장 — **가능**
> "**세계 최초의 오픈소스 Renode ESP32 플랫폼 모델**" — 근거: Renode 트리 esp32 파일 0개 + 요청 이슈 #262가 2021년부터 미해결 + 서드파티 0건.

### 2.8 정량 지표
모델링한 페리페럴 N개 / Zephyr 샘플·Twister 테스트 통과 M건 / **Renode 지원 Zephyr 보드 5개 → 7개 (+40%)** / 시뮬레이션 속도(MIPS) / CI 1회 실행 시간.

### 2.9 1위 대비 약점
- 완주 리스크가 1위보다 명백히 높다(모델링 범위가 열려 있음).
- "이걸 누가 쓰나"에 대한 답이 1위(1,704개 드라이버 크레이트)만큼 숫자로 강하지 않다.

---

## 3. 3위 후보(조건부) — Zephyr를 Sophgo CV1800B / SG2002에 포팅

2025 금상의 **가장 직접적인 형태 복제**(인기 저가 RISC-V SBC에 Zephyr 포팅). Milk-V Duo / Sipeed LicheeRV Nano는 소형 RISC-V 코어(C906)를 RTOS 전용으로 별도 탑재하고 있어 Zephyr의 자연스러운 타깃이다.

**반증 결과 — 완전한 빈틈은 아니다:**
- Zephyr 업스트림: `sophgo`/`cv1800`/`milkv` 관련 **PR 0건, 코드 0건** [확인, PR 검색 + 트리 코드 검색]
- 그러나 **`zhoukejun/zephyr_on_xxx`** 라는 아웃오브트리 Zephyr 모듈이 존재: Sipeed LicheeRV Nano(SG2002)용 보드 2종 + `clock_control_sophgo_sg200x.c` + pinctrl 드라이버까지 이미 있음. **단, 스타 2개, 마지막 푸시 2024-05-19로 사실상 사망, 업스트림 시도 흔적 없음** [확인] https://github.com/zhoukejun/zephyr_on_xxx
- **NuttX는 이미 `sg2000`을 정식 지원** (arch/risc-v/src/sg2000, boards/risc-v/sg2000) [확인] → "이 SoC에 RTOS를 올린 최초" 주장은 불가

**판정**:
- 최초성 주장을 **"최초의 업스트림 Zephyr Sophgo 지원"** 으로 축소해야 함 → 2025 금상의 "세계 최초" 대비 서사가 한 급 약하다.
- 하드웨어 필요(Milk-V Duo 약 $5~10). 배송 리드타임이 2주 일정에 직격 리스크 [추정].
- 시연이 UART 콘솔 출력 위주라 화면 임팩트가 1·2위보다 약하다.
- **결론: 1·2위가 D3~D5 게이트에서 죽었을 때의 백업으로만 유지.**

---

## 4. 유망도 정렬 요약

| 순위 | 후보 | 하드웨어 | 실현성 | 시연 | 최초성 | 최대 약점 |
|---:|---|:---:|:---:|:---:|:---:|---|
| 1 | **zephyr-embedded-hal** (Zephyr용 embedded-hal 1.0) | 불필요 | **가능** | 강 | 세계 최초(4중 근거) | 팀의 Rust 숙련도 |
| 2 | **renode-esp32c** (Renode ESP32 모델 + 하드웨어리스 CI) | 불필요 | 조건부 | **매우 강** | 세계 최초 | 모델링 범위 발산 → 완주 리스크 |
| 3 | Zephyr → Sophgo CV1800B 포팅 | **필요** | 조건부 | 중 | "업스트림 최초"로 축소 | 아웃오브트리 선행 사례 존재, 배송 리스크 |

---

## 5. 탈락 후보와 사유 (반증으로 죽은 것들)

| 후보 | 탈락 사유 | 확인 근거 [확인] |
|---|---|---|
| **WIZnet W6100 Zephyr 이더넷 드라이버** (한국 기업 하드웨어, 이슈가 2024-12부터 OPEN이라 유망해 보였음) | **이미 머지 완료**. 드라이버 PR #101753 머지(2026-01-05), 보드 PR #104394(w6100-evb-pico/pico2) 머지, W6300 보드 #102727 머지, W55RP20 #104938 머지. 이슈 #83029가 아직 열려 있을 뿐 실제로는 해결됨 | github.com/zephyrproject-rtos/zephyr/pull/101753 · /104394 · /102727 |
| **WIZnet W6100/W6300 Rust 드라이버 + embassy-net 통합** (crates.io에 `w6100`/`w6300` 크레이트 부재 확인 후 유망해 보였음) | **embassy 본체에 이미 존재**. `embassy-net-wiznet/src/chip/` 에 `w6100.rs`, `w6300.rs` 파일 실재 | github.com/embassy-rs/embassy/tree/main/embassy-net-wiznet/src/chip |
| **Zephyr ESP32-P4 지원** | 활발히 진행 중. 2026-07~08에만 머지 PR 다수(Olimex ESP32-P4-PC #115094, Waveshare ESP32-P4-WIFI6 #113918, PTP #114890 등) | zephyr PR 검색 `esp32p4` |
| **Zephyr WCH CH32V 지원** | 활발히 진행 중. CH32V305/V317 #105534, CH570/CH572 #111171, CH32V203 보드 #109345 모두 머지 | zephyr PR 검색 `ch32` |
| **Zephyr Allwinner H618 지원** | 진행 중. pinctrl #113247, CCU #112704, hwinfo #111325 등 다수 오픈 PR + 전담 메인테이너 지명 PR(#113917) | zephyr PR 검색 `allwinner` |
| **Renode RP2040 / RP2350 플랫폼 모델** | 서드파티 선점. `matgla/Renode_RP2040`(★32, DMA/PIO/I2C/SPI/ADC/XIP까지 구현, 2026-03 푸시) + `vighnesh-sawant/Renode_RP2350`(pico2 repl 보유). 원저자가 "Frozen (lack of time)"이라 인수 여지는 있으나 **"최초" 주장 불가** | github.com/matgla/Renode_RP2040 |
| **Renode nRF54L15 / nRF5340 모델** | 기술적으로는 빈틈이나(Renode에 `nrf52840` 외 없음) **수요 신호가 약하다**(#900 코멘트 2, #945 코멘트 0). ESP32(#262, 5년 누적 +1)에 비해 서사가 약해 2위 후보에 흡수 | renode 트리 grep `nrf` |
| **Embassy 신규 칩 HAL** | 오픈 이슈 40건 전수 확인 결과 대부분 **기존 칩의 버그 리포트**(TRNG 행, UART 링버퍼, USB bInterval 등). 2주짜리 그린필드 기여 단위가 안 나옴 | embassy-rs/embassy 오픈 이슈 40건 |
| **QEMU 신규 머신 모델** | 개발 프로세스가 GitLab + 메일링리스트 패치 기반. **2주 안에 리뷰 사이클이 돌지 않는다**(GitHub 미러는 이슈 비활성). 출품 시점에 "기여했다"를 증명하기 어려움 | github.com/qemu/qemu (이슈 트래커 부재) |
| **NuttX Sophgo/CV1800 포팅** | 이미 지원. `arch/risc-v/src/sg2000`, `boards/risc-v/sg2000` 실재. RISC-V 아키텍처 24종·보드 22종으로 커버리지가 매우 두껍다 | apache/nuttx contents API |
| **RIOT OS "help wanted" 착수** | `Help Wanted` 라벨 오픈 이슈 조회 결과 0건 → 명시적 초심자 진입로가 없음 | `gh issue list --repo RIOT-OS/RIOT --label "Help Wanted"` |
| **Zephyr 공식 문서 한국어 i18n** | 엔지니어링 무게가 부족해 "구조·코드 완성도" 및 "기능테스트" 항목에서 점수가 안 나옴. 교육자료로 1·2위 후보에 부속시키는 편이 이득 | — |

---

## 6. 남은 리스크와 미조사 영역

1. **[추정] 1위 후보의 Rust 학습 곡선**이 최대 변수다. 팀에 Rust 경험자가 0명이면 D3 게이트를 못 넘을 수 있다. 착수 전에 팀원 1명이 `zephyr-lang-rust`의 `samples/blinky`를 QEMU에서 돌려보는 **1시간짜리 사전 검증**을 반드시 할 것.
2. **[확인] 업스트림 머지는 대회 기간 내에 안 끝날 수 있다.** 1·2위 모두 대표 저장소가 독립 산출물로 성립하도록 설계했으므로 치명적이지 않지만, 발표에서는 "PR 제출 이력 + 이슈 코멘트 반응"을 증거로 써야 한다.
3. **[미조사]** Zephyr Discord / TSC 회의록 / 메일링리스트는 확인하지 못했다. 1위 후보 착수 전, `zephyr-lang-rust` 이슈 #73과 #172에 **"embedded-hal 어댑터를 구현하려 한다"고 코멘트를 남겨 메인테이너 의사를 타진**하는 것이 마지막 반증 절차다. 이 코멘트 자체가 커뮤니티 활동 증거로도 쓰인다.
4. **[미조사]** ABOV Semiconductor 등 국산 MCU의 Zephyr 포팅은 "국내 최초" 서사가 강하나, 데이터시트 공개 범위·개발보드 조달·생태계 규모를 검증하지 못했다. 한국 가산점이 절실할 경우에만 추가 조사를 권한다.
