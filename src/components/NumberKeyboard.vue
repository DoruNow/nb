<script setup lang="ts">
import type { Operation } from "../lib/math"
import NumberblockView from "./NumberblockView.vue"

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const

withDefaults(
  defineProps<{
    canUndo: boolean
    canOperator: boolean
    canEquals: boolean
    pendingOperator: Operation | null
    showOperators?: boolean
  }>(),
  { showOperators: true },
)

const emit = defineEmits<{
  digit: [value: number]
  operator: [value: Operation]
  equals: []
  undo: []
  clear: []
}>()
</script>

<template>
  <div class="bar">
    <div class="row">
      <button
        type="button"
        class="action"
        :disabled="!canUndo"
        aria-label="Undo"
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
        Undo
      </button>

      <div class="keys" role="group" aria-label="Number keys">
        <button
          v-for="digit in DIGITS"
          :key="digit"
          type="button"
          class="key"
          :aria-label="String(digit)"
          @click="emit('digit', digit)"
        >
          <span class="digit" aria-hidden="true">{{ digit }}</span>
          <NumberblockView
            class="thumb"
            :value="digit"
            :alt="String(digit)"
          />
        </button>
      </div>

      <button
        type="button"
        class="action"
        aria-label="Clear"
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
        Clear
      </button>
    </div>

    <div v-if="showOperators" class="ops" role="group" aria-label="Operations">
      <button
        type="button"
        class="op-key plus"
        :class="{ pending: pendingOperator === '+' }"
        :disabled="!canOperator"
        aria-label="Plus"
        @click="emit('operator', '+')"
      >
        +
      </button>
      <button
        type="button"
        class="op-key minus"
        :class="{ pending: pendingOperator === '-' }"
        :disabled="!canOperator"
        aria-label="Minus"
        @click="emit('operator', '-')"
      >
        −
      </button>
      <button
        type="button"
        class="op-key equals"
        :disabled="!canEquals"
        aria-label="Equals"
        @click="emit('equals')"
      >
        =
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
      {{
        showOperators
          ? "Type a number, then + or −. The = key is +. Space for ="
          : "Type the next number"
      }}
    </p>
  </div>
</template>

<style scoped>
.bar {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  width: min(1080px, calc(100% - 1.4rem));
  margin: 0 auto 1rem;
  padding: 0.85rem 1rem 0.7rem;
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
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  min-width: 3rem;
  max-width: 5.6rem;
  height: 6.4rem;
  padding: 0.28rem 0.15rem 0.22rem;
  border: 0;
  border-radius: 0.95rem;
  background: #fff;
  color: #1a1a1a;
  box-shadow:
    0 3px 0 #d9d4cc,
    0 6px 12px rgba(70, 45, 15, 0.08);
  cursor: pointer;
}

.digit {
  flex: 0 0 auto;
  font-size: 0.92rem;
  font-weight: 800;
  line-height: 1;
  color: #2a2a2a;
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

.thumb {
  flex: 1 1 auto;
  width: 100%;
  min-height: 0;
  height: auto;
}

.thumb :deep(img) {
  filter: none;
  max-height: 100%;
  object-position: bottom center;
}

.action {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.15rem;
  min-width: 4.4rem;
  height: 6.4rem;
  padding: 0.4rem 0.55rem;
  border: 0;
  border-radius: 0.9rem;
  background: #ece8e2;
  color: #4a4a4a;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 800;
  cursor: pointer;
}

.action svg {
  width: 1.35rem;
  height: 1.35rem;
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
  min-width: 4.8rem;
  height: 3.6rem;
  border: 0;
  border-radius: 0.95rem;
  background: #fff;
  color: #1a1a1a;
  font: inherit;
  font-size: 2rem;
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
  font-size: 0.92rem;
  font-weight: 700;
}

.hint svg {
  width: 1.15rem;
  height: 1.15rem;
}

@media (max-width: 720px) {
  .bar {
    width: calc(100% - 0.6rem);
    padding: 0.65rem 0.45rem 0.55rem;
  }

  .row {
    gap: 0.3rem;
  }

  .key {
    height: 5.6rem;
    min-width: 0;
    padding: 0.25rem 0.1rem;
  }

  .action {
    min-width: 3.2rem;
    height: 5.6rem;
    font-size: 0.68rem;
    padding: 0.3rem 0.25rem;
  }

  .digit {
    font-size: 0.8rem;
  }

  .op-key {
    flex: 1 1 0;
    max-width: 7rem;
    height: 3.2rem;
    font-size: 1.7rem;
  }
}
</style>
