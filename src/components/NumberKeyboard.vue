<script setup lang="ts">
import { computed } from "vue"
import type { Operation } from "../lib/math"

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const

const props = withDefaults(
  defineProps<{
    canUndo: boolean
    canOperator: boolean
    canEquals: boolean
    pendingOperator: Operation | null
    showOperators?: boolean
    mode?: "add" | "count" | "times"
  }>(),
  { showOperators: true, mode: "add" },
)

const emit = defineEmits<{
  digit: [value: number]
  operator: [value: Operation]
  equals: []
  undo: []
  clear: []
}>()

const hint = computed(() => {
  if (props.mode === "times") {
    return "Type the product · Backspace undo · Enter keeps the step · Tab switches step / answer · Clear resets"
  }
  if (props.mode === "count") {
    return "Type the next number · Backspace undo · Clear resets"
  }
  return "Type a number, then + or − · Space for = · Tab next box · Backspace undo · Clear resets"
})
</script>

<template>
  <div class="bar">
    <div class="row">
      <button
        type="button"
        class="action"
        tabindex="-1"
        :disabled="!canUndo"
        aria-label="Undo"
        @mousedown.prevent
        @click="emit('undo')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M9 7H5V3M5.4 16.5A7.5 7.5 0 1 0 7 7.2"
          />
        </svg>
        <span>Undo</span>
        <kbd>⌫</kbd>
      </button>

      <div class="keys" role="group" aria-label="Number keys">
        <button
          v-for="digit in DIGITS"
          :key="digit"
          type="button"
          class="key"
          tabindex="-1"
          :aria-label="String(digit)"
          @mousedown.prevent
          @click="emit('digit', digit)"
        >
          {{ digit }}
        </button>
      </div>

      <button
        type="button"
        class="action"
        tabindex="-1"
        aria-label="Clear"
        @mousedown.prevent
        @click="emit('clear')"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            d="M7 7l10 10M17 7L7 17"
          />
        </svg>
        <span>Clear</span>
        <kbd>Esc</kbd>
      </button>
    </div>

    <div v-if="showOperators" class="ops" role="group" aria-label="Operations">
      <button
        type="button"
        class="op-key plus"
        tabindex="-1"
        :class="{ pending: pendingOperator === '+' }"
        :disabled="!canOperator"
        aria-label="Plus"
        @mousedown.prevent
        @click="emit('operator', '+')"
      >
        <span>+</span>
        <kbd>+</kbd>
      </button>
      <button
        type="button"
        class="op-key minus"
        tabindex="-1"
        :class="{ pending: pendingOperator === '-' }"
        :disabled="!canOperator"
        aria-label="Minus"
        @mousedown.prevent
        @click="emit('operator', '-')"
      >
        <span>−</span>
        <kbd>−</kbd>
      </button>
      <button
        type="button"
        class="op-key equals"
        tabindex="-1"
        :disabled="!canEquals"
        aria-label="Equals"
        @mousedown.prevent
        @click="emit('equals')"
      >
        <span>=</span>
        <kbd>Space</kbd>
      </button>
    </div>

    <p class="hint">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect
          x="3"
          y="6"
          width="18"
          height="12"
          rx="2"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        />
        <path
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          d="M7 15h10"
        />
      </svg>
      {{ hint }}
    </p>
  </div>
</template>

<style scoped>
.bar {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  width: min(1080px, calc(100% - 1.4rem));
  margin: 0 auto 1rem;
  padding: 0.7rem 1rem 0.6rem;
  border-radius: 1.5rem;
  background: rgba(255, 255, 255, 0.78);
  box-shadow:
    0 10px 28px rgba(70, 45, 15, 0.12),
    0 0 0 1px rgba(255, 255, 255, 0.7) inset;
  backdrop-filter: blur(10px);
}

.row {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.keys {
  display: flex;
  flex: 1;
  align-items: stretch;
  justify-content: center;
  gap: 0.4rem;
  min-width: 0;
}

.key {
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2.4rem;
  max-width: 5.2rem;
  height: 3.5rem;
  padding: 0;
  border: 0;
  border-radius: 0.85rem;
  background: #fff;
  color: #1a1a1a;
  font: inherit;
  font-size: 1.65rem;
  font-weight: 800;
  line-height: 1;
  box-shadow:
    0 3px 0 #d9d4cc,
    0 6px 12px rgba(70, 45, 15, 0.08);
  cursor: pointer;
}

.key:hover {
  transform: translateY(-1px);
}

.key:active {
  transform: translateY(1px);
  box-shadow:
    0 1px 0 #d9d4cc,
    0 2px 6px rgba(70, 45, 15, 0.08);
}

.action {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.12rem;
  min-width: 4.6rem;
  height: 3.5rem;
  padding: 0.25rem 0.45rem;
  border: 0;
  border-radius: 0.85rem;
  background: #ece8e2;
  color: #4a4a4a;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
}

.action svg {
  width: 1.2rem;
  height: 1.2rem;
}

.action kbd,
.op-key kbd {
  font-family: inherit;
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #8a8378;
  background: transparent;
}

.action:disabled {
  opacity: 0.45;
  cursor: default;
}

.ops {
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 0.55rem;
}

.op-key {
  flex: 0 1 7.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.05rem;
  min-width: 4.8rem;
  height: 3.4rem;
  border: 0;
  border-radius: 0.95rem;
  background: #fff;
  color: #1a1a1a;
  font: inherit;
  font-size: 1.7rem;
  font-weight: 800;
  line-height: 1;
  box-shadow:
    0 3px 0 #d9d4cc,
    0 6px 12px rgba(70, 45, 15, 0.08);
  cursor: pointer;
}

.op-key.plus.pending,
.op-key.minus.pending {
  outline: 3px solid rgba(90, 100, 120, 0.4);
  outline-offset: 2px;
}

.op-key:hover:not(:disabled) {
  transform: translateY(-1px);
}

.op-key:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow:
    0 1px 0 #d9d4cc,
    0 2px 6px rgba(70, 45, 15, 0.08);
}

.op-key:disabled {
  opacity: 0.4;
  cursor: default;
}

.hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  margin: 0;
  color: #7a746c;
  font-size: 0.82rem;
  font-weight: 700;
  text-align: center;
}

.hint svg {
  flex: 0 0 auto;
  width: 1.15rem;
  height: 1.15rem;
}

@media (max-width: 720px) {
  .bar {
    width: calc(100% - 0.6rem);
    padding: 0.55rem 0.45rem 0.5rem;
  }

  .row {
    gap: 0.3rem;
  }

  .key {
    height: 3.1rem;
    min-width: 0;
    font-size: 1.35rem;
  }

  .action {
    min-width: 3.4rem;
    height: 3.1rem;
    font-size: 0.68rem;
    padding: 0.2rem 0.2rem;
  }

  .op-key {
    flex: 1 1 0;
    max-width: 7rem;
    height: 3rem;
    font-size: 1.45rem;
  }

  .hint {
    font-size: 0.72rem;
  }
}
</style>
