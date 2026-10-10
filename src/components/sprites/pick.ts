export type SpritePick =
  | { kind: "folder"; path: string }
  | { kind: "target"; name: string }
  | { kind: "costume"; target: string; costume: string }
  | { kind: "sound"; target: string; sound: string }
  | { kind: "monitors" }

export function pickKey(pick: SpritePick | null): string {
  if (!pick) return ""
  switch (pick.kind) {
    case "folder":
      return `folder\0${pick.path}`
    case "target":
      return `target\0${pick.name}`
    case "costume":
      return `costume\0${pick.target}\0${pick.costume}`
    case "sound":
      return `sound\0${pick.target}\0${pick.sound}`
    case "monitors":
      return "monitors"
  }
}
