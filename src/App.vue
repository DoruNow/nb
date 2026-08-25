<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue"
import MathEquation from "./components/MathEquation.vue"
import NumberKeyboard from "./components/NumberKeyboard.vue"
import { useEquation } from "./model/equation"

const {
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
} = useEquation()

const jumping = ref(false)

watch(correct, (value) => {
  jumping.value = value === true
})

function onKeydown(event: KeyboardEvent) {
  if (event.metaKey || event.ctrlKey || event.altKey) return

  if (event.key >= "0" && event.key <= "9") {
    event.preventDefault()
    applyDigit(Number(event.key))
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
        :left="left"
        :right="right"
        :answer="answer"
        :operation="operation"
        :active-field="activeField"
        :jumping="jumping"
        @focus="focus"
      />
    </div>

    <footer class="band bottom">
      <NumberKeyboard
        :can-undo="canUndo"
        @digit="applyDigit"
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
  width: min(1100px, calc(100% - 1.6rem));
  margin: 0 auto;
  min-height: 0;
  padding: 1.4rem 0.4rem 0.2rem;
}

.bottom {
  padding-top: 0.4rem;
}
</style>
