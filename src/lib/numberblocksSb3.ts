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
 *   // Growing times table (four spots, four rays):
 *   const fourTimes = await assets.getGrowingTimesTableUrl(4);
 *
 *   // Times Table character, standing or flying:
 *   const threeRay = await assets.getTimesTableCharacterUrl(3, "ray");
 *
 *   const resource = await assets.resource();
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
  currentCostume?: number;
  volume?: number;
  layerOrder?: number;
  tempo?: number;
  videoTransparency?: number;
  videoState?: string;
  textToSpeechLanguage?: string | null;
  blocks?: Record<string, unknown>;
  variables?: Record<string, unknown>;
  lists?: Record<string, unknown>;
  broadcasts?: Record<string, unknown>;
  comments?: Record<string, unknown>;

  // Sprite transform metadata. These fields are absent on the Stage.
  x?: number;
  y?: number;
  size?: number;
  direction?: number;
  visible?: boolean;
  rotationStyle?: string;
  draggable?: boolean;
};

export type ScratchMonitor = {
  id: string;
  mode: string;
  opcode: string;
  params: Record<string, unknown>;
  spriteName: string | null;
  value: unknown;
  visible: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  sliderMin?: number;
  sliderMax?: number;
  isDiscrete?: boolean;
};

export type ScratchNamedValue = {
  id: string;
  name: string;
  value: unknown;
};

export type ScratchBroadcast = {
  id: string;
  name: string;
};

/** One Scratch sprite, with costumes and sounds, and without script blocks. */
export type ScratchResourceTarget = {
  kind: "target";
  /** Full Scratch name, including a `Group//` prefix when it has one. */
  name: string;
  /** Name after the last `//`. */
  label: string;
  isStage: boolean;
  currentCostume?: number;
  volume?: number;
  layerOrder?: number;
  tempo?: number;
  videoTransparency?: number;
  videoState?: string;
  textToSpeechLanguage?: string | null;
  visible?: boolean;
  x?: number;
  y?: number;
  size?: number;
  direction?: number;
  draggable?: boolean;
  rotationStyle?: string;
  blockCount: number;
  commentCount: number;
  costumes: ScratchCostume[];
  sounds: ScratchSound[];
  variables: ScratchNamedValue[];
  lists: ScratchNamedValue[];
  broadcasts: ScratchBroadcast[];
};

/** A `Group//` folder. The project uses a single level, but the tree allows more. */
export type ScratchResourceFolder = {
  kind: "folder";
  name: string;
  children: ScratchResourceNode[];
};

export type ScratchResourceNode = ScratchResourceFolder | ScratchResourceTarget;

export type ScratchResource = {
  meta: {
    semver?: string;
    vm?: string;
    agent?: string;
  };
  extensions: unknown[];
  monitors: ScratchMonitor[];
  targetCount: number;
  costumeCount: number;
  soundCount: number;
  tree: ScratchResourceNode[];
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
  monitors?: ScratchMonitor[];
  extensions?: unknown[];
  meta?: ScratchResource["meta"];
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
const ONES_TARGET = "NBs//Ten + One";
/**
 * Costumes are named "01"…"20" and mean 10, 20, … 200.
 * Indexed after the official faces so Ten–One Hundred stay the TV drawings,
 * and before Large Numbers so 200 keeps this full-size costume.
 */
const TENS_PACK_TARGET = "assets//10";

/**
 * Named character packs, searched in this order.
 * The generator sprites (NBs//) are a fallback after these miss.
 */
const CHARACTER_TARGETS = [
  OFFICIAL_TARGET,
  "assets//Figured-Out Frenzy",
  TENS_PACK_TARGET,
  "assets//Large Numbers",
  "assets//Thousands (Small)",
  "assets//Ten Thousands",
  "assets//Hundred Thousands",
  "assets//Millions and more",
] as const;

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
 * `assets//10` names a count of tens: costume "01" is 10, "18" is 180, "20" is 200.
 * 10–190 are exact-only. 10–100 already have official faces (those win at
 * lookup); 110–190 must not break greedy splits such as 177 → 100+77.
 * 200 stays a round atom, using this full-size costume rather than the
 * miniature "Two Hundred" in Large Numbers.
 */
const TENS_PACK_COSTUMES: readonly NamedLargeCostume[] = Array.from(
  { length: 20 },
  (_, offset): NamedLargeCostume => {
    const count = offset + 1;
    return {
      value: count * 10,
      target: TENS_PACK_TARGET,
      costume: String(count).padStart(2, "0"),
      exactOnly: count !== 20,
    };
  },
);

/** Costume title on `assets//10`, or null when it is not "01"…"20". */
function tensPackCostumeValue(name: string): number | null {
  const match = /^(\d{2})$/.exec(name);
  if (!match) return null;
  const count = Number(match[1]);
  if (count < 1 || count > 20) return null;
  return count * 10;
}

/**
 * Named large-number costumes from the Scratch asset packs.
 * Round values participate in greedy splitting; odd specials are exact-only.
 */
const NAMED_LARGE_COSTUMES: readonly NamedLargeCostume[] = [
  ...TENS_PACK_COSTUMES,
  // Hundreds / round powers — assets//Large Numbers
  // 200 is the full-size assets//10 costume "20", not the miniature here.
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
 * counted. Stroke width is always `unit * BLOCK_SEAM_THICKNESS`.
 *
 * Large-number hundreds also draw hollow unit outlines (`fill="none"` with a
 * thin author stroke). Those are fewer than Hundred’s 10×10 grid, so we only
 * rewrite their width to the same rule — we do not invent new hollow seams
 * (that would catch brow/glass frames).
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
  // Official Hundred: many hollow unit squares need seams invented.
  const allowHollow = hollowAtUnit >= 9;

  // Large-number hundreds draw hollow outlines over solid cubes. Match those
  // outlines to the groove color of the solid unit cubes (e.g. Three Hundred’s
  // mustard #969623 overlays → same #4d4d4d as the yellow fills).
  const solidFills = atUnit
    .map((cube) => cube.fill)
    .filter((fill): fill is string => Boolean(fill) && fill !== "none");
  let overlaySeam: string | null = null;
  if (solidFills.length > 0) {
    const fillHist = new Map<string, number>();
    for (const fill of solidFills) {
      fillHist.set(fill, (fillHist.get(fill) ?? 0) + 1);
    }
    let modalFill = solidFills[0]!;
    let fillVotes = 0;
    for (const [fill, count] of fillHist) {
      if (count > fillVotes) {
        modalFill = fill;
        fillVotes = count;
      }
    }
    overlaySeam = seamColorForFill(modalFill);
  }

  const strokeWidth = unit * BLOCK_SEAM_THICKNESS;
  const strokeWidthAttr = `stroke-width="${strokeWidth.toFixed(3)}"`;

  return svg.replace(pathRe, (full, attrs: string) => {
    const cube = cubeFromAttrs(attrs);
    if (
      !cube ||
      Math.abs(cube.width - unit) > unit * 0.08 ||
      Math.abs(cube.height - unit) > unit * 0.08
    ) {
      return full;
    }

    const hollow = cube.fill === "none" || cube.fill === undefined;
    const authorStrokeWidth = attrs.match(/\bstroke-width\s*=\s*"([^"]*)"/i)?.[1];
    const authorStroke = attrs.match(/\bstroke\s*=\s*"([^"]*)"/i)?.[1];
    const parsedAuthorWidth =
      authorStrokeWidth !== undefined
        ? Number.parseFloat(authorStrokeWidth)
        : undefined;
    const hasVisibleAuthorStroke =
      (parsedAuthorWidth !== undefined && parsedAuthorWidth > 0) ||
      (authorStroke !== undefined &&
        authorStroke.toLowerCase() !== "none" &&
        parsedAuthorWidth !== 0);

    if (hollow && !allowHollow) {
      // Stroked hollow unit overlays (Two/Three/Five Hundred, …).
      if (!hasVisibleAuthorStroke) return full;
      const seam =
        overlaySeam ??
        (authorStroke ? seamColorForFill(authorStroke) : "#5a1e22");
      let next = attrs;
      if (/\bstroke-width\s*=/.test(next)) {
        next = next.replace(/\bstroke-width\s*=\s*"[^"]*"/i, strokeWidthAttr);
      } else {
        next += ` ${strokeWidthAttr}`;
      }
      if (/\bstroke\s*=/.test(next)) {
        next = next.replace(/\bstroke\s*=\s*"[^"]*"/i, `stroke="${seam}"`);
      } else {
        next += ` stroke="${seam}"`;
      }
      return `<path${next}>`;
    }

    const seam = seamColorForFill(cube.fill);
    let next = attrs;
    if (/\bstroke-width\s*=/.test(next)) {
      next = next.replace(/\bstroke-width\s*=\s*"[^"]*"/i, strokeWidthAttr);
    } else if (/\bstroke\s*=/.test(next)) {
      next = next.replace(
        /\bstroke\s*=\s*"[^"]*"/i,
        (stroke) => `${stroke} ${strokeWidthAttr}`,
      );
    } else {
      next += ` ${strokeWidthAttr}`;
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

function belowHundredName(number: number): string | null {
  if (number >= 0 && number < 20) return UNDER_TWENTY[number];
  if (number < 0 || number >= 100) return null;

  const tens = Math.floor(number / 10);
  const ones = number % 10;
  const tensName = TENS_NAMES[tens];
  if (!tensName) return null;
  if (ones === 0) return tensName;
  return `${tensName}-${UNDER_TWENTY[ones]}`;
}

function hundredGroupName(hundreds: number): string | null {
  if (hundreds < 1 || hundreds > 9) return null;
  if (hundreds === 1) return "One Hundred";
  return `${UNDER_TWENTY[hundreds]} Hundred`;
}

/**
 * Names the Scratch pack might use for an exact number.
 * 121 → "One Hundred and Twenty-One", "121", "n121", ...
 */
export function costumeNameCandidates(number: number): string[] {
  const names = new Set<string>([String(number), `n${number}`]);
  const below = belowHundredName(number);
  if (below) names.add(below);
  if (number === 100) names.add("One Hundred");

  if (number > 100 && number < 1000) {
    const head = hundredGroupName(Math.floor(number / 100));
    const rest = number % 100;
    if (head) {
      if (rest === 0) names.add(head);
      else {
        const tail = belowHundredName(rest);
        if (tail) {
          names.add(`${head} and ${tail}`);
          names.add(`${head} ${tail}`);
        }
      }
    }
  }

  return [...names];
}

const SMALL_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const MAGNITUDE_WORDS: Record<string, number> = {
  thousand: 1_000,
  million: 1_000_000,
  billion: 1_000_000_000,
  trillion: 1_000_000_000_000,
};

/** Parse a Scratch costume title such as "One Hundred and Twenty-One". */
export function parseCostumeNumber(name: string): number | null {
  const stripped = name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z\s-]/g, " ")
    .replace(/\band\b/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!stripped) return null;

  let total = 0;
  let current = 0;
  let used = 0;

  for (const word of stripped.split(" ")) {
    if (word === "hundred") {
      current = (current || 1) * 100;
      used += 1;
      continue;
    }
    const small = SMALL_WORDS[word];
    if (small !== undefined) {
      current += small;
      used += 1;
      continue;
    }
    const magnitude = MAGNITUDE_WORDS[word];
    if (magnitude !== undefined) {
      current = (current || 1) * magnitude;
      total += current;
      current = 0;
      used += 1;
      continue;
    }
    return null;
  }

  if (used === 0) return null;
  return total + current;
}

function costumePreference(name: string): number {
  const lower = name.toLowerCase();
  if (/\(old\)/.test(lower)) return 4;
  if (/\(compound\)/.test(lower)) return 3;
  if (name.includes("(")) return 2;
  return 1;
}

/** TV-official 0–100 characters (not Figured-Out Frenzy). */
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
 * included so 200 stays the full-size tens-pack costume instead of 100+100.
 * Exact tens 110–190 are characters too, but they are not greedy pieces.
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
 * Place-value chunks matching the Scratch generator sprites.
 * 121 → 100 + 21 (hundreds n1 beside tens-and-ones n21).
 */
export function placeValueParts(value: number): number[] {
  if (!Number.isInteger(value) || value < 0) return [];
  if (value === 0) return [0];

  const number = BigInt(value);
  const parts: number[] = [];
  for (const group of NUMBER_GROUPS) {
    const chunk = Number((number / group.divisor) % group.base);
    if (chunk === 0) continue;
    parts.push(Number(BigInt(chunk) * group.divisor));
  }
  parts.reverse();
  return parts;
}

/**
 * Split a number into Numberblock character addends.
 *
 * A known character stays one figure — official faces, Figured-Out Frenzy
 * characters, and named large costumes — so 77 stays 77 and 0–99 are never
 * Forty + One. Other values use those characters as atoms: 144 → 100+44,
 * not 100+42+2, 180 stays the tens-pack costume instead of 100+80, and
 * 200 stays that full-size costume instead of 100+100.
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
  const parsed = parseViewBox(match[1]);
  if (!parsed) return { width: 1, height: 1 };
  return { width: parsed.width, height: parsed.height };
}

const SHAPE_SELECTOR = "path, ellipse, circle, rect, polygon, polyline";

function parseViewBox(value: string | null): {
  x: number;
  y: number;
  width: number;
  height: number;
} | null {
  if (!value) return null;
  const box = value.trim().split(/[\s,]+/).map(Number);
  if (
    box.length !== 4 ||
    box.some((n) => !Number.isFinite(n)) ||
    box[2] <= 0 ||
    box[3] <= 0
  ) {
    return null;
  }
  return { x: box[0], y: box[1], width: box[2], height: box[3] };
}

function fillOf(el: Element): string {
  return (el.getAttribute("fill") ?? "").trim();
}

function isUrlFill(fill: string): boolean {
  return /^url\(/i.test(fill);
}

function markShape(el: Element, part: "limb" | "face" | "numeral"): void {
  if (!el.getAttribute("data-part")) el.setAttribute("data-part", part);
}

/** Fill on this element, or the nearest ancestor that sets one. */
function resolvedFill(el: Element): string {
  let current: Element | null = el;
  while (current) {
    const fill = (current.getAttribute("fill") ?? "").trim();
    if (fill) return fill;
    current = current.parentElement;
  }
  return "";
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/**
 * Cube edge length. A repeated grid wins over one big outline, and
 * tiny details (pips, pupils) lose on painted area.
 */
function dominantBlockUnit(shapes: Element[]): number | null {
  const clusters = new Map<number, number[]>();
  for (const el of shapes) {
    if (isUrlFill(resolvedFill(el))) continue;
    const bounds = shapeBounds(el);
    if (!bounds) continue;
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const minSide = Math.min(width, height);
    const maxSide = Math.max(width, height);
    if (minSide < 1 || maxSide / minSide > 1.08) continue;
    if (isBlackFill(resolvedFill(el))) continue;
    const side = (width + height) / 2;
    const bin = Math.round(side * 2) / 2;
    const sizes = clusters.get(bin) ?? [];
    sizes.push(side);
    clusters.set(bin, sizes);
  }

  const ranked = [...clusters.values()].map((sizes) => ({
    count: sizes.length,
    area: sizes.reduce((sum, side) => sum + side * side, 0),
    unit: median(sizes),
  }));
  const repeated = ranked.filter((entry) => entry.count >= 2);
  const pool = repeated.length > 0 ? repeated : ranked;
  let best: { count: number; area: number; unit: number } | null = null;
  for (const entry of pool) {
    if (!best || entry.area > best.area) best = entry;
  }
  return best && best.unit >= 1 ? best.unit : null;
}

function matchesBlockLength(length: number, unit: number, steps: number): boolean {
  // Tight: real cubes sit on the grid. Eyes and gloves are a little off.
  return Math.abs(length - steps * unit) <= unit * 0.035;
}

function isHollowFill(fill: string): boolean {
  return !fill || fill === "none";
}

/** One cube, or a straight row/column of cubes, including a side face. */
function isBlockShape(bounds: PathBox, unit: number): boolean {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const across = (length: number) => {
    const steps = Math.round(length / unit);
    return steps >= 1 && matchesBlockLength(length, unit, steps);
  };
  const edge = (length: number) => matchesBlockLength(length, unit, 1);
  return (edge(width) && across(height)) || (edge(height) && across(width));
}

/** Hundred paints a 10×10 of hollow unit squares over a parent fill. */
function allowHollowUnitBlocks(shapes: Element[], unit: number): boolean {
  let count = 0;
  for (const el of shapes) {
    if (!isHollowFill(resolvedFill(el))) continue;
    const bounds = shapeBounds(el);
    if (!bounds) continue;
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    if (
      matchesBlockLength(width, unit, 1) &&
      matchesBlockLength(height, unit, 1)
    ) {
      count += 1;
      if (count >= 9) return true;
    }
  }
  return false;
}

function shapeBounds(el: Element): PathBox | null {
  const d = el.getAttribute("d");
  if (d) return pathBBox(d);
  const x = Number(el.getAttribute("x") ?? el.getAttribute("cx") ?? 0);
  const y = Number(el.getAttribute("y") ?? el.getAttribute("cy") ?? 0);
  const radius = Number(el.getAttribute("r") ?? 0);
  const width = Number(el.getAttribute("width") ?? (radius ? radius * 2 : 0));
  const height = Number(el.getAttribute("height") ?? (radius ? radius * 2 : 0));
  if (![x, y, width, height].every(Number.isFinite) || (width <= 0 && height <= 0)) {
    return null;
  }
  return { minX: x, minY: y, maxX: x + width, maxY: y + height };
}

function unionBoxes(boxes: PathBox[]): PathBox | null {
  if (boxes.length === 0) return null;
  return {
    minX: Math.min(...boxes.map((box) => box.minX)),
    minY: Math.min(...boxes.map((box) => box.minY)),
    maxX: Math.max(...boxes.map((box) => box.maxX)),
    maxY: Math.max(...boxes.map((box) => box.maxY)),
  };
}

export type NumberblockScene = {
  svg: string;
  width: number;
  height: number;
  viewX: number;
  viewY: number;
  body: { x: number; y: number; width: number; height: number };
  /** Detected cube edge in SVG units; null when the costume has no grid. */
  unit: number | null;
  /** Near-square block shapes tagged as the cube body (meta or ones). */
  squareCount: number;
};

function sceneFromSvg(svg: string): NumberblockScene {
  const match = svg.match(/viewBox\s*=\s*"([^"]+)"/i);
  const view = parseViewBox(match?.[1] ?? null) ?? {
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  };
  return {
    svg,
    width: view.width,
    height: view.height,
    viewX: view.x,
    viewY: view.y,
    body: { x: view.x, y: view.y, width: view.width, height: view.height },
    unit: null,
    squareCount: 0,
  };
}

function sceneMetaUnit(scene: NumberblockScene): number {
  return scene.unit && scene.unit > 0
    ? scene.unit
    : Math.max(
        1,
        Math.min(scene.body.width, scene.body.height) /
          Math.max(1, Math.round(Math.sqrt(Math.max(scene.body.width, 1)))),
      );
}

/**
 * Ones-per-meta edge (10 for a hundred-block, else 1).
 * When the layout box is expanded to ones, SVG strokes must be divided by
 * this or meta costumes look ~10× heavier than Ten/Three beside them.
 */
export function sceneMetaOnesEdge(
  scene: NumberblockScene,
  partValue?: number,
): number {
  if (partValue === undefined || !(partValue > 0)) return 1;
  const unit = sceneMetaUnit(scene);
  const wide = scene.body.width / unit;
  const tall = scene.body.height / unit;
  const metaArea = Math.max(wide * tall, 0.01);
  const valuePerMeta = partValue / metaArea;
  const edge = Math.round(Math.sqrt(valuePerMeta));
  if (
    edge >= 2 &&
    Math.abs(edge * edge - valuePerMeta) <= Math.max(2, valuePerMeta * 0.2)
  ) {
    return edge;
  }
  return 1;
}

/**
 * Shrink stroke widths when a meta costume is displayed at ones footprint
 * so grooves match `BLOCK_SEAM_THICKNESS` ones cubes on screen.
 */
export function scaleSvgStrokesForOnesEdge(svg: string, edge: number): string {
  if (!(edge > 1.01)) return svg;
  return svg.replace(
    /\bstroke-width\s*=\s*"([^"]*)"/gi,
    (full, raw: string) => {
      const width = Number.parseFloat(raw);
      if (!(width > 0)) return full;
      return `stroke-width="${(width / edge).toFixed(4)}"`;
    },
  );
}

/**
 * Body size in **one-cube** units from a decorated scene.
 *
 * Large-number costumes (e.g. Five Hundred) often draw meta-blocks: each
 * detected square is a hundred, so raw body/unit ≈ 1×5 for 500. When the
 * part value is known and each meta-cell holds a square pack of ones
 * (100 → 10×10, 1000 →  ~31.6², …), expand to ones so Proportional scale
 * matches Fifty’s ones beside Five Hundred.
 */
export function sceneCubeUnits(
  scene: NumberblockScene,
  partValue?: number,
): {
  wide: number;
  tall: number;
} {
  const unit = sceneMetaUnit(scene);
  const wide = scene.body.width / unit;
  const tall = scene.body.height / unit;
  const edge = sceneMetaOnesEdge(scene, partValue);
  if (edge > 1) {
    return { wide: wide * edge, tall: tall * edge };
  }
  return { wide, tall };
}

function isWhiteFill(fill: string): boolean {
  const value = fill.trim().toLowerCase();
  return value === "#fff" || value === "#ffffff" || value === "white";
}

/** Costumes with no cube grid (Zero) still hide an obvious drawn face. */
function tagLooseFace(
  groups: Element[],
  view: { width: number; height: number },
): void {
  for (const group of groups) {
    const local = [...group.querySelectorAll(SHAPE_SELECTOR)];
    if (local.length === 0 || local.length > 6) continue;
    const unmarked = local.filter((el) => !el.getAttribute("data-part"));
    if (unmarked.length === 0) continue;
    const fills = unmarked.map((el) => fillOf(el));
    const hasWhite = fills.some((fill) => isWhiteFill(fill));
    const hasBlack = fills.some((fill) => isBlackFill(fill));
    const union = unionBoxes(
      unmarked
        .map((el) => shapeBounds(el))
        .filter((box): box is PathBox => box !== null),
    );
    const width = union ? union.maxX - union.minX : 0;
    const height = union ? union.maxY - union.minY : 0;
    const small = width < view.width * 0.55 && height < view.height * 0.32;
    if (small || (hasWhite && hasBlack)) {
      for (const el of unmarked) markShape(el, "face");
    }
  }
}

function tagOverlayNumerals(
  shapes: Element[],
  view: { x: number; y: number; width: number; height: number },
): void {
  for (const el of shapes) {
    if (el.getAttribute("data-part")) continue;
    const bounds = shapeBounds(el);
    if (!isBlackFill(fillOf(el)) || !bounds) continue;
    const fromTop = bounds.minY - view.y;
    const height = bounds.maxY - bounds.minY;
    const width = bounds.maxX - bounds.minX;
    const overlayBand = Math.max(24, view.height * 0.42);
    if (
      fromTop <= overlayBand &&
      height >= 6 &&
      width >= 1.2 &&
      height <= view.height * 0.45 &&
      width <= view.width * 0.55
    ) {
      markShape(el, "numeral");
    }
  }
}

/**
 * Tag costume paths so a table cell shows only the block shape.
 * Eyes, pupils, glasses, brows, hair, crowns and limbs are marked so the
 * cell can hide them. The cubes stay put, so the cell does not change size.
 */
export function decorateCostumeLife(svg: string): NumberblockScene {
  const Parser = globalThis.DOMParser;
  const Serializer = globalThis.XMLSerializer;
  if (typeof Parser === "undefined" || typeof Serializer === "undefined") {
    return sceneFromSvg(svg);
  }

  const doc = new Parser().parseFromString(svg, "image/svg+xml");
  const root = doc.documentElement;
  if (root.querySelector("parsererror")) return sceneFromSvg(svg);

  const view =
    parseViewBox(root.getAttribute("viewBox")) ?? sceneFromSvg(svg).body;
  const shapes = [...root.querySelectorAll(SHAPE_SELECTOR)];
  const unit = dominantBlockUnit(shapes);
  const blocks = new Set<Element>();
  if (unit) {
    const hollowOk = allowHollowUnitBlocks(shapes, unit);
    for (const el of shapes) {
      const fill = resolvedFill(el);
      if (isUrlFill(fill) || isBlackFill(fill)) continue;
      const bounds = shapeBounds(el);
      if (!bounds || !isBlockShape(bounds, unit)) continue;
      // Stroked brow/glass frames are often 1×2 hollow rects on the grid.
      // Only Hundred's hollow unit squares count as blocks.
      if (isHollowFill(fill)) {
        const width = bounds.maxX - bounds.minX;
        const height = bounds.maxY - bounds.minY;
        if (
          !hollowOk ||
          !matchesBlockLength(width, unit, 1) ||
          !matchesBlockLength(height, unit, 1)
        ) {
          continue;
        }
      }
      blocks.add(el);
    }
  }

  for (const el of shapes) {
    if (blocks.has(el)) continue;
    if (isUrlFill(resolvedFill(el))) markShape(el, "limb");
  }

  const groups = [...root.querySelectorAll("g")].reverse();
  for (const group of groups) {
    const local = [...group.querySelectorAll(SHAPE_SELECTOR)];
    if (!local.some((el) => isUrlFill(resolvedFill(el)))) continue;
    const union = unionBoxes(
      local
        .map((el) => shapeBounds(el))
        .filter((box): box is PathBox => box !== null),
    );
    if (!union) continue;
    const width = union.maxX - union.minX;
    const height = union.maxY - union.minY;
    // Arms and legs sit around the cubes. A group that is the whole
    // character (Hundred's grid plus limbs) must not swallow the blocks.
    if (width < view.width * 0.72 && height < view.height * 0.6) {
      for (const el of local) {
        if (!blocks.has(el)) markShape(el, "limb");
      }
    }
  }

  if (unit && blocks.size > 0) {
    const blockTops = [...blocks]
      .map((el) => shapeBounds(el))
      .filter((box): box is PathBox => box !== null);
    const blockTop = Math.min(...blockTops.map((box) => box.minY));
    for (const el of shapes) {
      if (blocks.has(el) || el.getAttribute("data-part")) continue;
      if (!isBlackFill(resolvedFill(el))) continue;
      const bounds = shapeBounds(el);
      // Digits float above the stack. Pupils and mouths sit on the cubes.
      if (bounds && bounds.maxY <= blockTop + unit * 0.35) {
        markShape(el, "numeral");
      }
    }
    for (const el of shapes) {
      if (blocks.has(el) || el.getAttribute("data-part")) continue;
      markShape(el, "face");
    }
  } else {
    tagLooseFace(groups, view);
    tagOverlayNumerals(shapes, view);
  }

  const bodyBoxes: PathBox[] = [];
  for (const el of shapes) {
    const part = el.getAttribute("data-part");
    if (part === "limb" || part === "face" || part === "numeral") continue;
    const bounds = shapeBounds(el);
    if (bounds) bodyBoxes.push(bounds);
  }

  let body = {
    x: view.x,
    y: view.y,
    width: view.width,
    height: view.height,
  };
  const union = unionBoxes(bodyBoxes);
  if (union) {
    const pad = Math.max(
      0.4,
      Math.min(union.maxX - union.minX, union.maxY - union.minY) * 0.04,
    );
    body = {
      x: union.minX - pad,
      y: union.minY - pad,
      width: union.maxX - union.minX + pad * 2,
      height: union.maxY - union.minY + pad * 2,
    };
  }

  root.setAttribute("overflow", "visible");
  return {
    svg: new Serializer().serializeToString(root),
    width: view.width,
    height: view.height,
    viewX: view.x,
    viewY: view.y,
    body,
    unit,
    squareCount: blocks.size,
  };
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

/** Sprite that holds Times Table characters and the growing multiplication table. */
export const TIMES_TABLES_TARGET = "assets//Times Tables";

export type TimesTablePose = "legs" | "ray";

/** A rectangle in a costume's own viewBox, before Scratch normalization. */
export type TimesTableFrame = {
  target: typeof TIMES_TABLES_TARGET;
  costume: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Distance between the standing drawing and the flying drawing
 * on a paired Times Table costume. The ray is the legs, shifted right.
 */
const TIMES_TABLE_POSE_SHIFT = 90;

const GROWING_ROW_PITCH = 75;
const GROWING_SLOT_WIDTH = 45;

/**
 * Each row is one multiplier: a red bar, that many colored spots, that many rays.
 * 1–6 share `table sizes 1x-6x`; 7–12 share `table sizes 7x-12x`.
 * The widest row fills the costume, and each smaller multiplier is one slot narrower.
 */
const GROWING_TIMES_TABLE_SHEETS = [
  {
    costume: "table sizes 1x-6x",
    min: 1,
    max: 6,
    sheetWidth: 274.08542,
    rowHeight: 72.99979,
  },
  {
    costume: "table sizes 7x-12x",
    min: 7,
    max: 12,
    sheetWidth: 544.08547,
    rowHeight: 72.99984,
  },
] as const;

const FLY_ONLY_TIMES_TABLE = "Nineteen Times Table (Fly)";

export type TimesTableCharacterRef = {
  target: typeof TIMES_TABLES_TARGET;
  costume: string;
  pose: TimesTablePose;
  /**
   * Where that pose sits on the costume.
   * Paired sheets are legs on the left and ray on the right.
   * Nineteen is a single flying drawing.
   */
  span: "left" | "right" | "full";
};

/**
 * Growing multiplication table for multipliers 1–12.
 * Returns the viewBox crop of that row, or null outside the range.
 */
export function growingTimesTable(multiplier: number): TimesTableFrame | null {
  if (!Number.isInteger(multiplier)) return null;
  const sheet = GROWING_TIMES_TABLE_SHEETS.find(
    (entry) => multiplier >= entry.min && multiplier <= entry.max,
  );
  if (!sheet) return null;

  const width =
    sheet.sheetWidth - (sheet.max - multiplier) * GROWING_SLOT_WIDTH;
  return {
    target: TIMES_TABLES_TARGET,
    costume: sheet.costume,
    x: (sheet.sheetWidth - width) / 2,
    y: (multiplier - sheet.min) * GROWING_ROW_PITCH,
    width,
    height: sheet.rowHeight,
  };
}

/**
 * Times Table character for a multiplier.
 *
 * 1–18 each have one costume: standing legs on the left, flying ray on the right.
 * 19 is flying only. Costumes named `N Times Table2` put a different character
 * on the ray side, so they are not used.
 */
export function timesTableCharacter(
  multiplier: number,
  pose: TimesTablePose,
): TimesTableCharacterRef | null {
  if (!Number.isInteger(multiplier)) return null;

  if (multiplier >= 1 && multiplier <= 18) {
    return {
      target: TIMES_TABLES_TARGET,
      costume: `${multiplier} Times Table`,
      pose,
      span: pose === "legs" ? "left" : "right",
    };
  }

  if (multiplier === 19 && pose === "ray") {
    return {
      target: TIMES_TABLES_TARGET,
      costume: FLY_ONLY_TIMES_TABLE,
      pose,
      span: "full",
    };
  }

  return null;
}

function cropSvgViewBox(
  svg: string,
  crop: { x: number; y: number; width: number; height: number },
): string {
  const viewBox = `${crop.x} ${crop.y} ${crop.width} ${crop.height}`;
  return svg.replace(/<svg\b[^>]*>/i, (open) => {
    let next = /viewBox\s*=/i.test(open)
      ? open.replace(/viewBox\s*=\s*"[^"]*"/i, `viewBox="${viewBox}"`)
      : open.replace(/>$/, ` viewBox="${viewBox}">`);
    next = next.replace(/\bwidth="[^"]*"/i, `width="${crop.width}"`);
    next = next.replace(/\bheight="[^"]*"/i, `height="${crop.height}"`);
    return next;
  });
}

function scratchNamedValues(
  record: Record<string, unknown> | undefined,
): ScratchNamedValue[] {
  if (!record) return [];
  const values: ScratchNamedValue[] = [];
  for (const [id, raw] of Object.entries(record)) {
    if (!Array.isArray(raw) || typeof raw[0] !== "string") continue;
    values.push({ id, name: raw[0], value: raw[1] });
  }
  return values;
}

function scratchBroadcasts(
  record: Record<string, unknown> | undefined,
): ScratchBroadcast[] {
  if (!record) return [];
  const broadcasts: ScratchBroadcast[] = [];
  for (const [id, name] of Object.entries(record)) {
    if (typeof name === "string") broadcasts.push({ id, name });
  }
  return broadcasts;
}

function copyCostume(costume: ScratchCostume): ScratchCostume {
  return { ...costume };
}

function copySound(sound: ScratchSound): ScratchSound {
  return { ...sound };
}

function costumeMime(format: string): string {
  switch (format.toLowerCase()) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "svg":
      return "image/svg+xml";
    case "gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

function timesTableFrameFromSpan(
  ref: TimesTableCharacterRef,
  box: { x: number; y: number; width: number; height: number },
): TimesTableFrame {
  if (ref.span === "full" || box.width <= TIMES_TABLE_POSE_SHIFT) {
    return { target: ref.target, costume: ref.costume, ...box };
  }

  const width = box.width - TIMES_TABLE_POSE_SHIFT;
  const x = ref.span === "right" ? box.x + TIMES_TABLE_POSE_SHIFT : box.x;
  return {
    target: ref.target,
    costume: ref.costume,
    x,
    y: box.y,
    width,
    height: box.height,
  };
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
  private sceneCache = new Map<string, NumberblockScene>();
  private namedByNumber = new Map<number, { target: string; costume: string }>();

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

    this.indexNamedCostumes();
  }

  private indexNamedCostumes(): void {
    this.namedByNumber.clear();

    for (const targetName of CHARACTER_TARGETS) {
      const costumes = this.costumes.get(targetName);
      if (!costumes) continue;

      for (const costume of costumes.values()) {
        if (costume.dataFormat.toLowerCase() !== "svg") continue;
        const value =
          targetName === TENS_PACK_TARGET
            ? tensPackCostumeValue(costume.name)
            : parseCostumeNumber(costume.name);
        if (value === null) continue;

        const existing = this.namedByNumber.get(value);
        if (
          existing &&
          (existing.target !== targetName ||
            costumePreference(existing.costume) <=
              costumePreference(costume.name))
        ) {
          continue;
        }

        this.namedByNumber.set(value, {
          target: targetName,
          costume: costume.name,
        });
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

  /**
   * Plays the pack clip `n{value}` when present (0–100).
   * Returns false when the value is out of range or the sound is missing —
   * callers can fall back to text-to-speech.
   */
  async playNumberName(value: number): Promise<boolean> {
    if (!Number.isInteger(value) || value < 0 || value > 100) return false;
    await this.load();
    if (!this.soundsByName.has(`n${value}`)) return false;
    await this.playSound(`n${value}`);
    return true;
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
   * Blob URL for any costume, SVG or bitmap.
   * SVG goes through getSvgUrl(), so `keepNumeral` matches that function.
   */
  async getCostumeUrl(
    targetName: string,
    costumeName: string,
    options: { keepNumeral?: boolean } = {},
  ): Promise<string> {
    const costume = await this.getCostume(targetName, costumeName);
    if (costume.dataFormat.toLowerCase() === "svg") {
      return this.getSvgUrl(targetName, costumeName, options);
    }

    const cacheKey = `file:${costume.md5ext}`;
    const cached = this.blobUrlCache.get(cacheKey);
    if (cached) return cached;

    const file = await this.getZipAsset(costume);
    const bytes = await file.async("arraybuffer");
    const url = URL.createObjectURL(
      new Blob([bytes], { type: costumeMime(costume.dataFormat) }),
    );
    this.blobUrlCache.set(cacheKey, url);
    return url;
  }

  /** Unprocessed SVG text from the ZIP, before numeral stripping or seams. */
  async getCostumeSource(
    targetName: string,
    costumeName: string,
  ): Promise<string> {
    return this.rawCostumeSvg(targetName, costumeName);
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
   * Growing multiplication table for multipliers 1–12.
   * One red bar, that many colored spots, that many rays.
   */
  async getGrowingTimesTableUrl(multiplier: number): Promise<string> {
    const frame = growingTimesTable(multiplier);
    if (!frame) {
      throw new Error(
        `No growing times table for ${multiplier}. Multipliers 1–12 are in the pack.`,
      );
    }
    return this.croppedCostumeUrl(frame);
  }

  /**
   * Times Table character. `legs` is standing; `ray` is the flying rocket.
   * 1–18 have both. 19 is ray only.
   */
  async getTimesTableCharacterUrl(
    multiplier: number,
    pose: TimesTablePose,
  ): Promise<string> {
    const ref = timesTableCharacter(multiplier, pose);
    if (!ref) {
      throw new Error(
        `No ${pose} Times Table for ${multiplier}. Legs cover 1–18; the ray covers 1–19.`,
      );
    }

    const raw = await this.rawCostumeSvg(ref.target, ref.costume);
    const open = raw.match(/<svg\b[^>]*>/i)?.[0] ?? "";
    const box = parseViewBox(open.match(/viewBox\s*=\s*"([^"]+)"/i)?.[1] ?? null);
    if (!box) {
      throw new Error(
        `Times Table costume "${ref.costume}" has no viewBox to crop.`,
      );
    }

    return this.croppedCostumeUrl(timesTableFrameFromSpan(ref, box));
  }

  private async rawCostumeSvg(
    targetName: string,
    costumeName: string,
  ): Promise<string> {
    const costume = await this.getCostume(targetName, costumeName);
    if (costume.dataFormat.toLowerCase() !== "svg") {
      throw new Error(
        `"${targetName}" / "${costumeName}" is ${costume.dataFormat}, not SVG.`,
      );
    }
    const file = await this.getZipAsset(costume);
    return file.async("string");
  }

  private async croppedCostumeUrl(frame: TimesTableFrame): Promise<string> {
    const costume = await this.getCostume(frame.target, frame.costume);
    const cacheKey = `${costume.md5ext}:crop:${frame.x},${frame.y},${frame.width},${frame.height}`;
    const cached = this.blobUrlCache.get(cacheKey);
    if (cached) return cached;

    const raw = await this.rawCostumeSvg(frame.target, frame.costume);
    const svg = normalizeScratchSvg(cropSvgViewBox(raw, frame));
    const url = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    );
    this.blobUrlCache.set(cacheKey, url);
    return url;
  }

  /**
   * UI-facing Numberblock lookup. Hides Scratch target/costume names.
   *
   * A single costume is resolved as an official face, then a Figured-Out
   * Frenzy face, then a named large costume, then a generated 0–99 sprite
   * (preferring the -fof variant). Composite numbers use
   * getNumberblockFigure(); table cells use getNumberblockScene().
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
    await this.load();
    const parts = splitOfficialAddends(number);
    if (parts.length === 0) {
      throw new Error(`No Numberblock visual for ${number}.`);
    }
    return Promise.all(
      parts.map((part) => this.getNumberblockAsset(part, options)),
    );
  }

  /**
   * Official (or generated) SVG with limbs, face and numeral tagged so
   * a cell can keep cube size and fade life on.
   *
   * Uses the same character split as getNumberblockFigure() (e.g. 141 →
   * One Hundred + Forty-One), not place-value generator sprites — those
   * miniatures break shared cube scale in Proportional view.
   */
  async getNumberblockScene(number: number): Promise<NumberblockScene[]> {
    await this.load();
    const parts = splitOfficialAddends(number);
    if (parts.length === 0) {
      throw new Error(`No Numberblock visual for ${number}.`);
    }
    return Promise.all(
      parts.map(async (part) => {
        const resolved = await this.resolveNumberblockCostume(part);
        if (!resolved) {
          throw new Error(`No Numberblock costume for part ${part} of ${number}.`);
        }
        return this.loadSceneCostume(resolved.target, resolved.costume);
      }),
    );
  }

  private async loadSceneCostume(
    target: string,
    costumeName: string,
  ): Promise<NumberblockScene> {
    const costume = await this.getCostume(target, costumeName);
    const cacheKey = `${costume.md5ext}:scene`;
    const cached = this.sceneCache.get(cacheKey);
    if (cached) return cached;

    const svg = await this.getSvgText(target, costumeName, {
      keepNumeral: true,
    });
    const scene = decorateCostumeLife(svg);
    this.sceneCache.set(cacheKey, scene);
    return scene;
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
   * generated `nN-fof` / `nN` for 0–99 → any other named costume the
   * pack index discovered.
   */
  private async resolveNumberblockCostume(
    number: number,
  ): Promise<{ target: string; costume: string } | null> {
    const official = await this.costumeNameOnTarget(OFFICIAL_TARGET, number);
    if (official) return { target: OFFICIAL_TARGET, costume: official };

    if (FOF_NAMED_VALUE_SET.has(number)) {
      const fof = await this.costumeNameOnTarget(FOF_TARGET, number);
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
        (await this.hasCostume(ONES_TARGET, fofCostume))
      ) {
        return { target: ONES_TARGET, costume: fofCostume };
      }

      const plain = `n${number}`;
      if (await this.hasCostume(ONES_TARGET, plain)) {
        return { target: ONES_TARGET, costume: plain };
      }
    }

    const indexed = this.namedByNumber.get(number);
    if (indexed && (await this.hasCostume(indexed.target, indexed.costume))) {
      return indexed;
    }

    return null;
  }

  private async costumeNameOnTarget(
    targetName: string,
    number: number,
  ): Promise<string | null> {
    for (const name of costumeNameCandidates(number)) {
      if (await this.hasCostume(targetName, name)) return name;
    }
    return null;
  }

  private async generatedCostumeName(
    targetName: string,
    chunk: number,
  ): Promise<string> {
    const figured = `n${chunk}-fof`;
    if (await this.hasCostume(targetName, figured)) return figured;
    return `n${chunk}`;
  }

  /**
   * Exact named character anywhere in the character packs.
   * Used by table scenes, which keep one costume when the pack has it
   * and otherwise fall through to generator place-value sprites.
   */
  private async resolveNamedCostume(
    number: number,
  ): Promise<{ target: string; costume: string } | null> {
    await this.load();

    const indexed = this.namedByNumber.get(number);
    if (indexed) return indexed;

    for (const targetName of CHARACTER_TARGETS) {
      for (const name of costumeNameCandidates(number)) {
        if (await this.hasCostume(targetName, name)) {
          return { target: targetName, costume: name };
        }
      }
    }

    return null;
  }

  /**
   * Exact named character if the pack has one; otherwise the generator
   * sprites that make this number (not other characters added together).
   */
  private async resolveNumberCostumes(
    number: number,
  ): Promise<{ target: string; costume: string }[]> {
    if (!Number.isInteger(number) || number < 0) return [];

    const named = await this.resolveNamedCostume(number);
    if (named) return [named];

    if (number <= 99) {
      return [
        {
          target: ONES_TARGET,
          costume: await this.generatedCostumeName(ONES_TARGET, number),
        },
      ];
    }

    const parts = await this.getNumberParts(number);
    return parts.map((part) => ({
      target: part.target,
      costume: part.costume,
    }));
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
    const costumeName = await this.generatedCostumeName(group.target, chunk);

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
   * The whole Scratch project as a folder tree.
   * `Group//Sprite` names become folders. Script blocks stay out of the
   * tree; `blockCount` is their count. Image bytes stay in the ZIP until
   * a costume URL is requested.
   */
  async resource(): Promise<ScratchResource> {
    await this.load();
    const project = this.project;
    if (!project) {
      throw new Error("Scratch project was not loaded.");
    }

    const roots: ScratchResourceNode[] = [];

    const ensureFolder = (
      nodes: ScratchResourceNode[],
      name: string,
    ): ScratchResourceFolder => {
      const found = nodes.find(
        (node): node is ScratchResourceFolder =>
          node.kind === "folder" && node.name === name,
      );
      if (found) return found;
      const folder: ScratchResourceFolder = {
        kind: "folder",
        name,
        children: [],
      };
      nodes.push(folder);
      return folder;
    };

    let costumeCount = 0;
    let soundCount = 0;

    for (const target of project.targets) {
      const parts = target.name.split("//");
      const label = parts.pop() || target.name;
      let nodes = roots;
      for (const part of parts) {
        if (!part) continue;
        nodes = ensureFolder(nodes, part).children;
      }

      const costumes = target.costumes.map(copyCostume);
      const sounds = (target.sounds ?? []).map(copySound);
      costumeCount += costumes.length;
      soundCount += sounds.length;

      nodes.push({
        kind: "target",
        name: target.name,
        label,
        isStage: target.isStage,
        currentCostume: target.currentCostume,
        volume: target.volume,
        layerOrder: target.layerOrder,
        tempo: target.tempo,
        videoTransparency: target.videoTransparency,
        videoState: target.videoState,
        textToSpeechLanguage: target.textToSpeechLanguage,
        visible: target.visible,
        x: target.x,
        y: target.y,
        size: target.size,
        direction: target.direction,
        draggable: target.draggable,
        rotationStyle: target.rotationStyle,
        blockCount: Object.keys(target.blocks ?? {}).length,
        commentCount: Object.keys(target.comments ?? {}).length,
        costumes,
        sounds,
        variables: scratchNamedValues(target.variables),
        lists: scratchNamedValues(target.lists),
        broadcasts: scratchBroadcasts(target.broadcasts),
      });
    }

    const sortNodes = (nodes: ScratchResourceNode[]) => {
      nodes.sort((a, b) => {
        const rank = (node: ScratchResourceNode) => {
          if (node.kind === "target" && node.isStage) return 0;
          if (node.kind === "folder") return 1;
          return 2;
        };
        const byKind = rank(a) - rank(b);
        if (byKind !== 0) return byKind;
        const aName = a.kind === "folder" ? a.name : a.label;
        const bName = b.kind === "folder" ? b.name : b.label;
        return aName.localeCompare(bName, undefined, { sensitivity: "base" });
      });
      for (const node of nodes) {
        if (node.kind === "folder") sortNodes(node.children);
      }
    };
    sortNodes(roots);

    return {
      meta: { ...project.meta },
      extensions: [...(project.extensions ?? [])],
      monitors: (project.monitors ?? []).map((monitor) => ({ ...monitor })),
      targetCount: project.targets.length,
      costumeCount,
      soundCount,
      tree: roots,
    };
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
