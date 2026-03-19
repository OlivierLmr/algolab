import { describe, it, expect } from 'vitest'
import { runAlgorithm } from '../src/dsl/index.ts'

// hitTestCell tests removed — DOM-based renderer uses native hover events.

describe('Counting sort: cells acquire iterator metadata for hover', () => {
  const source = `algo CountingSort(arr[])
  let max = arr[0]
  for i from 1 to len(arr) - 1
    if arr[i] > max
      max = arr[i]

  alloc count max + 1
  alloc output len(arr)

  for i from 0 to len(arr) - 1
    count[arr[i]] = count[arr[i]] + 1

  let sum = 0
  for i from 0 to max
    let c = count[i]
    count[i] = sum
    sum = sum + c

  for i from 0 to len(arr) - 1
    output[count[arr[i]]] = arr[i]
    count[arr[i]] = count[arr[i]] + 1

  for i from 0 to len(arr) - 1
    arr[i] = output[i]`

  const steps = runAlgorithm(source, 'arr', [4, 2, 2, 8, 3, 3, 1])

  it('count cells tagged as iterators on output during phase 3', () => {
    const stepWithTaggedCount = steps.find(s => {
      const countArr = s.arrays.find(a => a.name === 'count')
      if (!countArr) return false
      return countArr.values.some(v => v.arrays.includes('output'))
    })
    expect(stepWithTaggedCount).toBeDefined()

    const countArr = stepWithTaggedCount!.arrays.find(a => a.name === 'count')!
    const taggedCells = countArr.values
      .map((v, i) => ({ index: i, value: v }))
      .filter(c => c.value.arrays.includes('output'))
    expect(taggedCells.length).toBeGreaterThan(0)

    // Each tagged cell's num value should be a valid index into output
    const outputArr = stepWithTaggedCount!.arrays.find(a => a.name === 'output')!
    for (const cell of taggedCells) {
      expect(cell.value.num).toBeGreaterThanOrEqual(0)
      expect(cell.value.num).toBeLessThan(outputArr.values.length)
    }
  })
})
