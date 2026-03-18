import { describe, it, expect } from 'vitest'
import { compilePipeline } from '../src/dsl/index.ts'
import { derivePointers } from '../src/renderer/pointers.ts'
import type { Step, Value } from '../src/types.ts'

/** Simulate the renderer's global pointer derivation logic. */
function getVisibleGlobalPointerNames(step: Step, colorMap: Map<string, string>): string[] {
  const globalArrayNames = new Set(step.arrays.map(a => a.name))

  let allVarsForGlobal: Record<string, Value>
  let allExprPtrsForGlobal: Record<string, Value>
  let varHighlights = step.varHighlights

  if (step.callStack.length > 0) {
    const innermost = step.callStack[step.callStack.length - 1]
    allVarsForGlobal = {}
    for (const [name, val] of Object.entries(innermost.variables)) {
      if (val.arrays.some(a => globalArrayNames.has(a))) {
        allVarsForGlobal[name] = val
      }
    }
    allExprPtrsForGlobal = { ...step.expressionPointers }
    for (const [label, val] of Object.entries(innermost.expressionPointers)) {
      if (val.arrays.some(a => globalArrayNames.has(a))) {
        allExprPtrsForGlobal[label] = val
      }
    }
    varHighlights = [...step.varHighlights, ...innermost.varHighlights]
  } else {
    allVarsForGlobal = { ...step.variables }
    allExprPtrsForGlobal = { ...step.expressionPointers }
  }

  const pointers = derivePointers(allVarsForGlobal, allExprPtrsForGlobal, colorMap, varHighlights)
    .filter(p => globalArrayNames.has(p.arrayName))

  return pointers.map(p => p.name).sort()
}

function isInFrame(step: Step, funcName: string): boolean {
  return step.callStack.some(f => f.label.startsWith(funcName + '('))
}

describe('Quick Select: renderer pointer visibility', () => {
  const qs = `algo QuickSelect(arr[])
  def partition(lo, hi)
    let i = lo - 1
    let j = hi
    let done = 0
    while done == 0
      i = i + 1
      while arr[i] < arr[hi]
        i = i + 1
      j = j - 1
      while j > lo and arr[hi] < arr[j]
        j = j - 1
      if i >= j
        done = 1
      else
        swap arr[i], arr[j]
    swap arr[i], arr[hi]
    return i

  let k = 2
  #: pointer k on arr at k
  let lo = 0
  let hi = len(arr) - 1
  let found = 0
  while hi > lo and found == 0
    let p = lo + (hi - lo) / 2
    swap arr[hi], arr[p]
    let pivotIdx = partition(lo, hi)
    if pivotIdx < k
      lo = pivotIdx + 1
    else
      if pivotIdx > k
        hi = pivotIdx - 1
      else
        found = 1`

  const { steps, colorMap } = compilePipeline(qs, 'arr', [5, 3, 4, 1, 2])

  it('during partition (2nd call): pivotIdx NOT in visible global pointers', () => {
    // After first partition returns, pivotIdx is a global iterator.
    // During 2nd partition call, it should NOT be rendered as a global pointer.
    const stepsInPartitionWithPivotIdx = steps.filter(s =>
      isInFrame(s, 'partition') &&
      'pivotIdx' in s.variables &&
      s.variables['pivotIdx'].arrays.length > 0
    )
    expect(stepsInPartitionWithPivotIdx.length).toBeGreaterThan(0)

    for (const step of stepsInPartitionWithPivotIdx) {
      const visible = getVisibleGlobalPointerNames(step, colorMap)
      expect(visible).not.toContain('pivotIdx')
    }
  })

  it('during partition: k (explicit pointer) IS visible', () => {
    const stepInPartition = steps.find(s => isInFrame(s, 'partition'))
    expect(stepInPartition).toBeDefined()
    const visible = getVisibleGlobalPointerNames(stepInPartition!, colorMap)
    expect(visible).toContain('k')
  })

  it('during partition: only innermost frame vars + expr pointers shown', () => {
    const stepInPartition = steps.find(s => isInFrame(s, 'partition'))
    expect(stepInPartition).toBeDefined()
    const visible = getVisibleGlobalPointerNames(stepInPartition!, colorMap)
    // p (global iterator) should NOT show
    expect(visible).not.toContain('p')
    // pivotIdx (global iterator, if it exists) should NOT show
    expect(visible).not.toContain('pivotIdx')
  })

  it('after partition returns: pivotIdx IS visible', () => {
    const stepAfterPartition = steps.find(s =>
      s.callStack.length === 0 &&
      'pivotIdx' in s.variables &&
      s.variables['pivotIdx'].arrays.length > 0
    )
    expect(stepAfterPartition).toBeDefined()
    const visible = getVisibleGlobalPointerNames(stepAfterPartition!, colorMap)
    expect(visible).toContain('pivotIdx')
  })
})

describe('Quick Sort: renderer pointer visibility in nested calls', () => {
  const source = `algo QuickSort(arr[])
  def partition(lo, hi)
    let i = lo - 1
    let j = hi
    let done = 0
    while done == 0
      i = i + 1
      while arr[i] < arr[hi]
        i = i + 1
      j = j - 1
      while j > lo and arr[hi] < arr[j]
        j = j - 1
      if i >= j
        done = 1
      else
        swap arr[i], arr[j]
    swap arr[i], arr[hi]
    return i

  def qsort(lo, hi)
    if lo < hi
      let p = lo + (hi - lo) / 2
      swap arr[hi], arr[p]
      let pivotIdx = partition(lo, hi)
      qsort(lo, pivotIdx - 1)
      qsort(pivotIdx + 1, hi)

  qsort(0, len(arr) - 1)`

  const { steps, colorMap } = compilePipeline(source, 'arr', [5, 3, 4, 1, 2])

  it('during partition: qsort pivotIdx NOT visible as global pointer', () => {
    const stepsInPartition = steps.filter(s =>
      s.callStack.length >= 2 &&
      s.callStack[s.callStack.length - 1].label.startsWith('partition(')
    )
    expect(stepsInPartition.length).toBeGreaterThan(0)

    for (const step of stepsInPartition) {
      const visible = getVisibleGlobalPointerNames(step, colorMap)
      expect(visible).not.toContain('pivotIdx')
      expect(visible).not.toContain('p')
    }
  })
})
