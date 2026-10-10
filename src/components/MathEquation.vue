<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue"
import type { Column, ColumnId } from "../model/equation"
import type { Operation } from "../lib/math"
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
import { cancelSpeech, speakNumberName, speakOperator } from "../lib/speak"
import MathInput from "./MathInput.vue"
import NumberblockView from "./NumberblockView.vue"
import ProductFigure from "./ProductFigure.vue"

const MERGE_MS = 780

type CloneBox = {
  left: number
  bottom: number
  width: number
  height: number
  dx: number
  dy: number
}

const props = defineProps<{
  columns: Column[]
  operators: Operation[]
  activeField: ColumnId
  correct: boolean | null
  proportional?: boolean
}>()

const emit = defineEmits<{
  focus: [field: ColumnId]
}>()

const root = ref<HTMLElement | null>(null)
const clonesOn = ref(false)
const flying = ref(false)
const revealed = ref(false)
const popping = ref(false)
const speakingId = ref<ColumnId | null>(null)
const speakingOp = ref<number | null>(null)
const cloneBoxes = ref<CloneBox[]>([])
const cloneValues = ref<(number | null)[]>([])
const sharedPx = ref(1)
const cellSize = ref({ width: 0, height: 0 })
let celebrateGen = 0
let resize: ResizeObserver | undefined
let scaleRequest = 0

const figureEls = new Map<string, HTMLElement>()

let mergeTimer: ReturnType<typeof setTimeout> | undefined
let popTimer: ReturnType<typeof setTimeout> | undefined

function setFigureRef(id: string, el: unknown) {
  if (el instanceof HTMLElement) figureEls.set(id, el)
  else figureEls.delete(id)
}

async function measureScale() {
  if (!props.proportional) {
    sharedPx.value = 1
    return
  }
  const id = ++scaleRequest
  const visible = props.columns.filter((column) => {
    if (column.value === null) return false
    if (column.kind === "answer" && !showAnswer.value) return false
    return true
  })
  if (visible.length === 0) return

  const costumes: Array<{
    part: number
    figureValue?: number
    units: ReturnType<typeof sceneCubeUnits>
    cellWidth: number
    cellHeight: number
    soloPx: number
    squaresFound: number
  }> = []

  for (const column of visible) {
    const value = column.value
    if (value === null) continue
    const el = figureEls.get(column.id)
    const cellWidth = Math.max(0, (el?.clientWidth ?? 0) - 8)
    const cellHeight = Math.max(0, (el?.clientHeight ?? 0) - 8)
    if (cellWidth <= 0 || cellHeight <= 0) continue
    // Keep a representative cell for ProductFigure packing.
    cellSize.value = { width: cellWidth, height: cellHeight }
    try {
      const scenes = await numberblocksAssets.getNumberblockScene(value)
      if (id !== scaleRequest) return
      const parts = splitOfficialAddends(value)
      for (let index = 0; index < scenes.length; index += 1) {
        const scene = scenes[index]!
        const part = parts[index] ?? value
        const units = sceneCubeUnits(scene, part)
        const soloPx = fitPxPerUnitBoxes([units], cellWidth, cellHeight)
        costumes.push({
          part,
          figureValue: value,
          units,
          cellWidth,
          cellHeight,
          soloPx,
          squaresFound: scene.squareCount,
        })
      }
    } catch {
      // skip unloadable values
    }
  }
  if (id !== scaleRequest || costumes.length === 0) return

  const scale = scaleFromLargestCostume({
    costumes: costumes.map((costume) => ({
      part: costume.part,
      units: costume.units,
      cellWidth: costume.cellWidth,
      cellHeight: costume.cellHeight,
    })),
  })
  if (scale.pxPerUnit > 0) {
    sharedPx.value = scale.pxPerUnit
    cellSize.value = {
      width: scale.cellWidth,
      height: scale.cellHeight,
    }
    logSharedPxChoice({
      where: "MathEquation",
      costumes,
      chosenPart: scale.largestPart,
      chosenPx: scale.pxPerUnit,
      refCellWidth: scale.cellWidth,
      refCellHeight: scale.cellHeight,
      limitingPart: scale.limitingPart,
    })
  }
}

function observeScale() {
  resize?.disconnect()
  resize = undefined
  if (!props.proportional) return
  resize = new ResizeObserver(() => {
    void measureScale()
  })
  if (root.value) resize.observe(root.value)
  for (const el of figureEls.values()) resize.observe(el)
  void measureScale()
}

const termColumns = computed(() =>
  props.columns.filter((column) => column.kind === "term"),
)

const answerColumn = computed(
  () => props.columns.find((column) => column.kind === "answer") ?? null,
)

const showAnswer = computed(() => props.correct !== true || revealed.value)

const gridTemplateColumns = computed(() =>
  props.columns
    .map((_, index) =>
      index === 0
        ? "minmax(min-content, 1fr)"
        : "auto minmax(min-content, 1fr)",
    )
    .join(" "),
)

function symbolBefore(index: number): string {
  const column = props.columns[index]
  if (!column || column.kind === "answer") return "="
  const operation = props.operators[index - 1]
  if (operation === "-") return "−"
  if (operation === "×") return "×"
  if (operation === "÷") return "÷"
  return operation ?? "+"
}

function spokenOp(operation: Operation): "plus" | "minus" | "times" | "divided by" {
  if (operation === "-") return "minus"
  if (operation === "×") return "times"
  if (operation === "÷") return "divided by"
  return "plus"
}

function slotLabel(column: Column, index: number): string {
  if (column.kind === "answer") return "Answer"
  if (index === 0) return "First number"
  return `Number ${index + 1}`
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function clearTimers() {
  if (mergeTimer) clearTimeout(mergeTimer)
  if (popTimer) clearTimeout(popTimer)
  mergeTimer = undefined
  popTimer = undefined
}

function boxFrom(source: DOMRect, dest: DOMRect, board: DOMRect): CloneBox {
  const startCx = source.left + source.width / 2
  const destCx = dest.left + dest.width / 2
  return {
    left: source.left - board.left,
    bottom: board.bottom - source.bottom,
    width: source.width,
    height: source.height,
    dx: destCx - startCx,
    dy: dest.bottom - source.bottom,
  }
}

function measureClones() {
  const board = root.value?.getBoundingClientRect()
  const destEl = answerColumn.value
    ? figureEls.get(answerColumn.value.id)
    : undefined
  const dest = destEl?.getBoundingClientRect()
  if (!board || !dest) return false

  const boxes: CloneBox[] = []
  const values: (number | null)[] = []
  for (const column of termColumns.value) {
    if (column.value === null) continue
    const source = figureEls.get(column.id)?.getBoundingClientRect()
    if (!source) continue
    boxes.push(boxFrom(source, dest, board))
    values.push(column.value)
  }
  if (boxes.length === 0) return false
  cloneBoxes.value = boxes
  cloneValues.value = values
  return true
}

function cloneStyle(box: CloneBox) {
  return {
    left: `${box.left}px`,
    bottom: `${box.bottom}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
    "--dx": `${box.dx}px`,
    "--dy": `${box.dy}px`,
  }
}

function stillCelebrating(gen: number) {
  return gen === celebrateGen
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function speakColumn(column: Column, gen: number) {
  if (column.kind === "answer") popping.value = true
  else speakingId.value = column.id

  const value = column.value
  if (value !== null) {
    await speakNumberName(value)
  } else {
    await sleep(280)
  }

  if (!stillCelebrating(gen)) return
  speakingId.value = null
  if (column.kind === "answer") {
    popTimer = setTimeout(() => {
      popping.value = false
    }, 450)
  }
}

async function celebrate() {
  const gen = ++celebrateGen
  await numberblocksAssets.playSound("pop")
  if (!stillCelebrating(gen)) return

  const terms = termColumns.value
  const ops = props.operators
  for (let i = 0; i < terms.length; i++) {
    if (!stillCelebrating(gen)) return
    if (i > 0) {
      speakingOp.value = i
      await speakOperator(spokenOp(ops[i - 1]))
      if (!stillCelebrating(gen)) return
      speakingOp.value = null
    }
    await speakColumn(terms[i], gen)
  }

  const answer = answerColumn.value
  if (!answer || answer.value === null || !stillCelebrating(gen)) return
  speakingOp.value = props.columns.indexOf(answer)
  await speakOperator("equals")
  if (!stillCelebrating(gen)) return
  speakingOp.value = null
  await speakColumn(answer, gen)
}

function finishMerge() {
  clonesOn.value = false
  flying.value = false
  revealed.value = true
  popping.value = true
  void celebrate()
  popTimer = setTimeout(() => {
    popping.value = false
  }, 500)
}

async function runMerge() {
  clearTimers()
  revealed.value = false
  popping.value = false
  flying.value = false
  clonesOn.value = false

  if (prefersReducedMotion()) {
    revealed.value = true
    popping.value = true
    void celebrate()
    popTimer = setTimeout(() => {
      popping.value = false
    }, 500)
    return
  }

  await nextTick()
  if (!measureClones()) {
    revealed.value = true
    void celebrate()
    return
  }
  clonesOn.value = true
  await nextTick()
  requestAnimationFrame(() => {
    flying.value = true
  })
  mergeTimer = setTimeout(finishMerge, MERGE_MS)
}

function resetMerge() {
  celebrateGen += 1
  cancelSpeech()
  numberblocksAssets.stopAllSounds()
  clearTimers()
  clonesOn.value = false
  flying.value = false
  revealed.value = false
  popping.value = false
  speakingId.value = null
  speakingOp.value = null
}

watch(
  () => props.correct,
  (value) => {
    if (value === true) void runMerge()
    else resetMerge()
  },
)

watch(
  () =>
    [
      props.proportional,
      props.columns.map((column) => column.value).join(","),
      revealed.value,
    ] as const,
  async () => {
    await nextTick()
    observeScale()
  },
)

onMounted(async () => {
  await nextTick()
  observeScale()
})

onUnmounted(() => {
  celebrateGen += 1
  cancelSpeech()
  numberblocksAssets.stopAllSounds()
  clearTimers()
  resize?.disconnect()
})
</script>

<template>
  <div
    ref="root"
    class="board"
    role="group"
    aria-label="Equation"
    :style="{ gridTemplateColumns }"
  >
    <template v-for="(column, index) in columns" :key="column.id">
      <span
        v-if="index > 0"
        class="op"
        :class="{ spoken: speakingOp === index }"
        aria-hidden="true"
      >
        {{ symbolBefore(index) }}
      </span>

      <div class="column">
        <MathInput
          :value="column.value"
          :visible="column.kind !== 'answer' || showAnswer"
          :active="activeField === column.id"
          :slot-label="slotLabel(column, index)"
          @focus="emit('focus', column.id)"
        />
        <div
          :ref="(el) => setFigureRef(column.id, el)"
          class="figure"
          :class="{ waiting: column.kind === 'answer' && !showAnswer }"
        >
          <ProductFigure
            v-if="proportional && column.value !== null"
            :value="column.value"
            :px-per-unit="sharedPx"
            :cell-width="cellSize.width"
            :cell-height="cellSize.height"
            awake
          />
          <NumberblockView
            v-else
            fill
            :value="column.value"
            :jumping="column.kind === 'answer' && popping"
            :speaking="column.kind === 'term' && speakingId === column.id"
          />
        </div>
      </div>
    </template>

    <div v-if="clonesOn" class="merge-layer" aria-hidden="true">
      <div
        v-for="(box, index) in cloneBoxes"
        :key="index"
        class="clone"
        :class="{ flying }"
        :style="cloneStyle(box)"
      >
        <ProductFigure
          v-if="proportional && cloneValues[index] !== null"
          :value="cloneValues[index]!"
          :px-per-unit="sharedPx"
          :cell-width="box.width"
          :cell-height="box.height"
          awake
        />
        <NumberblockView v-else fill :value="cloneValues[index]" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.board {
  position: relative;
  flex: 1;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  align-items: stretch;
  gap: clamp(0.4rem, 1.6vw, 1.1rem);
  width: 100%;
  min-width: 0;
  min-height: 0;
}

.column {
  display: grid;
  grid-template-rows: subgrid;
  grid-row: 1 / -1;
  justify-items: stretch;
  min-width: 0;
  min-height: 0;
}

.figure {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
}

.figure.waiting {
  opacity: 0;
}

.merge-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 4;
}

.clone {
  position: absolute;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  transform: translate(0, 0);
  transition: transform 0.78s cubic-bezier(0.33, 0.1, 0.25, 1);
}

.clone.flying {
  transform: translate(var(--dx, 0px), var(--dy, 0px));
}

.op {
  grid-row: 1;
  align-self: center;
  justify-self: center;
  min-width: clamp(1.4rem, 4vw, 3rem);
  font-size: clamp(2.6rem, 6vw, 3.8rem);
  font-weight: 800;
  color: #1a1a1a;
  line-height: 1;
  text-align: center;
  user-select: none;
  transition: transform 0.2s ease;
}

.op.spoken {
  transform: scale(1.18);
}

@media (prefers-reduced-motion: reduce) {
  .clone {
    transition: none;
  }
}
</style>
