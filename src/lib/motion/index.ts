export { createAnimationSystem } from "./animationSystem"
export { createTimesMotion } from "./timesMotion"
export type { TimesMotion, TimesMotionConfig } from "./timesMotion"
export {
  TIMES_COMBINE_HOLD_MS,
  TIMES_COMBINE_MS,
  TIMES_COMBINE_ROTATE_MS,
  TIMES_COMBINE_SQUISH_MS,
  TIMES_COPIES_ENTER_MS,
  TIMES_K_NUMERAL_GAP_MS,
  TIMES_PASS_MS,
  TIMES_PRODUCT_POP_MS,
  TIMES_RESULT_PASS_MS,
  TIMES_SPEECH_PAUSE_MS,
  createTimesCountSets,
  runTimesCombine,
  runTimesCountdown,
  runTimesPass,
  runTimesPromptNext,
  runTimesResultPass,
  runTimesSetFinale,
  runTimesSpeakFact,
} from "./timesCountLoops"
export type {
  CopiesCombinePhase,
  SpeakingPart,
  TimesLoopHost,
  TimesLoopOptions,
} from "./timesCountLoops"
export type {
  AnimationContext,
  AnimationKind,
  AnimationSetDef,
  AnimationSystem,
  AnimationSystemConfig,
  AnimationUiEvent,
} from "./types"
