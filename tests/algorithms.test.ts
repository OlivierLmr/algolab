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
     'Counting Sort', 'Radix Sort (LSD)', 'Heap Sort'].includes(a.name)
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

describe('Make Heap algorithms produce valid max-heaps', () => {
  function isMaxHeap(arr: number[]): boolean {
    for (let i = 0; i < arr.length; i++) {
      const left = 2 * i + 1
      const right = 2 * i + 2
      if (left < arr.length && arr[left] > arr[i]) return false
      if (right < arr.length && arr[right] > arr[i]) return false
    }
    return true
  }

  const heapAlgos = algorithms.filter(a =>
    ['Make Heap O(n log n)', 'Make Heap O(n)'].includes(a.name)
  )

  for (const algo of heapAlgos) {
    it(`${algo.name} produces a valid max-heap`, () => {
      const steps = runAlgorithm(algo.source, 'arr', algo.defaultInput)
      const lastStep = steps[steps.length - 1]
      const arrData = lastStep.arrays.find(a => a.name === 'arr')!
      const values = arrData.values.map(v => v.num)
      expect(isMaxHeap(values)).toBe(true)
    })

    it(`${algo.name} preserves all elements (multiset)`, () => {
      const steps = runAlgorithm(algo.source, 'arr', algo.defaultInput)
      const lastStep = steps[steps.length - 1]
      const arrData = lastStep.arrays.find(a => a.name === 'arr')!
      const values = arrData.values.map(v => v.num).sort((a, b) => a - b)
      const expected = [...algo.defaultInput].sort((a, b) => a - b)
      expect(values).toEqual(expected)
    })
  }

  // Edge cases for heap algorithms
  const edgeCases: { name: string; input: number[] }[] = [
    { name: 'single element', input: [42] },
    { name: 'already a heap', input: [9, 7, 8, 3, 5, 6, 4, 1, 2] },
    { name: 'reverse sorted', input: [1, 2, 3, 4, 5] },
    { name: 'all duplicates', input: [3, 3, 3, 3, 3] },
    { name: 'two elements', input: [1, 5] },
  ]

  for (const algo of heapAlgos) {
    for (const { name, input } of edgeCases) {
      it(`${algo.name} handles ${name}`, () => {
        const steps = runAlgorithm(algo.source, 'arr', input)
        const lastStep = steps[steps.length - 1]
        const arrData = lastStep.arrays.find(a => a.name === 'arr')!
        const values = arrData.values.map(v => v.num)
        expect(isMaxHeap(values)).toBe(true)
        // Verify all elements preserved
        const sorted = values.sort((a, b) => a - b)
        const expected = [...input].sort((a, b) => a - b)
        expect(sorted).toEqual(expected)
      })
    }
  }
})

describe('Sorting algorithms: edge-case inputs', () => {
  const sortAlgos = algorithms.filter(a =>
    ['Bubble Sort', 'Selection Sort', 'Insertion Sort',
     'Merge Sort (L+R copies)', 'Merge Sort (two arrays)',
     'Quick Sort', 'Quick Sort (Semi-Recursive)',
     'Counting Sort', 'Radix Sort (LSD)', 'Heap Sort'].includes(a.name)
  )

  const edgeCases: { name: string; input: number[] }[] = [
    { name: 'single element', input: [42] },
    { name: 'already sorted', input: [1, 2, 3, 4, 5] },
    { name: 'reverse sorted', input: [5, 4, 3, 2, 1] },
    { name: 'all duplicates', input: [3, 3, 3, 3, 3] },
    { name: 'two elements', input: [2, 1] },
    { name: 'with duplicates', input: [4, 2, 3, 2, 1, 4] },
  ]

  for (const algo of sortAlgos) {
    for (const { name, input } of edgeCases) {
      it(`${algo.name} handles ${name}`, () => {
        const steps = runAlgorithm(algo.source, 'arr', input)
        expect(steps.length).toBeGreaterThan(0)
        const lastStep = steps[steps.length - 1]
        const arrData = lastStep.arrays.find(a => a.name === 'arr')
        expect(arrData).toBeDefined()
        const sorted = arrData!.values.map(v => v.num)
        const expected = [...input].sort((a, b) => a - b)
        expect(sorted).toEqual(expected)
      })
    }
  }
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

describe('Deque demo: data structure operations', () => {
  const deque = algorithms.find(a => a.name === 'Deque (demo)')!

  it('produces correct final chunk contents after all operations', () => {
    const steps = runAlgorithm(deque.source, 'arr', deque.defaultInput)
    const lastStep = steps[steps.length - 1]

    // After all 17 operations, the deque contains:
    // {1, 2, 4, 6, 9, 12, 15, 20, 25, 30, 40, 55, 60, 65}
    // Spread across: c4[3]=1, c2=[2,4,6,9], c0=[12,15,20,25], c1=[30,40,55,60], c3[0]=65
    const c0 = lastStep.arrays.find(a => a.name === 'c0')!
    const c1 = lastStep.arrays.find(a => a.name === 'c1')!
    const c2 = lastStep.arrays.find(a => a.name === 'c2')!
    const c3 = lastStep.arrays.find(a => a.name === 'c3')!
    const c4 = lastStep.arrays.find(a => a.name === 'c4')!
    const map2 = lastStep.arrays.find(a => a.name === 'map2')!

    expect(c4.values.map(v => v.num)).toEqual([0, 0, 0, 1])
    expect(c2.values.map(v => v.num)).toEqual([2, 4, 6, 9])
    expect(c0.values.map(v => v.num)).toEqual([12, 15, 20, 25])
    expect(c1.values.map(v => v.num)).toEqual([30, 40, 55, 60])
    expect(c3.values.map(v => v.num)).toEqual([65, 0, 0, 0])

    // map2 should have the chunk layout after reallocation:
    // map2[1]=4(c4), map2[2]=2(c2), map2[3]=0(c0), map2[4]=1(c1), map2[5]=3(c3)
    expect(map2.values[1].num).toBe(4)
    expect(map2.values[2].num).toBe(2)
    expect(map2.values[3].num).toBe(0)
    expect(map2.values[4].num).toBe(1)
    expect(map2.values[5].num).toBe(3)
  })

  it('has reasonable step count for a demo with stepover operations', () => {
    const steps = runAlgorithm(deque.source, 'arr', deque.defaultInput)
    // Should have at least alloc steps + 17 operation comments/calls
    expect(steps.length).toBeGreaterThan(20)
    // But shouldn't be excessively long (operations are stepover'd)
    expect(steps.length).toBeLessThan(500)
  })
})
