<script setup lang="ts">
import { onMounted, onUnmounted } from "vue"
import MathEquation from "./components/MathEquation.vue"
import NumberKeyboard from "./components/NumberKeyboard.vue"
import { numberblocksAssets } from "./lib/numberblocksSb3"
import { unlockSpeech } from "./lib/speak"
import { useEquation } from "./model/equation"
import type { Operation } from "./lib/math"

const {
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
} = useEquation()

function unlock() {
  void numberblocksAssets.unlockAudio()
  unlockSpeech()
}

function onDigit(digit: number) {
  unlock()
  applyDigit(digit)
}

function onOperator(operation: Operation) {
  unlock()
  applyOperator(operation)
}

function onEquals() {
  unlock()
  applyEquals()
}

function onKeydown(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey) return

  if (event.key >= "0" && event.key <= "9") {
    event.preventDefault()
    onDigit(Number(event.key))
  } else if (
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
    advance()
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
    <div class="playfield">
      <MathEquation
        :columns="columns"
        :operators="operators"
        :active-field="activeField"
        :correct="correct"
        @focus="focus"
      />
    </div>

    <footer class="band bottom">
      <NumberKeyboard
        :can-undo="canUndo"
        :can-operator="canOperator"
        :can-equals="canEquals"
        :pending-operator="pendingOperator"
        @digit="onDigit"
        @operator="onOperator"
        @equals="onEquals"
        @undo="undo"
        @clear="clear"
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
  padding: 1.4rem 1rem 0.2rem;
}

.bottom {
  padding-top: 0.4rem;
}
</style>
