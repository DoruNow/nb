<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue"
import type { FieldId } from "../model/equation"
import { blockScale } from "../lib/numberblockScale"
import { splitOfficialAddends } from "../lib/numberblocksSb3"
import MathInput from "./MathInput.vue"
import NumberblockView from "./NumberblockView.vue"

const props = defineProps<{
  left: number | null
  right: number | null
  answer: number | null
  operation: string
  activeField: FieldId
  jumping?: boolean
}>()

const emit = defineEmits<{
  focus: [field: FieldId]
}>()

const root = ref<HTMLElement | null>(null)
const figureSample = ref<HTMLElement | null>(null)
const availableHeight = ref(280)
const columnWidth = ref(200)

function partsFor(value: number | null) {
  return value === null ? [] : splitOfficialAddends(value)
}

const pxPerUnit = computed(() =>
  blockScale({
    figures: [
      partsFor(props.left),
      partsFor(props.right),
      partsFor(props.answer),
    ],
    columnWidth: columnWidth.value,
    availableHeight: availableHeight.value,
  }),
)

let resize: ResizeObserver | undefined

onMounted(() => {
  resize = new ResizeObserver(() => {
    const board = root.value
    const figure = figureSample.value
    if (!board || !figure) return
    availableHeight.value = Math.max(80, figure.clientHeight - 8)
    columnWidth.value = Math.max(48, figure.clientWidth)
  })
  if (root.value) resize.observe(root.value)
  if (figureSample.value) resize.observe(figureSample.value)
})

onUnmounted(() => {
  resize?.disconnect()
})
</script>

<template>
  <div ref="root" class="board" role="group" aria-label="Addition equation">
    <div class="column">
      <MathInput
        :value="left"
        :active="activeField === 'left'"
        slot-label="First number"
        @focus="emit('focus', 'left')"
      />
      <div ref="figureSample" class="figure">
        <NumberblockView :value="left" :px-per-unit="pxPerUnit" />
      </div>
    </div>

    <span class="op" aria-hidden="true">{{ operation }}</span>

    <div class="column">
      <MathInput
        :value="right"
        :active="activeField === 'right'"
        slot-label="Second number"
        @focus="emit('focus', 'right')"
      />
      <div class="figure">
        <NumberblockView :value="right" :px-per-unit="pxPerUnit" />
      </div>
    </div>

    <span class="op" aria-hidden="true">=</span>

    <div class="column">
      <MathInput
        :value="answer"
        :active="activeField === 'answer'"
        slot-label="Answer"
        @focus="emit('focus', 'answer')"
      />
      <div class="figure">
        <NumberblockView
          :value="answer"
          :px-per-unit="pxPerUnit"
          :jumping="jumping"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.board {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  align-items: stretch;
  gap: clamp(0.4rem, 1.6vw, 1.1rem);
  width: 100%;
  min-width: 0;
  min-height: 0;
}

.column {
  display: grid;
  grid-template-rows: subgrid;
  grid-row: 1 / -1;
  justify-items: stretch;
  min-width: 0;
  min-height: 0;
}

.figure {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  min-width: 0;
  min-height: 0;
  width: 100%;
}

.op {
  grid-row: 1;
  align-self: center;
  justify-self: center;
  min-width: clamp(1.4rem, 4vw, 3rem);
  font-size: clamp(2.6rem, 6vw, 3.8rem);
  font-weight: 800;
  color: #1a1a1a;
  line-height: 1;
  text-align: center;
  user-select: none;
}
</style>
