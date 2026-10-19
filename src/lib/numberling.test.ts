/** @vitest-environment jsdom */
import fs from "node:fs"
import path from "node:path"
import { Box3, Vector3 } from "three"
import { beforeAll, describe, expect, it } from "vitest"
import {
  loadNumberling,
  loadNumberlingDigit,
  NUMBERLING_DIGITS_TARGET,
  numberlingDigits,
} from "./numberling"
import { ScratchSb3Assets } from "./numberblocksSb3"
import { buildExtrudedNumberling } from "./numberlingThree"

describe("numberlingDigits", () => {
  it("splits values into decimal digits", () => {
    expect(numberlingDigits(0)).toEqual([0])
    expect(numberlingDigits(7)).toEqual([7])
    expect(numberlingDigits(12)).toEqual([1, 2])
    expect(numberlingDigits(100)).toEqual([1, 0, 0])
  })
})

describe("numberling assets (SB3)", () => {
  let assets: ScratchSb3Assets

  beforeAll(async () => {
    const sb3Path = path.resolve(
      process.cwd(),
      "public/assets/Numberblocks Generator.sb3",
    )
    assets = new ScratchSb3Assets()
    await assets.loadFromArrayBuffer(fs.readFileSync(sb3Path))
  })

  it("confirms Digits//Multiplier Ones is the Numberling source in the pack", async () => {
    const resource = await assets.resource()
    const names: string[] = []
    const costumeNames = new Set<string>()
    const walk = (nodes: typeof resource.tree) => {
      for (const node of nodes) {
        if (node.kind === "folder") {
          walk(node.children)
          continue
        }
        names.push(node.name)
        if (node.name === NUMBERLING_DIGITS_TARGET) {
          for (const costume of node.costumes) costumeNames.add(costume.name)
        }
      }
    }
    walk(resource.tree)
    expect(names).toContain(NUMBERLING_DIGITS_TARGET)
    for (let d = 0; d <= 9; d++) {
      expect(costumeNames.has(`n${d}`)).toBe(true)
    }
  })

  it("loads Multiplier Ones digit costumes n0–n9", async () => {
    for (let d = 0; d <= 9; d++) {
      const glyph = await loadNumberlingDigit(d, assets)
      expect(glyph.costume).toBe(`n${d}`)
      expect(glyph.svg).toMatch(/<path\b/i)
      expect(glyph.width).toBeGreaterThan(1)
      expect(glyph.height).toBeGreaterThan(1)
    }
  })

  it("composes Twelve’s Numberling from n1 + n2", async () => {
    const twelve = await loadNumberling(12, assets)
    expect(twelve.digits).toEqual([1, 2])
    expect(twelve.sources).toEqual(["n1", "n2"])
    expect(twelve.width).toBeGreaterThan(
      (await loadNumberlingDigit(1, assets)).width,
    )
    // Two digit groups in the composed SVG.
    expect(twelve.svg.match(/<g transform="translate/g)?.length).toBe(2)
  })

  it("extrudes Numberling SVGs into solid 3D meshes with depth", async () => {
    const eight = await loadNumberling(8, assets)
    const { root, geometries, depth, material } = buildExtrudedNumberling(eight)
    expect(geometries.length).toBeGreaterThan(0)
    expect(depth).toBeGreaterThan(0.03)
    expect(depth).toBeLessThan(0.2)
    const size = new Box3().setFromObject(root).getSize(new Vector3())
    // Fitted ~0.95 tall; shallow extrusion (~20% of prior depth).
    expect(size.y).toBeGreaterThan(0.8)
    expect(size.y).toBeLessThan(1.2)
    expect(size.z).toBeGreaterThan(0.03)
    expect(size.z).toBeLessThan(0.2)
    material.dispose()
    for (const geometry of geometries) geometry.dispose()
  })
})
