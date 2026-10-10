<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue"
import CountSequence from "./components/CountSequence.vue"
import MathEquation from "./components/MathEquation.vue"
import NumberKeyboard from "./components/NumberKeyboard.vue"
import TimesCount from "./components/TimesCount.vue"
import TimesTable from "./components/TimesTable.vue"
import { numberblocksAssets } from "./lib/numberblocksSb3"
import {
  isOtherSpeechLanguage,
  refreshSpeechLanguageOptions,
  setSpeechLanguage,
  speechLanguage,
  speechLanguageOptions,
  unlockSpeech,
  type SpeechLanguage,
} from "./lib/speak"
import { useEquation } from "./model/equation"
import { useCount } from "./model/count"
import { useTimesCount } from "./model/times"
import { TABLE_MAX, type Operation } from "./lib/math"

type Mode = "add" | "count" | "times" | "table"

const mode = ref<Mode>("add")
const tableMax = ref(TABLE_MAX)
const tableMaxText = ref(String(TABLE_MAX))

const {
  columns: addColumns,
  operators: addOperators,
  activeField: addActiveField,
  correct: addCorrect,
  canUndo: addCanUndo,
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

const {
  step: timesStep,
  stepDraft: timesStepDraft,
  figured: timesFigured,
  draft: timesDraft,
  complete: timesComplete,
  canUndo: timesCanUndo,
  justLockedIndex: timesJustLockedIndex,
  activeField: timesActiveField,
  applyDigit: timesDigit,
  focusStep: timesFocusStep,
  focusProduct: timesFocusProduct,
  commitStep: timesCommitStep,
  clearDraft: timesClearDraft,
  debugState: timesDebugState,
  undo: timesUndo,
  clear: timesClear,
} = useTimesCount()

const canUndo = computed(() => {
  if (mode.value === "add") return addCanUndo.value
  if (mode.value === "count") return countCanUndo.value
  if (mode.value === "times") return timesCanUndo.value
  return false
})

function unlock() {
  void numberblocksAssets.unlockAudio()
  unlockSpeech()
}

const otherLanguageValue = computed(() =>
  isOtherSpeechLanguage(speechLanguage.value) ? speechLanguage.value : "",
)

function onSpeechLanguage(language: SpeechLanguage) {
  unlock()
  setSpeechLanguage(language)
}

function onOtherSpeechLanguage(event: Event) {
  const select = event.target
  if (!(select instanceof HTMLSelectElement) || !select.value) return
  onSpeechLanguage(select.value)
}

function setMode(next: Mode) {
  if (next === mode.value) return
  mode.value = next
  if (next === "add") addClear()
  else if (next === "count") countClear()
  else if (next === "times") timesClear()
}

function onTableMaxInput(event: Event) {
  const input = event.target as HTMLInputElement
  const raw = input.value.replace(/\D/g, "").slice(0, 2)
  input.value = raw
  tableMaxText.value = raw
  const n = Number(raw)
  if (Number.isInteger(n) && n >= 1 && n <= TABLE_MAX) {
    tableMax.value = n
  }
}

function commitTableMax() {
  tableMaxText.value = String(tableMax.value)
}

function onDigit(digit: number) {
  unlock()
  if (mode.value === "times") {
    console.log("[times] pad", digit, timesDebugState({ via: "pad" }))
  }
  if (mode.value === "count") countDigit(digit)
  else if (mode.value === "times") timesDigit(digit)
  else addDigit(digit)
}

function operationFromKey(key: string): Operation | null {
  if (key === "+" || key === "=") return "+"
  if (key === "-" || key === "−") return "-"
  if (key === "x" || key === "X" || key === "*" || key === "×") return "×"
  if (key === "/" || key === "÷") return "÷"
  return null
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
  else if (mode.value === "times") timesUndo()
  else addUndo()
}

function onClear() {
  if (mode.value === "count") countClear()
  else if (mode.value === "times") timesClear()
  else addClear()
}

function onKeydown(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey) return
  if (mode.value === "table") return
  const target = event.target
  if (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
  ) {
    return
  }

  if (mode.value === "times") {
    console.log("[times] keydown", event.key, timesDebugState({ mode: mode.value }))
  }

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

  if (event.key === "Escape") {
    event.preventDefault()
    onClear()
    return
  }

  if (mode.value === "times") {
    if (event.key === "Tab" || event.key === "Enter") {
      event.preventDefault()
      if (timesActiveField.value === "step") timesCommitStep()
      else if (event.key === "Tab") timesFocusStep()
    }
    return
  }

  if (mode.value === "count") return

  const operation = operationFromKey(event.key)
  if (operation) {
    event.preventDefault()
    onOperator(operation)
  } else if (event.key === " " || event.code === "Space") {
    event.preventDefault()
    onEquals()
  } else if (event.key === "Tab") {
    event.preventDefault()
    addAdvance()
  }
}

function onVoicesChanged() {
  refreshSpeechLanguageOptions()
}

onMounted(() => {
  window.addEventListener("keydown", onKeydown)
  refreshSpeechLanguageOptions()
  window.speechSynthesis?.addEventListener("voiceschanged", onVoicesChanged)
})

onUnmounted(() => {
  window.removeEventListener("keydown", onKeydown)
  window.speechSynthesis?.removeEventListener("voiceschanged", onVoicesChanged)
})
</script>

<template>
  <div class="room" :class="{ table: mode === 'table' }">
    <header class="topbar">
      <div class="modes" role="tablist" aria-label="Mode">
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
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'times'"
          :class="{ on: mode === 'times' }"
          @click="setMode('times')"
        >
          Times
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="mode === 'table'"
          :class="{ on: mode === 'table' }"
          @click="setMode('table')"
        >
          Table
        </button>
      </div>
      <label v-if="mode === 'table'" class="table-max">
        <span>Up to</span>
        <input
          :value="tableMaxText"
          inputmode="numeric"
          maxlength="2"
          autocomplete="off"
          aria-label="Show the table up to this number"
          @input="onTableMaxInput"
          @blur="commitTableMax"
          @keydown.enter.prevent="commitTableMax"
        />
      </label>
      <div class="langs" role="group" aria-label="Spraaktaal">
        <button
          type="button"
          :aria-pressed="speechLanguage === 'nl'"
          :class="{ on: speechLanguage === 'nl' }"
          @click="onSpeechLanguage('nl')"
        >
          NL
        </button>
        <button
          type="button"
          :aria-pressed="speechLanguage === 'en'"
          :class="{ on: speechLanguage === 'en' }"
          @click="onSpeechLanguage('en')"
        >
          EN
        </button>
        <label class="lang-other" :class="{ on: !!otherLanguageValue }">
          <span class="sr-only">Andere taal</span>
          <select
            :value="otherLanguageValue"
            aria-label="Andere spraaktaal"
            @change="onOtherSpeechLanguage"
            @focus="unlock"
          >
            <option value="" disabled>
              {{ otherLanguageValue ? "Andere…" : "…" }}
            </option>
            <option
              v-for="option in speechLanguageOptions"
              :key="option.tag"
              :value="option.tag"
            >
              {{ option.label }}
            </option>
          </select>
        </label>
      </div>
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
        v-else-if="mode === 'count'"
        :columns="countColumns"
        :step="countStep"
        :active-index="countActiveIndex"
        :complete="countComplete"
        :just-locked-index="justLockedIndex"
      />
      <TimesCount
        v-else-if="mode === 'times'"
        :step="timesStep"
        :step-draft="timesStepDraft"
        :figured="timesFigured"
        :draft="timesDraft"
        :complete="timesComplete"
        :just-locked-index="timesJustLockedIndex"
        :active-field="timesActiveField"
        :release-answer="timesClearDraft"
        @focus-step="timesFocusStep"
        @focus-product="timesFocusProduct"
        @commit-step="timesCommitStep"
        @clear-draft="timesClearDraft"
      />
      <TimesTable v-else :max="tableMax" />
    </div>

    <footer v-if="mode !== 'table'" class="band bottom">
      <NumberKeyboard
        :can-undo="canUndo"
        :mode="mode"
        :picking-step="mode === 'times' && timesStep === null"
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

.room.table {
  background: var(--wall);
  background-image: none;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  padding: 0.65rem 1rem 0;
}

.modes,
.langs {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.langs,
.table-max {
  position: absolute;
  top: 0.65rem;
}

.langs {
  right: 1rem;
}

.table-max {
  left: 1rem;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: #7a746c;
  font-size: 1.05rem;
  font-weight: 800;
}

.table-max input {
  width: 2.6rem;
  margin: 0;
  padding: 0.22rem 0.2rem;
  border: 0;
  border-radius: 0.7rem;
  background: rgba(255, 255, 255, 0.78);
  color: #1a1a1a;
  font: inherit;
  font-size: 1.05rem;
  font-weight: 800;
  line-height: 1;
  text-align: center;
  box-shadow: 0 0 0 1px rgba(40, 20, 0, 0.06);
}

.modes button,
.langs button,
.lang-other {
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
  text-decoration: none;
}

.langs button,
.lang-other {
  padding: 0.28rem 0.7rem;
  font-size: 0.95rem;
}

.lang-other {
  display: inline-flex;
  align-items: center;
  max-width: 9.5rem;
}

.lang-other select {
  appearance: none;
  width: 100%;
  margin: 0;
  border: 0;
  padding: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.modes button.on,
.langs button.on,
.lang-other.on {
  background: rgba(255, 255, 255, 0.78);
  color: #1a1a1a;
  box-shadow: 0 0 0 1px rgba(40, 20, 0, 0.06);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 640px) {
  .topbar {
    justify-content: space-between;
    gap: 0.4rem;
  }

  .langs,
  .table-max {
    position: static;
  }

  .lang-other {
    max-width: 7.5rem;
  }
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

.room.table .playfield {
  padding: 0.45rem 0.7rem 0.7rem;
}

.bottom {
  padding-top: 0.4rem;
}
</style>
