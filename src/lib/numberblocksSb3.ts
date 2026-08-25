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
 *   // Any costume in the Scratch project:
 *   const url = await assets.getSvgUrl("NBs//Ten + One", "n37");
 *
 *   // Decompose any supported large number into the Scratch sprites
 *   // that represent its decimal-place chunks:
 *   const parts = await assets.getNumberParts(1234);
 *   // [
 *   //   { target: "NBs//Ten T + Thousands", costume: "n1", ... },
 *   //   { target: "NBs//Hundreds",          costume: "n2", ... },
 *   //   { target: "NBs//Ten + One",         costume: "n34", ... }
 *   // ]
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

  // Sprite transform metadata. These fields are absent on the Stage.
  x?: number;
  y?: number;
  size?: number;
  direction?: number;
  visible?: boolean;
  rotationStyle?: string;
  layerOrder?: number;
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

  const box = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
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
  const unwrappedGroup = wrapperMatch[0].replace(TRANSLATE_RE, "").replace(
    /<g\s+/,
    "<g ",
  ).replace(/<g\s*>/, "<g>");

  return (
    svg.slice(0, svgOpenMatch.index) +
    svgOpen.replace(viewBoxMatch[0], `viewBox="${viewBox}"`) +
    afterOpen.slice(0, searchFrom) +
    wrapperSlice.replace(wrapperMatch[0], unwrappedGroup)
  );
}

type PathBox = { minX: number; minY: number; maxX: number; maxY: number }

function tokenizePath(d: string): Array<string | number> {
  const tokens: Array<string | number> = []
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(d))) {
    if (match[1]) tokens.push(match[1])
    else tokens.push(Number(match[2]))
  }
  return tokens
}

function pathBBox(d: string): PathBox | null {
  let cx = 0
  let cy = 0
  let sx = 0
  let sy = 0
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  const add = (x: number, y: number) => {
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }

  const tokens = tokenizePath(d)
  let i = 0
  let cmd = "M"

  while (i < tokens.length) {
    const token = tokens[i]
    if (typeof token === "string") {
      cmd = token
      i += 1
      continue
    }

    const rel = cmd === cmd.toLowerCase()
    const kind = cmd.toUpperCase()

    if (kind === "Z") {
      cx = sx
      cy = sy
      continue
    }

    if (kind === "M" || kind === "L" || kind === "T") {
      const x = tokens[i] as number
      const y = tokens[i + 1] as number
      i += 2
      cx = rel ? cx + x : x
      cy = rel ? cy + y : y
      if (kind === "M") {
        sx = cx
        sy = cy
      }
      add(cx, cy)
    } else if (kind === "H") {
      const x = tokens[i] as number
      i += 1
      cx = rel ? cx + x : x
      add(cx, cy)
    } else if (kind === "V") {
      const y = tokens[i] as number
      i += 1
      cy = rel ? cy + y : y
      add(cx, cy)
    } else if (kind === "C") {
      const p = tokens.slice(i, i + 6) as number[]
      i += 6
      for (let k = 0; k < 6; k += 2) {
        const x = rel ? cx + p[k] : p[k]
        const y = rel ? cy + p[k + 1] : p[k + 1]
        add(x, y)
        if (k === 4) {
          cx = x
          cy = y
        }
      }
    } else if (kind === "S" || kind === "Q") {
      const p = tokens.slice(i, i + 4) as number[]
      i += 4
      for (let k = 0; k < 4; k += 2) {
        const x = rel ? cx + p[k] : p[k]
        const y = rel ? cy + p[k + 1] : p[k + 1]
        add(x, y)
        if (k === 2) {
          cx = x
          cy = y
        }
      }
    } else if (kind === "A") {
      const p = tokens.slice(i, i + 7) as number[]
      i += 7
      cx = rel ? cx + p[5] : p[5]
      cy = rel ? cy + p[6] : p[6]
      add(cx, cy)
    } else {
      break
    }
  }

  if (!Number.isFinite(minX)) return null
  return { minX, minY, maxX, maxY }
}

function isBlackFill(fill: string | undefined): boolean {
  if (!fill) return false
  const value = fill.trim().toLowerCase()
  return value === "#000" || value === "#000000" || value === "black"
}

/**
 * Official costumes paint a large black numeral above the character.
 * The equation already shows that number, so drop the overlay and crop
 * the empty space it left behind.
 */
export function stripCostumeNumeral(svg: string): string {
  const svgOpenMatch = svg.match(/<svg\b[^>]*>/i)
  if (!svgOpenMatch) return svg

  const viewBoxMatch = svgOpenMatch[0].match(/viewBox\s*=\s*"([^"]+)"/i)
  if (!viewBoxMatch) return svg

  const box = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number)
  if (box.length !== 4 || box.some((n) => !Number.isFinite(n))) return svg
  const [, viewY, , viewH] = box

  const pathRe = /<path\b([^>]*)>(?:<\/path>)?/gi
  let stripped = svg.replace(pathRe, (full, attrs: string) => {
    const d = attrs.match(/\bd\s*=\s*"([^"]+)"/i)?.[1]
    const fill = attrs.match(/\bfill\s*=\s*"([^"]+)"/i)?.[1]
    if (!d || !isBlackFill(fill)) return full

    const bounds = pathBBox(d)
    if (!bounds) return full

    const height = bounds.maxY - bounds.minY
    const width = bounds.maxX - bounds.minX
    const fromTop = bounds.minY - viewY
    // Only drop overlay numerals that live entirely in the top band.
    // One's pupil is also a small black path, but it sits on the face.
    const overlayBand = Math.min(24, viewH * 0.38)
    const looksLikeDigit =
      height >= 8 &&
      height <= 22 &&
      height <= viewH * 0.35 &&
      width <= 16 &&
      fromTop >= -2 &&
      bounds.maxY <= viewY + overlayBand

    if (looksLikeDigit) return ""
    return full
  })

  const remaining: PathBox[] = []
  for (const match of stripped.matchAll(/<path\b([^>]*)>/gi)) {
    const d = match[1].match(/\bd\s*=\s*"([^"]+)"/i)?.[1]
    if (!d) continue
    const bounds = pathBBox(d)
    if (bounds) remaining.push(bounds)
  }
  if (remaining.length === 0) return svg

  const minY = Math.min(...remaining.map((b) => b.minY))
  const maxY = Math.max(...remaining.map((b) => b.maxY))
  const croppedHeight = maxY - minY
  if (!Number.isFinite(croppedHeight) || croppedHeight < 8) return stripped
  if (minY <= viewY + 1) return stripped

  const nextBox = `${box[0]} ${minY} ${box[2]} ${croppedHeight}`
  stripped = stripped.replace(viewBoxMatch[0], `viewBox="${nextBox}"`)
  return stripped.replace(
    /(<svg\b[^>]*\bheight=")([^"]+)(")/i,
    `$1${croppedHeight}$3`,
  )
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
] as const

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
] as const

function officialCostumeName(number: number): string | null {
  if (number === 100) return "One Hundred"
  if (number >= 0 && number < 20) return UNDER_TWENTY[number]
  if (number < 0 || number > 100) return null

  const tens = Math.floor(number / 10)
  const ones = number % 10
  const tensName = TENS_NAMES[tens]
  if (!tensName) return null
  if (ones === 0) return tensName
  return `${tensName}-${UNDER_TWENTY[ones]}`
}

/** Values that have a named official costume in the Scratch pack. */
export const OFFICIAL_NUMBERBLOCK_VALUES = [
  100, 90, 81, 80, 72, 70, 64, 63, 60, 56, 55, 54, 50, 49, 48, 45, 42, 40, 39,
  38, 37, 36, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20,
  19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0,
] as const

const OFFICIAL_VALUE_SET = new Set<number>(OFFICIAL_NUMBERBLOCK_VALUES)

/**
 * Split a number into official Numberblock characters.
 * 101 → One Hundred + One, not the generated 1-cube.
 */
export function splitOfficialAddends(value: number): number[] {
  if (!Number.isInteger(value) || value < 0) return []
  if (value === 0) return [0]
  if (OFFICIAL_VALUE_SET.has(value)) return [value]

  const parts: number[] = []
  let rest = value
  for (const piece of OFFICIAL_NUMBERBLOCK_VALUES) {
    if (piece === 0) continue
    while (rest >= piece) {
      parts.push(piece)
      rest -= piece
    }
  }
  return parts
}

function viewBoxSize(svg: string): { width: number; height: number } {
  const match = svg.match(/viewBox\s*=\s*"([^"]+)"/i)
  if (!match) return { width: 1, height: 1 }
  const box = match[1].trim().split(/[\s,]+/).map(Number)
  if (box.length !== 4 || box.some((n) => !Number.isFinite(n) || n <= 0)) {
    return { width: 1, height: 1 }
  }
  return { width: box[2], height: box[3] }
}

export type NumberblockAsset = {
  url: string
  width: number
  height: number
}

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

  async hasCostume(
    targetName: string,
    costumeName: string,
  ): Promise<boolean> {
    await this.load();
    return this.costumes.get(targetName)?.has(costumeName) ?? false;
  }

  private async getZipAsset(costume: ScratchCostume): Promise<JSZipObject> {
    await this.load();

    if (!this.zip) {
      throw new Error("Scratch ZIP was not loaded.");
    }

    const file = this.zip.file(costume.md5ext);
    if (!file) {
      throw new Error(
        `Asset "${costume.md5ext}" for costume "${costume.name}" was not found in the .sb3.`,
      );
    }

    return file;
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
    return options.keepNumeral ? svg : stripCostumeNumeral(svg);
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

    const cacheKey = `${costume.md5ext}:${options.keepNumeral ? "raw" : "stripped"}`
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
    const asset = await this.getNumberblockAsset(number, options)
    return asset.url
  }

  async getNumberblockAsset(
    number: number,
    options: { keepNumeral?: boolean } = {},
  ): Promise<NumberblockAsset> {
    if (!Number.isInteger(number) || number < 0) {
      throw new Error(`Expected a non-negative integer, got ${number}.`)
    }

    const official = await this.resolveOfficialCostume(number)
    if (official) {
      return this.loadAsset(OFFICIAL_TARGET, official, options)
    }

    if (number <= 99) {
      return this.loadAsset("NBs//Ten + One", `n${number}`, options)
    }

    throw new Error(
      `No single Numberblock costume for ${number}. Use getNumberblockFigure().`,
    )
  }

  async getNumberblockFigure(
    number: number,
    options: { keepNumeral?: boolean } = {},
  ): Promise<NumberblockAsset[]> {
    const parts = splitOfficialAddends(number)
    if (parts.length === 0) {
      throw new Error(`No Numberblock visual for ${number}.`)
    }
    return Promise.all(
      parts.map((part) => this.getNumberblockAsset(part, options)),
    )
  }

  private async loadAsset(
    targetName: string,
    costumeName: string,
    options: { keepNumeral?: boolean } = {},
  ): Promise<NumberblockAsset> {
    const costume = await this.getCostume(targetName, costumeName)
    const cacheKey = `${costume.md5ext}:${options.keepNumeral ? "raw" : "stripped"}`
    const svg = await this.getSvgText(targetName, costumeName, options)
    const size = viewBoxSize(svg)
    const cached = this.blobUrlCache.get(cacheKey)
    if (cached) return { url: cached, ...size }

    const url = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    )
    this.blobUrlCache.set(cacheKey, url)
    return { url, ...size }
  }

  private async resolveOfficialCostume(number: number): Promise<string | null> {
    const named = officialCostumeName(number);
    const candidates = [named, String(number), `n${number}`];

    for (const name of candidates) {
      if (name && (await this.hasCostume(OFFICIAL_TARGET, name))) {
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
  async buildSvgIndex(): Promise<
    Record<string, Record<string, SvgAssetRef>>
  > {
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
