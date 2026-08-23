import { encodePNG } from "./png.mjs";
import fs from "node:fs";

const W = 22;
const H = 18;
const BODY_TOP = 4; // grid row where body starts
const CENTER_X = 11; // between col 10/11

// half-widths per body-local row (14 rows -> grid rows 4..17)
const HALF_WIDTHS = [3, 5, 6, 7, 8, 9, 9, 9, 9, 8, 8, 7, 5, 3];

const PALETTE = {
  outline: [58, 42, 30, 255], // dark brown
  body: [245, 225, 200, 255], // cream
  shade: [224, 195, 157, 255], // darker cream (belly shade / lower body)
  eyeWhite: [255, 255, 255, 255],
  pupil: [43, 30, 20, 255],
  nose: [232, 121, 90, 255], // coral
  noseOutline: [168, 75, 52, 255],
  mouth: [58, 42, 30, 255],
  brow: [58, 42, 30, 255],
  sweat: [191, 227, 238, 255],
  sweatOutline: [76, 122, 140, 255],
  bubble: [255, 255, 255, 255],
  bubbleOutline: [58, 42, 30, 255],
  bang: [214, 69, 69, 255],
  bangOutline: [122, 30, 30, 255],
  hair: [58, 42, 30, 255], // the character's single hair strand — same dark brown as the outline
  shadow: [58, 42, 30, 90], // soft ground shadow (semi-transparent)
};

function makeGrid() {
  return Array.from({ length: H }, () => Array.from({ length: W }, () => null));
}

function buildBodyMask() {
  const mask = Array.from({ length: H }, () => Array.from({ length: W }, () => false));
  HALF_WIDTHS.forEach((hw, i) => {
    const y = BODY_TOP + i;
    const leftX = CENTER_X - hw;
    const rightX = CENTER_X - 1 + hw;
    for (let x = leftX; x <= rightX; x++) mask[y][x] = true;
  });
  return mask;
}

function paintBody(grid, mask, bobOffset = 0) {
  // shift mask vertically by bobOffset (whole-body bob), clamp to grid
  const shifted = Array.from({ length: H }, () => Array.from({ length: W }, () => false));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const sy = y - bobOffset;
      if (sy >= 0 && sy < H && mask[sy][x]) shifted[y][x] = true;
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!shifted[y][x]) continue;
      const edge =
        !shifted[y - 1]?.[x] || !shifted[y + 1]?.[x] || !shifted[y]?.[x - 1] || !shifted[y]?.[x + 1];
      if (edge) {
        grid[y][x] = PALETTE.outline;
      } else if (y - BODY_TOP - bobOffset >= 9) {
        grid[y][x] = PALETTE.shade; // lower-belly shading
      } else {
        grid[y][x] = PALETTE.body;
      }
    }
  }
  return shifted;
}

function rect(grid, x0, y0, w, h, color) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (grid[y]?.[x] !== undefined) grid[y][x] = color;
}

function px(grid, x, y, color) {
  if (grid[y]?.[x] !== undefined) grid[y][x] = color;
}

function paintFace(
  grid,
  { blink = false, eyeDX = 0, eyeDY = 0, browAngry = false, surprised = false, mouth = "flat", bobOffset = 0 } = {}
) {
  const b = bobOffset;
  // eyes: rows 8-9 (local 4-5), cols 7-8 and 13-14
  if (surprised) {
    // taller eye whites read as a startled/wide-eyed reaction
    rect(grid, 7 + eyeDX, 7 + b + eyeDY, 2, 3, PALETTE.eyeWhite);
    rect(grid, 13 + eyeDX, 7 + b + eyeDY, 2, 3, PALETTE.eyeWhite);
    px(grid, 7 + eyeDX, 8 + b + eyeDY, PALETTE.pupil);
    px(grid, 13 + eyeDX, 8 + b + eyeDY, PALETTE.pupil);
  } else if (!blink) {
    // eye whites stay put; eyeDX/eyeDY only move the pupil within the 2x2
    // box (0/0 = default gaze, bottom-left corner) so the gaze reads as
    // looking around rather than the whole eye relocating on the face.
    rect(grid, 7, 8 + b, 2, 2, PALETTE.eyeWhite);
    rect(grid, 13, 8 + b, 2, 2, PALETTE.eyeWhite);
    px(grid, 7 + eyeDX, 9 + b + eyeDY, PALETTE.pupil);
    px(grid, 13 + eyeDX, 9 + b + eyeDY, PALETTE.pupil);
  } else {
    rect(grid, 7, 9 + b, 2, 1, PALETTE.outline);
    rect(grid, 13, 9 + b, 2, 1, PALETTE.outline);
  }

  if (browAngry) {
    px(grid, 7, 7 + b, PALETTE.brow);
    px(grid, 8, 6 + b, PALETTE.brow);
    px(grid, 13, 6 + b, PALETTE.brow);
    px(grid, 14, 7 + b, PALETTE.brow);
  }

  // nose: signature big nose, rows 10-11, cols 9-12
  rect(grid, 9, 10 + b, 4, 2, PALETTE.nose);
  px(grid, 9, 10 + b, PALETTE.noseOutline);
  px(grid, 12, 10 + b, PALETTE.noseOutline);
  px(grid, 9, 11 + b, PALETTE.noseOutline);
  px(grid, 12, 11 + b, PALETTE.noseOutline);

  // mouth: row 13
  if (mouth === "flat") {
    rect(grid, 10, 13 + b, 2, 1, PALETTE.mouth);
  } else if (mouth === "o") {
    rect(grid, 10, 13 + b, 2, 2, PALETTE.outline);
    rect(grid, 10, 13 + b, 2, 1, PALETTE.pupil);
  } else if (mouth === "wavy") {
    px(grid, 9, 13 + b, PALETTE.mouth);
    px(grid, 10, 14 + b, PALETTE.mouth);
    px(grid, 11, 13 + b, PALETTE.mouth);
    px(grid, 12, 14 + b, PALETTE.mouth);
  }
}

function paintSweat(grid, dropY) {
  const x = 17;
  px(grid, x + 1, dropY, PALETTE.sweatOutline);
  px(grid, x, dropY + 1, PALETTE.sweatOutline);
  px(grid, x + 1, dropY + 1, PALETTE.sweat);
  px(grid, x + 2, dropY + 1, PALETTE.sweatOutline);
  px(grid, x, dropY + 2, PALETTE.sweatOutline);
  px(grid, x + 1, dropY + 2, PALETTE.sweat);
  px(grid, x + 2, dropY + 2, PALETTE.sweatOutline);
  px(grid, x + 1, dropY + 3, PALETTE.sweatOutline);
}

function paintDots(grid, activeIndex) {
  const cols = [14, 16, 18];
  cols.forEach((x, i) => {
    const y = i === activeIndex ? 1 : 2;
    px(grid, x, y, PALETTE.bubbleOutline);
  });
}

function paintBang(grid, jitterX) {
  const x = 10 + jitterX;
  px(grid, x, 0, PALETTE.bangOutline);
  px(grid, x, 1, PALETTE.bang);
  px(grid, x, 3, PALETTE.bang);
}

// the character's single hair strand — grows from top-center of the head,
// directly above the body's own top edge (BODY_TOP=4).
const HAIR_X = CENTER_X - 1;
const HAIR_BASE_ROW = BODY_TOP - 1;

// at rest the hair hangs loose and wobbles gently (see README "탄력
// 느슨함") — a short 2-segment droop that sways left/right per frame.
function paintHairLoose(grid, bobOffset, sway) {
  const y0 = HAIR_BASE_ROW + bobOffset;
  px(grid, HAIR_X, y0 - 1, PALETTE.hair);
  px(grid, HAIR_X + sway, y0 - 2, PALETTE.hair);
}

// while dragged, the hair is what's actually gripped — it goes taut and
// straight, pulled toward dirX (the direction of the grab/pull), unlike
// the loose idle droop ("빳빳해짐"). len controls how far it stretches.
function paintHairTaut(grid, bobOffset, dirX, len) {
  let x = HAIR_X;
  let y = HAIR_BASE_ROW + bobOffset;
  for (let i = 0; i < len; i++) {
    x += dirX;
    y -= 1;
    px(grid, x, y, PALETTE.hair);
  }
  px(grid, x + dirX, y, PALETTE.hair); // tip, reads as the gripped end
}

// per-row horizontal shear pivoted at HAIR_BASE_ROW (top of the head, where
// the hair — and so the grab point — attaches): the whole body hangs below
// this pivot, so every body row shifts the same direction, growing with
// distance from the pivot (feet trail the most). This replaces the old
// cheek-pinch shear, which pivoted mid-body and bent head/body opposite
// ways — that only looked right for the one side the cheek was drawn on
// and read as "wrong" whenever dragged the other direction. A single
// top-anchored pivot is symmetric: strength's sign alone picks the lean
// direction, so left and right drags are mirror images of each other.
function tiltShear(grid, strength) {
  const out = makeGrid();
  for (let y = 0; y < H; y++) {
    const dist = Math.max(0, y - HAIR_BASE_ROW);
    const shift = Math.round((strength * dist) / 14);
    for (let x = 0; x < W; x++) {
      const sx = x - shift;
      if (sx >= 0 && sx < W) out[y][x] = grid[y][sx];
    }
  }
  return out;
}

// ground shadow for the walk/hop cycle — width shrinks as the body rises,
// painted *before* the body so an airborne frame reveals the full ellipse
// while a grounded frame's own silhouette naturally covers it.
function paintShadow(grid, width) {
  if (!width) return;
  const leftX = CENTER_X - Math.floor(width / 2);
  rect(grid, leftX, 17, width, 1, PALETTE.shadow);
}

function frameToRGBA(grid) {
  const rgba = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = grid[y][x] || [0, 0, 0, 0];
      const idx = (y * W + x) * 4;
      rgba[idx] = c[0];
      rgba[idx + 1] = c[1];
      rgba[idx + 2] = c[2];
      rgba[idx + 3] = c[3];
    }
  }
  return rgba;
}

function upscale(rgba, w, h, scale) {
  const out = new Uint8ClampedArray(w * scale * h * scale * 4);
  const ow = w * scale;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * 4;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const ox = x * scale + dx;
          const oy = y * scale + dy;
          const dstIdx = (oy * ow + ox) * 4;
          out[dstIdx] = rgba[srcIdx];
          out[dstIdx + 1] = rgba[srcIdx + 1];
          out[dstIdx + 2] = rgba[srcIdx + 2];
          out[dstIdx + 3] = rgba[srcIdx + 3];
        }
      }
    }
  }
  return out;
}

const bodyMask = buildBodyMask();

const STATES = {
  // hairSway is omitted for `alarmed` on purpose — its exclamation mark
  // (paintBang) occupies the exact same rows/column as the hair, and the
  // startled-stiff-hair reading is already covered by the bang itself.
  idle: [
    { bob: 0, blink: false, mouth: "flat", hairSway: -1 },
    { bob: -1, blink: false, mouth: "flat", hairSway: 0 },
    { bob: 0, blink: false, mouth: "flat", hairSway: 1 },
    { bob: 0, blink: true, mouth: "flat", hairSway: 0 },
  ],
  thinking: [
    { bob: 0, eyeDX: 1, eyeDY: -1, mouth: "o", dotsActive: 0, hairSway: 0 },
    { bob: -1, eyeDX: 1, eyeDY: -1, mouth: "o", dotsActive: 1, hairSway: 1 },
    { bob: 0, eyeDX: 1, eyeDY: -1, mouth: "o", dotsActive: 2, hairSway: 0 },
    { bob: -1, eyeDX: 1, eyeDY: -1, mouth: "o", dotsActive: 1, hairSway: 1 },
  ],
  worried: [
    { bob: 0, browAngry: true, mouth: "wavy", sweatY: 6, hairSway: 1 },
    { bob: 0, browAngry: true, mouth: "wavy", sweatY: 7, hairSway: 2 },
    { bob: 0, browAngry: true, mouth: "wavy", sweatY: 8, hairSway: 1 },
    { bob: 0, browAngry: true, mouth: "wavy", sweatY: 9, hairSway: 2 },
  ],
  alarmed: [
    { shiftX: -1, mouth: "o", bangX: 0 },
    { shiftX: 0, mouth: "o", bangX: 1 },
    { shiftX: 1, mouth: "o", bangX: 0 },
    { shiftX: 0, mouth: "o", bangX: -1 },
  ],
  // motion layer (orthogonal to the 4 health states above) — see README "모션 레이어"
  walking: [
    { bob: 0, mouth: "flat", shadow: 9, hairSway: 0 },
    { bob: -2, mouth: "flat", shadow: 6, hairSway: 1 },
    { bob: -3, mouth: "flat", shadow: 3, hairSway: 2 },
    { bob: -2, mouth: "flat", shadow: 6, hairSway: 1 },
  ],
  // held by the one hair, not the cheek (see README) — frames 0/1 show the
  // body trailing LEFT (as when being dragged to the right) and 2/3 show it
  // trailing RIGHT (as when dragged left); hairDir always points opposite
  // the body's lean, toward whatever is doing the pulling.
  dragged: [
    { bob: 0, mouth: "o", surprised: true, tiltStrength: -3, hairDir: 1, hairLen: 3 },
    { bob: -1, mouth: "o", surprised: true, tiltStrength: -2, hairDir: 1, hairLen: 2 },
    { bob: 0, mouth: "o", surprised: true, tiltStrength: 3, hairDir: -1, hairLen: 3 },
    { bob: -1, mouth: "o", surprised: true, tiltStrength: 2, hairDir: -1, hairLen: 2 },
  ],
};

const outDir = process.argv[2] || ".";
const spritesDir = `${outDir}/sprites`;
const previewDir = `${outDir}/preview`;
fs.mkdirSync(spritesDir, { recursive: true });
fs.mkdirSync(previewDir, { recursive: true });

const allFramesData = {};
const PREVIEW_SCALE = 16;

for (const [state, frames] of Object.entries(STATES)) {
  allFramesData[state] = [];
  const sheetRgba = new Uint8ClampedArray(W * frames.length * H * 4);

  frames.forEach((f, i) => {
    const grid = makeGrid();
    const bob = f.bob || 0;
    if (f.shadow !== undefined) paintShadow(grid, f.shadow);
    paintBody(grid, bodyMask, bob);
    paintFace(grid, {
      blink: f.blink,
      eyeDX: f.eyeDX || 0,
      browAngry: f.browAngry,
      surprised: f.surprised,
      mouth: f.mouth,
      bobOffset: bob,
    });
    if (f.sweatY !== undefined) paintSweat(grid, f.sweatY);
    if (f.dotsActive !== undefined) paintDots(grid, f.dotsActive);
    if (f.bangX !== undefined) paintBang(grid, f.bangX);
    if (f.hairSway !== undefined) paintHairLoose(grid, bob, f.hairSway);
    if (f.hairDir !== undefined) paintHairTaut(grid, bob, f.hairDir, f.hairLen || 0);

    let finalGrid = grid;

    // horizontal shake for alarmed: shift whole grid
    if (f.shiftX) {
      const sheared = finalGrid;
      finalGrid = makeGrid();
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const sx = x - f.shiftX;
          if (sx >= 0 && sx < W) finalGrid[y][x] = sheared[y][sx];
        }
      }
    }
    // whole-body inertia lean for dragged (see tiltShear)
    if (f.tiltStrength) {
      finalGrid = tiltShear(finalGrid, f.tiltStrength);
    }
    const rgba = frameToRGBA(finalGrid);

    // raw-resolution frame PNG (actual shippable dot-art asset)
    fs.writeFileSync(`${spritesDir}/${state}_${i}.png`, encodePNG(W, H, rgba));

    // upscaled single-frame PNG for human preview
    const up = upscale(rgba, W, H, PREVIEW_SCALE);
    fs.writeFileSync(`${previewDir}/${state}_${i}.png`, encodePNG(W * PREVIEW_SCALE, H * PREVIEW_SCALE, up));

    // write into horizontal sheet buffer
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const srcIdx = (y * W + x) * 4;
        const dstX = i * W + x;
        const dstIdx = (y * (W * frames.length) + dstX) * 4;
        sheetRgba[dstIdx] = rgba[srcIdx];
        sheetRgba[dstIdx + 1] = rgba[srcIdx + 1];
        sheetRgba[dstIdx + 2] = rgba[srcIdx + 2];
        sheetRgba[dstIdx + 3] = rgba[srcIdx + 3];
      }
    }

    allFramesData[state].push(
      finalGrid.map((row) => row.map((c) => (c ? `rgba(${c[0]},${c[1]},${c[2]},${(c[3] / 255).toFixed(2)})` : null)))
    );
  });

  // raw-resolution sprite sheet (frames laid out horizontally)
  fs.writeFileSync(`${spritesDir}/${state}_sheet.png`, encodePNG(W * frames.length, H, sheetRgba));
}

fs.writeFileSync(
  `${outDir}/frames.json`,
  JSON.stringify(
    {
      width: W,
      height: H,
      fps: 4,
      states: allFramesData,
    },
    null,
    2
  )
);
console.log("done", outDir);
