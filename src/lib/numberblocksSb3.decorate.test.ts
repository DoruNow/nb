/** @vitest-environment jsdom */
import fs from "node:fs"
import path from "node:path"
import JSZip from "jszip"
import { beforeAll, describe, expect, it } from "vitest"
import {
  BLOCK_SEAM_THICKNESS,
  decorateCostumeLife,
  normalizeScratchSvg,
  scaleSvgStrokesForOnesEdge,
  sceneCubeUnits,
  sceneMetaOnesEdge,
  separateBlockSeams,
} from "./numberblocksSb3"

const OFFICIAL = "assets//Official Numberblocks 0-100"
const LARGE = "assets//Large Numbers"

function partCounts(svg: string) {
  const parts = { body: 0, face: 0, limb: 0, numeral: 0 }
  const re = /<(path|ellipse|circle|rect|polygon|polyline)\b([^>]*)>/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(svg))) {
    const part = match[2].match(/data-part="([^"]+)"/)?.[1] ?? "body"
    if (part in parts) parts[part as keyof typeof parts] += 1
    else parts.body += 1
  }
  return parts
}

describe("decorateCostumeLife", () => {
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

  it("keeps Six's cubes as the body so the cell is not empty at rest", () => {
    const scene = decorateCostumeLife(costumes.get("Six")!)
    const counts = partCounts(scene.svg)
    expect(counts.body).toBe(6)
    expect(counts.face).toBeGreaterThan(0)
  })

  it("does not keep Twelve's hollow brow frame as body", () => {
    const scene = decorateCostumeLife(costumes.get("Twelve")!)
    const counts = partCounts(scene.svg)
    expect(counts.body).toBe(12)
    expect(scene.svg).toMatch(/data-part="face"[^>]*fill="none"|fill="none"[^>]*data-part="face"/)
  })

  it("keeps Four as a plain cube stack", () => {
    const scene = decorateCostumeLife(costumes.get("Four")!)
    const counts = partCounts(scene.svg)
    expect(counts.body).toBe(4)
  })
})

describe("separateBlockSeams", () => {
  const large = new Map<string, string>()

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
    const largeTarget = project.targets.find((entry) => entry.name === LARGE)
    if (!largeTarget) throw new Error("Large Numbers target missing")
    for (const name of [
      "Five Hundred",
      "Eight Hundred",
      "One Hundred",
      "Three Hundred",
    ]) {
      const costume = largeTarget.costumes.find((entry) => entry.name === name)
      if (!costume) throw new Error(`missing ${name}`)
      const raw = await zip.file(costume.md5ext)!.async("string")
      large.set(name, separateBlockSeams(normalizeScratchSvg(raw)))
    }
  })

  it("unifies hollow hundred overlays to unit * BLOCK_SEAM_THICKNESS", () => {
    const expected = 30 * BLOCK_SEAM_THICKNESS
    for (const name of ["Five Hundred", "Eight Hundred", "Three Hundred"]) {
      const svg = large.get(name)!
      // Author unit overlays are axis-aligned H/V squares (~30×30).
      const hollowCubes = [...svg.matchAll(/<path\b([^>]*)>/gi)]
        .map((match) => match[1]!)
        .filter((attrs) => /fill\s*=\s*"none"/i.test(attrs))
        .filter((attrs) => /[Hh]-?29\./.test(attrs))
      expect(hollowCubes.length).toBeGreaterThan(0)
      for (const attrs of hollowCubes) {
        const width = Number.parseFloat(
          attrs.match(/stroke-width\s*=\s*"([^"]*)"/i)?.[1] ?? "0",
        )
        expect(width).toBeCloseTo(expected, 2)
      }
    }
  })

  it("matches Three Hundred hollow overlay color to solid cube seams", () => {
    const svg = large.get("Three Hundred")!
    const hollow = [...svg.matchAll(/<path\b([^>]*)>/gi)]
      .map((match) => match[1]!)
      .filter((attrs) => /fill\s*=\s*"none"/i.test(attrs))
      .filter((attrs) => /[Hh]-?29\./.test(attrs))
    const solids = [...svg.matchAll(/<path\b([^>]*)>/gi)]
      .map((match) => match[1]!)
      .filter((attrs) => /fill\s*=\s*"#faff80"/i.test(attrs))
    expect(hollow.length).toBe(3)
    expect(solids.length).toBe(3)
    const solidStroke = solids[0]!.match(/stroke\s*=\s*"([^"]*)"/i)?.[1]
    for (const attrs of hollow) {
      expect(attrs.match(/stroke\s*=\s*"([^"]*)"/i)?.[1]).toBe(solidStroke)
      expect(solidStroke).toBe("#4d4d4d")
    }
  })

  it("keeps solid cube seams on the same thickness rule", () => {
    const svg = large.get("Five Hundred")!
    const solidSeams = [...svg.matchAll(/<path\b([^>]*)>/gi)]
      .map((match) => match[1]!)
      .filter((attrs) => /fill\s*=\s*"#a2f8fc"/i.test(attrs))
      .filter((attrs) => /stroke-width\s*=\s*"0\.600"/i.test(attrs))
    expect(solidSeams.length).toBe(5)
  })

  it("scales Three Hundred strokes down by the meta→ones edge", () => {
    const scene = decorateCostumeLife(large.get("Three Hundred")!)
    const edge = sceneMetaOnesEdge(scene, 300)
    expect(edge).toBe(9)
    const ones = sceneCubeUnits(scene, 300)
    const meta = sceneCubeUnits(scene)
    expect(ones.wide / meta.wide).toBeCloseTo(edge, 5)
    const scaled = scaleSvgStrokesForOnesEdge(scene.svg, edge)
    expect(scene.svg).toMatch(/stroke-width="0\.600"/)
    expect(scaled).toContain(`stroke-width="${(0.6 / edge).toFixed(4)}"`)
  })
})
