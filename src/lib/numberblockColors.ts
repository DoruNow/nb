/** Primary glow/tint for each Numberblock, used on equation slots. */
export const NUMBERBLOCK_GLOW: Record<number, string> = {
  0: "#8d8d8d",
  1: "#e23b32",
  2: "#ef8a2a",
  3: "#f2c01e",
  4: "#3cb44a",
  5: "#3aa8e0",
  6: "#3d4fd6",
  7: "#e8b020",
  8: "#e86aa8",
  9: "#6b6b6b",
  10: "#e23b32",
}

const SEVEN_RAINBOW =
  "linear-gradient(90deg, #e23b32, #ef8a2a, #f2c01e, #3cb44a, #3aa8e0, #3d4fd6, #8b4fcf)"

const NINE_GREYS =
  "linear-gradient(90deg, #c8c8c8 0%, #7a7a7a 48%, #3f3f3f 100%)"

export function glowFor(value: number | null): string | undefined {
  if (value === null) return undefined
  return NUMBERBLOCK_GLOW[value] ?? NUMBERBLOCK_GLOW[value % 10] ?? "#6b7cff"
}

/** How to paint a numeral in Numberblock colours (Seven is rainbow, Nine is three greys). */
export function paintClass(value: number | null): string {
  if (value === 7) return "nb-paint nb-rainbow"
  if (value === 9) return "nb-paint nb-greys"
  return "nb-paint"
}

export function paintStyle(value: number | null): Record<string, string> {
  if (value === 7) return { backgroundImage: SEVEN_RAINBOW }
  if (value === 9) return { backgroundImage: NINE_GREYS }
  const color = glowFor(value)
  return color ? { color } : {}
}
