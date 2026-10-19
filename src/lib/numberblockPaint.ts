/**
 * Layout-aware Numberblock cube paint.
 *
 * Teens (11–19) are “Ten and X”: ten white cubes plus a contiguous ones-digit
 * block in that digit’s colour. Placement scales with the rectangle:
 * - chunky arrays → ones block centred (Twelve’s 3×4 / 4×3)
 * - long arrays → ones block at the far end (6×2, 12×1)
 */

import { glowFor } from "./numberblockColors"
import { blockUnits } from "./numberblockScale"
import type { RectLayout } from "./cubeFigure"

/** Ten’s body fill from the official costumes. */
export const TEN_WHITE = "#ffffff"

/**
 * Ones-digit fills sampled from official teen costumes (fallback: glow).
 * 2 matches Twelve’s orange `#ffac2c`.
 */
export const ONES_PAINT: Record<number, string> = {
  1: "#ff2a3a",
  2: "#ffac2c",
  3: "#fcfc30",
  4: "#53ea22",
  5: "#7af6ff",
  6: "#6833bb",
  7: "#e8b020",
  8: "#e86aa8",
  9: "#6b6b6b",
}

export function onesPaintColor(digit: number): string {
  return ONES_PAINT[digit] ?? glowFor(digit) ?? "#888888"
}

function cellsForShape(
  originX: number,
  originY: number,
  shape: RectLayout,
): Array<{ x: number; y: number }> {
  const cells: Array<{ x: number; y: number }> = []
  for (let y = 0; y < shape.tall; y++) {
    for (let x = 0; x < shape.wide; x++) {
      cells.push({ x: originX + x, y: originY + y })
    }
  }
  return cells
}

function orientationsFor(r: number): RectLayout[] {
  const base = blockUnits(r)
  const flipped = { wide: base.tall, tall: base.wide }
  if (base.wide === flipped.wide && base.tall === flipped.tall) return [base]
  return [base, flipped]
}

/**
 * Seat cells for the ones-digit block inside a filled `wide×tall` rectangle
 * of area `10 + r` (or any rectangle that holds `r` accent cubes).
 */
export function onesBlockCells(
  wide: number,
  tall: number,
  remainder: number,
): Array<{ x: number; y: number }> {
  const r = Math.max(0, Math.floor(remainder))
  if (r <= 0) return []
  if (r >= wide * tall) {
    return cellsForShape(0, 0, { wide, tall })
  }

  const fits = orientationsFor(r).filter(
    (o) => o.wide <= wide && o.tall <= tall,
  )
  if (fits.length === 0) {
    // Last-resort: pack leftover cells from the high end of the long axis.
    const cells: Array<{ x: number; y: number }> = []
    for (let y = tall - 1; y >= 0 && cells.length < r; y--) {
      for (let x = wide - 1; x >= 0 && cells.length < r; x--) {
        cells.push({ x, y })
      }
    }
    return cells
  }

  const longIsWide = wide >= tall
  const aspect = Math.max(wide, tall) / Math.min(wide, tall)
  const preferEnd = aspect >= 2 - 1e-9
  const base = blockUnits(r)

  if (preferEnd) {
    // Prefer the ones rod to stand across the short axis (6×2 → 1×2 column).
    const ranked = [...fits].sort((a, b) =>
      longIsWide ? b.tall - a.tall || a.wide - b.wide : b.wide - a.wide || a.tall - b.tall,
    )
    const shape = ranked[0]!
    const ox = longIsWide
      ? wide - shape.wide
      : Math.floor((wide - shape.wide) / 2)
    const oy = longIsWide
      ? Math.floor((tall - shape.tall) / 2)
      : tall - shape.tall
    return cellsForShape(ox, oy, shape)
  }

  // Centre the ones block; slight preference for the canonical ones silhouette.
  let best: Array<{ x: number; y: number }> | null = null
  let bestScore = Number.POSITIVE_INFINITY
  const cx = (wide - 1) / 2
  const cy = (tall - 1) / 2
  for (const shape of fits) {
    const ox = Math.round((wide - shape.wide) / 2)
    const oy = Math.round((tall - shape.tall) / 2)
    const comX = ox + (shape.wide - 1) / 2
    const comY = oy + (shape.tall - 1) / 2
    const canonical =
      shape.wide === base.wide && shape.tall === base.tall ? 0 : 0.05
    const score = Math.hypot(comX - cx, comY - cy) + canonical
    if (score < bestScore) {
      bestScore = score
      best = cellsForShape(ox, oy, shape)
    }
  }
  return best ?? []
}

/**
 * Colour each cell of a filled rectangle for `value`.
 * Returns a `wide * tall` list in {@link seatInRect} order (row-major, y-up).
 */
export function paintRectLayout(value: number, layout: RectLayout): string[] {
  const { wide, tall } = layout
  const count = wide * tall
  const colors = Array.from({ length: count }, () => TEN_WHITE)

  if (!Number.isInteger(value) || value <= 0) {
    return colors.map(() => "#8d8d8d")
  }

  // Exact filled rectangle for this value.
  if (count !== value && value > 10) {
    // Still paint what we can (times-combine tilings may match area).
  }

  if (value < 10) {
    const fill = onesPaintColor(value)
    return colors.map(() => fill)
  }
  if (value === 10) {
    return colors.map(() => TEN_WHITE)
  }

  // Teens / decade+ones on a rectangle: Ten (white) + ones block.
  if (value > 10 && value < 20) {
    const remainder = value - 10
    const accent = new Set(
      onesBlockCells(wide, tall, remainder).map((c) => `${c.x},${c.y}`),
    )
    const ones = onesPaintColor(remainder)
    for (let y = 0; y < tall; y++) {
      for (let x = 0; x < wide; x++) {
        const index = y * wide + x
        if (accent.has(`${x},${y}`)) colors[index] = ones
      }
    }
    return colors
  }

  // Larger filled rectangles: solid glow for now (Twenty etc.).
  const fill = glowFor(value) ?? TEN_WHITE
  return colors.map(() => fill)
}

/** Paint colours parallel to an arbitrary seat list (uses seats’ bounding box). */
export function paintSeats(
  value: number,
  seats: Array<{ x: number; y: number }>,
): string[] {
  if (seats.length === 0) return []
  const minX = Math.min(...seats.map((s) => s.x))
  const minY = Math.min(...seats.map((s) => s.y))
  const wide = Math.max(...seats.map((s) => s.x)) - minX + 1
  const tall = Math.max(...seats.map((s) => s.y)) - minY + 1
  const grid = paintRectLayout(value, { wide, tall })
  return seats.map((s) => {
    const x = s.x - minX
    const y = s.y - minY
    return grid[y * wide + x] ?? TEN_WHITE
  })
}
