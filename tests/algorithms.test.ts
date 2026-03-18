import { describe, it, expect } from 'vitest'
import { runAlgorithm } from '../src/dsl/index.ts'
import { algorithms } from '../src/algorithms/index.ts'

describe('All built-in algorithms run without errors', () => {
  for (const algo of algorithms) {
    it(`${algo.name} completes successfully`, () => {
      const steps = runAlgorithm(algo.source, 'arr', algo.defaultInput)
      expect(steps.length).toBeGreaterThan(0)
      // Every step should have valid structure
      for (const step of steps) {
        expect(step.arrays).toBeDefined()
        expect(step.variables).toBeDefined()
        expect(step.callStack).toBeDefined()
        expect(step.variables).toBeDefined()
      }
    })
  }
})

describe('Algorithms produce sorted output', () => {
  const sortAlgos = algorithms.filter(a =>
    ['Bubble Sort', 'Selection Sort', 'Insertion Sort',
     'Merge Sort (L+R copies)', 'Merge Sort (two arrays)',
     'Quick Sort', 'Quick Sort (Semi-Recursive)',
     'Counting Sort', 'Radix Sort (LSD)'].includes(a.name)
  )

  for (const algo of sortAlgos) {
    it(`${algo.name} sorts the array correctly`, () => {
      const steps = runAlgorithm(algo.source, 'arr', algo.defaultInput)
      const lastStep = steps[steps.length - 1]
      const arrData = lastStep.arrays.find(a => a.name === 'arr')
      expect(arrData).toBeDefined()
      const sorted = arrData!.values.map(v => v.num)
      const expected = [...algo.defaultInput].sort((a, b) => a - b)
      expect(sorted).toEqual(expected)
    })
  }
})

describe('Counting Sort: retroactive cell tagging', () => {
  const countingSort = algorithms.find(a => a.name === 'Counting Sort')!

  it('count array cells acquire iterator metadata on output during phase 3', () => {
    const steps = runAlgorithm(countingSort.source, 'arr', [4, 2, 2, 8, 3, 3, 1])
    // Find a step in phase 3 where count cells have been used to index output
    // After `output[count[arr[i]]] = arr[i]`, the count cell should be tagged as iterator on output
    const phase3Steps = steps.filter(s =>
      s.description.includes('Placing') || s.description.includes('Phase 3')
    )
    // Find a step where count array has cells with iterator metadata
    const stepWithTaggedCount = steps.find(s => {
      const countArr = s.arrays.find(a => a.name === 'count')
      if (!countArr) return false
      return countArr.values.some(v => v.arrays.includes('output'))
    })
    expect(stepWithTaggedCount).toBeDefined()
  })
})

describe('Quick Select: finds k-th element', () => {
  const qs = algorithms.find(a => a.name === 'Quick Select')!

  it('arr[k] is the k-th smallest element', () => {
    const steps = runAlgorithm(qs.source, 'arr', [5, 3, 4, 1, 2])
    const lastStep = steps[steps.length - 1]
    const arrData = lastStep.arrays.find(a => a.name === 'arr')!
    const k = lastStep.variables['k'].num
    // arr[k] should be the (k+1)-th smallest = 3 for input [5,3,4,1,2] with k=2
    expect(arrData.values[k].num).toBe(3)
  })
})
