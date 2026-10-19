<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import CubeFigurePreview from "../components/CubeFigurePreview.vue"
import {
  costumeToCubes,
  divisorOrientationPairs,
  figureFromRectLayout,
  figureFromRules,
  type CubeFigure,
  type RectLayout,
} from "../lib/cubeFigure"
import {
  planTimesCombine,
  type TimesCombinePlan,
} from "../lib/cubeFigureCombine"
import type { CombinePhase } from "../lib/cubeFigureThree"
import { numberblocksAssets } from "../lib/numberblocksSb3"

const value = ref(6)
const loading = ref(false)
const error = ref("")
const figure = ref<CubeFigure | null>(null)
const useRulesOnly = ref(false)

const ANIM_VALUES = [4, 12, 15] as const
const animFigures = ref<Record<number, CubeFigure | null>>({
  4: null,
  12: null,
  15: null,
})
const animLoading = ref(false)
const animError = ref("")
const previewFour = ref<{ replay: () => void } | null>(null)
const previewFifteen = ref<{ replay: () => void } | null>(null)
const previewFifteenColumns = ref<{ replay: () => void } | null>(null)
const previewTwelve = ref<{ replay: () => void } | null>(null)
const twelveLayout = ref<RectLayout | null>(null)
const twelvePairs = divisorOrientationPairs(12)
const twelveCycleLabel = twelvePairs
  .map((pair) =>
    pair.map((l) => `${l.wide}×${l.tall}`).join(" ↔ "),
  )
  .join(" → ")

const timesK = ref(3)
const timesStep = ref(4)
const timesPlan = ref<TimesCombinePlan | null>(null)
const timesPhase = ref<CombinePhase>("idle")
const timesLoading = ref(false)
const timesError = ref("")
const previewTimes = ref<{ replay: () => void } | null>(null)
const timesLabel = computed(() => {
  const k = timesK.value
  const step = timesStep.value
  return `${k} × ${step} = ${k * step}`
})

const summary = computed(() => {
  const fig = figure.value
  if (!fig) return "No figure"
  return `${fig.cubes.length} cubes · ${fig.wide}×${fig.tall} · ${fig.meta?.source ?? "?"}`
})

function mergeFigures(parts: CubeFigure[], number: number): CubeFigure {
  if (parts.length === 1) return { ...parts[0]!, value: number }
  const cubes: CubeFigure["cubes"] = []
  let xOffset = 0
  let tall = 0
  for (const part of parts) {
    for (const cell of part.cubes) {
      cubes.push({ ...cell, x: cell.x + xOffset })
    }
    tall = Math.max(tall, part.tall)
    xOffset += Math.max(part.wide, 1) + 1
  }
  return {
    value: number,
    unitSize: parts[0]?.unitSize ?? 1,
    wide: Math.max(0, xOffset - 1),
    tall,
    cubes,
    meta: { source: "svg", squareCount: cubes.length },
  }
}

async function loadNumberFigure(n: number, rulesOnly: boolean): Promise<CubeFigure> {
  if (rulesOnly) return figureFromRules(n)
  try {
    const scenes = await numberblocksAssets.getNumberblockScene(n)
    const parts = scenes.map((scene) =>
      costumeToCubes(scene.svg, {
        value: scenes.length === 1 ? n : undefined,
      }),
    )
    const resolved = parts.map((part) =>
      part.cubes.length > 0 ? part : figureFromRules(n),
    )
    return mergeFigures(resolved, n)
  } catch {
    return figureFromRules(n)
  }
}

async function loadFigure() {
  const n = Math.max(0, Math.floor(value.value))
  value.value = n
  loading.value = true
  error.value = ""
  try {
    figure.value = await loadNumberFigure(n, useRulesOnly.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
    figure.value = figureFromRules(n)
  } finally {
    loading.value = false
  }
}

async function loadAnimFigures() {
  animLoading.value = true
  animError.value = ""
  try {
    const next: Record<number, CubeFigure | null> = {
      4: null,
      12: null,
      15: null,
    }
    for (const n of ANIM_VALUES) {
      next[n] = await loadNumberFigure(n, false)
    }
    // Divisor morph: start on Twelve’s usual 3×4 with layout-aware paint.
    next[12] = figureFromRectLayout(12, { wide: 3, tall: 4 })
    animFigures.value = next
    twelveLayout.value = twelvePairs[0]?.[0] ?? null
  } catch (err) {
    animError.value = err instanceof Error ? err.message : String(err)
  } finally {
    animLoading.value = false
  }
}

function onTwelveLayout(layout: RectLayout) {
  twelveLayout.value = layout
}

async function loadTimesCombine() {
  const k = Math.max(1, Math.floor(timesK.value))
  const step = Math.max(1, Math.floor(timesStep.value))
  timesK.value = k
  timesStep.value = step
  timesLoading.value = true
  timesError.value = ""
  try {
    const [stepFig, productFig] = await Promise.all([
      loadNumberFigure(step, false),
      loadNumberFigure(k * step, false),
    ])
    timesPlan.value = planTimesCombine(k, step, stepFig, productFig)
    timesPhase.value = "idle"
  } catch (err) {
    timesError.value = err instanceof Error ? err.message : String(err)
    timesPlan.value = null
  } finally {
    timesLoading.value = false
  }
}

function onCombinePhase(phase: CombinePhase) {
  timesPhase.value = phase
}

function replayAll() {
  previewFour.value?.replay()
  previewFifteen.value?.replay()
  previewFifteenColumns.value?.replay()
  previewTwelve.value?.replay()
  previewTimes.value?.replay()
}

onMounted(() => {
  void loadFigure()
  void loadAnimFigures()
  void loadTimesCombine()
})
watch([value, useRulesOnly], loadFigure)
watch([timesK, timesStep], loadTimesCombine)
</script>

<template>
  <div class="lab">
    <header class="head">
      <p class="eyebrow">/lab/cubes · costume → 3D</p>
      <h1>Cube figure lab</h1>
      <p class="lede">
        Scratch costumes become a portable cube config, then Three.js
        InstancedMesh draws them. Main maths UI stays 2D SVG.
      </p>
    </header>

    <section class="controls">
      <label>
        Number
        <input v-model.number="value" type="number" min="0" max="1000" step="1" />
      </label>
      <div class="chips">
        <button
          v-for="n in [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 100]"
          :key="n"
          type="button"
          :class="{ active: value === n }"
          @click="value = n"
        >
          {{ n }}
        </button>
      </div>
      <label class="check">
        <input v-model="useRulesOnly" type="checkbox" />
        Rules only (skip costume parse)
      </label>
      <p class="meta">
        <span v-if="loading">Loading…</span>
        <span v-else>{{ summary }}</span>
      </p>
      <p v-if="error" class="err">{{ error }}</p>
    </section>

    <section class="stage">
      <CubeFigurePreview :figure="figure" />
    </section>

    <section class="anim">
      <div class="anim-head">
        <div>
          <h2>Assemble from above</h2>
          <p>
            Cubes drop in column order (left → right, bottom → top).
            Stagger overlaps columns; column mode finishes one column
            before the next starts.
          </p>
        </div>
        <button type="button" class="replay" :disabled="animLoading" @click="replayAll">
          Replay all
        </button>
      </div>
      <p v-if="animLoading" class="meta">Loading costumes…</p>
      <p v-if="animError" class="err">{{ animError }}</p>
      <div class="anim-grid">
        <article class="anim-card">
          <header>
            <h3>Four · stagger</h3>
            <button type="button" @click="previewFour?.replay()">Replay</button>
          </header>
          <div class="anim-stage">
            <CubeFigurePreview
              ref="previewFour"
              :figure="animFigures[4]"
              assemble
              assemble-mode="stagger"
            />
          </div>
          <p class="meta">
            {{ animFigures[4]?.cubes.length ?? "—" }} cubes ·
            {{ animFigures[4]?.wide ?? "?" }}×{{ animFigures[4]?.tall ?? "?" }}
          </p>
        </article>
        <article class="anim-card">
          <header>
            <h3>Fifteen · stagger</h3>
            <button type="button" @click="previewFifteen?.replay()">Replay</button>
          </header>
          <div class="anim-stage">
            <CubeFigurePreview
              ref="previewFifteen"
              :figure="animFigures[15]"
              assemble
              assemble-mode="stagger"
            />
          </div>
          <p class="meta">
            {{ animFigures[15]?.cubes.length ?? "—" }} cubes ·
            {{ animFigures[15]?.wide ?? "?" }}×{{ animFigures[15]?.tall ?? "?" }}
          </p>
        </article>
        <article class="anim-card anim-card-wide">
          <header>
            <h3>Fifteen · column</h3>
            <button type="button" @click="previewFifteenColumns?.replay()">
              Replay
            </button>
          </header>
          <div class="anim-stage">
            <CubeFigurePreview
              ref="previewFifteenColumns"
              :figure="animFigures[15]"
              assemble
              assemble-mode="column"
            />
          </div>
          <p class="meta">
            Each column lands fully before the next column drops.
          </p>
        </article>
        <article class="anim-card anim-card-wide">
          <header>
            <h3>Twelve · divisors</h3>
            <button type="button" @click="previewTwelve?.replay()">Replay</button>
          </header>
          <div class="anim-stage">
            <CubeFigurePreview
              ref="previewTwelve"
              :figure="animFigures[12]"
              divisor-morph
              @divisor-layout="onTwelveLayout"
            />
          </div>
          <p class="meta">
            Now
            <strong v-if="twelveLayout">
              {{ twelveLayout.wide }}×{{ twelveLayout.tall }}
            </strong>
            <span v-else>—</span>
            · show product → turn whole array → next product → …
            ({{ twelveCycleLabel }}). Paint is Ten+Two scaled per array.
          </p>
        </article>
      </div>
    </section>

    <section class="anim">
      <div class="anim-head">
        <div>
          <h2>Times combine</h2>
          <p>
            Enter factors as <em>k × step</em> — e.g. 3 and 4 loads the step
            costume in 3D with a Numberling on each copy; they gather, then
            colours and the Numberling become the product (no reshuffle).
          </p>
        </div>
        <button
          type="button"
          class="replay"
          :disabled="timesLoading || !timesPlan"
          @click="previewTimes?.replay()"
        >
          Replay
        </button>
      </div>
      <div class="times-controls">
        <label>
          k (copies)
          <input v-model.number="timesK" type="number" min="1" max="12" step="1" />
        </label>
        <span class="times-op">×</span>
        <label>
          step
          <input v-model.number="timesStep" type="number" min="1" max="20" step="1" />
        </label>
        <div class="chips">
          <button
            v-for="pair in [[2, 3], [3, 2], [3, 4], [4, 3], [2, 5], [5, 2]]"
            :key="pair.join('x')"
            type="button"
            :class="{ active: timesK === pair[0] && timesStep === pair[1] }"
            @click="timesK = pair[0]!; timesStep = pair[1]!"
          >
            {{ pair[0] }}×{{ pair[1] }}
          </button>
        </div>
      </div>
      <p class="meta">
        <span v-if="timesLoading">Loading costumes…</span>
        <span v-else>
          {{ timesLabel }}
          <template v-if="timesPhase !== 'idle'"> · {{ timesPhase }}</template>
        </span>
      </p>
      <p v-if="timesError" class="err">{{ timesError }}</p>
      <div class="anim-stage times-stage">
        <CubeFigurePreview
          ref="previewTimes"
          :times-combine-plan="timesPlan"
          @combine-phase="onCombinePhase"
        />
      </div>
    </section>

    <section v-if="figure" class="json">
      <h2>CubeFigure</h2>
      <pre>{{ JSON.stringify(figure, null, 2) }}</pre>
    </section>
  </div>
</template>

<style scoped>
.lab {
  max-width: 960px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 3rem;
  color: #1a2433;
  font-family: "Segoe UI", system-ui, sans-serif;
}

.head {
  margin-bottom: 1.25rem;
}

.eyebrow {
  margin: 0;
  font-size: 0.8rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #5a6b82;
}

h1 {
  margin: 0.25rem 0 0.5rem;
  font-size: 1.75rem;
}

.lede {
  margin: 0;
  max-width: 40rem;
  color: #3d4d63;
  line-height: 1.45;
}

.controls {
  display: grid;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.controls label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
  font-weight: 600;
}

.controls input[type="number"] {
  width: 8rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid #c5d0de;
  border-radius: 8px;
  font: inherit;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.chips button,
.anim-card header button,
.replay {
  border: 1px solid #c5d0de;
  background: #fff;
  border-radius: 999px;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
  font: inherit;
}

.chips button.active,
.replay {
  background: #1a2433;
  color: #fff;
  border-color: #1a2433;
}

.replay:disabled {
  opacity: 0.5;
  cursor: default;
}

.check {
  flex-direction: row !important;
  align-items: center;
  font-weight: 500 !important;
}

.meta {
  margin: 0;
  color: #5a6b82;
  font-size: 0.9rem;
}

.err {
  margin: 0;
  color: #b42318;
  font-size: 0.9rem;
}

.stage {
  height: min(55vh, 420px);
  margin-bottom: 1.75rem;
  box-shadow: 0 8px 28px rgb(26 36 51 / 10%);
  border-radius: 12px;
}

.anim {
  display: grid;
  gap: 1rem;
  margin-bottom: 1.75rem;
}

.anim-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.anim h2 {
  margin: 0 0 0.35rem;
  font-size: 1.25rem;
}

.anim-head p {
  margin: 0;
  max-width: 36rem;
  color: #3d4d63;
  line-height: 1.45;
}

.anim-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr;
}

@media (min-width: 800px) {
  .anim-grid {
    grid-template-columns: 1fr 1fr;
  }

  .anim-card-wide {
    grid-column: 1 / -1;
  }
}

.anim-card {
  display: grid;
  gap: 0.55rem;
  padding: 0.75rem;
  border: 1px solid #d7e0eb;
  border-radius: 12px;
  background: #fff;
}

.anim-card header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.anim-card h3 {
  margin: 0;
  font-size: 1.05rem;
}

.anim-stage {
  height: 280px;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgb(26 36 51 / 6%);
}

.times-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.75rem 1rem;
}

.times-controls label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
  font-weight: 600;
}

.times-controls input[type="number"] {
  width: 5.5rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid #c5d0de;
  border-radius: 8px;
  font: inherit;
}

.times-op {
  align-self: center;
  padding-bottom: 0.35rem;
  font-size: 1.4rem;
  font-weight: 700;
}

.times-stage {
  height: min(50vh, 360px);
}

.json h2 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
}

.json pre {
  margin: 0;
  padding: 0.85rem 1rem;
  max-height: 280px;
  overflow: auto;
  background: #f4f7fb;
  border-radius: 10px;
  font-size: 0.75rem;
  line-height: 1.4;
}
</style>
