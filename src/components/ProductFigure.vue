<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue"
import {
  numberblocksAssets,
  type NumberblockScene,
} from "../lib/numberblocksSb3"

const props = defineProps<{
  value: number
  alt?: string
  awake?: boolean
}>()

const parts = ref<NumberblockScene[]>([])
let requestId = 0

const partCount = computed(() => Math.max(parts.value.length, 1))

function overlayStyle(part: NumberblockScene) {
  const { body, width, height, viewX, viewY } = part
  const bw = Math.max(body.width, 0.001)
  const bh = Math.max(body.height, 0.001)
  return {
    width: `${(width / bw) * 100}%`,
    height: `${(height / bh) * 100}%`,
    left: `${(-((body.x - viewX) / bw) * 100)}%`,
    top: `${(-((body.y - viewY) / bh) * 100)}%`,
  }
}

function fitStyle(part: NumberblockScene) {
  return {
    "--ar": String(part.body.width / Math.max(part.body.height, 0.001)),
  }
}

async function load(value: number) {
  const id = ++requestId
  try {
    const next = await numberblocksAssets.getNumberblockScene(value)
    if (id !== requestId) return
    parts.value = next
  } catch {
    if (id === requestId) parts.value = []
  }
}

watch(
  () => props.value,
  (value) => {
    void load(value)
  },
  { immediate: true },
)

onUnmounted(() => {
  requestId += 1
})
</script>

<template>
  <div
    class="figure"
    :class="{ awake }"
    :style="{ '--parts': String(partCount) }"
    role="img"
    :aria-label="alt ?? String(value)"
  >
    <div
      v-for="(part, index) in parts"
      :key="index"
      class="fit"
      :style="fitStyle(part)"
    >
      <div class="life" :style="overlayStyle(part)" v-html="part.svg" />
    </div>
  </div>
</template>

<style scoped>
.figure {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  justify-content: center;
  gap: 0.04rem;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  container-type: size;
}

.fit {
  position: relative;
  flex: 0 1 auto;
  width: min(calc(100cqw / var(--parts, 1)), calc(100cqh * var(--ar, 1)));
  height: min(100cqh, calc((100cqw / var(--parts, 1)) / var(--ar, 1)));
  overflow: hidden;
}

.figure.awake .fit {
  overflow: visible;
}

.life {
  position: absolute;
  pointer-events: none;
}

.life :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.figure :deep([data-part="numeral"]) {
  opacity: 0;
}

.figure :deep([data-part="limb"]),
.figure :deep([data-part="face"]) {
  opacity: 0;
  transition: opacity 0.22s ease;
}

.figure.awake :deep([data-part="limb"]),
.figure.awake :deep([data-part="face"]) {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .figure :deep([data-part="limb"]),
  .figure :deep([data-part="face"]) {
    transition: none;
  }
}
</style>
