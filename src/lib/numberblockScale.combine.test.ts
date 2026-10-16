import { describe, expect, it } from "vitest"
import { layoutCopiesForProduct } from "./numberblockScale"

describe("layoutCopiesForProduct", () => {
  it("packs three Twos into Six’s footprint with a 90° rotate", () => {
    const layout = layoutCopiesForProduct(2, 3)
    expect(layout.rotateDeg).toBe(90)
    expect(layout.columns * layout.rows).toBe(3)
    const cellW = 2
    const cellH = 1
    expect(layout.columns * cellW).toBe(2)
    expect(layout.rows * cellH).toBe(3)
  })

  it("packs two Threes into Six without rotating", () => {
    const layout = layoutCopiesForProduct(3, 2)
    expect(layout.rotateDeg).toBe(0)
    expect(layout.columns).toBe(2)
    expect(layout.rows).toBe(1)
  })
})
