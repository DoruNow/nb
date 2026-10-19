/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest"
import { figureFromRules } from "./cubeFigure"
import { planTimesCombine } from "./cubeFigureCombine"

describe("planTimesCombine", () => {
  it("plans three Fours gathering into Twelve", () => {
    const step = figureFromRules(4)
    const product = figureFromRules(12)
    const plan = planTimesCombine(3, 4, step, product)

    expect(plan.k).toBe(3)
    expect(plan.step).toBe(4)
    expect(plan.product).toBe(12)
    expect(plan.cubesPerCopy).toBe(4)
    expect(plan.startSeats).toHaveLength(12)
    expect(plan.packedSeats).toHaveLength(12)
    expect(plan.stepColors).toHaveLength(12)
    expect(plan.productColors).toHaveLength(12)

    // Spaced copies should cover a wider footprint than the packed tiling.
    const startSpan =
      Math.max(...plan.startSeats.map((s) => s.x)) -
      Math.min(...plan.startSeats.map((s) => s.x))
    const packedSpan =
      Math.max(...plan.packedSeats.map((s) => s.x)) -
      Math.min(...plan.packedSeats.map((s) => s.x))
    expect(startSpan).toBeGreaterThan(packedSpan)
  })
})
