export { createAnimationSystem } from "./animationSystem"
export { createTimesMotion } from "./timesMotion"
export type { TimesMotion, TimesMotionConfig } from "./timesMotion"
export {
  TIMES_PASS_MS,
  TIMES_SPEECH_PAUSE_MS,
  createTimesCountSets,
  runTimesCountdown,
  runTimesPass,
  runTimesPromptNext,
  runTimesSetFinale,
  runTimesSpeakFact,
} from "./timesCountLoops"
export type { SpeakingPart, TimesLoopHost, TimesLoopOptions } from "./timesCountLoops"
export type {
  AnimationContext,
  AnimationKind,
  AnimationSetDef,
  AnimationSystem,
  AnimationSystemConfig,
  AnimationUiEvent,
} from "./types"
