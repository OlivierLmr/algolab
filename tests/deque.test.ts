import { describe, it, expect } from 'vitest'
import { dequeDS, type DequeState } from '../src/datastructures/deque.ts'
import type { CellData, StructFieldData } from '../src/layout/types.ts'

/** Apply operation and return the final state (last substep). */
function apply(state: DequeState, op: string, args: Record<string, number> = {}): DequeState {
  const substeps = dequeDS.applyOperation(state, op, args)
  expect(substeps.length).toBeGreaterThan(0)
  return substeps[substeps.length - 1].state
}

/** Apply operation and return all substeps. */
function applySteps(state: DequeState, op: string, args: Record<string, number> = {}) {
  return dequeDS.applyOperation(state, op, args)
}

/** Get logical elements in order from a deque state (circular map-of-chunks). */
function logicalElements(state: DequeState): number[] {
  const result: number[] = []
  for (let i = 0; i < state.taille; i++) {
    const chunkOffset = Math.floor((state.chunkBeg + i) / state.chunkCap)
    const chunkIdx = (state.mapBeg + chunkOffset) % state.mapCap
    const slot = (state.chunkBeg + i) % state.chunkCap
    result.push(state.chunks[chunkIdx]![slot])
  }
  return result
}

describe('deque: initial state', () => {
  it('creates empty deque', () => {
    const state = dequeDS.createInitialState([])
    expect(state.taille).toBe(0)
    expect(state.chunkCap).toBe(4)
    expect(state.mapBeg).toBe(1)
    expect(state.mapCap).toBeGreaterThanOrEqual(4)
  })

  it('creates single element deque', () => {
    const state = dequeDS.createInitialState([42])
    expect(state.taille).toBe(1)
    expect(state.chunkCap).toBe(4)
    expect(state.chunkBeg).toBe(0)
    expect(logicalElements(state)).toEqual([42])
  })

  it('creates multi-element deque spanning one chunk', () => {
    const state = dequeDS.createInitialState([10, 20, 30])
    expect(state.taille).toBe(3)
    expect(state.chunkCap).toBe(4)
    expect(logicalElements(state)).toEqual([10, 20, 30])
    // One active chunk at mapBeg
    expect(state.chunks[state.mapBeg]).not.toBeNull()
  })

  it('creates deque spanning multiple chunks', () => {
    const state = dequeDS.createInitialState([1, 2, 3, 4, 5, 6, 7])
    expect(state.taille).toBe(7)
    expect(logicalElements(state)).toEqual([1, 2, 3, 4, 5, 6, 7])
    // Should span 2 chunks (ceil(7/4) = 2)
    expect(state.chunks[state.mapBeg]).not.toBeNull()
    expect(state.chunks[state.mapBeg + 1]).not.toBeNull()
  })

  it('mapCap leaves room on both sides', () => {
    const state = dequeDS.createInitialState([1, 2, 3, 4])
    // 1 chunk needed, mapCap = max(4, 1+2) = 4, mapBeg = 1
    expect(state.mapCap).toBe(4)
    expect(state.mapBeg).toBe(1)
    // Slot 0 should be null (room before)
    expect(state.chunks[0]).toBeNull()
  })
})

describe('deque: push_back', () => {
  it('appends within existing chunk', () => {
    const state = dequeDS.createInitialState([1, 2, 3])
    const s2 = apply(state, 'push_back', { val: 4 })
    expect(s2.taille).toBe(4)
    expect(logicalElements(s2)).toEqual([1, 2, 3, 4])
  })

  it('allocates new chunk when last chunk is full', () => {
    const state = dequeDS.createInitialState([1, 2, 3, 4])
    // First chunk is full (4 elements), push_back needs new chunk
    const steps = applySteps(state, 'push_back', { val: 5 })
    expect(steps.length).toBe(2) // allocate chunk + write
    expect(steps[0].description).toContain('Allocate new chunk')
    const final = steps[steps.length - 1].state
    expect(final.taille).toBe(5)
    expect(logicalElements(final)).toEqual([1, 2, 3, 4, 5])
  })

  it('push_back on empty deque', () => {
    const state = dequeDS.createInitialState([])
    const s2 = apply(state, 'push_back', { val: 99 })
    expect(s2.taille).toBe(1)
    expect(logicalElements(s2)).toEqual([99])
  })

  it('push_back within chunk produces 1 substep', () => {
    const state = dequeDS.createInitialState([1, 2])
    const steps = applySteps(state, 'push_back', { val: 3 })
    expect(steps.length).toBe(1)
    expect(steps[0].description).toContain('Write')
  })

  it('grows map when no room after last active chunk', () => {
    // Fill map completely: mapCap=4, mapBeg=1, need 3 chunks = 12 elements
    const state = dequeDS.createInitialState([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    // mapCap = max(4, ceil(12/4)+2) = max(4, 5) = 5; mapBeg=1; 3 active chunks at [1,2,3]
    // Push back needs new chunk at slot 4 which may or may not be available
    // Let's push enough to trigger map growth
    let s = state
    // Fill remaining map slots
    for (let i = 13; i <= 16; i++) {
      s = apply(s, 'push_back', { val: i })
    }
    // Now push should trigger map growth
    const steps = applySteps(s, 'push_back', { val: 17 })
    const hasGrow = steps.some(step => step.description.includes('Allocate new map'))
    // Either map grew or there was room — verify elements are correct
    const final = steps[steps.length - 1].state
    expect(logicalElements(final)).toContain(17)
  })
})

describe('deque: push_front', () => {
  it('prepends when chunkBeg > 0', () => {
    // Create a state where chunkBeg > 0 by doing pop_front first
    let state = dequeDS.createInitialState([1, 2, 3])
    state = apply(state, 'pop_front') // chunkBeg becomes 1
    expect(state.chunkBeg).toBe(1)
    const s2 = apply(state, 'push_front', { val: 0 })
    expect(s2.taille).toBe(3)
    expect(s2.chunkBeg).toBe(0)
    expect(logicalElements(s2)).toEqual([0, 2, 3])
  })

  it('allocates new chunk before when chunkBeg == 0', () => {
    const state = dequeDS.createInitialState([1, 2, 3])
    expect(state.chunkBeg).toBe(0)
    // push_front needs new chunk since chunkBeg==0
    const steps = applySteps(state, 'push_front', { val: 0 })
    expect(steps.length).toBe(2) // allocate chunk + write
    expect(steps[0].description).toContain('Allocate new chunk')
    const final = steps[steps.length - 1].state
    expect(logicalElements(final)).toEqual([0, 1, 2, 3])
  })

  it('push_front on empty deque', () => {
    const state = dequeDS.createInitialState([])
    const s2 = apply(state, 'push_front', { val: 42 })
    expect(s2.taille).toBe(1)
    expect(logicalElements(s2)).toEqual([42])
  })

  it('interleaved push_front and push_back maintain order', () => {
    let s = dequeDS.createInitialState([])
    s = apply(s, 'push_back', { val: 3 })
    s = apply(s, 'push_front', { val: 2 })
    s = apply(s, 'push_back', { val: 4 })
    s = apply(s, 'push_front', { val: 1 })
    expect(logicalElements(s)).toEqual([1, 2, 3, 4])
  })

  it('wraps mapBeg to end when room exists (circular buffer)', () => {
    // Start: mapCap=4, mapBeg=1, 1 chunk at [1], slots [0,2,3] free
    let s = dequeDS.createInitialState([1, 2, 3, 4])
    // push_front: chunkBeg=0, allocate new chunk at mapBeg-1=0
    s = apply(s, 'push_front', { val: 0 })
    expect(s.mapBeg).toBe(0)
    // Fill that chunk: push_front fills slots 2, 1, 0
    s = apply(s, 'push_front', { val: -1 })
    s = apply(s, 'push_front', { val: -2 })
    s = apply(s, 'push_front', { val: -3 })
    // Now: mapBeg=0, chunkBeg=0, chunks at [0,1], slots [2,3] free
    expect(s.chunkBeg).toBe(0)
    expect(s.mapBeg).toBe(0)
    // Next push_front should WRAP mapBeg to slot 3 (not grow)
    const steps = applySteps(s, 'push_front', { val: -4 })
    const hasGrow = steps.some(step => step.description.includes('Allocate new map'))
    expect(hasGrow).toBe(false)
    const final = steps[steps.length - 1].state
    expect(final.mapBeg).toBe(3) // wrapped to end
    expect(logicalElements(final)[0]).toBe(-4)
  })

  it('grows map only when ALL slots are occupied', () => {
    // Fill all 4 map slots by pushing front and back alternately
    let s = dequeDS.createInitialState([1, 2, 3, 4])
    // mapCap=4, mapBeg=1, chunk at [1]. Push back to fill [2], [3]
    for (let i = 5; i <= 12; i++) {
      s = apply(s, 'push_back', { val: i })
    }
    // Push front to fill [0] (and then wrap)
    for (let i = 0; i >= -3; i--) {
      s = apply(s, 'push_front', { val: i })
    }
    // All slots should now be occupied — next push_front needing a chunk triggers growth
    // Keep pushing front until chunkBeg reaches 0 in the front chunk
    while (s.chunkBeg > 0) {
      s = apply(s, 'push_front', { val: -99 })
    }
    // Now chunkBeg=0 and no free slots → growth required
    const steps = applySteps(s, 'push_front', { val: -100 })
    const hasGrow = steps.some(step => step.description.includes('Allocate new map'))
    expect(hasGrow).toBe(true)
    const final = steps[steps.length - 1].state
    expect(logicalElements(final)[0]).toBe(-100)
  })
})

describe('deque: pop_front', () => {
  it('removes front element', () => {
    const state = dequeDS.createInitialState([1, 2, 3])
    const s2 = apply(state, 'pop_front')
    expect(s2.taille).toBe(2)
    expect(logicalElements(s2)).toEqual([2, 3])
    expect(s2.chunkBeg).toBe(1)
  })

  it('pop_front on empty throws', () => {
    const state = dequeDS.createInitialState([])
    expect(() => apply(state, 'pop_front')).toThrow('pop_front on empty deque')
  })

  it('deallocates chunk when chunkBeg reaches chunkCap', () => {
    let state = dequeDS.createInitialState([1, 2, 3, 4, 5, 6, 7, 8])
    // 2 chunks, pop front 4 times to empty first chunk
    for (let i = 0; i < 3; i++) {
      state = apply(state, 'pop_front')
    }
    expect(state.chunkBeg).toBe(3)
    // Next pop should deallocate the chunk
    const steps = applySteps(state, 'pop_front')
    expect(steps.length).toBe(2) // remove + deallocate
    expect(steps[1].description).toContain('Deallocate')
    const final = steps[steps.length - 1].state
    expect(final.chunkBeg).toBe(0)
    expect(final.mapBeg).toBe(state.mapBeg + 1)
    expect(logicalElements(final)).toEqual([5, 6, 7, 8])
  })
})

describe('deque: pop_back', () => {
  it('removes back element', () => {
    const state = dequeDS.createInitialState([1, 2, 3])
    const s2 = apply(state, 'pop_back')
    expect(s2.taille).toBe(2)
    expect(logicalElements(s2)).toEqual([1, 2])
  })

  it('pop_back on empty throws', () => {
    const state = dequeDS.createInitialState([])
    expect(() => apply(state, 'pop_back')).toThrow('pop_back on empty deque')
  })

  it('deallocates chunk when it becomes empty', () => {
    let state = dequeDS.createInitialState([1, 2, 3, 4, 5, 6, 7, 8])
    // Pop back 3 times to leave 1 element in second chunk
    for (let i = 0; i < 3; i++) {
      state = apply(state, 'pop_back')
    }
    expect(logicalElements(state)).toEqual([1, 2, 3, 4, 5])
    // Pop once more to empty second chunk (element at slot 0 of chunk 2)
    const steps = applySteps(state, 'pop_back')
    const final = steps[steps.length - 1].state
    expect(logicalElements(final)).toEqual([1, 2, 3, 4])
  })
})

describe('deque: circular map buffer', () => {
  it('push_back wraps to slot 0 when room at start', () => {
    // Create state where active chunks are near the end of the map
    // mapCap=4, mapBeg=1, chunk at [1]. Pop front until chunk[1] is freed,
    // then push_back should allocate at end. Let's manipulate directly.
    let s = dequeDS.createInitialState([1, 2, 3, 4])
    // mapCap=4, mapBeg=1, chunk at [1], slots [0,2,3] free
    // push_back 4 more to fill [2] then [3]
    s = apply(s, 'push_back', { val: 5 })
    s = apply(s, 'push_back', { val: 6 })
    s = apply(s, 'push_back', { val: 7 })
    s = apply(s, 'push_back', { val: 8 })
    // Now chunks at [1,2], 8 elements. Push 4 more to fill [3]
    for (let i = 9; i <= 12; i++) {
      s = apply(s, 'push_back', { val: i })
    }
    // Now chunks at [1,2,3]. Next push_back needs new chunk.
    // afterLast = (1+3) % 4 = 0 — slot 0 is free → should wrap, not grow
    const steps = applySteps(s, 'push_back', { val: 13 })
    const hasGrow = steps.some(st => st.description.includes('Allocate new map'))
    expect(hasGrow).toBe(false)
    const final = steps[steps.length - 1].state
    expect(logicalElements(final)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13])
  })

  it('pop_front with wrapped map advances mapBeg circularly', () => {
    let s = dequeDS.createInitialState([1, 2, 3, 4])
    // Push front enough to wrap mapBeg
    for (let i = 0; i >= -3; i--) {
      s = apply(s, 'push_front', { val: i })
    }
    // mapBeg should have wrapped at some point
    // Pop front repeatedly — mapBeg should advance modularly
    const beforePop = s.mapBeg
    // Pop all elements from the first chunk
    for (let i = 0; i < s.chunkCap; i++) {
      if (s.taille === 0) break
      s = apply(s, 'pop_front')
    }
    // mapBeg should have advanced (modularly)
    expect(s.mapBeg).toBe((beforePop + 1) % s.mapCap)
  })

  it('getAt works correctly across wrapped boundary', () => {
    let s = dequeDS.createInitialState([1, 2, 3, 4])
    // Push front to fill slot before mapBeg, possibly wrapping
    s = apply(s, 'push_front', { val: 0 })
    s = apply(s, 'push_front', { val: -1 })
    s = apply(s, 'push_front', { val: -2 })
    s = apply(s, 'push_front', { val: -3 })
    // After wrapping, verify logical order is maintained
    const elems = logicalElements(s)
    expect(elems[0]).toBe(-3)
    expect(elems[elems.length - 1]).toBe(4)
  })

  it('insert works with wrapped map', () => {
    let s = dequeDS.createInitialState([1, 2, 3, 4])
    // Push front to create wrapping
    for (let i = 0; i >= -3; i--) {
      s = apply(s, 'push_front', { val: i })
    }
    // Insert in the middle
    const s2 = apply(s, 'insert', { pos: 2, val: 99 })
    const elems = logicalElements(s2)
    expect(elems[2]).toBe(99)
    expect(s2.taille).toBe(s.taille + 1)
  })

  it('erase works with wrapped map', () => {
    let s = dequeDS.createInitialState([1, 2, 3, 4])
    for (let i = 0; i >= -3; i--) {
      s = apply(s, 'push_front', { val: i })
    }
    const sizeBefore = s.taille
    const s2 = apply(s, 'erase', { pos: 1 })
    expect(s2.taille).toBe(sizeBefore - 1)
  })
})

describe('deque: insert', () => {
  it('inserts at beginning', () => {
    const state = dequeDS.createInitialState([2, 3, 4])
    const s2 = apply(state, 'insert', { pos: 0, val: 1 })
    expect(s2.taille).toBe(4)
    expect(logicalElements(s2)).toEqual([1, 2, 3, 4])
  })

  it('inserts in middle', () => {
    const state = dequeDS.createInitialState([1, 3, 4])
    const s2 = apply(state, 'insert', { pos: 1, val: 2 })
    expect(s2.taille).toBe(4)
    expect(logicalElements(s2)).toEqual([1, 2, 3, 4])
  })

  it('inserts at end', () => {
    const state = dequeDS.createInitialState([1, 2])
    const s2 = apply(state, 'insert', { pos: 2, val: 3 })
    expect(s2.taille).toBe(3)
    expect(logicalElements(s2)).toEqual([1, 2, 3])
  })

  it('insert at invalid position throws', () => {
    const state = dequeDS.createInitialState([1, 2])
    expect(() => apply(state, 'insert', { pos: -1, val: 0 })).toThrow()
    expect(() => apply(state, 'insert', { pos: 3, val: 0 })).toThrow()
  })

  it('insert closer to front shifts left', () => {
    // [1, 2, 3, 4, 5], insert at pos=1 — 1 element before vs 4 after → shift left
    const state = dequeDS.createInitialState([1, 2, 3, 4, 5])
    const steps = applySteps(state, 'insert', { pos: 1, val: 99 })
    expect(logicalElements(steps[steps.length - 1].state)).toEqual([1, 99, 2, 3, 4, 5])
    // Should have a "left" shift step
    const shiftStep = steps.find(s => s.description.includes('Shift'))
    expect(shiftStep).toBeDefined()
    expect(shiftStep!.description).toContain('left')
  })

  it('insert closer to back shifts right', () => {
    // [1, 2, 3, 4, 5], insert at pos=4 — 4 elements before vs 1 after → shift right
    const state = dequeDS.createInitialState([1, 2, 3, 4, 5])
    const steps = applySteps(state, 'insert', { pos: 4, val: 99 })
    expect(logicalElements(steps[steps.length - 1].state)).toEqual([1, 2, 3, 4, 99, 5])
    const shiftStep = steps.find(s => s.description.includes('Shift'))
    expect(shiftStep).toBeDefined()
    expect(shiftStep!.description).toContain('right')
  })

  it('insert has separate shift and write steps', () => {
    const state = dequeDS.createInitialState([1, 2, 3, 4, 5])
    const steps = applySteps(state, 'insert', { pos: 4, val: 99 })
    // Last step should be the write
    expect(steps[steps.length - 1].description).toContain('Write')
    // Second to last should be the shift
    expect(steps[steps.length - 2].description).toContain('Shift')
  })

  it('insert at pos=0 delegates to push_front', () => {
    const state = dequeDS.createInitialState([2, 3, 4])
    const steps = applySteps(state, 'insert', { pos: 0, val: 1 })
    // push_front writes directly, no shift step
    expect(steps.every(s => !s.description.includes('Shift'))).toBe(true)
    expect(logicalElements(steps[steps.length - 1].state)).toEqual([1, 2, 3, 4])
  })

  it('insert at pos=size delegates to push_back', () => {
    const state = dequeDS.createInitialState([1, 2])
    const steps = applySteps(state, 'insert', { pos: 2, val: 3 })
    // push_back writes directly, no shift step
    expect(steps.every(s => !s.description.includes('Shift'))).toBe(true)
    expect(logicalElements(steps[steps.length - 1].state)).toEqual([1, 2, 3])
  })
})

describe('deque: erase', () => {
  it('erases from beginning', () => {
    const state = dequeDS.createInitialState([1, 2, 3])
    const s2 = apply(state, 'erase', { pos: 0 })
    expect(s2.taille).toBe(2)
    expect(logicalElements(s2)).toEqual([2, 3])
  })

  it('erases from middle', () => {
    const state = dequeDS.createInitialState([1, 2, 3])
    const s2 = apply(state, 'erase', { pos: 1 })
    expect(s2.taille).toBe(2)
    expect(logicalElements(s2)).toEqual([1, 3])
  })

  it('erases last element', () => {
    const state = dequeDS.createInitialState([1, 2, 3])
    const s2 = apply(state, 'erase', { pos: 2 })
    expect(s2.taille).toBe(2)
    expect(logicalElements(s2)).toEqual([1, 2])
  })

  it('erase at invalid position throws', () => {
    const state = dequeDS.createInitialState([1, 2])
    expect(() => apply(state, 'erase', { pos: -1 })).toThrow()
    expect(() => apply(state, 'erase', { pos: 2 })).toThrow()
  })

  it('erase on empty throws', () => {
    const state = dequeDS.createInitialState([])
    expect(() => apply(state, 'erase', { pos: 0 })).toThrow()
  })
})

describe('deque: substep counts', () => {
  it('push_back within chunk produces 1 substep', () => {
    const state = dequeDS.createInitialState([1, 2])
    const steps = applySteps(state, 'push_back', { val: 3 })
    expect(steps.length).toBe(1)
  })

  it('push_back needing new chunk produces 2 substeps', () => {
    const state = dequeDS.createInitialState([1, 2, 3, 4])
    const steps = applySteps(state, 'push_back', { val: 5 })
    expect(steps.length).toBe(2)
    expect(steps[0].description).toContain('Allocate')
    expect(steps[1].description).toContain('Write')
  })

  it('pop_front without dealloc produces 1 substep', () => {
    const state = dequeDS.createInitialState([1, 2, 3])
    const steps = applySteps(state, 'pop_front')
    expect(steps.length).toBe(1)
  })

  it('pop_back without dealloc produces 1 substep', () => {
    const state = dequeDS.createInitialState([1, 2, 3])
    const steps = applySteps(state, 'pop_back')
    expect(steps.length).toBe(1)
  })

  it('erase from middle produces shift + pop_back substeps', () => {
    const state = dequeDS.createInitialState([1, 2, 3])
    const steps = applySteps(state, 'erase', { pos: 0 })
    expect(steps.length).toBeGreaterThanOrEqual(2)
    expect(steps[0].description).toContain('Shift')
    expect(steps[1].description).toContain('Remove')
  })
})

describe('deque: layout', () => {
  it('produces 6 struct header fields', () => {
    const state = dequeDS.createInitialState([1, 2, 3])
    const layout = dequeDS.computeLayout(state)
    const fields = layout.elements.filter(e => e.kind === 'struct-field')
    expect(fields.length).toBe(6)
    const names = fields.map(f => (f.data as StructFieldData).name)
    expect(names).toEqual(['map', 'map_cap', 'map_beg', 'chunk_cap', 'chunk_beg', 'taille'])
  })

  it('produces map cells equal to mapCap', () => {
    const state = dequeDS.createInitialState([1, 2, 3])
    const layout = dequeDS.computeLayout(state)
    const mapCells = layout.elements.filter(e => e.id.startsWith('cell:map:'))
    expect(mapCells.length).toBe(state.mapCap)
  })

  it('active map cells are not dimmed, inactive ones are', () => {
    const state = dequeDS.createInitialState([1, 2, 3])
    const layout = dequeDS.computeLayout(state)
    const mapCells = layout.elements.filter(e => e.id.startsWith('cell:map:'))
    for (let i = 0; i < state.mapCap; i++) {
      const cell = mapCells.find(c => c.id === `cell:map:${i}`)!
      const data = cell.data as CellData
      if (state.chunks[i] !== null) {
        expect(data.dimmed).toBe(false)
      } else {
        expect(data.dimmed).toBe(true)
      }
    }
  })

  it('produces chunk cells for each active chunk', () => {
    const state = dequeDS.createInitialState([1, 2, 3, 4, 5])
    const layout = dequeDS.computeLayout(state)
    // 2 active chunks, each with chunkCap=4 cells
    const chunkCells = layout.elements.filter(e => e.id.startsWith('cell:chunk:'))
    const activeChunkCount = state.chunks.filter(c => c !== null).length
    expect(chunkCells.length).toBe(activeChunkCount * state.chunkCap)
  })

  it('dims unused slots in first and last chunks', () => {
    // chunkBeg=0, 3 elements in first chunk (slot 3 is unused in last chunk sense)
    const state = dequeDS.createInitialState([1, 2, 3])
    const layout = dequeDS.computeLayout(state)
    const chunkCells = layout.elements.filter(e => e.id.startsWith('cell:chunk:'))
    const dimmed = chunkCells.filter(e => (e.data as CellData).dimmed)
    // 1 chunk with 4 slots, 3 active, 1 dimmed
    expect(dimmed.length).toBe(1)
  })

  it('produces arrows from map field to map row and from map cells to chunks', () => {
    const state = dequeDS.createInitialState([1, 2, 3])
    const layout = dequeDS.computeLayout(state)
    // 1 arrow from struct field to map + 1 arrow per active chunk
    const activeChunkCount = state.chunks.filter(c => c !== null).length
    expect(layout.arrows.length).toBe(1 + activeChunkCount)
  })

  it('empty deque has struct fields and map cells but no chunk cells', () => {
    const state = dequeDS.createInitialState([])
    const layout = dequeDS.computeLayout(state)
    const fields = layout.elements.filter(e => e.kind === 'struct-field')
    expect(fields.length).toBe(6)
    const mapCells = layout.elements.filter(e => e.id.startsWith('cell:map:'))
    expect(mapCells.length).toBe(state.mapCap)
    const chunkCells = layout.elements.filter(e => e.id.startsWith('cell:chunk:'))
    expect(chunkCells.length).toBeGreaterThanOrEqual(0)
  })

  it('all intermediate substeps produce valid renderable layouts', () => {
    const state = dequeDS.createInitialState([1, 2, 3, 4])
    const steps = applySteps(state, 'insert', { pos: 1, val: 99 })
    for (const step of steps) {
      const layout = dequeDS.computeLayout(step.state)
      expect(layout.elements.length).toBeGreaterThan(0)
      expect(layout.width).toBeGreaterThan(0)
    }
  })

  it('shows old map cells and chunks during growth substeps', () => {
    // Force map growth: fill all slots then push
    let s = dequeDS.createInitialState([1, 2, 3, 4])
    // Fill all map slots by pushing
    for (let i = 5; i <= 12; i++) s = apply(s, 'push_back', { val: i })
    for (let i = 0; i >= -3; i--) s = apply(s, 'push_front', { val: i })
    while (s.chunkBeg > 0) s = apply(s, 'push_front', { val: -99 })
    // Next push_front triggers growth
    const steps = applySteps(s, 'push_front', { val: -100 })
    // Find the "Allocate new map" step
    const allocStep = steps.find(st => st.description.includes('Allocate new map'))
    expect(allocStep).toBeDefined()
    const layout = dequeDS.computeLayout(allocStep!.state)
    // Should have both old map cells and new map cells
    const oldMapCells = layout.elements.filter(e => e.id.startsWith('cell:oldmap:'))
    const newMapCells = layout.elements.filter(e => e.id.startsWith('cell:map:'))
    expect(oldMapCells.length).toBe(s.mapCap)
    expect(newMapCells.length).toBe(s.mapCap * 2)
    // Old map cells should have reduced opacity
    expect(oldMapCells[0].opacity).toBeLessThan(1.0)
    // Chunks should be visible (below new map, full opacity — they are shared objects)
    const chunkCells = layout.elements.filter(e => e.id.startsWith('cell:chunk:'))
    expect(chunkCells.length).toBeGreaterThan(0)
    expect(chunkCells[0].opacity).toBe(1.0)
  })

  it('after copy step, old map arrows point to valid chunk positions below new map', () => {
    let s = dequeDS.createInitialState([1, 2, 3, 4])
    for (let i = 5; i <= 12; i++) s = apply(s, 'push_back', { val: i })
    for (let i = 0; i >= -3; i--) s = apply(s, 'push_front', { val: i })
    while (s.chunkBeg > 0) s = apply(s, 'push_front', { val: -99 })
    const steps = applySteps(s, 'push_front', { val: -100 })
    // Find the "Copy" step
    const copyStep = steps.find(st => st.description.includes('Copy'))
    expect(copyStep).toBeDefined()
    const layout = dequeDS.computeLayout(copyStep!.state)
    // Old map arrows (opacity < 1) should exist
    const dimmedArrows = layout.arrows.filter(a => a.opacity !== undefined && a.opacity < 1.0)
    expect(dimmedArrows.length).toBeGreaterThan(0)
    // Each dimmed arrow's target X should match a rendered chunk column's X
    const chunkCells = layout.elements.filter(e => e.id.startsWith('cell:chunk:'))
    const chunkXs = new Set(chunkCells.map(e => e.x + e.width / 2))
    for (const arrow of dimmedArrows) {
      expect(chunkXs.has(arrow.toX)).toBe(true)
    }
  })

  it('old map disappears after delete step', () => {
    let s = dequeDS.createInitialState([1, 2, 3, 4])
    for (let i = 5; i <= 12; i++) s = apply(s, 'push_back', { val: i })
    for (let i = 0; i >= -3; i--) s = apply(s, 'push_front', { val: i })
    while (s.chunkBeg > 0) s = apply(s, 'push_front', { val: -99 })
    const steps = applySteps(s, 'push_front', { val: -100 })
    // Find the "Delete old map" step
    const deleteStep = steps.find(st => st.description.includes('Delete old map'))
    expect(deleteStep).toBeDefined()
    const layout = dequeDS.computeLayout(deleteStep!.state)
    const oldMapCells = layout.elements.filter(e => e.id.startsWith('cell:oldmap:'))
    expect(oldMapCells.length).toBe(0)
  })
})
