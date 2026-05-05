import { describe, it, expect } from 'vitest'
import { listDS, type ListState } from '../src/datastructures/list.ts'

/** Apply operation and return the final state (last substep). */
function apply(state: ListState, op: string, args: Record<string, number> = {}): ListState {
  const substeps = listDS.applyOperation(state, op, args)
  expect(substeps.length).toBeGreaterThan(0)
  return substeps[substeps.length - 1].state
}

/** Apply operation and return all substeps. */
function applySteps(state: ListState, op: string, args: Record<string, number> = {}) {
  return listDS.applyOperation(state, op, args)
}

/** Get ordered values from head to tail. */
function values(state: ListState): number[] {
  const result: number[] = []
  let currentId = state.headId
  while (currentId !== null) {
    const node = state.nodes.find(n => n.id === currentId)!
    result.push(node.value)
    currentId = node.nextId
  }
  return result
}

describe('list: initial state', () => {
  it('empty input creates empty list', () => {
    const state = listDS.createInitialState([])
    expect(state.size).toBe(0)
    expect(state.headId).toBeNull()
    expect(state.tailId).toBeNull()
    expect(state.nodes).toEqual([])
  })

  it('single element list', () => {
    const state = listDS.createInitialState([42])
    expect(state.size).toBe(1)
    expect(state.headId).toBe(0)
    expect(state.tailId).toBe(0)
    expect(state.nodes.length).toBe(1)
    expect(state.nodes[0].value).toBe(42)
    expect(state.nodes[0].prevId).toBeNull()
    expect(state.nodes[0].nextId).toBeNull()
  })

  it('multiple elements are linked correctly', () => {
    const state = listDS.createInitialState([10, 20, 30])
    expect(state.size).toBe(3)
    expect(state.headId).toBe(0)
    expect(state.tailId).toBe(2)
    expect(values(state)).toEqual([10, 20, 30])

    // Check backward links
    const tail = state.nodes.find(n => n.id === 2)!
    expect(tail.prevId).toBe(1)
    const mid = state.nodes.find(n => n.id === 1)!
    expect(mid.prevId).toBe(0)
    expect(mid.nextId).toBe(2)
  })
})

describe('list: push_front', () => {
  it('push_front on empty list', () => {
    const state = listDS.createInitialState([])
    const s2 = apply(state, 'push_front', { val: 5 })
    expect(s2.size).toBe(1)
    expect(values(s2)).toEqual([5])
    expect(s2.headId).toBe(s2.tailId)
  })

  it('push_front on non-empty list', () => {
    const state = listDS.createInitialState([2, 3])
    const s2 = apply(state, 'push_front', { val: 1 })
    expect(s2.size).toBe(3)
    expect(values(s2)).toEqual([1, 2, 3])
  })

  it('multiple push_fronts maintain order', () => {
    let s = listDS.createInitialState([])
    s = apply(s, 'push_front', { val: 3 })
    s = apply(s, 'push_front', { val: 2 })
    s = apply(s, 'push_front', { val: 1 })
    expect(values(s)).toEqual([1, 2, 3])
  })
})

describe('list: push_back', () => {
  it('push_back on empty list', () => {
    const state = listDS.createInitialState([])
    const s2 = apply(state, 'push_back', { val: 5 })
    expect(s2.size).toBe(1)
    expect(values(s2)).toEqual([5])
    expect(s2.headId).toBe(s2.tailId)
  })

  it('push_back on non-empty list', () => {
    const state = listDS.createInitialState([1, 2])
    const s2 = apply(state, 'push_back', { val: 3 })
    expect(s2.size).toBe(3)
    expect(values(s2)).toEqual([1, 2, 3])
  })

  it('multiple push_backs maintain order', () => {
    let s = listDS.createInitialState([])
    s = apply(s, 'push_back', { val: 1 })
    s = apply(s, 'push_back', { val: 2 })
    s = apply(s, 'push_back', { val: 3 })
    expect(values(s)).toEqual([1, 2, 3])
  })
})

describe('list: pop_front', () => {
  it('removes first element', () => {
    const state = listDS.createInitialState([1, 2, 3])
    const s2 = apply(state, 'pop_front')
    expect(s2.size).toBe(2)
    expect(values(s2)).toEqual([2, 3])
  })

  it('pop_front on single element empties the list', () => {
    const state = listDS.createInitialState([42])
    const s2 = apply(state, 'pop_front')
    expect(s2.size).toBe(0)
    expect(s2.headId).toBeNull()
    expect(s2.tailId).toBeNull()
  })

  it('pop_front on empty throws', () => {
    const state = listDS.createInitialState([])
    expect(() => apply(state, 'pop_front')).toThrow()
  })
})

describe('list: pop_back', () => {
  it('removes last element', () => {
    const state = listDS.createInitialState([1, 2, 3])
    const s2 = apply(state, 'pop_back')
    expect(s2.size).toBe(2)
    expect(values(s2)).toEqual([1, 2])
  })

  it('pop_back on single element empties the list', () => {
    const state = listDS.createInitialState([42])
    const s2 = apply(state, 'pop_back')
    expect(s2.size).toBe(0)
    expect(s2.headId).toBeNull()
    expect(s2.tailId).toBeNull()
  })

  it('pop_back on empty throws', () => {
    const state = listDS.createInitialState([])
    expect(() => apply(state, 'pop_back')).toThrow()
  })
})

describe('list: insert', () => {
  it('insert at beginning (delegates to push_front)', () => {
    const state = listDS.createInitialState([2, 3])
    const s2 = apply(state, 'insert', { pos: 0, val: 1 })
    expect(values(s2)).toEqual([1, 2, 3])
  })

  it('insert at end (delegates to push_back)', () => {
    const state = listDS.createInitialState([1, 2])
    const s2 = apply(state, 'insert', { pos: 2, val: 3 })
    expect(values(s2)).toEqual([1, 2, 3])
  })

  it('insert in middle', () => {
    const state = listDS.createInitialState([1, 3])
    const s2 = apply(state, 'insert', { pos: 1, val: 2 })
    expect(s2.size).toBe(3)
    expect(values(s2)).toEqual([1, 2, 3])
  })

  it('insert at invalid position throws', () => {
    const state = listDS.createInitialState([1, 2])
    expect(() => apply(state, 'insert', { pos: -1, val: 0 })).toThrow()
    expect(() => apply(state, 'insert', { pos: 3, val: 0 })).toThrow()
  })

  it('insert in middle preserves bidirectional links', () => {
    const state = listDS.createInitialState([1, 3, 5])
    const s2 = apply(state, 'insert', { pos: 1, val: 2 })
    // Verify backward traversal
    const backValues: number[] = []
    let currentId = s2.tailId
    while (currentId !== null) {
      const node = s2.nodes.find(n => n.id === currentId)!
      backValues.push(node.value)
      currentId = node.prevId
    }
    expect(backValues).toEqual([5, 3, 2, 1])
  })
})

describe('list: erase', () => {
  it('erase first (delegates to pop_front)', () => {
    const state = listDS.createInitialState([1, 2, 3])
    const s2 = apply(state, 'erase', { pos: 0 })
    expect(values(s2)).toEqual([2, 3])
  })

  it('erase last (delegates to pop_back)', () => {
    const state = listDS.createInitialState([1, 2, 3])
    const s2 = apply(state, 'erase', { pos: 2 })
    expect(values(s2)).toEqual([1, 2])
  })

  it('erase from middle', () => {
    const state = listDS.createInitialState([1, 2, 3])
    const s2 = apply(state, 'erase', { pos: 1 })
    expect(s2.size).toBe(2)
    expect(values(s2)).toEqual([1, 3])
  })

  it('erase at invalid position throws', () => {
    const state = listDS.createInitialState([1, 2])
    expect(() => apply(state, 'erase', { pos: -1 })).toThrow()
    expect(() => apply(state, 'erase', { pos: 2 })).toThrow()
  })

  it('erase on empty throws', () => {
    const state = listDS.createInitialState([])
    expect(() => apply(state, 'erase', { pos: 0 })).toThrow()
  })

  it('erase from middle preserves bidirectional links', () => {
    const state = listDS.createInitialState([1, 2, 3, 4, 5])
    const s2 = apply(state, 'erase', { pos: 2 })
    expect(values(s2)).toEqual([1, 2, 4, 5])
    // Verify backward traversal
    const backValues: number[] = []
    let currentId = s2.tailId
    while (currentId !== null) {
      const node = s2.nodes.find(n => n.id === currentId)!
      backValues.push(node.value)
      currentId = node.prevId
    }
    expect(backValues).toEqual([5, 4, 2, 1])
  })
})

describe('list: substeps', () => {
  it('push_front produces 3 substeps', () => {
    const state = listDS.createInitialState([1, 2])
    const steps = applySteps(state, 'push_front', { val: 0 })
    expect(steps.length).toBe(3)
    expect(steps[0].description).toContain('Create new node')
    expect(steps[1].description).toContain('Link')
    expect(steps[2].description).toContain('Update head')
  })

  it('push_back produces 3 substeps', () => {
    const state = listDS.createInitialState([1, 2])
    const steps = applySteps(state, 'push_back', { val: 3 })
    expect(steps.length).toBe(3)
    expect(steps[0].description).toContain('Create new node')
    expect(steps[1].description).toContain('Link')
    expect(steps[2].description).toContain('Update tail')
  })

  it('pop_front produces 2 substeps', () => {
    const state = listDS.createInitialState([1, 2, 3])
    const steps = applySteps(state, 'pop_front')
    expect(steps.length).toBe(2)
    expect(steps[0].description).toContain('Update head')
    expect(steps[1].description).toContain('Delete')
  })

  it('pop_back produces 2 substeps', () => {
    const state = listDS.createInitialState([1, 2, 3])
    const steps = applySteps(state, 'pop_back')
    expect(steps.length).toBe(2)
    expect(steps[0].description).toContain('Update tail')
    expect(steps[1].description).toContain('Delete')
  })

  it('insert in middle produces 3 substeps', () => {
    const state = listDS.createInitialState([1, 3])
    const steps = applySteps(state, 'insert', { pos: 1, val: 2 })
    expect(steps.length).toBe(3)
    expect(steps[0].description).toContain('Create new node')
    expect(steps[1].description).toContain('Link')
    expect(steps[2].description).toContain('Link')
  })

  it('erase from middle produces 2 substeps', () => {
    const state = listDS.createInitialState([1, 2, 3])
    const steps = applySteps(state, 'erase', { pos: 1 })
    expect(steps.length).toBe(2)
    expect(steps[0].description).toContain('Unlink')
    expect(steps[1].description).toContain('Delete')
  })

  it('all intermediate substeps have valid renderable state', () => {
    const state = listDS.createInitialState([1, 2, 3])
    const ops = [
      { op: 'push_front', args: { val: 0 } },
      { op: 'push_back', args: { val: 4 } },
      { op: 'insert', args: { pos: 2, val: 99 } },
      { op: 'erase', args: { pos: 1 } },
      { op: 'pop_front', args: {} },
      { op: 'pop_back', args: {} },
    ]
    let s = state
    for (const { op, args } of ops) {
      const steps = applySteps(s, op, args)
      for (const step of steps) {
        const layout = listDS.computeLayout(step.state)
        expect(layout.elements.length).toBeGreaterThan(0)
        expect(layout.width).toBeGreaterThan(0)
      }
      s = steps[steps.length - 1].state
    }
  })
})

describe('list: layout', () => {
  it('produces struct header fields', () => {
    const state = listDS.createInitialState([1, 2, 3])
    const layout = listDS.computeLayout(state)

    const fields = layout.elements.filter(e => e.kind === 'struct-field')
    expect(fields.length).toBe(3)
    const fieldNames = fields.map(f => (f.data as any).name)
    expect(fieldNames).toContain('head')
    expect(fieldNames).toContain('tail')
    expect(fieldNames).toContain('size')
  })

  it('produces node cells for each element', () => {
    const state = listDS.createInitialState([10, 20, 30])
    const layout = listDS.computeLayout(state)

    const cells = layout.elements.filter(e => e.kind === 'cell')
    expect(cells.length).toBe(3)
  })

  it('empty list shows empty label and struct header', () => {
    const state = listDS.createInitialState([])
    const layout = listDS.computeLayout(state)

    const fields = layout.elements.filter(e => e.kind === 'struct-field')
    expect(fields.length).toBe(3)

    const labels = layout.elements.filter(e => e.kind === 'array-label')
    expect(labels.length).toBe(1)
    expect((labels[0].data as any).text).toBe('∅')

    expect(layout.arrows.length).toBe(0)
  })

  it('single node has 2 s-curve arrows (head and tail)', () => {
    const state = listDS.createInitialState([42])
    const layout = listDS.computeLayout(state)

    expect(layout.arrows.length).toBe(2)
    expect(layout.arrows[0].style).toBe('s-curve')
    expect(layout.arrows[1].style).toBe('s-curve')
  })

  it('two nodes have 2 straight arrows (next+prev) plus 2 s-curves', () => {
    const state = listDS.createInitialState([1, 2])
    const layout = listDS.computeLayout(state)

    const straightArrows = layout.arrows.filter(a => a.style === 'straight')
    const sCurveArrows = layout.arrows.filter(a => a.style === 's-curve')
    expect(straightArrows.length).toBe(2) // next + prev between the two nodes
    expect(sCurveArrows.length).toBe(2)   // head→first, tail→last
  })

  it('three nodes have 4 straight arrows (2 pairs) plus 2 s-curves', () => {
    const state = listDS.createInitialState([1, 2, 3])
    const layout = listDS.computeLayout(state)

    const straightArrows = layout.arrows.filter(a => a.style === 'straight')
    const sCurveArrows = layout.arrows.filter(a => a.style === 's-curve')
    expect(straightArrows.length).toBe(4) // 2 pairs of next+prev
    expect(sCurveArrows.length).toBe(2)   // head→first, tail→last
  })

  it('bidirectional arrows are vertically offset', () => {
    const state = listDS.createInitialState([1, 2])
    const layout = listDS.computeLayout(state)

    const straightArrows = layout.arrows.filter(a => a.style === 'straight')
    expect(straightArrows.length).toBe(2)

    // Next arrow (top) should have lower Y than prev arrow (bottom)
    const nextArrow = straightArrows.find(a => a.fromX < a.toX)!
    const prevArrow = straightArrows.find(a => a.fromX > a.toX)!
    expect(nextArrow.fromY).toBeLessThan(prevArrow.fromY)
  })

  it('nodes are spaced with NODE_GAP', () => {
    const state = listDS.createInitialState([1, 2, 3])
    const layout = listDS.computeLayout(state)

    const cells = layout.elements.filter(e => e.kind === 'cell')
    // Nodes should be evenly spaced
    const gap = cells[1].x - cells[0].x
    expect(gap).toBe(48 + 40) // CELL_SIZE + NODE_GAP
    expect(cells[2].x - cells[1].x).toBe(gap)
  })
})
