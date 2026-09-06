export type Operation = "+" | "-"

export function applyOp(
  left: number,
  right: number,
  operation: Operation,
): number {
  return operation === "+" ? left + right : left - right
}

/** Left-to-right, no precedence — the expression a child just built. */
export function evaluate(terms: number[], operations: Operation[]): number {
  if (terms.length === 0) return 0
  let result = terms[0]
  for (let i = 0; i < operations.length; i++) {
    result = applyOp(result, terms[i + 1] ?? 0, operations[i])
  }
  return result
}

/**
 * `null` while the equation is incomplete.
 * `0` is a real value, so only `null` fields count as empty.
 */
export function isCorrect(
  terms: (number | null)[],
  operations: Operation[],
  answer: number | null,
): boolean | null {
  if (answer === null || terms.length < 2) return null
  if (terms.some((term) => term === null)) return null
  if (operations.length !== terms.length - 1) return null
  return evaluate(terms as number[], operations) === answer
}

export const COUNT_LENGTH = 10

export function multiple(step: number, k: number): number {
  return step * k
}
