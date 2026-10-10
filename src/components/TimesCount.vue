<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue"
import { COUNT_LENGTH, multiple } from "../lib/math"
import {
  TIMES_PASS_MS,
  TIMES_SPEECH_PAUSE_MS,
  createTimesCountSets,
  createTimesMotion,
  type AnimationUiEvent,
  type SpeakingPart,
  type TimesLoopHost,
} from "../lib/motion"
import { displaySizeForParts, figureUnits } from "../lib/numberblockScale"
import { glowFor, paintClass, paintStyle } from "../lib/numberblockColors"
import { numberblocksAssets, splitOfficialAddends } from "../lib/numberblocksSb3"
import {
  cancelSpeech,
  speechLanguage,
  uiPhrase,
} from "../lib/speak"
import type { TimesField } from "../model/times"
import MathInput from "./MathInput.vue"
import NumberblockView from "./NumberblockView.vue"

/** Room around each costume so the sprite padding and shadow stay visible. */
const COSTUME_PAD = 0.78
const COPY_GAP = 0.4
const PASS_MS = TIMES_PASS_MS
const SPEECH_PAUSE_MS = TIMES_SPEECH_PAUSE_MS

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
const stageEl = ref<HTMLElement | null>(null)
const listEl = ref<HTMLElement | null>(null)
const stepsEl = ref<HTMLElement | null>(null)
const resultEl = ref<HTMLElement | null>(null)
const stepInput = ref<{ focus: () => void } | null>(null)
const productInput = ref<{ focus: () => void } | null>(null)
const stageWidth = ref(640)
const stageHeight = ref(320)
const stepsWidth = ref(280)
const stepsHeight = ref(64)
const resultWidth = ref(72)
const resultHeight = ref(64)
const shakeBox = ref(false)
const holdReleased = ref(false)
const revealedRows = ref(false)
const countdownIndex = ref<number | null>(null)
const passingK = ref<number | null>(null)
const passOn = ref(false)
const speakingIndex = ref<number | null>(null)
const speakingPart = ref<SpeakingPart | null>(null)

/** Payload for the in-flight times motion set (read by custom set runners). */
let motionData: { k?: number; index?: number } = {}
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

const chooseStepText = computed(() => uiPhrase("chooseStep"))
const pressEnterText = computed(() => uiPhrase("pressEnter"))
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
  if (props.step === null || props.complete || revealedRows.value) return -1
  if (holdingAnswer.value || countdownIndex.value !== null) return -1
  return props.figured.length
})

const typedAnswer = computed(() =>
  holdingAnswer.value ? null : props.draft,
)

const stepEditIndex = computed(() => {
  if (!editingStep.value || props.step === null || revealedRows.value) return -1
  if (props.complete || props.figured.length >= COUNT_LENGTH) return 0
  return props.figured.length
})

const playK = computed(() => {
  if (countdownIndex.value !== null) return countdownIndex.value + 1
  if (openIndex.value >= 0) return openIndex.value + 1
  if (props.justLockedIndex !== null) return props.justLockedIndex + 1
  return Math.max(1, props.figured.length)
})

function fitCopies(
  count: number,
  parts: number[],
  along: number,
  cross: number,
) {
  if (count < 1 || along <= 0 || cross <= 0) return 1
  const { wide, tall } = figureUnits(parts.length > 0 ? parts : [1])
  const gap = COPY_GAP * Math.max(0, count - 1)
  const px = Math.min(
    cross / Math.max(tall, 0.01),
    along / (wide * count + gap),
  )
  return px * COSTUME_PAD
}

const stagePx = computed(() => {
  if (props.step === null) return 1
  return fitCopies(
    playK.value,
    partsFor(props.step),
    stageWidth.value,
    stageHeight.value,
  )
})

const stageBox = computed(() => {
  if (props.step === null) return { width: "0px", height: "0px" }
  const size = displaySizeForParts(partsFor(props.step), stagePx.value)
  return { width: `${size.width}px`, height: `${size.height}px` }
})

const rowPx = computed(() => {
  if (props.step === null) return 1
  return fitCopies(
    COUNT_LENGTH,
    partsFor(props.step),
    stepsWidth.value,
    stepsHeight.value,
  )
})

const rowBox = computed(() => {
  if (props.step === null) return { width: "0px", height: "0px" }
  const size = displaySizeForParts(partsFor(props.step), rowPx.value)
  return { width: `${size.width}px`, height: `${size.height}px` }
})

function resultScale(value: number) {
  const fit = fitCopies(1, partsFor(value), resultWidth.value, resultHeight.value)
  return Math.min(rowPx.value, fit)
}

function resultBox(value: number) {
  const size = displaySizeForParts(partsFor(value), resultScale(value))
  return { width: `${size.width}px`, height: `${size.height}px` }
}

const passPx = computed(() => {
  if (passingK.value === null) return 1
  const { tall } = figureUnits(partsFor(passingK.value))
  return (stageHeight.value * 0.72) / Math.max(tall, 1)
})

const passBox = computed(() => {
  if (passingK.value === null) return { width: "0px", height: "0px" }
  const size = displaySizeForParts(partsFor(passingK.value), passPx.value)
  return { width: `${size.width}px`, height: `${size.height}px` }
})

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

function clearMotionVisuals() {
  passingK.value = null
  passOn.value = false
  countdownIndex.value = null
  speakingPart.value = null
  speakingIndex.value = null
}

function stopMotion() {
  motion.onReset()
  clearMotionVisuals()
  cancelSpeech()
  numberblocksAssets.stopAllSounds()
}

function onMotionEvent(event: AnimationUiEvent) {
  if (event.type === "setEnd" && event.reason === "cancelled") {
    clearMotionVisuals()
    cancelSpeech()
    numberblocksAssets.stopAllSounds()
  }
}

const loopHost: TimesLoopHost = {
  getStep: () => props.step,
  getK: () => motionData.k,
  getLockIndex: () => motionData.index,
  isComplete: () => props.complete,
  isRevealed: () => revealedRows.value,
  getActiveField: () => props.activeField,
  getJustLockedIndex: () => props.justLockedIndex,
  setPassingK: (value) => {
    passingK.value = value
  },
  setPassOn: (value) => {
    passOn.value = value
  },
  setSpeakingIndex: (value) => {
    speakingIndex.value = value
  },
  setSpeakingPart: (value) => {
    speakingPart.value = value
  },
  setCountdownIndex: (value) => {
    countdownIndex.value = value
  },
  setShakeBox: (value) => {
    shakeBox.value = value
  },
  setHoldReleased: (value) => {
    holdReleased.value = value
  },
  setRevealedRows: (value) => {
    revealedRows.value = value
  },
  releaseAnswer,
  focusProduct: () => {
    emit("focusProduct")
    productInput.value?.focus()
  },
  measure: () => {
    measure()
    observe()
  },
  nextTick,
  prefersReducedMotion,
}

const motion = createTimesMotion({
  passMs: PASS_MS,
  speechPauseMs: SPEECH_PAUSE_MS,
  sleep,
  emit: onMotionEvent,
  sets: createTimesCountSets(loopHost, {
    passMs: PASS_MS,
    speechPauseMs: SPEECH_PAUSE_MS,
  }),
})

function innerBox(el: HTMLElement) {
  const style = getComputedStyle(el)
  const padX = parseFloat(style.paddingLeft || "0") + parseFloat(style.paddingRight || "0")
  const padY = parseFloat(style.paddingTop || "0") + parseFloat(style.paddingBottom || "0")
  return {
    w: Math.max(24, el.clientWidth - padX),
    h: Math.max(24, el.clientHeight - padY),
  }
}

function measure() {
  if (stageEl.value) {
    const box = innerBox(stageEl.value)
    stageWidth.value = box.w
    stageHeight.value = box.h
  }
  if (stepsEl.value) {
    const box = innerBox(stepsEl.value)
    stepsWidth.value = box.w
    stepsHeight.value = box.h
  }
  if (resultEl.value) {
    const box = innerBox(resultEl.value)
    resultWidth.value = box.w
    resultHeight.value = box.h
  }
}

function observe() {
  resize?.disconnect()
  resize = new ResizeObserver(measure)
  if (root.value) resize.observe(root.value)
  if (stageEl.value) resize.observe(stageEl.value)
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

function slotLabel(k: number) {
  if (props.step === null) return chooseStepText.value
  return `${k} times ${props.step}`
}

function rowLabel(k: number, product: number, solved: boolean) {
  if (props.step === null) return ""
  if (!solved) return `${k} times ${props.step}`
  return `${k} times ${props.step} equals ${product}`
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
      stopMotion()
      shakeBox.value = false
      holdReleased.value = false
      if (!props.complete) revealedRows.value = false
      if (props.step !== null && !props.complete && !revealedRows.value) {
        motionData = {}
        void motion.system.play("times.promptNext")
      }
      return
    }
    motionData = { index }
    void motion.onLockSuccess({ index, complete: props.complete })
  },
)

watch(
  () => props.step,
  () => {
    stopMotion()
    revealedRows.value = false
    countdownIndex.value = null
    if (props.justLockedIndex !== null) return
    if (props.step !== null && !props.complete) {
      motionData = {}
      void motion.system.play("times.promptNext")
    }
  },
)

watch(openIndex, (index) => {
  if (index < 0 || props.step === null || revealedRows.value) return
  motionData = { k: index + 1 }
  void motion.onOpenEquation(index + 1)
})

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
  stopMotion()
  resize?.disconnect()
})

watch(
  () => [props.step, revealedRows.value, playK.value] as const,
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
      </div>
      <p
        class="setup-hint"
        data-step-well
        :lang="setupLang"
        :dir="setupDir"
        @mousedown.prevent
      >
        {{ pressEnterText }}
      </p>
    </div>

    <div v-else-if="!revealedRows" class="play">
      <div class="tabs" role="tablist" aria-label="Equations">
        <div
          v-for="row in rows"
          :key="row.k"
          class="tab"
          role="tab"
          :aria-selected="row.index === openIndex"
          :class="{
            current: row.index === openIndex,
            solved: row.solved,
            speaking: speakingIndex === row.index,
          }"
        >
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
                :class="[paintClass(step ?? 0), { spoken: spoken(row.index, 'step') }]"
                :style="paintStyle(step)"
                >{{ step }}</span
              >
            </button>
          </div>
          <template v-if="row.index === openIndex || row.solved">
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
                v-else-if="row.answer !== null"
                class="settled"
                :class="paintClass(row.answer)"
                :style="{
                  ...paintStyle(row.answer),
                  '--glow': glowFor(row.answer) ?? '#c4a57a',
                }"
                >{{ row.answer }}</span
              >
            </div>
          </template>
        </div>
      </div>

      <div ref="stageEl" class="stage">
        <div class="copies" :aria-label="slotLabel(playK)">
          <div
            v-for="n in playK"
            :key="n"
            class="fig"
            :style="stageBox"
          >
            <NumberblockView
              :value="step"
              :px-per-unit="stagePx"
              :speaking="speakingPart === 'step' || speakingPart === 'product'"
            />
          </div>
        </div>
        <div v-if="passingK !== null" class="pass" aria-hidden="true">
          <div class="pass-fig" :class="{ go: passOn }" :style="passBox">
            <NumberblockView :value="passingK" :px-per-unit="passPx" jumping />
          </div>
        </div>
      </div>
    </div>

    <ol v-else ref="listEl" class="list">
      <li
        v-for="row in rows"
        :key="row.k"
        class="line"
        :aria-label="rowLabel(row.k, row.product, row.solved)"
      >
        <div class="eq">
          <span class="num" :class="paintClass(row.k)" :style="paintStyle(row.k)">{{
            row.k
          }}</span>
          <span class="op">×</span>
          <span class="num" :class="paintClass(step)" :style="paintStyle(step)">{{
            step
          }}</span>
          <span class="op">=</span>
          <span
            v-if="row.answer !== null"
            class="settled"
            :class="paintClass(row.answer)"
            :style="{
              ...paintStyle(row.answer),
              '--glow': glowFor(row.answer) ?? '#c4a57a',
            }"
            >{{ row.answer }}</span
          >
        </div>
        <div class="steps" :ref="row.index === 0 ? setStepsEl : undefined">
          <div v-for="n in row.k" :key="n" class="fig" :style="rowBox">
            <NumberblockView :value="step" :px-per-unit="rowPx" />
          </div>
        </div>
        <div class="result" :ref="row.index === 0 ? setResultEl : undefined">
          <div v-if="row.solved" class="fig" :style="resultBox(row.product)">
            <NumberblockView
              :value="row.product"
              :px-per-unit="resultScale(row.product)"
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

.step-keep:focus-visible {
  outline: 3px solid #4a5568;
  outline-offset: 3px;
}

.play {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.tabs {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-end;
  gap: 0.18rem;
  margin: 0 0.15rem;
  padding: 0.15rem 0.15rem 0;
  overflow: hidden;
  border-bottom: 3px solid rgba(255, 255, 255, 0.72);
}

.tab {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.08rem 0.12rem;
  flex: 1 1 0;
  min-width: 0;
  min-height: 2.7rem;
  padding: 0.28rem 0.2rem 0.34rem;
  border-radius: 0.75rem 0.75rem 0 0;
  background: rgba(255, 255, 255, 0.34);
  color: #6a645c;
}

.tab.solved {
  background: rgba(255, 255, 255, 0.62);
  color: inherit;
}

.tab.current {
  background: #fff;
  margin-bottom: -3px;
  padding-bottom: calc(0.34rem + 3px);
  box-shadow: inset 0 0 0 2px rgba(58, 168, 224, 0.4);
}

.tab.speaking {
  background: #fff;
}

.num,
.op,
.step-keep {
  font-size: clamp(0.95rem, 2.1vw, 1.35rem);
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.op {
  color: #5a554e;
}

.num.spoken,
.op.spoken {
  transform: scale(1.12);
}

.step-slot,
.answer {
  display: flex;
  align-items: center;
}

.step-keep {
  appearance: none;
  margin: 0;
  padding: 0 0.04em;
  border: 0;
  background: transparent;
  color: inherit;
  font-family: inherit;
  cursor: pointer;
}

.tab :deep(.slot),
.tab .settled {
  --min: 1.35em;
  width: 1.7em;
  max-width: 2.6em;
  height: 1.55em;
  min-height: 0;
  padding: 0 0.08em;
  border-width: 2px;
  border-radius: 0.45em;
  font-size: clamp(0.95rem, 2.1vw, 1.35rem);
  box-shadow: 0 2px 0 rgba(40, 20, 0, 0.08);
}

.tab .settled {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  background: #fff;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  box-shadow:
    0 2px 0 rgba(40, 20, 0, 0.08),
    0 0 10px color-mix(in srgb, var(--glow) 55%, transparent);
}

.stage {
  position: relative;
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  padding: 0.8rem 1rem 1.1rem;
  overflow: hidden;
}

.copies {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.fig {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.fig :deep(.nb) {
  align-items: center;
}

.pass {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 3;
}

.pass-fig {
  position: absolute;
  top: 50%;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transform: translate(-120%, -50%);
}

.pass-fig.go {
  animation: cross 1.68s cubic-bezier(0.45, 0, 0.2, 1) forwards;
}

@keyframes cross {
  0% {
    transform: translate(-115%, -50%) scale(0.9);
  }
  16% {
    transform: translate(6%, -58%) scale(1);
  }
  72% {
    transform: translate(62%, -50%) scale(1);
  }
  100% {
    transform: translate(125%, -50%) scale(0.92);
  }
}

.list {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  width: 100%;
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: 0.2rem 0.25rem 0.4rem;
  list-style: none;
}

.line {
  flex: 1 1 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(4.2rem, 16vw);
  align-items: center;
  gap: 0.35rem 0.7rem;
  min-width: 0;
  min-height: 0;
  padding: 0 0.4rem;
  border-radius: 0.75rem;
}

.eq {
  display: flex;
  align-items: center;
  gap: 0.16rem 0.22rem;
  white-space: nowrap;
}

.list .settled {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 2.2em;
  height: 1.6em;
  border-radius: 0.45em;
  background: #fff;
  font-size: clamp(0.95rem, 2.4vh, 1.35rem);
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  box-shadow:
    0 2px 0 rgba(40, 20, 0, 0.08),
    0 0 10px color-mix(in srgb, var(--glow) 55%, transparent);
}

.steps,
.result {
  display: flex;
  align-items: center;
  min-width: 0;
  height: 100%;
  box-sizing: border-box;
  padding: 0.3rem 0.25rem;
  overflow: hidden;
}

.steps {
  justify-content: flex-start;
  gap: 0.2rem;
}

.result {
  justify-content: center;
}

@media (prefers-reduced-motion: reduce) {
  .pass-fig.go {
    animation: none;
  }
}

@media (max-width: 720px) {
  .line {
    gap: 0.2rem 0.35rem;
    grid-template-columns: auto minmax(0, 1fr) minmax(2.6rem, 18vw);
  }

  .setup-step :deep(.slot) {
    --min: 3.6rem;
    max-width: 6.4rem;
    min-height: 3.6rem;
    font-size: clamp(2rem, 6vw, 3rem);
  }
}
</style>
