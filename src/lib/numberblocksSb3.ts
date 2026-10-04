import JSZip, { type JSZipObject } from "jszip";

/**
 * Runtime asset mapper for a Scratch .sb3 project.
 *
 * Put the Scratch project in:
 *   public/assets/Numberblocks Generator.sb3
 *
 * Install:
 *   npm i jszip
 *
 * Basic usage:
 *
 *   const assets = new ScratchSb3Assets();
 *
 *   // Direct Numberblock, 0–99:
 *   const sevenUrl = await assets.getNumberSvgUrl(7);
 *
 *   // Character-aware figure (official + FOF + named larges):
 *   //   144 -> One Hundred + Forty-Four
 *   const figure = await assets.getNumberblockFigure(144);
 *
 *   // Place-value chunks (Scratch generator style):
 *   const parts = await assets.getNumberParts(1234);
 *   // [
 *   //   { target: "NBs//Ten T + Thousands", costume: "n1", ... },
 *   //   { target: "NBs//Hundreds",          costume: "n2", ... },
 *   //   { target: "NBs//Ten + One",         costume: "n34", ... }
 *   // ]
 *
 * See docs/numberblocks-sb3-structure.md for the full target/costume tree.
 */

export type ScratchCostume = {
  name: string;
  assetId: string;
  md5ext: string;
  dataFormat: string;
  bitmapResolution?: number;
  rotationCenterX: number;
  rotationCenterY: number;
};

export type ScratchTarget = {
  isStage: boolean;
  name: string;
  costumes: ScratchCostume[];
  sounds?: ScratchSound[];

  // Sprite transform metadata. These fields are absent on the Stage.
  x?: number;
  y?: number;
  size?: number;
  direction?: number;
  visible?: boolean;
  rotationStyle?: string;
  layerOrder?: number;
};

export type ScratchSound = {
  name: string;
  assetId: string;
  md5ext: string;
  dataFormat: string;
  rate?: number;
  sampleCount?: number;
};

type ScratchProject = {
  targets: ScratchTarget[];
};

export type SvgAssetRef = {
  target: string;
  costume: string;
  assetId: string;
  file: string;
  dataFormat: string;
  rotationCenterX: number;
  rotationCenterY: number;
};

export type NumberPlaceGroup =
  | "ones+tens"
  | "hundreds"
  | "thousands+ten-thousands"
  | "hundred-thousands"
  | "millions+ten-millions"
  | "hundred-millions"
  | "billions+ten-billions"
  | "hundred-billions"
  | "trillions+ten-trillions";

export type NumberSvgPart = SvgAssetRef & {
  placeGroup: NumberPlaceGroup;

  /**
   * The local costume number used inside this Scratch sprite.
   *
   * Example:
   *   1234 -> 1 | 2 | 34
   *           ^   ^    ^
   *      thousands hundreds ones+tens
   */
  chunk: number;

  /**
   * Decimal value represented by one unit in this group.
   * Examples: 1, 100, 1000, ...
   */
  divisor: bigint;

  /**
   * Object URL suitable for:
   *   <img :src="part.url">
   */
  url: string;
};

type NumberGroupDefinition = {
  placeGroup: NumberPlaceGroup;
  target: string;
  divisor: bigint;
  base: bigint;
};

/**
 * This matches the structure found in "Numberblocks Generator.sb3".
 *
 * The Scratch project does NOT store one SVG for every huge integer.
 * It stores decimal chunks:
 *
 *   ones/tens             -> n0 ... n99
 *   hundreds              -> n0 ... n9
 *   thousands/ten-thousands -> n0 ... n99
 *   hundred-thousands     -> n0 ... n9
 *   ...
 *
 * The original Scratch generator combines these sprites to form large
 * Numberblocks.
 */
export const NUMBER_GROUPS: readonly NumberGroupDefinition[] = [
  {
    placeGroup: "ones+tens",
    target: "NBs//Ten + One",
    divisor: 1n,
    base: 100n,
  },
  {
    placeGroup: "hundreds",
    target: "NBs//Hundreds",
    divisor: 100n,
    base: 10n,
  },
  {
    placeGroup: "thousands+ten-thousands",
    target: "NBs//Ten T + Thousands",
    divisor: 1_000n,
    base: 100n,
  },
  {
    placeGroup: "hundred-thousands",
    target: "NBs//Hundred Thousans",
    divisor: 100_000n,
    base: 10n,
  },
  {
    placeGroup: "millions+ten-millions",
    target: "NBs//Millions + 10 Mil",
    divisor: 1_000_000n,
    base: 100n,
  },
  {
    placeGroup: "hundred-millions",
    target: "NBs//Hundred Mils",
    divisor: 100_000_000n,
    base: 10n,
  },
  {
    placeGroup: "billions+ten-billions",
    target: "NBs//Billions",
    divisor: 1_000_000_000n,
    base: 100n,
  },
  {
    placeGroup: "hundred-billions",
    target: "NBs//Hundred Billions",
    divisor: 100_000_000_000n,
    base: 10n,
  },
  {
    placeGroup: "trillions+ten-trillions",
    target: "NBs//Trillion",
    divisor: 1_000_000_000_000n,
    base: 100n,
  },
] as const;

export const MAX_NUMBERBLOCK_VALUE = 99_999_999_999_999n;

/** Official character costumes (faces, hair, limbs). */
const OFFICIAL_TARGET = "assets//Official Numberblocks 0-100";

/** Extra named faces not present in the official 0–100 pack. */
const FOF_TARGET = "assets//Figured-Out Frenzy";

/**
 * Stage list `figured-out frenzy guys` from the Scratch project.
 * These integers are first-class characters (named face and/or `nN-fof`).
 */
export const FOF_NUMBERBLOCK_VALUES = [
  99, 98, 97, 96, 95, 94, 93, 92, 91, 89, 88, 87, 86, 85, 84, 83, 82, 79, 78,
  77, 76, 75, 74, 73, 71, 69, 68, 67, 66, 65, 62, 61, 59, 58, 57, 53, 52, 51,
  47, 46, 44, 43, 41,
] as const;

/** FOF values that have a dedicated named SVG in `assets//Figured-Out Frenzy`. */
export const FOF_NAMED_NUMBERBLOCK_VALUES = [
  99, 96, 91, 88, 84, 77, 75, 68, 66, 65, 44,
] as const;

type NamedLargeCostume = {
  value: number;
  target: string;
  costume: string;
  /** When true, only used for an exact match — never as a greedy split piece. */
  exactOnly?: boolean;
};

/**
 * Named large-number costumes from the Scratch asset packs.
 * Round values participate in greedy splitting; odd specials are exact-only.
 */
const NAMED_LARGE_COSTUMES: readonly NamedLargeCostume[] = [
  // Hundreds / round powers — assets//Large Numbers
  { value: 200, target: "assets//Large Numbers", costume: "Two Hundred" },
  { value: 300, target: "assets//Large Numbers", costume: "Three Hundred" },
  { value: 400, target: "assets//Large Numbers", costume: "Four Hundred" },
  { value: 500, target: "assets//Large Numbers", costume: "Five Hundred" },
  { value: 600, target: "assets//Large Numbers", costume: "Six Hundred" },
  { value: 700, target: "assets//Large Numbers", costume: "Seven Hundred" },
  { value: 800, target: "assets//Large Numbers", costume: "Eight Hundred" },
  { value: 900, target: "assets//Large Numbers", costume: "Nine Hundred" },
  {
    value: 1_000,
    target: "assets//Thousands (Small)",
    costume: "One Thousand",
  },
  {
    value: 2_000,
    target: "assets//Thousands (Small)",
    costume: "Two Thousand",
  },
  {
    value: 3_000,
    target: "assets//Thousands (Small)",
    costume: "Three Thousand",
  },
  {
    value: 4_000,
    target: "assets//Thousands (Small)",
    costume: "Four Thousand",
  },
  {
    value: 5_000,
    target: "assets//Thousands (Small)",
    costume: "Five Thousand",
  },
  {
    value: 6_000,
    target: "assets//Thousands (Small)",
    costume: "Six Thousand",
  },
  {
    value: 7_000,
    target: "assets//Thousands (Small)",
    costume: "Seven Thousand",
  },
  {
    value: 8_000,
    target: "assets//Thousands (Small)",
    costume: "Eight Thousand",
  },
  {
    value: 9_000,
    target: "assets//Thousands (Small)",
    costume: "Nine Thousand",
  },
  {
    value: 10_000,
    target: "assets//Ten Thousands",
    costume: "Ten Thousand",
  },
  {
    value: 11_000,
    target: "assets//Ten Thousands",
    costume: "Eleven Thousand",
  },
  {
    value: 12_000,
    target: "assets//Ten Thousands",
    costume: "Twelve Thousand",
  },
  {
    value: 13_000,
    target: "assets//Ten Thousands",
    costume: "Thirteen Thousand",
  },
  {
    value: 14_000,
    target: "assets//Ten Thousands",
    costume: "Fourteen Thousand",
  },
  {
    value: 15_000,
    target: "assets//Ten Thousands",
    costume: "Fifteen Thousand",
  },
  {
    value: 16_000,
    target: "assets//Ten Thousands",
    costume: "Sixteen Thousand",
  },
  {
    value: 17_000,
    target: "assets//Ten Thousands",
    costume: "Seventeen Thousand",
  },
  {
    value: 18_000,
    target: "assets//Ten Thousands",
    costume: "Eighteen Thousand",
  },
  {
    value: 19_000,
    target: "assets//Ten Thousands",
    costume: "Nineteen Thousand3",
  },
  {
    value: 20_000,
    target: "assets//Ten Thousands",
    costume: "Twenty Thousand",
  },
  {
    value: 30_000,
    target: "assets//Ten Thousands",
    costume: "Thirty Thousand",
  },
  {
    value: 40_000,
    target: "assets//Ten Thousands",
    costume: "Forty Thousand",
  },
  {
    value: 50_000,
    target: "assets//Ten Thousands",
    costume: "Fifty Thousand",
  },
  {
    value: 60_000,
    target: "assets//Ten Thousands",
    costume: "Sixty Thousand",
  },
  {
    value: 70_000,
    target: "assets//Ten Thousands",
    costume: "Seventy Thousand",
  },
  {
    value: 80_000,
    target: "assets//Ten Thousands",
    costume: "Eighty Thousand",
  },
  {
    value: 90_000,
    target: "assets//Ten Thousands",
    costume: "Ninety Thousand",
  },
  {
    value: 100_000,
    target: "assets//Hundred Thousands",
    costume: "One Hundred Thousand",
  },
  {
    value: 1_000_000,
    target: "assets//Millions and more",
    costume: "One Million",
  },
  {
    value: 2_000_000,
    target: "assets//Millions and more",
    costume: "Two Million",
  },
  {
    value: 3_000_000,
    target: "assets//Millions and more",
    costume: "Three Million",
  },
  {
    value: 4_000_000,
    target: "assets//Millions and more",
    costume: "Four Million",
  },
  {
    value: 5_000_000,
    target: "assets//Millions and more",
    costume: "Five Million",
  },
  {
    value: 6_000_000,
    target: "assets//Millions and more",
    costume: "Six Million",
  },
  {
    value: 7_000_000,
    target: "assets//Millions and more",
    costume: "Seven Million",
  },
  {
    value: 8_000_000,
    target: "assets//Millions and more",
    costume: "Eight Million",
  },
  {
    value: 9_000_000,
    target: "assets//Millions and more",
    costume: "Nine Million",
  },
  {
    value: 10_000_000,
    target: "assets//Millions and more",
    costume: "Ten Million",
  },
  {
    value: 100_000_000,
    target: "assets//Millions and more",
    costume: "One Hundred Million",
  },
  {
    value: 1_000_000_000,
    target: "assets//Millions and more",
    costume: "One Billion",
  },
  {
    value: 1_000_000_000_000,
    target: "assets//Millions and more",
    costume: "One Trillion",
  },

  // Exact-only specials (do not use as greedy addends)
  {
    value: 2_024,
    target: "assets//Thousands (Small)",
    costume: "Two Thousand and Twenty-Four",
    exactOnly: true,
  },
  {
    value: 2_025,
    target: "assets//Thousands (Small)",
    costume: "Two Thousand and Twenty-Five",
    exactOnly: true,
  },
  {
    value: 2_048,
    target: "assets//Thousands (Small)",
    costume: "Two Thousand and Forty-Eight",
    exactOnly: true,
  },
  {
    value: 7_500,
    target: "assets//Thousands (Small)",
    costume: "Seven Thousand Five Hundred",
    exactOnly: true,
  },
  {
    value: 32_767,
    target: "assets//Ten Thousands",
    costume: "Thirty-Two Thousand Seven Hundred and Sixty-Seven",
    exactOnly: true,
  },
  {
    value: 65_536,
    target: "assets//Ten Thousands",
    costume: "Sixty-Five Thousand Five Hundred and Thirty-Six",
    exactOnly: true,
  },
  {
    value: 97_104,
    target: "assets//Large Numbers",
    costume: "Ninety-Seven Thousand One Hundred and Four",
    exactOnly: true,
  },
  {
    value: 314_159,
    target: "assets//Hundred Thousands",
    costume: "Three Hundred and Fourteen Thousand One Hundred and Fifty-Nine",
    exactOnly: true,
  },
] as const;

const TRANSLATE_RE =
  /transform="translate\(\s*([^,\s)]+)\s*,\s*([^,\s)]+)\s*\)"/;

/**
 * Scratch costume SVGs are stored in stage coordinates, then wrapped as:
 *
 *   viewBox="0 0 W H"
 *   <g transform="translate(-minX, -minY)"> ... </g>
 *
 * Hands and feet are painted with `gradientUnits="userSpaceOnUse"` using those
 * original stage coordinates. Browsers rendering the file as <img> resolve
 * those gradients against the viewBox (0,0,W,H), so the fill lands off-canvas
 * and the limbs vanish. Eyes, mouths, crowns and hair use solid fills, which
 * is why they still show.
 *
 * Rewriting the viewBox to the untranslated bounds and dropping the wrapper
 * translate puts paths and gradients in the same space.
 */
export function normalizeScratchSvg(svg: string): string {
  const svgOpenMatch = svg.match(/<svg\b[^>]*>/i);
  if (!svgOpenMatch) return svg;

  const svgOpen = svgOpenMatch[0];
  const viewBoxMatch = svgOpen.match(/viewBox\s*=\s*"([^"]+)"/i);
  if (!viewBoxMatch) return svg;

  const box = viewBoxMatch[1]
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (box.length !== 4 || box.some((n) => !Number.isFinite(n))) return svg;
  const [minX, minY, width, height] = box;

  const afterOpen = svg.slice(svgOpenMatch.index! + svgOpen.length);
  const defsEnd = afterOpen.search(/<\/defs>/i);
  const searchFrom = defsEnd === -1 ? 0 : defsEnd + "</defs>".length;
  const wrapperSlice = afterOpen.slice(searchFrom);
  const wrapperMatch = wrapperSlice.match(/<g\b[^>]*>/);
  if (!wrapperMatch) return svg;

  const translateMatch = wrapperMatch[0].match(TRANSLATE_RE);
  if (!translateMatch) return svg;

  const tx = Number(translateMatch[1]);
  const ty = Number(translateMatch[2]);
  if (!Number.isFinite(tx) || !Number.isFinite(ty) || (tx === 0 && ty === 0)) {
    return svg;
  }

  const viewBox = `${minX - tx} ${minY - ty} ${width} ${height}`;
  const unwrappedGroup = wrapperMatch[0]
    .replace(TRANSLATE_RE, "")
    .replace(/<g\s+/, "<g ")
    .replace(/<g\s*>/, "<g>");

  return (
    svg.slice(0, svgOpenMatch.index) +
    svgOpen.replace(viewBoxMatch[0], `viewBox="${viewBox}"`) +
    afterOpen.slice(0, searchFrom) +
    wrapperSlice.replace(wrapperMatch[0], unwrappedGroup)
  );
}

type PathBox = { minX: number; minY: number; maxX: number; maxY: number };

function tokenizePath(d: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(d))) {
    if (match[1]) tokens.push(match[1]);
    else tokens.push(Number(match[2]));
  }
  return tokens;
}

function pathBBox(d: string): PathBox | null {
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const add = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  const tokens = tokenizePath(d);
  let i = 0;
  let cmd = "M";

  while (i < tokens.length) {
    const token = tokens[i];
    if (typeof token === "string") {
      cmd = token;
      i += 1;
      continue;
    }

    const rel = cmd === cmd.toLowerCase();
    const kind = cmd.toUpperCase();

    if (kind === "Z") {
      cx = sx;
      cy = sy;
      continue;
    }

    if (kind === "M" || kind === "L" || kind === "T") {
      const x = tokens[i] as number;
      const y = tokens[i + 1] as number;
      i += 2;
      cx = rel ? cx + x : x;
      cy = rel ? cy + y : y;
      if (kind === "M") {
        sx = cx;
        sy = cy;
      }
      add(cx, cy);
    } else if (kind === "H") {
      const x = tokens[i] as number;
      i += 1;
      cx = rel ? cx + x : x;
      add(cx, cy);
    } else if (kind === "V") {
      const y = tokens[i] as number;
      i += 1;
      cy = rel ? cy + y : y;
      add(cx, cy);
    } else if (kind === "C") {
      const p = tokens.slice(i, i + 6) as number[];
      i += 6;
      for (let k = 0; k < 6; k += 2) {
        const x = rel ? cx + p[k] : p[k];
        const y = rel ? cy + p[k + 1] : p[k + 1];
        add(x, y);
        if (k === 4) {
          cx = x;
          cy = y;
        }
      }
    } else if (kind === "S" || kind === "Q") {
      const p = tokens.slice(i, i + 4) as number[];
      i += 4;
      for (let k = 0; k < 4; k += 2) {
        const x = rel ? cx + p[k] : p[k];
        const y = rel ? cy + p[k + 1] : p[k + 1];
        add(x, y);
        if (k === 2) {
          cx = x;
          cy = y;
        }
      }
    } else if (kind === "A") {
      const p = tokens.slice(i, i + 7) as number[];
      i += 7;
      cx = rel ? cx + p[5] : p[5];
      cy = rel ? cy + p[6] : p[6];
      add(cx, cy);
    } else {
      break;
    }
  }

  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

function isBlackFill(fill: string | undefined): boolean {
  if (!fill) return false;
  const value = fill.trim().toLowerCase();
  return value === "#000" || value === "#000000" || value === "black";
}

/**
 * Official costumes paint a large black numeral above the character.
 * The equation already shows that number, so drop the overlay and crop
 * the empty space it left behind.
 */
export function stripCostumeNumeral(svg: string): string {
  const svgOpenMatch = svg.match(/<svg\b[^>]*>/i);
  if (!svgOpenMatch) return svg;

  const viewBoxMatch = svgOpenMatch[0].match(/viewBox\s*=\s*"([^"]+)"/i);
  if (!viewBoxMatch) return svg;

  const box = viewBoxMatch[1]
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (box.length !== 4 || box.some((n) => !Number.isFinite(n))) return svg;
  const [, viewY, , viewH] = box;

  const pathRe = /<path\b([^>]*)>(?:<\/path>)?/gi;
  let stripped = svg.replace(pathRe, (full, attrs: string) => {
    const d = attrs.match(/\bd\s*=\s*"([^"]+)"/i)?.[1];
    const fill = attrs.match(/\bfill\s*=\s*"([^"]+)"/i)?.[1];
    if (!d || !isBlackFill(fill)) return full;

    const bounds = pathBBox(d);
    if (!bounds) return full;

    const height = bounds.maxY - bounds.minY;
    const width = bounds.maxX - bounds.minX;
    const fromTop = bounds.minY - viewY;
    // Only drop overlay numerals that live entirely in the top band.
    // One's pupil is also a small black path, but it sits on the face.
    const overlayBand = Math.min(24, viewH * 0.38);
    const looksLikeDigit =
      height >= 8 &&
      height <= 22 &&
      height <= viewH * 0.35 &&
      width <= 16 &&
      fromTop >= -2 &&
      bounds.maxY <= viewY + overlayBand;

    if (looksLikeDigit) return "";
    return full;
  });

  const remaining: PathBox[] = [];
  for (const match of stripped.matchAll(/<path\b([^>]*)>/gi)) {
    const d = match[1].match(/\bd\s*=\s*"([^"]+)"/i)?.[1];
    if (!d) continue;
    const bounds = pathBBox(d);
    if (bounds) remaining.push(bounds);
  }
  if (remaining.length === 0) return svg;

  const minY = Math.min(...remaining.map((b) => b.minY));
  const maxY = Math.max(...remaining.map((b) => b.maxY));
  const croppedHeight = maxY - minY;
  if (!Number.isFinite(croppedHeight) || croppedHeight < 8) return stripped;
  if (minY <= viewY + 1) return stripped;

  const nextBox = `${box[0]} ${minY} ${box[2]} ${croppedHeight}`;
  stripped = stripped.replace(viewBoxMatch[0], `viewBox="${nextBox}"`);
  return stripped.replace(
    /(<svg\b[^>]*\bheight=")([^"]+)(")/i,
    `$1${croppedHeight}$3`,
  );
}

function isBlackStroke(stroke: string | undefined): boolean {
  if (!stroke) return false;
  const value = stroke.trim().toLowerCase();
  return value === "#000" || value === "#000000" || value === "black";
}

function parseHexColor(color: string): [number, number, number] | null {
  const match = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function toHexColor(r: number, g: number, b: number): string {
  const byte = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}`;
}

function seamColorForFill(fill: string | undefined): string {
  const rgb = fill ? parseHexColor(fill) : null;
  if (!rgb) return "#5a1e22";
  const [r, g, b] = rgb;
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  // Ten's white cubes need a grey groove, not a washed-out off-white.
  if (luma > 210) return "#4d4d4d";
  return toHexColor(r * 0.45, g * 0.45, b * 0.45);
}

type CubePath = {
  width: number;
  height: number;
  fill: string | undefined;
};

/**
 * Groove width as a fraction of one cube.
 * 0.04 is a thin seam; raise toward 0.08 for a heavier grid.
 */
export const BLOCK_SEAM_THICKNESS = 0.02;

/**
 * Scratch cube paths already have `stroke="#000000"`, but the painting
 * layer sets `stroke-width="0"`, so 2×2 Four (and the rest) reads as one
 * solid slab. Restore a groove on every unit square so the blocks can be
 * counted.
 */
export function separateBlockSeams(svg: string): string {
  const pathRe = /<path\b([^>]*)>/gi;
  const cubes: CubePath[] = [];

  for (const match of svg.matchAll(pathRe)) {
    const cube = cubeFromAttrs(match[1]);
    if (cube) cubes.push(cube);
  }
  if (cubes.length === 0) return svg;

  const hist = new Map<number, number>();
  for (const cube of cubes) {
    const bin = Math.round(((cube.width + cube.height) / 2) * 2) / 2;
    hist.set(bin, (hist.get(bin) ?? 0) + 1);
  }

  let unit = 0;
  let votes = 0;
  for (const [bin, count] of hist) {
    if (count > votes || (count === votes && bin > unit)) {
      unit = bin;
      votes = count;
    }
  }
  if (unit < 2) return svg;

  const atUnit = cubes.filter(
    (cube) =>
      Math.abs(cube.width - unit) <= unit * 0.08 &&
      Math.abs(cube.height - unit) <= unit * 0.08,
  );
  const hollowAtUnit = atUnit.filter(
    (cube) => cube.fill === "none" || cube.fill === undefined,
  ).length;
  const allowHollow = hollowAtUnit >= 9;

  const strokeWidth = unit * BLOCK_SEAM_THICKNESS;

  return svg.replace(pathRe, (full, attrs: string) => {
    const cube = cubeFromAttrs(attrs);
    if (
      !cube ||
      Math.abs(cube.width - unit) > unit * 0.08 ||
      Math.abs(cube.height - unit) > unit * 0.08
    ) {
      return full;
    }

    if ((cube.fill === "none" || cube.fill === undefined) && !allowHollow) {
      return full;
    }

    const seam = seamColorForFill(cube.fill);
    let next = attrs;
    if (/\bstroke-width\s*=/.test(next)) {
      next = next.replace(
        /\bstroke-width\s*=\s*"[^"]*"/i,
        `stroke-width="${strokeWidth.toFixed(3)}"`,
      );
    } else if (/\bstroke\s*=/.test(next)) {
      next = next.replace(
        /\bstroke\s*=\s*"[^"]*"/i,
        (stroke) => `${stroke} stroke-width="${strokeWidth.toFixed(3)}"`,
      );
    } else {
      next += ` stroke-width="${strokeWidth.toFixed(3)}"`;
    }

    if (/\bstroke\s*=/.test(next)) {
      next = next.replace(/\bstroke\s*=\s*"[^"]*"/i, `stroke="${seam}"`);
    } else {
      next += ` stroke="${seam}"`;
    }

    return `<path${next}>`;
  });
}

function cubeFromAttrs(attrs: string): CubePath | null {
  const d = attrs.match(/\bd\s*=\s*"([^"]+)"/i)?.[1];
  const fill = attrs.match(/\bfill\s*=\s*"([^"]+)"/i)?.[1];
  const stroke = attrs.match(/\bstroke\s*=\s*"([^"]+)"/i)?.[1];
  if (!d) return null;
  if (fill?.startsWith("url(") || isBlackFill(fill)) return null;

  const bounds = pathBBox(d);
  if (!bounds) return null;
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const size = Math.max(width, height);
  const minSide = Math.min(width, height);
  if (size < 2 || minSide <= 0 || size / minSide > 1.08) return null;

  const solid = Boolean(fill && fill !== "none");
  // Hundred's 10×10 is fill="none" squares over a parent fill.
  if (solid && !isBlackStroke(stroke)) return null;

  return { width, height, fill };
}

const UNDER_TWENTY = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
] as const;

const TENS_NAMES = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
] as const;

function officialCostumeName(number: number): string | null {
  if (number === 100) return "One Hundred";
  if (number >= 0 && number < 20) return UNDER_TWENTY[number];
  if (number < 0 || number > 100) return null;

  const tens = Math.floor(number / 10);
  const ones = number % 10;
  const tensName = TENS_NAMES[tens];
  if (!tensName) return null;
  if (ones === 0) return tensName;
  return `${tensName}-${UNDER_TWENTY[ones]}`;
}

/** Values that have a named official costume in the Scratch pack. */
export const OFFICIAL_NUMBERBLOCK_VALUES = [
  100, 90, 81, 80, 72, 70, 64, 63, 60, 56, 55, 54, 50, 49, 48, 45, 42, 40, 39,
  38, 37, 36, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20,
  19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
] as const;

const FOF_VALUE_SET = new Set<number>(FOF_NUMBERBLOCK_VALUES);
const FOF_NAMED_VALUE_SET = new Set<number>(FOF_NAMED_NUMBERBLOCK_VALUES);

const LARGE_BY_VALUE = new Map<number, NamedLargeCostume>(
  NAMED_LARGE_COSTUMES.map((entry) => [entry.value, entry]),
);

const EXACT_ONLY_LARGE = new Set<number>(
  NAMED_LARGE_COSTUMES.filter((entry) => entry.exactOnly).map(
    (entry) => entry.value,
  ),
);

/**
 * Atomic character values used when splitting a composite number.
 * Official ∪ FOF covers every integer 0–100; round large costumes are
 * included so 200 stays “Two Hundred” instead of 100+100.
 */
export const CHARACTER_NUMBERBLOCK_VALUES: readonly number[] = [
  ...NAMED_LARGE_COSTUMES.filter((entry) => !entry.exactOnly).map(
    (entry) => entry.value,
  ),
  ...OFFICIAL_NUMBERBLOCK_VALUES,
  ...FOF_NUMBERBLOCK_VALUES,
]
  .filter((value, index, all) => all.indexOf(value) === index)
  .sort((a, b) => b - a);

const CHARACTER_VALUE_SET = new Set<number>(CHARACTER_NUMBERBLOCK_VALUES);

/**
 * Split a number into Numberblock character addends.
 *
 * Prefers official faces, Figured-Out Frenzy characters, and named large
 * costumes as atoms — so 144 → 100+44 (not 100+42+2) and 77 → 77.
 */
export function splitOfficialAddends(value: number): number[] {
  if (!Number.isInteger(value) || value < 0) return [];
  if (value === 0) return [0];
  if (EXACT_ONLY_LARGE.has(value) || CHARACTER_VALUE_SET.has(value)) {
    return [value];
  }

  const parts: number[] = [];
  let rest = value;
  for (const piece of CHARACTER_NUMBERBLOCK_VALUES) {
    if (piece === 0) continue;
    while (rest >= piece) {
      parts.push(piece);
      rest -= piece;
    }
  }
  return parts;
}

function viewBoxSize(svg: string): { width: number; height: number } {
  const match = svg.match(/viewBox\s*=\s*"([^"]+)"/i);
  if (!match) return { width: 1, height: 1 };
  const box = match[1]
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (box.length !== 4 || box.some((n) => !Number.isFinite(n) || n <= 0)) {
    return { width: 1, height: 1 };
  }
  return { width: box[2], height: box[3] };
}

export type NumberblockAsset = {
  url: string;
  width: number;
  height: number;
};

function toBigInt(value: number | bigint | string): bigint {
  if (typeof value === "bigint") return value;

  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new Error(
        `Number ${value} is not a safe integer. Pass it as bigint or string instead.`,
      );
    }
    return BigInt(value);
  }

  if (!/^\d+$/.test(value)) {
    throw new Error(`Invalid non-negative integer: "${value}"`);
  }

  return BigInt(value);
}

export class ScratchSb3Assets {
  private readonly sb3Url: string;

  private loadPromise?: Promise<void>;
  private zip?: JSZip;
  private project?: ScratchProject;

  private targets = new Map<string, ScratchTarget>();
  private costumes = new Map<string, Map<string, ScratchCostume>>();
  private soundsByName = new Map<string, ScratchSound>();
  private decodedSounds = new Map<string, AudioBuffer>();
  private audioContext?: AudioContext;
  private playingSources = new Set<AudioBufferSourceNode>();

  /**
   * Several Scratch costumes can point to the same md5ext.
   * Cache by physical asset filename so duplicate assets share one Blob URL.
   */
  private blobUrlCache = new Map<string, string>();

  constructor(sb3Url = "/assets/Numberblocks Generator.sb3") {
    this.sb3Url = sb3Url;
  }

  /**
   * Loads the .sb3 ZIP and project.json once.
   *
   * Note: this fetches the entire .sb3. Actual SVG contents are decompressed
   * later, only when getSvgText()/getSvgUrl() is called.
   */
  async load(): Promise<void> {
    if (!this.loadPromise) {
      this.loadPromise = this.loadInternal();
    }

    return this.loadPromise;
  }

  private async loadInternal(): Promise<void> {
    const response = await fetch(this.sb3Url);

    if (!response.ok) {
      throw new Error(
        `Could not load Scratch project: ${response.status} ${response.statusText}`,
      );
    }

    const buffer = await response.arrayBuffer();
    this.zip = await JSZip.loadAsync(buffer);

    const projectFile = this.zip.file("project.json");
    if (!projectFile) {
      throw new Error("Invalid .sb3: project.json was not found.");
    }

    this.project = JSON.parse(
      await projectFile.async("string"),
    ) as ScratchProject;

    for (const target of this.project.targets) {
      if (this.targets.has(target.name)) {
        throw new Error(`Duplicate Scratch target name: "${target.name}"`);
      }

      this.targets.set(target.name, target);

      const targetCostumes = new Map<string, ScratchCostume>();
      for (const costume of target.costumes ?? []) {
        targetCostumes.set(costume.name, costume);
      }

      this.costumes.set(target.name, targetCostumes);

      for (const sound of target.sounds ?? []) {
        if (sound.md5ext && !this.soundsByName.has(sound.name)) {
          this.soundsByName.set(sound.name, sound);
        }
      }
    }
  }

  async listTargets(prefix?: string): Promise<string[]> {
    await this.load();

    const names = [...this.targets.keys()];
    return prefix ? names.filter((name) => name.startsWith(prefix)) : names;
  }

  /**
   * Convenient way to discover the Numberblocks-related sprites:
   *
   *   await assets.listTargets("NBs//")
   */
  async listNumberblockTargets(): Promise<string[]> {
    return this.listTargets("NBs//");
  }

  async getTarget(targetName: string): Promise<ScratchTarget> {
    await this.load();

    const target = this.targets.get(targetName);
    if (!target) {
      throw new Error(`Scratch target not found: "${targetName}"`);
    }

    return target;
  }

  async listCostumes(targetName: string): Promise<ScratchCostume[]> {
    const target = await this.getTarget(targetName);
    return [...target.costumes];
  }

  async getCostume(
    targetName: string,
    costumeName: string,
  ): Promise<ScratchCostume> {
    await this.load();

    const target = this.costumes.get(targetName);
    if (!target) {
      throw new Error(`Scratch target not found: "${targetName}"`);
    }

    const costume = target.get(costumeName);
    if (!costume) {
      throw new Error(
        `Costume "${costumeName}" not found on target "${targetName}".`,
      );
    }

    return costume;
  }

  async hasCostume(targetName: string, costumeName: string): Promise<boolean> {
    await this.load();
    return this.costumes.get(targetName)?.has(costumeName) ?? false;
  }

  private async getZipFile(md5ext: string): Promise<JSZipObject> {
    await this.load();

    if (!this.zip) {
      throw new Error("Scratch ZIP was not loaded.");
    }

    const file = this.zip.file(md5ext);
    if (!file) {
      throw new Error(`Asset "${md5ext}" was not found in the .sb3.`);
    }

    return file;
  }

  private async getZipAsset(costume: ScratchCostume): Promise<JSZipObject> {
    return this.getZipFile(costume.md5ext);
  }

  /**
   * Blob URL for a named Scratch sound (Stage names win).
   * `pop` is the merge click; `n7` is the spoken “seven”.
   */
  async getSoundUrl(soundName: string): Promise<string | null> {
    await this.load();
    const sound = this.soundsByName.get(soundName);
    if (!sound) return null;

    const cacheKey = `sound:${sound.md5ext}`;
    const cached = this.blobUrlCache.get(cacheKey);
    if (cached) return cached;

    const file = await this.getZipFile(sound.md5ext);
    const bytes = await file.async("arraybuffer");
    const mime =
      sound.dataFormat.toLowerCase() === "mp3" ? "audio/mpeg" : "audio/wav";
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    this.blobUrlCache.set(cacheKey, url);
    return url;
  }

  async playSound(soundName: string): Promise<void> {
    await this.load();
    const sound = this.soundsByName.get(soundName);
    if (!sound) return;

    const ctx = this.getAudioContext();
    if (ctx.state === "suspended") {
      await ctx.resume().catch(() => undefined);
    }

    const buffer = await this.decodeSound(soundName, sound);
    if (!buffer) return;

    await new Promise<void>((resolve) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      const finish = () => {
        this.playingSources.delete(source);
        resolve();
      };
      source.addEventListener("ended", finish);
      this.playingSources.add(source);
      try {
        // start(0) is context time 0. After the clock has moved on, browsers
        // skip into the buffer — you only hear the tail of the name.
        source.start();
      } catch {
        finish();
      }
    });
  }

  async playNumberName(value: number): Promise<void> {
    if (!Number.isInteger(value) || value < 0 || value > 100) return;
    await this.playSound(`n${value}`);
  }

  stopAllSounds(): void {
    for (const source of this.playingSources) {
      try {
        source.stop();
      } catch {
        // already stopped
      }
    }
    this.playingSources.clear();
  }

  /** Call from a tap/key so AudioContext is already running when the merge plays. */
  async unlockAudio(): Promise<void> {
    const ctx = this.getAudioContext();
    if (ctx.state === "suspended") {
      await ctx.resume().catch(() => undefined);
    }
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  private async decodeSound(
    soundName: string,
    sound: ScratchSound,
  ): Promise<AudioBuffer | null> {
    const cached = this.decodedSounds.get(soundName);
    if (cached) return cached;

    const file = await this.getZipFile(sound.md5ext);
    const bytes = await file.async("arraybuffer");
    try {
      const buffer = await this.getAudioContext().decodeAudioData(
        bytes.slice(0),
      );
      this.decodedSounds.set(soundName, buffer);
      return buffer;
    } catch {
      return null;
    }
  }

  /**
   * Returns metadata only. Does not decompress the SVG.
   */
  async getAssetRef(
    targetName: string,
    costumeName: string,
  ): Promise<SvgAssetRef> {
    const costume = await this.getCostume(targetName, costumeName);

    return {
      target: targetName,
      costume: costume.name,
      assetId: costume.assetId,
      file: costume.md5ext,
      dataFormat: costume.dataFormat,
      rotationCenterX: costume.rotationCenterX,
      rotationCenterY: costume.rotationCenterY,
    };
  }

  /**
   * Get SVG markup, normalized so Scratch costume gradients (hands/feet)
   * render in a browser <img> or inline SVG.
   */
  async getSvgText(
    targetName: string,
    costumeName: string,
    options: { keepNumeral?: boolean } = {},
  ): Promise<string> {
    const costume = await this.getCostume(targetName, costumeName);

    if (costume.dataFormat.toLowerCase() !== "svg") {
      throw new Error(
        `"${targetName}" / "${costumeName}" is ${costume.dataFormat}, not SVG.`,
      );
    }

    const file = await this.getZipAsset(costume);
    const svg = normalizeScratchSvg(await file.async("string"));
    const prepared = options.keepNumeral ? svg : stripCostumeNumeral(svg);
    return separateBlockSeams(prepared);
  }

  /**
   * Returns a Blob URL suitable for <img src="...">.
   *
   * URLs are cached by md5ext (and numeral mode), so repeated calls are
   * effectively free after first extraction.
   */
  async getSvgUrl(
    targetName: string,
    costumeName: string,
    options: { keepNumeral?: boolean } = {},
  ): Promise<string> {
    const costume = await this.getCostume(targetName, costumeName);

    if (costume.dataFormat.toLowerCase() !== "svg") {
      throw new Error(
        `"${targetName}" / "${costumeName}" is ${costume.dataFormat}, not SVG.`,
      );
    }

    const cacheKey = `${costume.md5ext}:${options.keepNumeral ? "raw" : "stripped"}`;
    const cached = this.blobUrlCache.get(cacheKey);
    if (cached) return cached;

    const svg = await this.getSvgText(targetName, costumeName, options);
    const url = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    );

    this.blobUrlCache.set(cacheKey, url);
    return url;
  }

  /**
   * Simple convenience accessor for the canonical 0–99 Numberblocks.
   *
   * Example:
   *   const seven = await assets.getNumberSvgUrl(7);
   */
  async getNumberSvgUrl(number: number): Promise<string> {
    if (!Number.isInteger(number) || number < 0 || number > 99) {
      throw new Error(
        "getNumberSvgUrl() is for direct 0–99 costumes. Use getNumberParts() for larger values.",
      );
    }

    return this.getSvgUrl("NBs//Ten + One", `n${number}`);
  }

  /**
   * UI-facing Numberblock lookup. Hides Scratch target/costume names.
   *
   * Prefers official named characters when the Scratch project has them,
   * then the generated 0–99 costumes, then place-group parts.
   */
  async getNumberblockUrl(
    number: number,
    options: { keepNumeral?: boolean } = {},
  ): Promise<string> {
    const asset = await this.getNumberblockAsset(number, options);
    return asset.url;
  }

  async getNumberblockAsset(
    number: number,
    options: { keepNumeral?: boolean } = {},
  ): Promise<NumberblockAsset> {
    if (!Number.isInteger(number) || number < 0) {
      throw new Error(`Expected a non-negative integer, got ${number}.`);
    }

    const resolved = await this.resolveNumberblockCostume(number);
    if (resolved) {
      return this.loadAsset(resolved.target, resolved.costume, options);
    }

    throw new Error(
      `No single Numberblock costume for ${number}. Use getNumberblockFigure().`,
    );
  }

  async getNumberblockFigure(
    number: number,
    options: { keepNumeral?: boolean } = {},
  ): Promise<NumberblockAsset[]> {
    const parts = splitOfficialAddends(number);
    if (parts.length === 0) {
      throw new Error(`No Numberblock visual for ${number}.`);
    }
    return Promise.all(
      parts.map((part) => this.getNumberblockAsset(part, options)),
    );
  }

  private async loadAsset(
    targetName: string,
    costumeName: string,
    options: { keepNumeral?: boolean } = {},
  ): Promise<NumberblockAsset> {
    const costume = await this.getCostume(targetName, costumeName);
    const cacheKey = `${costume.md5ext}:${options.keepNumeral ? "raw" : "stripped"}`;
    const svg = await this.getSvgText(targetName, costumeName, options);
    const size = viewBoxSize(svg);
    const cached = this.blobUrlCache.get(cacheKey);
    if (cached) return { url: cached, ...size };

    const url = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    );
    this.blobUrlCache.set(cacheKey, url);
    return { url, ...size };
  }

  /**
   * Resolve a single integer to the best Scratch target/costume.
   *
   * Order: official named face → FOF named face → large named costume →
   * generated `nN-fof` / `nN` for 0–99.
   */
  private async resolveNumberblockCostume(
    number: number,
  ): Promise<{ target: string; costume: string } | null> {
    const official = await this.resolveNamedCostume(OFFICIAL_TARGET, number);
    if (official) return { target: OFFICIAL_TARGET, costume: official };

    if (FOF_NAMED_VALUE_SET.has(number)) {
      const fof = await this.resolveNamedCostume(FOF_TARGET, number);
      if (fof) return { target: FOF_TARGET, costume: fof };
    }

    const large = LARGE_BY_VALUE.get(number);
    if (large && (await this.hasCostume(large.target, large.costume))) {
      return { target: large.target, costume: large.costume };
    }

    if (number <= 99) {
      const fofCostume = `n${number}-fof`;
      if (
        FOF_VALUE_SET.has(number) &&
        (await this.hasCostume("NBs//Ten + One", fofCostume))
      ) {
        return { target: "NBs//Ten + One", costume: fofCostume };
      }

      const plain = `n${number}`;
      if (await this.hasCostume("NBs//Ten + One", plain)) {
        return { target: "NBs//Ten + One", costume: plain };
      }
    }

    return null;
  }

  private async resolveNamedCostume(
    targetName: string,
    number: number,
  ): Promise<string | null> {
    const named = officialCostumeName(number);
    const candidates = [named, String(number), `n${number}`];

    for (const name of candidates) {
      if (name && (await this.hasCostume(targetName, name))) {
        return name;
      }
    }

    return null;
  }

  /**
   * Maps a large integer to the exact Scratch costume references required
   * for each populated decimal-place group.
   *
   * This intentionally does NOT try to position/compose the sprites.
   * It solves asset lookup only. Rendering/composition can be a separate,
   * small component.
   *
   * Examples:
   *
   *   7
   *   -> Ten + One / n7
   *
   *   234
   *   -> Hundreds / n2
   *   -> Ten + One / n34
   *
   *   12_345
   *   -> Ten T + Thousands / n12
   *   -> Hundreds / n3
   *   -> Ten + One / n45
   */
  async getNumberParts(
    value: number | bigint | string,
  ): Promise<NumberSvgPart[]> {
    const number = toBigInt(value);

    if (number < 0n) {
      throw new Error(
        "This canonical mapper currently covers the non-negative Numberblock sprites.",
      );
    }

    if (number > MAX_NUMBERBLOCK_VALUE) {
      throw new Error(
        `Value ${number} is above the canonical mapping limit ${MAX_NUMBERBLOCK_VALUE}.`,
      );
    }

    // Zero is a special case because every place-group chunk is zero.
    if (number === 0n) {
      const group = NUMBER_GROUPS[0];
      return [await this.resolveNumberPart(group, 0)];
    }

    const parts: NumberSvgPart[] = [];

    for (const group of NUMBER_GROUPS) {
      const chunk = Number((number / group.divisor) % group.base);
      if (chunk === 0) continue;

      parts.push(await this.resolveNumberPart(group, chunk));
    }

    // More natural for rendering/debugging: highest place first.
    parts.reverse();

    return parts;
  }

  private async resolveNumberPart(
    group: NumberGroupDefinition,
    chunk: number,
  ): Promise<NumberSvgPart> {
    const costumeName = `n${chunk}`;

    if (!(await this.hasCostume(group.target, costumeName))) {
      throw new Error(
        `Expected "${group.target}" to contain costume "${costumeName}", but it does not.`,
      );
    }

    const ref = await this.getAssetRef(group.target, costumeName);
    const url = await this.getSvgUrl(group.target, costumeName);

    return {
      ...ref,
      placeGroup: group.placeGroup,
      chunk,
      divisor: group.divisor,
      url,
    };
  }

  /**
   * Build a lightweight metadata index for debugging/tools.
   * This does not decompress any actual image files.
   */
  async buildSvgIndex(): Promise<Record<string, Record<string, SvgAssetRef>>> {
    await this.load();

    const result: Record<string, Record<string, SvgAssetRef>> = {};

    for (const [targetName, costumes] of this.costumes) {
      for (const costume of costumes.values()) {
        if (costume.dataFormat.toLowerCase() !== "svg") continue;

        result[targetName] ??= {};
        result[targetName][costume.name] = {
          target: targetName,
          costume: costume.name,
          assetId: costume.assetId,
          file: costume.md5ext,
          dataFormat: costume.dataFormat,
          rotationCenterX: costume.rotationCenterX,
          rotationCenterY: costume.rotationCenterY,
        };
      }
    }

    return result;
  }

  /**
   * Release all generated Blob URLs.
   * Normally call this only if you permanently discard the asset store.
   */
  dispose(): void {
    for (const url of this.blobUrlCache.values()) {
      URL.revokeObjectURL(url);
    }

    this.blobUrlCache.clear();
  }
}

/**
 * Optional singleton for a small app.
 *
 * Import this wherever needed:
 *
 *   import { numberblocksAssets } from "./numberblocksSb3";
 *
 *   const src = await numberblocksAssets.getNumberSvgUrl(7);
 */
export const numberblocksAssets = new ScratchSb3Assets();
