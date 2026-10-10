<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import { logCostumeCubeScale } from "../lib/cubeScaleDebug"
import {
  fitPxPerUnitBoxes,
  packBoxes,
  type UnitBox,
} from "../lib/numberblockScale"
import {
  numberblocksAssets,
  scaleSvgStrokesForOnesEdge,
  sceneCubeUnits,
  sceneMetaOnesEdge,
  splitOfficialAddends,
  type NumberblockScene,
} from "../lib/numberblocksSb3"

const PART_GAP_PX = 2

const props = defineProps<{
  value: number
  alt?: string
  /**
   * Show eyes, limbs, and other costume details.
   * When omitted in proportional (shared pxPerUnit) mode, life stays on
   * so scale view keeps the full costume; pass false for cube-only.
   */
  awake?: boolean
  /** Shared cube scale; when set, figures keep unit proportions. */
  pxPerUnit?: number
  /** Cell size used to pick an efficient part grid (proportional). */
  cellWidth?: number
  cellHeight?: number
}>()

const root = ref<HTMLElement | null>(null)
const parts = ref<NumberblockScene[]>([])
const localCell = ref({ width: 0, height: 0 })
let requestId = 0
let resize: ResizeObserver | undefined

const proportional = computed(
  () => props.pxPerUnit !== undefined && props.pxPerUnit > 0,
)

/** Life on unless the caller turned it off; proportional defaults to on. */
const showLife = computed(() =>
  props.awake !== undefined ? props.awake : proportional.value,
)

const cellW = computed(() =>
  proportional.value ? (props.cellWidth ?? 0) : localCell.value.width,
)
const cellH = computed(() =>
  proportional.value ? (props.cellHeight ?? 0) : localCell.value.height,
)

const partValues = computed(() => splitOfficialAddends(props.value))

const partUnits = computed((): UnitBox[] =>
  parts.value.map((scene, index) =>
    sceneCubeUnits(scene, partValues.value[index] ?? props.value),
  ),
)

const packed = computed(() =>
  packBoxes(partUnits.value, cellW.value, cellH.value),
)

const localPx = computed(() => {
  if (proportional.value) return 0
  return fitPxPerUnitBoxes(partUnits.value, cellW.value, cellH.value)
})

const activePx = computed(() =>
  proportional.value ? (props.pxPerUnit ?? 0) : localPx.value,
)

const sized = computed(() => activePx.value > 0 && partUnits.value.length > 0)

/** SVG px hanging below the cube body (feet / limbs). */
function overhangBelow(part: NumberblockScene): number {
  return Math.max(
    0,
    part.viewY + part.height - (part.body.y + part.body.height),
  )
}

function cubeSize(index: number): { wide: number; tall: number } | null {
  if (!sized.value) return null
  const unit = partUnits.value[index]
  if (!unit) return null
  return {
    wide: unit.wide * activePx.value,
    tall: unit.tall * activePx.value,
  }
}

/**
 * Map costume so the cube body fills the top of the part box; feet sit in
 * the bottom padding so every part shares one floor line (align-items: end).
 */
function overlayStyle(part: NumberblockScene, index: number) {
  const cube = cubeSize(index)
  if (!cube) return undefined
  const { body, width, height, viewX, viewY } = part
  const bw = Math.max(body.width, 0.001)
  const bh = Math.max(body.height, 0.001)
  // Body occupies the top cube band; feet hang in padding below.
  return {
    width: `${(width / bw) * cube.wide}px`,
    height: `${(height / bh) * cube.tall}px`,
    left: `${(-((body.x - viewX) / bw) * cube.wide)}px`,
    top: `${(-((body.y - viewY) / bh) * cube.tall)}px`,
  }
}

function partBox(index: number) {
  const cube = cubeSize(index)
  const part = parts.value[index]
  if (!cube || !part) return undefined
  const belowPx =
    (overhangBelow(part) / Math.max(part.body.height, 0.001)) * cube.tall
  return {
    width: `${cube.wide}px`,
    height: `${cube.tall + belowPx}px`,
  }
}

function partSvg(part: NumberblockScene, index: number): string {
  const edge = sceneMetaOnesEdge(
    part,
    partValues.value[index] ?? props.value,
  )
  return scaleSvgStrokesForOnesEdge(part.svg, edge)
}

const figureStyle = computed(() => {
  if (!sized.value) return undefined
  return {
    "--cols": String(Math.max(1, packed.value.columns)),
    width: `${packed.value.wide * activePx.value}px`,
    height: `${packed.value.tall * activePx.value}px`,
    gap: `${PART_GAP_PX}px`,
  }
})

function measure() {
  const parent = root.value?.parentElement
  if (!parent) return
  const width = Math.max(0, parent.clientWidth - 2)
  const height = Math.max(0, parent.clientHeight - 2)
  if (width === localCell.value.width && height === localCell.value.height) {
    return
  }
  localCell.value = { width, height }
}

function observe() {
  resize?.disconnect()
  resize = undefined
  if (proportional.value) return
  const parent = root.value?.parentElement
  if (!parent) return
  resize = new ResizeObserver(measure)
  resize.observe(parent)
  measure()
}

async function load(value: number) {
  const id = ++requestId
  try {
    const next = await numberblocksAssets.getNumberblockScene(value)
    if (id !== requestId) return
    parts.value = next
  } catch {
    if (id === requestId) parts.value = []
  }
}

watch(
  () => props.value,
  (value) => {
    void load(value)
  },
  { immediate: true },
)

watch(
  () => props.pxPerUnit,
  async () => {
    await Promise.resolve()
    observe()
  },
)

watch(
  () =>
    [
      props.value,
      activePx.value,
      parts.value,
      cellW.value,
      cellH.value,
      proportional.value,
    ] as const,
  () => {
    if (!sized.value) return
    logCostumeCubeScale({
      where: proportional.value ? "ProductFigure/proportional" : "ProductFigure/fit",
      value: props.value,
      scenes: parts.value,
      partValues: partValues.value,
      pxPerUnit: activePx.value,
      pxSource: proportional.value
        ? "shared prop pxPerUnit (cell from largest costume; px fits all footprints in that cell)"
        : "local fitPxPerUnitBoxes(this figure, parent cell)",
      cellWidth: cellW.value,
      cellHeight: cellH.value,
    })
  },
)

onMounted(observe)

onUnmounted(() => {
  requestId += 1
  resize?.disconnect()
})
</script>

<template>
  <div
    ref="root"
    class="figure"
    :class="{ awake: showLife, sized }"
    :style="figureStyle"
    role="img"
    :aria-label="alt ?? String(value)"
  >
    <div
      v-for="(part, index) in parts"
      :key="index"
      class="fit"
      :style="partBox(index)"
    >
      <div
        class="life"
        :style="overlayStyle(part, index)"
        v-html="partSvg(part, index)"
      />
    </div>
  </div>
</template>

<style scoped>
.figure {
  display: grid;
  grid-template-columns: repeat(var(--cols, 1), max-content);
  align-items: end;
  justify-content: center;
  justify-items: center;
  gap: 0.04rem;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.figure.sized {
  flex: 0 0 auto;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
}

.fit {
  position: relative;
  overflow: hidden;
}

.figure.awake .fit {
  overflow: visible;
}

.life {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.life :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.figure :deep([data-part="numeral"]) {
  opacity: 0;
}

.figure :deep([data-part="limb"]),
.figure :deep([data-part="face"]) {
  opacity: 0;
  transition: opacity 0.22s ease;
}

.figure.awake :deep([data-part="limb"]),
.figure.awake :deep([data-part="face"]) {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .figure :deep([data-part="limb"]),
  .figure :deep([data-part="face"]) {
    transition: none;
  }
}
</style>
