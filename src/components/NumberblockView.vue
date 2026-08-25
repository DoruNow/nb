<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue"
import { displaySize } from "../lib/numberblockScale"
import {
  numberblocksAssets,
  splitOfficialAddends,
  type NumberblockAsset,
} from "../lib/numberblocksSb3"

const props = defineProps<{
  value: number | null
  alt?: string
  jumping?: boolean
  keepNumeral?: boolean
  pxPerUnit?: number
}>()

const assets = ref<NumberblockAsset[]>([])
const addends = ref<number[]>([])
let requestId = 0

const sized = computed(
  () => props.pxPerUnit !== undefined && props.pxPerUnit > 0,
)

function sizeFor(part: number, asset: NumberblockAsset) {
  if (!sized.value || props.pxPerUnit === undefined) return undefined
  const { height } = displaySize(part, props.pxPerUnit)
  const aspect = asset.width / Math.max(asset.height, 1)
  return { width: height * aspect, height }
}

async function load(value: number | null) {
  const id = ++requestId
  if (value === null) {
    assets.value = []
    addends.value = []
    return
  }

  try {
    const parts = splitOfficialAddends(value)
    const next = await numberblocksAssets.getNumberblockFigure(value, {
      keepNumeral: props.keepNumeral,
    })
    if (id !== requestId) return
    addends.value = parts
    assets.value = next
  } catch {
    if (id === requestId) {
      assets.value = []
      addends.value = []
    }
  }
}

watch(
  () => [props.value, props.keepNumeral] as const,
  ([value]) => {
    void load(value)
  },
  { immediate: true },
)

onUnmounted(() => {
  requestId += 1
})
</script>

<template>
  <div class="nb" :class="{ jump: jumping && value !== null, sized }">
    <img
      v-for="(asset, index) in assets"
      :key="`${addends[index]}-${index}`"
      :src="asset.url"
      :alt="index === 0 ? (alt ?? (value === null ? '' : String(value))) : ''"
      :width="asset.width"
      :height="asset.height"
      :style="
        sized && sizeFor(addends[index], asset)
          ? {
              width: `${sizeFor(addends[index], asset)!.width}px`,
              height: `${sizeFor(addends[index], asset)!.height}px`,
            }
          : undefined
      "
    />
  </div>
</template>

<style scoped>
.nb {
  display: flex;
  flex-direction: column-reverse;
  align-items: center;
  justify-content: flex-start;
  gap: 0.12em;
  width: 100%;
  height: 100%;
  min-height: 0;
  transform-origin: bottom center;
}

.nb img {
  display: block;
  width: auto;
  height: auto;
  flex: 0 0 auto;
  object-fit: contain;
  object-position: bottom center;
  filter: drop-shadow(0 10px 8px rgba(70, 45, 15, 0.22));
}

.nb:not(.sized) img {
  max-width: 100%;
  max-height: 100%;
}

.jump {
  animation: hop 0.42s ease-in-out 2;
}

@keyframes hop {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .jump {
    animation: none;
  }
}
</style>
