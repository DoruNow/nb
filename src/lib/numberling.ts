/**
 * Numberling glyphs from the Scratch digit sprites.
 * Source of truth: `Digits//Multiplier Ones` costumes `n0`–`n9`.
 */

import {
  numberblocksAssets,
  type ScratchSb3Assets,
} from "./numberblocksSb3"

/** Scratch target that holds the on-screen Numberling digit art. */
export const NUMBERLING_DIGITS_TARGET = "Digits//Multiplier Ones"

export type NumberlingAsset = {
  value: number
  /** Digits used, left → right. */
  digits: number[]
  svg: string
  width: number
  height: number
  /** Costume names checked in the SB3, e.g. `n1`, `n2`. */
  sources: string[]
}

type ViewBox = { x: number; y: number; width: number; height: number }

function parseViewBox(svg: string): ViewBox {
  const match = svg.match(/viewBox\s*=\s*"([^"]+)"/i)
  if (!match) return { x: 0, y: 0, width: 1, height: 1 }
  const parts = match[1]!.trim().split(/[\s,]+/).map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return { x: 0, y: 0, width: 1, height: 1 }
  }
  return { x: parts[0]!, y: parts[1]!, width: parts[2]!, height: parts[3]! }
}

function innerSvgMarkup(svg: string): string {
  const open = svg.match(/<svg\b[^>]*>/i)
  const close = svg.match(/<\/svg>/i)
  if (!open || !close) return svg
  return svg.slice(open.index! + open[0].length, close.index).trim()
}

/** Drop per-path paint so the composed Numberling can be solid black. */
function stripPaintAttrs(markup: string): string {
  return markup
    .replace(/\sfill="[^"]*"/gi, "")
    .replace(/\sstroke="[^"]*"/gi, "")
    .replace(/\sstroke-width="[^"]*"/gi, "")
    .replace(/\sfill-opacity="[^"]*"/gi, "")
    .replace(/\sstroke-opacity="[^"]*"/gi, "")
    .replace(
      /\sstyle="([^"]*)"/gi,
      (_full, style: string) => {
        const cleaned = style
          .replace(/(?:^|;)\s*fill\s*:[^;]*/gi, "")
          .replace(/(?:^|;)\s*stroke\s*:[^;]*/gi, "")
          .replace(/(?:^|;)\s*stroke-width\s*:[^;]*/gi, "")
          .replace(/^;+|;+$/g, "")
          .trim()
        return cleaned ? ` style="${cleaned}"` : ""
      },
    )
}

/** Split a non-negative integer into decimal digits (0 → [0]). */
export function numberlingDigits(value: number): number[] {
  if (!Number.isFinite(value) || value < 0) return [0]
  const n = Math.floor(value)
  if (n === 0) return [0]
  return String(n).split("").map((ch) => Number(ch))
}

/**
 * Load one digit (0–9) from {@link NUMBERLING_DIGITS_TARGET}.
 * Verifies the costume exists in the SB3 pack.
 */
export async function loadNumberlingDigit(
  digit: number,
  assets: ScratchSb3Assets = numberblocksAssets,
): Promise<{ digit: number; svg: string; width: number; height: number; costume: string }> {
  const d = ((Math.floor(digit) % 10) + 10) % 10
  const costume = `n${d}`
  const svg = await assets.getSvgText(NUMBERLING_DIGITS_TARGET, costume, {
    keepNumeral: true,
  })
  const box = parseViewBox(svg)
  if (!(box.width > 0 && box.height > 0)) {
    throw new Error(`Numberling digit ${costume} has empty viewBox`)
  }
  if (!/<path\b/i.test(svg)) {
    throw new Error(`Numberling digit ${costume} has no path art`)
  }
  return {
    digit: d,
    svg,
    width: box.width,
    height: box.height,
    costume,
  }
}

/**
 * Build a Numberling SVG for `value` by composing digit costumes from the
 * Scratch pack (same glyphs the generator UI uses).
 */
export async function loadNumberling(
  value: number,
  assets: ScratchSb3Assets = numberblocksAssets,
): Promise<NumberlingAsset> {
  const digits = numberlingDigits(value)
  const loaded = await Promise.all(
    digits.map((digit) => loadNumberlingDigit(digit, assets)),
  )

  const gap = Math.max(...loaded.map((d) => d.height)) * 0.12
  const height = Math.max(...loaded.map((d) => d.height))
  let x = 0
  const parts: string[] = []
  for (const digit of loaded) {
    const box = parseViewBox(digit.svg)
    const dy = (height - digit.height) / 2
    parts.push(
      `<g transform="translate(${x - box.x} ${dy - box.y})">${stripPaintAttrs(innerSvgMarkup(digit.svg))}</g>`,
    )
    x += digit.width + gap
  }
  const width = Math.max(0.01, x - gap)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" ` +
    `width="${width}" height="${height}" overflow="visible">` +
    `<g fill="#000000" stroke="none">` +
    parts.join("") +
    `</g></svg>`

  return {
    value: Math.floor(value),
    digits,
    svg,
    width,
    height,
    sources: loaded.map((d) => d.costume),
  }
}
