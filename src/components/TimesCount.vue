<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue"
import { COUNT_LENGTH, multiple } from "../lib/math"
import {
  displaySizeForParts,
  rowScale,
} from "../lib/numberblockScale"
import { glowFor, paintClass, paintStyle } from "../lib/numberblockColors"
import { numberblocksAssets, splitOfficialAddends } from "../lib/numberblocksSb3"
import {
  cancelSpeech,
  speakNumberName,
  speakOperator,
  speechLanguage,
  uiPhrase,
} from "../lib/speak"
import type { TimesField } from "../model/times"
import MathInput from "./MathInput.vue"
import NumberblockView from "./NumberblockView.vue"

/** Silence after each spoken piece: 5 — times — 5 — equals — 25 */
const SPEECH_PAUSE_MS = 400

const props = defineProps<{
  step: number | null
  stepDraft: number | null
  figured: number[]
  draft: number | null
  complete: boolean
  justLockedIndex: number | null
  activeField: TimesField
  releaseAnswer?: () => void
}>()

const emit = defineEmits<{
  focusStep: []
  focusProduct: []
  commitStep: []
  clearDraft: []
}>()

function releaseAnswer() {
  holdReleased.value = true
  props.releaseAnswer?.()
  emit("clearDraft")
}

const root = ref<HTMLElement | null>(null)
const listEl = ref<HTMLElement | null>(null)
const stepsEl = ref<HTMLElement | null>(null)
const resultEl = ref<HTMLElement | null>(null)
const stepInput = ref<{ focus: () => void } | null>(null)
const productInput = ref<{ focus: () => void } | null>(null)
const rowInner = ref(48)
const stepsWidth = ref(280)
const resultWidth = ref(72)
const shakeBox = ref(false)
const holdReleased = ref(false)
const speakingIndex = ref<number | null>(null)
const speakingPart = ref<"k" | "times" | "step" | "equals" | "product" | null>(
  null,
)

let lockGen = 0
let resize: ResizeObserver | undefined

function partsFor(value: number) {
  return splitOfficialAddends(value)
}

const rows = computed(() => {
  const step = props.step
  if (step === null) return []
  return Array.from({ length: COUNT_LENGTH }, (_, index) => ({
    index,
    k: index + 1,
    product: multiple(step, index + 1),
    solved: index < props.figured.length,
    answer: props.figured[index] ?? null,
  }))
})

const editingStep = computed(
  () => props.activeField === "step" || props.step === null,
)

const choosingStep = computed(() => props.step === null)

const canStart = computed(
  () => choosingStep.value && props.stepDraft !== null && props.stepDraft >= 1,
)

const chooseStepText = computed(() => uiPhrase("chooseStep"))
const startText = computed(() => uiPhrase("start"))
const orEnterText = computed(() => uiPhrase("orEnter"))
const setupLang = computed(() => speechLanguage.value)
const setupDir = computed(() =>
  speechLanguage.value.split("-")[0]?.toLowerCase() === "ar" ? "rtl" : "ltr",
)

const lockedAnswer = computed(() => {
  if (props.justLockedIndex === null) return null
  return props.figured[props.justLockedIndex] ?? null
})

const holdingAnswer = computed(
  () =>
    !holdReleased.value &&
    props.justLockedIndex !== null &&
    props.draft !== null &&
    props.draft === lockedAnswer.value,
)

const openIndex = computed(() => {
  if (props.step === null || props.complete) return -1
  if (holdingAnswer.value) return -1
  return props.figured.length
})

const typedAnswer = computed(() =>
  holdingAnswer.value ? null : props.draft,
)

const stepEditIndex = computed(() => {
  if (!editingStep.value || props.step === null) return -1
  if (props.complete || props.figured.length >= COUNT_LENGTH) return 0
  return props.figured.length
})

const visibleCopies = computed(() => {
  if (props.step === null) return 1
  const active = openIndex.value >= 0 ? openIndex.value + 1 : 0
  return Math.min(COUNT_LENGTH, Math.max(props.figured.length, active, 1))
})

function showsSteps(index: number) {
  return index < props.figured.length || index === openIndex.value
}

const stepPx = computed(() => {
  if (props.step === null) return 1
  return rowScale({
    figures: Array.from({ length: visibleCopies.value }, () =>
      partsFor(props.step as number),
    ),
    availableWidth: stepsWidth.value,
    availableHeight: rowInner.value,
  })
})

const stepBox = computed(() => {
  if (props.step === null) return { width: "0px", height: "0px" }
  const size = displaySizeForParts(partsFor(props.step), stepPx.value)
  return { width: `${size.width}px`, height: `${size.height}px` }
})

function resultScale(value: number) {
  return (
    rowScale({
      figures: [partsFor(value)],
      availableWidth: resultWidth.value,
      availableHeight: rowInner.value,
    }) * 0.92
  )
}

function resultBox(value: number) {
  const size = displaySizeForParts(partsFor(value), resultScale(value))
  return { width: `${size.width}px`, height: `${size.height}px` }
}

const bubbleActive = computed(
  () =>
    props.step !== null &&
    props.activeField === "product" &&
    openIndex.value >= 0,
)

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

function stillLock(gen: number) {
  return gen === lockGen
}

function measure() {
  const list = listEl.value
  if (list) {
    const style = getComputedStyle(list)
    const gap = parseFloat(style.rowGap || style.gap || "0") || 0
    rowInner.value = Math.max(
      36,
      (list.clientHeight - gap * (COUNT_LENGTH - 1)) / COUNT_LENGTH - 2,
    )
  }
  if (stepsEl.value) stepsWidth.value = Math.max(48, stepsEl.value.clientWidth - 4)
  if (resultEl.value) resultWidth.value = Math.max(36, resultEl.value.clientWidth - 4)
}

function observe() {
  resize?.disconnect()
  resize = new ResizeObserver(measure)
  if (root.value) resize.observe(root.value)
  if (listEl.value) resize.observe(listEl.value)
  if (stepsEl.value) resize.observe(stepsEl.value)
  if (resultEl.value) resize.observe(resultEl.value)
  measure()
}

function setStepsEl(el: unknown) {
  stepsEl.value = el instanceof HTMLElement ? el : null
}

function setResultEl(el: unknown) {
  resultEl.value = el instanceof HTMLElement ? el : null
}

function asFocusable(el: unknown): { focus: () => void } | null {
  if (el && typeof el === "object" && "focus" in el && typeof el.focus === "function") {
    return el as { focus: () => void }
  }
  return null
}

function setStepInput(el: unknown) {
  const focusable = asFocusable(el)
  if (focusable) stepInput.value = focusable
  else if (el == null) stepInput.value = null
}

function setProductInput(el: unknown) {
  const focusable = asFocusable(el)
  if (focusable) productInput.value = focusable
  else if (el == null) productInput.value = null
}

function stopSpeech() {
  lockGen += 1
  speakingPart.value = null
  speakingIndex.value = null
  cancelSpeech()
  numberblocksAssets.stopAllSounds()
}

async function playNamed(value: number) {
  await speakNumberName(value)
}

async function speakFact(k: number, gen: number) {
  const step = props.step
  if (step === null) return

  cancelSpeech()
  numberblocksAssets.stopAllSounds()

  const parts = [
    { key: "k" as const, run: () => playNamed(k) },
    { key: "times" as const, run: () => speakOperator("times") },
    { key: "step" as const, run: () => playNamed(step) },
    { key: "equals" as const, run: () => speakOperator("equals") },
    { key: "product" as const, run: () => playNamed(multiple(step, k)) },
  ]

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (!part) continue
    speakingPart.value = part.key
    await part.run()
    if (!stillLock(gen)) return
    if (i < parts.length - 1) {
      await sleep(SPEECH_PAUSE_MS)
      if (!stillLock(gen)) return
    }
  }

  speakingPart.value = null
}

async function promptNextInput() {
  if (props.step === null || props.complete || props.activeField === "step") return
  if (props.justLockedIndex !== null) releaseAnswer()
  emit("focusProduct")
  await nextTick()
  productInput.value?.focus()
  if (prefersReducedMotion()) return
  shakeBox.value = false
  await nextTick()
  shakeBox.value = true
}

async function celebrateLock(index: number) {
  const gen = ++lockGen
  const step = props.step
  if (step === null) return
  speakingIndex.value = index
  speakingPart.value = null
  shakeBox.value = false
  holdReleased.value = false
  void numberblocksAssets.playSound("pop")

  await speakFact(index + 1, gen)
  if (!stillLock(gen)) return

  speakingIndex.value = null
  releaseAnswer()
  await nextTick()
  if (!stillLock(gen)) return
  if (!props.complete) await promptNextInput()
}

function slotLabel(k: number) {
  if (props.step === null) return chooseStepText.value
  return `${k} times ${props.step}`
}

function rowLabel(k: number, product: number, solved: boolean) {
  if (props.step === null) return ""
  if (!solved) return `${k} times ${props.step}`
  return `${k} times ${props.step} equals ${product}`
}

function startGame() {
  if (!canStart.value) return
  emit("commitStep")
}

function onBoardPointerDown(event: PointerEvent) {
  if (!editingStep.value) return
  const target = event.target
  if (!(target instanceof Element)) return
  if (target.closest("[data-step-well]")) return
  emit("commitStep")
}

function onProductFocus() {
  emit("focusProduct")
  void nextTick(() => {
    if (props.activeField === "step") stepInput.value?.focus()
  })
}

function spoken(index: number, part: "k" | "times" | "step" | "equals" | "product") {
  return speakingIndex.value === index && speakingPart.value === part
}

watch(
  () => props.justLockedIndex,
  (index) => {
    if (index === null) {
      stopSpeech()
      shakeBox.value = false
      holdReleased.value = false
      void promptNextInput()
      return
    }
    void celebrateLock(index)
  },
)

watch(
  () => props.step,
  () => {
    if (props.justLockedIndex !== null) return
    void promptNextInput()
  },
  { immediate: true },
)

watch(
  () => props.activeField,
  async (field) => {
    await nextTick()
    if (field === "step") stepInput.value?.focus()
    else productInput.value?.focus()
  },
  { immediate: true },
)

onMounted(() => {
  observe()
})

onUnmounted(() => {
  stopSpeech()
  resize?.disconnect()
})

watch(
  () => props.figured.length,
  async () => {
    await nextTick()
    observe()
  },
)
</script>

<template>
  <div
    ref="root"
    class="board"
    role="group"
    aria-label="Times counting"
    @pointerdown="onBoardPointerDown"
  >
    <div v-if="choosingStep" class="setup">
      <p
        class="setup-prompt"
        data-step-well
        :lang="setupLang"
        :dir="setupDir"
        @mousedown.prevent
      >
        {{ chooseStepText }}
      </p>
      <div class="setup-line">
        <div class="setup-step" data-step-well>
          <MathInput
            ref="stepInput"
            :value="stepDraft"
            :active="activeField === 'step'"
            :slot-label="chooseStepText"
            @focus="emit('focusStep')"
            @blur="emit('commitStep')"
          />
        </div>
        <button
          type="button"
          class="start-step"
          data-step-well
          :lang="setupLang"
          :dir="setupDir"
          :disabled="!canStart"
          @mousedown.prevent
          @click="startGame"
        >
          {{ startText }}
        </button>
      </div>
      <p
        class="setup-hint"
        data-step-well
        :lang="setupLang"
        :dir="setupDir"
        @mousedown.prevent
      >
        {{ orEnterText }}
      </p>
    </div>

    <ol v-else ref="listEl" class="list">
      <li
        v-for="row in rows"
        :key="row.k"
        class="line"
        :class="{
          current: row.index === openIndex,
          solved: row.solved,
          speaking: speakingIndex === row.index,
        }"
        :aria-current="row.index === openIndex ? 'step' : undefined"
        :aria-label="rowLabel(row.k, row.product, row.solved)"
      >
        <div class="eq">
          <span
            class="num"
            :class="[paintClass(row.k), { spoken: spoken(row.index, 'k') }]"
            :style="paintStyle(row.k)"
            >{{ row.k }}</span
          >
          <span class="op" :class="{ spoken: spoken(row.index, 'times') }">×</span>
          <div class="step-slot" data-step-well>
            <MathInput
              v-if="row.index === stepEditIndex"
              :ref="setStepInput"
              :value="stepDraft"
              :active="activeField === 'step'"
              slot-label="Change step"
              @focus="emit('focusStep')"
              @blur="emit('commitStep')"
            />
            <button
              v-else
              type="button"
              class="step-keep"
              aria-label="Change step"
              @click="emit('focusStep')"
            >
              <span
                class="num"
                :class="[
                  paintClass(step ?? 0),
                  { spoken: spoken(row.index, 'step') },
                ]"
                :style="paintStyle(step)"
                >{{ step }}</span
              >
            </button>
          </div>
          <span class="op" :class="{ spoken: spoken(row.index, 'equals') }">=</span>
          <div class="answer">
            <MathInput
              v-if="row.index === openIndex"
              :ref="setProductInput"
              :value="typedAnswer"
              :active="bubbleActive"
              :shake="shakeBox"
              :slot-label="slotLabel(row.k)"
              @focus="onProductFocus"
            />
            <span
              v-else-if="row.solved && row.answer !== null"
              class="settled"
              :class="paintClass(row.answer)"
              :style="{
                ...paintStyle(row.answer),
                '--glow': glowFor(row.answer) ?? '#c4a57a',
              }"
              >{{ row.answer }}</span
            >
            <span v-else class="ghost" aria-hidden="true" />
          </div>
        </div>

        <div
          class="steps"
          :ref="row.index === 0 ? setStepsEl : undefined"
        >
          <div
            v-for="n in showsSteps(row.index) ? row.k : 0"
            :key="n"
            class="fig"
            :style="stepBox"
          >
            <NumberblockView
              :value="step"
              :px-per-unit="stepPx"
              :speaking="spoken(row.index, 'step')"
            />
          </div>
        </div>

        <div
          class="result"
          :ref="row.index === 0 ? setResultEl : undefined"
        >
          <div
            v-if="row.solved"
            class="fig result-fig"
            :style="resultBox(row.product)"
          >
            <NumberblockView
              :value="row.product"
              :px-per-unit="resultScale(row.product)"
              :speaking="spoken(row.index, 'product')"
            />
          </div>
        </div>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.board {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  min-width: 0;
  min-height: 0;
}

.setup {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 0;
}

.setup-prompt {
  margin: 0;
  padding: 0 0.4rem;
  color: #3a342c;
  font-size: clamp(1.85rem, 4.2vw, 2.7rem);
  font-weight: 800;
  line-height: 1.15;
  text-align: center;
}

.setup-hint {
  margin: 0;
  color: #7a746c;
  font-size: clamp(1rem, 2.2vw, 1.2rem);
  font-weight: 800;
  line-height: 1.2;
  text-align: center;
}

.setup-line {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
}

.setup-step :deep(.slot) {
  --min: 4.4rem;
  max-width: 8.4rem;
  min-height: 4.2rem;
  font-size: clamp(2.4rem, 5.2vw, 4rem);
  border-radius: 1.2rem;
}

.start-step {
  appearance: none;
  margin: 0;
  border: 0;
  border-radius: 1.2rem;
  min-height: 4.2rem;
  padding: 0.35rem 1.15rem;
  background: #3aa8e0;
  color: #fff;
  font: inherit;
  font-size: clamp(1.35rem, 3vw, 1.7rem);
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(40, 90, 130, 0.18);
}

.start-step:disabled {
  background: #e4ddd2;
  color: #9a9288;
  box-shadow: none;
  cursor: default;
}

.start-step:focus-visible,
.step-keep:focus-visible {
  outline: 3px solid #4a5568;
  outline-offset: 3px;
}

.list {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
  width: 100%;
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: 0.15rem 0.2rem 0.3rem;
  list-style: none;
}

.line {
  flex: 1 1 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(2.4rem, 14vw);
  align-items: center;
  gap: 0.35rem 0.7rem;
  min-width: 0;
  min-height: 0;
  padding: 0 0.35rem;
  border-radius: 0.75rem;
}

.line.current {
  background: rgba(255, 255, 255, 0.45);
  box-shadow: inset 0 0 0 2px rgba(58, 168, 224, 0.35);
}

.line.speaking {
  background: rgba(255, 255, 255, 0.62);
}

.eq {
  display: flex;
  align-items: center;
  gap: 0.18rem 0.28rem;
  min-width: 0;
  height: 100%;
  white-space: nowrap;
}

.num,
.op,
.step-keep {
  font-size: clamp(1.05rem, 3.3vh, 1.7rem);
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.op {
  color: #5a554e;
}

.num.spoken,
.op.spoken,
.step-keep .spoken {
  transform: scale(1.12);
}

.step-slot {
  display: flex;
  align-items: center;
  height: 100%;
}

.step-keep {
  appearance: none;
  margin: 0;
  padding: 0 0.08em;
  border: 0;
  background: transparent;
  color: inherit;
  font-family: inherit;
  cursor: pointer;
}

.answer {
  display: flex;
  align-items: center;
  height: 100%;
  margin-left: 0.12rem;
}

.answer :deep(.slot),
.step-slot :deep(.slot),
.settled,
.ghost {
  --min: 1.6em;
  width: 2.35em;
  max-width: 3.4em;
  height: 74%;
  min-height: 0;
  padding: 0 0.12em;
  border-width: 2px;
  border-radius: 0.55em;
  font-size: clamp(1.05rem, 3.3vh, 1.7rem);
  box-shadow: 0 2px 0 rgba(40, 20, 0, 0.08);
}

.settled,
.ghost {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.settled {
  background: #fff;
  box-shadow:
    0 2px 0 rgba(40, 20, 0, 0.08),
    0 0 12px color-mix(in srgb, var(--glow) 55%, transparent);
}

.ghost {
  background: rgba(255, 255, 255, 0.28);
  box-shadow: inset 0 0 0 1.5px rgba(40, 20, 0, 0.08);
}

.steps,
.result {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  min-width: 0;
  height: 100%;
  overflow: hidden;
}

.result {
  justify-content: center;
}

.steps {
  gap: 0.18rem;
}

.fig {
padding: 4px 0;
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: arrive 0.32s ease both;
}

.fig :deep(.nb) {
  align-items: center;
}

.result-fig {
  animation-delay: 0.22s;
}

@keyframes arrive {
  0% {
    transform: translateY(6px) scale(0.86);
    opacity: 0;
  }
  100% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .result-fig,
  .fig {
    animation: none;
  }
}

@media (max-width: 720px) {
  .line {
    gap: 0.2rem 0.35rem;
    grid-template-columns: auto minmax(0, 1fr) minmax(2rem, 18vw);
  }

  .setup-step :deep(.slot) {
    --min: 3.6rem;
    max-width: 6.4rem;
    min-height: 3.6rem;
    font-size: clamp(2rem, 6vw, 3rem);
  }

  .start-step {
    min-height: 3.6rem;
    padding: 0.3rem 0.85rem;
    font-size: clamp(1.15rem, 3.4vw, 1.45rem);
  }
}
</style>
