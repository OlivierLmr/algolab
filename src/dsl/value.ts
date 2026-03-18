/** Tagged value: every runtime value knows whether it's a plain number or an iterator. */
export interface Value {
  num: number
  arrays: string[] // empty = plain number, non-empty = iterator on these arrays
}

export function plainVal(n: number): Value {
  return { num: n, arrays: [] }
}

export function iterVal(n: number, arrays: string[]): Value {
  return { num: n, arrays: [...arrays] }
}

export function addArray(val: Value, arrayName: string): Value {
  if (val.arrays.includes(arrayName)) return val
  return { num: val.num, arrays: [...val.arrays, arrayName] }
}

export function mergeArrays(a: string[], b: string[]): string[] {
  if (a.length === 0) return b.length === 0 ? [] : [...b]
  if (b.length === 0) return [...a]
  const set = new Set([...a, ...b])
  return [...set]
}

/**
 * Arithmetic propagation rules (like C pointer arithmetic):
 * - iterator +/- plain → iterator
 * - plain + iterator → iterator
 * - iterator - iterator → plain (distance)
 * - iterator + iterator → plain (meaningless)
 * - iterator * anything → plain
 * - iterator / anything → plain
 * - Comparison → plain
 * - not expr → plain
 */
export function propagateArithmetic(op: string, left: Value, right: Value, result: number): Value {
  // Comparisons and logical ops always produce plain
  if (['<', '>', '<=', '>=', '==', '!=', 'and', 'or'].includes(op)) {
    return plainVal(result)
  }
  // Multiplication, division, modulo always produce plain
  if (['*', '/', '%'].includes(op)) {
    return plainVal(result)
  }
  // Addition
  if (op === '+') {
    if (left.arrays.length > 0 && right.arrays.length > 0) {
      return plainVal(result) // iterator + iterator = plain
    }
    const arrays = left.arrays.length > 0 ? left.arrays : right.arrays
    return arrays.length > 0 ? iterVal(result, arrays) : plainVal(result)
  }
  // Subtraction
  if (op === '-') {
    if (left.arrays.length > 0 && right.arrays.length > 0) {
      return plainVal(result) // iterator - iterator = plain (distance)
    }
    if (left.arrays.length > 0) {
      return iterVal(result, left.arrays) // iterator - plain = iterator
    }
    return plainVal(result) // plain - iterator = plain
  }
  return plainVal(result)
}
