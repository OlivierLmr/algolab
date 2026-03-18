import { describe, it, expect } from 'vitest'
import { plainVal, iterVal, propagateArithmetic } from '../src/dsl/value.ts'

describe('Value arithmetic propagation', () => {
  const arrIter = iterVal(3, ['arr'])
  const plain5 = plainVal(5)
  const plain2 = plainVal(2)

  it('iterator + plain = iterator', () => {
    const result = propagateArithmetic('+', arrIter, plain2, 5)
    expect(result.arrays).toEqual(['arr'])
    expect(result.num).toBe(5)
  })

  it('plain + iterator = iterator', () => {
    const result = propagateArithmetic('+', plain2, arrIter, 5)
    expect(result.arrays).toEqual(['arr'])
  })

  it('iterator - plain = iterator', () => {
    const result = propagateArithmetic('-', arrIter, plain2, 1)
    expect(result.arrays).toEqual(['arr'])
  })

  it('iterator - iterator = plain (distance)', () => {
    const other = iterVal(1, ['arr'])
    const result = propagateArithmetic('-', arrIter, other, 2)
    expect(result.arrays).toEqual([])
  })

  it('iterator + iterator = plain', () => {
    const other = iterVal(1, ['arr'])
    const result = propagateArithmetic('+', arrIter, other, 4)
    expect(result.arrays).toEqual([])
  })

  it('iterator * plain = plain', () => {
    const result = propagateArithmetic('*', arrIter, plain2, 6)
    expect(result.arrays).toEqual([])
  })

  it('iterator / plain = plain', () => {
    const result = propagateArithmetic('/', arrIter, plain2, 1)
    expect(result.arrays).toEqual([])
  })

  it('comparison always produces plain', () => {
    for (const op of ['<', '>', '<=', '>=', '==', '!=']) {
      const result = propagateArithmetic(op, arrIter, plain5, 1)
      expect(result.arrays).toEqual([])
    }
  })

  it('plain + plain = plain', () => {
    const result = propagateArithmetic('+', plain2, plain5, 7)
    expect(result.arrays).toEqual([])
  })

  it('lo + (hi - lo) / 2 → iterator (midpoint calculation)', () => {
    const lo = iterVal(1, ['arr'])
    const hi = iterVal(4, ['arr'])
    const diff = propagateArithmetic('-', hi, lo, 3) // hi - lo = plain
    expect(diff.arrays).toEqual([])
    const half = propagateArithmetic('/', diff, plain2, 1) // plain / plain = plain
    expect(half.arrays).toEqual([])
    const mid = propagateArithmetic('+', lo, half, 2) // iterator + plain = iterator
    expect(mid.arrays).toEqual(['arr'])
  })
})
