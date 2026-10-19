/**
 * Three.js adapter for {@link CubeFigure}.
 * Keeps rendering concerns out of the portable cube config module.
 */

import {
  AmbientLight,
  Color,
  DirectionalLight,
  Group,
  InstancedMesh,
  Matrix4,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three"
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js"
import {
  assembleDelays,
  assembleOrder,
  cellKey,
  centerOfMass,
  divisorOrientationPairs,
  radiusAboutCenter,
  rigidRotateSeatsCCW,
  seatInRect,
  type AssembleMode,
  type CubeCell,
  type CubeFigure,
  type RectLayout,
  type Vec3,
} from "./cubeFigure"
import type { TimesCombinePlan } from "./cubeFigureCombine"
import { paintRectLayout } from "./numberblockPaint"
import { loadNumberling } from "./numberling"
import {
  createNumberlingBillboard,
  type NumberlingAttachment,
} from "./numberlingThree"

export type CubeFigureThreeHandle = {
  /** Call when the host element resizes. */
  resize: () => void
  /** Replace the figure (rebuilds instanced meshes). */
  setFigure: (figure: CubeFigure | null) => void
  /** Load a k×step → product combine plan and play it. */
  setTimesCombine: (plan: TimesCombinePlan | null) => void
  /** Show/hide or change the floating Numberling digit(s). */
  setNumberlingValue: (value: number | null) => void
  /** Replay drop-from-above / divisor morph / times combine. */
  playAssemble: () => void
  /** Release GPU resources. */
  dispose: () => void
}

export type CubeFigureThreeOptions = {
  background?: string
  /** Slow orbit after the figure is placed (default true). */
  autoSpin?: boolean
  /**
   * Drop each cube from above into its grid seat.
   * Order is column-major (left→right, bottom→top).
   */
  assemble?: boolean
  /** How assemble delays are scheduled (default `stagger`). */
  assembleMode?: AssembleMode
  /**
   * Cycle the figure through every divisor rectangle (e.g. 12 →
   * 12×1, 6×2, 4×3, …), lerping cube seats between layouts.
   */
  divisorMorph?: boolean
  /** Floating Numberling from Digits//Multiplier Ones (default true). */
  showNumberling?: boolean
  /** Fires when the held divisor layout changes (morph mode). */
  onDivisorLayout?: (layout: RectLayout, index: number) => void
  /** Fires as the times-combine animation changes phase. */
  onCombinePhase?: (phase: CombinePhase) => void
}

export type CombinePhase =
  | "idle"
  | "show"
  | "gather"
  | "packed"
  | "become"
  | "product"

/** Full unit so adjacent cubes share the same face plane. */
const CUBE_SIZE = 1

/**
 * Soft edge fillet on each cube (world units).
 * Tune here — was ~0.12 originally; kept at 20% of that.
 */
export const CUBE_EDGE_RADIUS = 0.12 * 0.2

const ROUND_SEGMENTS = 4

const DROP_HEIGHT = 6
const STAGGER_MS = 70
const DROP_MS = 420
const COLUMN_GAP_MS = 120

const MORPH_HOLD_MS = 700
const MORPH_MS = 700
/** Rigid 90° turn of the whole array (not a per-cube reshuffle). */
const MORPH_ORIENT_MS = 800
const MORPH_ORIENT_RAD = Math.PI / 2

const COMBINE_SHOW_MS = 700
const COMBINE_GATHER_MS = 900
const COMBINE_PACKED_MS = 350
const COMBINE_BECOME_MS = 800

function groupByColor(figure: CubeFigure): Map<string, CubeFigure["cubes"]> {
  const groups = new Map<string, CubeFigure["cubes"]>()
  for (const cube of figure.cubes) {
    const list = groups.get(cube.color) ?? []
    list.push(cube)
    groups.set(cube.color, list)
  }
  return groups
}

function easeOutCubic(t: number): number {
  const u = 1 - t
  return 1 - u * u * u
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

type AnimCell = {
  cell: CubeCell
  mesh: InstancedMesh
  index: number
  delay: number
}

type MorphCube = {
  color: string
  /** Current grid seat (stable across rigid orientation). */
  seat: { x: number; y: number; z: number }
  from: { x: number; y: number; z: number }
  to: { x: number; y: number; z: number }
}

type CombineCube = {
  seat: Vec3
  from: Vec3
  to: Vec3
  colorFrom: string
  colorTo: string
}

/**
 * Mount a soft-lit cube preview into `container`. Returns a handle for
 * resize / figure updates / dispose.
 */
export function mountCubeFigureThree(
  container: HTMLElement,
  figure: CubeFigure | null = null,
  options: CubeFigureThreeOptions = {},
): CubeFigureThreeHandle {
  const autoSpin = options.autoSpin !== false
  const assemble = options.assemble === true
  const assembleMode: AssembleMode = options.assembleMode ?? "stagger"
  const divisorMorph = options.divisorMorph === true
  const showNumberling = options.showNumberling !== false

  const scene = new Scene()
  scene.background = new Color(options.background ?? "#e8eef5")

  const camera = new PerspectiveCamera(35, 1, 0.1, 200)
  camera.position.set(6, 5, 10)
  camera.lookAt(0, 0, 0)

  const renderer = new WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  container.appendChild(renderer.domElement)

  const ambient = new AmbientLight(0xffffff, 0.7)
  const key = new DirectionalLight(0xffffff, 0.9)
  key.position.set(4, 8, 6)
  const fill = new DirectionalLight(0xb8d4ff, 0.4)
  fill.position.set(-5, 2, -3)
  const rim = new DirectionalLight(0xffffff, 0.25)
  rim.position.set(0, 3, -6)
  scene.add(ambient, key, fill, rim)

  const root = new Group()
  scene.add(root)
  /** Cubes + Numberling share this group so spin / orient read as one shape. */
  const shapeGroup = new Group()
  root.add(shapeGroup)

  const geometry = new RoundedBoxGeometry(
    CUBE_SIZE,
    CUBE_SIZE,
    CUBE_SIZE,
    ROUND_SEGMENTS,
    CUBE_EDGE_RADIUS,
  )
  const materials: MeshPhysicalMaterial[] = []
  const meshes: InstancedMesh[] = []
  const matrix = new Matrix4()
  const lookTarget = new Vector3()
  const tmpColor = new Color()

  let raf = 0
  let disposed = false
  let spin = assemble || divisorMorph ? 0.2 : 0.35
  let unit = 1
  let animCells: AnimCell[] = []
  let assembleStartedAt = 0
  let assembling = false

  let morphMesh: InstancedMesh | null = null
  /**
   * Orient pivot at the COM. Always `shapeGroup` while a morph is live so the
   * Numberling turns with the cubes; null in assemble / combine modes.
   */
  let morphPivot: Group | null = null
  let morphCubes: MorphCube[] = []
  /** Orientation pairs: [shape, reversed], e.g. [3×4, 4×3]. */
  let morphPairs: RectLayout[][] = []
  let morphPairIndex = 0
  let morphSide = 0
  let morphLayout: RectLayout | null = null
  /** hold → orient (rigid 90°) → hold → move (new product) → … */
  let morphPhase: "hold" | "move" | "orient" = "hold"
  let morphAfterHold: "move" | "orient" = "orient"
  let morphPhaseStartedAt = 0
  let morphing = false
  let morphOrientFrom = 0
  let morphOrientTo = 0
  /** Live centre of mass in grid units — instances are placed relative to this. */
  let com: Vec3 = { x: 0, y: 0, z: 0 }

  let combinePlan: TimesCombinePlan | null = null
  let combineCubes: CombineCube[] = []
  let combineMesh: InstancedMesh | null = null
  let combinePhase: CombinePhase = "idle"
  let combinePhaseStartedAt = 0
  let combining = false
  const colorFrom = new Color()
  const colorTo = new Color()
  const colorMix = new Color()

  let numberling: NumberlingAttachment | null = null
  let numberlingValue: number | null = null
  let numberlingLoadId = 0
  /** Per-copy step Numberlings during times-combine show/gather. */
  let copyNumberlings: NumberlingAttachment[] = []
  let copyNumberlingLoadId = 0
  let copyNumberlingStep: number | null = null

  function disposeCopyNumberlings() {
    for (const entry of copyNumberlings) entry.dispose()
    copyNumberlings = []
    copyNumberlingStep = null
  }

  function clearCopyNumberlings() {
    copyNumberlingLoadId += 1
    disposeCopyNumberlings()
  }

  function clearMeshes() {
    for (const mesh of meshes) {
      mesh.removeFromParent()
      mesh.dispose()
    }
    meshes.length = 0
    morphPivot = null
    shapeGroup.rotation.set(0, 0, 0)
    for (const material of materials) material.dispose()
    materials.length = 0
    animCells = []
    assembling = false
    morphMesh = null
    morphCubes = []
    morphPairs = []
    morphLayout = null
    morphing = false
    com = { x: 0, y: 0, z: 0 }
    combinePlan = null
    combineCubes = []
    combineMesh = null
    combinePhase = "idle"
    combining = false
    clearCopyNumberlings()
    // Numberling stays on the shared shape group across figure rebuilds.
    numberling?.attachTo(shapeGroup)
  }

  function emitCombinePhase(phase: CombinePhase) {
    combinePhase = phase
    options.onCombinePhase?.(phase)
    // Step copies → product Numberling when the cluster has gathered.
    if (phase === "packed" || phase === "become" || phase === "product") {
      clearCopyNumberlings()
      if (combinePlan) void setNumberlingValue(combinePlan.product)
    } else if (phase === "show" || phase === "gather") {
      void setNumberlingValue(null)
      if (combinePlan) {
        void ensureCopyNumberlings(combinePlan.step, combinePlan.k)
      }
    }
    syncNumberling()
  }

  function currentSeats(): Array<{ x: number; y: number; z?: number }> {
    if (combineCubes.length > 0) return combineCubes.map((cube) => cube.seat)
    if (morphCubes.length > 0) return morphCubes.map((cube) => cube.seat)
    return animCells.map((entry) => entry.cell)
  }

  /** Hide only while seats are translating (drop / reshape). Gather keeps copy Numberlings. */
  function blocksMoving(): boolean {
    if (assembling) return true
    if (morphing && morphPhase === "move") return true
    return false
  }

  /** Times-combine phases that show one Numberling per step copy. */
  function combineShowsCopyNumberlings(): boolean {
    return (
      combining &&
      !!combinePlan &&
      (combinePhase === "show" || combinePhase === "gather")
    )
  }

  function combineCopyAnchors(): Array<{
    com: Vec3
    topY: number
  }> {
    if (!combinePlan || combineCubes.length === 0) return []
    const per = Math.max(1, combinePlan.cubesPerCopy)
    const anchors: Array<{ com: Vec3; topY: number }> = []
    for (let i = 0; i < combinePlan.k; i++) {
      const slice = combineCubes.slice(i * per, (i + 1) * per)
      if (slice.length === 0) continue
      const seats = slice.map((cube) => cube.seat)
      const copyCom = centerOfMass(seats)
      const topY = seats.reduce((max, seat) => Math.max(max, seat.y), -Infinity)
      anchors.push({ com: copyCom, topY })
    }
    return anchors
  }

  function syncCopyNumberlings() {
    if (!combineShowsCopyNumberlings()) {
      for (const entry of copyNumberlings) entry.setVisible(false)
      return
    }
    const anchors = combineCopyAnchors()
    copyNumberlings.forEach((entry, index) => {
      const anchor = anchors[index]
      if (!anchor) {
        entry.setVisible(false)
        return
      }
      entry.attachTo(shapeGroup)
      entry.placeAboveAnchor(anchor.com, anchor.topY, com, unit)
      entry.setVisible(true)
      entry.tickFacing(-root.rotation.y)
    })
  }

  function syncNumberling() {
    const hidePrimary = combineShowsCopyNumberlings()
    if (numberling) {
      numberling.attachTo(shapeGroup)
      const seats = currentSeats()
      if (seats.length > 0) {
        const topY = seats.reduce(
          (max, seat) => Math.max(max, seat.y),
          -Infinity,
        )
        numberling.placeAbove(topY, com.y, unit)
      }
      numberling.setVisible(!hidePrimary && !blocksMoving())
      numberling.tickFacing(-root.rotation.y)
    }
    syncCopyNumberlings()
  }

  async function setNumberlingValue(value: number | null) {
    if (!showNumberling) return
    if (value === null || !Number.isFinite(value)) {
      numberlingLoadId += 1
      numberling?.dispose()
      numberling = null
      numberlingValue = null
      return
    }
    const next = Math.floor(value)
    if (next === numberlingValue && numberling) {
      syncNumberling()
      return
    }
    const loadId = ++numberlingLoadId
    try {
      const asset = await loadNumberling(next)
      if (disposed || loadId !== numberlingLoadId) return
      numberling?.dispose()
      const attachment = await createNumberlingBillboard(asset, shapeGroup)
      if (disposed || loadId !== numberlingLoadId) {
        attachment.dispose()
        return
      }
      numberling = attachment
      numberlingValue = next
      syncNumberling()
    } catch (err) {
      console.warn("Numberling failed to load", err)
    }
  }

  /** One face-front Numberling above each step copy (costume digit for `step`). */
  async function ensureCopyNumberlings(step: number, count: number) {
    if (!showNumberling) return
    if (
      copyNumberlingStep === step &&
      copyNumberlings.length === count &&
      count > 0
    ) {
      syncCopyNumberlings()
      return
    }
    const loadId = ++copyNumberlingLoadId
    disposeCopyNumberlings()
    try {
      const asset = await loadNumberling(step)
      if (disposed || loadId !== copyNumberlingLoadId) return
      const created: NumberlingAttachment[] = []
      for (let i = 0; i < count; i++) {
        created.push(await createNumberlingBillboard(asset, shapeGroup))
        if (disposed || loadId !== copyNumberlingLoadId) {
          for (const entry of created) entry.dispose()
          return
        }
      }
      copyNumberlings = created
      copyNumberlingStep = step
      syncCopyNumberlings()
    } catch (err) {
      console.warn("Copy Numberlings failed to load", err)
    }
  }

  function writeCombineSeats() {
    if (!combineMesh) return
    refreshCom(combineCubes.map((cube) => cube.seat))
    combineCubes.forEach((cube, index) => {
      writeCentered(combineMesh!, index, cube.seat.x, cube.seat.y, cube.seat.z)
    })
    combineMesh.instanceMatrix.needsUpdate = true
    syncNumberling()
  }

  function writeCombineColors(t: number) {
    if (!combineMesh) return
    combineCubes.forEach((cube, index) => {
      colorFrom.set(cube.colorFrom)
      colorTo.set(cube.colorTo)
      colorMix.copy(colorFrom).lerp(colorTo, t)
      combineMesh!.setColorAt(index, colorMix)
    })
    if (combineMesh.instanceColor) combineMesh.instanceColor.needsUpdate = true
  }

  function fitCombineCamera(plan: TimesCombinePlan) {
    // Frame the spaced copies; packed/product keep the same structure.
    fitCameraToSeats(plan.startSeats)
  }

  function startTimesCombine() {
    if (!combinePlan || !combineMesh || combineCubes.length === 0) return
    combineCubes.forEach((cube, index) => {
      const start = combinePlan!.startSeats[index]!
      cube.seat = { ...start }
      cube.from = { ...start }
      cube.to = { ...combinePlan!.packedSeats[index]! }
    })
    writeCombineSeats()
    writeCombineColors(0)
    combining = true
    combinePhaseStartedAt = performance.now()
    emitCombinePhase("show")
  }

  function tickTimesCombine(now: number) {
    if (!combining || !combinePlan || !combineMesh) return
    const elapsed = now - combinePhaseStartedAt

    if (combinePhase === "show") {
      if (elapsed >= COMBINE_SHOW_MS) {
        combineCubes.forEach((cube, index) => {
          cube.from = { ...cube.seat }
          cube.to = { ...combinePlan!.packedSeats[index]! }
        })
        combinePhaseStartedAt = now
        emitCombinePhase("gather")
      }
      return
    }

    if (combinePhase === "gather") {
      const t = Math.min(1, elapsed / COMBINE_GATHER_MS)
      const e = easeInOutCubic(t)
      combineCubes.forEach((cube) => {
        cube.seat = {
          x: cube.from.x + (cube.to.x - cube.from.x) * e,
          y: cube.from.y + (cube.to.y - cube.from.y) * e,
          z: cube.from.z + (cube.to.z - cube.from.z) * e,
        }
      })
      writeCombineSeats()
      if (t >= 1) {
        combinePhaseStartedAt = now
        emitCombinePhase("packed")
      }
      return
    }

    if (combinePhase === "packed") {
      if (elapsed >= COMBINE_PACKED_MS) {
        // Structure is already the product — only the paint becomes Twelve.
        combinePhaseStartedAt = now
        emitCombinePhase("become")
      }
      return
    }

    if (combinePhase === "become") {
      const t = Math.min(1, elapsed / COMBINE_BECOME_MS)
      const e = easeInOutCubic(t)
      writeCombineColors(e)
      if (t >= 1) {
        combining = false
        emitCombinePhase("product")
      }
    }
  }

  function setTimesCombine(plan: TimesCombinePlan | null) {
    clearMeshes()
    if (!plan || plan.startSeats.length === 0) {
      void setNumberlingValue(null)
      renderer.render(scene, camera)
      return
    }
    unit = 1
    combinePlan = plan
    const count = plan.startSeats.length
    combineCubes = plan.startSeats.map((seat, index) => ({
      seat: { ...seat },
      from: { ...seat },
      to: { ...plan.packedSeats[index]! },
      colorFrom: plan.stepColors[index] ?? "#888888",
      colorTo: plan.productColors[index] ?? "#888888",
    }))

    const material = new MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.38,
      metalness: 0.02,
      clearcoat: 0.28,
      clearcoatRoughness: 0.5,
    })
    materials.push(material)
    const mesh = new InstancedMesh(geometry, material, count)
    mesh.frustumCulled = false
    shapeGroup.add(mesh)
    meshes.push(mesh)
    combineMesh = mesh

    root.rotation.y = spin
    fitCombineCamera(plan)
    startTimesCombine()
    // startTimesCombine → emitCombinePhase("show") loads per-copy step Numberlings.
    renderer.render(scene, camera)
  }

  function refreshCom(seats: Array<{ x: number; y: number; z?: number }>) {
    com = centerOfMass(seats)
  }

  /** Place a cube so the figure's COM sits at the scene origin. */
  function writeCentered(
    mesh: InstancedMesh,
    index: number,
    x: number,
    y: number,
    z: number,
  ) {
    matrix.makeTranslation(
      (x - com.x) * unit,
      (y - com.y) * unit,
      (z - com.z) * unit,
    )
    mesh.setMatrixAt(index, matrix)
  }

  function placeAllSettled() {
    refreshCom(animCells.map((entry) => entry.cell))
    for (const entry of animCells) {
      writeCentered(
        entry.mesh,
        entry.index,
        entry.cell.x,
        entry.cell.y,
        entry.cell.z,
      )
      entry.mesh.instanceMatrix.needsUpdate = true
    }
    syncNumberling()
  }

  function fitCameraToRadius(radius: number) {
    lookTarget.set(0, 0, 0)
    const span = Math.max(radius * 2, 1) * 1.35 + 1.5
    const dist = span / Math.tan((camera.fov * Math.PI) / 360) / 1.6
    camera.position.set(dist * 0.55, dist * 0.35, dist)
    camera.near = Math.max(0.05, dist / 100)
    camera.far = dist * 20
    camera.lookAt(lookTarget)
    camera.updateProjectionMatrix()
  }

  function fitCameraToSeats(seats: Array<{ x: number; y: number; z?: number }>) {
    const centre = centerOfMass(seats)
    fitCameraToRadius(radiusAboutCenter(seats, centre) + 0.5)
  }

  function fitCamera(fig: CubeFigure) {
    unit = fig.unitSize
    fitCameraToSeats(fig.cubes)
  }

  function fitMorphCamera() {
    let maxR = 0.5
    for (const layout of morphPairs.flat()) {
      const count = layout.wide * layout.tall
      const seats = Array.from({ length: count }, (_, i) => seatInRect(i, layout))
      maxR = Math.max(maxR, radiusAboutCenter(seats) + 0.5)
    }
    fitCameraToRadius(maxR)
  }

  function emitLayout() {
    if (!morphLayout) return
    const flatIndex =
      morphPairs.slice(0, morphPairIndex).reduce((sum, pair) => sum + pair.length, 0) +
      morphSide
    options.onDivisorLayout?.(morphLayout, flatIndex)
  }

  function writeMorphSeats() {
    if (!morphMesh) return
    refreshCom(morphCubes.map((cube) => cube.seat))
    morphCubes.forEach((cube, index) => {
      writeCentered(morphMesh!, index, cube.seat.x, cube.seat.y, cube.seat.z)
    })
    morphMesh.instanceMatrix.needsUpdate = true
    syncNumberling()
  }

  function writeMorphColors() {
    if (!morphMesh) return
    morphCubes.forEach((cube, index) => {
      morphMesh!.setColorAt(index, tmpColor.set(cube.color))
    })
    if (morphMesh.instanceColor) morphMesh.instanceColor.needsUpdate = true
  }

  /** Pack into a rectangle and paint the value’s layout-aware pattern. */
  function applyPackedLayout(layout: RectLayout, value: number) {
    morphLayout = layout
    const painted = paintRectLayout(value, layout)
    morphCubes.forEach((cube, index) => {
      const seat = seatInRect(index, layout)
      cube.seat = { ...seat }
      cube.from = { ...seat }
      cube.to = { ...seat }
      cube.color = painted[index] ?? cube.color
    })
    if (morphPivot) morphPivot.rotation.z = 0
    writeMorphSeats()
    writeMorphColors()
  }

  function beginMorphToPair(nextPair: number) {
    if (!morphMesh || morphPairs.length === 0) return
    const toLayout = morphPairs[nextPair]?.[0]
    if (!toLayout) return
    morphCubes.forEach((cube, index) => {
      cube.from = { ...cube.seat }
      cube.to = seatInRect(index, toLayout)
    })
    morphPairIndex = nextPair
    morphSide = 0
    morphLayout = toLayout
    morphPhase = "move"
    morphPhaseStartedAt = performance.now()
    emitLayout()
  }

  /** Turn the whole array 90° around the COM — reversed factors, same shape. */
  function beginMorphOrient() {
    if (!morphMesh || !morphPivot || !morphLayout) return
    const pair = morphPairs[morphPairIndex]
    if (!pair || pair.length < 2) {
      morphAfterHold = "move"
      morphPhase = "hold"
      morphPhaseStartedAt = performance.now()
      return
    }
    writeMorphSeats()
    morphOrientFrom = 0
    morphOrientTo = MORPH_ORIENT_RAD
    morphPivot.rotation.z = 0
    morphSide = morphSide === 0 ? 1 : 0
    morphLayout = pair[morphSide]!
    morphPhase = "orient"
    morphPhaseStartedAt = performance.now()
    emitLayout()
  }

  function finishMorphOrient() {
    if (!morphPivot || !morphLayout) return
    const before = morphPairs[morphPairIndex]?.[morphSide === 0 ? 1 : 0]
    if (!before) return
    const baked = rigidRotateSeatsCCW(
      morphCubes.map((c) => c.seat),
      before,
    )
    morphCubes.forEach((cube, index) => {
      const seat = baked.seats[index]!
      cube.seat = { ...seat }
      cube.from = { ...seat }
      cube.to = { ...seat }
    })
    morphLayout = baked.layout
    morphPivot.rotation.z = 0
    writeMorphSeats()
  }

  function startDivisorMorph() {
    if (!divisorMorph || morphCubes.length === 0 || morphPairs.length === 0) {
      return
    }
    morphPairIndex = 0
    morphSide = 0
    morphPhase = "hold"
    morphAfterHold = "orient"
    morphPhaseStartedAt = performance.now()
    morphing = true
    applyPackedLayout(morphPairs[0]![0]!, morphCubes.length)
    emitLayout()
  }

  function tickMorph(now: number) {
    if (!morphing || !morphMesh || !morphPivot) return
    const elapsed = now - morphPhaseStartedAt

    if (morphPhase === "hold") {
      if (elapsed >= MORPH_HOLD_MS) {
        if (morphAfterHold === "orient") beginMorphOrient()
        else beginMorphToPair((morphPairIndex + 1) % morphPairs.length)
      }
      return
    }

    if (morphPhase === "orient") {
      const t = Math.min(1, elapsed / MORPH_ORIENT_MS)
      const e = easeInOutCubic(t)
      // Pivot sits at the COM (scene origin after writeMorphSeats).
      morphPivot.rotation.z =
        morphOrientFrom + (morphOrientTo - morphOrientFrom) * e
      if (t >= 1) {
        finishMorphOrient()
        morphPhase = "hold"
        morphAfterHold = "move"
        morphPhaseStartedAt = now
      }
      return
    }

    // Reshape into the next multiplication array; keep COM centred every frame.
    const t = Math.min(1, elapsed / MORPH_MS)
    const e = easeInOutCubic(t)
    morphCubes.forEach((cube) => {
      cube.seat = {
        x: cube.from.x + (cube.to.x - cube.from.x) * e,
        y: cube.from.y + (cube.to.y - cube.from.y) * e,
        z: cube.from.z + (cube.to.z - cube.from.z) * e,
      }
    })
    writeMorphSeats()
    if (t >= 1) {
      if (morphLayout) {
        // New factorization: snap seats and repaint (Ten+Two etc.).
        applyPackedLayout(morphLayout, morphCubes.length)
      }
      morphPhase = "hold"
      morphAfterHold = "orient"
      morphPhaseStartedAt = now
    }
  }

  function assembleDisplaySeats(yOf: (entry: AnimCell) => number) {
    return animCells.map((entry) => ({
      x: entry.cell.x,
      y: yOf(entry),
      z: entry.cell.z,
    }))
  }

  function writeAssembleFrame(yOf: (entry: AnimCell) => number) {
    const seats = assembleDisplaySeats(yOf)
    refreshCom(seats)
    for (const entry of animCells) {
      writeCentered(
        entry.mesh,
        entry.index,
        entry.cell.x,
        yOf(entry),
        entry.cell.z,
      )
      entry.mesh.instanceMatrix.needsUpdate = true
    }
  }

  function startAssemble() {
    if (!assemble || animCells.length === 0) return
    assembleStartedAt = performance.now()
    assembling = true
    writeAssembleFrame((entry) => entry.cell.y + DROP_HEIGHT)
  }

  function tickAssemble(now: number) {
    if (!assembling) return
    let allDone = true
    writeAssembleFrame((entry) => {
      const local = now - assembleStartedAt - entry.delay
      if (local < 0) {
        allDone = false
        return entry.cell.y + DROP_HEIGHT
      }
      const t = Math.min(1, local / DROP_MS)
      if (t < 1) allDone = false
      return entry.cell.y + DROP_HEIGHT * (1 - easeOutCubic(t))
    })
    if (allDone) {
      assembling = false
      placeAllSettled()
    }
  }

  function setFigureMorph(next: CubeFigure) {
    unit = next.unitSize
    const value = next.value ?? next.cubes.length
    morphPairs = divisorOrientationPairs(value)
    if (morphPairs.length === 0) return

    const count = value
    const ordered = assembleOrder(next.cubes)
    const first = morphPairs[0]![0]!
    morphCubes = Array.from({ length: count }, (_, i) => {
      const color = ordered[i % Math.max(ordered.length, 1)]?.color ?? "#8d8d8d"
      const seat = seatInRect(i, first)
      return {
        color,
        seat: { ...seat },
        from: { ...seat },
        to: { ...seat },
      }
    })

    const material = new MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.38,
      metalness: 0.02,
      clearcoat: 0.28,
      clearcoatRoughness: 0.5,
    })
    materials.push(material)
    const mesh = new InstancedMesh(geometry, material, count)
    mesh.frustumCulled = false
    morphCubes.forEach((cube, index) => {
      mesh.setColorAt(index, tmpColor.set(cube.color))
    })
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

    morphPivot = shapeGroup
    morphPivot.rotation.set(0, 0, 0)
    morphPivot.add(mesh)
    meshes.push(mesh)
    morphMesh = mesh

    root.rotation.y = spin
    fitMorphCamera()
    startDivisorMorph()
    renderer.render(scene, camera)
  }

  function setFigureAssemble(next: CubeFigure) {
    unit = next.unitSize
    const ordered = assembleOrder(next.cubes)
    const delays = assemble
      ? assembleDelays(next.cubes, assembleMode, {
          staggerMs: STAGGER_MS,
          dropMs: DROP_MS,
          columnGapMs: COLUMN_GAP_MS,
        })
      : ordered.map(() => 0)
    const delayByKey = new Map<string, number>()
    ordered.forEach((cell, i) => {
      delayByKey.set(cellKey(cell), delays[i] ?? 0)
    })

    refreshCom(next.cubes)
    for (const [color, cells] of groupByColor(next)) {
      const material = new MeshPhysicalMaterial({
        color: new Color(color),
        roughness: 0.38,
        metalness: 0.02,
        clearcoat: 0.28,
        clearcoatRoughness: 0.5,
      })
      materials.push(material)
      const mesh = new InstancedMesh(geometry, material, cells.length)
      mesh.frustumCulled = false
      cells.forEach((cell, index) => {
        animCells.push({
          cell,
          mesh,
          index,
          delay: delayByKey.get(cellKey(cell)) ?? index * STAGGER_MS,
        })
      })
      shapeGroup.add(mesh)
      meshes.push(mesh)
    }

    root.rotation.y = spin
    fitCamera(next)
    if (assemble) startAssemble()
    else placeAllSettled()
    renderer.render(scene, camera)
  }

  function setFigure(next: CubeFigure | null) {
    clearMeshes()
    if (!next || next.cubes.length === 0) {
      void setNumberlingValue(null)
      renderer.render(scene, camera)
      return
    }
    if (divisorMorph) setFigureMorph(next)
    else setFigureAssemble(next)
    void setNumberlingValue(next.value ?? next.cubes.length)
  }

  function playAssemble() {
    if (combinePlan) startTimesCombine()
    else if (divisorMorph) startDivisorMorph()
    else startAssemble()
  }

  function resize() {
    const width = Math.max(1, container.clientWidth)
    const height = Math.max(1, container.clientHeight)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
    renderer.render(scene, camera)
  }

  function frame(now: number) {
    if (disposed) return
    raf = requestAnimationFrame(frame)
    if (meshes.length === 0 && !numberling) return
    if (assembling) tickAssemble(now)
    else if (morphing) tickMorph(now)
    else if (combining) tickTimesCombine(now)
    // Morph/combine own their motion; idle figures may orbit.
    if (autoSpin && !assembling && !morphing && !combining) {
      root.rotation.y += 0.004
      spin = root.rotation.y
    }
    syncNumberling()
    renderer.render(scene, camera)
  }

  function dispose() {
    disposed = true
    cancelAnimationFrame(raf)
    numberlingLoadId += 1
    numberling?.dispose()
    numberling = null
    numberlingValue = null
    clearCopyNumberlings()
    clearMeshes()
    geometry.dispose()
    renderer.dispose()
    if (renderer.domElement.parentElement === container) {
      container.removeChild(renderer.domElement)
    }
  }

  resize()
  setFigure(figure)
  raf = requestAnimationFrame(frame)

  return {
    resize,
    setFigure,
    setTimesCombine,
    setNumberlingValue,
    playAssemble,
    dispose,
  }
}
