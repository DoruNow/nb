import { describe, expect, it, vi } from "vitest"
import { createTimesMotion } from "./timesMotion"
import type { AnimationUiEvent } from "./types"

function sleepStub(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
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
        .map((e) => {
          const k = e.data?.k
          return k === undefined ? `${e.setId}:${e.phase}` : `${e.setId}:${e.phase}:${k}`
        })
    },
  }
}

describe("createTimesMotion", () => {
  it("onOpenEquation plays times.pass and emits pass phases", async () => {
    const ui = eventLog()
    const motion = createTimesMotion({
      passMs: 10,
      sleep: sleepStub,
      emit: ui.emit,
    })

    await motion.onOpenEquation(3)
    await motion.system.whenIdle()

    expect(ui.starts()).toEqual(["times.pass"])
    expect(ui.phases()).toEqual([
      "times.pass:show:3",
      "times.pass:go:3",
      "times.pass:clear:3",
    ])
    expect(ui.ends()).toEqual(["times.pass:finished"])
  })

  it("onLockSuccess replaces an in-flight pass, then success then prompt", async () => {
    const ui = eventLog()
    const motion = createTimesMotion({
      passMs: 80,
      speechPauseMs: 5,
      sleep: sleepStub,
      emit: ui.emit,
    })

    void motion.onOpenEquation(2)
    await vi.waitFor(() => {
      expect(ui.starts()).toContain("times.pass")
    })
    await motion.onLockSuccess({ index: 1, complete: false })
    await motion.system.whenIdle()

    expect(ui.ends()).toContain("times.pass:cancelled")
    expect(ui.starts()).toEqual(["times.pass", "times.equationSuccess", "times.promptNext"])
    // After cancel, no pass phase may appear after equationSuccess starts.
    const startSuccess = ui.events.findIndex(
      (e) => e.type === "setStart" && e.setId === "times.equationSuccess",
    )
    const after = ui.events.slice(startSuccess)
    expect(
      after.some((e) => e.type === "phase" && e.setId === "times.pass"),
    ).toBe(false)
    expect(ui.phases()).toContain("times.equationSuccess:speakFact")
    expect(ui.phases()).toContain("times.equationSuccess:release")
    expect(ui.phases()).toContain("times.promptNext:shake")
    expect(ui.starts()).not.toContain("times.setFinale")
  })

  it("complete lock chains setFinale and skips promptNext", async () => {
    const ui = eventLog()
    const motion = createTimesMotion({
      passMs: 5,
      speechPauseMs: 2,
      sleep: sleepStub,
      emit: ui.emit,
    })

    await motion.onLockSuccess({ index: 9, complete: true })
    await motion.system.whenIdle()

    expect(ui.starts()).toEqual(["times.equationSuccess", "times.setFinale"])
    expect(ui.starts()).not.toContain("times.promptNext")
    expect(ui.phases()).toContain("times.setFinale:countdown")
    expect(ui.phases()).toContain("times.setFinale:reveal")
  })

  it("onReset mid-run leaves the system idle with no further emits", async () => {
    const ui = eventLog()
    const motion = createTimesMotion({
      passMs: 100,
      sleep: sleepStub,
      emit: ui.emit,
    })

    void motion.onOpenEquation(4)
    await new Promise((r) => setTimeout(r, 5))
    const countAtReset = ui.events.length
    motion.onReset()
    await motion.system.whenIdle()
    await new Promise((r) => setTimeout(r, 20))

    expect(motion.system.isPlaying()).toBe(false)
    expect(ui.events.length).toBe(countAtReset + 1) // only the cancelled setEnd
    expect(ui.ends().at(-1)).toBe("times.pass:cancelled")
  })
})
