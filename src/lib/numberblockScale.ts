/** How many blocks tall the classic shapes are. */
const BLOCK_TALLNESS: Record<number, number> = {
  0: 1,
  1: 1,
  2: 2,
  3: 3,
  4: 2,
  5: 5,
  6: 3,
  7: 7,
  8: 4,
  9: 3,
  10: 5,
  100: 10,
}

const BLOCK_WIDTH: Record<number, number> = {
  0: 1,
  1: 1,
  2: 1,
  3: 1,
  4: 2,
  5: 1,
  6: 2,
  7: 1,
  8: 2,
  9: 3,
  10: 2,
  100: 10,
}

/**
 * Near-square rectangle whose area is `value`.
 * Used when we do not have a hand-authored Numberblock silhouette.
 */
function rectUnits(value: number): { wide: number; tall: number } {
  if (value <= 0) return { wide: 1, tall: 1 }
  let tall = Math.floor(Math.sqrt(value))
  while (tall > 1 && value % tall !== 0) tall -= 1
  if (tall > 1 && value % tall === 0) {
    return { wide: value / tall, tall }
  }
  // Primes / awkward counts: near-square outer box (never 1×n — that
  // crushed Forty-One into a one-cube-tall strip).
  tall = Math.max(1, Math.round(Math.sqrt(value)))
  return { wide: Math.ceil(value / tall), tall }
}

/**
 * Step-shape triangular numbers T_n = n(n+1)/2 occupy an n×n bounding box
 * (Forty-Five is T_9, not a 9×5 rectangle).
 */
function triangularUnits(value: number): { wide: number; tall: number } | null {
  const n = (Math.sqrt(1 + 8 * value) - 1) / 2
  if (!Number.isInteger(n) || n < 2) return null
  return { wide: n, tall: n }
}

/**
 * Relative size in “one block” units (true cube footprints).
 * Classic 0–10 / 100 shapes win, then triangular steps, else a rectangle.
 */
export function blockUnits(value: number): { wide: number; tall: number } {
  if (BLOCK_WIDTH[value] !== undefined && BLOCK_TALLNESS[value] !== undefined) {
    return {
      wide: BLOCK_WIDTH[value],
      tall: BLOCK_TALLNESS[value],
    }
  }
  return triangularUnits(value) ?? rectUnits(value)
}

const PART_GAP = 0.2

export type PackedFigure = {
  wide: number
  tall: number
  columns: number
  rows: number
}

export type UnitBox = { wide: number; tall: number }

/**
 * Pack unit boxes into a grid that maximizes pixels-per-unit in the cell.
 * Prefers stacking (more columns only when that fits the cell better).
 */
export function packBoxes(
  units: UnitBox[],
  cellWidth = 0,
  cellHeight = 0,
): PackedFigure {
  if (units.length === 0) return { wide: 1, tall: 1, columns: 1, rows: 1 }
  if (units.length === 1) {
    const only = units[0]!
    return { wide: only.wide, tall: only.tall, columns: 1, rows: 1 }
  }

  let best: PackedFigure | null = null
  let bestScore = -1

  for (let columns = 1; columns <= units.length; columns += 1) {
    const rows = Math.ceil(units.length / columns)
    const colWidths = Array.from({ length: columns }, () => 0)
    const rowHeights = Array.from({ length: rows }, () => 0)
    for (let index = 0; index < units.length; index += 1) {
      const unit = units[index]!
      const row = Math.floor(index / columns)
      const col = index % columns
      colWidths[col] = Math.max(colWidths[col]!, unit.wide)
      rowHeights[row] = Math.max(rowHeights[row]!, unit.tall)
    }
    const wide =
      colWidths.reduce((sum, edge) => sum + edge, 0) + PART_GAP * (columns - 1)
    const tall =
      rowHeights.reduce((sum, edge) => sum + edge, 0) + PART_GAP * (rows - 1)

    let score: number
    if (cellWidth > 0 && cellHeight > 0) {
      score = Math.min(cellWidth / wide, cellHeight / Math.max(tall, 0.01))
    } else {
      // No cell: prefer slightly tall packs (vertical room is common).
      const target = 0.7
      const aspect = wide / Math.max(tall, 0.01)
      score = 1 / (1 + Math.abs(Math.log(aspect / target)))
    }

    if (score > bestScore + 1e-9) {
      bestScore = score
      best = { wide, tall, columns, rows }
    }
  }

  return best ?? { wide: 1, tall: 1, columns: 1, rows: 1 }
}

/**
 * Pack costume parts into a grid that maximizes pixels-per-unit in the cell.
 */
export function packFigure(
  parts: number[],
  cellWidth = 0,
  cellHeight = 0,
): PackedFigure {
  return packBoxes(parts.map(blockUnits), cellWidth, cellHeight)
}

/** Fit packed unit boxes into a cell. */
export function fitPxPerUnitBoxes(
  units: UnitBox[],
  cellWidth: number,
  cellHeight: number,
): number {
  if (cellWidth <= 0 || cellHeight <= 0) return 1
  const packed = packBoxes(units.length > 0 ? units : [{ wide: 1, tall: 1 }], cellWidth, cellHeight)
  return Math.min(
    cellWidth / Math.max(packed.wide, 0.01),
    cellHeight / Math.max(packed.tall, 0.01),
  )
}

/** Bounding unit size of a figure (cell-aware packing when sizes are given). */
export function figureUnits(
  parts: number[],
  cellWidth = 0,
  cellHeight = 0,
): { wide: number; tall: number } {
  const packed = packFigure(parts, cellWidth, cellHeight)
  return { wide: packed.wide, tall: packed.tall }
}

/** Fit one figure’s packed unit grid into a cell. */
export function fitPxPerUnit(
  parts: number[],
  cellWidth: number,
  cellHeight: number,
): number {
  if (cellWidth <= 0 || cellHeight <= 0) return 1
  const { wide, tall } = packFigure(
    parts.length > 0 ? parts : [1],
    cellWidth,
    cellHeight,
  )
  return Math.min(
    cellWidth / Math.max(wide, 0.01),
    cellHeight / Math.max(tall, 0.01),
  )
}

export type ScaleFigure = {
  value: number
  parts: number[]
  cellWidth: number
  cellHeight: number
}

/** One character costume on screen (e.g. 600 from figure 612). */
export type ScaleCostume = {
  part: number
  /** Cube footprint; defaults to blockUnits(part). */
  units?: UnitBox
  cellWidth: number
  cellHeight: number
}

export type LargestCostumeScale = {
  pxPerUnit: number
  /** Costume with the largest part value — donates the shared cell. */
  largestPart: number
  cellWidth: number
  cellHeight: number
  /** Costume whose footprint most tightens px in that cell (often a taller smaller value). */
  limitingPart: number
}

/**
 * Shared pixels-per-unit for Proportional view.
 *
 * 1. Largest costume **number** (e.g. 800 over 500) chooses the shared cell.
 * 2. Every costume must fit that cell at the same cube size — so a taller 500
 *    can lower px even though 800 picked the cell:
 *
 *    px = min_i fit(costume_i, cell_of_largest)
 */
export function scaleFromLargestCostume(options: {
  costumes: ScaleCostume[]
}): LargestCostumeScale {
  const visible = options.costumes.filter(
    (costume) =>
      Number.isFinite(costume.part) &&
      costume.cellWidth > 0 &&
      costume.cellHeight > 0,
  )
  if (visible.length === 0) {
    return {
      pxPerUnit: 1,
      largestPart: 0,
      cellWidth: 0,
      cellHeight: 0,
      limitingPart: 0,
    }
  }

  const largest = visible.reduce((best, next) =>
    next.part > best.part ? next : best,
  )
  const cellWidth = largest.cellWidth
  const cellHeight = largest.cellHeight

  let pxPerUnit = Number.POSITIVE_INFINITY
  let limitingPart = largest.part
  for (const costume of visible) {
    const units = costume.units ?? blockUnits(costume.part)
    const solo = fitPxPerUnitBoxes([units], cellWidth, cellHeight)
    if (solo < pxPerUnit) {
      pxPerUnit = solo
      limitingPart = costume.part
    }
  }

  return {
    pxPerUnit: Number.isFinite(pxPerUnit) ? pxPerUnit : 1,
    largestPart: largest.part,
    cellWidth,
    cellHeight,
    limitingPart,
  }
}

export function pxPerUnitFromLargestCostume(options: {
  costumes: ScaleCostume[]
}): number {
  return scaleFromLargestCostume(options).pxPerUnit
}

/**
 * Expand whole figures into costume parts, then scale from the largest part.
 */
export function pxPerUnitShared(options: { figures: ScaleFigure[] }): number {
  const costumes: ScaleCostume[] = []
  for (const figure of options.figures) {
    if (
      !Number.isFinite(figure.value) ||
      figure.parts.length === 0 ||
      figure.cellWidth <= 0 ||
      figure.cellHeight <= 0
    ) {
      continue
    }
    for (const part of figure.parts) {
      costumes.push({
        part,
        cellWidth: figure.cellWidth,
        cellHeight: figure.cellHeight,
      })
    }
  }
  return pxPerUnitFromLargestCostume({ costumes })
}

/** @deprecated Use pxPerUnitFromLargestCostume / pxPerUnitShared. */
export function pxPerUnitForLargest(options: {
  figures: ScaleFigure[]
}): number {
  return pxPerUnitShared(options)
}

export function blockScale(options: {
  figures: number[][]
  columnWidth: number
  availableHeight: number
}): number {
  const { figures, columnWidth, availableHeight } = options
  const visible = figures.filter((parts) => parts.length > 0)
  if (visible.length === 0 || availableHeight <= 0) return 1

  const units = visible.map((parts) =>
    figureUnits(parts, columnWidth, availableHeight),
  )
  const maxTall = Math.max(...units.map((unit) => unit.tall), 1)
  let pxPerUnit = availableHeight / maxTall

  for (const { wide } of units) {
    if (columnWidth > 0 && wide * pxPerUnit > columnWidth) {
      pxPerUnit = Math.min(pxPerUnit, columnWidth / wide)
    }
  }

  return pxPerUnit
}

export function displaySize(
  value: number,
  pxPerUnit: number,
): { width: number; height: number } {
  const { wide, tall } = blockUnits(value)
  return { width: wide * pxPerUnit, height: tall * pxPerUnit }
}

const ROW_GAP = 0.4

/** Scale several figures standing in a row so they fit a stage. */
export function rowScale(options: {
  figures: number[][]
  availableWidth: number
  availableHeight: number
  gapUnits?: number
}): number {
  const gapUnits = options.gapUnits ?? ROW_GAP
  const visible = options.figures.filter((parts) => parts.length > 0)
  if (visible.length === 0 || options.availableHeight <= 0) return 1

  const units = visible.map((parts) => figureUnits(parts))
  const maxTall = Math.max(...units.map((unit) => unit.tall), 1)
  const totalWide =
    units.reduce((sum, unit) => sum + unit.wide, 0) +
    gapUnits * Math.max(0, units.length - 1)
  let pxPerUnit = options.availableHeight / maxTall
  if (options.availableWidth > 0 && totalWide > 0) {
    pxPerUnit = Math.min(pxPerUnit, options.availableWidth / totalWide)
  }
  return pxPerUnit
}

export function displaySizeForParts(
  parts: number[],
  pxPerUnit: number,
  cellWidth = 0,
  cellHeight = 0,
): { width: number; height: number } {
  const { wide, tall } = figureUnits(parts, cellWidth, cellHeight)
  return { width: wide * pxPerUnit, height: tall * pxPerUnit }
}
