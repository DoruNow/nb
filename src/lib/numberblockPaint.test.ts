import { describe, expect, it } from "vitest"
import { seatInRect } from "./cubeFigure"
import {
  onesBlockCells,
  paintRectLayout,
  paintSeats,
  TEN_WHITE,
} from "./numberblockPaint"

function orangeSet(wide: number, tall: number, value = 12) {
  const colors = paintRectLayout(value, { wide, tall })
  const cells: string[] = []
  for (let i = 0; i < colors.length; i++) {
    if (colors[i] !== TEN_WHITE) {
      const s = seatInRect(i, { wide, tall })
      cells.push(`${s.x},${s.y}`)
    }
  }
  return cells.sort()
}

describe("numberblockPaint Twelve arrays", () => {
  it("centres the Two in 3×4 (official pose)", () => {
    expect(onesBlockCells(3, 4, 2)).toEqual([
      { x: 1, y: 1 },
      { x: 1, y: 2 },
    ])
    expect(orangeSet(3, 4)).toEqual(["1,1", "1,2"])
  })

  it("centres a horizontal Two in 4×3", () => {
    expect(orangeSet(4, 3)).toEqual(["1,1", "2,1"])
  })

  it("puts a vertical Two at the end of 6×2", () => {
    expect(orangeSet(6, 2)).toEqual(["5,0", "5,1"])
  })

  it("puts a horizontal Two at the end of 12×1", () => {
    expect(orangeSet(12, 1)).toEqual(["10,0", "11,0"])
  })

  it("puts a horizontal Two at the top end of 2×6", () => {
    expect(orangeSet(2, 6)).toEqual(["0,5", "1,5"])
  })
})

describe("numberblockPaint general", () => {
  it("paints solid ones for single digits", () => {
    expect(paintRectLayout(4, { wide: 2, tall: 2 }).every((c) => c === "#53ea22")).toBe(
      true,
    )
  })

  it("paints Eleven as Ten + one red at the end of 2×6", () => {
    const colors = paintRectLayout(11, { wide: 2, tall: 6 })
    const reds = colors.filter((c) => c !== TEN_WHITE)
    expect(reds).toHaveLength(1)
    expect(reds[0]).toBe("#ff2a3a")
  })

  it("paintSeats follows arbitrary packed seats", () => {
    const seats = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]
    // 2×2 of value 4 — all green
    expect(paintSeats(4, seats).every((c) => c === "#53ea22")).toBe(true)
  })
})
