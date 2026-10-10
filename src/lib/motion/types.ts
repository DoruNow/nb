export type AnimationKind = "intro" | "celebration" | "prompt"

export type AnimationUiEvent =
  | { type: "phase"; setId: string; phase: string; data?: Record<string, unknown> }
  | { type: "setStart"; setId: string }
  | { type: "setEnd"; setId: string; reason: "finished" | "cancelled" }

export type AnimationContext = {
  id: string
  still(): boolean
  sleep(ms: number): Promise<void>
  emit(event: AnimationUiEvent): void
}

export type AnimationSetDef = {
  kind: AnimationKind
  run: (ctx: AnimationContext) => Promise<void>
}

export type AnimationSystemConfig = {
  sets: Record<string, AnimationSetDef>
  /** Default: "queue" — play() waits behind the active set. */
  onConflict?: "queue" | "replace"
  /** Injected in tests; production uses real timers. */
  sleep?: (ms: number) => Promise<void>
  /** UI / speech / SFX adapter — components subscribe via this. */
  emit?: (event: AnimationUiEvent) => void
}

export type AnimationSystem = {
  play(setId: string): Promise<void>
  /** Cancel active + drain queue, then play immediately. */
  replace(setId: string): Promise<void>
  cancel(): void
  isPlaying(): boolean
  activeId(): string | null
  queuedIds(): string[]
  whenIdle(): Promise<void>
}
