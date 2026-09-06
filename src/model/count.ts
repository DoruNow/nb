import { computed, ref } from "vue"
import { COUNT_LENGTH, multiple } from "../lib/math"

export type CountColumn = {
  id: string
  value: number | null
}

const MAX_DIGITS = 3

type Snapshot = {
  columns: CountColumn[]
  step: number | null
  activeIndex: number
  replaceNext: boolean
}

function initialColumns(): CountColumn[] {
  return Array.from({ length: COUNT_LENGTH }, (_, index) => ({
    id: `count-${index}`,
    value: null,
  }))
}

export function useCount() {
  const columns = ref<CountColumn[]>(initialColumns())
  const step = ref<number | null>(null)
  const activeIndex = ref(0)
  const justLockedIndex = ref<number | null>(null)
  const history = ref<Snapshot[]>([])
  const replaceNext = ref(true)

  const expected = computed(() => {
    if (step.value === null) return null
    return multiple(step.value, activeIndex.value + 1)
  })

  const complete = computed(() => {
    if (step.value === null) return false
    return columns.value.every(
      (column, index) => column.value === multiple(step.value!, index + 1),
    )
  })

  const canUndo = computed(() => history.value.length > 0)

  const activeField = computed(() => columns.value[activeIndex.value]?.id ?? "count-0")

  function snapshot(): Snapshot {
    return {
      columns: columns.value.map((column) => ({ ...column })),
      step: step.value,
      activeIndex: activeIndex.value,
      replaceNext: replaceNext.value,
    }
  }

  function restore(entry: Snapshot) {
    columns.value = entry.columns.map((column) => ({ ...column }))
    step.value = entry.step
    activeIndex.value = entry.activeIndex
    replaceNext.value = entry.replaceNext
    justLockedIndex.value = null
  }

  function setActiveValue(value: number | null) {
    const index = activeIndex.value
    columns.value = columns.value.map((column, columnIndex) =>
      columnIndex === index ? { ...column, value } : column,
    )
  }

  function lockCurrent() {
    justLockedIndex.value = activeIndex.value
    replaceNext.value = true
    if (activeIndex.value < COUNT_LENGTH - 1) {
      activeIndex.value += 1
    }
  }

  function applyDigit(digit: number) {
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) return
    if (complete.value) return

    if (step.value === null) {
      if (digit === 0) return
      history.value.push(snapshot())
      setActiveValue(digit)
      step.value = digit
      replaceNext.value = false
      lockCurrent()
      return
    }

    const current = columns.value[activeIndex.value]?.value ?? null
    let next: number
    if (replaceNext.value || current === null) {
      next = digit
    } else {
      const candidate = current * 10 + digit
      if (String(candidate).length > MAX_DIGITS) return
      next = candidate
    }

    history.value.push(snapshot())
    setActiveValue(next)
    replaceNext.value = false

    if (next === expected.value) lockCurrent()
  }

  function undo() {
    const previous = history.value.pop()
    if (!previous) return
    restore(previous)
  }

  function clear() {
    columns.value = initialColumns()
    step.value = null
    activeIndex.value = 0
    justLockedIndex.value = null
    replaceNext.value = true
    history.value = []
  }

  return {
    columns,
    step,
    activeIndex,
    activeField,
    expected,
    complete,
    canUndo,
    justLockedIndex,
    applyDigit,
    undo,
    clear,
  }
}
