import type {
  AnimationContext,
  AnimationSystem,
  AnimationSystemConfig,
  AnimationUiEvent,
} from "./types"

type QueueEntry = {
  setId: string
  resolve: () => void
  reject: (error: unknown) => void
}

function defaultSleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function createAnimationSystem(
  config: AnimationSystemConfig,
): AnimationSystem {
  const sleep = config.sleep ?? defaultSleep
  const onConflict = config.onConflict ?? "queue"
  const emitOuter = config.emit ?? (() => {})

  let generation = 0
  let runToken = 0
  let activeId: string | null = null
  const queue: QueueEntry[] = []
  let pumping = false
  const idleWaiters: Array<() => void> = []

  function emit(event: AnimationUiEvent) {
    emitOuter(event)
  }

  function notifyIdle() {
    if (activeId !== null || queue.length > 0 || pumping) return
    const waiters = idleWaiters.splice(0)
    for (const resolve of waiters) resolve()
  }

  function clearQueue() {
    const pending = queue.splice(0)
    // Resolve (do not reject) so void play() callers are not unhandled rejections.
    for (const entry of pending) entry.resolve()
  }

  function cancelActive() {
    if (activeId === null) return
    const cancelledId = activeId
    generation += 1
    emit({ type: "setEnd", setId: cancelledId, reason: "cancelled" })
  }

  async function runSet(setId: string): Promise<void> {
    const def = config.sets[setId]
    if (!def) {
      throw new Error(`Unknown animation set: ${setId}`)
    }

    const gen = ++generation
    const token = ++runToken
    activeId = setId

    const ctx: AnimationContext = {
      id: setId,
      still: () => gen === generation,
      sleep: async (ms) => {
        if (gen !== generation) return
        await sleep(ms)
      },
      emit: (event) => {
        if (gen !== generation) return
        emit(event)
      },
    }

    emit({ type: "setStart", setId })
    try {
      await def.run(ctx)
    } catch (error) {
      if (token === runToken) activeId = null
      if (gen === generation) {
        emit({ type: "setEnd", setId, reason: "finished" })
      }
      throw error
    }

    if (token === runToken) activeId = null
    if (gen === generation) {
      emit({ type: "setEnd", setId, reason: "finished" })
    }
  }

  async function pump() {
    if (pumping) return
    pumping = true
    try {
      while (queue.length > 0) {
        const entry = queue.shift()
        if (!entry) break
        try {
          await runSet(entry.setId)
          entry.resolve()
        } catch (error) {
          entry.reject(error)
        }
      }
    } finally {
      pumping = false
      notifyIdle()
      if (queue.length > 0) void pump()
    }
  }

  function enqueue(setId: string): Promise<void> {
    if (!config.sets[setId]) {
      return Promise.reject(new Error(`Unknown animation set: ${setId}`))
    }

    return new Promise<void>((resolve, reject) => {
      queue.push({ setId, resolve, reject })
      void pump()
    })
  }

  async function play(setId: string): Promise<void> {
    if (!config.sets[setId]) {
      throw new Error(`Unknown animation set: ${setId}`)
    }

    if (onConflict === "replace" && activeId !== null) {
      return replace(setId)
    }

    return enqueue(setId)
  }

  async function replace(setId: string): Promise<void> {
    if (!config.sets[setId]) {
      throw new Error(`Unknown animation set: ${setId}`)
    }

    clearQueue()
    if (activeId !== null) {
      cancelActive()
      runToken += 1
      activeId = null
      await Promise.resolve()
    }

    return enqueue(setId)
  }

  function cancel(): void {
    clearQueue()
    if (activeId !== null) {
      cancelActive()
      runToken += 1
      activeId = null
    }
    notifyIdle()
  }

  function whenIdle(): Promise<void> {
    if (activeId === null && queue.length === 0 && !pumping) {
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      idleWaiters.push(resolve)
    })
  }

  return {
    play,
    replace,
    cancel,
    isPlaying: () => activeId !== null || queue.length > 0 || pumping,
    activeId: () => activeId,
    queuedIds: () => queue.map((entry) => entry.setId),
    whenIdle,
  }
}
