import { describe, it, expect } from 'vitest'
import { lex } from '../src/dsl/lexer.ts'
import { parse } from '../src/dsl/parser.ts'
import { inferTypes } from '../src/dsl/typeinfer.ts'
import { synthesizeExpressionPointers } from '../src/dsl/transform.ts'
import type { TypeContext } from '../src/dsl/typeinfer.ts'

/** Parse DSL source, run AST transform, and run type inference. */
function infer(source: string, inputArrays: string[] = ['arr']): TypeContext {
  const tokens = lex(source)
  const ast = parse(tokens)
  synthesizeExpressionPointers(ast, inputArrays)
  return inferTypes(ast, inputArrays)
}

/** Look up a variable type by name (finds the first matching key). */
function varType(ctx: TypeContext, name: string): string[] {
  for (const [key, arrays] of ctx.varTypes) {
    if (key.startsWith(name + '@')) return arrays
  }
  return []
}

describe('Type Inference: basic indexing', () => {
  it('arr[i] → i is Iter<{arr}>', () => {
    const ctx = infer(`algo T(arr[])
  let i = 0
  let v = arr[i]`)
    expect(varType(ctx, 'i')).toContain('arr')
  })

  it('arr[j] in a for loop → j is Iter<{arr}>', () => {
    const ctx = infer(`algo T(arr[])
  for j from 0 to len(arr) - 1
    let v = arr[j]`)
    expect(varType(ctx, 'j')).toContain('arr')
  })

  it('two arrays: arr[i] and brr[i] → i is Iter<{arr, brr}>', () => {
    const ctx = infer(`algo T(arr[])
  alloc brr len(arr)
  let i = 0
  let v1 = arr[i]
  brr[i] = v1`)
    const iType = varType(ctx, 'i')
    expect(iType).toContain('arr')
    expect(iType).toContain('brr')
  })
})

describe('Type Inference: arithmetic algebra', () => {
  it('lo + (hi - lo) / 2 → Iter when lo/hi are Iter<{arr}>', () => {
    const ctx = infer(`algo T(arr[])
  def f(lo, hi)
    let mid = lo + (hi - lo) / 2
    let v = arr[lo]
    let w = arr[hi]

  f(0, len(arr) - 1)`)
    expect(varType(ctx, 'mid')).toContain('arr')
  })

  it('Iter - Iter → Num', () => {
    const ctx = infer(`algo T(arr[])
  let i = 0
  let j = 2
  let v1 = arr[i]
  let v2 = arr[j]
  let diff = j - i`)
    // diff should be Num since both are iterators
    expect(varType(ctx, 'diff')).toEqual([])
  })

  it('Iter * anything → Num', () => {
    const ctx = infer(`algo T(arr[])
  let i = 0
  let v = arr[i]
  let x = i * 2`)
    expect(varType(ctx, 'x')).toEqual([])
  })
})

describe('Type Inference: nested indexing (retroactive cell tagging)', () => {
  it('output[count[arr[i]]] → arr elem Iter<{count}>, count elem Iter<{output}>', () => {
    const ctx = infer(`algo T(arr[])
  alloc count 10
  alloc output len(arr)
  for i from 0 to len(arr) - 1
    output[count[arr[i]]] = arr[i]`)
    expect(ctx.arrayElementTypes.get('count')).toContain('output')
    expect(ctx.arrayElementTypes.get('arr')).toContain('count')
  })

  it('count[arr[i]] alone → arr elem Iter<{count}>', () => {
    const ctx = infer(`algo T(arr[])
  alloc count 10
  for i from 0 to len(arr) - 1
    count[arr[i]] = count[arr[i]] + 1`)
    expect(ctx.arrayElementTypes.get('arr')).toContain('count')
  })
})

describe('Type Inference: input array cells stamped at runtime', () => {
  it('input array cells carry element type from count[arr[i]]', async () => {
    const { compilePipeline } = await import('../src/dsl/index.ts')
    const { steps } = compilePipeline(`algo T(arr[])
  alloc count 10
  for i from 0 to len(arr) - 1
    count[arr[i]] = count[arr[i]] + 1`, 'arr', [3, 1, 2])
    // After initialization, arr's cells should be stamped as iterators on count
    const firstStep = steps[0]
    const arrCells = firstStep.arrays.find(a => a.name === 'arr')!.values
    for (const cell of arrCells) {
      expect(cell.arrays).toContain('count')
    }
  })
})

describe('Type Inference: function parameter propagation', () => {
  it('function params get types from body usage', () => {
    const ctx = infer(`algo T(arr[])
  def partition(lo, hi)
    dim arr from 0 to lo - 1
    let v = arr[hi]
    return hi

  let p = partition(0, len(arr) - 1)`)
    expect(varType(ctx, 'lo')).toContain('arr')
    expect(varType(ctx, 'hi')).toContain('arr')
  })

  it('function return type propagation', () => {
    const ctx = infer(`algo T(arr[])
  def partition(lo, hi)
    let i = lo
    let v = arr[i]
    return i

  let pivotIdx = partition(0, len(arr) - 1)`)
    expect(varType(ctx, 'pivotIdx')).toContain('arr')
  })
})

describe('Type Inference: dim/undim expressions', () => {
  it('dim arr from lo to hi → lo, hi are Iter<{arr}>', () => {
    const ctx = infer(`algo T(arr[])
  def msort(lo, hi)
    dim arr from 0 to lo - 1
    dim arr from hi + 1 to len(arr) - 1

  msort(0, len(arr) - 1)`)
    expect(varType(ctx, 'lo')).toContain('arr')
    expect(varType(ctx, 'hi')).toContain('arr')
  })
})

describe('Type Inference: expression pointers', () => {
  it('arr[i-1] registers expression pointer "i - 1"', () => {
    const ctx = infer(`algo T(arr[])
  for i from 1 to len(arr) - 1
    let v = arr[i - 1]`)
    const ep = ctx.expressionPointers.find(e => e.label === 'i - 1')
    expect(ep).toBeDefined()
    expect(ep!.arrayName).toBe('arr')
    // After AST transform, all expression pointers are explicit pointer nodes
    expect(ep!.explicit).toBe(true)
  })

  it('explicit #: pointer creates expression pointer', () => {
    const ctx = infer(`algo T(arr[])
  let boundary = 3
  pointer boundary on arr at boundary`)
    const ep = ctx.expressionPointers.find(e => e.label === 'boundary')
    expect(ep).toBeDefined()
    expect(ep!.explicit).toBe(true)
    expect(ep!.arrayName).toBe('arr')
  })

  it('#: pointer k on arr at k: k gets iterator type from pointer directive', () => {
    const ctx = infer(`algo T(arr[])
  let k = 2
  pointer k on arr at k`)
    expect(varType(ctx, 'k')).toContain('arr')
  })
})

describe('Type Inference: for-loop backward propagation', () => {
  it('for i from 0 to n with arr[i] → n is Iter<{arr}>', () => {
    const ctx = infer(`algo T(arr[])
  let n = len(arr) - 1
  for i from 0 to n
    let v = arr[i]`)
    expect(varType(ctx, 'n')).toContain('arr')
  })

  it('for i from lo to hi with arr[i] → lo, hi are Iter<{arr}>', () => {
    const ctx = infer(`algo T(arr[])
  let lo = 0
  let hi = len(arr) - 1
  for i from lo to hi
    let v = arr[i]`)
    expect(varType(ctx, 'lo')).toContain('arr')
    expect(varType(ctx, 'hi')).toContain('arr')
  })
})

describe('Type Inference: iterator labels collection', () => {
  it('collects variable names and expression pointer labels', () => {
    const ctx = infer(`algo T(arr[])
  for i from 0 to len(arr) - 1
    let v = arr[i]
  for j from 1 to len(arr) - 1
    let w = arr[j - 1]`)
    expect(ctx.iteratorLabels).toContain('i')
    expect(ctx.iteratorLabels).toContain('j')
    expect(ctx.iteratorLabels).toContain('j - 1')
  })
})

describe('Type Inference: swap constraints', () => {
  it('swap arr[i], arr[j] → i, j are Iter<{arr}>', () => {
    const ctx = infer(`algo T(arr[])
  let i = 0
  let j = 4
  swap arr[i], arr[j]`)
    expect(varType(ctx, 'i')).toContain('arr')
    expect(varType(ctx, 'j')).toContain('arr')
  })
})

describe('Type Inference: AND/OR two-tier resolution', () => {
  it('MergeSortAux merge: i/j resolve to {src} only, k to {dst} only', () => {
    // i gets OR from `let i = lo` (where lo: {src, dst}), but AND from src[i]
    // k gets OR from `let k = lo` (where lo: {src, dst}), but AND from dst[k]
    // AND evidence should override OR evidence
    const ctx = infer(`algo MergeSortAux(src[], dst[])
  def merge(lo, hi, mid)
    let i = lo
    let j = mid + 1
    let k = lo
    for step from lo to hi
      if i <= mid and (j > hi or src[i] <= src[j])
        dst[k] = src[i]
        i = i + 1
      else
        dst[k] = src[j]
        j = j + 1
      k = k + 1

  def msort(lo, hi)
    if lo < hi
      let mid = lo + (hi - lo) / 2
      msort(lo, mid)
      msort(mid + 1, hi)
      dim src from 0 to lo - 1
      dim src from hi + 1 to len(src) - 1
      dim dst from 0 to lo - 1
      dim dst from hi + 1 to len(dst) - 1
      merge(lo, hi, mid)
      undim dst from 0 to lo - 1
      undim dst from hi + 1 to len(dst) - 1
      undim src from 0 to lo - 1
      undim src from hi + 1 to len(src) - 1

  msort(0, len(src) - 1)`, ['src', 'dst'])

    // i and j index src[] only — AND from src[i], src[j] overrides OR from let i = lo
    const iType = varType(ctx, 'i')
    expect(iType).toContain('src')
    expect(iType).not.toContain('dst')

    const jType = varType(ctx, 'j')
    expect(jType).toContain('src')
    expect(jType).not.toContain('dst')

    // k indexes dst[] only — AND from dst[k] overrides OR from let k = lo
    const kType = varType(ctx, 'k')
    expect(kType).toContain('dst')
    expect(kType).not.toContain('src')
  })

  it('variable with only OR evidence uses OR as fallback', () => {
    // When there is no structural AND evidence, OR should be used
    const ctx = infer(`algo T(arr[])
  def f(lo, hi)
    let v = arr[lo]
    return lo

  let result = f(0, len(arr) - 1)`)
    // result has no AND evidence, only OR from return type → should get {arr}
    expect(varType(ctx, 'result')).toContain('arr')
  })

  it('AND evidence from dim/undim is structural', () => {
    const ctx = infer(`algo T(arr[])
  alloc brr len(arr)
  def f(lo, hi)
    dim arr from lo to hi
    dim brr from lo to hi

  f(0, len(arr) - 1)`)
    // lo/hi have AND evidence from both dim statements → {arr, brr}
    const loType = varType(ctx, 'lo')
    expect(loType).toContain('arr')
    expect(loType).toContain('brr')
  })
})

describe('Type Inference: len() returns Num', () => {
  it('len(arr) produces Num type', () => {
    const ctx = infer(`algo T(arr[])
  let n = len(arr)`)
    expect(varType(ctx, 'n')).toEqual([])
  })
})
