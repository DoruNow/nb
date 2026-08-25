<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue"
import type { FieldId } from "../model/equation"
import { blockScale } from "../lib/numberblockScale"
import {
  numberblocksAssets,
  splitOfficialAddends,
} from "../lib/numberblocksSb3"
import MathInput from "./MathInput.vue"
import NumberblockView from "./NumberblockView.vue"

const MERGE_MS = 780

type CloneBox = {
  left: number
  bottom: number
  width: number
  height: number
  dx: number
  dy: number
}

const emptyBox: CloneBox = {
  left: 0,
  bottom: 0,
  width: 0,
  height: 0,
  dx: 0,
  dy: 0,
}

const props = defineProps<{
  left: number | null
  right: number | null
  answer: number | null
  operation: string
  activeField: FieldId
  correct: boolean | null
}>()

const emit = defineEmits<{
  focus: [field: FieldId]
}>()

const root = ref<HTMLElement | null>(null)
const leftFigure = ref<HTMLElement | null>(null)
const rightFigure = ref<HTMLElement | null>(null)
const answerFigure = ref<HTMLElement | null>(null)
const availableHeight = ref(280)
const columnWidth = ref(200)
const clonesOn = ref(false)
const flying = ref(false)
const revealed = ref(false)
const popping = ref(false)
const leftBox = ref<CloneBox>({ ...emptyBox })
const rightBox = ref<CloneBox>({ ...emptyBox })

let mergeTimer: ReturnType<typeof setTimeout> | undefined
let popTimer: ReturnType<typeof setTimeout> | undefined
let resize: ResizeObserver | undefined

function partsFor(value: number | null) {
  return value === null ? [] : splitOfficialAddends(value)
}

const pxPerUnit = computed(() =>
  blockScale({
    figures: [
      partsFor(props.left),
      partsFor(props.right),
      partsFor(props.answer),
    ],
    columnWidth: columnWidth.value,
    availableHeight: availableHeight.value,
  }),
)

const showAnswer = computed(
  () => props.correct !== true || revealed.value,
)

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function clearTimers() {
  if (mergeTimer) clearTimeout(mergeTimer)
  if (popTimer) clearTimeout(popTimer)
  mergeTimer = undefined
  popTimer = undefined
}

function boxFrom(
  source: DOMRect,
  dest: DOMRect,
  board: DOMRect,
  side: "left" | "right",
): CloneBox {
  const startCx = source.left + source.width / 2
  const destCx = dest.left + dest.width / 2
  const touch = Math.min(28, source.width * 0.35)
  const meetCx = side === "left" ? destCx - touch : destCx + touch
  return {
    left: source.left - board.left,
    bottom: board.bottom - source.bottom,
    width: source.width,
    height: source.height,
    dx: meetCx - startCx,
    dy: dest.bottom - source.bottom,
  }
}

function measureClones() {
  const board = root.value?.getBoundingClientRect()
  const left = leftFigure.value?.getBoundingClientRect()
  const right = rightFigure.value?.getBoundingClientRect()
  const dest = answerFigure.value?.getBoundingClientRect()
  if (!board || !left || !right || !dest) return false
  leftBox.value = boxFrom(left, dest, board, "left")
  rightBox.value = boxFrom(right, dest, board, "right")
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

async function celebrate() {
  await numberblocksAssets.playSound("pop")
  if (props.answer !== null) {
    await numberblocksAssets.playNumberName(props.answer)
  }
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
  clearTimers()
  clonesOn.value = false
  flying.value = false
  revealed.value = false
  popping.value = false
}

watch(
  () => props.correct,
  (value) => {
    if (value === true) void runMerge()
    else resetMerge()
  },
)

onMounted(() => {
  resize = new ResizeObserver(() => {
    const figure = leftFigure.value
    if (!figure) return
    availableHeight.value = Math.max(80, figure.clientHeight - 8)
    columnWidth.value = Math.max(48, figure.clientWidth)
  })
  if (root.value) resize.observe(root.value)
  if (leftFigure.value) resize.observe(leftFigure.value)
})

onUnmounted(() => {
  resize?.disconnect()
  clearTimers()
})
</script>

<template>
  <div ref="root" class="board" role="group" aria-label="Addition equation">
    <div class="column">
      <MathInput
        :value="left"
        :active="activeField === 'left'"
        slot-label="First number"
        @focus="emit('focus', 'left')"
      />
      <div ref="leftFigure" class="figure">
        <NumberblockView :value="left" :px-per-unit="pxPerUnit" />
      </div>
    </div>

    <span class="op" aria-hidden="true">{{ operation }}</span>

    <div class="column">
      <MathInput
        :value="right"
        :active="activeField === 'right'"
        slot-label="Second number"
        @focus="emit('focus', 'right')"
      />
      <div ref="rightFigure" class="figure">
        <NumberblockView :value="right" :px-per-unit="pxPerUnit" />
      </div>
    </div>

    <span class="op" aria-hidden="true">=</span>

    <div class="column">
      <MathInput
        :value="answer"
        :visible="showAnswer"
        :active="activeField === 'answer'"
        slot-label="Answer"
        @focus="emit('focus', 'answer')"
      />
      <div
        ref="answerFigure"
        class="figure"
        :class="{ waiting: !showAnswer }"
      >
        <NumberblockView
          :value="answer"
          :px-per-unit="pxPerUnit"
          :jumping="popping"
        />
      </div>
    </div>

    <div v-if="clonesOn" class="merge-layer" aria-hidden="true">
      <div
        class="clone"
        :class="{ flying }"
        :style="cloneStyle(leftBox)"
      >
        <NumberblockView :value="left" :px-per-unit="pxPerUnit" />
      </div>
      <div
        class="clone"
        :class="{ flying }"
        :style="cloneStyle(rightBox)"
      >
        <NumberblockView :value="right" :px-per-unit="pxPerUnit" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.board {
  position: relative;
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
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
  display: flex;
  align-items: flex-end;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  width: 100%;
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
}

@media (prefers-reduced-motion: reduce) {
  .clone {
    transition: none;
  }
}
</style>
