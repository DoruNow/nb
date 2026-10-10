<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue"
import { TABLE_MAX } from "../lib/math"
import { glowFor, paintClass, paintStyle } from "../lib/numberblockColors"
import { logSharedPxChoice } from "../lib/cubeScaleDebug"
import {
  fitPxPerUnitBoxes,
  scaleFromLargestCostume,
} from "../lib/numberblockScale"
import {
  numberblocksAssets,
  sceneCubeUnits,
  splitOfficialAddends,
} from "../lib/numberblocksSb3"
import {
  cancelSpeech,
  speakNumberName,
  speakOperator,
  unlockSpeech,
} from "../lib/speak"
import NumberblockView from "./NumberblockView.vue"
import ProductFigure from "./ProductFigure.vue"

const props = withDefaults(
  defineProps<{
    max?: number
    proportional?: boolean
  }>(),
  { max: TABLE_MAX, proportional: false },
)

type Picked = { row: number; col: number }
/** Which axis stays opaque while the fact is read aloud. */
type SpeakFocus = "row" | "col" | "both"
/** Which fact number jiggles while it is spoken. */
type JigglePart = "row" | "col" | "product"

const hover = ref<{ row: number | null; col: number | null } | null>(null)
const picked = ref<Picked | null>(null)
const speakFocus = ref<SpeakFocus>("both")
const jigglePart = ref<JigglePart | null>(null)
const sheetEl = ref<HTMLElement | null>(null)
const stageEl = ref<HTMLElement | null>(null)
const cellWidth = ref(0)
const cellHeight = ref(0)
const stageWidth = ref(0)
const stageHeight = ref(0)
const tablePx = ref<number | undefined>(undefined)
const detailPx = ref<number | undefined>(undefined)
let speakGen = 0
let resize: ResizeObserver | undefined
let scaleRequest = 0

const factors = computed(() => {
  const size = Math.min(TABLE_MAX, Math.max(1, Math.floor(props.max)))
  return Array.from({ length: size }, (_, index) => index + 1)
})

const axis = computed(() => factors.value.length + 1)
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${axis.value}, minmax(0, 1fr))`,
  gridTemplateRows: `repeat(${axis.value}, minmax(0, 1fr))`,
}))

const open = computed(() => picked.value !== null)

const selectedValue = computed(() => {
  if (!picked.value) return null
  return picked.value.row * picked.value.col
})

const selectedGlow = computed(() => glowFor(selectedValue.value) ?? "#c4a57a")

async function recomputeScale() {
  if (!props.proportional) {
    tablePx.value = undefined
    detailPx.value = undefined
    return
  }
  const id = ++scaleRequest
  if (cellWidth.value > 0 && cellHeight.value > 0) {
    const seen = new Set<number>()
    const costumes: Array<{
      part: number
      figureValue?: number
      units: ReturnType<typeof sceneCubeUnits>
      cellWidth: number
      cellHeight: number
      soloPx: number
      squaresFound: number
    }> = []
    for (const row of factors.value) {
      for (const col of factors.value) {
        const value = row * col
        if (seen.has(value)) continue
        seen.add(value)
        try {
          const scenes = await numberblocksAssets.getNumberblockScene(value)
          if (id !== scaleRequest) return
          const parts = splitOfficialAddends(value)
          for (let index = 0; index < scenes.length; index += 1) {
            const scene = scenes[index]!
            const part = parts[index] ?? value
            const units = sceneCubeUnits(scene, part)
            const soloPx = fitPxPerUnitBoxes(
              [units],
              cellWidth.value,
              cellHeight.value,
            )
            costumes.push({
              part,
              figureValue: value,
              units,
              cellWidth: cellWidth.value,
              cellHeight: cellHeight.value,
              soloPx,
              squaresFound: scene.squareCount,
            })
          }
        } catch {
          // skip
        }
      }
    }
    if (id !== scaleRequest) return
    if (costumes.length > 0) {
      const scale = scaleFromLargestCostume({
        costumes: costumes.map((costume) => ({
          part: costume.part,
          units: costume.units,
          cellWidth: costume.cellWidth,
          cellHeight: costume.cellHeight,
        })),
      })
      tablePx.value = scale.pxPerUnit > 0 ? scale.pxPerUnit : undefined
      if (scale.pxPerUnit > 0) {
        logSharedPxChoice({
          where: "TimesTable",
          costumes,
          chosenPart: scale.largestPart,
          chosenPx: scale.pxPerUnit,
          refCellWidth: scale.cellWidth,
          refCellHeight: scale.cellHeight,
          limitingPart: scale.limitingPart,
        })
      }
    } else {
      tablePx.value = undefined
    }
  }
  if (
    selectedValue.value !== null &&
    stageWidth.value > 0 &&
    stageHeight.value > 0
  ) {
    try {
      const scenes = await numberblocksAssets.getNumberblockScene(
        selectedValue.value,
      )
      if (id !== scaleRequest) return
      const parts = splitOfficialAddends(selectedValue.value)
      detailPx.value = scaleFromLargestCostume({
        costumes: scenes.map((scene, index) => ({
          part: parts[index] ?? selectedValue.value!,
          units: sceneCubeUnits(scene, parts[index] ?? selectedValue.value!),
          cellWidth: stageWidth.value,
          cellHeight: stageHeight.value,
        })),
      }).pxPerUnit
    } catch {
      detailPx.value = undefined
    }
  } else {
    detailPx.value = undefined
  }
}

function measureCells() {
  const cell = sheetEl.value?.querySelector(".cell")
  if (cell instanceof HTMLElement) {
    cellWidth.value = Math.max(0, cell.clientWidth - 4)
    cellHeight.value = Math.max(0, cell.clientHeight - 4)
  }
  if (stageEl.value) {
    stageWidth.value = Math.max(0, stageEl.value.clientWidth - 8)
    stageHeight.value = Math.max(0, stageEl.value.clientHeight - 8)
  }
  void recomputeScale()
}

function observe() {
  resize?.disconnect()
  resize = new ResizeObserver(measureCells)
  if (sheetEl.value) resize.observe(sheetEl.value)
  if (stageEl.value) resize.observe(stageEl.value)
  measureCells()
}

function product(row: number, col: number) {
  return row * col
}

function headerGlow(n: number) {
  return glowFor(n) ?? "#c4a57a"
}

function isRowHot(row: number) {
  if (hover.value?.row === row) return true
  return picked.value?.row === row
}

function isColHot(col: number) {
  if (hover.value?.col === col) return true
  return picked.value?.col === col
}

function isCellHot(row: number, col: number) {
  return isRowHot(row) || isColHot(col)
}

function isCellOn(row: number, col: number) {
  return hover.value?.row === row && hover.value?.col === col
}

function isCellPicked(row: number, col: number) {
  return picked.value?.row === row && picked.value?.col === col
}

function isRowKept(row: number) {
  if (picked.value?.row !== row) return false
  return speakFocus.value === "row" || speakFocus.value === "both"
}

function isColKept(col: number) {
  if (picked.value?.col !== col) return false
  return speakFocus.value === "col" || speakFocus.value === "both"
}

function isCellKept(row: number, col: number) {
  return isRowKept(row) || isColKept(col)
}

function isRowJiggle(row: number) {
  return jigglePart.value === "row" && picked.value?.row === row
}

function isColJiggle(col: number) {
  return jigglePart.value === "col" && picked.value?.col === col
}

function cellGlow(row: number, col: number) {
  if (isRowHot(row)) return headerGlow(row)
  if (isColHot(col)) return headerGlow(col)
  return headerGlow(product(row, col))
}

function onProductEnter(row: number, col: number) {
  hover.value = { row, col }
}

function onRowHeadEnter(row: number) {
  hover.value = { row, col: null }
}

function onColHeadEnter(col: number) {
  hover.value = { row: null, col }
}

function onLeave() {
  hover.value = null
}

function stopNarration() {
  speakGen += 1
  cancelSpeech()
  numberblocksAssets.stopAllSounds()
  speakFocus.value = "both"
  jigglePart.value = null
}

function pause(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function narrateFact(row: number, col: number, gen: number) {
  speakFocus.value = "row"
  jigglePart.value = "row"
  await speakNumberName(row)
  if (gen !== speakGen) return
  await pause(500)
  if (gen !== speakGen) return
  jigglePart.value = null

  await speakOperator("times")
  if (gen !== speakGen) return

  speakFocus.value = "col"
  jigglePart.value = "col"
  await speakNumberName(col)
  jigglePart.value = null
  if (gen !== speakGen) return

  await speakOperator("equals")
  if (gen !== speakGen) return

  speakFocus.value = "both"
  jigglePart.value = "product"
  await speakNumberName(row * col)
  if (gen === speakGen) jigglePart.value = null
}

function pickProduct(row: number, col: number) {
  if (isCellPicked(row, col)) {
    stopNarration()
    picked.value = null
    return
  }

  picked.value = { row, col }
  const gen = ++speakGen
  speakFocus.value = "row"
  unlockSpeech()
  cancelSpeech()
  numberblocksAssets.stopAllSounds()
  void numberblocksAssets.unlockAudio()
  void narrateFact(row, col, gen)
}

function clearPicked() {
  stopNarration()
  picked.value = null
}

watch(
  () => props.max,
  () => {
    const size = factors.value[factors.value.length - 1] ?? 0
    const current = picked.value
    if (!current) return
    if (current.row > size || current.col > size) {
      stopNarration()
      picked.value = null
    }
  },
)

watch(
  () => [props.proportional, props.max, open.value] as const,
  async () => {
    await nextTick()
    observe()
  },
)

onMounted(observe)

onUnmounted(() => {
  stopNarration()
  resize?.disconnect()
})
</script>

<template>
  <div
    class="board"
    :class="{ open, proportional }"
    role="region"
    aria-label="Multiplication table"
    @pointerleave="onLeave"
  >
    <table ref="sheetEl" class="sheet" :style="gridStyle">
      <thead>
        <tr>
          <th class="corner" scope="col">
            <span aria-hidden="true">×</span>
            <span class="sr">Times</span>
          </th>
          <th
            v-for="col in factors"
            :key="`col-${col}`"
            scope="col"
            class="head col-head"
            :class="{
              hot: isColHot(col),
              kept: isColKept(col),
              jiggle: isColJiggle(col),
            }"
            :style="{ '--glow': headerGlow(col) }"
            @pointerenter="onColHeadEnter(col)"
          >
            <span :class="paintClass(col)" :style="paintStyle(col)">{{
              col
            }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in factors" :key="`row-${row}`">
          <th
            scope="row"
            class="head row-head"
            :class="{
              hot: isRowHot(row),
              kept: isRowKept(row),
              jiggle: isRowJiggle(row),
            }"
            :style="{ '--glow': headerGlow(row) }"
            @pointerenter="onRowHeadEnter(row)"
          >
            <span :class="paintClass(row)" :style="paintStyle(row)">{{
              row
            }}</span>
          </th>
          <td
            v-for="col in factors"
            :key="`${row}x${col}`"
            class="cell"
            :class="{
              hot: isCellHot(row, col),
              on: isCellOn(row, col) && !isCellPicked(row, col),
              picked: isCellPicked(row, col),
              kept: isCellKept(row, col),
            }"
            :style="{ '--glow': cellGlow(row, col) }"
          >
            <button
              type="button"
              class="hit"
              :aria-label="`${row} times ${col} equals ${product(row, col)}`"
              :aria-pressed="isCellPicked(row, col)"
              @pointerenter="onProductEnter(row, col)"
              @click="pickProduct(row, col)"
            >
              <ProductFigure
                :value="product(row, col)"
                :alt="String(product(row, col))"
                :awake="
                  proportional ||
                  isCellOn(row, col) ||
                  isCellPicked(row, col)
                "
                :px-per-unit="tablePx"
                :cell-width="cellWidth"
                :cell-height="cellHeight"
              />
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <aside
      class="detail"
      :class="{ show: open }"
      :style="{ '--glow': selectedGlow }"
      :aria-hidden="!open"
    >
      <template v-if="picked && selectedValue !== null">
        <button
          type="button"
          class="close"
          aria-label="Close number"
          @click="clearPicked"
        >
          ×
        </button>
        <p class="fact">
          <span
            class="fact-num"
            :class="[paintClass(picked.row), { jiggle: jigglePart === 'row' }]"
            :style="paintStyle(picked.row)"
            >{{ picked.row }}</span
          >
          <span class="op">×</span>
          <span
            class="fact-num"
            :class="[paintClass(picked.col), { jiggle: jigglePart === 'col' }]"
            :style="paintStyle(picked.col)"
            >{{ picked.col }}</span
          >
          <span class="op">=</span>
          <span
            class="fact-num"
            :class="[
              paintClass(selectedValue),
              { jiggle: jigglePart === 'product' },
            ]"
            :style="paintStyle(selectedValue)"
            >{{ selectedValue }}</span
          >
        </p>
        <div ref="stageEl" class="stage">
          <ProductFigure
            v-if="proportional && selectedValue !== null"
            :key="`prop-${picked.row}x${picked.col}`"
            :value="selectedValue"
            :alt="String(selectedValue)"
            :px-per-unit="detailPx"
            :cell-width="stageWidth"
            :cell-height="stageHeight"
            awake
          />
          <NumberblockView
            v-else
            :key="`${picked.row}x${picked.col}`"
            :value="selectedValue"
            :alt="String(selectedValue)"
            keep-numeral
            fill
            stack
          />
        </div>
      </template>
    </aside>
  </div>
</template>

<style scoped>
.board {
  --fact-size: clamp(1.2rem, 7.5cqmin, 2rem);
  display: flex;
  align-items: stretch;
  gap: 0;
  flex: 1;
  width: 100%;
  min-width: 0;
  min-height: 0;
  container-type: size;
}

.board.open {
  gap: 0.65rem;
}

.sheet {
  flex: 1 1 auto;
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  gap: 0.12rem;
}

.sheet :where(thead, tbody, tr) {
  display: contents;
}

.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.corner,
.head,
.cell {
  min-width: 0;
  min-height: 0;
  user-select: none;
  transition: opacity 0.2s ease;
}

.board.open :is(.corner, .head, .cell) {
  opacity: 0.1;
}

.board.open :is(.head, .cell).kept {
  opacity: 1;
}

.corner,
.head {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.corner {
  color: #8a8378;
  font-size: clamp(0.75rem, 5.8cqmin, 1.35rem);
}

.head {
  position: relative;
  z-index: 0;
  overflow: visible;
  font-size: clamp(0.72rem, 5.6cqmin, 1.35rem);
  border-radius: 0.45rem;
  background: color-mix(in srgb, var(--glow) 16%, rgba(255, 255, 255, 0.42));
  transition:
    opacity 0.2s ease,
    font-size 0.22s ease,
    background 0.2s ease;
}

.head.hot {
  background: color-mix(in srgb, var(--glow) 30%, #fff);
}

.head.kept {
  z-index: 4;
  font-size: var(--fact-size);
}

.head.jiggle > span,
.fact-num.jiggle {
  display: inline-block;
  animation: jiggle 0.7s ease-in-out infinite;
  transform-origin: center bottom;
}

@keyframes jiggle {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  22% {
    transform: translateY(-0.12em) rotate(-8deg);
  }
  48% {
    transform: translateY(-0.04em) rotate(7deg);
  }
  74% {
    transform: translateY(-0.1em) rotate(-6deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .head.jiggle > span,
  .fact-num.jiggle {
    animation: none;
  }
}

.cell {
  position: relative;
  overflow: hidden;
  border-radius: 0.45rem;
  background: rgba(255, 255, 255, 0.28);
}

.cell.hot {
  background: color-mix(in srgb, var(--glow) 12%, rgba(255, 255, 255, 0.4));
}

.cell.on {
  z-index: 2;
  overflow: visible;
}

.cell.picked {
  z-index: 1;
  overflow: hidden;
}

/* Proportional keeps eyes/limbs; let costume life paint past the cube box. */
.board.proportional .cell,
.board.proportional .cell.picked {
  overflow: visible;
}

.board.proportional .cell.on,
.board.proportional .cell.picked {
  z-index: 2;
}

.hit {
  appearance: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: 0.06rem;
  border: 0;
  border-radius: inherit;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  box-shadow:
    0 2px 0 rgba(40, 20, 0, 0.08),
    inset 0 0 0 1px rgba(255, 255, 255, 0.28);
  transition:
    transform 0.12s ease,
    box-shadow 0.12s ease,
    filter 0.12s ease;
}

.hit:hover {
  box-shadow:
    0 2px 0 rgba(40, 20, 0, 0.08),
    inset 0 0 0 1px color-mix(in srgb, var(--glow) 35%, rgba(255, 255, 255, 0.4));
}

.cell.picked .hit {
  transform: translateY(2px);
  filter: brightness(0.96);
  box-shadow:
    inset 0 3px 7px rgba(40, 20, 0, 0.22),
    inset 0 0 0 1px rgba(40, 20, 0, 0.08);
}

.detail {
  display: flex;
  flex-direction: column;
  flex: 0 0 0;
  width: 0;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  border-radius: 1.15rem;
  background: color-mix(in srgb, var(--glow) 14%, rgba(255, 255, 255, 0.78));
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--glow) 38%, transparent);
  transition:
    opacity 0.2s ease,
    flex-basis 0.28s ease,
    width 0.28s ease;
}

.detail.show {
  flex: 0 0 25%;
  width: 25%;
  opacity: 1;
  pointer-events: auto;
  overflow: hidden;
}

.board.proportional .detail.show {
  overflow: visible;
}

.close {
  appearance: none;
  align-self: end;
  flex: 0 0 auto;
  margin: 0.3rem 0.45rem 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #7a746c;
  font: inherit;
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
}

.fact {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.15rem 0.25rem;
  margin: 0.05rem 0.5rem 0.15rem;
  font-size: var(--fact-size);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.op {
  color: #5a554e;
}

.stage {
  position: relative;
  flex: 1 1 auto;
  display: flex;
  align-items: stretch;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: 0.1rem 0.55rem 0.65rem;
}

.board.proportional .stage {
  overflow: visible;
}

@media (max-width: 720px) {
  .board.open {
    flex-direction: column;
  }

  .detail.show {
    flex: 0 0 28%;
    width: 100%;
  }

  .sheet {
    gap: 0.08rem;
  }

  .head,
  .cell {
    border-radius: 0.32rem;
  }
}
</style>
