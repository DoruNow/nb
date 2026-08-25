<script setup lang="ts">
import { computed } from "vue"
import { glowFor } from "../lib/numberblockColors"

const props = withDefaults(
  defineProps<{
    value: number | null
    active: boolean
    slotLabel: string
    visible?: boolean
  }>(),
  { visible: true },
)

const emit = defineEmits<{
  focus: []
}>()

const glow = computed(() => glowFor(props.value))
</script>

<template>
  <button
    type="button"
    class="slot"
    :class="{ active, filled: value !== null && visible }"
    :style="{
      '--glow': glow ?? 'transparent',
    }"
    :aria-label="slotLabel"
    :aria-pressed="active"
    @click="emit('focus')"
  >
    <span v-if="value !== null && visible" class="numeral">{{ value }}</span>
  </button>
</template>

<style scoped>
.slot {
  display: flex;
  align-items: center;
  justify-content: center;
  justify-self: stretch;
  appearance: none;
  margin: 0;
  --min: 5.4rem;
  box-sizing: border-box;
  min-width: var(--min);
  width: 100%;
  min-height: 5.2rem;
  padding: 0.28em 0.5em;
  overflow: visible;
  border: 3px solid transparent;
  border-radius: 1.35rem;
  background: #fff;
  color: #1a1a1a;
  font: inherit;
  font-size: clamp(3.2rem, 7vw, 4.6rem);
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0;
  text-align: center;
  cursor: pointer;
  box-shadow:
    0 8px 18px rgba(80, 50, 20, 0.08),
    0 0 0 1px rgba(40, 20, 0, 0.06);
  transition:
    box-shadow 0.2s ease,
    border-color 0.2s ease,
    transform 0.15s ease;
}

.slot.filled {
  box-shadow:
    0 8px 18px rgba(80, 50, 20, 0.08),
    0 0 0 1px rgba(40, 20, 0, 0.06),
    0 0 22px color-mix(in srgb, var(--glow) 55%, transparent);
}

.slot.active {
  border-color: color-mix(in srgb, var(--glow) 70%, #3b3b3b);
  outline: 3px solid color-mix(in srgb, var(--glow) 35%, #5a6478);
  outline-offset: 4px;
  box-shadow:
    0 10px 22px rgba(80, 50, 20, 0.12),
    0 0 28px color-mix(in srgb, var(--glow) 70%, transparent);
}

.slot.active:not(.filled) {
  --glow: #7a8494;
  border-color: #6d7788;
  outline-color: rgba(90, 100, 120, 0.45);
}

.slot:focus-visible {
  outline: 3px solid #4a5568;
  outline-offset: 4px;
}

.numeral {
  display: block;
  width: 100%;
  text-align: center;
}
</style>
