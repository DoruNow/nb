/** @vitest-environment jsdom */
import fs from "node:fs"
import path from "node:path"
import JSZip from "jszip"
import { beforeAll, describe, expect, it } from "vitest"
import {
  assembleDelays,
  assembleOrder,
  centerOfMass,
  divisorLayouts,
  divisorOrientationPairs,
  figureFromRectLayout,
  costumeToCubes,
  figureFromRules,
  normalizeCubeColor,
  radiusAboutCenter,
  rigidRotateSeatsCCW,
  sceneToCubes,
  seatInRect,
} from "./cubeFigure"
import {
  decorateCostumeLife,
  normalizeScratchSvg,
  separateBlockSeams,
} from "./numberblocksSb3"

const OFFICIAL = "assets//Official Numberblocks 0-100"

const NAMES: Record<number, string> = {
  1: "One",
  2: "Two",
  3: "Three",
  4: "Four",
  5: "Five",
  6: "Six",
  7: "Seven",
  8: "Eight",
  9: "Nine",
  10: "Ten",
}

describe("assembleOrder", () => {
  const square = [
    { x: 1, y: 1, z: 0, color: "#000" },
    { x: 0, y: 1, z: 0, color: "#000" },
    { x: 1, y: 0, z: 0, color: "#000" },
    { x: 0, y: 0, z: 0, color: "#000" },
  ]

  it("fills columns left-to-right, bottom-to-top", () => {
    const ordered = assembleOrder(square)
    expect(ordered.map((c) => `${c.x},${c.y}`)).toEqual([
      "0,0",
      "0,1",
      "1,0",
      "1,1",
    ])
  })

  it("column mode waits for each column to finish dropping", () => {
    const delays = assembleDelays(square, "column", {
      staggerMs: 70,
      dropMs: 420,
      columnGapMs: 120,
    })
    // Col0: 0, 70 — last lands at 70+420=490; col1 starts at 490+120=610
    expect(delays).toEqual([0, 70, 610, 680])
  })
})

describe("divisorLayouts", () => {
  it("lists every rectangle factorization of 12", () => {
    expect(divisorLayouts(12)).toEqual([
      { wide: 12, tall: 1 },
      { wide: 6, tall: 2 },
      { wide: 4, tall: 3 },
      { wide: 3, tall: 4 },
      { wide: 2, tall: 6 },
      { wide: 1, tall: 12 },
    ])
  })

  it("groups 12 into orientation pairs (3×4, 6×2, 12×1 first)", () => {
    expect(divisorOrientationPairs(12)).toEqual([
      [
        { wide: 3, tall: 4 },
        { wide: 4, tall: 3 },
      ],
      [
        { wide: 6, tall: 2 },
        { wide: 2, tall: 6 },
      ],
      [
        { wide: 12, tall: 1 },
        { wide: 1, tall: 12 },
      ],
    ])
  })

  it("rigid-rotates a 3×4 array into 4×3 without reshuffling indices", () => {
    const layout = { wide: 3, tall: 4 }
    const seats = Array.from({ length: 12 }, (_, i) => seatInRect(i, layout))
    const baked = rigidRotateSeatsCCW(seats, layout)
    expect(baked.layout).toEqual({ wide: 4, tall: 3 })
    // Bottom-left cube becomes a corner of the reversed footprint.
    expect(baked.seats[0]).toEqual({ x: 3, y: 0, z: 0 })
    // Neighbours stay neighbours (rigid), unlike a seatInRect reshuffle.
    const dx = baked.seats[1]!.x - baked.seats[0]!.x
    const dy = baked.seats[1]!.y - baked.seats[0]!.y
    expect(Math.abs(dx) + Math.abs(dy)).toBe(1)
  })

  it("maps cube indices into rectangle seats", () => {
    expect(seatInRect(0, { wide: 4, tall: 3 })).toEqual({ x: 0, y: 0, z: 0 })
    expect(seatInRect(4, { wide: 4, tall: 3 })).toEqual({ x: 0, y: 1, z: 0 })
    expect(seatInRect(11, { wide: 4, tall: 3 })).toEqual({ x: 3, y: 2, z: 0 })
  })

  it("builds a 4×3 twelve with stable colours", () => {
    const colors = Array.from({ length: 12 }, (_, i) => `#${(i + 1).toString(16).padStart(6, "0")}`)
    const fig = figureFromRectLayout(12, { wide: 4, tall: 3 }, colors)
    expect(fig.cubes).toHaveLength(12)
    expect(fig.cubes[5]?.color).toBe(colors[5])
    expect(fig.cubes[5]).toMatchObject({ x: 1, y: 1 })
  })
})

describe("centerOfMass", () => {
  it("centres a filled 3×4 rectangle on the grid midpoint", () => {
    const seats = Array.from({ length: 12 }, (_, i) =>
      seatInRect(i, { wide: 3, tall: 4 }),
    )
    expect(centerOfMass(seats)).toEqual({ x: 1, y: 1.5, z: 0 })
    expect(radiusAboutCenter(seats)).toBeCloseTo(Math.hypot(1, 1.5), 5)
  })
})

describe("normalizeCubeColor", () => {
  it("expands short hex and rgb", () => {
    expect(normalizeCubeColor("#f00")).toBe("#ff0000")
    expect(normalizeCubeColor("#E23B32")).toBe("#e23b32")
    expect(normalizeCubeColor("rgb(226, 59, 50)")).toBe("#e23b32")
  })
})

describe("figureFromRules", () => {
  it("builds classic 1–10 footprints", () => {
    expect(figureFromRules(4).cubes).toHaveLength(4)
    expect(figureFromRules(4)).toMatchObject({ wide: 2, tall: 2 })
    expect(figureFromRules(6)).toMatchObject({ wide: 2, tall: 3 })
    expect(figureFromRules(6).cubes).toHaveLength(6)
    expect(figureFromRules(1).cubes[0]?.color).toBe("#e23b32")
  })
})

describe("costumeToCubes", () => {
  const costumes = new Map<string, string>()

  beforeAll(async () => {
    const sb3Path = path.resolve(
      process.cwd(),
      "public/assets/Numberblocks Generator.sb3",
    )
    const zip = await JSZip.loadAsync(fs.readFileSync(sb3Path))
    const project = JSON.parse(
      await zip.file("project.json")!.async("string"),
    ) as {
      targets: Array<{
        name: string
        costumes: Array<{ name: string; md5ext: string }>
      }>
    }
    const target = project.targets.find((entry) => entry.name === OFFICIAL)
    if (!target) throw new Error("official Numberblocks target missing")

    for (const costume of target.costumes) {
      const file = zip.file(costume.md5ext)
      if (!file) continue
      const raw = await file.async("string")
      costumes.set(
        costume.name,
        separateBlockSeams(normalizeScratchSvg(raw)),
      )
    }
  })

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const)(
    "extracts %i unit cubes from the official costume",
    (value) => {
      const svg = costumes.get(NAMES[value]!)
      expect(svg).toBeTruthy()
      const figure = costumeToCubes(svg!, { value })
      expect(figure.meta?.source).toBe("svg")
      expect(figure.cubes).toHaveLength(value)
      expect(figure.wide * figure.tall).toBeGreaterThanOrEqual(value)
      for (const cube of figure.cubes) {
        expect(cube.color).toMatch(/^#[0-9a-f]{6}$/)
        expect(cube.color).not.toBe("#000000")
      }
    },
  )

  it("keeps Four as a 2×2 colour layout", () => {
    const figure = costumeToCubes(costumes.get("Four")!, { value: 4 })
    expect(figure.wide).toBe(2)
    expect(figure.tall).toBe(2)
    expect(new Set(figure.cubes.map((c) => c.color)).size).toBeGreaterThan(0)
  })

  it("still extracts cubes after decorateCostumeLife (lab path)", () => {
    const scene = decorateCostumeLife(costumes.get("Six")!)
    const figure = sceneToCubes(scene, { value: 6 })
    expect(figure.meta?.source).toBe("svg")
    expect(figure.cubes).toHaveLength(6)
  })

  it("falls back to rules when SVG has no cubes", () => {
    // Tall black stroke — decorateCostumeLife skips black fills as blocks.
    const figure = costumeToCubes(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 40"><rect x="4" y="0" width="2" height="40" fill="#000000"/></svg>`,
      { value: 3 },
    )
    expect(figure.meta?.source).toBe("rules")
    expect(figure.cubes).toHaveLength(3)
  })
})
