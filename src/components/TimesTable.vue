<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { TABLE_MAX } from "../lib/math"
import { glowFor, paintClass, paintStyle } from "../lib/numberblockColors"
import NumberblockView from "./NumberblockView.vue"
import ProductFigure from "./ProductFigure.vue"

const props = withDefaults(
  defineProps<{
    max?: number
  }>(),
  { max: TABLE_MAX },
)

type Picked = { row: number; col: number }

const hover = ref<{ row: number | null; col: number | null } | null>(null)
const picked = ref<Picked | null>(null)

const factors = computed(() => {
  const size = Math.min(TABLE_MAX, Math.max(1, Math.floor(props.max)))
  return Array.from({ length: size }, (_, index) => index + 1)
})

const axis = computed(() => factors.value.length + 1)
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${axis.value}, minmax(0, 1fr))`,
  gridTemplateRows: `repeat(${axis.value}, minmax(0, 1fr))`,
}))

const open = computed(() => picked.value !== null)

const selectedValue = computed(() => {
  if (!picked.value) return null
  return picked.value.row * picked.value.col
})

const selectedGlow = computed(() => glowFor(selectedValue.value) ?? "#c4a57a")

function product(row: number, col: number) {
  return row * col
}

function headerGlow(n: number) {
  return glowFor(n) ?? "#c4a57a"
}

function isRowHot(row: number) {
  if (hover.value?.row === row) return true
  return picked.value?.row === row
}

function isColHot(col: number) {
  if (hover.value?.col === col) return true
  return picked.value?.col === col
}

function isCellHot(row: number, col: number) {
  return isRowHot(row) || isColHot(col)
}

function isCellOn(row: number, col: number) {
  return hover.value?.row === row && hover.value?.col === col
}

function isCellPicked(row: number, col: number) {
  return picked.value?.row === row && picked.value?.col === col
}

function cellGlow(row: number, col: number) {
  if (isRowHot(row)) return headerGlow(row)
  if (isColHot(col)) return headerGlow(col)
  return headerGlow(product(row, col))
}

function onProductEnter(row: number, col: number) {
  hover.value = { row, col }
}

function onRowHeadEnter(row: number) {
  hover.value = { row, col: null }
}

function onColHeadEnter(col: number) {
  hover.value = { row: null, col }
}

function onLeave() {
  hover.value = null
}

function pickProduct(row: number, col: number) {
  if (isCellPicked(row, col)) {
    picked.value = null
    return
  }
  picked.value = { row, col }
}

function clearPicked() {
  picked.value = null
}

watch(
  () => props.max,
  () => {
    const size = factors.value[factors.value.length - 1] ?? 0
    const current = picked.value
    if (!current) return
    if (current.row > size || current.col > size) picked.value = null
  },
)
</script>

<template>
  <div
    class="board"
    :class="{ open }"
    role="region"
    aria-label="Multiplication table"
    @pointerleave="onLeave"
  >
    <table class="sheet" :style="gridStyle">
      <thead>
        <tr>
          <th class="corner" scope="col">
            <span aria-hidden="true">×</span>
            <span class="sr">Times</span>
          </th>
          <th
            v-for="col in factors"
            :key="`col-${col}`"
            scope="col"
            class="head col-head"
            :class="{ hot: isColHot(col) }"
            :style="{ '--glow': headerGlow(col) }"
            @pointerenter="onColHeadEnter(col)"
          >
            <span :class="paintClass(col)" :style="paintStyle(col)">{{
              col
            }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in factors" :key="`row-${row}`">
          <th
            scope="row"
            class="head row-head"
            :class="{ hot: isRowHot(row) }"
            :style="{ '--glow': headerGlow(row) }"
            @pointerenter="onRowHeadEnter(row)"
          >
            <span :class="paintClass(row)" :style="paintStyle(row)">{{
              row
            }}</span>
          </th>
          <td
            v-for="col in factors"
            :key="`${row}x${col}`"
            class="cell"
            :class="{
              hot: isCellHot(row, col),
              on: isCellOn(row, col) && !isCellPicked(row, col),
              picked: isCellPicked(row, col),
            }"
            :style="{ '--glow': cellGlow(row, col) }"
          >
            <button
              type="button"
              class="hit"
              :aria-label="`${row} times ${col} equals ${product(row, col)}`"
              :aria-pressed="isCellPicked(row, col)"
              @pointerenter="onProductEnter(row, col)"
              @click="pickProduct(row, col)"
            >
              <ProductFigure
                :value="product(row, col)"
                :alt="String(product(row, col))"
                :awake="isCellOn(row, col) && !isCellPicked(row, col)"
              />
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <aside
      class="detail"
      :class="{ show: open }"
      :style="{ '--glow': selectedGlow }"
      :aria-hidden="!open"
    >
      <template v-if="picked && selectedValue !== null">
        <button
          type="button"
          class="close"
          aria-label="Close number"
          @click="clearPicked"
        >
          ×
        </button>
        <p class="fact">
          <span :class="paintClass(picked.row)" :style="paintStyle(picked.row)">{{
            picked.row
          }}</span>
          <span class="op">×</span>
          <span :class="paintClass(picked.col)" :style="paintStyle(picked.col)">{{
            picked.col
          }}</span>
          <span class="op">=</span>
          <span
            :class="paintClass(selectedValue)"
            :style="paintStyle(selectedValue)"
            >{{ selectedValue }}</span
          >
        </p>
        <div class="stage">
          <NumberblockView
            :key="`${picked.row}x${picked.col}`"
            :value="selectedValue"
            :alt="String(selectedValue)"
            keep-numeral
          />
        </div>
      </template>
    </aside>
  </div>
</template>

<style scoped>
.board {
  display: flex;
  align-items: stretch;
  gap: 0;
  flex: 1;
  width: 100%;
  min-width: 0;
  min-height: 0;
  container-type: size;
}

.board.open {
  gap: 0.65rem;
}

.sheet {
  flex: 1 1 auto;
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  gap: 0.12rem;
}

.sheet :where(thead, tbody, tr) {
  display: contents;
}

.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.corner,
.head,
.cell {
  min-width: 0;
  min-height: 0;
  user-select: none;
}

.corner,
.head {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.corner {
  color: #8a8378;
  font-size: clamp(0.75rem, 5.8cqmin, 1.35rem);
}

.head {
  font-size: clamp(0.72rem, 5.6cqmin, 1.35rem);
  border-radius: 0.45rem;
  background: color-mix(in srgb, var(--glow) 16%, rgba(255, 255, 255, 0.42));
}

.head.hot {
  background: color-mix(in srgb, var(--glow) 30%, #fff);
}

.cell {
  position: relative;
  overflow: hidden;
  border-radius: 0.45rem;
  background: rgba(255, 255, 255, 0.28);
}

.cell.hot {
  background: color-mix(in srgb, var(--glow) 12%, rgba(255, 255, 255, 0.4));
}

.cell.on {
  z-index: 2;
  overflow: visible;
}

.cell.picked {
  z-index: 1;
  overflow: hidden;
}

.hit {
  appearance: none;
  display: flex;
  align-items: stretch;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: 0.06rem;
  border: 0;
  border-radius: inherit;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
  box-shadow:
    0 2px 0 rgba(40, 20, 0, 0.08),
    inset 0 0 0 1px rgba(255, 255, 255, 0.28);
  transition:
    transform 0.12s ease,
    box-shadow 0.12s ease,
    filter 0.12s ease;
}

.hit:hover {
  box-shadow:
    0 2px 0 rgba(40, 20, 0, 0.08),
    inset 0 0 0 1px color-mix(in srgb, var(--glow) 35%, rgba(255, 255, 255, 0.4));
}

.cell.picked .hit {
  transform: translateY(2px);
  filter: brightness(0.96);
  box-shadow:
    inset 0 3px 7px rgba(40, 20, 0, 0.22),
    inset 0 0 0 1px rgba(40, 20, 0, 0.08);
}

.detail {
  display: flex;
  flex-direction: column;
  flex: 0 0 0;
  width: 0;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  border-radius: 1.15rem;
  background: color-mix(in srgb, var(--glow) 14%, rgba(255, 255, 255, 0.78));
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--glow) 38%, transparent);
  transition:
    opacity 0.2s ease,
    flex-basis 0.28s ease,
    width 0.28s ease;
}

.detail.show {
  flex: 0 0 25%;
  width: 25%;
  opacity: 1;
  pointer-events: auto;
  overflow: hidden;
}

.close {
  appearance: none;
  align-self: end;
  flex: 0 0 auto;
  margin: 0.3rem 0.45rem 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #7a746c;
  font: inherit;
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
}

.fact {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.15rem 0.25rem;
  margin: 0.05rem 0.5rem 0.15rem;
  font-size: clamp(1.15rem, 2.8vw, 1.85rem);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.op {
  color: #5a554e;
}

.stage {
  flex: 1 1 auto;
  display: flex;
  align-items: stretch;
  justify-content: center;
  min-height: 0;
  padding: 0.1rem 0.55rem 0.65rem;
}

.stage :deep(.nb) {
  width: 100%;
  height: 100%;
}

@media (max-width: 720px) {
  .board.open {
    flex-direction: column;
  }

  .detail.show {
    flex: 0 0 28%;
    width: 100%;
  }

  .sheet {
    gap: 0.08rem;
  }

  .head,
  .cell {
    border-radius: 0.32rem;
  }
}
</style>
