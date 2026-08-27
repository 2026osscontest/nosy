# 라이선스 감사

Nosy 자체는 [MIT](../LICENSE)로 배포한다. 이 문서는 의존성 라이선스 검토 결과를 남긴다.

- 감사 대상: `v0.1.0` (`pnpm-lock.yaml` 기준)
- 최종 확인: 2026-08-27
- SBOM: CycloneDX 1.6, 컴포넌트 470개, **라이선스 미기재 0건**
  — [릴리스 자산](https://github.com/2026osscontest/nosy/releases/latest)의 `nosy-<버전>-sbom.cdx.json`
  (버전마다 내용이 달라지는 산출물이라 저장소에 두지 않고 릴리스에 첨부한다)

## 요약

**GPL·AGPL·LGPL·SSPL·BUSL 계열이 하나도 없다.** 카피레프트는 MPL-2.0 12건뿐이며, 전부 빌드 도구라
배포물에 실리지 않는다. 배포되는 앱에 실제로 포함되는 서드파티 코드는 아래 표가 전부다.

## 배포물에 실리는 것

사용자가 내려받는 `.dmg` 안에 실제로 들어가는 서드파티는 다음뿐이다.

| 구성 요소 | 버전 | 라이선스 | 어떻게 들어가나 |
|---|---|---|---|
| Electron | 43.4.0 | MIT | 앱 런타임 |
| react | 19.2.8 | MIT | renderer 번들 |
| react-dom | 19.2.8 | MIT | renderer 번들 |
| scheduler | (react-dom 전이) | MIT | renderer 번들 |
| Galmuri | 2.40.4 | SIL OFL 1.1 | 폰트 파일을 수정 없이 번들 |

전부 허용형이며, OFL은 폰트를 **수정 없이** 재배포할 것과 라이선스 전문 동봉을 요구하는데 둘 다
충족한다([`THIRD-PARTY-NOTICES.md`](../THIRD-PARTY-NOTICES.md),
`apps/pet/renderer/fonts/Galmuri-LICENSE.txt`).

`@nosy/core`는 외부 패키지가 아니라 이 저장소의 워크스페이스 패키지이며, main 번들에 인라인된다.
런타임 의존성이 0개다.

## 전체 의존성 분포

빌드 도구를 포함한 전체 470개 컴포넌트 기준이다.

| 라이선스 | 개수 | 유형 |
|---|---:|---|
| MIT | 358 | 허용형 |
| ISC | 40 | 허용형 |
| Apache-2.0 | 22 | 허용형 |
| BSD-2-Clause | 12 | 허용형 |
| **MPL-2.0** | 12 | 파일 단위 카피레프트 |
| BSD-3-Clause | 11 | 허용형 |
| BlueOak-1.0.0 | 8 | 허용형 |
| Python-2.0 | 1 | 허용형 |
| CC-BY-4.0 | 1 | 데이터, 귀속 필요 |
| 0BSD | 1 | 퍼블릭 도메인에 준함 |
| WTFPL / WTFPL OR ISC / WTFPL OR MIT | 3 | 허용형 |
| MIT OR CC0-1.0 | 1 | 허용형 |

## 검토가 필요했던 항목

### MPL-2.0 (12건) — 문제 없음

전부 `lightningcss`와 그 플랫폼별 네이티브 바이너리다. Vite가 CSS를 변환할 때 쓰는 **빌드 타임
도구**이며, 산출물에는 변환된 CSS만 남고 lightningcss 코드 자체는 포함되지 않는다.

MPL-2.0은 **파일 단위** 카피레프트다. 해당 파일을 수정해 배포할 때만 그 파일의 소스 공개 의무가
생긴다. 우리는 수정하지 않고 의존만 하므로 의무가 발생하지 않는다.

### CC-BY-4.0 (1건) — 문제 없음

`caniuse-lite`. 브라우저 지원 데이터셋으로, browserslist가 빌드 타임에 참조한다. 배포물에 포함되지
않는다.

### Python-2.0 (1건) — 문제 없음

`argparse`. Python의 argparse를 이식한 오래된 npm 패키지로, 다른 빌드 도구의 전이 의존성이다.
Python-2.0 라이선스는 허용형이다.

## 직접 포함한 외부 산출물

패키지 매니저를 거치지 않고 저장소에 들어온 것들이라 별도로 관리한다. 전문은
[`THIRD-PARTY-NOTICES.md`](../THIRD-PARTY-NOTICES.md)에 있다.

| 출처 | 라이선스 | 사용 방식 |
|---|---|---|
| [shellrc-doctor](https://github.com/nord342/shellrc-doctor) | MIT | 런타임 호출이 아니라 **진단 아이디어를 TypeScript로 재구현**했다. 포팅 파일 상단과 고지 파일에 원저작자·저장소·MIT 전문을 남긴다 (ADR-004) |
| [Galmuri](https://github.com/quiple/galmuri) | SIL OFL 1.1 | 폰트 파일을 **수정 없이** 번들해 재배포한다. OFL 전문을 동봉한다 |

캐릭터 스프라이트와 앱 아이콘은 외부 에셋을 쓰지 않고 `assets/*/generator/`의 스크립트로 절차적
생성한 자체 저작물이라 고지 의무가 없다 (ADR-001).

## 재현 방법

```sh
# SBOM 생성 (cdxgen + pnpm licenses + npm registry 폴백)
node scripts/generate-sbom.mjs

# 설치된 의존성의 라이선스 목록
pnpm licenses list
```

`scripts/generate-sbom.mjs`가 세 소스를 합치는 이유는 각각 빈틈이 있기 때문이다. cdxgen은
스코프 패키지(`@babel/core` 등)의 라이선스를 자주 비워 두고, `pnpm licenses`는 현재 플랫폼에
설치된 것만 알기 때문에 다른 OS용 네이티브 바이너리(`@esbuild/linux-x64` 등)를 놓친다. 남은
항목은 npm registry에서 직접 조회해 채운다.
