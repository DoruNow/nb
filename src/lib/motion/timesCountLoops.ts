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
/** @deprecated Pass animation removed; kept for callers that still pass the option. */
export const TIMES_K_NUMERAL_GAP_MS = 140
export const TIMES_SPEECH_PAUSE_MS = 400
/** Step copies slide in from the right (fast→slow ease-out). */
export const TIMES_COPIES_ENTER_MS = 720
/** Squish copies together as-is (gap→0), limbs already dropped. */
export const TIMES_COMBINE_SQUISH_MS = 420
/** Then rotate / repack to match the product silhouette. */
export const TIMES_COMBINE_ROTATE_MS = 480
/** Brief beat after rotate before the product pops in. */
export const TIMES_COMBINE_HOLD_MS = 200
/** @deprecated Prefer TIMES_COMBINE_SQUISH_MS. */
export const TIMES_COMBINE_MS = TIMES_COMBINE_SQUISH_MS
/** Product overshoot pop duration. */
export const TIMES_PRODUCT_POP_MS = 520
/** @deprecated Right-side product pass removed; alias for combine+hold+pop. */
export const TIMES_RESULT_PASS_MS =
  TIMES_COMBINE_SQUISH_MS +
  TIMES_COMBINE_ROTATE_MS +
  TIMES_COMBINE_HOLD_MS +
  TIMES_PRODUCT_POP_MS

export type SpeakingPart = "k" | "times" | "step" | "equals" | "product"

/**
 * Bottom-row copies combine:
 * squish (as-is, shapes only) → rotate to product orientation → hold.
 */
export type CopiesCombinePhase = null | "squish" | "rotate" | "hold"

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

  /** Multiplier k in the factors band (no left-side pass). */
  setStageK(value: number | null): void
  /** Product costume in the copies band after the combine. */
  setStageProduct(value: number | null): void
  setCopiesCombinePhase(value: CopiesCombinePhase): void
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
  combineMs?: number
  combineSquishMs?: number
  combineRotateMs?: number
  combineHoldMs?: number
  productPopMs?: number
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

/** Show the multiplier in the factors band — no left-to-right costume pass. */
export async function runTimesPass(
  ctx: AnimationContext,
  host: TimesLoopHost,
  _passMs?: number,
  _kNumeralGapMs?: number,
) {
  const k = host.getK()
  if (typeof k !== "number") return
  host.setStageProduct(null)
  host.setCopiesCombinePhase(null)
  host.setStageK(k)
  await host.nextTick()
  if (!ctx.still()) return
}

/**
 * Squish → rotate to product orientation → hold → pop the product.
 * Replaces the old right-side product pass.
 */
export async function runTimesCombine(
  ctx: AnimationContext,
  host: TimesLoopHost,
  product: number,
  squishMs: number,
  rotateMs: number,
  holdMs: number,
  popMs: number,
) {
  if (host.prefersReducedMotion()) {
    host.setCopiesCombinePhase(null)
    host.setStageProduct(product)
    await host.nextTick()
    return
  }
  host.setStageProduct(null)
  host.setCopiesCombinePhase("squish")
  await host.nextTick()
  if (!ctx.still()) return
  await pause(ctx, squishMs)
  if (!ctx.still()) return
  host.setCopiesCombinePhase("rotate")
  await host.nextTick()
  if (!ctx.still()) return
  await pause(ctx, rotateMs)
  if (!ctx.still()) return
  host.setCopiesCombinePhase("hold")
  await pause(ctx, holdMs)
  if (!ctx.still()) return
  host.setCopiesCombinePhase(null)
  host.setStageProduct(product)
  await host.nextTick()
  if (!ctx.still()) return
  await pause(ctx, popMs)
}

/** @deprecated Use runTimesCombine. */
export async function runTimesResultPass(
  ctx: AnimationContext,
  host: TimesLoopHost,
  product: number,
  _resultPassMs: number,
) {
  await runTimesCombine(
    ctx,
    host,
    product,
    TIMES_COMBINE_SQUISH_MS,
    TIMES_COMBINE_ROTATE_MS,
    TIMES_COMBINE_HOLD_MS,
    TIMES_PRODUCT_POP_MS,
  )
}

export async function runTimesSpeakFact(
  ctx: AnimationContext,
  host: TimesLoopHost,
  speechPauseMs: number,
  squishMs: number = TIMES_COMBINE_SQUISH_MS,
  rotateMs: number = TIMES_COMBINE_ROTATE_MS,
  holdMs: number = TIMES_COMBINE_HOLD_MS,
  popMs: number = TIMES_PRODUCT_POP_MS,
) {
  const index = host.getLockIndex()
  const step = host.getStep()
  if (typeof index !== "number" || step === null) return

  host.setSpeakingIndex(index)
  host.setSpeakingPart(null)
  host.setShakeBox(false)
  host.setHoldReleased(false)
  host.setStageProduct(null)
  host.setCopiesCombinePhase(null)

  if (!host.muteAudio) {
    void numberblocksAssets.playSound("pop")
    cancelSpeech()
    numberblocksAssets.stopAllSounds()
  }

  const k = index + 1
  host.setStageK(k)
  const product = multiple(step, k)
  const parts: Array<{ key: SpeakingPart; run: () => Promise<void> }> = [
    { key: "k", run: () => sayNumber(host, k, speechPauseMs) },
    { key: "times", run: () => sayOp(host, "times", speechPauseMs) },
    { key: "step", run: () => sayNumber(host, step, speechPauseMs) },
    {
      key: "equals",
      run: async () => {
        if (!host.prefersReducedMotion()) {
          host.setCopiesCombinePhase("squish")
          await host.nextTick()
        }
        await Promise.all([
          sayOp(host, "equals", speechPauseMs),
          host.prefersReducedMotion()
            ? Promise.resolve()
            : pause(ctx, squishMs),
        ])
      },
    },
    {
      key: "product",
      run: async () => {
        if (host.prefersReducedMotion()) {
          host.setCopiesCombinePhase(null)
          host.setStageProduct(product)
          await sayNumber(host, product, speechPauseMs)
          return
        }
        host.setCopiesCombinePhase("rotate")
        await host.nextTick()
        if (!ctx.still()) return
        await pause(ctx, rotateMs)
        if (!ctx.still()) return
        host.setCopiesCombinePhase("hold")
        await pause(ctx, holdMs)
        if (!ctx.still()) return
        host.setCopiesCombinePhase(null)
        host.setStageProduct(product)
        await host.nextTick()
        if (!ctx.still()) return
        await Promise.all([
          sayNumber(host, product, speechPauseMs),
          pause(ctx, popMs),
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
  host.setCopiesCombinePhase(null)
  host.setStageProduct(null)
}

export async function runTimesCountdown(
  ctx: AnimationContext,
  host: TimesLoopHost,
  speechPauseMs: number,
) {
  const step = host.getStep()
  if (step === null) return
  const length = host.finaleLength ?? COUNT_LENGTH
  host.setStageProduct(null)
  host.setCopiesCombinePhase(null)
  host.setStageK(null)
  for (let index = 0; index < length; index++) {
    if (!ctx.still()) return
    host.setCountdownIndex(index)
    host.setSpeakingIndex(index)
    host.setSpeakingPart("product")
    await host.nextTick()
    host.measure()
    const product = multiple(step, index + 1)
    await sayNumber(host, product, speechPauseMs)
    if (!ctx.still()) return
    if (index < length - 1) {
      await pause(ctx, speechPauseMs)
      if (!ctx.still()) return
    }
  }
  host.setCountdownIndex(null)
  host.setSpeakingIndex(null)
  host.setSpeakingPart(null)
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
) {
  if (host.getJustLockedIndex() !== null) host.releaseAnswer()
  await runTimesCountdown(ctx, host, speechPauseMs)
  if (!ctx.still()) return
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
  const speechPauseMs = options.speechPauseMs ?? TIMES_SPEECH_PAUSE_MS
  const combineSquishMs =
    options.combineSquishMs ?? options.combineMs ?? TIMES_COMBINE_SQUISH_MS
  const combineRotateMs = options.combineRotateMs ?? TIMES_COMBINE_ROTATE_MS
  const combineHoldMs = options.combineHoldMs ?? TIMES_COMBINE_HOLD_MS
  const productPopMs = options.productPopMs ?? TIMES_PRODUCT_POP_MS

  return {
    "times.pass": {
      kind: "intro",
      run: (ctx) => runTimesPass(ctx, host),
    },
    "times.equationSuccess": {
      kind: "celebration",
      run: (ctx) =>
        runTimesSpeakFact(
          ctx,
          host,
          speechPauseMs,
          combineSquishMs,
          combineRotateMs,
          combineHoldMs,
          productPopMs,
        ),
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
