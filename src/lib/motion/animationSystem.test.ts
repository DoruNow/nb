import { describe, expect, it, vi } from "vitest"
import { createAnimationSystem } from "./animationSystem"
import type { AnimationSetDef, AnimationUiEvent } from "./types"

function sleepStub(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

function loggingSets(
  log: string[],
  defs: Record<string, { kind: AnimationSetDef["kind"]; ms?: number; phases?: string[] }>,
): Record<string, AnimationSetDef> {
  const sets: Record<string, AnimationSetDef> = {}
  for (const [id, def] of Object.entries(defs)) {
    sets[id] = {
      kind: def.kind,
      async run(ctx) {
        log.push(`${id}:run`)
        for (const phase of def.phases ?? []) {
          if (!ctx.still()) return
          ctx.emit({ type: "phase", setId: id, phase })
          log.push(`${id}:${phase}`)
        }
        if (def.ms) {
          await ctx.sleep(def.ms)
          if (!ctx.still()) {
            log.push(`${id}:aborted`)
            return
          }
        }
        log.push(`${id}:done`)
      },
    }
  }
  return sets
}

function eventLog() {
  const events: AnimationUiEvent[] = []
  return {
    events,
    emit(event: AnimationUiEvent) {
      events.push(event)
    },
    starts() {
      return events.filter((e) => e.type === "setStart").map((e) => e.setId)
    },
    ends() {
      return events
        .filter((e) => e.type === "setEnd")
        .map((e) => `${e.setId}:${e.reason}`)
    },
    phases() {
      return events
        .filter((e) => e.type === "phase")
        .map((e) => `${e.setId}:${e.phase}`)
    },
  }
}

describe("createAnimationSystem", () => {
  it("play while idle starts immediately", async () => {
    const log: string[] = []
    const ui = eventLog()
    const system = createAnimationSystem({
      sets: loggingSets(log, { a: { kind: "intro", ms: 5 } }),
      sleep: sleepStub,
      emit: ui.emit,
    })

    const done = system.play("a")
    expect(system.isPlaying()).toBe(true)
    expect(system.activeId()).toBe("a")
    await done
    expect(system.isPlaying()).toBe(false)
    expect(system.activeId()).toBe(null)
    expect(ui.starts()).toEqual(["a"])
    expect(ui.ends()).toEqual(["a:finished"])
    expect(log).toEqual(["a:run", "a:done"])
  })

  it("second play waits until the first finishes (no concurrent starts)", async () => {
    const log: string[] = []
    const ui = eventLog()
    const system = createAnimationSystem({
      sets: loggingSets(log, {
        a: { kind: "intro", ms: 30 },
        b: { kind: "celebration", ms: 5 },
      }),
      sleep: sleepStub,
      emit: ui.emit,
    })

    const first = system.play("a")
    const second = system.play("b")
    expect(system.activeId()).toBe("a")
    expect(system.queuedIds()).toEqual(["b"])

    expect(system.queuedIds()).toEqual(["b"])
    await Promise.all([first, second])
    await system.whenIdle()

    expect(system.queuedIds()).toEqual([])
    expect(ui.starts()).toEqual(["a", "b"])
    expect(ui.ends()).toEqual(["a:finished", "b:finished"])
    expect(log).toEqual(["a:run", "a:done", "b:run", "b:done"])
  })

  it("queuedIds reflects pending order", async () => {
    const system = createAnimationSystem({
      sets: loggingSets([], {
        a: { kind: "intro", ms: 40 },
        b: { kind: "celebration" },
        c: { kind: "prompt" },
      }),
      sleep: sleepStub,
    })

    void system.play("a")
    void system.play("b")
    void system.play("c")
    expect(system.queuedIds()).toEqual(["b", "c"])
    await system.whenIdle()
    expect(system.queuedIds()).toEqual([])
  })

  it("replace cancels active, clears queue, and starts the new set", async () => {
    const log: string[] = []
    const ui = eventLog()
    const system = createAnimationSystem({
      sets: loggingSets(log, {
        a: { kind: "intro", ms: 50, phases: ["mid"] },
        b: { kind: "celebration" },
        c: { kind: "prompt" },
      }),
      sleep: sleepStub,
      emit: ui.emit,
    })

    void system.play("a")
    void system.play("b")
    expect(system.queuedIds()).toEqual(["b"])

    const replaced = system.replace("c")
    expect(system.queuedIds()).toEqual([])
    await replaced
    await system.whenIdle()
    // replace cleared the queued "b" and ran "c" after cancelling "a"
    expect(system.activeId()).toBe(null)

    expect(ui.ends()).toContain("a:cancelled")
    expect(ui.starts()).toEqual(["a", "c"])
    expect(ui.ends()).toEqual(["a:cancelled", "c:finished"])
    expect(log).not.toContain("b:run")
    expect(log).toContain("c:run")
  })

  it("cancel stops active, clears queue, and whenIdle resolves", async () => {
    const ui = eventLog()
    const system = createAnimationSystem({
      sets: loggingSets([], {
        a: { kind: "intro", ms: 80 },
        b: { kind: "celebration" },
      }),
      sleep: sleepStub,
      emit: ui.emit,
    })

    void system.play("a")
    void system.play("b")
    system.cancel()
    await system.whenIdle()

    expect(system.isPlaying()).toBe(false)
    expect(system.activeId()).toBe(null)
    expect(system.queuedIds()).toEqual([])
    expect(ui.ends()).toEqual(["a:cancelled"])
  })

  it("still() becomes false after cancel so run stops emitting phases", async () => {
    const ui = eventLog()
    let releaseSleep!: () => void
    const gate = new Promise<void>((resolve) => {
      releaseSleep = resolve
    })

    const system = createAnimationSystem({
      sets: {
        a: {
          kind: "intro",
          async run(ctx) {
            ctx.emit({ type: "phase", setId: "a", phase: "before" })
            await gate
            if (!ctx.still()) return
            ctx.emit({ type: "phase", setId: "a", phase: "after" })
          },
        },
      },
      sleep: sleepStub,
      emit: ui.emit,
    })

    const play = system.play("a")
    await vi.waitFor(() => {
      expect(ui.phases()).toContain("a:before")
    })
    system.cancel()
    releaseSleep()
    await play
    await system.whenIdle()

    expect(ui.phases()).toEqual(["a:before"])
    expect(ui.ends()).toEqual(["a:cancelled"])
  })

  it("onConflict replace makes play cancel the active set", async () => {
    const ui = eventLog()
    const system = createAnimationSystem({
      sets: loggingSets([], {
        a: { kind: "intro", ms: 40 },
        b: { kind: "celebration" },
      }),
      onConflict: "replace",
      sleep: sleepStub,
      emit: ui.emit,
    })

    void system.play("a")
    await system.play("b")
    await system.whenIdle()

    expect(ui.ends()).toEqual(["a:cancelled", "b:finished"])
    expect(ui.starts()).toEqual(["a", "b"])
  })

  it("play rejects unknown set ids", async () => {
    const system = createAnimationSystem({
      sets: loggingSets([], { a: { kind: "intro" } }),
      sleep: sleepStub,
    })
    await expect(system.play("missing")).rejects.toThrow(/missing/)
  })
})
