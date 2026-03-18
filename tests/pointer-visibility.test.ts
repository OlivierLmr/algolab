import { describe, it, expect } from 'vitest'
import { runAlgorithm } from '../src/dsl/index.ts'
import type { Step } from '../src/types.ts'

/** Get all iterator variable names from global scope. */
function globalIterVars(step: Step): string[] {
  return Object.entries(step.variables)
    .filter(([_, v]) => v.arrays.length > 0)
    .map(([n]) => n)
    .sort()
}

/** Check if step is inside a function call (by label prefix). */
function isInFrame(step: Step, funcName: string): boolean {
  return step.callStack.some(f => f.label.startsWith(funcName + '('))
}

/** Get innermost frame. */
function innermostFrame(step: Step) {
  return step.callStack[step.callStack.length - 1]
}

/** Get iterator variable names from the innermost call frame. */
function innermostIterVars(step: Step): string[] {
  if (step.callStack.length === 0) return []
  const frame = innermostFrame(step)
  return Object.entries(frame.variables)
    .filter(([_, v]) => v.arrays.length > 0)
    .map(([n]) => n)
    .sort()
}

describe('Quick Select: pivotIdx not visible during partition()', () => {
  // Simplified version without directives for testing core behavior
  const source = `algo QuickSelect(arr[])
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

  const steps = runAlgorithm(source, 'arr', [5, 3, 4, 1, 2])

  it('pivotIdx exists as global iterator var during 2nd partition call', () => {
    // After first partition returns, pivotIdx is set. During 2nd partition call,
    // pivotIdx persists as a global iterator variable.
    const stepsInPartitionWithPivotIdx = steps.filter(s =>
      isInFrame(s, 'partition') &&
      'pivotIdx' in s.variables &&
      s.variables['pivotIdx'].arrays.length > 0
    )
    // This confirms the scenario exists
    expect(stepsInPartitionWithPivotIdx.length).toBeGreaterThan(0)
  })

  it('pivotIdx is NOT in innermost frame during partition', () => {
    // pivotIdx is a global variable, not a partition variable
    const stepsInPartition = steps.filter(s => isInFrame(s, 'partition'))
    for (const step of stepsInPartition) {
      const frameVarNames = Object.keys(innermostFrame(step).variables)
      expect(frameVarNames).not.toContain('pivotIdx')
    }
  })

  it('partition frame has i, j, hi as iterator vars on arr', () => {
    // Find a step where j has been defined (after 'let j = hi')
    const stepInPartition = steps.find(s =>
      isInFrame(s, 'partition') && 'j' in innermostFrame(s).variables
    )
    expect(stepInPartition).toBeDefined()
    const frameVars = innermostIterVars(stepInPartition!)
    expect(frameVars).toContain('i')
    expect(frameVars).toContain('j')
    expect(frameVars).toContain('hi')
  })

  it('pivotIdx is visible as global iterator after partition returns', () => {
    const stepsWithPivotIdx = steps.filter(s =>
      s.callStack.length === 0 &&
      'pivotIdx' in s.variables &&
      s.variables['pivotIdx'].arrays.length > 0
    )
    expect(stepsWithPivotIdx.length).toBeGreaterThan(0)
  })

  it('expression pointer k exists in global scope as a scoped variable', () => {
    const stepsWithK = steps.filter(s =>
      'k' in s.variables && s.variables['k'].arrays.length > 0
    )
    expect(stepsWithK.length).toBeGreaterThan(0)
    // k should be present even during partition calls (it's a global scoped variable)
    const stepsInPartitionWithK = stepsWithK.filter(s => isInFrame(s, 'partition'))
    expect(stepsInPartitionWithK.length).toBeGreaterThan(0)
  })
})

describe('Quick Sort: pivotIdx scoping in nested calls', () => {
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

  const steps = runAlgorithm(source, 'arr', [5, 3, 4, 1, 2])

  it('pivotIdx is in qsort frame, not in partition frame', () => {
    // Find steps where partition is the innermost frame and qsort has pivotIdx
    const stepsInPartition = steps.filter(s =>
      s.callStack.length >= 2 &&
      innermostFrame(s).label.startsWith('partition(')
    )
    for (const step of stepsInPartition) {
      // pivotIdx should NOT be in the partition frame
      expect(Object.keys(innermostFrame(step).variables)).not.toContain('pivotIdx')
    }
  })

  it('pivotIdx is an iterator on arr in qsort frame after partition returns', () => {
    // After partition returns to qsort, pivotIdx should be in the qsort frame
    const stepsInQsort = steps.filter(s =>
      s.callStack.length > 0 &&
      innermostFrame(s).label.startsWith('qsort(') &&
      'pivotIdx' in innermostFrame(s).variables
    )
    expect(stepsInQsort.length).toBeGreaterThan(0)
    for (const step of stepsInQsort) {
      expect(innermostFrame(step).variables['pivotIdx'].arrays).toContain('arr')
    }
  })
})

describe('Function return propagates iterator metadata', () => {
  const source = `algo Test(arr[])
  def getIdx(x)
    let result = x
    return result

  let i = 0
  let val = arr[i]
  let idx = getIdx(i)`

  const steps = runAlgorithm(source, 'arr', [10, 20, 30])

  it('returned value from function carries iterator metadata', () => {
    const lastStep = steps[steps.length - 1]
    expect(lastStep.variables['idx']).toBeDefined()
    expect(lastStep.variables['idx'].arrays).toContain('arr')
  })
})

describe('Direct variable tagging', () => {
  it('arr[i] tags i as iterator on arr', () => {
    const source = `algo Test(arr[])
  let i = 0
  let v = arr[i]`
    const steps = runAlgorithm(source, 'arr', [10, 20, 30])
    const last = steps[steps.length - 1]
    expect(last.variables['i'].arrays).toContain('arr')
  })

  it('arr[i+1] creates scoped expression variable "i + 1"', () => {
    const source = `algo Test(arr[])
  let i = 0
  let v = arr[i + 1]`
    const steps = runAlgorithm(source, 'arr', [10, 20, 30])
    const last = steps[steps.length - 1]
    expect(last.variables).toHaveProperty('i + 1')
    expect(last.variables['i + 1'].arrays).toContain('arr')
  })
})

describe('Expression pointers', () => {
  it('arr[0] (constant index) does NOT create an expression variable', () => {
    const source = `algo Test(arr[])
  let v = arr[0]`
    const steps = runAlgorithm(source, 'arr', [10, 20, 30])
    const last = steps[steps.length - 1]
    expect(last.variables).not.toHaveProperty('0')
  })

  it('arr[i-1] creates a scoped expression variable with correct value', () => {
    const source = `algo Test(arr[])
  for i from 1 to len(arr) - 1
    let v = arr[i - 1]`
    const steps = runAlgorithm(source, 'arr', [10, 20, 30])
    const stepWithExpr = steps.find(s =>
      'i - 1' in s.variables && s.variables['i - 1'].arrays.length > 0
    )
    expect(stepWithExpr).toBeDefined()
    expect(stepWithExpr!.variables['i - 1'].arrays).toContain('arr')
  })

  it('explicit #: pointer creates a scoped expression variable', () => {
    const source = `algo Test(arr[])
  let boundary = 3
  #: pointer boundary on arr at boundary`
    const steps = runAlgorithm(source, 'arr', [10, 20, 30, 40, 50])
    const last = steps[steps.length - 1]
    expect(last.variables).toHaveProperty('boundary')
    expect(last.variables['boundary'].num).toBe(3)
    expect(last.variables['boundary'].arrays).toContain('arr')
  })
})

describe('MergeSortLR: expression pointers scoped to copy, not leaking into merge', () => {
  // Regression test: `lo + i` and `mid + 1 + j` are expression pointers used
  // in `copy()` (from `arr[lo + i]` and `arr[mid + 1 + j]`). They must NOT
  // appear in `merge()` which has its own `i`, `j`, `lo` variables.
  const source = `algo MergeSortLR(arr[])
  def copy(lo, mid, hi)
    let leftLen = mid - lo + 1
    let rightLen = hi - mid
    for i from 0 to leftLen - 1
      L[i] = arr[lo + i]
    for j from 0 to rightLen - 1
      R[j] = arr[mid + 1 + j]
    L[leftLen] = inf
    R[rightLen] = inf

  def merge(lo, mid, hi)
    alloc L mid - lo + 2
    alloc R hi - mid + 1
    copy(lo, mid, hi)
    let i = 0
    let j = 0
    for k from lo to hi
      if L[i] <= R[j]
        arr[k] = L[i]
        i = i + 1
      else
        arr[k] = R[j]
        j = j + 1

  def msort(lo, hi)
    if lo < hi
      let mid = lo + (hi - lo) / 2
      msort(lo, mid)
      msort(mid + 1, hi)
      merge(lo, mid, hi)

  msort(0, len(arr) - 1)`

  const steps = runAlgorithm(source, 'arr', [5, 3, 8, 1, 2])

  it('lo + i expression pointer is visible inside copy()', () => {
    const stepInCopy = steps.find(s =>
      s.callStack.length > 0 &&
      innermostFrame(s).label.startsWith('copy(') &&
      'lo + i' in innermostFrame(s).variables
    )
    expect(stepInCopy).toBeDefined()
    const frame = innermostFrame(stepInCopy!)
    expect(frame.variables['lo + i'].arrays.length).toBeGreaterThan(0)
  })

  it('lo + i expression pointer is NOT visible inside merge() after copy returns', () => {
    // Find steps in merge() where the for-loop is running (i and j are defined)
    const stepsInMerge = steps.filter(s =>
      s.callStack.length > 0 &&
      innermostFrame(s).label.startsWith('merge(') &&
      'i' in innermostFrame(s).variables &&
      'j' in innermostFrame(s).variables
    )
    expect(stepsInMerge.length).toBeGreaterThan(0)
    for (const step of stepsInMerge) {
      const frame = innermostFrame(step)
      // These expression pointers belong to copy(), not merge()
      expect(frame.variables).not.toHaveProperty('lo + i')
      expect(frame.variables).not.toHaveProperty('mid + 1 + j')
    }
  })

  it('mid + 1 + j expression pointer is visible inside copy()', () => {
    const stepInCopy = steps.find(s =>
      s.callStack.length > 0 &&
      innermostFrame(s).label.startsWith('copy(') &&
      'mid + 1 + j' in innermostFrame(s).variables
    )
    expect(stepInCopy).toBeDefined()
    const frame = innermostFrame(stepInCopy!)
    expect(frame.variables['mid + 1 + j'].arrays.length).toBeGreaterThan(0)
  })
})

describe('Merge Sort: iterator tagging in function calls', () => {
  const source = `algo MergeSortLR(arr[])
  def msort(lo, hi)
    #: dim arr from 0 to lo - 1
    #: dim arr from hi + 1 to len(arr) - 1
    if lo < hi
      let mid = lo + (hi - lo) / 2
      msort(lo, mid)
      msort(mid + 1, hi)

  msort(0, len(arr) - 1)`

  const steps = runAlgorithm(source, 'arr', [5, 3, 8, 1, 2])

  it('lo and hi should be iterators on arr inside msort frame', () => {
    const stepInMsort = steps.find(s =>
      s.callStack.length > 0 &&
      innermostFrame(s).label.startsWith('msort(')
    )
    expect(stepInMsort).toBeDefined()
    const frame = innermostFrame(stepInMsort!)
    expect(frame.variables['lo'].arrays).toContain('arr')
    expect(frame.variables['hi'].arrays).toContain('arr')
  })

  it('mid should be an iterator on arr (lo + (hi-lo)/2)', () => {
    const stepWithMid = steps.find(s => {
      if (s.callStack.length === 0) return false
      const frame = innermostFrame(s)
      return frame.label.startsWith('msort(') && 'mid' in frame.variables
    })
    expect(stepWithMid).toBeDefined()
    const frame = innermostFrame(stepWithMid!)
    expect(frame.variables['mid'].arrays).toContain('arr')
  })
})
