import { ref } from "vue"
import { numberblocksAssets } from "./numberblocksSb3"

export type SpokenOperator =
  | "plus"
  | "minus"
  | "equals"
  | "times"
  | "divided by"

/** `"nl"` / `"en"` presets, or any BCP-47 tag. */
export type SpeechLanguage = string

export type SpeechPreset = "nl" | "en"

export type SpeechLanguageOption = {
  tag: string
  label: string
}

const STORAGE_KEY = "nb-speech-lang"
const DEFAULT_LANGUAGE: SpeechLanguage = "nl"

/** Always offered under “…”, even when the OS has no matching TTS voice yet. */
const CURATED_OTHER_LANGUAGES = [
  "fr-FR",
  "de-DE",
  "es-ES",
  "it-IT",
  "pt-PT",
  "pl-PL",
  "uk-UA",
  "tr-TR",
  "sv-SE",
  "da-DK",
  "nb-NO",
  "fi-FI",
  "hu-HU",
  "cs-CZ",
  "el-GR",
  "ar-SA",
  "zh-CN",
  "ja-JP",
  "ko-KR",
] as const

type OperatorPhrases = Record<SpokenOperator, string>

/** Spoken operator words for TTS. Pack clips are English-only numbers. */
const OPERATOR_TEXT: Record<string, OperatorPhrases> = {
  en: {
    plus: "plus",
    minus: "minus",
    equals: "equals",
    times: "times",
    "divided by": "divided by",
  },
  nl: {
    plus: "plus",
    minus: "min",
    equals: "is",
    times: "keer",
    "divided by": "gedeeld door",
  },
  it: {
    plus: "più",
    minus: "meno",
    equals: "uguale",
    times: "per",
    "divided by": "diviso",
  },
  fr: {
    plus: "plus",
    minus: "moins",
    equals: "égal",
    times: "fois",
    "divided by": "divisé par",
  },
  de: {
    plus: "plus",
    minus: "minus",
    equals: "ist gleich",
    times: "mal",
    "divided by": "geteilt durch",
  },
  es: {
    plus: "más",
    minus: "menos",
    equals: "igual",
    times: "por",
    "divided by": "dividido entre",
  },
  pt: {
    plus: "mais",
    minus: "menos",
    equals: "igual",
    times: "vezes",
    "divided by": "dividido por",
  },
  pl: {
    plus: "plus",
    minus: "minus",
    equals: "równa się",
    times: "razy",
    "divided by": "podzielone przez",
  },
  uk: {
    plus: "плюс",
    minus: "мінус",
    equals: "дорівнює",
    times: "множити на",
    "divided by": "поділити на",
  },
  tr: {
    plus: "artı",
    minus: "eksi",
    equals: "eşittir",
    times: "çarpı",
    "divided by": "bölü",
  },
  sv: {
    plus: "plus",
    minus: "minus",
    equals: "är lika med",
    times: "gånger",
    "divided by": "delat med",
  },
  da: {
    plus: "plus",
    minus: "minus",
    equals: "er lig med",
    times: "gange",
    "divided by": "divideret med",
  },
  nb: {
    plus: "pluss",
    minus: "minus",
    equals: "er lik",
    times: "ganger",
    "divided by": "delt på",
  },
  fi: {
    plus: "plus",
    minus: "miinus",
    equals: "on yhtä kuin",
    times: "kertaa",
    "divided by": "jaettuna",
  },
  hu: {
    plus: "plusz",
    minus: "mínusz",
    equals: "egyenlő",
    times: "szor",
    "divided by": "osztva",
  },
  cs: {
    plus: "plus",
    minus: "mínus",
    equals: "rovná se",
    times: "krát",
    "divided by": "děleno",
  },
  el: {
    plus: "συν",
    minus: "πλην",
    equals: "ίσον",
    times: "επί",
    "divided by": "διά",
  },
  ar: {
    plus: "زائد",
    minus: "ناقص",
    equals: "يساوي",
    times: "في",
    "divided by": "مقسوم على",
  },
  zh: {
    plus: "加",
    minus: "减",
    equals: "等于",
    times: "乘",
    "divided by": "除以",
  },
  ja: {
    plus: "足す",
    minus: "引く",
    equals: "イコール",
    times: "掛ける",
    "divided by": "割る",
  },
  ko: {
    plus: "더하기",
    minus: "빼기",
    equals: "는",
    times: "곱하기",
    "divided by": "나누기",
  },
}

export type UiPhraseKey = "chooseStep" | "pressEnter"

type UiPhrases = Record<UiPhraseKey, string>

/** On-screen copy that follows the speech language. */
const UI_TEXT: Record<string, UiPhrases> = {
  en: {
    chooseStep: "Choose a step",
    pressEnter: "Press Enter",
  },
  nl: {
    chooseStep: "Kies een stap",
    pressEnter: "Druk op Enter",
  },
  it: {
    chooseStep: "Scegli un passo",
    pressEnter: "Premi Invio",
  },
  fr: {
    chooseStep: "Choisis un pas",
    pressEnter: "Appuie sur Entrée",
  },
  de: {
    chooseStep: "Wähle einen Schritt",
    pressEnter: "Drück Enter",
  },
  es: {
    chooseStep: "Elige un paso",
    pressEnter: "Pulsa Intro",
  },
  pt: {
    chooseStep: "Escolhe um passo",
    pressEnter: "Prime Enter",
  },
  pl: {
    chooseStep: "Wybierz krok",
    pressEnter: "Naciśnij Enter",
  },
  uk: {
    chooseStep: "Обери крок",
    pressEnter: "Натисни Enter",
  },
  tr: {
    chooseStep: "Bir adım seç",
    pressEnter: "Enter'a bas",
  },
  sv: {
    chooseStep: "Välj ett steg",
    pressEnter: "Tryck på Enter",
  },
  da: {
    chooseStep: "Vælg et trin",
    pressEnter: "Tryk på Enter",
  },
  nb: {
    chooseStep: "Velg et steg",
    pressEnter: "Trykk Enter",
  },
  fi: {
    chooseStep: "Valitse askel",
    pressEnter: "Paina Enter",
  },
  hu: {
    chooseStep: "Válassz egy lépést",
    pressEnter: "Nyomd meg az Entert",
  },
  cs: {
    chooseStep: "Vyber krok",
    pressEnter: "Stiskni Enter",
  },
  el: {
    chooseStep: "Διάλεξε ένα βήμα",
    pressEnter: "Πάτα Enter",
  },
  ar: {
    chooseStep: "اختر خطوة",
    pressEnter: "اضغط Enter",
  },
  zh: {
    chooseStep: "选一个步长",
    pressEnter: "按回车",
  },
  ja: {
    chooseStep: "いくつずつ？",
    pressEnter: "Enterを押して",
  },
  ko: {
    chooseStep: "몇씩 셀까요?",
    pressEnter: "Enter를 눌러",
  },
}

function readStoredLanguage(): SpeechLanguage {
  try {
    const value = localStorage.getItem(STORAGE_KEY)?.trim()
    if (value) {
      // Romanian preset was removed — don't keep a broken saved choice.
      if (value === "ro" || value.toLowerCase().startsWith("ro")) {
        localStorage.setItem(STORAGE_KEY, DEFAULT_LANGUAGE)
        return DEFAULT_LANGUAGE
      }
      return value
    }
  } catch {
    // private mode / blocked storage
  }
  return DEFAULT_LANGUAGE
}

export const speechLanguage = ref<SpeechLanguage>(
  typeof window !== "undefined" ? readStoredLanguage() : DEFAULT_LANGUAGE,
)

export const speechLanguageOptions = ref<SpeechLanguageOption[]>([])

export function isPresetSpeechLanguage(
  language: SpeechLanguage,
): language is SpeechPreset {
  return language === "en" || language === "nl"
}

export function isOtherSpeechLanguage(language: SpeechLanguage): boolean {
  return !isPresetSpeechLanguage(language)
}

function languageLabel(tag: string): string {
  try {
    const names = new Intl.DisplayNames(["nl", "en"], { type: "language" })
    const label = names.of(tag) ?? names.of(tag.split("-")[0] ?? tag)
    if (label) return `${label} (${tag})`
  } catch {
    // Intl.DisplayNames unavailable
  }
  return tag
}

export function refreshSpeechLanguageOptions(): void {
  const byTag = new Map<string, string>()

  for (const tag of CURATED_OTHER_LANGUAGES) {
    byTag.set(tag, languageLabel(tag))
  }

  const synth = synthesis()
  if (synth) {
    for (const voice of synth.getVoices()) {
      const tag = voice.lang?.trim()
      if (!tag || byTag.has(tag)) continue
      // Presets already have their own buttons.
      if (isPresetSpeechLanguage(tag) || isPresetSpeechLanguage(languageBase(tag))) {
        continue
      }
      byTag.set(tag, languageLabel(tag))
    }
  }

  const current = speechLanguage.value
  if (current && isOtherSpeechLanguage(current) && !byTag.has(current)) {
    byTag.set(current, languageLabel(current))
  }

  speechLanguageOptions.value = [...byTag.entries()]
    .map(([tag, label]) => ({ tag, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "nl"))
}

export function setSpeechLanguage(language: SpeechLanguage): void {
  const next = language.trim()
  if (!next || speechLanguage.value === next) return
  speechLanguage.value = next
  try {
    localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // private mode / blocked storage
  }
  cancelSpeech()
  numberblocksAssets.stopAllSounds()
}

export function canSpeakNumber(value: number): boolean {
  return Number.isFinite(value)
}

function synthesis(): SpeechSynthesis | null {
  return typeof window !== "undefined" && "speechSynthesis" in window
    ? window.speechSynthesis
    : null
}

function localeFor(language: SpeechLanguage): string {
  if (language === "nl") return "nl-NL"
  if (language === "en") return "en-GB"
  return language
}

function languageBase(language: SpeechLanguage): string {
  return language.split("-")[0]?.toLowerCase() ?? language.toLowerCase()
}

function pickVoice(
  synth: SpeechSynthesis,
  language: SpeechLanguage,
): SpeechSynthesisVoice | null {
  const voices = synth.getVoices()
  const locale = localeFor(language)
  const base = languageBase(locale)

  return (
    voices.find((voice) => voice.lang === locale) ??
    voices.find((voice) => voice.lang.startsWith(`${locale}-`)) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(base)) ??
    null
  )
}

function operatorPhrase(
  word: SpokenOperator,
  language: SpeechLanguage,
): string {
  const phrases = OPERATOR_TEXT[languageBase(language)] ?? OPERATOR_TEXT.en
  return phrases[word]
}

export function uiPhrase(key: UiPhraseKey): string {
  const phrases = UI_TEXT[languageBase(speechLanguage.value)] ?? UI_TEXT.en
  return phrases[key]
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

async function speakText(text: string, timeoutMs = 4000): Promise<void> {
  const synth = synthesis()
  if (!synth) return

  const language = speechLanguage.value
  synth.cancel()
  // Chrome silently drops the next speak() if it follows cancel() immediately.
  await wait(60)

  await new Promise<void>((resolve) => {
    const utter = new SpeechSynthesisUtterance(text)
    heldUtterance = utter
    utter.lang = localeFor(language)
    utter.rate = 1
    utter.pitch = 1.05
    const voice = pickVoice(synth, language)
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
    const timer = setTimeout(finish, timeoutMs)
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

/**
 * Operators always go through TTS in the active language.
 * Only the English number pack is used — never for signs.
 */
export async function speakOperator(word: SpokenOperator): Promise<void> {
  await speakText(operatorPhrase(word, speechLanguage.value))
}

/**
 * English preset only: try Numberblocks pack clips (n0–n100).
 * Every other language (and missing clips) uses TTS.
 */
export async function speakNumberName(value: number): Promise<void> {
  if (!Number.isFinite(value)) return

  if (speechLanguage.value === "en") {
    const played = await numberblocksAssets.playNumberName(value)
    if (played) return
  }

  const text = String(value)
  await speakText(text, Math.max(4000, text.length * 450))
}
