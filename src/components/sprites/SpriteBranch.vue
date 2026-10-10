<script setup lang="ts">
import { computed } from "vue"
import type { ScratchResourceNode } from "../../lib/numberblocksSb3"
import { pickKey, type SpritePick } from "./pick"
import SpriteBranch from "./SpriteBranch.vue"

const props = defineProps<{
  node: ScratchResourceNode
  path: string
  query: string
  open: Record<string, boolean>
  selected: string
}>()

const emit = defineEmits<{
  toggle: [path: string]
  pick: [pick: SpritePick]
}>()

const q = computed(() => props.query.trim().toLowerCase())

function hit(value: string): boolean {
  return q.value.length > 0 && value.toLowerCase().includes(q.value)
}

function nodeMatches(node: ScratchResourceNode): boolean {
  if (!q.value) return true
  if (node.kind === "folder") {
    if (hit(node.name)) return true
    return node.children.some((child) => nodeMatches(child))
  }
  if (hit(node.label)) return true
  if (node.costumes.some((costume) => hit(costume.name))) return true
  if (node.sounds.some((sound) => hit(sound.name))) return true
  if (node.variables.some((item) => hit(item.name))) return true
  if (node.lists.some((item) => hit(item.name))) return true
  return node.broadcasts.some((item) => hit(item.name))
}

const label = computed(() =>
  props.node.kind === "folder" ? props.node.name : props.node.label,
)
const labelHit = computed(() => hit(label.value))
const visible = computed(() => nodeMatches(props.node))

const costumeHit = computed(() => {
  if (props.node.kind !== "target" || !q.value) return false
  return props.node.costumes.some((costume) => hit(costume.name))
})

const soundHit = computed(() => {
  if (props.node.kind !== "target" || !q.value) return false
  return props.node.sounds.some((sound) => hit(sound.name))
})

const expanded = computed(() => {
  if (!visible.value) return false
  if (!q.value) return !!props.open[props.path]
  if (props.node.kind === "folder") return true
  return labelHit.value || costumeHit.value || soundHit.value
})

const children = computed(() => {
  if (props.node.kind !== "folder") return []
  if (!q.value || hit(props.node.name)) return props.node.children
  return props.node.children.filter((child) => nodeMatches(child))
})

const costumes = computed(() => {
  if (props.node.kind !== "target") return []
  if (!q.value || labelHit.value) return props.node.costumes
  return props.node.costumes.filter((costume) => hit(costume.name))
})

const sounds = computed(() => {
  if (props.node.kind !== "target") return []
  if (!q.value || labelHit.value) return props.node.sounds
  return props.node.sounds.filter((sound) => hit(sound.name))
})

const costumeCount = computed(() => {
  const walk = (node: ScratchResourceNode): number => {
    if (node.kind === "target") return node.costumes.length
    return node.children.reduce((sum, child) => sum + walk(child), 0)
  }
  return walk(props.node)
})

const rowKey = computed(() =>
  pickKey(
    props.node.kind === "folder"
      ? { kind: "folder", path: props.path }
      : { kind: "target", name: props.node.name },
  ),
)

function childPath(child: ScratchResourceNode): string {
  if (child.kind === "target") return child.name
  return `${props.path}//${child.name}`
}

function onRow() {
  if (props.node.kind === "folder") {
    emit("pick", { kind: "folder", path: props.path })
  } else {
    emit("pick", { kind: "target", name: props.node.name })
  }
  if (!q.value) emit("toggle", props.path)
}

function costumePick(name: string): SpritePick {
  return {
    kind: "costume",
    target: props.node.kind === "target" ? props.node.name : "",
    costume: name,
  }
}

function soundPick(name: string): SpritePick {
  return {
    kind: "sound",
    target: props.node.kind === "target" ? props.node.name : "",
    sound: name,
  }
}
</script>

<template>
  <li v-if="visible" class="branch" role="none">
    <button
      type="button"
      class="row"
      role="treeitem"
      :aria-expanded="expanded"
      :aria-selected="selected === rowKey"
      :class="{ on: selected === rowKey }"
      @click="onRow"
    >
      <span class="mark" aria-hidden="true">{{ expanded ? "▾" : "▸" }}</span>
      <span class="name">{{ label }}</span>
      <span class="count">{{ costumeCount }}</span>
    </button>

    <ul v-if="expanded && node.kind === 'folder'" class="kids" role="group">
      <SpriteBranch
        v-for="child in children"
        :key="`${child.kind}:${child.kind === 'folder' ? child.name : child.name}`"
        :node="child"
        :path="childPath(child)"
        :query="query"
        :open="open"
        :selected="selected"
        @toggle="emit('toggle', $event)"
        @pick="emit('pick', $event)"
      />
    </ul>

    <div v-else-if="expanded && node.kind === 'target'" class="leaves">
      <p v-if="costumes.length" class="group">Costumes</p>
      <ul v-if="costumes.length" role="group">
        <li v-for="(costume, index) in costumes" :key="`${costume.name}-${index}`">
          <button
            type="button"
            class="leaf"
            role="treeitem"
            :aria-selected="selected === pickKey(costumePick(costume.name))"
            :class="{ on: selected === pickKey(costumePick(costume.name)) }"
            @click="emit('pick', costumePick(costume.name))"
          >
            <span class="name">{{ costume.name }}</span>
            <span class="count">{{ costume.dataFormat }}</span>
          </button>
        </li>
      </ul>
      <p v-if="sounds.length" class="group">Sounds</p>
      <ul v-if="sounds.length" role="group">
        <li v-for="(sound, index) in sounds" :key="`${sound.name}-${index}`">
          <button
            type="button"
            class="leaf"
            role="treeitem"
            :aria-selected="selected === pickKey(soundPick(sound.name))"
            :class="{ on: selected === pickKey(soundPick(sound.name)) }"
            @click="emit('pick', soundPick(sound.name))"
          >
            <span class="name">{{ sound.name }}</span>
            <span class="count">{{ sound.dataFormat }}</span>
          </button>
        </li>
      </ul>
    </div>
  </li>
</template>

<style scoped>
.branch,
.kids,
ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.kids,
.leaves {
  margin-left: 0.75rem;
}

.row,
.leaf {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  width: 100%;
  margin: 0;
  border: 0;
  border-radius: 0.55rem;
  padding: 0.22rem 0.35rem;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 0.92rem;
  font-weight: 800;
  text-align: left;
  cursor: pointer;
}

.row.on,
.leaf.on {
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 0 1px rgba(40, 20, 0, 0.06);
}

.mark {
  width: 0.8rem;
  color: #8a8176;
  font-weight: 900;
}

.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.count {
  flex: 0 0 auto;
  color: #8a8176;
  font-size: 0.75rem;
  font-weight: 800;
}

.group {
  margin: 0.35rem 0 0.1rem;
  color: #8a8176;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.leaf {
  font-weight: 700;
}
</style>
