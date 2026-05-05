import { describe, it, expect } from 'vitest'
import { vectorDS, type VectorState } from '../src/datastructures/vector.ts'

function apply(state: VectorState, op: string, args: Record<string, number> = {}): VectorState {
  return vectorDS.applyOperation(state, op, args)
}

describe('vector: initial state', () => {
  it('creates from input values with matching capacity', () => {
    const state = vectorDS.createInitialState([10, 20, 30])
    expect(state.size).toBe(3)
    expect(state.capacity).toBe(4) // next power of 2
    expect(state.data.slice(0, 3)).toEqual([10, 20, 30])
  })

  it('empty input creates empty vector', () => {
    const state = vectorDS.createInitialState([])
    expect(state.size).toBe(0)
    expect(state.capacity).toBe(0)
    expect(state.data).toEqual([])
  })

  it('power-of-2 input size uses exact capacity', () => {
    const state = vectorDS.createInitialState([1, 2, 3, 4])
    expect(state.size).toBe(4)
    expect(state.capacity).toBe(4)
  })

  it('single element', () => {
    const state = vectorDS.createInitialState([42])
    expect(state.size).toBe(1)
    expect(state.capacity).toBe(1)
    expect(state.data[0]).toBe(42)
  })
})

describe('vector: push_back', () => {
  it('appends within capacity', () => {
    const state = vectorDS.createInitialState([1, 2])
    // capacity should be 2, so push_back triggers realloc
    const s2 = apply(state, 'push_back', { val: 3 })
    expect(s2.size).toBe(3)
    expect(s2.data.slice(0, 3)).toEqual([1, 2, 3])
  })

  it('doubles capacity when full', () => {
    const state = vectorDS.createInitialState([1, 2, 3, 4])
    expect(state.capacity).toBe(4)
    const s2 = apply(state, 'push_back', { val: 5 })
    expect(s2.size).toBe(5)
    expect(s2.capacity).toBe(8)
    expect(s2.data.slice(0, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('push_back on empty vector allocates capacity 1', () => {
    const state = vectorDS.createInitialState([])
    const s2 = apply(state, 'push_back', { val: 99 })
    expect(s2.size).toBe(1)
    expect(s2.capacity).toBe(1)
    expect(s2.data[0]).toBe(99)
  })

  it('multiple push_backs grow correctly', () => {
    let s = vectorDS.createInitialState([])
    for (let i = 1; i <= 9; i++) {
      s = apply(s, 'push_back', { val: i })
    }
    expect(s.size).toBe(9)
    expect(s.capacity).toBe(16)
    expect(s.data.slice(0, 9)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })
})

describe('vector: pop_back', () => {
  it('decreases size by 1', () => {
    const state = vectorDS.createInitialState([1, 2, 3])
    const s2 = apply(state, 'pop_back')
    expect(s2.size).toBe(2)
    expect(s2.capacity).toBe(state.capacity) // capacity unchanged
  })

  it('pop_back on empty throws', () => {
    const state = vectorDS.createInitialState([])
    expect(() => apply(state, 'pop_back')).toThrow()
  })

  it('pop then push reuses capacity', () => {
    const state = vectorDS.createInitialState([1, 2, 3, 4])
    const s2 = apply(state, 'pop_back')
    const s3 = apply(s2, 'push_back', { val: 99 })
    expect(s3.size).toBe(4)
    expect(s3.capacity).toBe(4) // no realloc needed
    expect(s3.data.slice(0, 4)).toEqual([1, 2, 3, 99])
  })
})

describe('vector: insert', () => {
  it('inserts at beginning', () => {
    const state = vectorDS.createInitialState([2, 3, 4])
    const s2 = apply(state, 'insert', { pos: 0, val: 1 })
    expect(s2.size).toBe(4)
    expect(s2.data.slice(0, 4)).toEqual([1, 2, 3, 4])
  })

  it('inserts in middle', () => {
    const state = vectorDS.createInitialState([1, 3, 4])
    const s2 = apply(state, 'insert', { pos: 1, val: 2 })
    expect(s2.size).toBe(4)
    expect(s2.data.slice(0, 4)).toEqual([1, 2, 3, 4])
  })

  it('inserts at end (same as push_back)', () => {
    const state = vectorDS.createInitialState([1, 2])
    const s2 = apply(state, 'insert', { pos: 2, val: 3 })
    expect(s2.size).toBe(3)
    expect(s2.data.slice(0, 3)).toEqual([1, 2, 3])
  })

  it('insert triggers realloc when at capacity', () => {
    const state = vectorDS.createInitialState([1, 2, 3, 4])
    expect(state.capacity).toBe(4)
    const s2 = apply(state, 'insert', { pos: 0, val: 0 })
    expect(s2.capacity).toBe(8)
    expect(s2.data.slice(0, 5)).toEqual([0, 1, 2, 3, 4])
  })

  it('insert at invalid position throws', () => {
    const state = vectorDS.createInitialState([1, 2])
    expect(() => apply(state, 'insert', { pos: -1, val: 0 })).toThrow()
    expect(() => apply(state, 'insert', { pos: 3, val: 0 })).toThrow()
  })
})

describe('vector: erase', () => {
  it('erases from beginning', () => {
    const state = vectorDS.createInitialState([1, 2, 3])
    const s2 = apply(state, 'erase', { pos: 0 })
    expect(s2.size).toBe(2)
    expect(s2.data.slice(0, 2)).toEqual([2, 3])
  })

  it('erases from middle', () => {
    const state = vectorDS.createInitialState([1, 2, 3])
    const s2 = apply(state, 'erase', { pos: 1 })
    expect(s2.size).toBe(2)
    expect(s2.data.slice(0, 2)).toEqual([1, 3])
  })

  it('erases last element', () => {
    const state = vectorDS.createInitialState([1, 2, 3])
    const s2 = apply(state, 'erase', { pos: 2 })
    expect(s2.size).toBe(2)
    expect(s2.data.slice(0, 2)).toEqual([1, 2])
  })

  it('erase at invalid position throws', () => {
    const state = vectorDS.createInitialState([1, 2])
    expect(() => apply(state, 'erase', { pos: -1 })).toThrow()
    expect(() => apply(state, 'erase', { pos: 2 })).toThrow()
  })

  it('erase on empty throws', () => {
    const state = vectorDS.createInitialState([])
    expect(() => apply(state, 'erase', { pos: 0 })).toThrow()
  })
})

describe('vector: reserve', () => {
  it('increases capacity when larger', () => {
    const state = vectorDS.createInitialState([1, 2])
    const s2 = apply(state, 'reserve', { cap: 16 })
    expect(s2.capacity).toBe(16)
    expect(s2.size).toBe(2)
    expect(s2.data.slice(0, 2)).toEqual([1, 2])
  })

  it('no-op when smaller than current capacity', () => {
    const state = vectorDS.createInitialState([1, 2, 3, 4])
    const s2 = apply(state, 'reserve', { cap: 2 })
    expect(s2.capacity).toBe(state.capacity)
  })
})

describe('vector: clear', () => {
  it('sets size to 0 but keeps capacity', () => {
    const state = vectorDS.createInitialState([1, 2, 3])
    const s2 = apply(state, 'clear')
    expect(s2.size).toBe(0)
    expect(s2.capacity).toBe(state.capacity)
  })
})

describe('vector: shrink_to_fit', () => {
  it('reduces capacity to size', () => {
    const state = vectorDS.createInitialState([1, 2, 3])
    const reserved = apply(state, 'reserve', { cap: 64 })
    expect(reserved.capacity).toBe(64)
    const shrunk = apply(reserved, 'shrink_to_fit')
    expect(shrunk.capacity).toBe(3)
    expect(shrunk.size).toBe(3)
    expect(shrunk.data.slice(0, 3)).toEqual([1, 2, 3])
  })

  it('no-op when already tight', () => {
    const state = vectorDS.createInitialState([1, 2, 3, 4])
    const s2 = apply(state, 'shrink_to_fit')
    expect(s2.capacity).toBe(4)
  })
})

describe('vector: layout', () => {
  it('produces struct header fields', () => {
    const state = vectorDS.createInitialState([1, 2, 3])
    const layout = vectorDS.computeLayout(state)

    // Should have struct-field elements for size, capacity, data
    const fields = layout.elements.filter(e => e.kind === 'struct-field')
    expect(fields.length).toBe(3)
  })

  it('produces backing array cells', () => {
    const state = vectorDS.createInitialState([1, 2, 3])
    const layout = vectorDS.computeLayout(state)

    const cells = layout.elements.filter(e => e.kind === 'cell')
    expect(cells.length).toBe(state.capacity) // one cell per capacity slot
  })

  it('dims unused capacity cells', () => {
    const state = vectorDS.createInitialState([1, 2])
    // capacity will be 2, so push to get unused slots
    const s2 = apply(state, 'push_back', { val: 3 })
    const layout = vectorDS.computeLayout(s2)

    const cells = layout.elements.filter(e => e.kind === 'cell')
    const dimmed = cells.filter(e => (e.data as any).dimmed)
    expect(dimmed.length).toBe(s2.capacity - s2.size)
  })

  it('produces a pointer arrow from data field to array', () => {
    const state = vectorDS.createInitialState([1, 2, 3])
    const layout = vectorDS.computeLayout(state)
    expect(layout.arrows.length).toBe(1) // data → backing array
  })

  it('empty vector produces no cells but still has struct header', () => {
    const state = vectorDS.createInitialState([])
    const layout = vectorDS.computeLayout(state)
    const fields = layout.elements.filter(e => e.kind === 'struct-field')
    expect(fields.length).toBe(3)
    const cells = layout.elements.filter(e => e.kind === 'cell')
    expect(cells.length).toBe(0)
  })
})
