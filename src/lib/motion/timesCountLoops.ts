import { COUNT_LENGTH, multiple } from "../math"
import { numberblocksAssets } from "../numberblocksSb3"
import {
  cancelSpeech,
  speakNumberName,
  speakOperator,
} from "../speak"
import type { AnimationContext, AnimationSetDef } from "./types"

/** Same defaults as TimesCount.vue */
export const TIMES_PASS_MS = 1680
export const TIMES_SPEECH_PAUSE_MS = 400

export type SpeakingPart = "k" | "times" | "step" | "equals" | "product"

/**
 * UI / IO surface the times animation loops need.
 * TimesCount and the /e2e harness both implement this.
 */
export type TimesLoopHost = {
  getStep(): number | null
  getK(): number | undefined
  getLockIndex(): number | undefined
  isComplete(): boolean
  isRevealed(): boolean
  getActiveField(): "step" | "product"
  getJustLockedIndex(): number | null

  setPassingK(value: number | null): void
  setPassOn(value: boolean): void
  setSpeakingIndex(value: number | null): void
  setSpeakingPart(value: SpeakingPart | null): void
  setCountdownIndex(value: number | null): void
  setShakeBox(value: boolean): void
  setHoldReleased(value: boolean): void
  setRevealedRows(value: boolean): void

  releaseAnswer(): void
  focusProduct(): void
  measure(): void
  nextTick(): Promise<void>
  prefersReducedMotion(): boolean

  /** When true, skip TTS/SFX and use short pauses instead (e2e speed). */
  muteAudio?: boolean
  /** Override how many products the finale counts (default COUNT_LENGTH). */
  finaleLength?: number
}

export type TimesLoopOptions = {
  passMs?: number
  speechPauseMs?: number
}

async function pause(ctx: AnimationContext, ms: number) {
  await ctx.sleep(ms)
}

async function sayNumber(host: TimesLoopHost, value: number, pauseMs: number) {
  if (host.muteAudio) {
    await new Promise<void>((r) => setTimeout(r, Math.min(80, pauseMs)))
    return
  }
  await speakNumberName(value)
}

async function sayOp(host: TimesLoopHost, op: "times" | "equals", pauseMs: number) {
  if (host.muteAudio) {
    await new Promise<void>((r) => setTimeout(r, Math.min(60, pauseMs)))
    return
  }
  await speakOperator(op)
}

export async function runTimesPass(
  ctx: AnimationContext,
  host: TimesLoopHost,
  passMs: number,
) {
  const k = host.getK()
  if (typeof k !== "number") return
  host.setPassOn(false)
  host.setPassingK(k)
  await host.nextTick()
  if (!ctx.still()) return
  if (host.prefersReducedMotion()) {
    host.setPassingK(null)
    return
  }
  host.setPassOn(true)
  await pause(ctx, passMs)
  if (!ctx.still()) return
  host.setPassingK(null)
  host.setPassOn(false)
}

export async function runTimesSpeakFact(
  ctx: AnimationContext,
  host: TimesLoopHost,
  speechPauseMs: number,
) {
  const index = host.getLockIndex()
  const step = host.getStep()
  if (typeof index !== "number" || step === null) return

  host.setSpeakingIndex(index)
  host.setSpeakingPart(null)
  host.setShakeBox(false)
  host.setHoldReleased(false)

  if (!host.muteAudio) {
    void numberblocksAssets.playSound("pop")
    cancelSpeech()
    numberblocksAssets.stopAllSounds()
  }

  const k = index + 1
  const parts: Array<{ key: SpeakingPart; run: () => Promise<void> }> = [
    { key: "k", run: () => sayNumber(host, k, speechPauseMs) },
    { key: "times", run: () => sayOp(host, "times", speechPauseMs) },
    { key: "step", run: () => sayNumber(host, step, speechPauseMs) },
    { key: "equals", run: () => sayOp(host, "equals", speechPauseMs) },
    {
      key: "product",
      run: () => sayNumber(host, multiple(step, k), speechPauseMs),
    },
  ]

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (!part) continue
    if (!ctx.still()) return
    host.setSpeakingPart(part.key)
    await part.run()
    if (!ctx.still()) return
    if (i < parts.length - 1) {
      await pause(ctx, speechPauseMs)
      if (!ctx.still()) return
    }
  }

  host.setSpeakingPart(null)
  host.setSpeakingIndex(null)
}

export async function runTimesCountdown(
  ctx: AnimationContext,
  host: TimesLoopHost,
  speechPauseMs: number,
) {
  const step = host.getStep()
  if (step === null) return
  const length = host.finaleLength ?? COUNT_LENGTH
  for (let index = 0; index < length; index++) {
    if (!ctx.still()) return
    host.setCountdownIndex(index)
    host.setSpeakingIndex(index)
    host.setSpeakingPart("product")
    await host.nextTick()
    host.measure()
    await sayNumber(host, multiple(step, index + 1), speechPauseMs)
    if (!ctx.still()) return
    if (index < length - 1) {
      await pause(ctx, speechPauseMs)
      if (!ctx.still()) return
    }
  }
  host.setCountdownIndex(null)
  host.setSpeakingIndex(null)
  host.setSpeakingPart(null)
}

export async function runTimesPromptNext(
  ctx: AnimationContext,
  host: TimesLoopHost,
) {
  if (host.getStep() === null || host.isComplete() || host.isRevealed()) return
  if (host.getActiveField() === "step") return
  if (!ctx.still()) return
  if (host.getJustLockedIndex() !== null) host.releaseAnswer()
  host.focusProduct()
  await host.nextTick()
  if (!ctx.still()) return
  if (host.prefersReducedMotion()) return
  host.setShakeBox(false)
  await host.nextTick()
  if (!ctx.still()) return
  host.setShakeBox(true)
}

export async function runTimesSetFinale(
  ctx: AnimationContext,
  host: TimesLoopHost,
  speechPauseMs: number,
) {
  if (host.getJustLockedIndex() !== null) host.releaseAnswer()
  await runTimesCountdown(ctx, host, speechPauseMs)
  if (!ctx.still()) return
  host.setRevealedRows(true)
  await host.nextTick()
  host.measure()
}

/** Same named sets TimesCount wires into createTimesMotion. */
export function createTimesCountSets(
  host: TimesLoopHost,
  options: TimesLoopOptions = {},
): Record<string, AnimationSetDef> {
  const passMs = options.passMs ?? TIMES_PASS_MS
  const speechPauseMs = options.speechPauseMs ?? TIMES_SPEECH_PAUSE_MS

  return {
    "times.pass": {
      kind: "intro",
      run: (ctx) => runTimesPass(ctx, host, passMs),
    },
    "times.equationSuccess": {
      kind: "celebration",
      run: (ctx) => runTimesSpeakFact(ctx, host, speechPauseMs),
    },
    "times.setFinale": {
      kind: "celebration",
      run: (ctx) => runTimesSetFinale(ctx, host, speechPauseMs),
    },
    "times.promptNext": {
      kind: "prompt",
      run: (ctx) => runTimesPromptNext(ctx, host),
    },
  }
}
