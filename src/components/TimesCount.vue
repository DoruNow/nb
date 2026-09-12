<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue"
import { COUNT_LENGTH, multiple } from "../lib/math"
import {
  displaySizeForParts,
  rowScale,
} from "../lib/numberblockScale"
import { glowFor, paintClass, paintStyle } from "../lib/numberblockColors"
import {
  numberblocksAssets,
  splitOfficialAddends,
} from "../lib/numberblocksSb3"
import { canSpeakNumber, cancelSpeech, speakOperator } from "../lib/speak"
import type { TimesField } from "../model/times"
import MathInput from "./MathInput.vue"
import NumberblockView from "./NumberblockView.vue"

const UNITS_BEAT_MS = 900
const MERGE_MS = 780
const FLY_MS = 720
const POP_MS = 480
/** Silence after each spoken piece: 5 — times — 5 — equals — 25 */
const SPEECH_PAUSE_MS = 400
const LOT_COLS = 5
const MULTIPLIERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

type StageMode = "empty" | "units" | "product" | "lots"
type CounterMode = "off" | "k" | "plus-one"
type StageFigure = { id: string; value: number }
type CloneBox = {
  left: number
  bottom: number
  width: number
  height: number
  dx: number
  dy: number
  scale: number
}

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
const stepInput = ref<{ focus: () => void } | null>(null)
const productInput = ref<{ focus: () => void } | null>(null)
const stageEl = ref<HTMLElement | null>(null)
const kRailEl = ref<HTMLElement | null>(null)
const stepRailEl = ref<HTMLElement | null>(null)
const clusterEl = ref<HTMLElement | null>(null)
const knownTagEl = ref<HTMLElement | null>(null)
const counterEl = ref<HTMLElement | null>(null)
const availableWidth = ref(400)
const availableHeight = ref(220)
const kWidth = ref(160)
const kHeight = ref(280)
const stepWidth = ref(160)
const stepHeight = ref(280)
const displayK = ref(1)
const stageMode = ref<StageMode>("empty")
const counterMode = ref<CounterMode>("off")
const counterValue = ref(1)
const arrivingIndex = ref<number | null>(null)
const hiddenIds = ref<string[]>([])
const clonesOn = ref(false)
const flying = ref(false)
const flyingToTray = ref(false)
const cloneScaled = ref(true)
const popping = ref(false)
const counterPopping = ref(false)
const showKnown = ref(false)
const knownArriving = ref(false)
const trayHopping = ref(false)
const reviewIndex = ref<number | null>(null)
const reviewProduct = ref<number | null>(null)
const shakeBox = ref(false)
const holdReleased = ref(false)
const speakingPart = ref<"k" | "times" | "step" | "equals" | "product" | null>(
  null,
)
const cloneBoxes = ref<CloneBox[]>([])
const cloneValues = ref<number[]>([])

const figureEls = new Map<string, HTMLElement>()
const trayEls = new Map<number, HTMLElement>()
let lockGen = 0
let stageGen = 0
let resize: ResizeObserver | undefined

function partsFor(value: number) {
  return splitOfficialAddends(value)
}

const collapseKnown = ref(false)

const clusterFigures = computed<StageFigure[]>(() => {
  const step = props.step
  if (step === null || stageMode.value === "empty") return []
  const k = displayK.value
  if (stageMode.value === "product") {
    return [{ id: "product", value: multiple(step, k) }]
  }
  const lots = collapseKnown.value && k >= 3 ? k - 1 : k
  return Array.from({ length: lots }, (_, index) => ({
    id: `unit-${index}`,
    value: step,
  }))
})

const addendFigure = computed<StageFigure | null>(() => {
  const step = props.step
  if (step === null) return null
  if (!collapseKnown.value) return null
  if (stageMode.value === "empty" || stageMode.value === "product") return null
  if (displayK.value < 3) return null
  return { id: "addend", value: step }
})

const knownTotal = computed(() => {
  if (!collapseKnown.value) return null
  if (props.step === null || displayK.value < 3) return null
  return multiple(props.step, displayK.value - 1)
})

const stageFigures = computed(() => {
  const extra = addendFigure.value
  return extra ? [...clusterFigures.value, extra] : clusterFigures.value
})

const counterFigures = computed<StageFigure[]>(() => {
  if (counterMode.value === "off") return []
  const k = counterValue.value
  if (counterMode.value === "plus-one" && k > 1) {
    return [
      { id: "counter-prev", value: k - 1 },
      { id: "counter-one", value: 1 },
    ]
  }
  return [{ id: "counter-k", value: k }]
})

const CHARACTER_FIT = 0.74
const RAIL_FIT = 0.92

const pxPerUnit = computed(() =>
  rowScale({
    figures: stageFigures.value.map((figure) => partsFor(figure.value)),
    availableWidth: availableWidth.value,
    availableHeight: availableHeight.value,
  }) * CHARACTER_FIT,
)

const counterGlow = computed(() => glowFor(counterValue.value) ?? "#c4a57a")

const gapPx = computed(() => Math.max(6, 0.4 * pxPerUnit.value))

const factK = computed(() => {
  if (reviewIndex.value !== null) return reviewIndex.value + 1
  if (arrivingIndex.value !== null) return arrivingIndex.value + 1
  return displayK.value
})

const lotFigures = computed<StageFigure[]>(() => {
  if (props.step === null || stageMode.value !== "lots") return []
  return Array.from({ length: displayK.value }, (_, index) => ({
    id: `lot-${index}`,
    value: props.step as number,
  }))
})

const lotRows = computed(() => {
  const figures = lotFigures.value
  if (figures.length <= LOT_COLS) return [figures]
  return [figures.slice(0, LOT_COLS), figures.slice(LOT_COLS)]
})

const lotPxPerUnit = computed(() => {
  if (props.step === null || lotFigures.value.length === 0) return 1
  const cols = Math.min(lotFigures.value.length, LOT_COLS)
  const rows = lotFigures.value.length > LOT_COLS ? 2 : 1
  return (
    rowScale({
      figures: Array.from({ length: cols }, () => partsFor(props.step as number)),
      availableWidth: availableWidth.value,
      availableHeight:
        rows === 1
          ? availableHeight.value
          : Math.max(48, (availableHeight.value - 14) / 2),
    }) * CHARACTER_FIT
  )
})

const editingStep = computed(
  () => props.activeField === "step" || props.step === null,
)

const stepFigure = computed(() => {
  if (editingStep.value) return props.stepDraft ?? props.step
  return props.step
})

const kPxPerUnit = computed(
  () =>
    rowScale({
      figures: counterFigures.value.map((figure) => partsFor(figure.value)),
      availableWidth: kWidth.value,
      availableHeight: kHeight.value,
    }) * RAIL_FIT,
)

const stepPxPerUnit = computed(() => {
  if (stepFigure.value === null) return 1
  return (
    rowScale({
      figures: [partsFor(stepFigure.value)],
      availableWidth: stepWidth.value,
      availableHeight: stepHeight.value,
    }) * RAIL_FIT
  )
})

const stepGlow = computed(() => glowFor(stepFigure.value) ?? "#c4a57a")

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

const productBoxValue = computed(() => {
  if (reviewProduct.value !== null) return reviewProduct.value
  if (
    holdReleased.value &&
    (props.draft === null || props.draft === lockedAnswer.value)
  ) {
    return null
  }
  return props.draft
})

const productReadonly = computed(
  () => holdingAnswer.value || reviewProduct.value !== null,
)

const bubbleActive = computed(
  () =>
    props.step !== null &&
    props.activeField === "product" &&
    !props.complete &&
    !productReadonly.value,
)

function productFor(index: number): number | null {
  return props.figured[index] ?? null
}

function sizeOf(value: number) {
  const size = displaySizeForParts(partsFor(value), pxPerUnit.value)
  return {
    width: `${size.width}px`,
    height: `${size.height}px`,
  }
}

function kSizeOf(value: number) {
  const size = displaySizeForParts(partsFor(value), kPxPerUnit.value)
  return {
    width: `${size.width}px`,
    height: `${size.height}px`,
  }
}

function stepSizeOf(value: number) {
  const size = displaySizeForParts(partsFor(value), stepPxPerUnit.value)
  return {
    width: `${size.width}px`,
    height: `${size.height}px`,
  }
}

function lotSizeOf(value: number) {
  const size = displaySizeForParts(partsFor(value), lotPxPerUnit.value)
  return {
    width: `${size.width}px`,
    height: `${size.height}px`,
  }
}

function setFigureRef(id: string, el: unknown) {
  if (el instanceof HTMLElement) figureEls.set(id, el)
  else figureEls.delete(id)
}

function setTrayRef(index: number, el: unknown) {
  if (el instanceof HTMLElement) trayEls.set(index, el)
  else trayEls.delete(index)
}

function isHidden(id: string) {
  return hiddenIds.value.includes(id)
}

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

function stillStage(gen: number) {
  return gen === stageGen
}

function measureEl(el: HTMLElement | null, minW = 48, minH = 72) {
  if (!el) return { w: minW, h: minH }
  const style = getComputedStyle(el)
  const padX =
    parseFloat(style.paddingLeft || "0") + parseFloat(style.paddingRight || "0")
  const padY =
    parseFloat(style.paddingTop || "0") + parseFloat(style.paddingBottom || "0")
  return {
    w: Math.max(minW, el.clientWidth - padX),
    h: Math.max(minH, el.clientHeight - padY),
  }
}

function measureStage() {
  const stage = measureEl(stageEl.value)
  availableWidth.value = stage.w
  availableHeight.value = stage.h
  const k = measureEl(kRailEl.value)
  kWidth.value = k.w
  kHeight.value = k.h
  const step = measureEl(stepRailEl.value)
  stepWidth.value = step.w
  stepHeight.value = step.h
}

function observeStage() {
  resize?.disconnect()
  resize = new ResizeObserver(measureStage)
  if (root.value) resize.observe(root.value)
  if (stageEl.value) resize.observe(stageEl.value)
  if (kRailEl.value) resize.observe(kRailEl.value)
  if (stepRailEl.value) resize.observe(stepRailEl.value)
  measureStage()
}

function boxFrom(
  source: DOMRect,
  dest: DOMRect,
  board: DOMRect,
  scaleToDest: boolean,
): CloneBox {
  const startCx = source.left + source.width / 2
  const destCx = dest.left + dest.width / 2
  const scale =
    scaleToDest && source.height > 0 ? dest.height / source.height : 1
  return {
    left: source.left - board.left,
    bottom: board.bottom - source.bottom,
    width: source.width,
    height: source.height,
    dx: destCx - startCx,
    dy: dest.bottom - source.bottom,
    scale,
  }
}

function measureClones(
  sources: HTMLElement[],
  dest: HTMLElement,
  values: number[],
  scaleToDest = false,
) {
  const board = root.value?.getBoundingClientRect()
  const destRect = dest.getBoundingClientRect()
  if (!board) return false
  const boxes: CloneBox[] = []
  const nextValues: number[] = []
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i]?.getBoundingClientRect()
    const value = values[i]
    if (!source || value === undefined) continue
    boxes.push(boxFrom(source, destRect, board, scaleToDest))
    nextValues.push(value)
  }
  if (boxes.length === 0) return false
  cloneBoxes.value = boxes
  cloneValues.value = nextValues
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
    "--scale": String(box.scale),
    "--merge-ms": `${MERGE_MS}ms`,
    "--fly-ms": `${FLY_MS}ms`,
  }
}

function clearClones() {
  clonesOn.value = false
  flying.value = false
  flyingToTray.value = false
  cloneScaled.value = true
  hiddenIds.value = []
  cloneBoxes.value = []
  cloneValues.value = []
}

function stopAll() {
  lockGen += 1
  stageGen += 1
  arrivingIndex.value = null
  popping.value = false
  counterPopping.value = false
  showKnown.value = false
  knownArriving.value = false
  trayHopping.value = false
  reviewIndex.value = null
  reviewProduct.value = null
  shakeBox.value = false
  holdReleased.value = false
  speakingPart.value = null
  counterMode.value = "off"
  clearClones()
  cancelSpeech()
  numberblocksAssets.stopAllSounds()
}

async function flyClones(
  sources: HTMLElement[],
  dest: HTMLElement,
  values: number[],
  duration: number,
  alive: () => boolean,
  scaleToDest = false,
  useStageScale = true,
) {
  if (!measureClones(sources, dest, values, scaleToDest)) return false
  clonesOn.value = true
  flyingToTray.value = scaleToDest
  cloneScaled.value = useStageScale
  flying.value = false
  await nextTick()
  if (!alive()) return false
  await sleep(32)
  if (!alive()) return false
  flying.value = true
  await sleep(duration)
  if (!alive()) return false
  clonesOn.value = false
  flying.value = false
  flyingToTray.value = false
  cloneScaled.value = true
  cloneBoxes.value = []
  cloneValues.value = []
  return true
}

async function playNamed(value: number) {
  if (!canSpeakNumber(value)) return
  await numberblocksAssets.playNumberName(value)
}

async function growCounter(gen: number) {
  if (counterValue.value <= 1) {
    counterMode.value = "k"
    return
  }
  if (prefersReducedMotion()) {
    counterMode.value = "k"
    return
  }

  counterMode.value = "plus-one"
  await nextTick()
  if (!stillStage(gen)) return

  const prev = figureEls.get("counter-prev")
  const one = figureEls.get("counter-one")
  const dest = counterEl.value ?? prev
  if (!prev || !one || !dest) {
    counterMode.value = "k"
    return
  }

  hiddenIds.value = ["counter-prev", "counter-one"]
  const moved = await flyClones(
    [prev, one],
    dest,
    [counterValue.value - 1, 1],
    MERGE_MS,
    () => stillStage(gen),
    false,
    false,
  )
  if (!stillStage(gen)) return
  hiddenIds.value = []
  counterMode.value = "k"
  if (moved) {
    counterPopping.value = true
    void numberblocksAssets.playSound("pop")
    await playNamed(counterValue.value)
    if (stillStage(gen)) counterPopping.value = false
  }
}

async function revealKnown(gen: number) {
  if (knownTotal.value === null) return
  showKnown.value = true
  knownArriving.value = true
  await nextTick()
  if (!stillStage(gen)) return

  const dest = knownTagEl.value
  const source = trayEls.get(displayK.value - 2)
  if (prefersReducedMotion() || !dest || !source) {
    knownArriving.value = false
    return
  }

  const moved = await flyClones(
    [source],
    dest,
    [knownTotal.value],
    FLY_MS,
    () => stillStage(gen),
    true,
    false,
  )
  if (!stillStage(gen)) return
  knownArriving.value = false
  if (moved) void numberblocksAssets.playSound("pop")
}

async function showUnitsThenMaybeGroup() {
  const gen = ++stageGen
  arrivingIndex.value = null
  popping.value = false
  counterPopping.value = false
  showKnown.value = false
  knownArriving.value = false
  reviewIndex.value = null
  reviewProduct.value = null
  clearClones()

  if (props.step === null) {
    stageMode.value = "empty"
    counterMode.value = "off"
    return
  }

  if (props.complete) {
    stageMode.value = "empty"
    counterMode.value = "k"
    counterValue.value = COUNT_LENGTH
    return
  }

  displayK.value = props.figured.length + 1
  counterValue.value = displayK.value
  if (displayK.value > COUNT_LENGTH) {
    stageMode.value = "empty"
    counterMode.value = "k"
    counterValue.value = COUNT_LENGTH
    return
  }

  stageMode.value = "units"
  counterMode.value = displayK.value === 1 ? "k" : "plus-one"
  await nextTick()
  measureStage()
  if (!stillStage(gen)) return

  await promptNextInput()
  if (!stillStage(gen)) return

  if (displayK.value === 1) return

  await growCounter(gen)
  if (!stillStage(gen)) return

  if (collapseKnown.value && displayK.value >= 3) {
    await sleep(UNITS_BEAT_MS)
    if (!stillStage(gen)) return
    await revealKnown(gen)
  }
}

async function promptNextInput() {
  if (props.step === null || props.complete) return
  if (props.justLockedIndex !== null) releaseAnswer()
  emit("focusProduct")
  await nextTick()
  productInput.value?.focus()
  if (prefersReducedMotion()) return
  shakeBox.value = false
  await nextTick()
  shakeBox.value = true
}

async function mergeToProduct(gen: number) {
  if (prefersReducedMotion()) {
    stageMode.value = "product"
    popping.value = true
    void numberblocksAssets.playSound("pop")
    await sleep(POP_MS)
    if (stillLock(gen)) popping.value = false
    return
  }

  await nextTick()
  if (!stillLock(gen)) return

  const figures = stageFigures.value
  const sources = figures
    .map((figure) => figureEls.get(figure.id))
    .filter((el): el is HTMLElement => el instanceof HTMLElement)
  const dest = clusterEl.value ?? stageEl.value
  if (!dest || sources.length === 0) {
    stageMode.value = "product"
    return
  }

  hiddenIds.value = figures.map((figure) => figure.id)
  const moved = await flyClones(
    sources,
    dest,
    figures.map((figure) => figure.value),
    MERGE_MS,
    () => stillLock(gen),
  )
  if (!stillLock(gen)) return
  hiddenIds.value = []
  stageMode.value = "product"
  if (moved) {
    popping.value = true
    void numberblocksAssets.playSound("pop")
    await sleep(POP_MS)
    if (stillLock(gen)) popping.value = false
  }
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
    speakingPart.value = part.key
    if (part.key === "product") popping.value = true
    await part.run()
    if (!stillLock(gen)) return
    if (i < parts.length - 1) {
      await sleep(SPEECH_PAUSE_MS)
      if (!stillLock(gen)) return
    }
  }

  popping.value = false
  speakingPart.value = null
}

async function flyToTray(index: number, gen: number) {
  await nextTick()
  if (!stillLock(gen) || props.step === null) return

  const dest = trayEls.get(index)
  const source =
    figureEls.get(clusterFigures.value[0]?.id ?? "") ??
    clusterEl.value ??
    stepRailEl.value
  const product = multiple(props.step, index + 1)

  if (prefersReducedMotion() || !dest || !source) {
    arrivingIndex.value = null
    return
  }

  hiddenIds.value = stageFigures.value.map((figure) => figure.id)
  await flyClones(
    [source],
    dest,
    [product],
    FLY_MS,
    () => stillLock(gen),
    true,
  )
  if (!stillLock(gen)) return
  hiddenIds.value = []
  arrivingIndex.value = null
}

async function countOutFinale(gen: number) {
  const step = props.step
  if (step === null) return

  stageMode.value = "lots"
  counterMode.value = "k"
  arrivingIndex.value = null
  showKnown.value = false
  knownArriving.value = false
  popping.value = false
  clearClones()

  for (let k = 1; k <= COUNT_LENGTH; k++) {
    if (!stillLock(gen)) return
    displayK.value = k
    counterValue.value = k
    reviewIndex.value = k - 1
    reviewProduct.value = multiple(step, k)
    speakingPart.value = "product"
    await nextTick()
    measureStage()
    await playNamed(multiple(step, k))
    if (!stillLock(gen)) return
    if (k < COUNT_LENGTH) {
      await sleep(SPEECH_PAUSE_MS)
      if (!stillLock(gen)) return
    }
  }

  speakingPart.value = null
  reviewIndex.value = null
  reviewProduct.value = null
  trayHopping.value = true
  await numberblocksAssets.playSound("pop")
  await sleep(900)
  if (stillLock(gen)) trayHopping.value = false
}

async function celebrateLock(index: number) {
  const gen = ++lockGen
  stageGen += 1
  arrivingIndex.value = index
  displayK.value = index + 1
  counterValue.value = index + 1
  counterMode.value = "k"
  speakingPart.value = null
  popping.value = false
  counterPopping.value = false
  showKnown.value = false
  knownArriving.value = false
  trayHopping.value = false
  reviewIndex.value = null
  reviewProduct.value = null
  shakeBox.value = false
  holdReleased.value = false
  clearClones()

  const k = index + 1
  await nextTick()
  if (!stillLock(gen)) return

  if (k >= 2) {
    await mergeToProduct(gen)
    if (!stillLock(gen)) return
  }

  await speakFact(k, gen)
  if (!stillLock(gen)) return

  await flyToTray(index, gen)
  if (!stillLock(gen)) return

  releaseAnswer()
  await nextTick()
  if (!stillLock(gen)) return

  if (props.complete) {
    await countOutFinale(gen)
    return
  }

  await showUnitsThenMaybeGroup()
}

function slotLabel() {
  if (props.step === null) return "Times answer"
  return `${factK.value} times ${props.step}`
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

watch(
  () => props.justLockedIndex,
  (index) => {
    if (index === null) {
      lockGen += 1
      cancelSpeech()
      numberblocksAssets.stopAllSounds()
      speakingPart.value = null
      popping.value = false
      counterPopping.value = false
      trayHopping.value = false
      reviewIndex.value = null
      reviewProduct.value = null
      shakeBox.value = false
      holdReleased.value = false
      clearClones()
      void showUnitsThenMaybeGroup()
      return
    }
    void celebrateLock(index)
  },
)

watch(
  () => props.step,
  () => {
    if (props.justLockedIndex !== null) return
    void showUnitsThenMaybeGroup()
  },
  { immediate: true },
)

watch(collapseKnown, () => {
  if (props.justLockedIndex !== null && !holdReleased.value) return
  if (props.step === null || props.complete) return
  void showUnitsThenMaybeGroup()
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
  observeStage()
})

onUnmounted(() => {
  stopAll()
  resize?.disconnect()
})

watch(
  () =>
    [
      stageFigures.value.map((figure) => figure.id).join(),
      lotFigures.value.map((figure) => figure.id).join(),
    ].join(),
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
    role="group"
    aria-label="Times counting"
    @pointerdown="onBoardPointerDown"
  >
    <div class="relation" aria-label="Times table">
      <div class="relation-grid">
        <div
          v-for="n in MULTIPLIERS"
          :key="`k-${n}`"
          class="relation-col"
          :class="{
            current:
              step !== null &&
              factK === n &&
              (!complete || reviewIndex !== null),
            done: productFor(n - 1) !== null && arrivingIndex !== n - 1,
          }"
          :style="{ '--glow': glowFor(n) ?? '#c4a57a' }"
        >
          <div class="relation-k">
            <NumberblockView :value="n" :alt="String(n)" />
            <span class="relation-num" :class="paintClass(n)" :style="paintStyle(n)">{{
              n
            }}</span>
          </div>
        </div>
      </div>
      <div class="relation-line" aria-hidden="true" />
      <div class="relation-grid">
        <div
          v-for="n in MULTIPLIERS"
          :key="`p-${n}`"
          :ref="(el) => setTrayRef(n - 1, el)"
          class="relation-col product"
          :class="{
            current:
              step !== null &&
              factK === n &&
              (!complete || reviewIndex !== null),
            ghost: arrivingIndex === n - 1,
            hop: trayHopping && productFor(n - 1) !== null,
            empty: productFor(n - 1) === null && arrivingIndex !== n - 1,
          }"
        >
          <div class="relation-product">
            <template v-if="productFor(n - 1) !== null">
              <NumberblockView
                :value="productFor(n - 1)"
                :alt="String(productFor(n - 1))"
              />
              <span
                class="relation-num"
                :class="paintClass(productFor(n - 1))"
                :style="paintStyle(productFor(n - 1))"
                >{{ productFor(n - 1) }}</span
              >
            </template>
          </div>
        </div>
      </div>
    </div>

    <label class="collapse-toggle">
      <input v-model="collapseKnown" type="checkbox" />
      <span>Group the known sum</span>
    </label>

    <div
      class="main"
      :style="{ '--k-glow': counterGlow, '--step-glow': stepGlow }"
    >
      <div
        ref="kRailEl"
        class="rail k-rail"
        :class="{
          live: step !== null && counterMode !== 'off',
          spoken: speakingPart === 'k',
          pop: counterPopping,
        }"
      >
        <div
          v-if="step !== null && counterMode !== 'off'"
          ref="counterEl"
          class="rail-cluster"
        >
          <template v-for="(figure, index) in counterFigures" :key="figure.id">
            <span v-if="index > 0" class="plus-mark" aria-hidden="true">+</span>
            <div
              :ref="(el) => setFigureRef(figure.id, el)"
              class="rail-unit"
              :class="{ hide: isHidden(figure.id) }"
              :style="kSizeOf(figure.value)"
            >
              <NumberblockView
                :value="figure.value"
                :alt="String(figure.value)"
                :px-per-unit="kPxPerUnit"
                :jumping="counterPopping && figure.id === 'counter-k'"
                :speaking="speakingPart === 'k' && figure.id === 'counter-k'"
              />
            </div>
          </template>
        </div>
      </div>

      <div class="fact" :class="{ setup: step === null }">
        <div class="fact-line">
          <span
            v-if="step !== null"
            class="fact-num"
            :class="[paintClass(factK), { spoken: speakingPart === 'k' }]"
            :style="paintStyle(factK)"
            >{{ factK }}</span
          >
          <span
            v-if="step !== null"
            class="times-mark"
            :class="{ on: speakingPart === 'times' }"
            aria-hidden="true"
            >×</span
          >
          <div
            class="fact-step"
            data-step-well
            :class="{ spoken: speakingPart === 'step', editing: editingStep }"
          >
            <MathInput
              v-if="editingStep"
              ref="stepInput"
              :value="stepDraft"
              :active="activeField === 'step'"
              slot-label="Count in"
              @focus="emit('focusStep')"
              @blur="emit('commitStep')"
            />
            <button
              v-else-if="step !== null"
              type="button"
              class="fact-keep"
              aria-label="Change step"
              @click="emit('focusStep')"
            >
              <span :class="paintClass(step)" :style="paintStyle(step)">{{
                step
              }}</span>
            </button>
          </div>
          <span
            v-if="step !== null"
            class="equals-mark"
            :class="{ on: speakingPart === 'equals' }"
            aria-hidden="true"
            >=</span
          >
          <div v-if="step !== null" class="fact-product">
            <MathInput
              ref="productInput"
              :value="productBoxValue"
              :active="bubbleActive"
              :readonly="productReadonly"
              :shake="shakeBox"
              :slot-label="slotLabel()"
              @focus="onProductFocus"
            />
          </div>
        </div>

        <div ref="stageEl" class="stage">
          <div
            v-if="stageMode === 'lots'"
            class="lots"
            :style="{ gap: `${Math.max(8, gapPx)}px` }"
          >
            <div
              v-for="(row, rowIndex) in lotRows"
              :key="rowIndex"
              class="lots-row"
              :style="{ gap: `${gapPx}px` }"
            >
              <div
                v-for="figure in row"
                :key="figure.id"
                class="unit"
                :style="lotSizeOf(figure.value)"
              >
                <NumberblockView
                  :value="figure.value"
                  :px-per-unit="lotPxPerUnit"
                  :speaking="speakingPart === 'product'"
                />
              </div>
            </div>
          </div>
          <div
            v-else-if="stageMode === 'units' || stageMode === 'product'"
            class="row"
            :style="{ gap: `${gapPx}px` }"
          >
            <div
              class="known-group"
              :class="{ named: showKnown }"
              :style="{ '--glow': glowFor(knownTotal) ?? '#c4a57a' }"
            >
              <div
                v-if="showKnown && knownTotal !== null"
                ref="knownTagEl"
                class="known-tag"
                :class="{ arriving: knownArriving }"
                :style="{ '--glow': glowFor(knownTotal) ?? '#c4a57a' }"
              >
                <span
                  class="known-num"
                  :class="paintClass(knownTotal)"
                  :style="paintStyle(knownTotal)"
                  >{{ knownTotal }}</span
                >
              </div>
              <div
                ref="clusterEl"
                class="cluster"
                :style="{ gap: `${gapPx}px` }"
              >
                <div
                  v-for="figure in clusterFigures"
                  :key="figure.id"
                  :ref="(el) => setFigureRef(figure.id, el)"
                  class="unit"
                  :class="{ hide: isHidden(figure.id) }"
                  :style="sizeOf(figure.value)"
                >
                  <NumberblockView
                    :value="figure.value"
                    :px-per-unit="pxPerUnit"
                    :jumping="popping && stageMode === 'product'"
                    :speaking="
                      speakingPart === 'product' && stageMode === 'product'
                    "
                  />
                </div>
              </div>
            </div>
            <span
              v-if="showKnown && addendFigure"
              class="plus-mark lot-plus"
              aria-hidden="true"
              >+</span
            >
            <div
              v-for="figure in addendFigure ? [addendFigure] : []"
              :key="figure.id"
              :ref="(el) => setFigureRef(figure.id, el)"
              class="unit"
              :class="{ hide: isHidden(figure.id), fresh: showKnown }"
              :style="sizeOf(figure.value)"
            >
              <NumberblockView
                :value="figure.value"
                :px-per-unit="pxPerUnit"
              />
            </div>
          </div>
        </div>
      </div>

      <div
        ref="stepRailEl"
        class="rail step-rail"
        data-step-well
        :class="{
          live: stepFigure !== null,
          spoken: speakingPart === 'step',
          editing: editingStep,
        }"
      >
        <button
          v-if="stepFigure !== null"
          type="button"
          class="rail-keep"
          aria-label="Change step"
          @click="emit('focusStep')"
        >
          <div class="rail-unit" :style="stepSizeOf(stepFigure)">
            <NumberblockView
              :value="stepFigure"
              :alt="String(stepFigure)"
              :px-per-unit="stepPxPerUnit"
              :speaking="speakingPart === 'step'"
            />
          </div>
        </button>
      </div>
    </div>

    <div v-if="clonesOn" class="merge-layer" aria-hidden="true">
      <div
        v-for="(box, index) in cloneBoxes"
        :key="index"
        class="clone"
        :class="{ flying, toTray: flyingToTray }"
        :style="cloneStyle(box)"
      >
        <NumberblockView
          :value="cloneValues[index]"
          :px-per-unit="cloneScaled ? pxPerUnit : kPxPerUnit"
        />
      </div>
    </div>
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

.relation {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0.22rem;
  padding: 0.1rem 0.2rem 0.45rem;
}

.collapse-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  flex: 0 0 auto;
  margin: 0 0 0.15rem;
  color: #6a645c;
  font-size: 0.82rem;
  font-weight: 800;
  cursor: pointer;
  user-select: none;
}

.collapse-toggle input {
  width: 1rem;
  height: 1rem;
  accent-color: #3aa8e0;
  cursor: pointer;
}

.relation-grid {
  display: grid;
  grid-template-columns: repeat(10, minmax(0, 1fr));
  gap: 0.28rem;
  align-items: end;
}

.relation-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  border-radius: 0.7rem;
  transition:
    background 0.2s ease,
    box-shadow 0.2s ease;
}

.relation-col.current {
  background: color-mix(in srgb, var(--glow) 18%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--glow) 45%, transparent);
}

.relation-k,
.relation-product {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  justify-content: center;
  gap: 0.2rem;
  width: 100%;
  min-height: 2.6rem;
}

.relation-k {
  padding-top: 0.12rem;
}

.relation-product {
  min-height: 3.2rem;
}

.relation-k :deep(.nb),
.relation-product :deep(.nb) {
  width: auto;
  height: 2.15rem;
  flex: 0 1 auto;
  min-width: 0;
}

.relation-num {
  font-size: 0.82rem;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.relation-k .relation-num,
.relation-product .relation-num {
  flex: 0 0 auto;
  font-size: clamp(1.2rem, 2.8vw, 1.85rem);
}

.relation-col.empty .relation-product {
  border-radius: 0.55rem;
  background: rgba(255, 255, 255, 0.28);
  box-shadow: inset 0 0 0 1.5px rgba(40, 20, 0, 0.1);
}

.relation-col.ghost {
  opacity: 0;
}

.relation-col.hop {
  animation: hop 0.42s ease-in-out 2;
}

.relation-k :deep(img),
.relation-product :deep(img) {
  filter: none;
  max-width: 100%;
  max-height: 100%;
}

.relation-line {
  height: 3px;
  margin: 0.05rem 0.15rem;
  border-radius: 99px;
  background: linear-gradient(
    90deg,
    transparent,
    #c4a57a 8%,
    #c4a57a 92%,
    transparent
  );
}

.main {
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: minmax(6.5rem, 1fr) minmax(0, 1.4fr) minmax(6.5rem, 1fr);
  gap: 0.45rem;
  min-height: 0;
  min-width: 0;
}

.rail {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  padding: 0.3rem 0.2rem 0.7rem;
  border-radius: 1.3rem;
  transition:
    background 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.k-rail.live {
  background: color-mix(in srgb, var(--k-glow) 18%, rgba(255, 255, 255, 0.35));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--k-glow) 40%, transparent);
}

.step-rail.live {
  background: color-mix(in srgb, var(--step-glow) 18%, rgba(255, 255, 255, 0.35));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--step-glow) 40%, transparent);
}

.k-rail.spoken,
.k-rail.pop,
.step-rail.spoken {
  transform: scale(1.03);
}

.rail-cluster,
.rail-keep {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 0.3rem;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.rail-keep {
  appearance: none;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.rail-unit {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.rail-unit :deep(.nb),
.clone.unscaled :deep(.nb) {
  width: 100%;
  height: 100%;
}

.rail-unit :deep(img),
.clone.unscaled :deep(img) {
  filter: none;
  max-width: 100%;
  max-height: 100%;
}

.rail-unit.hide {
  opacity: 0;
}

.fact {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.fact.setup {
  justify-content: center;
}

.fact-line {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.28rem 0.4rem;
  padding: 0.45rem 0.15rem 0.2rem;
}

.fact-num,
.fact-keep,
.times-mark,
.equals-mark {
  font-size: clamp(2.6rem, 6vw, 4.4rem);
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  user-select: none;
}

.fact-num.spoken,
.fact-step.spoken .fact-keep,
.times-mark.on,
.equals-mark.on {
  transform: scale(1.12);
}

.fact-keep {
  appearance: none;
  margin: 0;
  padding: 0.05em 0.12em;
  border: 0;
  border-radius: 0.35em;
  background: transparent;
  color: inherit;
  font-family: inherit;
  cursor: pointer;
}

.fact-step,
.fact-product {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}

.fact-step :deep(.slot),
.fact-product :deep(.slot) {
  --min: 4.4rem;
  max-width: 8.4rem;
  min-height: 4.2rem;
  font-size: clamp(2.4rem, 5.2vw, 4rem);
  border-radius: 1.2rem;
}

.plus-mark {
  align-self: center;
  margin-bottom: 0.45em;
  font-size: clamp(1.8rem, 4vw, 2.8rem);
  font-weight: 800;
  line-height: 1;
  color: #5a554e;
  user-select: none;
}

.stage {
  flex: 1 1 auto;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  padding: 0.25rem 0.2rem 0.85rem;
}

.lots,
.lots-row {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  min-width: 0;
  max-width: 100%;
}

.lots {
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.row,
.cluster,
.known-group {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  flex: 0 0 auto;
  min-width: 0;
  max-width: 100%;
}

.known-group {
  flex-direction: column;
  align-items: center;
  gap: 0.25rem;
}

.known-group.named .cluster {
  padding: 0.2rem 0.35rem 0.1rem;
  border-radius: 1rem;
  background: color-mix(in srgb, var(--glow, #c4a57a) 14%, rgba(255, 255, 255, 0.4));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--glow, #c4a57a) 35%, transparent);
}

.known-tag {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 2.2rem;
  padding: 0.12rem 0.5rem;
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--glow) 22%, #fff);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--glow) 50%, transparent);
}

.known-tag.arriving {
  opacity: 0;
}

.known-num {
  font-size: 1.6rem;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.lot-plus {
  margin-bottom: 0.85em;
}

.unit.fresh {
  filter: drop-shadow(0 0 10px color-mix(in srgb, #f2c01e 45%, transparent));
}

.unit {
  flex: 0 0 auto;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  transition: opacity 0.12s ease;
}

.unit.hide {
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
  transform: translate(0, 0) scale(1);
  transform-origin: bottom center;
  transition: transform var(--merge-ms, 780ms) cubic-bezier(0.33, 0.1, 0.25, 1);
}

.clone.toTray {
  transition-duration: var(--fly-ms, 720ms);
}

.clone.flying {
  transform: translate(var(--dx, 0px), var(--dy, 0px)) scale(var(--scale, 1));
}

@keyframes hop {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .clone {
    transition: none;
  }

  .relation-col.hop {
    animation: none;
  }
}

@media (max-width: 720px) {
  .relation-k :deep(.nb),
  .relation-product :deep(.nb) {
    height: 1.75rem;
  }

  .relation-num {
    font-size: 0.7rem;
  }

  .relation-k .relation-num,
  .relation-product .relation-num {
    font-size: 1.15rem;
  }

  .main {
    grid-template-columns: minmax(4.6rem, 1fr) minmax(0, 1.5fr) minmax(4.6rem, 1fr);
    gap: 0.25rem;
  }

  .fact-num,
  .fact-keep,
  .times-mark,
  .equals-mark {
    font-size: clamp(2rem, 7vw, 3.2rem);
  }

  .fact-step :deep(.slot),
  .fact-product :deep(.slot) {
    --min: 3.6rem;
    max-width: 6.4rem;
    min-height: 3.6rem;
    font-size: clamp(2rem, 6vw, 3rem);
  }
}
</style>
