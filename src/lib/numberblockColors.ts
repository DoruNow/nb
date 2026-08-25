/** Primary glow/tint for each Numberblock, used on equation slots. */
export const NUMBERBLOCK_GLOW: Record<number, string> = {
  0: "#8d8d8d",
  1: "#e23b32",
  2: "#ef8a2a",
  3: "#8b4fcf",
  4: "#3cb44a",
  5: "#4eb8e8",
  6: "#3d5bd6",
  7: "#e8b020",
  8: "#e86aa8",
  9: "#6b6b6b",
  10: "#e23b32",
}

export function glowFor(value: number | null): string | undefined {
  if (value === null) return undefined
  return NUMBERBLOCK_GLOW[value] ?? NUMBERBLOCK_GLOW[value % 10] ?? "#6b7cff"
}
