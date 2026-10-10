<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from "vue"
import MapperLab from "../components/sprites/MapperLab.vue"
import SpriteBranch from "../components/sprites/SpriteBranch.vue"
import { pickKey, type SpritePick } from "../components/sprites/pick"
import {
  numberblocksAssets,
  type ScratchResource,
  type ScratchResourceFolder,
  type ScratchResourceNode,
  type ScratchResourceTarget,
  type TimesTablePose,
} from "../lib/numberblocksSb3"

const resource = shallowRef<ScratchResource | null>(null)
const loading = ref(true)
const loadError = ref("")
const query = ref("")
const open = ref<Record<string, boolean>>({})
const selection = ref<SpritePick | null>(null)
const targetName = ref("NBs//Ten + One")
const costumeName = ref("n7")
const soundName = ref("n7")
const keepNumeral = ref(false)
const pose = ref<TimesTablePose>("legs")

const wide = ref(window.matchMedia("(min-width: 900px)").matches)
const panel = ref<"tree" | "sprite" | "mapper">(wide.value ? "sprite" : "tree")

const previewUrl = ref("")
const previewError = ref("")
const playing = ref(false)
let previewId = 0
let media: MediaQueryList | null = null

const selectedKey = computed(() => pickKey(selection.value))
const showTree = computed(() => wide.value || panel.value === "tree")
const showMain = computed(() => wide.value || panel.value !== "tree")

const soundNames = computed(() => {
  const names = new Set<string>()
  const walk = (nodes: ScratchResourceNode[]) => {
    for (const node of nodes) {
      if (node.kind === "folder") walk(node.children)
      else for (const sound of node.sounds) names.add(sound.name)
    }
  }
  if (resource.value) walk(resource.value.tree)
  return [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
})

function findTarget(
  nodes: ScratchResourceNode[],
  name: string,
): ScratchResourceTarget | null {
  for (const node of nodes) {
    if (node.kind === "target" && node.name === name) return node
    if (node.kind === "folder") {
      const found = findTarget(node.children, name)
      if (found) return found
    }
  }
  return null
}

function findFolder(
  nodes: ScratchResourceNode[],
  path: string,
): ScratchResourceFolder | null {
  const parts = path.split("//")
  let current = nodes
  let found: ScratchResourceFolder | null = null
  for (const part of parts) {
    const next = current.find(
      (node): node is ScratchResourceFolder =>
        node.kind === "folder" && node.name === part,
    )
    if (!next) return null
    found = next
    current = next.children
  }
  return found
}

const selectedTarget = computed(() => {
  const pick = selection.value
  const tree = resource.value?.tree
  if (!pick || !tree) return null
  if (pick.kind === "target") return findTarget(tree, pick.name)
  if (pick.kind === "costume" || pick.kind === "sound") {
    return findTarget(tree, pick.target)
  }
  return null
})

const selectedFolder = computed(() => {
  const pick = selection.value
  const tree = resource.value?.tree
  if (!pick || pick.kind !== "folder" || !tree) return null
  return findFolder(tree, pick.path)
})

const selectedCostume = computed(() => {
  const pick = selection.value
  if (!pick || pick.kind !== "costume") return null
  return (
    selectedTarget.value?.costumes.find(
      (costume) => costume.name === pick.costume,
    ) ?? null
  )
})

const selectedSound = computed(() => {
  const pick = selection.value
  if (!pick || pick.kind !== "sound") return null
  return (
    selectedTarget.value?.sounds.find((sound) => sound.name === pick.sound) ??
    null
  )
})

function onMedia() {
  if (!media) return
  wide.value = media.matches
  if (media.matches && panel.value === "tree") panel.value = "sprite"
}

function toggle(path: string) {
  open.value = { ...open.value, [path]: !open.value[path] }
}

function onPick(pick: SpritePick) {
  selection.value = pick
  if (pick.kind === "target") targetName.value = pick.name
  if (pick.kind === "costume") {
    targetName.value = pick.target
    costumeName.value = pick.costume
  }
  if (pick.kind === "sound") {
    targetName.value = pick.target
    soundName.value = pick.sound
  }
  if (!wide.value && pick.kind !== "folder") panel.value = "sprite"
}

function openMapper() {
  panel.value = "mapper"
}

function showValue(value: unknown): string {
  const text = JSON.stringify(value)
  return text ?? "undefined"
}

async function playSelected() {
  const pick = selection.value
  if (!pick || pick.kind !== "sound") return
  playing.value = true
  try {
    await numberblocksAssets.unlockAudio()
    await numberblocksAssets.playSound(pick.sound)
  } finally {
    playing.value = false
  }
}

onMounted(() => {
  media = window.matchMedia("(min-width: 900px)")
  media.addEventListener("change", onMedia)
  void numberblocksAssets
    .resource()
    .then((next) => {
      resource.value = next
    })
    .catch((error: unknown) => {
      loadError.value = error instanceof Error ? error.message : String(error)
    })
    .finally(() => {
      loading.value = false
    })
})

onUnmounted(() => {
  media?.removeEventListener("change", onMedia)
  previewId += 1
})

watch(
  () =>
    [
      selection.value,
      keepNumeral.value,
      selectedCostume.value?.dataFormat,
    ] as const,
  async () => {
    const id = ++previewId
    const pick = selection.value
    previewUrl.value = ""
    previewError.value = ""
    if (!pick || (pick.kind !== "costume" && pick.kind !== "sound")) return
    try {
      const url =
        pick.kind === "costume"
          ? await numberblocksAssets.getCostumeUrl(pick.target, pick.costume, {
              keepNumeral: keepNumeral.value,
            })
          : await numberblocksAssets.getSoundUrl(pick.sound)
      if (id !== previewId) return
      if (!url) {
        previewError.value = `No sound named "${pick.kind === "sound" ? pick.sound : ""}".`
        return
      }
      previewUrl.value = url
    } catch (error) {
      if (id !== previewId) return
      previewError.value = error instanceof Error ? error.message : String(error)
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="screen">
    <header class="bar">
      <RouterLink class="back" to="/">Math</RouterLink>
      <h1>Sprites</h1>
      <div class="switch" role="tablist" aria-label="Sprites page">
        <button
          v-show="!wide"
          type="button"
          role="tab"
          :aria-selected="panel === 'tree'"
          :class="{ on: panel === 'tree' }"
          @click="panel = 'tree'"
        >
          Tree
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="panel === 'sprite'"
          :class="{ on: panel === 'sprite' }"
          @click="panel = 'sprite'"
        >
          Sprite
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="panel === 'mapper'"
          :class="{ on: panel === 'mapper' }"
          @click="panel = 'mapper'"
        >
          Mapper
        </button>
      </div>
    </header>

    <div class="body">
      <aside v-show="showTree" class="tree">
        <label class="search">
          <span class="sr-only">Filter the sprite tree</span>
          <input
            v-model="query"
            type="search"
            placeholder="Filter sprites, costumes, sounds"
            autocomplete="off"
          />
        </label>
        <p v-if="loading" class="status">Loading the Scratch project…</p>
        <p v-else-if="loadError" class="err">{{ loadError }}</p>
        <template v-else-if="resource">
          <p class="status">
            {{ resource.targetCount }} sprites · {{ resource.costumeCount }}
            costumes · {{ resource.soundCount }} sounds
            <template v-if="resource.meta.semver">
              · Scratch {{ resource.meta.semver }}
            </template>
          </p>
          <ul class="roots" role="tree" aria-label="Scratch project">
            <SpriteBranch
              v-for="node in resource.tree"
              :key="`${node.kind}:${node.kind === 'folder' ? node.name : node.name}`"
              :node="node"
              :path="node.kind === 'folder' ? node.name : node.name"
              :query="query"
              :open="open"
              :selected="selectedKey"
              @toggle="toggle"
              @pick="onPick"
            />
          </ul>
          <button
            type="button"
            class="row monitors"
            :class="{ on: selection?.kind === 'monitors' }"
            @click="onPick({ kind: 'monitors' })"
          >
            Monitors
            <span>{{ resource.monitors.length }}</span>
          </button>
        </template>
      </aside>

      <main v-show="showMain" class="main">
        <section v-show="panel === 'sprite'" class="inspector">
          <p v-if="!selection" class="status">
            Choose a sprite, costume, or sound in the tree. The mapper tab
            runs every lookup against a number you type.
          </p>

          <template v-else-if="selection.kind === 'folder' && selectedFolder">
            <h2>{{ selectedFolder.name }}</h2>
            <ul class="links">
              <li v-for="child in selectedFolder.children" :key="child.kind + (child.kind === 'folder' ? child.name : child.name)">
                <button
                  type="button"
                  @click="
                    onPick(
                      child.kind === 'folder'
                        ? { kind: 'folder', path: `${selection.path}//${child.name}` }
                        : { kind: 'target', name: child.name },
                    )
                  "
                >
                  {{ child.kind === "folder" ? child.name : child.label }}
                </button>
              </li>
            </ul>
          </template>

          <template v-else-if="selection.kind === 'target' && selectedTarget">
            <h2>{{ selectedTarget.name }}</h2>
            <dl class="facts">
              <div><dt>Costumes</dt><dd>{{ selectedTarget.costumes.length }}</dd></div>
              <div><dt>Sounds</dt><dd>{{ selectedTarget.sounds.length }}</dd></div>
              <div><dt>Blocks</dt><dd>{{ selectedTarget.blockCount }}</dd></div>
              <div v-if="selectedTarget.visible !== undefined">
                <dt>Visible</dt><dd>{{ selectedTarget.visible }}</dd>
              </div>
              <div v-if="selectedTarget.x !== undefined">
                <dt>Position</dt>
                <dd>{{ selectedTarget.x }}, {{ selectedTarget.y }}</dd>
              </div>
              <div v-if="selectedTarget.size !== undefined">
                <dt>Size</dt><dd>{{ selectedTarget.size }}</dd>
              </div>
              <div v-if="selectedTarget.direction !== undefined">
                <dt>Direction</dt><dd>{{ selectedTarget.direction }}</dd>
              </div>
              <div v-if="selectedTarget.currentCostume !== undefined">
                <dt>Current costume</dt>
                <dd>
                  {{ selectedTarget.currentCostume }}
                  <template v-if="selectedTarget.costumes[selectedTarget.currentCostume]">
                    · {{ selectedTarget.costumes[selectedTarget.currentCostume].name }}
                  </template>
                </dd>
              </div>
            </dl>
            <h3 v-if="selectedTarget.variables.length">Variables</h3>
            <ul v-if="selectedTarget.variables.length" class="facts-list">
              <li v-for="item in selectedTarget.variables" :key="item.id">
                <strong>{{ item.name }}</strong>
                {{ showValue(item.value) }}
              </li>
            </ul>
            <h3 v-if="selectedTarget.lists.length">Lists</h3>
            <ul v-if="selectedTarget.lists.length" class="facts-list">
              <li v-for="item in selectedTarget.lists" :key="item.id">
                <strong>{{ item.name }}</strong>
                {{ Array.isArray(item.value) ? `${item.value.length} items` : showValue(item.value) }}
              </li>
            </ul>
            <h3 v-if="selectedTarget.broadcasts.length">Broadcasts</h3>
            <ul v-if="selectedTarget.broadcasts.length" class="facts-list">
              <li v-for="item in selectedTarget.broadcasts" :key="item.id">
                {{ item.name }}
              </li>
            </ul>
            <button type="button" class="jump" @click="openMapper">
              Test this sprite in the mapper
            </button>
          </template>

          <template v-else-if="selection.kind === 'costume' && selectedCostume">
            <h2>{{ selectedCostume.name }}</h2>
            <p class="where">{{ selection.target }}</p>
            <label class="check">
              <input v-model="keepNumeral" type="checkbox" />
              Keep numeral
            </label>
            <p v-if="previewError" class="err">{{ previewError }}</p>
            <div v-else class="frame">
              <img
                v-if="previewUrl"
                :src="previewUrl"
                :alt="selectedCostume.name"
              />
            </div>
            <dl class="facts">
              <div><dt>Format</dt><dd>{{ selectedCostume.dataFormat }}</dd></div>
              <div><dt>File</dt><dd>{{ selectedCostume.md5ext }}</dd></div>
              <div><dt>Asset</dt><dd>{{ selectedCostume.assetId }}</dd></div>
              <div>
                <dt>Rotation center</dt>
                <dd>
                  {{ selectedCostume.rotationCenterX }},
                  {{ selectedCostume.rotationCenterY }}
                </dd>
              </div>
            </dl>
            <button type="button" class="jump" @click="openMapper">
              Test this costume in the mapper
            </button>
          </template>

          <template v-else-if="selection.kind === 'sound'">
            <h2>{{ selection.sound }}</h2>
            <p class="where">{{ selection.target }}</p>
            <p v-if="previewError" class="err">{{ previewError }}</p>
            <audio v-if="previewUrl" :src="previewUrl" controls />
            <div class="actions">
              <button type="button" :disabled="playing" @click="playSelected">
                {{ playing ? "Playing…" : "playSound" }}
              </button>
              <button type="button" @click="numberblocksAssets.stopAllSounds()">
                stopAllSounds
              </button>
            </div>
            <dl v-if="selectedSound" class="facts">
              <div><dt>Format</dt><dd>{{ selectedSound.dataFormat }}</dd></div>
              <div><dt>File</dt><dd>{{ selectedSound.md5ext }}</dd></div>
              <div v-if="selectedSound.rate !== undefined">
                <dt>Rate</dt><dd>{{ selectedSound.rate }}</dd>
              </div>
              <div v-if="selectedSound.sampleCount !== undefined">
                <dt>Samples</dt><dd>{{ selectedSound.sampleCount }}</dd>
              </div>
            </dl>
            <button type="button" class="jump" @click="openMapper">
              Test this sound in the mapper
            </button>
          </template>

          <template v-else-if="selection.kind === 'monitors' && resource">
            <h2>Monitors</h2>
            <ul class="facts-list">
              <li v-for="monitor in resource.monitors" :key="monitor.id">
                <strong>{{ monitor.opcode }}</strong>
                {{ monitor.spriteName || "stage" }}
                · {{ showValue(monitor.params) }}
                · {{ showValue(monitor.value) }}
              </li>
            </ul>
          </template>
        </section>

        <MapperLab
          v-show="panel === 'mapper'"
          :active="panel === 'mapper'"
          v-model:target-name="targetName"
          v-model:costume-name="costumeName"
          v-model:sound-name="soundName"
          v-model:keep-numeral="keepNumeral"
          v-model:pose="pose"
          :sound-names="soundNames"
        />
      </main>
    </div>
  </div>
</template>

<style scoped>
.screen {
  display: flex;
  flex-direction: column;
  height: 100svh;
  min-height: 100svh;
  background: var(--wall);
  color: var(--ink);
}

.bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
}

.bar h1 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 900;
}

.back,
.switch button,
.jump,
.actions button,
.links button,
.monitors {
  appearance: none;
  margin: 0;
  border: 0;
  border-radius: 999px;
  padding: 0.28rem 0.85rem;
  background: transparent;
  color: #7a746c;
  font: inherit;
  font-size: 0.95rem;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
}

.switch {
  display: flex;
  gap: 0.3rem;
  margin-left: auto;
}

.switch button.on,
.monitors.on,
.links button:hover,
.jump:hover,
.actions button:hover {
  background: rgba(255, 255, 255, 0.9);
  color: #1a1a1a;
  box-shadow: 0 0 0 1px rgba(40, 20, 0, 0.06);
}

.body {
  display: grid;
  grid-template-columns: minmax(16rem, 22rem) minmax(0, 1fr);
  flex: 1;
  min-height: 0;
}

.tree,
.main {
  min-height: 0;
  overflow: auto;
}

.tree {
  padding: 0 0.7rem 1.2rem;
  border-right: 1px solid rgba(40, 20, 0, 0.08);
}

.search input,
.check {
  font: inherit;
}

.search input {
  width: 100%;
  margin: 0 0 0.55rem;
  padding: 0.4rem 0.7rem;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  color: inherit;
  font-weight: 800;
  box-shadow: 0 0 0 1px rgba(40, 20, 0, 0.06);
}

.roots {
  margin: 0;
  padding: 0;
  list-style: none;
}

.status {
  margin: 0.2rem 0 0.7rem;
  color: #7a746c;
  font-size: 0.85rem;
  font-weight: 800;
}

.err {
  color: #9a3412;
  font-weight: 800;
}

.monitors {
  display: flex;
  justify-content: space-between;
  width: 100%;
  margin-top: 0.4rem;
  text-align: left;
}

.inspector {
  padding: 0.2rem 1rem 2rem;
}

.inspector h2,
.inspector h3 {
  margin: 0.2rem 0 0.45rem;
}

.inspector h3 {
  margin-top: 1rem;
  font-size: 0.95rem;
}

.where {
  margin: 0 0 0.6rem;
  color: #7a746c;
  font-weight: 800;
}

.check {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.7rem;
  font-weight: 800;
}

.frame {
  display: grid;
  place-items: center;
  min-height: 12rem;
  margin-bottom: 0.8rem;
  padding: 0.8rem;
  border-radius: 1rem;
  background-color: #fff;
  background-image:
    linear-gradient(45deg, #efe6d4 25%, transparent 25%),
    linear-gradient(-45deg, #efe6d4 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #efe6d4 75%),
    linear-gradient(-45deg, transparent 75%, #efe6d4 75%);
  background-size: 18px 18px;
  background-position:
    0 0,
    0 9px,
    9px -9px,
    -9px 0;
}

.frame img {
  max-width: 100%;
  max-height: 18rem;
  object-fit: contain;
}

.facts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  gap: 0.45rem 1rem;
  margin: 0.8rem 0;
}

.facts div {
  min-width: 0;
}

.facts dt {
  color: #8a8176;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.facts dd {
  margin: 0.1rem 0 0;
  overflow-wrap: anywhere;
  font-weight: 800;
}

.facts-list,
.links {
  margin: 0;
  padding: 0;
  list-style: none;
}

.facts-list li,
.links li {
  margin: 0.25rem 0;
  overflow-wrap: anywhere;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0.7rem 0;
}

.jump {
  margin-top: 0.8rem;
}

audio {
  width: min(100%, 28rem);
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

@media (max-width: 899px) {
  .screen {
    height: auto;
    min-height: 100svh;
  }

  .body {
    display: block;
  }

  .tree,
  .main {
    overflow: visible;
    border-right: 0;
  }

  .bar {
    flex-wrap: wrap;
  }
}
</style>
