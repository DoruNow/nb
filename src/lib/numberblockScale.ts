/** How many blocks tall the classic 0–10 shapes are. */
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
 * Relative size in “one block” units.
 * 0–10 follow the real shapes. 11–99 are one official character, about
 * as tall as Ten — not n stacked cubes (that made 12 a tiny letterboxed
 * sprite next to 10). 100 is a 10×10 square.
 */
export function blockUnits(value: number): { wide: number; tall: number } {
  if (BLOCK_WIDTH[value] !== undefined && BLOCK_TALLNESS[value] !== undefined) {
    const tall = BLOCK_TALLNESS[value]
    return {
      wide: Math.max(BLOCK_WIDTH[value], tall * 0.65),
      tall,
    }
  }
  if (value < 100) {
    const tall = 5 + Math.log10(value / 10) * 1.4
    return { wide: tall * 0.85, tall }
  }
  const tall = 5 + Math.log10(Math.max(value, 1)) * 3.6
  return { wide: value / tall, tall }
}

const PART_GAP = 0.2

export function figureUnits(parts: number[]): { wide: number; tall: number } {
  if (parts.length === 0) return { wide: 1, tall: 1 }
  const units = parts.map(blockUnits)
  if (parts.length === 1) return units[0]!
  const gap = PART_GAP * (parts.length - 1)
  const tall = Math.max(...units.map((unit) => unit.tall))
  return {
    wide: units.reduce((sum, unit) => sum + unit.wide, 0) + gap,
    tall,
  }
}

export function blockScale(options: {
  figures: number[][]
  columnWidth: number
  availableHeight: number
}): number {
  const { figures, columnWidth, availableHeight } = options
  const visible = figures.filter((parts) => parts.length > 0)
  if (visible.length === 0 || availableHeight <= 0) return 1

  const units = visible.map(figureUnits)
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

  const units = visible.map(figureUnits)
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
): { width: number; height: number } {
  const { wide, tall } = figureUnits(parts)
  return { width: wide * pxPerUnit, height: tall * pxPerUnit }
}
