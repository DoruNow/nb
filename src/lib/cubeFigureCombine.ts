/**
 * Plan k × step → product cube animations (times-table style combine).
 */

import {
  assembleOrder,
  centerOfMass,
  colorsFromFigure,
  type CubeFigure,
  type Vec3,
} from "./cubeFigure"
import {
  blockUnits,
  layoutCopiesForProduct,
  type CopiesCombineLayout,
} from "./numberblockScale"
import { paintSeats } from "./numberblockPaint"

export type TimesCombinePlan = {
  k: number
  step: number
  product: number
  /** Cubes in one step copy (from the step costume / rules figure). */
  cubesPerCopy: number
  layout: CopiesCombineLayout
  /** Spaced copies (before gather). */
  startSeats: Vec3[]
  /**
   * Unified product structure (packed step copies).
   * Final silhouette — no later reshuffle to a different costume grid.
   */
  packedSeats: Vec3[]
  stepColors: string[]
  productColors: string[]
}

const COPY_GAP = 1.25

function normalizeSeats(figure: CubeFigure): Vec3[] {
  const ordered = assembleOrder(figure.cubes)
  if (ordered.length === 0) return []
  const minX = Math.min(...ordered.map((c) => c.x))
  const minY = Math.min(...ordered.map((c) => c.y))
  const minZ = Math.min(...ordered.map((c) => c.z))
  return ordered.map((c) => ({
    x: c.x - minX,
    y: c.y - minY,
    z: c.z - minZ,
  }))
}

/** Local 90° CCW about the copy’s centre of mass, then shift to origin. */
function rotateCopySeatsCCW(seats: Vec3[]): Vec3[] {
  if (seats.length === 0) return []
  const com = centerOfMass(seats)
  const rotated = seats.map((s) => ({
    x: com.x - (s.y - com.y),
    y: com.y + (s.x - com.x),
    z: s.z,
  }))
  const minX = Math.min(...rotated.map((r) => r.x))
  const minY = Math.min(...rotated.map((r) => r.y))
  return rotated.map((r) => ({
    x: r.x - minX,
    y: r.y - minY,
    z: r.z,
  }))
}

function copyFootprint(seats: Vec3[]): { wide: number; tall: number } {
  if (seats.length === 0) return { wide: 1, tall: 1 }
  return {
    wide: Math.max(...seats.map((s) => s.x)) + 1,
    tall: Math.max(...seats.map((s) => s.y)) + 1,
  }
}

function placeCopies(
  localSeats: Vec3[],
  layout: CopiesCombineLayout,
  gap: number,
): Vec3[] {
  const foot = copyFootprint(localSeats)
  const cellW = foot.wide + gap
  const cellH = foot.tall + gap
  const seats: Vec3[] = []
  for (let row = 0; row < layout.rows; row++) {
    for (let col = 0; col < layout.columns; col++) {
      const ox = col * cellW
      const oy = row * cellH
      for (const s of localSeats) {
        seats.push({ x: s.x + ox, y: s.y + oy, z: s.z })
      }
    }
  }
  return seats
}

/**
 * Build start → packed → product seats for `k` copies of `step`
 * combining into `product` (= k × step).
 */
export function planTimesCombine(
  k: number,
  step: number,
  stepFigure: CubeFigure,
  productFigure: CubeFigure,
): TimesCombinePlan {
  const count = Math.max(1, Math.floor(k))
  const product = productFigure.value ?? count * step
  const layout = layoutCopiesForProduct(step, count)

  let local = normalizeSeats(stepFigure)
  if (local.length === 0) {
    const u = blockUnits(step)
    local = Array.from({ length: step }, (_, i) => ({
      x: i % u.wide,
      y: Math.floor(i / u.wide),
      z: 0,
    }))
  }
  if (layout.rotateDeg === 90) local = rotateCopySeatsCCW(local)

  const startSeats = placeCopies(local, layout, COPY_GAP)
  const packedSeats = placeCopies(local, layout, 0)

  // Repeat the step costume’s colours across every copy (2D → 3D map).
  const stepColors = colorsFromFigure(stepFigure, packedSeats.length)
  // Prefer the product costume’s colours when cardinality matches; else
  // fall back to layout-aware paint (Ten+ones, etc.).
  const productColors =
    productFigure.cubes.length === packedSeats.length
      ? mapColorsByNearestSeat(productFigure, packedSeats)
      : paintSeats(product, packedSeats)

  return {
    k: count,
    step,
    product,
    cubesPerCopy: local.length,
    layout,
    startSeats,
    packedSeats,
    stepColors,
    productColors,
  }
}

/** Match each packed seat to the nearest cube in the product costume. */
function mapColorsByNearestSeat(figure: CubeFigure, seats: Vec3[]): string[] {
  const ordered = assembleOrder(figure.cubes)
  if (ordered.length === 0) {
    return paintSeats(figure.value ?? seats.length, seats)
  }
  const origin = normalizeSeats(figure)
  return seats.map((seat) => {
    let best = 0
    let bestDist = Number.POSITIVE_INFINITY
    for (let i = 0; i < origin.length; i++) {
      const o = origin[i]!
      const d =
        (o.x - seat.x) ** 2 + (o.y - seat.y) ** 2 + (o.z - seat.z) ** 2
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    }
    return ordered[best]?.color ?? "#888888"
  })
}
