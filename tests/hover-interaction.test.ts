import { describe, it, expect } from 'vitest'
import { hitTestCell, CELL_SIZE, CELL_GAP, ARRAY_Y_START } from '../src/renderer/array.ts'
import { runAlgorithm } from '../src/dsl/index.ts'

describe('hitTestCell', () => {
  const arrays = [
    { name: 'arr', length: 5 },
    { name: 'output', length: 5 },
  ]
  const yPositions = new Map([
    ['arr', 120],
    ['output', 220],
  ])
  const xOffset = 40

  it('detects cell in first array', () => {
    // Center of cell 0: x = 40 + 24 = 64, y = 120 + 24 = 144
    const hit = hitTestCell(64, 144, arrays, yPositions, xOffset)
    expect(hit).toEqual({ arrayName: 'arr', cellIndex: 0 })
  })

  it('detects cell at index 2', () => {
    const x = xOffset + 2 * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2
    const y = 120 + CELL_SIZE / 2
    const hit = hitTestCell(x, y, arrays, yPositions, xOffset)
    expect(hit).toEqual({ arrayName: 'arr', cellIndex: 2 })
  })

  it('detects cell in second array', () => {
    const x = xOffset + CELL_SIZE / 2
    const y = 220 + CELL_SIZE / 2
    const hit = hitTestCell(x, y, arrays, yPositions, xOffset)
    expect(hit).toEqual({ arrayName: 'output', cellIndex: 0 })
  })

  it('returns null for gap between cells', () => {
    // The gap is at x = 40 + CELL_SIZE + 1 (inside the 2px gap)
    const x = xOffset + CELL_SIZE + 1
    const y = 120 + CELL_SIZE / 2
    const hit = hitTestCell(x, y, arrays, yPositions, xOffset)
    expect(hit).toBeNull()
  })

  it('returns null for y between arrays', () => {
    const hit = hitTestCell(64, 190, arrays, yPositions, xOffset)
    expect(hit).toBeNull()
  })

  it('returns null for x before array', () => {
    const hit = hitTestCell(10, 144, arrays, yPositions, xOffset)
    expect(hit).toBeNull()
  })

  it('returns null for index beyond array length', () => {
    const x = xOffset + 10 * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2
    const hit = hitTestCell(x, 144, arrays, yPositions, xOffset)
    expect(hit).toBeNull()
  })
})

describe('Counting sort: cells acquire iterator metadata for hover', () => {
  const source = `algo CountingSort(arr: int[])
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
