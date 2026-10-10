import { createAnimationSystem } from "./animationSystem"
import type {
  AnimationContext,
  AnimationSetDef,
  AnimationSystem,
  AnimationSystemConfig,
} from "./types"

export type TimesMotionConfig = Omit<AnimationSystemConfig, "sets"> & {
  /** Override or extend built-in set definitions. */
  sets?: AnimationSystemConfig["sets"]
  passMs?: number
  speechPauseMs?: number
}

export type TimesMotion = {
  onOpenEquation(k: number): Promise<void>
  onLockSuccess(input: { index: number; complete: boolean }): Promise<void>
  onReset(): void
  system: AnimationSystem
}

const DEFAULT_PASS_MS = 1680
const DEFAULT_SPEECH_PAUSE_MS = 400

type DataSlot = { current: Record<string, unknown> }

function builtInSets(
  options: { passMs: number; speechPauseMs: number },
  slot: DataSlot,
): Record<string, AnimationSetDef> {
  return {
    "times.pass": {
      kind: "intro",
      async run(ctx) {
        const k = slot.current.k
        if (typeof k !== "number") return
        ctx.emit({ type: "phase", setId: ctx.id, phase: "show", data: { k } })
        if (!ctx.still()) return
        ctx.emit({ type: "phase", setId: ctx.id, phase: "go", data: { k } })
        await ctx.sleep(options.passMs)
        if (!ctx.still()) return
        ctx.emit({ type: "phase", setId: ctx.id, phase: "clear", data: { k } })
      },
    },
    "times.equationSuccess": {
      kind: "celebration",
      async run(ctx) {
        const index = slot.current.index
        if (typeof index !== "number") return
        ctx.emit({
          type: "phase",
          setId: ctx.id,
          phase: "speakFact",
          data: { index },
        })
        await ctx.sleep(options.speechPauseMs)
        if (!ctx.still()) return
        ctx.emit({
          type: "phase",
          setId: ctx.id,
          phase: "release",
          data: { index },
        })
      },
    },
    "times.setFinale": {
      kind: "celebration",
      async run(ctx: AnimationContext) {
        ctx.emit({ type: "phase", setId: ctx.id, phase: "countdown" })
        await ctx.sleep(options.speechPauseMs)
        if (!ctx.still()) return
        ctx.emit({ type: "phase", setId: ctx.id, phase: "reveal" })
      },
    },
    "times.promptNext": {
      kind: "prompt",
      async run(ctx) {
        ctx.emit({ type: "phase", setId: ctx.id, phase: "shake" })
      },
    },
  }
}

export function createTimesMotion(config: TimesMotionConfig = {}): TimesMotion {
  const passMs = config.passMs ?? DEFAULT_PASS_MS
  const speechPauseMs = config.speechPauseMs ?? DEFAULT_SPEECH_PAUSE_MS
  const slot: DataSlot = { current: {} }
  let epoch = 0

  const defaults = builtInSets({ passMs, speechPauseMs }, slot)
  const sets: Record<string, AnimationSetDef> = {
    ...defaults,
    ...config.sets,
  }

  const system = createAnimationSystem({
    sets,
    onConflict: config.onConflict,
    sleep: config.sleep,
    emit: config.emit,
  })

  async function onOpenEquation(k: number): Promise<void> {
    slot.current = { k }
    await system.play("times.pass")
  }

  async function onLockSuccess(input: {
    index: number
    complete: boolean
  }): Promise<void> {
    const myEpoch = epoch
    slot.current = { index: input.index, complete: input.complete }
    await system.replace("times.equationSuccess")
    if (myEpoch !== epoch) return
    if (input.complete) {
      await system.play("times.setFinale")
    } else {
      await system.play("times.promptNext")
    }
  }

  function onReset(): void {
    epoch += 1
    slot.current = {}
    system.cancel()
  }

  return {
    onOpenEquation,
    onLockSuccess,
    onReset,
    system,
  }
}
