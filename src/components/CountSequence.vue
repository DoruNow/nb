<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue"
import type { CountColumn } from "../model/count"
import {
  blockScale,
  pxPerUnitShared,
} from "../lib/numberblockScale"
import { splitOfficialAddends } from "../lib/numberblocksSb3"
import { numberblocksAssets } from "../lib/numberblocksSb3"
import { speakNumberName } from "../lib/speak"
import { glowFor, paintClass, paintStyle } from "../lib/numberblockColors"
import MathInput from "./MathInput.vue"
import NumberblockView from "./NumberblockView.vue"

const FIVE_CUBES = [1, 2, 3, 4, 5] as const
const BETWEEN_NUMBERS_MS = 1000

const props = defineProps<{
  columns: CountColumn[]
  step: number | null
  activeIndex: number
  complete: boolean
  justLockedIndex: number | null
  proportional?: boolean
}>()

const root = ref<HTMLElement | null>(null)
const availableHeight = ref(160)
const columnWidth = ref(140)
const hoppingIndex = ref<number | null>(null)
const hoppingAll = ref(false)
const finale = ref(false)

const figureEls = new Map<string, HTMLElement>()
let hopTimer: ReturnType<typeof setTimeout> | undefined
let resize: ResizeObserver | undefined
let celebrateGen = 0

function stillCelebrating(gen: number) {
  return gen === celebrateGen
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

function stopFinale() {
  celebrateGen += 1
  hoppingIndex.value = null
  hoppingAll.value = false
  finale.value = false
  if (hopTimer) clearTimeout(hopTimer)
  numberblocksAssets.stopAllSounds()
}

function setFigureRef(id: string, el: unknown) {
  if (el instanceof HTMLElement) figureEls.set(id, el)
  else figureEls.delete(id)
}

function partsFor(value: number | null) {
  return value === null ? [] : splitOfficialAddends(value)
}

const pxPerUnit = computed(() => {
  if (props.proportional) {
    return pxPerUnitShared({
      figures: props.columns.flatMap((column) => {
        if (column.value === null) return []
        return [
          {
            value: column.value,
            parts: partsFor(column.value),
            cellWidth: columnWidth.value,
            cellHeight: availableHeight.value,
          },
        ]
      }),
    })
  }
  return blockScale({
    figures: props.columns.map((column) => partsFor(column.value)),
    columnWidth: columnWidth.value,
    availableHeight: availableHeight.value,
  })
})

function slotLabel(index: number): string {
  return `Number ${index + 1}`
}

function measureStage() {
  const first = props.columns[0]
  const figure = first ? figureEls.get(first.id) : undefined
  if (!figure) return
  availableHeight.value = Math.max(48, figure.clientHeight - 8)
  columnWidth.value = Math.max(40, figure.clientWidth)
}

function observeStage() {
  resize?.disconnect()
  resize = new ResizeObserver(measureStage)
  if (root.value) resize.observe(root.value)
  const first = props.columns[0]
  const figure = first ? figureEls.get(first.id) : undefined
  if (figure) resize.observe(figure)
  measureStage()
}

async function speakColumn(index: number) {
  hoppingIndex.value = index
  const value = props.columns[index]?.value
  if (value !== null) {
    await speakNumberName(value)
  } else {
    await sleep(220)
  }
}

async function celebrateLock(index: number) {
  const gen = ++celebrateGen
  hoppingAll.value = false
  hoppingIndex.value = index

  await speakColumn(index)
  if (!stillCelebrating(gen)) return

  if (props.complete) {
    await sleep(BETWEEN_NUMBERS_MS)
    if (!stillCelebrating(gen)) return
    await celebrateFinish()
    return
  }

  if (hopTimer) clearTimeout(hopTimer)
  hopTimer = setTimeout(() => {
    if (stillCelebrating(gen)) hoppingIndex.value = null
  }, 840)
}

async function celebrateFinish() {
  const gen = ++celebrateGen
  hoppingAll.value = false
  hoppingIndex.value = null
  finale.value = true

  await numberblocksAssets.playSound("pop")
  if (!stillCelebrating(gen)) return

  for (let i = 0; i < props.columns.length; i++) {
    if (!stillCelebrating(gen)) return
    await speakColumn(i)
    if (!stillCelebrating(gen)) return
    await sleep(BETWEEN_NUMBERS_MS)
  }

  if (!stillCelebrating(gen)) return
  hoppingIndex.value = null
  hoppingAll.value = false
  await nextTick()
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
  if (!stillCelebrating(gen)) return
  hoppingAll.value = true
  await numberblocksAssets.playSound("pop")
  if (hopTimer) clearTimeout(hopTimer)
  hopTimer = setTimeout(() => {
    if (!stillCelebrating(gen)) return
    hoppingAll.value = false
    finale.value = false
  }, 840)
}

watch(
  () => props.justLockedIndex,
  (index) => {
    if (index === null) return
    void celebrateLock(index)
  },
)

watch(
  () => props.complete,
  (done) => {
    if (!done) stopFinale()
  },
)

onMounted(() => {
  observeStage()
})

onUnmounted(() => {
  stopFinale()
  resize?.disconnect()
})

watch(
  () => props.columns.map((column) => column.id).join(),
  async () => {
    await nextTick()
    observeStage()
  },
)
</script>

<template>
  <div
    ref="root"
    class="board"
    :class="{ finale }"
    role="group"
    aria-label="Skip counting"
  >
    <div
      v-for="(column, index) in columns"
      :key="column.id"
      class="cell"
      :class="{
        current: activeIndex === index && !complete,
        reading: hoppingIndex === index,
      }"
      :style="{
        gridColumn: (index % 5) + 1,
        gridRow: index < 5 ? 1 : 3,
        '--read-glow': glowFor(column.value) ?? '#f2c01e',
      }"
    >
      <p
        class="fact"
        :class="{
          current: step !== null && activeIndex === index && !complete,
          reading: hoppingIndex === index,
        }"
      >
        <template v-if="step !== null">
          <span class="fact-side">
            <NumberblockView class="mini" :value="index + 1" :alt="''" />
            <span
              class="k"
              :class="paintClass(index + 1)"
              :style="paintStyle(index + 1)"
              >{{ index + 1 }}</span
            >
          </span>
          <span class="times">×</span>
          <span class="fact-side">
            <span
              class="step-num"
              :class="paintClass(step)"
              :style="paintStyle(step)"
              >{{ step }}</span
            >
            <NumberblockView class="mini" :value="step" :alt="''" />
          </span>
        </template>
      </p>
      <MathInput
        :value="column.value"
        :active="activeIndex === index && !complete"
        :slot-label="slotLabel(index)"
      />
      <div :ref="(el) => setFigureRef(column.id, el)" class="figure">
        <NumberblockView
          :value="column.value"
          :px-per-unit="pxPerUnit"
          :jumping="hoppingAll"
          :speaking="hoppingIndex === index"
        />
      </div>
    </div>

    <div class="divider" aria-hidden="true">
      <span class="rail" />
      <span class="fivebar" title="Halfway — five">
        <i
          v-for="n in FIVE_CUBES"
          :key="n"
          :style="{ background: glowFor(n) }"
        />
      </span>
      <span class="rail" />
    </div>
  </div>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  grid-template-rows: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: stretch;
  gap: clamp(0.55rem, 1.6vh, 1rem) clamp(0.4rem, 1.2vw, 0.9rem);
  width: 100%;
  min-width: 0;
  min-height: 0;
  flex: 1;
}

.divider {
  grid-column: 1 / -1;
  grid-row: 2;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-height: 1.35rem;
  padding: 0 0.4rem;
  pointer-events: none;
}

.rail {
  flex: 1 1 auto;
  height: 3px;
  border-radius: 99px;
  background: linear-gradient(
    90deg,
    transparent,
    #c4a57a 12%,
    #c4a57a 88%,
    transparent
  );
}

.fivebar {
  display: flex;
  flex: 0 0 auto;
  gap: 3px;
}

.fivebar i {
  display: block;
  width: 1.05rem;
  height: 1.05rem;
  border-radius: 0.2rem;
  box-shadow:
    inset 0 0 0 1.5px rgba(40, 20, 0, 0.18),
    0 1px 0 rgba(40, 20, 0, 0.12);
}

.cell {
  position: relative;
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  justify-items: center;
  min-width: 0;
  min-height: 0;
  padding: 0.5rem 0.4rem 0.55rem;
  border-radius: 1.35rem;
  background: rgba(255, 255, 255, 0.78);
  box-shadow:
    0 0 0 1px rgba(40, 20, 0, 0.07),
    0 8px 18px rgba(80, 50, 20, 0.07);
  transition:
    background 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.15s ease;
}

.cell.current {
  box-shadow:
    0 0 0 3px color-mix(in srgb, #6d7788 55%, transparent),
    0 10px 22px rgba(80, 50, 20, 0.1);
}

.cell.reading {
  z-index: 2;
  background: color-mix(in srgb, var(--read-glow) 32%, #ffe566);
  box-shadow:
    0 0 0 5px color-mix(in srgb, var(--read-glow) 70%, #f0b429),
    0 14px 32px color-mix(in srgb, var(--read-glow) 40%, rgba(200, 140, 20, 0.35));
  animation: reading-pulse 0.9s ease-in-out infinite;
}

.cell.reading :deep(.slot.filled) {
  border-color: color-mix(in srgb, var(--read-glow) 75%, #3b3b3b);
  box-shadow:
    0 8px 18px rgba(80, 50, 20, 0.08),
    0 0 0 1px rgba(40, 20, 0, 0.06),
    0 0 26px color-mix(in srgb, var(--read-glow) 80%, transparent);
}

.cell :deep(.slot) {
  --min: 3.2rem;
  max-width: 100%;
  min-height: 3.2rem;
  font-size: clamp(1.6rem, 3.2vw, 2.6rem);
  padding: 0.16em 0.3em;
  border-radius: 1rem;
}

.figure {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  width: 100%;
}

.fact {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 0.22em;
  margin: 0 0 0.15rem;
  min-height: 1.35em;
  font-size: clamp(1.7rem, 3.8vw, 3.2rem);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: #1a1a1a;
  text-align: center;
  white-space: nowrap;
  transition: transform 0.15s ease;
}

.fact-side {
  display: inline-flex;
  align-items: flex-end;
  gap: 0.12em;
}

.mini {
  width: 1.25em;
  height: 1.4em;
  flex: 0 0 auto;
}

.mini :deep(img) {
  filter: none;
  max-width: 100%;
  max-height: 100%;
}

.fact .k,
.fact .step-num {
  font-weight: 900;
}

.fact .times {
  font-weight: 800;
  color: #1a1a1a;
}

.fact.current,
.fact.reading {
  transform: scale(1.06);
}

.board.finale .cell :deep(.slot.filled) {
  box-shadow:
    0 8px 18px rgba(80, 50, 20, 0.08),
    0 0 0 1px rgba(40, 20, 0, 0.06),
    0 0 22px color-mix(in srgb, var(--glow) 70%, transparent);
}

@keyframes reading-pulse {
  0%,
  100% {
    transform: scale(1.04);
  }
  50% {
    transform: scale(1.08);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cell.reading {
    animation: none;
    transform: none;
  }
}
</style>
