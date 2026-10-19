/**
 * Renderer-agnostic Numberblock cube config.
 * Built from Scratch costumes (or number rules) — no Three.js / WebGL here.
 */

import { glowFor } from "./numberblockColors"
import { paintRectLayout } from "./numberblockPaint"
import { blockUnits } from "./numberblockScale"
import {
  analyzeCostumeBlocks,
  type CostumeBlockAnalysis,
  type NumberblockScene,
  type SceneBlockShape,
} from "./numberblocksSb3"

export type CubeCell = {
  /** Grid column (integer). */
  x: number
  /** Grid row (integer), y-up for 3D. */
  y: number
  /** Depth; flat stacks use 0. */
  z: number
  /** Solid cube colour as #rrggbb. */
  color: string
}

export type CubeFigure = {
  value?: number
  /** World size of one cube edge (default 1). */
  unitSize: number
  wide: number
  tall: number
  cubes: CubeCell[]
  meta?: { source: "svg" | "rules"; squareCount?: number }
}

export type CostumeToCubesOptions = {
  value?: number
  unitSize?: number
}

/** Column-major: left → right columns, bottom → top within a column. */
export function assembleOrder(cubes: CubeCell[]): CubeCell[] {
  return [...cubes].sort((a, b) => a.x - b.x || a.y - b.y || a.z - b.z)
}

export type AssembleMode = "stagger" | "column"

export type AssembleTiming = {
  staggerMs: number
  dropMs: number
  /** Extra pause after a column finishes before the next starts (`column` mode). */
  columnGapMs: number
}

const DEFAULT_ASSEMBLE_TIMING: AssembleTiming = {
  staggerMs: 70,
  dropMs: 420,
  columnGapMs: 120,
}

/**
 * Start delays (ms) for {@link assembleOrder} seats.
 * - `stagger`: overlapping cascade
 * - `column`: finish each column (incl. drop) before the next column begins
 */
export function assembleDelays(
  cubes: CubeCell[],
  mode: AssembleMode,
  timing: Partial<AssembleTiming> = {},
): number[] {
  const { staggerMs, dropMs, columnGapMs } = {
    ...DEFAULT_ASSEMBLE_TIMING,
    ...timing,
  }
  const ordered = assembleOrder(cubes)
  if (mode === "stagger") {
    return ordered.map((_, index) => index * staggerMs)
  }

  const delays: number[] = []
  let index = 0
  let column = 0
  while (index < ordered.length) {
    const x = ordered[index]!.x
    let count = 0
    while (index + count < ordered.length && ordered[index + count]!.x === x) {
      count += 1
    }
    const columnStart =
      column === 0
        ? 0
        : delays[index - 1]! + dropMs + columnGapMs
    for (let i = 0; i < count; i++) {
      delays.push(columnStart + i * staggerMs)
    }
    index += count
    column += 1
  }
  return delays
}

export function cellKey(cell: Pick<CubeCell, "x" | "y" | "z">): string {
  return `${cell.x},${cell.y},${cell.z}`
}

export type Vec3 = { x: number; y: number; z: number }

/** Average of cube centres (equal mass per cube). */
export function centerOfMass(
  seats: Array<{ x: number; y: number; z?: number }>,
): Vec3 {
  if (seats.length === 0) return { x: 0, y: 0, z: 0 }
  let sx = 0
  let sy = 0
  let sz = 0
  for (const seat of seats) {
    sx += seat.x
    sy += seat.y
    sz += seat.z ?? 0
  }
  const n = seats.length
  return { x: sx / n, y: sy / n, z: sz / n }
}

/** Furthest cube-centre distance from COM (grid units). */
export function radiusAboutCenter(
  seats: Array<{ x: number; y: number; z?: number }>,
  com: Vec3 = centerOfMass(seats),
): number {
  let max = 0
  for (const seat of seats) {
    const dx = seat.x - com.x
    const dy = seat.y - com.y
    const dz = (seat.z ?? 0) - com.z
    max = Math.max(max, Math.hypot(dx, dy, dz))
  }
  return max
}

export type RectLayout = {
  wide: number
  tall: number
}

/**
 * All rectangle factorizations of `n` (wide × tall = n), ordered by
 * increasing height: 12 → 12×1, 6×2, 4×3, 3×4, 2×6, 1×12.
 */
export function divisorLayouts(n: number): RectLayout[] {
  if (!Number.isInteger(n) || n < 1) return []
  const layouts: RectLayout[] = []
  for (let tall = 1; tall <= n; tall++) {
    if (n % tall === 0) layouts.push({ wide: n / tall, tall })
  }
  return layouts
}

export function transposeLayout(layout: RectLayout): RectLayout {
  return { wide: layout.tall, tall: layout.wide }
}

export function layoutsEqual(a: RectLayout, b: RectLayout): boolean {
  return a.wide === b.wide && a.tall === b.tall
}

/**
 * Divisor rectangles as [start, reversed] pairs for “show product, then
 * flip the whole array”. Squarest pairs first.
 * 12 → [[3×4, 4×3], [6×2, 2×6], [12×1, 1×12]].
 */
export function divisorOrientationPairs(n: number): RectLayout[][] {
  const pairs: RectLayout[][] = []
  const seen = new Set<string>()
  for (const layout of divisorLayouts(n)) {
    const key = [layout.wide, layout.tall]
      .sort((a, b) => a - b)
      .join("x")
    if (seen.has(key)) continue
    seen.add(key)
    const flipped = transposeLayout(layout)
    if (layoutsEqual(layout, flipped)) {
      pairs.push([layout])
      continue
    }
    const min = Math.min(layout.wide, layout.tall)
    // Prefer portrait when chunky (3×4); landscape when long (6×2, 12×1).
    const start =
      min <= 2
        ? layout.wide >= layout.tall
          ? layout
          : flipped
        : layout.tall >= layout.wide
          ? layout
          : flipped
    pairs.push([start, transposeLayout(start)])
  }
  pairs.sort(
    (a, b) =>
      Math.min(b[0]!.wide, b[0]!.tall) - Math.min(a[0]!.wide, a[0]!.tall),
  )
  return pairs
}

/**
 * Rigid 90° counter-clockwise turn of every seat around the layout centre,
 * then shifted so the footprint sits on the origin (wide↔tall swapped).
 */
export function rigidRotateSeatsCCW(
  seats: Array<{ x: number; y: number; z: number }>,
  layout: RectLayout,
): { seats: Array<{ x: number; y: number; z: number }>; layout: RectLayout } {
  const cx = (layout.wide - 1) / 2
  const cy = (layout.tall - 1) / 2
  const rotated = seats.map((s) => ({
    x: cx - (s.y - cy),
    y: cy + (s.x - cx),
    z: s.z,
  }))
  const minX = Math.min(...rotated.map((r) => r.x))
  const minY = Math.min(...rotated.map((r) => r.y))
  return {
    seats: rotated.map((r) => ({
      x: r.x - minX,
      y: r.y - minY,
      z: r.z,
    })),
    layout: transposeLayout(layout),
  }
}

/** Seat for cube index `i` in a filled rectangle (row-major, bottom → top). */
export function seatInRect(
  index: number,
  layout: RectLayout,
): { x: number; y: number; z: number } {
  const wide = Math.max(1, layout.wide)
  return {
    x: index % wide,
    y: Math.floor(index / wide),
    z: 0,
  }
}

/** Colours in stable assemble order (fallback: repeat a single glow). */
export function colorsFromFigure(figure: CubeFigure, count: number): string[] {
  const ordered = assembleOrder(figure.cubes)
  const colors = ordered.map((cell) => cell.color)
  if (colors.length === 0) {
    const fill = glowFor(figure.value ?? count) ?? DEFAULT_COLOR
    return Array.from({ length: count }, () => fill)
  }
  return Array.from({ length: count }, (_, i) => colors[i % colors.length]!)
}

/**
 * Build a filled rectangle figure.
 * When `colors` is omitted, uses layout-aware {@link paintRectLayout}.
 */
export function figureFromRectLayout(
  value: number,
  layout: RectLayout,
  colors?: string[],
  opts?: { unitSize?: number },
): CubeFigure {
  const unitSize = opts?.unitSize ?? 1
  const count = layout.wide * layout.tall
  const painted = colors ?? paintRectLayout(value, layout)
  const cubes: CubeCell[] = []
  for (let i = 0; i < count; i++) {
    const seat = seatInRect(i, layout)
    cubes.push({
      ...seat,
      color: painted[i] ?? glowFor(value) ?? DEFAULT_COLOR,
    })
  }
  return {
    value,
    unitSize,
    wide: layout.wide,
    tall: layout.tall,
    cubes,
    meta: { source: "rules", squareCount: cubes.length },
  }
}

const DEFAULT_COLOR = "#8d8d8d"

/** Normalize common SVG fill strings to #rrggbb (lowercase). */
export function normalizeCubeColor(fill: string): string {
  const raw = fill.trim().toLowerCase()
  if (!raw || raw === "none" || raw.startsWith("url(")) return DEFAULT_COLOR

  if (raw.startsWith("#")) {
    const hex = raw.slice(1)
    if (/^[0-9a-f]{3}$/.test(hex)) {
      return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`
    }
    if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`
    if (/^[0-9a-f]{8}$/.test(hex)) return `#${hex.slice(0, 6)}`
  }

  const rgb = raw.match(
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/,
  )
  if (rgb) {
    const channel = (n: string) =>
      Math.max(0, Math.min(255, Math.round(Number(n))))
        .toString(16)
        .padStart(2, "0")
    return `#${channel(rgb[1]!)}${channel(rgb[2]!)}${channel(rgb[3]!)}`
  }

  return DEFAULT_COLOR
}

function emptyFigure(
  opts: CostumeToCubesOptions,
  source: "svg" | "rules",
): CubeFigure {
  return {
    value: opts.value,
    unitSize: opts.unitSize ?? 1,
    wide: 0,
    tall: 0,
    cubes: [],
    meta: { source, squareCount: 0 },
  }
}

function footprintOf(cubes: CubeCell[]): { wide: number; tall: number } {
  if (cubes.length === 0) return { wide: 0, tall: 0 }
  let maxX = 0
  let maxY = 0
  for (const cube of cubes) {
    if (cube.x > maxX) maxX = cube.x
    if (cube.y > maxY) maxY = cube.y
  }
  return { wide: maxX + 1, tall: maxY + 1 }
}

/**
 * Classic / rectangular silhouette from {@link blockUnits} + glow colour.
 * Used when SVG block detection finds nothing.
 */
export function figureFromRules(
  value: number,
  opts?: { unitSize?: number },
): CubeFigure {
  const unitSize = opts?.unitSize ?? 1
  if (!Number.isFinite(value) || value < 0) {
    return emptyFigure({ value, unitSize }, "rules")
  }

  const { wide, tall } = blockUnits(value)
  const color = glowFor(value) ?? DEFAULT_COLOR
  const count = value === 0 ? 1 : Math.floor(value)
  const cubes: CubeCell[] = []

  // Fill bottom-up, left-to-right (Numberblock stacks grow upward).
  let placed = 0
  for (let y = 0; y < tall && placed < count; y++) {
    for (let x = 0; x < wide && placed < count; x++) {
      cubes.push({ x, y, z: 0, color })
      placed += 1
    }
  }

  return {
    value,
    unitSize,
    wide,
    tall,
    cubes,
    meta: { source: "rules", squareCount: cubes.length },
  }
}

function expandShapesToCubes(
  shapes: SceneBlockShape[],
  unit: number,
): CubeCell[] {
  const union = {
    minX: Math.min(...shapes.map((s) => s.minX)),
    minY: Math.min(...shapes.map((s) => s.minY)),
    maxX: Math.max(...shapes.map((s) => s.maxX)),
    maxY: Math.max(...shapes.map((s) => s.maxY)),
  }

  const byKey = new Map<string, CubeCell>()

  for (const shape of shapes) {
    const width = shape.maxX - shape.minX
    const height = shape.maxY - shape.minY
    const cols = Math.max(1, Math.round(width / unit))
    const rows = Math.max(1, Math.round(height / unit))
    const color = normalizeCubeColor(shape.fill)
    const baseX = Math.round((shape.minX - union.minX) / unit)
    const baseY = Math.round((union.maxY - shape.maxY) / unit)

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cell: CubeCell = {
          x: baseX + col,
          y: baseY + row,
          z: 0,
          color,
        }
        byKey.set(`${cell.x},${cell.y},${cell.z}`, cell)
      }
    }
  }

  return [...byKey.values()].sort(
    (a, b) => a.y - b.y || a.x - b.x || a.z - b.z,
  )
}

function figureFromAnalysis(
  analysis: CostumeBlockAnalysis,
  opts: CostumeToCubesOptions,
): CubeFigure | null {
  const { scene, blockShapes } = analysis
  if (!scene.unit || blockShapes.length === 0) return null

  const cubes = expandShapesToCubes(blockShapes, scene.unit)
  if (cubes.length === 0) return null

  const { wide, tall } = footprintOf(cubes)
  return {
    value: opts.value,
    unitSize: opts.unitSize ?? 1,
    wide,
    tall,
    cubes,
    meta: { source: "svg", squareCount: scene.squareCount },
  }
}

/**
 * Transform a Scratch costume SVG into a cube figure.
 * Prefers SVG block detection; falls back to number rules when given `value`.
 */
export function costumeToCubes(
  svg: string,
  opts: CostumeToCubesOptions = {},
): CubeFigure {
  const fromSvg = figureFromAnalysis(analyzeCostumeBlocks(svg), opts)
  if (fromSvg) return fromSvg
  if (opts.value !== undefined) return figureFromRules(opts.value, opts)
  return emptyFigure(opts, "svg")
}

/**
 * Build a cube figure from a prior {@link analyzeCostumeBlocks} result
 * (or re-analyze when only the decorated scene SVG is available).
 */
export function sceneToCubes(
  scene: NumberblockScene,
  opts: CostumeToCubesOptions = {},
): CubeFigure {
  const fromSvg = figureFromAnalysis(analyzeCostumeBlocks(scene.svg), opts)
  if (fromSvg) return fromSvg
  if (opts.value !== undefined) return figureFromRules(opts.value, opts)
  return emptyFigure(opts, "svg")
}
