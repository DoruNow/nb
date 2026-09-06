export type SpokenOperator = "plus" | "minus" | "equals"

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

/**
 * The .sb3 has no “plus” / “minus” / “equals” clips — only number names.
 * Browser speech fills those three words so the equation can be read in full.
 */
export function speakOperator(word: SpokenOperator): Promise<void> {
  const synth = synthesis()
  if (!synth) return Promise.resolve()

  return new Promise((resolve) => {
    const utter = new SpeechSynthesisUtterance(word)
    utter.lang = "en-GB"
    utter.rate = 1.05
    utter.pitch = 1.05
    const voice = pickVoice(synth)
    if (voice) utter.voice = voice
    const finish = () => resolve()
    utter.onend = finish
    utter.onerror = finish
    try {
      synth.speak(utter)
    } catch {
      finish()
    }
  })
}
