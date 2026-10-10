import {
  fitPxPerUnitBoxes,
  packBoxes,
  type UnitBox,
} from "./numberblockScale"
import {
  sceneCubeUnits,
  type NumberblockScene,
} from "./numberblocksSb3"

const seen = new Set<string>()

function round(n: number, digits = 3): number {
  const m = 10 ** digits
  return Math.round(n * m) / m
}

/** Explain body → cube counts for one decorated costume scene. */
export function explainSceneCubes(scene: NumberblockScene) {
  const detected = scene.unit
  const fallback =
    detected && detected > 0
      ? null
      : Math.max(
          1,
          Math.min(scene.body.width, scene.body.height) /
            Math.max(1, Math.round(Math.sqrt(Math.max(scene.body.width, 1)))),
        )
  const svgUnit = detected && detected > 0 ? detected : (fallback as number)
  const source =
    detected && detected > 0
      ? "dominantBlockUnit(median of largest repeated near-square cluster)"
      : "fallback: min(body) / round(sqrt(body))"
  const cubes = sceneCubeUnits(scene)
  return {
    svgUnit: round(svgUnit),
    svgUnitSource: source,
    bodySvg: {
      width: round(scene.body.width),
      height: round(scene.body.height),
    },
    metaCubes: { wide: round(cubes.wide), tall: round(cubes.tall) },
    squaresFound: scene.squareCount,
    formulas: [
      `svgUnit = ${source}`,
      `meta.wide = body.width / svgUnit = ${round(scene.body.width)} / ${round(svgUnit)} = ${round(cubes.wide)}`,
      `meta.tall = body.height / svgUnit = ${round(scene.body.height)} / ${round(svgUnit)} = ${round(cubes.tall)}`,
      `squaresFound on costume = ${scene.squareCount}`,
    ],
  }
}

function explainSceneCubesForPart(scene: NumberblockScene, partValue: number) {
  const meta = explainSceneCubes(scene)
  const ones = sceneCubeUnits(scene, partValue)
  const metaArea = Math.max(meta.metaCubes.wide * meta.metaCubes.tall, 0.01)
  const valuePerMeta = partValue / metaArea
  const edge = Math.round(Math.sqrt(valuePerMeta))
  const expanded =
    edge >= 2 &&
    Math.abs(edge * edge - valuePerMeta) <= Math.max(2, valuePerMeta * 0.2)
  return {
    ...meta,
    partValue,
    onesCubes: { wide: round(ones.wide), tall: round(ones.tall) },
    onesFormulas: expanded
      ? [
          `valuePerMeta = part/metaArea = ${partValue}/${round(metaArea)} = ${round(valuePerMeta)}`,
          `onesEdge = round(sqrt(valuePerMeta)) = ${edge} (meta cell is ${edge}×${edge} ones)`,
          `ones = meta * onesEdge → ${round(ones.wide)}×${round(ones.tall)}`,
        ]
      : ["no meta→ones expand; using meta cubes as ones"],
  }
}

export function logCostumeCubeScale(options: {
  where: string
  value: number
  scenes: NumberblockScene[]
  partValues?: number[]
  pxPerUnit: number
  pxSource: string
  cellWidth: number
  cellHeight: number
}): void {
  const {
    where,
    value,
    scenes,
    partValues,
    pxPerUnit,
    pxSource,
    cellWidth,
    cellHeight,
  } = options
  if (!(pxPerUnit > 0) || scenes.length === 0) return

  const units: UnitBox[] = scenes.map((scene, index) =>
    sceneCubeUnits(scene, partValues?.[index] ?? value),
  )
  const packed = packBoxes(units, cellWidth, cellHeight)
  const key = [
    where,
    value,
    round(pxPerUnit, 4),
    round(cellWidth, 1),
    round(cellHeight, 1),
    units.map((u) => `${round(u.wide, 2)}x${round(u.tall, 2)}`).join("+"),
  ].join("|")
  if (seen.has(key)) return
  seen.add(key)

  const parts = scenes.map((scene, index) => {
    const part = partValues?.[index] ?? value
    const explained = explainSceneCubesForPart(scene, part)
    const screenSize = {
      width: round(explained.onesCubes.wide * pxPerUnit),
      height: round(explained.onesCubes.tall * pxPerUnit),
    }
    return {
      number: part,
      squaresFound: scene.squareCount,
      onesFootprint: explained.onesCubes,
      screenSize,
      cell: { width: round(cellWidth), height: round(cellHeight) },
      ...explained,
      displayFormulas: [
        `number = ${part}`,
        `squaresFound on costume = ${scene.squareCount}`,
        `screenSize = ones × pxPerUnit = ${explained.onesCubes.wide}×${explained.onesCubes.tall} × ${round(pxPerUnit)} → ${screenSize.width}×${screenSize.height}px`,
        `cell = ${round(cellWidth)}×${round(cellHeight)}px`,
        `pxPerUnit = ${round(pxPerUnit)} ← ${pxSource}`,
      ],
    }
  })

  console.groupCollapsed(
    `[cube] ${where} value=${value} · cube=${round(pxPerUnit)}px · parts=${parts.length}`,
  )
  console.log("shared scale", {
    pxPerUnit: round(pxPerUnit),
    pxSource,
    cell: { width: round(cellWidth), height: round(cellHeight) },
    packed: {
      columns: packed.columns,
      rows: packed.rows,
      wide: round(packed.wide),
      tall: round(packed.tall),
    },
    packFormula:
      cellWidth > 0 && cellHeight > 0
        ? `packBoxes(parts) → ${round(packed.wide)}×${round(packed.tall)} cubes; fit = min(cellW/wide, cellH/tall)`
        : "packBoxes(parts) without cell aspect",
  })
  for (const part of parts) {
    console.log(`costume ${part.number}`, {
      number: part.number,
      squaresFound: part.squaresFound,
      screenSize: part.screenSize,
      cell: part.cell,
      onesFootprint: part.onesFootprint,
      detail: part,
    })
  }
  console.groupEnd()
}

export type SharedCostumeCandidate = {
  part: number
  figureValue?: number
  units: UnitBox
  cellWidth: number
  cellHeight: number
  soloPx: number
  /** Detected square paths on the costume SVG (meta or ones). */
  squaresFound?: number
}

/**
 * Log shared scale: largest costume donates the cell; every costume must fit it.
 * When a bigger costume appears, chosenPart/chosenPx change and all cells adapt.
 */
export function logSharedPxChoice(options: {
  where: string
  costumes: SharedCostumeCandidate[]
  chosenPart: number
  chosenPx: number
  refCellWidth: number
  refCellHeight: number
  limitingPart: number
}): void {
  const {
    where,
    costumes,
    chosenPart,
    chosenPx,
    refCellWidth,
    refCellHeight,
    limitingPart,
  } = options
  if (!(chosenPx > 0) || costumes.length === 0) return
  const key = `shared|${where}|${chosenPart}|${limitingPart}|${round(chosenPx, 4)}|${costumes
    .map(
      (c) =>
        `${c.part}:${round(c.cellWidth, 0)}x${round(c.cellHeight, 0)}:${c.squaresFound ?? "?"}`,
    )
    .join(",")}`
  if (seen.has(key)) return
  seen.add(key)

  const ranked = [...costumes].sort((a, b) => b.part - a.part)
  console.groupCollapsed(
    `[cube] ${where} shared pxPerUnit=${round(chosenPx)} · biggest=${chosenPart} · limiting=${limitingPart} · costumes=${costumes.length}`,
  )
  console.log("rule", {
    formula:
      "biggest costume number donates the shared cell; px = min fit of every costume into that cell; all figures use that px",
    adapt:
      "when a new biggest costume appears on screen, chosenPart/refCell/chosenPx recalculate and every other cell shrinks or grows to match",
    biggestCostume: chosenPart,
    limitingCostume: limitingPart,
    sharedCubePx: round(chosenPx),
    sharedCellFromBiggest: {
      width: round(refCellWidth),
      height: round(refCellHeight),
    },
  })
  for (const costume of ranked) {
    const fitInRef = fitPxPerUnitBoxes(
      [costume.units],
      refCellWidth,
      refCellHeight,
    )
    const screenSize = {
      width: round(costume.units.wide * chosenPx),
      height: round(costume.units.tall * chosenPx),
    }
    const squaresFound =
      costume.squaresFound ??
      Math.max(1, Math.round(costume.units.wide * costume.units.tall))
    console.log(`costume ${costume.part}`, {
      number: costume.part,
      figureValue: costume.figureValue,
      squaresFound,
      onesFootprint: {
        wide: round(costume.units.wide),
        tall: round(costume.units.tall),
      },
      screenSize,
      cell: {
        width: round(costume.cellWidth),
        height: round(costume.cellHeight),
      },
      sharedCell: {
        width: round(refCellWidth),
        height: round(refCellHeight),
      },
      fitInSharedCell: round(fitInRef),
      isBiggest: costume.part === chosenPart,
      limitsSharedPx: costume.part === limitingPart,
      adaptsToBiggest: costume.part !== chosenPart,
    })
  }
  console.groupEnd()
}
