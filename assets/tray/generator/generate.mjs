// 메뉴바 Tray 아이콘 생성기. docs/specs/pet-window-spec.md "Assumptions" 참조 —
// 22×18 컬러 스프라이트를 비정수배로 축소하면 뭉개지므로 실루엣을 별도로 그린다.
// macOS 템플릿 이미지 규약: 알파 채널만 쓰는 흑백, 파일명이 `...Template.png`이면
// AppKit이 라이트·다크 메뉴바에 맞춰 자동으로 색을 반전한다.
//
// 꽉 찬 실루엣은 16px에서 검은 덩어리로만 보여 코·눈이 사라진다. 그래서 몸통은
// 1px 외곽선만 남기고 코·눈·머리카락을 안에 채워 캐릭터가 읽히게 했다.

import fs from "node:fs";
import path from "node:path";
import { encodePNG } from "../../character/generator/png.mjs";

const SIZE = 16;
const BODY_TOP = 3;
const CENTER_X = 7;

// 원본 캐릭터(22×18)의 HALF_WIDTHS를 16px 그리드에 맞춰 줄인 값. 행 3..15.
// 코가 오른쪽으로 튀어나올 자리를 남기려 최대 반너비를 6으로 눌렀다.
const HALF_WIDTHS = [2, 4, 5, 5, 6, 6, 6, 6, 6, 5, 5, 4, 2];

function grid() {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => false));
}

function buildBody() {
  const body = grid();
  HALF_WIDTHS.forEach((hw, i) => {
    const y = BODY_TOP + i;
    for (let x = CENTER_X - hw; x <= CENTER_X - 1 + hw; x++) body[y][x] = true;
  });
  return body;
}

/** 4-이웃 중 하나라도 바깥이면 외곽선 픽셀. */
function outlineOf(body) {
  const outline = grid();
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!body[y][x]) continue;
      if (!body[y - 1]?.[x] || !body[y + 1]?.[x] || !body[y][x - 1] || !body[y][x + 1]) {
        outline[y][x] = true;
      }
    }
  }
  return outline;
}

function buildMask() {
  const mask = outlineOf(buildBody());

  // 시그니처인 큰 코 — 몸통 오른쪽 밖으로 튀어나온 채워진 돌기.
  for (let y = 8; y <= 10; y++) for (let x = 12; x <= 14; x++) mask[y][x] = true;

  // 눈 두 점.
  mask[8][5] = true;
  mask[8][8] = true;

  // 정수리 머리카락 한 올.
  mask[1][7] = true;
  mask[2][7] = true;

  return mask;
}

/** 마스크를 정수배로 확대해 RGBA(검정 + 알파)로 인코딩한다. */
function render(mask, scale) {
  const size = SIZE * scale;
  const rgba = new Uint8ClampedArray(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!mask[Math.floor(y / scale)][Math.floor(x / scale)]) continue;
      rgba[(y * size + x) * 4 + 3] = 255; // RGB는 0(검정), 알파만 세운다
    }
  }

  return encodePNG(size, size, rgba);
}

const outDir = process.argv[2] ?? "assets/tray";
const modulePath = process.argv[3] ?? "apps/pet/main/tray-icon.ts";
fs.mkdirSync(outDir, { recursive: true });

const mask = buildMask();
const png1x = render(mask, 1);
const png2x = render(mask, 2);

fs.writeFileSync(path.join(outDir, "nosyTemplate.png"), png1x);
fs.writeFileSync(path.join(outDir, "nosyTemplate@2x.png"), png2x);

// 사람이 눈으로 확인하는 용도. 실제 렌더링에는 쓰지 않는다(assets/character/preview와 같은 규약).
fs.writeFileSync(path.join(outDir, "preview.png"), render(mask, 16));

// main 프로세스는 PNG를 data URL로 들고 간다 — 이유는 생성되는 파일 상단 주석 참조.
const dataUrl = (buf) => `data:image/png;base64,${buf.toString("base64")}`;
fs.writeFileSync(
  modulePath,
  [
    "// 이 파일은 assets/tray/generator/generate.mjs가 생성한다. 직접 고치지 말 것.",
    "// 아이콘을 파일 경로가 아니라 data URL로 심는 이유: main 번들은 out/main/에서 돌기 때문에",
    "// assets/를 상대 경로로 찾으면 dev와 패키징에서 깊이가 달라 조용히 깨진다.",
    "// 16×16 + 32×32 템플릿 PNG는 합쳐서 300바이트 미만이라 소스에 그대로 넣는 편이 안전하다.",
    "",
    `export const TRAY_ICON_1X = '${dataUrl(png1x)}'`,
    `export const TRAY_ICON_2X = '${dataUrl(png2x)}'`,
    ""
  ].join("\n")
);

console.log(
  `wrote nosyTemplate.png (16×16), nosyTemplate@2x.png (32×32), preview.png -> ${outDir}\n` +
    `wrote ${modulePath}`
);
