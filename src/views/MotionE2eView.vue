<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, ref } from "vue"
import NumberblockView from "../components/NumberblockView.vue"
import MathInput from "../components/MathInput.vue"
import { COUNT_LENGTH, multiple } from "../lib/math"
import {
  TIMES_PASS_MS,
  TIMES_SPEECH_PAUSE_MS,
  createTimesCountSets,
  createTimesMotion,
  type AnimationUiEvent,
  type SpeakingPart,
  type TimesLoopHost,
  type TimesMotion,
} from "../lib/motion"
import { glowFor, paintClass, paintStyle } from "../lib/numberblockColors"
import { numberblocksAssets } from "../lib/numberblocksSb3"
import { cancelSpeech, unlockSpeech } from "../lib/speak"

type Conflict = "queue" | "replace"

/** App defaults — change in UI, then Apply. */
const passMs = ref(TIMES_PASS_MS)
const speechPauseMs = ref(TIMES_SPEECH_PAUSE_MS)
const onConflict = ref<Conflict>("queue")
const speed = ref(2)
const muteAudio = ref(true)

const step = ref(5)
const loopCount = ref(4)
const finaleOnLast = ref(true)
const skipPassWait = ref(true)

const events = ref<Array<{ t: number; text: string }>>([])
const startedAt = ref(Date.now())
const phaseLabel = ref("idle")
const runningScenario = ref(false)
const loopProgress = ref("—")

const passingK = ref<number | null>(null)
const passOn = ref(false)
const speakingIndex = ref<number | null>(null)
const speakingPart = ref<SpeakingPart | null>(null)
const countdownIndex = ref<number | null>(null)
const shakeBox = ref(false)
const holdReleased = ref(false)
const revealedRows = ref(false)
const justLockedIndex = ref<number | null>(null)
const figured = ref<number[]>([])
const draft = ref<number | null>(null)

let motionData: { k?: number; index?: number } = {}
let motion: TimesMotion | null = null
let poll: ReturnType<typeof setInterval> | undefined
let hostMute = true
let hostFinaleLength = COUNT_LENGTH

const status = reactive({
  playing: false,
  activeId: null as string | null,
  queued: [] as string[],
})

const rows = computed(() =>
  Array.from({ length: loopCount.value }, (_, index) => {
    const k = index + 1
    const product = multiple(step.value, k)
    const solved = index < figured.value.length
    return {
      index,
      k,
      product,
      solved,
      answer: figured.value[index] ?? null,
    }
  }),
)

const openIndex = computed(() => {
  if (revealedRows.value) return -1
  if (
    !holdReleased.value &&
    justLockedIndex.value !== null &&
    draft.value !== null
  ) {
    return -1
  }
  if (countdownIndex.value !== null) return -1
  if (figured.value.length >= loopCount.value) return -1
  return figured.value.length
})

const playK = computed(() => {
  if (countdownIndex.value !== null) return countdownIndex.value + 1
  if (openIndex.value >= 0) return openIndex.value + 1
  if (justLockedIndex.value !== null) return justLockedIndex.value + 1
  return Math.max(1, figured.value.length)
})

const stageTone = computed(() => {
  const id = status.activeId
  if (!id) return "idle"
  if (id.includes("pass")) return "intro"
  if (id.includes("Finale") || id.includes("equation")) return "celebration"
  if (id.includes("prompt")) return "prompt"
  return "busy"
})

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

function sleep(ms: number) {
  const scaled = Math.max(0, ms / Math.max(0.1, speed.value))
  return new Promise<void>((resolve) => {
    setTimeout(resolve, scaled)
  })
}

function spoken(index: number, part: SpeakingPart) {
  return speakingIndex.value === index && speakingPart.value === part
}

function clearVisuals() {
  passingK.value = null
  passOn.value = false
  countdownIndex.value = null
  speakingPart.value = null
  speakingIndex.value = null
}

function logLine(text: string) {
  const elapsed = ((Date.now() - startedAt.value) / 1000).toFixed(2)
  events.value = [{ t: Date.now(), text: `${elapsed}s  ${text}` }, ...events.value].slice(
    0,
    100,
  )
}

function logEvent(event: AnimationUiEvent) {
  if (event.type === "setStart") logLine(`start  ${event.setId}`)
  else if (event.type === "setEnd")
    logLine(`end    ${event.setId} (${event.reason})`)
  else {
    const data = event.data ? ` ${JSON.stringify(event.data)}` : ""
    logLine(`phase  ${event.setId}.${event.phase}${data}`)
    phaseLabel.value = `${event.setId}:${event.phase}`
  }
  if (event.type === "setEnd") {
    if (event.reason === "finished") phaseLabel.value = "idle"
    if (event.reason === "cancelled") {
      phaseLabel.value = "cancelled"
      clearVisuals()
      cancelSpeech()
      numberblocksAssets.stopAllSounds()
    }
  }
  refreshStatus()
}

function refreshStatus() {
  if (!motion) {
    status.playing = false
    status.activeId = null
    status.queued = []
    return
  }
  status.playing = motion.system.isPlaying()
  status.activeId = motion.system.activeId()
  status.queued = motion.system.queuedIds()
}

function resetBoard() {
  figured.value = []
  draft.value = null
  justLockedIndex.value = null
  holdReleased.value = false
  revealedRows.value = false
  shakeBox.value = false
  clearVisuals()
  motionData = {}
  loopProgress.value = "—"
}

function buildHost(): TimesLoopHost {
  return {
    getStep: () => step.value,
    getK: () => motionData.k,
    getLockIndex: () => motionData.index,
    isComplete: () => figured.value.length >= loopCount.value,
    isRevealed: () => revealedRows.value,
    getActiveField: () => "product",
    getJustLockedIndex: () => justLockedIndex.value,
    setPassingK: (value) => {
      passingK.value = value
    },
    setPassOn: (value) => {
      passOn.value = value
    },
    setSpeakingIndex: (value) => {
      speakingIndex.value = value
    },
    setSpeakingPart: (value) => {
      speakingPart.value = value
    },
    setCountdownIndex: (value) => {
      countdownIndex.value = value
    },
    setShakeBox: (value) => {
      shakeBox.value = value
    },
    setHoldReleased: (value) => {
      holdReleased.value = value
    },
    setRevealedRows: (value) => {
      revealedRows.value = value
    },
    releaseAnswer: () => {
      holdReleased.value = true
      if (draft.value === multiple(step.value, (justLockedIndex.value ?? 0) + 1)) {
        draft.value = null
      }
      justLockedIndex.value = null
    },
    focusProduct: () => {},
    measure: () => {},
    nextTick,
    prefersReducedMotion,
    get muteAudio() {
      return hostMute
    },
    get finaleLength() {
      return hostFinaleLength
    },
  }
}

function rebuild() {
  motion?.onReset()
  hostMute = muteAudio.value
  hostFinaleLength = loopCount.value
  startedAt.value = Date.now()
  events.value = []
  phaseLabel.value = "idle"
  resetBoard()
  const host = buildHost()
  motion = createTimesMotion({
    passMs: passMs.value,
    speechPauseMs: speechPauseMs.value,
    onConflict: onConflict.value,
    sleep,
    emit: logEvent,
    sets: createTimesCountSets(host, {
      passMs: passMs.value,
      speechPauseMs: speechPauseMs.value,
    }),
  })
  logLine(
    `rebuilt  step=${step.value} loops=${loopCount.value} passMs=${passMs.value} speechPauseMs=${speechPauseMs.value} speed=${speed.value} mute=${muteAudio.value}`,
  )
  refreshStatus()
}

async function run(label: string, action: () => Promise<void>) {
  if (!motion) rebuild()
  unlockSpeech()
  void numberblocksAssets.unlockAudio()
  logLine(`call   ${label}`)
  try {
    await action()
  } catch (error) {
    logLine(`error  ${error instanceof Error ? error.message : String(error)}`)
  }
  refreshStatus()
}

function onReset() {
  if (!motion) rebuild()
  logLine("call   onReset()")
  motion!.onReset()
  resetBoard()
  phaseLabel.value = "idle"
  runningScenario.value = false
  refreshStatus()
}

/**
 * One app loop = intro pass → equation celebration → prompt (or finale on last).
 * Same createTimesCountSets runners as TimesCount.vue.
 */
async function runCelebrationLoops() {
  if (runningScenario.value) return
  rebuild()
  runningScenario.value = true
  const n = Math.max(1, Math.min(COUNT_LENGTH, loopCount.value))
  await run(`celebration ×${n} (app loops)`, async () => {
    for (let index = 0; index < n; index++) {
      const k = index + 1
      const complete = finaleOnLast.value && index === n - 1
      loopProgress.value = `${index + 1} / ${n}`
      logLine(`loop   ${k}×${step.value}=${multiple(step.value, k)} complete=${complete}`)

      motionData = { k }
      if (skipPassWait.value) {
        void motion!.onOpenEquation(k)
        await sleep(Math.min(160, passMs.value / speed.value))
      } else {
        await motion!.onOpenEquation(k)
      }

      const product = multiple(step.value, k)
      figured.value = [...figured.value, product]
      draft.value = product
      justLockedIndex.value = index
      holdReleased.value = false
      motionData = { index }
      await motion!.onLockSuccess({ index, complete })
      await motion!.system.whenIdle()
    }
    loopProgress.value = `done (${n})`
  })
  runningScenario.value = false
}

function clearLog() {
  events.value = []
}

rebuild()
poll = setInterval(refreshStatus, 100)

onUnmounted(() => {
  if (poll) clearInterval(poll)
  motion?.onReset()
  cancelSpeech()
  numberblocksAssets.stopAllSounds()
})
</script>

<template>
  <div class="e2e">
    <header class="top">
      <div>
        <p class="eyebrow">/e2e · isolated times motion</p>
        <h1>Celebration loop harness</h1>
        <p class="sub">
          Runs the <strong>same animation loops</strong> as Times Count
          (<code>createTimesCountSets</code>), without the full game. Configure timing,
          then run a multi-equation celebration (default <strong>4 loops</strong>).
        </p>
      </div>
      <RouterLink class="home" to="/">← app</RouterLink>
    </header>

    <section class="hero-run panel">
      <div>
        <h2>Primary test</h2>
        <p class="explain">
          One <em>loop</em> is what the app does after each correct answer opens the next
          equation:
          <code>times.pass</code> → <code>times.equationSuccess</code> →
          <code>times.promptNext</code>. On the last loop (if enabled) it chains
          <code>times.setFinale</code> instead of the prompt — counting products like the
          real set complete.
        </p>
      </div>
      <div class="hero-controls">
        <label>
          <span class="field-name">Loops</span>
          <span class="field-help">How many equations to celebrate in a row (app max {{ COUNT_LENGTH }}).</span>
          <input v-model.number="loopCount" type="number" min="1" :max="COUNT_LENGTH" />
        </label>
        <label>
          <span class="field-name">Times table step</span>
          <span class="field-help">The fixed factor (e.g. 5 → 1×5, 2×5, …).</span>
          <input v-model.number="step" type="number" min="1" max="12" />
        </label>
        <label class="check">
          <input v-model="finaleOnLast" type="checkbox" />
          <span>
            <span class="field-name">Finale on last loop</span>
            <span class="field-help">Last lock plays setFinale (countdown + reveal) instead of promptNext.</span>
          </span>
        </label>
        <label class="check">
          <input v-model="skipPassWait" type="checkbox" />
          <span>
            <span class="field-name">Interrupt pass (realistic)</span>
            <span class="field-help">Like typing the answer during the fly-across: lock replaces the pass mid-flight.</span>
          </span>
        </label>
        <p class="progress">Progress: {{ loopProgress }}</p>
        <div class="row">
          <button
            type="button"
            class="primary big"
            :disabled="runningScenario"
            @click="runCelebrationLoops"
          >
            Run {{ loopCount }} celebration loops
          </button>
          <button type="button" class="danger" @click="onReset">Stop / reset</button>
        </div>
      </div>
    </section>

    <section class="stage" :data-tone="stageTone">
      <div class="stage-main">
        <p class="stage-label">Mini Times Count stage (shared loops)</p>
        <div v-if="!revealedRows" class="tabs">
          <div
            v-for="row in rows"
            :key="row.k"
            class="tab"
            :class="{
              current: row.index === openIndex,
              solved: row.solved,
              speaking: speakingIndex === row.index,
            }"
          >
            <span
              class="num"
              :class="[paintClass(row.k), { spoken: spoken(row.index, 'k') }]"
              :style="paintStyle(row.k)"
              >{{ row.k }}</span
            >
            <span class="op" :class="{ spoken: spoken(row.index, 'times') }">×</span>
            <span
              class="num"
              :class="[paintClass(step), { spoken: spoken(row.index, 'step') }]"
              :style="paintStyle(step)"
              >{{ step }}</span
            >
            <template v-if="row.index === openIndex || row.solved">
              <span class="op" :class="{ spoken: spoken(row.index, 'equals') }">=</span>
              <MathInput
                v-if="row.index === openIndex"
                :value="draft"
                :active="true"
                :shake="shakeBox"
                :slot-label="`${row.k} times ${step}`"
              />
              <span
                v-else-if="row.answer !== null"
                class="settled"
                :class="paintClass(row.answer)"
                :style="{
                  ...paintStyle(row.answer),
                  '--glow': glowFor(row.answer) ?? '#c4a57a',
                }"
                >{{ row.answer }}</span
              >
            </template>
          </div>
        </div>
        <div v-else class="revealed">
          Revealed list after finale ({{ figured.length }} facts for step {{ step }}).
        </div>
        <div class="pass-area">
          <div v-if="passingK !== null" class="pass-fig" :class="{ go: passOn }">
            <NumberblockView :value="passingK" :px-per-unit="18" jumping />
          </div>
          <p v-else class="pass-idle">
            playK={{ playK }} · phase {{ phaseLabel }}
          </p>
        </div>
      </div>
      <div class="stage-side">
        <p><span>playing</span> {{ status.playing ? "yes" : "no" }}</p>
        <p><span>active</span> {{ status.activeId ?? "—" }}</p>
        <p><span>queued</span> {{ status.queued.length ? status.queued.join(" → ") : "—" }}</p>
      </div>
    </section>

    <div class="grid">
      <section class="panel">
        <h2>Timing &amp; scheduler</h2>
        <label>
          <span class="field-name">passMs</span>
          <span class="field-help">
            How long the multiplier flies across the stage (<code>times.pass</code>).
            App default {{ TIMES_PASS_MS }}.
          </span>
          <input v-model.number="passMs" type="number" min="0" step="50" />
        </label>
        <label>
          <span class="field-name">speechPauseMs</span>
          <span class="field-help">
            Gap between spoken pieces in a fact (“3 … times … 5 …”). App default
            {{ TIMES_SPEECH_PAUSE_MS }}.
          </span>
          <input v-model.number="speechPauseMs" type="number" min="0" step="50" />
        </label>
        <label>
          <span class="field-name">speed (×)</span>
          <span class="field-help">
            Scales all sleeps in this harness only (faster e2e without changing app code).
          </span>
          <input v-model.number="speed" type="number" min="0.25" max="8" step="0.25" />
        </label>
        <label>
          <span class="field-name">onConflict</span>
          <span class="field-help">
            <code>queue</code> = new play waits. <code>replace</code> = cancel current
            (the app’s lock path uses replace via <code>onLockSuccess</code>).
          </span>
          <select v-model="onConflict">
            <option value="queue">queue</option>
            <option value="replace">replace</option>
          </select>
        </label>
        <label class="check">
          <input v-model="muteAudio" type="checkbox" />
          <span>
            <span class="field-name">Mute audio</span>
            <span class="field-help">
              Keep the same loop structure, but skip TTS/SFX (short stub pauses). Recommended for rapid e2e.
            </span>
          </span>
        </label>
        <button type="button" class="primary" @click="rebuild">Apply config &amp; rebuild</button>
        <p class="hint">Apply resets the board and recreates the motion system with the values above.</p>
      </section>

      <section class="panel log-panel">
        <div class="log-head">
          <h2>Event log</h2>
          <button type="button" class="ghost" @click="clearLog">clear</button>
        </div>
        <p class="explain tight">
          Proof of order: you should never see two <code>setStart</code> lines overlapping
          without an <code>end</code> between them (unless the first was
          <code>cancelled</code>).
        </p>
        <ol class="log">
          <li v-for="entry in events" :key="entry.t + entry.text">{{ entry.text }}</li>
          <li v-if="!events.length" class="empty">No events yet.</li>
        </ol>
      </section>
    </div>
  </div>
</template>

<style scoped>
.e2e {
  --panel: #fff8ea;
  --line: rgba(40, 20, 0, 0.12);
  --accent: #c45c26;
  --ok: #2f6f4e;
  min-height: 100%;
  padding: 1.25rem clamp(1rem, 3vw, 2rem) 2.5rem;
  background:
    radial-gradient(circle at 10% 0%, #ffe7b8 0%, transparent 42%),
    radial-gradient(circle at 90% 10%, #f0d2a8 0%, transparent 38%),
    var(--wall);
  color: var(--ink);
}

.top {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: start;
  margin-bottom: 1.25rem;
}

.eyebrow {
  margin: 0;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.65;
}

h1 {
  margin: 0.15rem 0 0.35rem;
  font-size: clamp(1.6rem, 3vw, 2.2rem);
  line-height: 1.1;
}

.sub {
  margin: 0;
  max-width: 44rem;
  opacity: 0.85;
}

.home {
  color: inherit;
  text-decoration: none;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0.45rem 0.9rem;
  background: rgba(255, 255, 255, 0.55);
}

.hero-run {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 1.25rem;
  margin-bottom: 1.25rem;
}

.explain {
  margin: 0.35rem 0 0;
  font-size: 0.92rem;
  line-height: 1.45;
  opacity: 0.88;
}

.explain.tight {
  margin: 0 0 0.5rem;
  font-size: 0.85rem;
}

.hero-controls {
  display: grid;
  gap: 0.65rem;
  align-content: start;
}

.field-name {
  display: block;
  font-weight: 800;
  font-size: 0.9rem;
}

.field-help {
  display: block;
  margin: 0.15rem 0 0.35rem;
  font-size: 0.78rem;
  line-height: 1.35;
  font-weight: 500;
  opacity: 0.7;
}

.progress {
  margin: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.85rem;
}

.stage {
  display: grid;
  grid-template-columns: 1.7fr 0.8fr;
  gap: 1rem;
  margin-bottom: 1.25rem;
  padding: 1.1rem 1.25rem;
  border-radius: 1rem;
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.55);
}

.stage[data-tone="intro"] {
  background: color-mix(in srgb, #7eb8ff 22%, white);
}

.stage[data-tone="celebration"] {
  background: color-mix(in srgb, #ffd27a 28%, white);
}

.stage[data-tone="prompt"] {
  background: color-mix(in srgb, #9ed9b0 24%, white);
}

.stage-label {
  margin: 0 0 0.6rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.6;
}

.tabs {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tab {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem 0.4rem;
  padding: 0.35rem 0.5rem;
  border-radius: 0.65rem;
  opacity: 0.55;
}

.tab.current,
.tab.speaking,
.tab.solved {
  opacity: 1;
}

.tab.speaking {
  background: rgba(255, 255, 255, 0.65);
}

.num {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.num.spoken,
.op.spoken {
  transform: scale(1.12);
  display: inline-block;
}

.op {
  font-weight: 700;
  opacity: 0.75;
}

.settled {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.2em;
  padding: 0.15em 0.35em;
  border-radius: 0.45em;
  background: #fff;
  font-weight: 800;
  box-shadow:
    0 2px 0 rgba(40, 20, 0, 0.08),
    0 0 10px color-mix(in srgb, var(--glow) 55%, transparent);
}

.pass-area {
  position: relative;
  margin-top: 0.75rem;
  min-height: 5.5rem;
  border-radius: 0.75rem;
  border: 1px dashed var(--line);
  overflow: hidden;
  background: rgba(255, 255, 255, 0.35);
}

.pass-idle {
  margin: 0;
  padding: 1.4rem 1rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.8rem;
  opacity: 0.65;
}

.pass-fig {
  position: absolute;
  top: 50%;
  left: 0;
  transform: translate(-120%, -50%);
}

.pass-fig.go {
  animation: cross 1.2s cubic-bezier(0.45, 0, 0.2, 1) forwards;
}

@keyframes cross {
  0% {
    transform: translate(-115%, -50%) scale(0.9);
  }
  100% {
    transform: translate(125%, -50%) scale(0.92);
  }
}

.revealed {
  padding: 0.75rem;
  font-weight: 700;
}

.stage-side {
  display: grid;
  align-content: center;
  gap: 0.45rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.85rem;
}

.stage-side span {
  display: inline-block;
  min-width: 4.5rem;
  opacity: 0.55;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 1rem;
}

.panel {
  display: grid;
  gap: 0.65rem;
  align-content: start;
  padding: 1rem 1.1rem;
  border-radius: 1rem;
  border: 1px solid var(--line);
  background: var(--panel);
}

h2 {
  margin: 0;
  font-size: 1.05rem;
}

label {
  display: grid;
  gap: 0;
  font-size: 0.85rem;
}

label.check {
  grid-template-columns: auto 1fr;
  gap: 0.55rem;
  align-items: start;
}

input[type="number"],
select {
  width: 100%;
  padding: 0.45rem 0.55rem;
  border: 1px solid var(--line);
  border-radius: 0.55rem;
  background: #fff;
  font: inherit;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

button {
  appearance: none;
  border: 1px solid var(--line);
  border-radius: 0.55rem;
  padding: 0.5rem 0.75rem;
  background: #fff;
  color: inherit;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button.primary {
  background: var(--accent);
  border-color: transparent;
  color: #fff;
}

button.big {
  font-size: 1.05rem;
  padding: 0.7rem 1rem;
}

button.danger {
  border-color: color-mix(in srgb, #b33 40%, var(--line));
  color: #8a1f1f;
}

button.ghost {
  background: transparent;
  font-weight: 600;
  opacity: 0.8;
}

.hint {
  margin: 0;
  font-size: 0.8rem;
  opacity: 0.65;
}

.log-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.log {
  margin: 0;
  padding: 0.75rem 0.85rem;
  list-style: none;
  max-height: 22rem;
  overflow: auto;
  border-radius: 0.7rem;
  background: #1d1812;
  color: #f4e7cf;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.78rem;
  line-height: 1.45;
}

.log li {
  white-space: pre-wrap;
}

.log .empty {
  opacity: 0.55;
}

code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9em;
}

@media (max-width: 900px) {
  .hero-run,
  .stage,
  .grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pass-fig.go {
    animation: none;
  }
}
</style>
