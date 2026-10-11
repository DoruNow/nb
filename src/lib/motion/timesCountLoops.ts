import { COUNT_LENGTH, multiple } from "../math"
import { numberblocksAssets } from "../numberblocksSb3"
import {
  cancelSpeech,
  speakNumberName,
  speakOperator,
} from "../speak"
import type { AnimationContext, AnimationSetDef } from "./types"

/** Same defaults as TimesCount.vue */
export const TIMES_PASS_MS = 2400
/** Brief beat between costume exit and the big k numeral entering. */
export const TIMES_K_NUMERAL_GAP_MS = 140
export const TIMES_SPEECH_PAUSE_MS = 400
/** How long the product costume stays in the right-side pass. */
export const TIMES_RESULT_PASS_MS = 2000

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
  setPassingProduct(value: number | null): void
  setProductPassOn(value: boolean): void
  /** Large multiplier numeral that stays after the costume pass. */
  setStageK(value: number | null): void
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
  resultPassMs?: number
  kNumeralGapMs?: number
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
  kNumeralGapMs: number = TIMES_K_NUMERAL_GAP_MS,
) {
  const k = host.getK()
  if (typeof k !== "number") return
  host.setStageK(null)
  host.setPassOn(false)
  host.setPassingK(k)
  await host.nextTick()
  if (!ctx.still()) return
  if (host.prefersReducedMotion()) {
    host.setPassingK(null)
    host.setPassOn(false)
    host.setStageK(k)
    return
  }
  host.setPassOn(true)
  await pause(ctx, passMs)
  if (!ctx.still()) return
  host.setPassingK(null)
  host.setPassOn(false)
  await pause(ctx, kNumeralGapMs)
  if (!ctx.still()) return
  host.setStageK(k)
}

/** Product costume enters from the right while the answer is spoken. */
export async function runTimesResultPass(
  ctx: AnimationContext,
  host: TimesLoopHost,
  product: number,
  resultPassMs: number,
) {
  host.setProductPassOn(false)
  host.setPassingProduct(product)
  await host.nextTick()
  if (!ctx.still()) return
  if (host.prefersReducedMotion()) {
    host.setPassingProduct(null)
    return
  }
  host.setProductPassOn(true)
  await pause(ctx, resultPassMs)
  if (!ctx.still()) return
  host.setPassingProduct(null)
  host.setProductPassOn(false)
}

export async function runTimesSpeakFact(
  ctx: AnimationContext,
  host: TimesLoopHost,
  speechPauseMs: number,
  resultPassMs: number = TIMES_RESULT_PASS_MS,
) {
  const index = host.getLockIndex()
  const step = host.getStep()
  if (typeof index !== "number" || step === null) return

  host.setSpeakingIndex(index)
  host.setSpeakingPart(null)
  host.setShakeBox(false)
  host.setHoldReleased(false)
  host.setPassingProduct(null)
  host.setProductPassOn(false)

  if (!host.muteAudio) {
    void numberblocksAssets.playSound("pop")
    cancelSpeech()
    numberblocksAssets.stopAllSounds()
  }

  const k = index + 1
  host.setPassingK(null)
  host.setPassOn(false)
  host.setStageK(k)
  const product = multiple(step, k)
  const parts: Array<{ key: SpeakingPart; run: () => Promise<void> }> = [
    { key: "k", run: () => sayNumber(host, k, speechPauseMs) },
    { key: "times", run: () => sayOp(host, "times", speechPauseMs) },
    { key: "step", run: () => sayNumber(host, step, speechPauseMs) },
    { key: "equals", run: () => sayOp(host, "equals", speechPauseMs) },
    {
      key: "product",
      run: async () => {
        await Promise.all([
          sayNumber(host, product, speechPauseMs),
          runTimesResultPass(ctx, host, product, resultPassMs),
        ])
      },
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
  host.setPassingProduct(null)
  host.setProductPassOn(false)
}

export async function runTimesCountdown(
  ctx: AnimationContext,
  host: TimesLoopHost,
  speechPauseMs: number,
  resultPassMs: number = TIMES_RESULT_PASS_MS,
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
    const product = multiple(step, index + 1)
    await Promise.all([
      sayNumber(host, product, speechPauseMs),
      runTimesResultPass(ctx, host, product, resultPassMs),
    ])
    if (!ctx.still()) return
    if (index < length - 1) {
      await pause(ctx, speechPauseMs)
      if (!ctx.still()) return
    }
  }
  host.setCountdownIndex(null)
  host.setSpeakingIndex(null)
  host.setSpeakingPart(null)
  host.setPassingProduct(null)
  host.setProductPassOn(false)
  host.setStageK(null)
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
  resultPassMs: number = TIMES_RESULT_PASS_MS,
) {
  if (host.getJustLockedIndex() !== null) host.releaseAnswer()
  await runTimesCountdown(ctx, host, speechPauseMs, resultPassMs)
  if (!ctx.still()) return
  // Show the finished rows board and leave it up until the user clears.
  host.setRevealedRows(true)
  await host.nextTick()
  if (!ctx.still()) return
  host.measure()
}

/** Same named sets TimesCount wires into createTimesMotion. */
export function createTimesCountSets(
  host: TimesLoopHost,
  options: TimesLoopOptions = {},
): Record<string, AnimationSetDef> {
  const passMs = options.passMs ?? TIMES_PASS_MS
  const speechPauseMs = options.speechPauseMs ?? TIMES_SPEECH_PAUSE_MS
  const resultPassMs = options.resultPassMs ?? TIMES_RESULT_PASS_MS
  const kNumeralGapMs = options.kNumeralGapMs ?? TIMES_K_NUMERAL_GAP_MS

  return {
    "times.pass": {
      kind: "intro",
      run: (ctx) => runTimesPass(ctx, host, passMs, kNumeralGapMs),
    },
    "times.equationSuccess": {
      kind: "celebration",
      run: (ctx) => runTimesSpeakFact(ctx, host, speechPauseMs, resultPassMs),
    },
    "times.setFinale": {
      kind: "celebration",
      run: (ctx) => runTimesSetFinale(ctx, host, speechPauseMs, resultPassMs),
    },
    "times.promptNext": {
      kind: "prompt",
      run: (ctx) => runTimesPromptNext(ctx, host),
    },
  }
}
