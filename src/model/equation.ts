import { computed, ref } from "vue"
import { isCorrect, type Operation } from "../lib/math"

export type ColumnId = string
export type ColumnKind = "term" | "answer"

/** One number slot and its Numberblock. This is the source of truth for layout. */
export type Column = {
  id: ColumnId
  value: number | null
  kind: ColumnKind
}

const MAX_DIGITS = 3
const MAX_TERMS = 8
const ANSWER_ID = "answer"

type Snapshot = {
  columns: Column[]
  operators: Operation[]
  activeField: ColumnId
  replaceNext: boolean
}

function initialColumns(): Column[] {
  return [{ id: "term-0", value: null, kind: "term" }]
}

export function useEquation() {
  const columns = ref<Column[]>(initialColumns())
  const operators = ref<Operation[]>([])
  const activeField = ref<ColumnId>("term-0")
  const history = ref<Snapshot[]>([])
  const replaceNext = ref(true)
  let nextTermSeq = 1

  function terms(): Column[] {
    return columns.value.filter((column) => column.kind === "term")
  }

  function lastTerm(): Column | undefined {
    const list = terms()
    return list[list.length - 1]
  }

  function hasAnswer(): boolean {
    return columns.value.some((column) => column.kind === "answer")
  }

  function newTerm(): Column {
    return { id: `term-${nextTermSeq++}`, value: null, kind: "term" }
  }

  function getField(id: ColumnId): number | null {
    return columns.value.find((column) => column.id === id)?.value ?? null
  }

  function setField(id: ColumnId, value: number | null) {
    columns.value = columns.value.map((column) =>
      column.id === id ? { ...column, value } : column,
    )
  }

  function snapshot(): Snapshot {
    return {
      columns: columns.value.map((column) => ({ ...column })),
      operators: [...operators.value],
      activeField: activeField.value,
      replaceNext: replaceNext.value,
    }
  }

  function restore(entry: Snapshot) {
    columns.value = entry.columns.map((column) => ({ ...column }))
    operators.value = [...entry.operators]
    activeField.value = entry.activeField
    replaceNext.value = entry.replaceNext
  }

  function applyDigit(digit: number) {
    if (!Number.isInteger(digit) || digit < 0 || digit > 9) return
    if (!columns.value.some((column) => column.id === activeField.value)) return

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

  function applyOperator(operation: Operation) {
    if (hasAnswer()) return

    const last = lastTerm()
    if (!last) return

    if (last.value === null) {
      if (operators.value.length === 0) return
      history.value.push(snapshot())
      operators.value = [...operators.value.slice(0, -1), operation]
      return
    }

    if (terms().length >= MAX_TERMS) return

    history.value.push(snapshot())
    operators.value = [...operators.value, operation]
    const term = newTerm()
    columns.value = [...columns.value, term]
    activeField.value = term.id
    replaceNext.value = true
  }

  function applyEquals() {
    if (hasAnswer()) {
      activeField.value = ANSWER_ID
      replaceNext.value = true
      return
    }

    const termCols = terms()
    const last = termCols[termCols.length - 1]
    if (termCols.length < 2 || last?.value === null) return

    history.value.push(snapshot())
    columns.value = [
      ...columns.value,
      { id: ANSWER_ID, value: null, kind: "answer" },
    ]
    activeField.value = ANSWER_ID
    replaceNext.value = true
  }

  function focus(id: ColumnId) {
    if (!columns.value.some((column) => column.id === id)) return
    activeField.value = id
    replaceNext.value = true
  }

  function advance() {
    const ids = columns.value.map((column) => column.id)
    const index = ids.indexOf(activeField.value)
    const next = ids[index + 1]
    if (!next) return
    activeField.value = next
    replaceNext.value = true
  }

  function undo() {
    const previous = history.value.pop()
    if (!previous) return
    restore(previous)
  }

  function clear() {
    nextTermSeq = 1
    columns.value = initialColumns()
    operators.value = []
    activeField.value = "term-0"
    replaceNext.value = true
    history.value = []
  }

  const correct = computed(() => {
    const termCols = terms()
    const answer = columns.value.find((column) => column.kind === "answer")
    if (!answer) return null
    return isCorrect(
      termCols.map((column) => column.value),
      operators.value,
      answer.value,
    )
  })

  const canUndo = computed(() => history.value.length > 0)

  const canOperator = computed(() => {
    if (hasAnswer()) return false
    const last = lastTerm()
    if (!last) return false
    if (last.value === null) return operators.value.length > 0
    return terms().length < MAX_TERMS
  })

  const canEquals = computed(() => {
    if (hasAnswer()) return true
    const termCols = terms()
    const last = termCols[termCols.length - 1]
    return termCols.length >= 2 && last?.value !== null
  })

  const pendingOperator = computed<Operation | null>(() => {
    const last = lastTerm()
    if (!last || last.value !== null || operators.value.length === 0) return null
    return operators.value[operators.value.length - 1] ?? null
  })

  return {
    columns,
    operators,
    activeField,
    correct,
    canUndo,
    canOperator,
    canEquals,
    pendingOperator,
    applyDigit,
    applyOperator,
    applyEquals,
    focus,
    advance,
    undo,
    clear,
  }
}
