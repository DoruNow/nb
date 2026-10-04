export type SpokenOperator =
  | "plus"
  | "minus"
  | "equals"
  | "times"
  | "divided by"

/** The Scratch pack has n0–n100 (and place-value clips). Names above 100 are broken. */
export const MAX_SPOKEN_NUMBER = 100

export function canSpeakNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= MAX_SPOKEN_NUMBER
}

function synthesis(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis
    : null
}

function pickVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = synth.getVoices()
  return (
    voices.find((voice) => voice.lang === "en-GB") ??
    voices.find((voice) => voice.lang.startsWith("en-GB")) ??
    voices.find((voice) => voice.lang.startsWith("en")) ??
    null
  )
}

/** Prime speech on a user gesture so the first “plus” is not dropped. */
export function unlockSpeech(): void {
  const synth = synthesis()
  if (!synth) return
  try {
    const utter = new SpeechSynthesisUtterance("")
    utter.volume = 0
    synth.speak(utter)
    synth.cancel()
  } catch {
    // Some browsers reject a zero-length utterance; unlocking is best-effort.
  }
}

export function cancelSpeech(): void {
  synthesis()?.cancel()
}

/** Chrome drops `onend` if the utterance is garbage-collected. */
let heldUtterance: SpeechSynthesisUtterance | null = null

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * The .sb3 has no “plus” / “minus” / “equals” / “times” / “divided by” clips — only number names.
 * Browser speech fills those words so the equation can be read in full.
 */
export async function speakOperator(word: SpokenOperator): Promise<void> {
  const synth = synthesis()
  if (!synth) return

  synth.cancel()
  // Chrome silently drops the next speak() if it follows cancel() immediately.
  await wait(60)

  await new Promise<void>((resolve) => {
    const utter = new SpeechSynthesisUtterance(word)
    heldUtterance = utter
    utter.lang = "en-GB"
    utter.rate = 1
    utter.pitch = 1.05
    const voice = pickVoice(synth)
    if (voice) utter.voice = voice

    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (heldUtterance === utter) heldUtterance = null
      resolve()
    }
    // Safety only — do not treat this as the spoken duration.
    const timer = setTimeout(finish, 4000)
    utter.onend = finish
    utter.onerror = finish
    try {
      if (synth.paused) synth.resume()
      synth.speak(utter)
    } catch {
      finish()
    }
  })
}
