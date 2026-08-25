import { computed, ref } from "vue"
import { isCorrect, type Operation } from "../lib/math"

export type FieldId = "left" | "right" | "answer"

const MAX_DIGITS = 3

const NEXT_FIELD: Record<FieldId, FieldId> = {
  left: "right",
  right: "answer",
  answer: "answer",
}

type Snapshot = {
  left: number | null
  right: number | null
  answer: number | null
  activeField: FieldId
  replaceNext: boolean
}

export function useEquation() {
  const left = ref<number | null>(null)
  const right = ref<number | null>(null)
  const answer = ref<number | null>(null)
  const operation = ref<Operation>("+")
  const activeField = ref<FieldId>("left")
  const history = ref<Snapshot[]>([])
  const replaceNext = ref(true)

  function getField(field: FieldId): number | null {
    if (field === "left") return left.value
    if (field === "right") return right.value
    return answer.value
  }

  function snapshot(): Snapshot {
    return {
      left: left.value,
      right: right.value,
      answer: answer.value,
      activeField: activeField.value,
      replaceNext: replaceNext.value,
    }
  }

  function restore(entry: Snapshot) {
    left.value = entry.left
    right.value = entry.right
    answer.value = entry.answer
    activeField.value = entry.activeField
    replaceNext.value = entry.replaceNext
  }

  function setField(field: FieldId, value: number | null) {
    if (field === "left") left.value = value
    else if (field === "right") right.value = value
    else answer.value = value
  }

  function applyDigit(digit: number) {
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) return

    const current = getField(activeField.value)
    let next: number
    if (replaceNext.value || current === null) {
      next = digit
    } else {
      const candidate = current * 10 + digit
      if (String(candidate).length > MAX_DIGITS) return
      next = candidate
    }

    history.value.push(snapshot())
    setField(activeField.value, next)
    replaceNext.value = false
  }

  function focus(field: FieldId) {
    activeField.value = field
    replaceNext.value = true
  }

  function advance() {
    activeField.value = NEXT_FIELD[activeField.value]
    replaceNext.value = true
  }

  function undo() {
    const previous = history.value.pop()
    if (!previous) return
    restore(previous)
  }

  function clear() {
    left.value = null
    right.value = null
    answer.value = null
    activeField.value = "left"
    replaceNext.value = true
    history.value = []
  }

  const correct = computed(() =>
    isCorrect(left.value, right.value, answer.value, operation.value),
  )

  const canUndo = computed(() => history.value.length > 0)

  return {
    left,
    right,
    answer,
    operation,
    activeField,
    correct,
    canUndo,
    applyDigit,
    focus,
    advance,
    undo,
    clear,
  }
}
