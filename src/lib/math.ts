export type Operation = "+"

export function evaluate(
  left: number,
  right: number,
  operation: Operation,
): number {
  switch (operation) {
    case "+":
      return left + right
  }
}

/**
 * `null` while the equation is incomplete.
 * `0` is a real value, so only `null` fields count as empty.
 */
export function isCorrect(
  left: number | null,
  right: number | null,
  answer: number | null,
  operation: Operation,
): boolean | null {
  if (left === null || right === null || answer === null) return null
  return evaluate(left, right, operation) === answer
}
