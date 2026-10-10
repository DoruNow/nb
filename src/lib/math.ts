export type Operation = "+" | "-" | "×" | "÷"

export function applyOp(
  left: number,
  right: number,
  operation: Operation,
): number {
  if (operation === "+") return left + right
  if (operation === "-") return left - right
  if (operation === "×") return left * right
  return left / right
}

function isMulDiv(operation: Operation): boolean {
  return operation === "×" || operation === "÷"
}

/**
 * Standard order of operations: × and ÷ before + and −,
 * left-to-right within the same precedence.
 */
export function evaluate(terms: number[], operations: Operation[]): number {
  if (terms.length === 0) return 0

  const values = [...terms]
  const ops = [...operations]

  let i = 0
  while (i < ops.length) {
    const op = ops[i]
    if (op && isMulDiv(op)) {
      const left = values[i] ?? 0
      const right = values[i + 1] ?? 0
      values.splice(i, 2, applyOp(left, right, op))
      ops.splice(i, 1)
    } else {
      i++
    }
  }

  let result = values[0] ?? 0
  for (let j = 0; j < ops.length; j++) {
    const op = ops[j]
    if (!op) continue
    result = applyOp(result, values[j + 1] ?? 0, op)
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
/** Highest factor on each Table axis (1 through this number). */
export const TABLE_MAX = 10

export function multiple(step: number, k: number): number {
  return step * k
}
