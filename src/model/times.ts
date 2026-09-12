import { computed, ref } from "vue"
import { COUNT_LENGTH, multiple } from "../lib/math"

const MAX_PRODUCT_DIGITS = 3
const MAX_STEP_DIGITS = 2
const MAX_STEP = 99

export type TimesField = "step" | "product"

type Snapshot = {
  step: number | null
  stepDraft: number | null
  figured: number[]
  draft: number | null
  activeField: TimesField
  replaceNext: boolean
}

export function useTimesCount() {
  const step = ref<number | null>(null)
  const stepDraft = ref<number | null>(null)
  const figured = ref<number[]>([])
  const draft = ref<number | null>(null)
  const activeField = ref<TimesField>("step")
  const replaceNext = ref(true)
  const justLockedIndex = ref<number | null>(null)
  const celebrating = ref(false)
  const history = ref<Snapshot[]>([])

  const multiplier = computed(() => figured.value.length + 1)

  const expected = computed(() => {
    if (step.value === null) return null
    return multiple(step.value, multiplier.value)
  })

  const complete = computed(() => {
    if (step.value === null) return false
    return figured.value.length === COUNT_LENGTH
  })

  const canUndo = computed(() => history.value.length > 0)

  function snapshot(): Snapshot {
    return {
      step: step.value,
      stepDraft: stepDraft.value,
      figured: [...figured.value],
      draft: draft.value,
      activeField: activeField.value,
      replaceNext: replaceNext.value,
    }
  }

  function restore(entry: Snapshot) {
    step.value = entry.step
    stepDraft.value = entry.stepDraft
    figured.value = [...entry.figured]
    draft.value = entry.draft
    activeField.value = entry.activeField
    replaceNext.value = entry.replaceNext
    justLockedIndex.value = null
    celebrating.value = false
  }

  function lockCurrent() {
    const value = draft.value
    if (value === null) return
    justLockedIndex.value = figured.value.length
    figured.value = [...figured.value, value]
    replaceNext.value = true
    celebrating.value = true
    log("locked", { value })
  }

  function lockedAnswer(): number | null {
    if (justLockedIndex.value === null) return null
    return figured.value[justLockedIndex.value] ?? null
  }

  function clearDraft() {
    // Only drop the answer we just locked. An in-progress guess such as
    // the "1" of "12" must stay so the next digit can append.
    log("clearDraft")
    if (draft.value === lockedAnswer()) {
      draft.value = null
      replaceNext.value = true
    }
    celebrating.value = false
  }

  function debugState(extra?: Record<string, unknown>) {
    return {
      field: activeField.value,
      step: step.value,
      stepDraft: stepDraft.value,
      draft: draft.value,
      replaceNext: replaceNext.value,
      celebrating: celebrating.value,
      expected: expected.value,
      figured: [...figured.value],
      justLocked: justLockedIndex.value,
      locked: lockedAnswer(),
      ...extra,
    }
  }

  function log(label: string, extra?: Record<string, unknown>) {
    console.log(`[times] ${label}`, debugState(extra))
  }

  function applyStepDigit(digit: number) {
    if (digit === 0 && (replaceNext.value || stepDraft.value === null)) {
      log("step ignored leading 0", { digit })
      return
    }

    let next: number
    if (replaceNext.value || stepDraft.value === null) {
      next = digit
    } else {
      const candidate = stepDraft.value * 10 + digit
      if (String(candidate).length > MAX_STEP_DIGITS || candidate > MAX_STEP) {
        log("step rejected", { digit, candidate })
        return
      }
      next = candidate
    }

    history.value.push(snapshot())
    stepDraft.value = next
    replaceNext.value = false
    log("step applied", { digit, next })
  }

  function applyProductDigit(digit: number) {
    if (step.value === null || complete.value) {
      log("product blocked", {
        digit,
        reason: step.value === null ? "no-step" : "complete",
      })
      return
    }

    // 1×12 leaves draft=12 and can leave celebrating on. The next key
    // must start 24, not be dropped or appended onto 12.
    if (celebrating.value) {
      log("product during celebrate", { digit })
      if (draft.value === lockedAnswer()) {
        draft.value = null
        replaceNext.value = true
      }
      celebrating.value = false
    }

    let next: number
    if (replaceNext.value || draft.value === null) {
      next = digit
    } else {
      const candidate = draft.value * 10 + digit
      if (String(candidate).length > MAX_PRODUCT_DIGITS) {
        log("product rejected", { digit, candidate })
        return
      }
      next = candidate
    }

    history.value.push(snapshot())
    draft.value = next
    replaceNext.value = false
    log("product applied", { digit, next })
    if (next === expected.value) lockCurrent()
  }

  function applyDigit(digit: number) {
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) return
    log("digit", { digit })
    if (activeField.value === "step") applyStepDigit(digit)
    else applyProductDigit(digit)
  }

  function focusStep() {
    if (activeField.value !== "step") {
      stepDraft.value = step.value
      replaceNext.value = true
    }
    activeField.value = "step"
  }

  function commitStep() {
    if (activeField.value !== "step") return
    const value = stepDraft.value
    if (value !== null && value >= 1 && value <= MAX_STEP) {
      if (value !== step.value) {
        history.value.push(snapshot())
        step.value = value
        figured.value = []
        draft.value = null
        justLockedIndex.value = null
      }
      activeField.value = "product"
      replaceNext.value = true
      return
    }

    stepDraft.value = step.value
    if (step.value !== null) {
      activeField.value = "product"
      replaceNext.value = true
    }
  }

  function focusProduct() {
    if (activeField.value === "step") {
      commitStep()
      return
    }
    if (step.value !== null) activeField.value = "product"
  }

  function undo() {
    const previous = history.value.pop()
    if (!previous) return
    restore(previous)
  }

  function clear() {
    step.value = null
    stepDraft.value = null
    figured.value = []
    draft.value = null
    activeField.value = "step"
    replaceNext.value = true
    justLockedIndex.value = null
    celebrating.value = false
    history.value = []
  }

  return {
    step,
    stepDraft,
    figured,
    draft,
    multiplier,
    expected,
    complete,
    canUndo,
    justLockedIndex,
    activeField,
    applyDigit,
    focusStep,
    focusProduct,
    commitStep,
    clearDraft,
    debugState,
    undo,
    clear,
  }
}
