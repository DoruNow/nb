<script setup lang="ts">
import { computed } from "vue"

const props = withDefaults(
  defineProps<{
    canUndo: boolean
    mode?: "add" | "count" | "times"
  }>(),
  { mode: "add" },
)

const emit = defineEmits<{
  undo: []
  clear: []
}>()

type Shortcut = { key: string; action: string }

const shortcuts = computed<Shortcut[]>(() => {
  if (props.mode === "times") {
    return [
      { key: "0–9", action: "type product" },
      { key: "Enter", action: "keep step" },
      { key: "Tab", action: "step / answer" },
      { key: "⌫", action: "undo" },
      { key: "Esc", action: "clear" },
    ]
  }
  if (props.mode === "count") {
    return [
      { key: "0–9", action: "next number" },
      { key: "⌫", action: "undo" },
      { key: "Esc", action: "clear" },
    ]
  }
  return [
    { key: "0–9", action: "number" },
    { key: "+ / =", action: "+" },
    { key: "−", action: "−" },
    { key: "x", action: "×" },
    { key: "/", action: "÷" },
    { key: "Space", action: "=" },
    { key: "Tab", action: "next box" },
    { key: "⌫", action: "undo" },
    { key: "Esc", action: "clear" },
  ]
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

      <div class="hint" role="note" aria-label="Keyboard shortcuts">
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
        <ul class="map">
          <li v-for="item in shortcuts" :key="`${item.key}-${item.action}`">
            <kbd>{{ item.key }}</kbd>
            <span>{{ item.action }}</span>
          </li>
        </ul>
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
  </div>
</template>

<style scoped>
.bar {
  width: min(1080px, calc(100% - 1.4rem));
  margin: 0 auto 1rem;
  padding: 0.55rem 0.85rem;
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

.action {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.12rem;
  flex: 0 0 auto;
  min-width: 4.2rem;
  height: 3.1rem;
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
  width: 1.15rem;
  height: 1.15rem;
}

.action kbd {
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

.hint {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-width: 0;
  color: #7a746c;
  font-size: 0.82rem;
  font-weight: 700;
}

.hint svg {
  flex: 0 0 auto;
  width: 1.15rem;
  height: 1.15rem;
}

.map {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.map li {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.22rem 0.55rem 0.22rem 0.35rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 0 0 1px rgba(40, 20, 0, 0.07);
  color: #5c564e;
  white-space: nowrap;
}

.map kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-width: 1.2rem;
  height: 1.35rem;
  /* Bold glyphs sit high; extra top padding optically centers the label. */
  padding: 2px 0.32rem 0;
  border-radius: 999px;
  background: #efe8dc;
  color: #3f3a34;
  font-family: inherit;
  font-size: 0.72rem;
  font-weight: 800;
  line-height: 1;
}

@media (max-width: 720px) {
  .bar {
    width: calc(100% - 0.6rem);
    padding: 0.45rem 0.4rem;
  }

  .row {
    gap: 0.35rem;
  }

  .action {
    min-width: 3.2rem;
    height: 2.9rem;
    font-size: 0.68rem;
    padding: 0.2rem;
  }

  .hint {
    font-size: 0.72rem;
  }

  .hint svg {
    display: none;
  }
}
</style>
