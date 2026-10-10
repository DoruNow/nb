<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue"
import {
  BLOCK_SEAM_THICKNESS,
  CHARACTER_NUMBERBLOCK_VALUES,
  FOF_NAMED_NUMBERBLOCK_VALUES,
  FOF_NUMBERBLOCK_VALUES,
  MAX_NUMBERBLOCK_VALUE,
  NUMBER_GROUPS,
  OFFICIAL_NUMBERBLOCK_VALUES,
  TIMES_TABLES_TARGET,
  costumeNameCandidates,
  decorateCostumeLife,
  growingTimesTable,
  normalizeScratchSvg,
  numberblocksAssets,
  parseCostumeNumber,
  placeValueParts,
  separateBlockSeams,
  splitOfficialAddends,
  stripCostumeNumeral,
  timesTableCharacter,
  type NumberblockAsset,
  type NumberblockScene,
  type NumberSvgPart,
  type ScratchCostume,
  type ScratchResource,
  type ScratchTarget,
  type SvgAssetRef,
  type TimesTableCharacterRef,
  type TimesTableFrame,
  type TimesTablePose,
} from "../../lib/numberblocksSb3"

const targetName = defineModel<string>("targetName", { required: true })
const costumeName = defineModel<string>("costumeName", { required: true })
const soundName = defineModel<string>("soundName", { required: true })
const keepNumeral = defineModel<boolean>("keepNumeral", { required: true })
const pose = defineModel<TimesTablePose>("pose", { required: true })

const props = defineProps<{
  soundNames: string[]
  active: boolean
}>()

const examples = [0, 7, 10, 42, 77, 100, 144, 180, 190, 200, 1000]
const numberText = ref("7")
const prefixText = ref("")
const costumeTitle = ref("One Hundred and Twenty-One")
const includeScripts = ref(false)
const normalizeOn = ref(true)
const stripOn = ref(false)
const seamsOn = ref(false)
const decorateOn = ref(false)
const showLimb = ref(true)
const showFace = ref(true)
const showNumeral = ref(true)
const playing = ref("")
const audioNote = ref("")
const soundChecked = ref(false)
const indexTarget = ref("")

type Slot<T> = {
  pending: boolean
  error: string
  value: T | null
}

function empty<T>(): Slot<T> {
  return { pending: false, error: "", value: null }
}

const numberUrl = ref<Slot<string>>(empty())
const blockUrl = ref<Slot<string>>(empty())
const blockAsset = ref<Slot<NumberblockAsset>>(empty())
const figure = ref<Slot<NumberblockAsset[]>>(empty())
const scene = ref<Slot<NumberblockScene[]>>(empty())
const parts = ref<Slot<NumberSvgPart[]>>(empty())
const growingUrl = ref<Slot<string>>(empty())
const characterUrl = ref<Slot<string>>(empty())
const namePlayed = ref<Slot<boolean>>(empty())
const costumeHit = ref<Slot<boolean>>(empty())
const costumeMeta = ref<Slot<ScratchCostume>>(empty())
const assetRef = ref<Slot<SvgAssetRef>>(empty())
const costumeUrl = ref<Slot<string>>(empty())
const svgUrl = ref<Slot<string>>(empty())
const svgText = ref<Slot<string>>(empty())
const sourceSlot = ref<Slot<string>>(empty())
const targetNames = ref<Slot<string[]>>(empty())
const numberblockTargets = ref<Slot<string[]>>(empty())
const targetJson = ref<Slot<string>>(empty())
const costumeList = ref<Slot<ScratchCostume[]>>(empty())
const soundUrl = ref<Slot<string | null>>(empty())
const resourceSummary = ref<Slot<string>>(empty())
const svgIndex = shallowRef<Record<string, Record<string, SvgAssetRef>> | null>(
  null,
)
const indexError = ref("")
const indexPending = ref(false)

let numberGen = 0
let costumeGen = 0
let targetGen = 0
let numberTimer = 0
let costumeTimer = 0
let targetTimer = 0

function show(value: unknown): string {
  const text = JSON.stringify(
    value,
    (_key, item) => (typeof item === "bigint" ? item.toString() : item),
    2,
  )
  return text ?? "undefined"
}

function safeInteger(text: string): number | null {
  if (!/^\d+$/.test(text)) return null
  const value = Number(text)
  return Number.isSafeInteger(value) ? value : null
}

const safeNumber = computed(() => safeInteger(numberText.value.trim()))

const candidates = computed(() =>
  safeNumber.value === null ? null : costumeNameCandidates(safeNumber.value),
)
const places = computed(() =>
  safeNumber.value === null ? null : placeValueParts(safeNumber.value),
)
const addends = computed(() =>
  safeNumber.value === null ? null : splitOfficialAddends(safeNumber.value),
)
const growingFrame = computed<TimesTableFrame | null>(() =>
  safeNumber.value === null ? null : growingTimesTable(safeNumber.value),
)
const characterRef = computed<TimesTableCharacterRef | null>(() =>
  safeNumber.value === null
    ? null
    : timesTableCharacter(safeNumber.value, pose.value),
)
const parsedTitle = computed(() => parseCostumeNumber(costumeTitle.value))

const indexNames = computed(() =>
  svgIndex.value ? Object.keys(svgIndex.value).sort() : [],
)
const indexCostumes = computed(() => {
  const index = svgIndex.value
  if (!index || !indexTarget.value) return []
  return Object.keys(index[indexTarget.value] ?? {}).sort()
})

const pipeline = computed(() => {
  const source = sourceSlot.value.value
  if (!source) return null
  try {
    let svg = source
    if (normalizeOn.value) svg = normalizeScratchSvg(svg)
    if (stripOn.value) svg = stripCostumeNumeral(svg)
    if (seamsOn.value) svg = separateBlockSeams(svg)
    if (decorateOn.value) {
      const decorated = decorateCostumeLife(svg)
      return { svg: decorated.svg, scene: decorated, error: "" }
    }
    return { svg, scene: null as NumberblockScene | null, error: "" }
  } catch (error) {
    return {
      svg: "",
      scene: null as NumberblockScene | null,
      error: error instanceof Error ? error.message : String(error),
    }
  }
})

function clearSlot<T>(slot: { value: Slot<T> }) {
  slot.value = empty()
}

async function put<T>(
  id: number,
  current: () => number,
  slot: { value: Slot<T> },
  task: () => Promise<T>,
) {
  slot.value = { pending: true, error: "", value: null }
  try {
    const value = await task()
    if (current() !== id) return
    slot.value = { pending: false, error: "", value }
  } catch (error) {
    if (current() !== id) return
    slot.value = {
      pending: false,
      error: error instanceof Error ? error.message : String(error),
      value: null,
    }
  }
}

function requireSafe(text: string): number {
  const value = safeInteger(text)
  if (value === null) {
    throw new Error(
      text
        ? "Enter a safe non-negative integer."
        : "Enter a number.",
    )
  }
  return value
}

function targetReport(target: ScratchTarget, scripts: boolean): string {
  const {
    blocks,
    comments,
    variables,
    lists,
    broadcasts,
    costumes,
    sounds,
    ...rest
  } = target
  return show({
    ...rest,
    blockCount: Object.keys(blocks ?? {}).length,
    commentCount: Object.keys(comments ?? {}).length,
    variableNames: Object.keys(variables ?? {}),
    listNames: Object.keys(lists ?? {}),
    broadcastNames: Object.values(broadcasts ?? {}),
    costumes: costumes.map((costume) => costume.name),
    sounds: (sounds ?? []).map((sound) => sound.name),
    ...(scripts ? { blocks, comments, variables, lists, broadcasts } : {}),
  })
}

async function refreshNumber() {
  const id = ++numberGen
  const text = numberText.value.trim()
  const options = { keepNumeral: keepNumeral.value }
  const poseName = pose.value
  if (!text) {
    clearSlot(numberUrl)
    clearSlot(blockUrl)
    clearSlot(blockAsset)
    clearSlot(figure)
    clearSlot(scene)
    clearSlot(parts)
    clearSlot(growingUrl)
    clearSlot(characterUrl)
    return
  }
  void put(id, () => numberGen, numberUrl, () =>
    numberblocksAssets.getNumberSvgUrl(requireSafe(text)),
  )
  void put(id, () => numberGen, blockUrl, () =>
    numberblocksAssets.getNumberblockUrl(requireSafe(text), options),
  )
  void put(id, () => numberGen, blockAsset, () =>
    numberblocksAssets.getNumberblockAsset(requireSafe(text), options),
  )
  void put(id, () => numberGen, figure, () =>
    numberblocksAssets.getNumberblockFigure(requireSafe(text), options),
  )
  void put(id, () => numberGen, scene, () =>
    numberblocksAssets.getNumberblockScene(requireSafe(text)),
  )
  void put(id, () => numberGen, parts, () =>
    numberblocksAssets.getNumberParts(text),
  )
  void put(id, () => numberGen, growingUrl, () =>
    numberblocksAssets.getGrowingTimesTableUrl(requireSafe(text)),
  )
  void put(id, () => numberGen, characterUrl, () =>
    numberblocksAssets.getTimesTableCharacterUrl(requireSafe(text), poseName),
  )
}

async function refreshCostume() {
  const id = ++costumeGen
  const target = targetName.value.trim()
  const costume = costumeName.value.trim()
  const options = { keepNumeral: keepNumeral.value }
  if (!target || !costume) {
    clearSlot(costumeHit)
    clearSlot(costumeMeta)
    clearSlot(assetRef)
    clearSlot(costumeUrl)
    clearSlot(svgUrl)
    clearSlot(svgText)
    clearSlot(sourceSlot)
    return
  }
  void put(id, () => costumeGen, costumeHit, () =>
    numberblocksAssets.hasCostume(target, costume),
  )
  void put(id, () => costumeGen, costumeMeta, () =>
    numberblocksAssets.getCostume(target, costume),
  )
  void put(id, () => costumeGen, assetRef, () =>
    numberblocksAssets.getAssetRef(target, costume),
  )
  void put(id, () => costumeGen, costumeUrl, () =>
    numberblocksAssets.getCostumeUrl(target, costume, options),
  )
  void put(id, () => costumeGen, svgUrl, () =>
    numberblocksAssets.getSvgUrl(target, costume, options),
  )
  void put(id, () => costumeGen, svgText, () =>
    numberblocksAssets.getSvgText(target, costume, options),
  )
  void put(id, () => costumeGen, sourceSlot, () =>
    numberblocksAssets.getCostumeSource(target, costume),
  )
}

async function refreshTargets() {
  const id = ++targetGen
  const prefix = prefixText.value.trim()
  const name = targetName.value.trim()
  void put(id, () => targetGen, targetNames, () =>
    numberblocksAssets.listTargets(prefix || undefined),
  )
  void put(id, () => targetGen, numberblockTargets, () =>
    numberblocksAssets.listNumberblockTargets(),
  )
  if (!name) {
    clearSlot(targetJson)
    clearSlot(costumeList)
    return
  }
  void put(id, () => targetGen, targetJson, async () => {
    const target = await numberblocksAssets.getTarget(name)
    return targetReport(target, includeScripts.value)
  })
  void put(id, () => targetGen, costumeList, () =>
    numberblocksAssets.listCostumes(name),
  )
}

function scheduleNumber() {
  if (!props.active) return
  window.clearTimeout(numberTimer)
  numberTimer = window.setTimeout(() => {
    void refreshNumber()
  }, 180)
}

function scheduleCostume() {
  if (!props.active) return
  window.clearTimeout(costumeTimer)
  costumeTimer = window.setTimeout(() => {
    void refreshCostume()
  }, 180)
}

function scheduleTargets() {
  if (!props.active) return
  window.clearTimeout(targetTimer)
  targetTimer = window.setTimeout(() => {
    void refreshTargets()
  }, 180)
}

function scheduleAll() {
  scheduleNumber()
  scheduleCostume()
  scheduleTargets()
}

watch([numberText, keepNumeral, pose], scheduleNumber)
watch([targetName, costumeName, keepNumeral], scheduleCostume)
watch([prefixText, targetName, includeScripts], scheduleTargets)
watch(() => props.active, (active) => {
  if (active) scheduleAll()
}, { immediate: true })

watch(soundName, () => {
  soundUrl.value = empty()
  soundChecked.value = false
})

onBeforeUnmount(() => {
  window.clearTimeout(numberTimer)
  window.clearTimeout(costumeTimer)
  window.clearTimeout(targetTimer)
})

function usePart(part: NumberSvgPart) {
  targetName.value = part.target
  costumeName.value = part.costume
}

async function onPlayNumber() {
  const number = safeNumber.value
  if (number === null) {
    namePlayed.value = {
      pending: false,
      error: "Enter a safe non-negative integer.",
      value: null,
    }
    return
  }
  playing.value = "number"
  namePlayed.value = { pending: true, error: "", value: null }
  try {
    await numberblocksAssets.unlockAudio()
    const played = await numberblocksAssets.playNumberName(number)
    namePlayed.value = { pending: false, error: "", value: played }
  } catch (error) {
    namePlayed.value = {
      pending: false,
      error: error instanceof Error ? error.message : String(error),
      value: null,
    }
  } finally {
    playing.value = ""
  }
}

async function onPlaySound() {
  const name = soundName.value.trim()
  if (!name) return
  playing.value = "sound"
  soundChecked.value = true
  try {
    await numberblocksAssets.unlockAudio()
    soundUrl.value = {
      pending: false,
      error: "",
      value: await numberblocksAssets.getSoundUrl(name),
    }
    await numberblocksAssets.playSound(name)
  } catch (error) {
    soundUrl.value = {
      pending: false,
      error: error instanceof Error ? error.message : String(error),
      value: null,
    }
  } finally {
    playing.value = ""
  }
}

async function onLoadSound() {
  const name = soundName.value.trim()
  if (!name) return
  soundChecked.value = true
  soundUrl.value = { pending: true, error: "", value: null }
  try {
    soundUrl.value = {
      pending: false,
      error: "",
      value: await numberblocksAssets.getSoundUrl(name),
    }
  } catch (error) {
    soundUrl.value = {
      pending: false,
      error: error instanceof Error ? error.message : String(error),
      value: null,
    }
  }
}

async function onUnlock() {
  await numberblocksAssets.unlockAudio()
  audioNote.value = "Audio context is running."
}

function onStop() {
  numberblocksAssets.stopAllSounds()
  playing.value = ""
  audioNote.value = "Stopped."
}

async function onLoadProject() {
  await numberblocksAssets.load()
  audioNote.value = "load() finished. The project stays cached after the first fetch."
  scheduleTargets()
}

async function onResource() {
  resourceSummary.value = { pending: true, error: "", value: null }
  try {
    const resource: ScratchResource = await numberblocksAssets.resource()
    resourceSummary.value = {
      pending: false,
      error: "",
      value: show({
        meta: resource.meta,
        extensions: resource.extensions,
        monitors: resource.monitors.length,
        targetCount: resource.targetCount,
        costumeCount: resource.costumeCount,
        soundCount: resource.soundCount,
        roots: resource.tree.map((node) =>
          node.kind === "folder" ? `${node.name}/` : node.name,
        ),
      }),
    }
  } catch (error) {
    resourceSummary.value = {
      pending: false,
      error: error instanceof Error ? error.message : String(error),
      value: null,
    }
  }
}

async function onIndex() {
  indexPending.value = true
  indexError.value = ""
  try {
    const index = await numberblocksAssets.buildSvgIndex()
    svgIndex.value = index
    if (!indexTarget.value || !index[indexTarget.value]) {
      indexTarget.value = Object.keys(index).sort()[0] ?? ""
    }
  } catch (error) {
    indexError.value = error instanceof Error ? error.message : String(error)
  } finally {
    indexPending.value = false
  }
}

function onDispose() {
  if (
    !window.confirm(
      "Release every cached image URL? Pictures already on screen go blank until the lookups run again.",
    )
  ) {
    return
  }
  numberblocksAssets.dispose()
  scheduleNumber()
  scheduleCostume()
  audioNote.value = "Blob URLs released."
}

function sceneMeta(scenes: NumberblockScene[]) {
  return scenes.map(({ svg, ...rest }) => ({
    ...rest,
    svgChars: svg.length,
  }))
}
</script>

<template>
  <div class="lab">
    <form class="controls" @submit.prevent>
      <label class="field grow">
        <span>Number</span>
        <input
          v-model="numberText"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          spellcheck="false"
          aria-label="Number to map"
        />
      </label>
      <label class="check">
        <input v-model="keepNumeral" type="checkbox" />
        Keep numeral
      </label>
      <div class="pose" role="group" aria-label="Times Table pose">
        <button
          type="button"
          :aria-pressed="pose === 'legs'"
          :class="{ on: pose === 'legs' }"
          @click="pose = 'legs'"
        >
          Legs
        </button>
        <button
          type="button"
          :aria-pressed="pose === 'ray'"
          :class="{ on: pose === 'ray' }"
          @click="pose = 'ray'"
        >
          Ray
        </button>
      </div>
      <div class="examples">
        <button
          v-for="example in examples"
          :key="example"
          type="button"
          @click="numberText = String(example)"
        >
          {{ example }}
        </button>
      </div>
    </form>

    <h2>Number</h2>
    <div class="cards">
      <section class="card">
        <h3>costumeNameCandidates</h3>
        <pre v-if="candidates">{{ show(candidates) }}</pre>
        <p v-else class="muted">Waiting for a safe integer.</p>
      </section>
      <section class="card">
        <h3>placeValueParts</h3>
        <pre v-if="places">{{ show(places) }}</pre>
        <p v-else class="muted">Waiting for a safe integer.</p>
      </section>
      <section class="card">
        <h3>splitOfficialAddends</h3>
        <pre v-if="addends">{{ show(addends) }}</pre>
        <p v-else class="muted">Waiting for a safe integer.</p>
      </section>
      <section class="card">
        <h3>parseCostumeNumber</h3>
        <label class="field">
          <span class="sr-only">Costume title</span>
          <input v-model="costumeTitle" type="text" autocomplete="off" />
        </label>
        <p class="result">{{ parsedTitle === null ? "null" : parsedTitle }}</p>
      </section>

      <section class="card">
        <h3>getNumberSvgUrl</h3>
        <p class="muted">0–99 generator costume. The numeral toggle is not an argument here.</p>
        <p v-if="numberUrl.error" class="err">{{ numberUrl.error }}</p>
        <p v-else-if="numberUrl.pending" class="muted">Loading…</p>
        <img v-else-if="numberUrl.value" class="shot" :src="numberUrl.value" alt="" />
      </section>
      <section class="card">
        <h3>getNumberblockUrl</h3>
        <p v-if="blockUrl.error" class="err">{{ blockUrl.error }}</p>
        <p v-else-if="blockUrl.pending" class="muted">Loading…</p>
        <img v-else-if="blockUrl.value" class="shot" :src="blockUrl.value" alt="" />
      </section>
      <section class="card">
        <h3>getNumberblockAsset</h3>
        <p v-if="blockAsset.error" class="err">{{ blockAsset.error }}</p>
        <p v-else-if="blockAsset.pending" class="muted">Loading…</p>
        <template v-else-if="blockAsset.value">
          <img class="shot" :src="blockAsset.value.url" alt="" />
          <pre>{{ show(blockAsset.value) }}</pre>
        </template>
      </section>
      <section class="card wide">
        <h3>getNumberblockFigure</h3>
        <p v-if="figure.error" class="err">{{ figure.error }}</p>
        <p v-else-if="figure.pending" class="muted">Loading…</p>
        <div v-else-if="figure.value" class="shots">
          <figure v-for="(asset, index) in figure.value" :key="index">
            <img class="shot" :src="asset.url" alt="" />
            <figcaption>{{ asset.width }}×{{ asset.height }}</figcaption>
          </figure>
        </div>
      </section>
      <section class="card wide">
        <h3>getNumberblockScene</h3>
        <div class="toggles">
          <label class="check"><input v-model="showLimb" type="checkbox" /> Limbs</label>
          <label class="check"><input v-model="showFace" type="checkbox" /> Face</label>
          <label class="check"><input v-model="showNumeral" type="checkbox" /> Numeral</label>
        </div>
        <p v-if="scene.error" class="err">{{ scene.error }}</p>
        <p v-else-if="scene.pending" class="muted">Loading…</p>
        <template v-else-if="scene.value">
          <div
            class="shots scene"
            :class="{
              'hide-limb': !showLimb,
              'hide-face': !showFace,
              'hide-numeral': !showNumeral,
            }"
          >
            <div
              v-for="(part, index) in scene.value"
              :key="index"
              class="svg-frame"
              v-html="part.svg"
            />
          </div>
          <pre>{{ show(sceneMeta(scene.value)) }}</pre>
        </template>
      </section>
      <section class="card wide">
        <h3>getNumberParts</h3>
        <p v-if="parts.error" class="err">{{ parts.error }}</p>
        <p v-else-if="parts.pending" class="muted">Loading…</p>
        <template v-else-if="parts.value">
          <div class="shots">
            <figure v-for="(part, index) in parts.value" :key="`${part.target}-${part.costume}-${index}`">
              <img class="shot" :src="part.url" alt="" />
              <figcaption>
                {{ part.target }} / {{ part.costume }}
                <button type="button" class="texty" @click="usePart(part)">
                  Use costume
                </button>
              </figcaption>
            </figure>
          </div>
          <pre>{{ show(parts.value) }}</pre>
        </template>
      </section>
    </div>

    <h2>Times table</h2>
    <div class="cards">
      <section class="card">
        <h3>growingTimesTable</h3>
        <pre v-if="safeNumber !== null">{{ show(growingFrame) }}</pre>
        <p v-else class="muted">Waiting for a safe integer.</p>
      </section>
      <section class="card">
        <h3>getGrowingTimesTableUrl</h3>
        <p v-if="growingUrl.error" class="err">{{ growingUrl.error }}</p>
        <p v-else-if="growingUrl.pending" class="muted">Loading…</p>
        <img v-else-if="growingUrl.value" class="shot wide-shot" :src="growingUrl.value" alt="" />
      </section>
      <section class="card">
        <h3>timesTableCharacter</h3>
        <p class="muted">Pose: {{ pose }}</p>
        <pre v-if="safeNumber !== null">{{ show(characterRef) }}</pre>
        <p v-else class="muted">Waiting for a safe integer.</p>
      </section>
      <section class="card">
        <h3>getTimesTableCharacterUrl</h3>
        <p v-if="characterUrl.error" class="err">{{ characterUrl.error }}</p>
        <p v-else-if="characterUrl.pending" class="muted">Loading…</p>
        <img v-else-if="characterUrl.value" class="shot" :src="characterUrl.value" alt="" />
      </section>
    </div>

    <h2>Costume</h2>
    <div class="costume-fields">
      <label class="field grow">
        <span>Target</span>
        <input v-model="targetName" type="text" list="sprite-targets" autocomplete="off" />
      </label>
      <label class="field grow">
        <span>Costume</span>
        <input v-model="costumeName" type="text" list="sprite-costumes" autocomplete="off" />
      </label>
    </div>
    <datalist id="sprite-targets">
      <option v-for="name in targetNames.value ?? []" :key="name" :value="name" />
    </datalist>
    <datalist id="sprite-costumes">
      <option
        v-for="costume in costumeList.value ?? []"
        :key="costume.md5ext + costume.name"
        :value="costume.name"
      />
    </datalist>

    <div class="cards">
      <section class="card">
        <h3>hasCostume</h3>
        <p v-if="costumeHit.error" class="err">{{ costumeHit.error }}</p>
        <p v-else-if="costumeHit.pending" class="muted">Loading…</p>
        <p v-else-if="costumeHit.value !== null" class="result">
          {{ costumeHit.value ? "true" : "false" }}
        </p>
      </section>
      <section class="card">
        <h3>getCostume</h3>
        <p v-if="costumeMeta.error" class="err">{{ costumeMeta.error }}</p>
        <p v-else-if="costumeMeta.pending" class="muted">Loading…</p>
        <pre v-else-if="costumeMeta.value">{{ show(costumeMeta.value) }}</pre>
      </section>
      <section class="card">
        <h3>getAssetRef</h3>
        <p v-if="assetRef.error" class="err">{{ assetRef.error }}</p>
        <p v-else-if="assetRef.pending" class="muted">Loading…</p>
        <pre v-else-if="assetRef.value">{{ show(assetRef.value) }}</pre>
      </section>
      <section class="card">
        <h3>getCostumeUrl</h3>
        <p class="muted">SVG and bitmap. SVG honors Keep numeral.</p>
        <p v-if="costumeUrl.error" class="err">{{ costumeUrl.error }}</p>
        <p v-else-if="costumeUrl.pending" class="muted">Loading…</p>
        <img v-else-if="costumeUrl.value" class="shot" :src="costumeUrl.value" alt="" />
      </section>
      <section class="card">
        <h3>getSvgUrl</h3>
        <p v-if="svgUrl.error" class="err">{{ svgUrl.error }}</p>
        <p v-else-if="svgUrl.pending" class="muted">Loading…</p>
        <img v-else-if="svgUrl.value" class="shot" :src="svgUrl.value" alt="" />
      </section>
      <section class="card">
        <h3>getSvgText</h3>
        <p v-if="svgText.error" class="err">{{ svgText.error }}</p>
        <p v-else-if="svgText.pending" class="muted">Loading…</p>
        <template v-else-if="svgText.value">
          <p class="muted">{{ svgText.value.length }} characters</p>
          <details>
            <summary>Markup</summary>
            <pre>{{ svgText.value }}</pre>
          </details>
        </template>
      </section>
      <section class="card wide">
        <h3>Costume source</h3>
        <p class="muted">
          getCostumeSource, then the toggles call normalizeScratchSvg,
          stripCostumeNumeral, separateBlockSeams, and decorateCostumeLife.
        </p>
        <div class="toggles">
          <label class="check"><input v-model="normalizeOn" type="checkbox" /> normalizeScratchSvg</label>
          <label class="check"><input v-model="stripOn" type="checkbox" /> stripCostumeNumeral</label>
          <label class="check"><input v-model="seamsOn" type="checkbox" /> separateBlockSeams</label>
          <label class="check"><input v-model="decorateOn" type="checkbox" /> decorateCostumeLife</label>
        </div>
        <p v-if="sourceSlot.error" class="err">{{ sourceSlot.error }}</p>
        <p v-else-if="sourceSlot.pending" class="muted">Loading…</p>
        <template v-else-if="pipeline">
          <p v-if="pipeline.error" class="err">{{ pipeline.error }}</p>
          <div v-else class="svg-frame" v-html="pipeline.svg" />
          <pre v-if="pipeline.scene">{{ show({ ...pipeline.scene, svg: `${pipeline.scene.svg.length} chars` }) }}</pre>
        </template>
      </section>
    </div>

    <h2>Targets</h2>
    <label class="field">
      <span>listTargets prefix</span>
      <input v-model="prefixText" type="text" autocomplete="off" placeholder="NBs//" />
    </label>
    <div class="cards">
      <section class="card">
        <h3>listTargets</h3>
        <p v-if="targetNames.error" class="err">{{ targetNames.error }}</p>
        <p v-else-if="targetNames.pending" class="muted">Loading…</p>
        <ul v-else-if="targetNames.value" class="names">
          <li v-for="name in targetNames.value" :key="name">
            <button type="button" class="texty" @click="targetName = name">{{ name }}</button>
          </li>
        </ul>
      </section>
      <section class="card">
        <h3>listNumberblockTargets</h3>
        <p v-if="numberblockTargets.error" class="err">{{ numberblockTargets.error }}</p>
        <ul v-else-if="numberblockTargets.value" class="names">
          <li v-for="name in numberblockTargets.value" :key="name">
            <button type="button" class="texty" @click="targetName = name">{{ name }}</button>
          </li>
        </ul>
      </section>
      <section class="card">
        <h3>listCostumes</h3>
        <p v-if="costumeList.error" class="err">{{ costumeList.error }}</p>
        <p v-else-if="costumeList.pending" class="muted">Loading…</p>
        <ul v-else-if="costumeList.value" class="names">
          <li v-for="costume in costumeList.value" :key="costume.name + costume.md5ext">
            <button type="button" class="texty" @click="costumeName = costume.name">
              {{ costume.name }}
            </button>
          </li>
        </ul>
      </section>
      <section class="card wide">
        <h3>getTarget</h3>
        <label class="check">
          <input v-model="includeScripts" type="checkbox" />
          Include scripts
        </label>
        <p v-if="targetJson.error" class="err">{{ targetJson.error }}</p>
        <p v-else-if="targetJson.pending" class="muted">Loading…</p>
        <pre v-else-if="targetJson.value">{{ targetJson.value }}</pre>
      </section>
    </div>

    <h2>Sounds</h2>
    <div class="costume-fields">
      <label class="field grow">
        <span>Sound name</span>
        <input v-model="soundName" type="text" list="sprite-sounds" autocomplete="off" />
      </label>
      <datalist id="sprite-sounds">
        <option v-for="name in soundNames" :key="name" :value="name" />
      </datalist>
      <div class="actions">
        <button type="button" @click="onLoadSound">getSoundUrl</button>
        <button type="button" :disabled="playing === 'number'" @click="onPlayNumber">
          {{ playing === "number" ? "Playing…" : "playNumberName" }}
        </button>
        <button type="button" :disabled="playing === 'sound'" @click="onPlaySound">
          {{ playing === "sound" ? "Playing…" : "playSound" }}
        </button>
        <button type="button" @click="onStop">stopAllSounds</button>
        <button type="button" @click="onUnlock">unlockAudio</button>
      </div>
    </div>
    <p v-if="namePlayed.error" class="err">{{ namePlayed.error }}</p>
    <p v-else-if="namePlayed.value !== null" class="result">
      playNumberName → {{ namePlayed.value ? "true" : "false" }}
    </p>
    <p v-if="soundUrl.error" class="err">{{ soundUrl.error }}</p>
    <p v-else-if="soundChecked && soundUrl.value === null && !soundUrl.pending" class="muted">
      getSoundUrl returned null. That name is not in the project.
    </p>
    <audio v-if="soundUrl.value" :src="soundUrl.value" controls />
    <p v-if="audioNote" class="muted">{{ audioNote }}</p>

    <h2>Project</h2>
    <div class="actions">
      <button type="button" @click="onLoadProject">load</button>
      <button type="button" @click="onResource">resource</button>
      <button type="button" :disabled="indexPending" @click="onIndex">
        {{ indexPending ? "Indexing…" : "buildSvgIndex" }}
      </button>
      <button type="button" @click="onDispose">dispose</button>
    </div>
    <p v-if="resourceSummary.error" class="err">{{ resourceSummary.error }}</p>
    <pre v-else-if="resourceSummary.value">{{ resourceSummary.value }}</pre>
    <p v-if="indexError" class="err">{{ indexError }}</p>
    <template v-if="svgIndex">
      <p class="muted">{{ indexNames.length }} targets in the SVG index.</p>
      <label class="field">
        <span>Index target</span>
        <select v-model="indexTarget">
          <option v-for="name in indexNames" :key="name" :value="name">{{ name }}</option>
        </select>
      </label>
      <ul class="names">
        <li v-for="name in indexCostumes" :key="name">{{ name }}</li>
      </ul>
    </template>

    <h2>Reference</h2>
    <details>
      <summary>Constants</summary>
      <pre>{{
        show({
          MAX_NUMBERBLOCK_VALUE,
          BLOCK_SEAM_THICKNESS,
          TIMES_TABLES_TARGET,
          NUMBER_GROUPS,
          OFFICIAL_NUMBERBLOCK_VALUES,
          FOF_NUMBERBLOCK_VALUES,
          FOF_NAMED_NUMBERBLOCK_VALUES,
          CHARACTER_NUMBERBLOCK_VALUES,
        })
      }}</pre>
    </details>
  </div>
</template>

<style scoped>
.lab {
  padding: 0.2rem 1rem 2.5rem;
}

.controls {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.7rem 1rem;
  margin: 0 -1rem 1rem;
  padding: 0.4rem 1rem 0.7rem;
  background: color-mix(in srgb, var(--wall) 92%, transparent);
}

h2 {
  margin: 1.3rem 0 0.55rem;
  font-size: 1.05rem;
}

h3 {
  margin: 0 0 0.35rem;
  font-size: 0.92rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  min-width: 0;
  font-size: 0.78rem;
  font-weight: 800;
  color: #7a746c;
}

.field.grow {
  flex: 1 1 12rem;
}

.field input,
.field select,
.costume-fields input {
  margin: 0;
  padding: 0.38rem 0.65rem;
  border: 0;
  border-radius: 0.7rem;
  background: rgba(255, 255, 255, 0.9);
  color: var(--ink);
  font: inherit;
  font-size: 1rem;
  font-weight: 800;
  box-shadow: 0 0 0 1px rgba(40, 20, 0, 0.06);
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-weight: 800;
}

.pose,
.examples,
.actions,
.toggles,
.costume-fields {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.pose button,
.examples button,
.actions button {
  appearance: none;
  margin: 0;
  border: 0;
  border-radius: 999px;
  padding: 0.28rem 0.75rem;
  background: transparent;
  color: #7a746c;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.pose button.on,
.examples button:hover,
.actions button:hover,
.pose button:hover {
  background: rgba(255, 255, 255, 0.9);
  color: #1a1a1a;
  box-shadow: 0 0 0 1px rgba(40, 20, 0, 0.06);
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 0.7rem;
}

.card {
  min-width: 0;
  padding: 0.75rem;
  border-radius: 0.9rem;
  background: rgba(255, 255, 255, 0.55);
}

.card.wide {
  grid-column: 1 / -1;
}

.shot {
  display: block;
  max-width: 100%;
  max-height: 14rem;
  margin: 0.4rem auto;
  object-fit: contain;
  background-color: #fff;
  background-image:
    linear-gradient(45deg, #efe6d4 25%, transparent 25%),
    linear-gradient(-45deg, #efe6d4 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #efe6d4 75%),
    linear-gradient(-45deg, transparent 75%, #efe6d4 75%);
  background-size: 16px 16px;
  background-position:
    0 0,
    0 8px,
    8px -8px,
    -8px 0;
}

.wide-shot {
  max-height: 8rem;
}

.shots {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.8rem;
}

figure {
  margin: 0;
}

figcaption {
  max-width: 14rem;
  color: #7a746c;
  font-size: 0.75rem;
  font-weight: 800;
  overflow-wrap: anywhere;
}

pre {
  max-height: 16rem;
  margin: 0.4rem 0 0;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-size: 0.75rem;
  line-height: 1.35;
}

.names {
  max-height: 14rem;
  margin: 0.3rem 0 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

.names li {
  margin: 0.12rem 0;
}

.texty {
  margin: 0;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 800;
  text-align: left;
  cursor: pointer;
}

.result {
  margin: 0.4rem 0 0;
  font-size: 1.2rem;
  font-weight: 900;
}

.muted {
  margin: 0.2rem 0 0;
  color: #7a746c;
  font-size: 0.82rem;
  font-weight: 800;
}

.err {
  margin: 0.2rem 0 0;
  color: #9a3412;
  font-weight: 800;
}

.svg-frame {
  max-height: 16rem;
  overflow: auto;
  background: #fff;
  border-radius: 0.6rem;
}

.svg-frame :deep(svg) {
  display: block;
  width: auto;
  max-width: 100%;
  height: auto;
  max-height: 15rem;
}

.scene.hide-limb :deep([data-part="limb"]) {
  opacity: 0;
}

.scene.hide-face :deep([data-part="face"]) {
  opacity: 0;
}

.scene.hide-numeral :deep([data-part="numeral"]) {
  opacity: 0;
}

audio {
  display: block;
  width: min(100%, 28rem);
  margin-top: 0.6rem;
}

.costume-fields {
  align-items: flex-end;
  margin-bottom: 0.7rem;
}

details {
  margin-top: 0.4rem;
}

.sr-only {
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
</style>
