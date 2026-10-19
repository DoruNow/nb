<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from "vue"
import type { AssembleMode, CubeFigure, RectLayout } from "../lib/cubeFigure"
import type { TimesCombinePlan } from "../lib/cubeFigureCombine"
import {
  mountCubeFigureThree,
  type CombinePhase,
  type CubeFigureThreeHandle,
  type CubeFigureThreeOptions,
} from "../lib/cubeFigureThree"

const props = withDefaults(
  defineProps<{
    figure?: CubeFigure | null
    assemble?: boolean
    assembleMode?: AssembleMode
    divisorMorph?: boolean
    timesCombinePlan?: TimesCombinePlan | null
    autoSpin?: boolean
    /** Floating digit(s) from Digits//Multiplier Ones (default true). */
    showNumberling?: boolean
  }>(),
  {
    figure: null,
    assemble: false,
    assembleMode: "stagger",
    divisorMorph: false,
    timesCombinePlan: null,
    autoSpin: true,
    showNumberling: true,
  },
)

const emit = defineEmits<{
  divisorLayout: [layout: RectLayout, index: number]
  combinePhase: [phase: CombinePhase]
}>()

const host = ref<HTMLElement | null>(null)
let handle: CubeFigureThreeHandle | null = null
let observer: ResizeObserver | null = null

function options(): CubeFigureThreeOptions {
  return {
    assemble: props.assemble,
    assembleMode: props.assembleMode,
    divisorMorph: props.divisorMorph,
    autoSpin: props.autoSpin,
    showNumberling: props.showNumberling,
    onDivisorLayout: (layout, index) => emit("divisorLayout", layout, index),
    onCombinePhase: (phase) => emit("combinePhase", phase),
  }
}

function applyContent() {
  if (!handle) return
  if (props.timesCombinePlan) handle.setTimesCombine(props.timesCombinePlan)
  else handle.setFigure(props.figure)
}

function remount() {
  if (!host.value) return
  handle?.dispose()
  handle = mountCubeFigureThree(host.value, null, options())
  applyContent()
}

onMounted(() => {
  if (!host.value) return
  handle = mountCubeFigureThree(host.value, null, options())
  applyContent()
  observer = new ResizeObserver(() => handle?.resize())
  observer.observe(host.value)
})

watch(
  () => props.figure,
  () => {
    if (!props.timesCombinePlan) applyContent()
  },
)

watch(
  () => props.timesCombinePlan,
  () => {
    applyContent()
  },
)

watch(
  () =>
    [
      props.assemble,
      props.assembleMode,
      props.divisorMorph,
      props.autoSpin,
      props.showNumberling,
    ] as const,
  remount,
)

function replay() {
  handle?.playAssemble()
}

defineExpose({ replay })

onUnmounted(() => {
  observer?.disconnect()
  observer = null
  handle?.dispose()
  handle = null
})
</script>

<template>
  <div ref="host" class="cube-preview" />
</template>

<style scoped>
.cube-preview {
  width: 100%;
  height: 100%;
  min-height: 280px;
  border-radius: 12px;
  overflow: hidden;
  background: #e8eef5;
}

.cube-preview :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
