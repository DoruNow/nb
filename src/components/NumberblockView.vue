<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import { displaySize } from "../lib/numberblockScale"
import {
  numberblocksAssets,
  splitOfficialAddends,
  type NumberblockAsset,
} from "../lib/numberblocksSb3"

const IMAGE_GAP = 4

const props = defineProps<{
  value: number | null
  alt?: string
  jumping?: boolean
  speaking?: boolean
  keepNumeral?: boolean
  pxPerUnit?: number
  /** Size the costumes to the largest row that fits the parent box. */
  fill?: boolean
}>()

const root = ref<HTMLElement | null>(null)
const assets = ref<NumberblockAsset[]>([])
const addends = ref<number[]>([])
const frame = ref({ width: 0, height: 0 })
let requestId = 0
let resize: ResizeObserver | undefined

const sized = computed(
  () => !props.fill && props.pxPerUnit !== undefined && props.pxPerUnit > 0,
)

const fitted = computed(() => {
  if (!props.fill) return null
  return fitImageRow(
    assets.value.map((asset) => asset.width / Math.max(asset.height, 1)),
    frame.value.width,
    frame.value.height,
  )
})

function sizeFor(part: number, asset: NumberblockAsset) {
  if (!sized.value || props.pxPerUnit === undefined) return undefined
  const { height } = displaySize(part, props.pxPerUnit)
  const aspect = asset.width / Math.max(asset.height, 1)
  return { width: height * aspect, height }
}

/**
 * Largest equal-height row of pictures that fits a box.
 * Aspects come from the costume pixels, so a large number is not
 * shrunk by a block-count estimate of its width.
 */
function fitImageRow(
  aspects: number[],
  width: number,
  height: number,
): { width: number; height: number }[] | null {
  if (aspects.length === 0 || width <= 0 || height <= 0) return null
  const sum = aspects.reduce((total, aspect) => total + aspect, 0)
  if (sum <= 0) return null
  const gaps = IMAGE_GAP * (aspects.length - 1)
  const available = Math.max(0, width - gaps - 2)
  const rowHeight = Math.min(Math.max(0, height - 2), available / sum)
  if (rowHeight <= 0) return null
  return aspects.map((aspect) => ({
    width: rowHeight * aspect,
    height: rowHeight,
  }))
}

function imageStyle(asset: NumberblockAsset, index: number) {
  if (props.fill) {
    const box = fitted.value?.[index]
    if (!box) return { width: "0px", height: "0px" }
    return { width: `${box.width}px`, height: `${box.height}px` }
  }
  const size = sizeFor(addends.value[index] ?? 0, asset)
  if (!size) return undefined
  return { width: `${size.width}px`, height: `${size.height}px` }
}

function measureFrame() {
  const parent = root.value?.parentElement
  if (!parent) return
  const width = parent.clientWidth
  const height = parent.clientHeight
  if (width === frame.value.width && height === frame.value.height) return
  frame.value = { width, height }
}

function watchFrame() {
  resize?.disconnect()
  resize = undefined
  if (!props.fill) return
  const parent = root.value?.parentElement
  if (!parent) return
  resize = new ResizeObserver(() => measureFrame())
  resize.observe(parent)
  measureFrame()
}

async function load(value: number | null) {
  const id = ++requestId
  if (value === null) {
    assets.value = []
    addends.value = []
    return
  }

  try {
    const next = await numberblocksAssets.getNumberblockFigure(value, {
      keepNumeral: props.keepNumeral,
    })
    if (id !== requestId) return
    addends.value = splitOfficialAddends(value)
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

onMounted(watchFrame)

watch(() => props.fill, watchFrame)

onUnmounted(() => {
  requestId += 1
  resize?.disconnect()
})
</script>

<template>
  <div
    ref="root"
    class="nb"
    :class="{
      jump: jumping && value !== null,
      speak: speaking && value !== null,
      sized,
      fit: fill,
    }"
    :style="fill ? { gap: `${IMAGE_GAP}px` } : undefined"
  >
    <img
      v-for="(asset, index) in assets"
      :key="`${addends[index]}-${index}`"
      :src="asset.url"
      :alt="index === 0 ? (alt ?? (value === null ? '' : String(value))) : ''"
      :width="fill ? undefined : asset.width"
      :height="fill ? undefined : asset.height"
      :style="imageStyle(asset, index)"
    />
  </div>
</template>

<style scoped>
.nb {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  justify-content: center;
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

.nb:not(.sized):not(.fit) img {
  max-width: 100%;
  max-height: 100%;
}

.nb.fit {
  position: absolute;
  inset: 0;
  width: auto;
  height: auto;
  min-width: 0;
  min-height: 0;
}

.nb.fit img {
  max-width: none;
  max-height: none;
}

.jump {
  animation: hop 0.42s ease-in-out 2;
}

.speak {
  animation: wave 0.7s ease-in-out infinite;
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

@keyframes wave {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }
  22% {
    transform: translateY(-8px) rotate(-7deg);
  }
  48% {
    transform: translateY(-3px) rotate(6deg);
  }
  74% {
    transform: translateY(-7px) rotate(-5deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .jump,
  .speak {
    animation: none;
  }
}
</style>
