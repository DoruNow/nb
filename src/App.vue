<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue"
import CountSequence from "./components/CountSequence.vue"
import MathEquation from "./components/MathEquation.vue"
import NumberKeyboard from "./components/NumberKeyboard.vue"
import { numberblocksAssets } from "./lib/numberblocksSb3"
import { unlockSpeech } from "./lib/speak"
import { useEquation } from "./model/equation"
import { useCount } from "./model/count"
import type { Operation } from "./lib/math"

type Mode = "add" | "count"

const mode = ref<Mode>("add")

const {
  columns: addColumns,
  operators: addOperators,
  activeField: addActiveField,
  correct: addCorrect,
  canUndo: addCanUndo,
  canOperator,
  canEquals,
  pendingOperator,
  applyDigit: addDigit,
  applyOperator,
  applyEquals,
  focus: addFocus,
  advance: addAdvance,
  undo: addUndo,
  clear: addClear,
} = useEquation()

const {
  columns: countColumns,
  step: countStep,
  activeIndex: countActiveIndex,
  complete: countComplete,
  canUndo: countCanUndo,
  justLockedIndex,
  applyDigit: countDigit,
  undo: countUndo,
  clear: countClear,
} = useCount()

const canUndo = computed(() =>
  mode.value === "add" ? addCanUndo.value : countCanUndo.value,
)

function unlock() {
  void numberblocksAssets.unlockAudio()
  unlockSpeech()
}

function setMode(next: Mode) {
  if (next === mode.value) return
  mode.value = next
  if (next === "add") addClear()
  else countClear()
}

function onDigit(digit: number) {
  unlock()
  if (mode.value === "count") countDigit(digit)
  else addDigit(digit)
}

function onOperator(operation: Operation) {
  if (mode.value !== "add") return
  unlock()
  applyOperator(operation)
}

function onEquals() {
  if (mode.value !== "add") return
  unlock()
  applyEquals()
}

function onUndo() {
  if (mode.value === "count") countUndo()
  else addUndo()
}

function onClear() {
  if (mode.value === "count") countClear()
  else addClear()
}

function onKeydown(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey) return

  if (event.key >= "0" && event.key <= "9") {
    event.preventDefault()
    onDigit(Number(event.key))
    return
  }

  if (event.key === "Backspace") {
    event.preventDefault()
    onUndo()
    return
  }

  if (mode.value === "count") return

  if (
    event.key === "+" ||
    event.key === "=" ||
    event.key === "-" ||
    event.key === "−"
  ) {
    event.preventDefault()
    onOperator(event.key === "-" || event.key === "−" ? "-" : "+")
  } else if (event.key === " " || event.code === "Space") {
    event.preventDefault()
    onEquals()
  } else if (event.key === "Tab") {
    event.preventDefault()
    addAdvance()
  }
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown)
})

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown)
})
</script>

<template>
  <div class="room">
    <header class="modes" role="tablist" aria-label="Mode">
      <button
        type="button"
        role="tab"
        :aria-selected="mode === 'add'"
        :class="{ on: mode === 'add' }"
        @click="setMode('add')"
      >
        Add
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="mode === 'count'"
        :class="{ on: mode === 'count' }"
        @click="setMode('count')"
      >
        Count
      </button>
    </header>

    <div class="playfield">
      <MathEquation
        v-if="mode === 'add'"
        :columns="addColumns"
        :operators="addOperators"
        :active-field="addActiveField"
        :correct="addCorrect"
        @focus="addFocus"
      />
      <CountSequence
        v-else
        :columns="countColumns"
        :step="countStep"
        :active-index="countActiveIndex"
        :complete="countComplete"
        :just-locked-index="justLockedIndex"
      />
    </div>

    <footer class="band bottom">
      <NumberKeyboard
        :can-undo="canUndo"
        :can-operator="canOperator"
        :can-equals="canEquals"
        :pending-operator="pendingOperator"
        :show-operators="mode === 'add'"
        @digit="onDigit"
        @operator="onOperator"
        @equals="onEquals"
        @undo="onUndo"
        @clear="onClear"
      />
    </footer>
  </div>
</template>

<style scoped>
.room {
  display: flex;
  flex-direction: column;
  height: 100svh;
  min-height: 100svh;
  background-color: #f6edd9;
  background-image:
    repeating-linear-gradient(
      90deg,
      transparent 0 48px,
      rgba(120, 80, 30, 0.07) 48px 50px
    ),
    linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.22) 0%,
      transparent 24%
    ),
    linear-gradient(
      180deg,
      #f6edd9 0 57%,
      #e6ceaa 57% 58.2%,
      #ddc197 58.2% 100%
    );
  background-size:
    100% 43%,
    100% 100%,
    100% 100%;
  background-position:
    0 100%,
    0 0,
    0 0;
  background-repeat: no-repeat;
}

.modes {
  display: flex;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.65rem 1rem 0;
}

.modes button {
  appearance: none;
  margin: 0;
  border: 0;
  border-radius: 999px;
  padding: 0.28rem 0.95rem;
  background: transparent;
  color: #7a746c;
  font: inherit;
  font-size: 1.05rem;
  font-weight: 800;
  cursor: pointer;
}

.modes button.on {
  background: rgba(255, 255, 255, 0.78);
  color: #1a1a1a;
  box-shadow: 0 0 0 1px rgba(40, 20, 0, 0.06);
}

.band {
  display: flex;
  justify-content: center;
}

.playfield {
  flex: 1 1 auto;
  display: flex;
  width: 100%;
  margin: 0;
  min-width: 0;
  min-height: 0;
  padding: 0.7rem 1rem 0.2rem;
}

.bottom {
  padding-top: 0.4rem;
}
</style>
